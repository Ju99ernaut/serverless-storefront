'use client';

import { useState, useEffect, useMemo, FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  User,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import {
  fetchProductBySlugWithReviews,
  submitProductReviewViaSdk,
} from '@/lib/payload-sdk';
import type {
  Product,
  ProductReviewItem,
  ProductVariant,
} from '@/data/products';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Cart from '@/components/Cart';

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug || '';

  const {
    products,
    cartItems,
    totalCartCount,
    isCartOpen,
    setIsCartOpen,
    addToCart,
    updateCartQuantity,
    removeCartItem,
    clearCart,
    user,
    isWishlisted,
    toggleWishlist,
    openAuthModal,
    refreshCatalog,
  } = useStore();

  const fallbackProduct = useMemo(
    () => products.find((p) => p.slug === slug || p.id === slug) || null,
    [products, slug]
  );

  const [product, setProduct] = useState<Product | null>(fallbackProduct);
  const [reviews, setReviews] = useState<ProductReviewItem[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(!fallbackProduct);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  // Review Form State
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

  useEffect(() => {
    if (fallbackProduct && !product) {
      setProduct(fallbackProduct);
    }
  }, [fallbackProduct, product]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    fetchProductBySlugWithReviews(slug)
      .then((res) => {
        if (cancelled) return;
        setProduct(res.product);
        setReviews(res.reviews || []);
        setRelatedProducts(res.relatedProducts || []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        if (fallbackProduct) {
          setProduct(fallbackProduct);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Synchronize default color and size when product loads
  useEffect(() => {
    if (!product || !product.variants || product.variants.length === 0) return;
    const firstInStock =
      product.variants.find((v) => v.stock - (v.reservedStock || 0) > 0) ||
      product.variants[0];
    setSelectedColor((prev) =>
      product.variants.some((v) => v.color === prev) ? prev : firstInStock.color
    );
    setSelectedSize((prev) =>
      product.variants.some((v) => v.size === prev) ? prev : firstInStock.size
    );
  }, [product]);

  const uniqueColors = useMemo(() => {
    if (!product?.variants) return [];
    const seen = new Map<string, string>();
    for (const v of product.variants) {
      if (!seen.has(v.color)) {
        seen.set(v.color, v.colorHex);
      }
    }
    return Array.from(seen.entries()).map(([color, colorHex]) => ({
      color,
      colorHex,
    }));
  }, [product]);

  const uniqueSizes = useMemo(() => {
    if (!product?.variants) return [];
    const set = new Set<string>();
    for (const v of product.variants) {
      set.add(v.size);
    }
    return Array.from(set);
  }, [product]);

  const activeVariant: ProductVariant | undefined = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return undefined;
    return (
      product.variants.find(
        (v) => v.color === selectedColor && v.size === selectedSize
      ) ||
      product.variants.find((v) => v.color === selectedColor) ||
      product.variants.find((v) => v.size === selectedSize) ||
      product.variants[0]
    );
  }, [product, selectedColor, selectedSize]);

  const availableStock = activeVariant
    ? Math.max(0, activeVariant.stock - (activeVariant.reservedStock || 0))
    : 0;
  const lowStockThreshold = activeVariant?.lowStockThreshold || 5;
  const isLowStock = availableStock > 0 && availableStock <= lowStockThreshold;
  const isOutOfStock = availableStock <= 0;

  useEffect(() => {
    if (availableStock > 0 && quantity > availableStock) {
      setQuantity(availableStock);
    } else if (availableStock > 0 && quantity < 1) {
      setQuantity(1);
    }
  }, [availableStock, quantity]);

  const galleryImages = useMemo(() => {
    const imgs = [...(product?.images || ['/images/shirt.png'])];
    if (activeVariant?.imageUrl && !imgs.includes(activeVariant.imageUrl)) {
      imgs.unshift(activeVariant.imageUrl);
    }
    return imgs;
  }, [product, activeVariant]);

  const handleAddToCart = () => {
    if (!product || !activeVariant || isOutOfStock) return;
    addToCart(product, {
      variantSku: activeVariant.sku,
      size: activeVariant.size,
      color: activeVariant.color,
      colorHex: activeVariant.colorHex,
      quantity,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const handleReviewSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!product || !user) return;
    if (!reviewTitle.trim() || !reviewComment.trim()) {
      setReviewError('Please enter a review headline and comment.');
      return;
    }

    setReviewSubmitting(true);
    setReviewError('');
    setReviewSuccess('');

    try {
      const res = await submitProductReviewViaSdk({
        productSlug: product.slug,
        authorName: user.name,
        authorEmail: user.email,
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim(),
        variantSize: activeVariant?.size,
        variantColor: activeVariant?.color,
      });
      setReviews((prev) => [res.review, ...prev]);
      setProduct(res.product);
      setReviewTitle('');
      setReviewComment('');
      setReviewRating(5);
      setReviewSuccess('Thank you! Your review has been published.');
      await refreshCatalog();
    } catch (err: unknown) {
      setReviewError(
        err instanceof Error ? err.message : 'Unable to submit review.'
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading && !product) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-[var(--fg-muted)]">
        Loading garment details...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center gap-4">
        <h1 className="text-2xl font-bold text-[var(--fg-heading)]">
          Garment Not Found
        </h1>
        <p className="text-sm text-[var(--fg-muted)]">
          We couldn&apos;t locate the requested clothing item.
        </p>
        <Button asChild>
          <Link href="/">Return to Storefront</Link>
        </Button>
      </div>
    );
  }

  const wishlisted = isWishlisted(product.slug);
  const displayPrice = activeVariant?.priceOverride ?? product.price;

  return (
    <div className="min-h-screen pb-16">
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeCartItem}
        onClearCart={clearCart}
      />

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-color)] bg-[var(--surface-drawer)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Back to Store</span>
              </Link>
            </Button>
            <span className="hidden sm:inline text-xs text-[var(--fg-muted)]">
              / {product.category} / {product.subcategory}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href="/account">
                  <User className="h-4 w-4 text-[#797BED]" aria-hidden="true" />
                  <span>{user.name}</span>
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openAuthModal('account')}
              >
                Sign In
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => setIsCartOpen(true)}
              className="gap-1.5"
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              <span>Bag ({totalCartCount})</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Product Showcase Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Multi-Image Gallery */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface-card)] p-8 flex items-center justify-center min-h-[380px] sm:min-h-[460px]">
              {isOutOfStock ? (
                <Badge
                  variant="destructive"
                  className="absolute top-4 left-4 z-10"
                >
                  Out of Stock
                </Badge>
              ) : isLowStock ? (
                <Badge variant="warning" className="absolute top-4 left-4 z-10">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Low Stock: Only {availableStock} Left</span>
                </Badge>
              ) : (
                <Badge variant="success" className="absolute top-4 left-4 z-10">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>In Stock ({availableStock} ready)</span>
                </Badge>
              )}

              <OptimizedImage
                src={galleryImages[activeImageIndex] || '/images/shirt.png'}
                alt={`${product.title} — image ${activeImageIndex + 1}`}
                width={520}
                height={520}
                priority={true}
                fetchPriority="high"
                loading="eager"
                className="max-h-[360px] w-auto object-contain drop-shadow-xl"
              />
            </div>

            {galleryImages.length > 1 && (
              <div
                className="grid grid-cols-4 gap-3"
                role="tablist"
                aria-label="Product gallery thumbnails"
              >
                {galleryImages.map((imgUrl, idx) => (
                  <button
                    key={`${product.id}-thumb-${idx}`}
                    type="button"
                    role="tab"
                    aria-selected={activeImageIndex === idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`rounded-xl border p-2.5 bg-[var(--surface-card)] flex items-center justify-center h-20 transition-all cursor-pointer ${
                      activeImageIndex === idx
                        ? 'border-[#5C5EDC] ring-2 ring-[#5C5EDC]/40'
                        : 'border-[var(--border-color)] hover:border-[#5C5EDC]/60'
                    }`}
                  >
                    <OptimizedImage
                      src={imgUrl}
                      alt={`${product.title} thumbnail ${idx + 1}`}
                      width={100}
                      height={100}
                      className="max-h-full w-auto object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Details, Variants, Stock & Add to Bag */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#797BED]">
                <span>{product.brand}</span>
                <span>&bull;</span>
                <span>{product.subcategory}</span>
              </div>

              <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold text-[var(--fg-heading)]">
                {product.title}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <span className="text-2xl font-bold text-[#797BED]">
                  ${displayPrice.toFixed(2)}
                </span>
                {product.compareAtPrice && product.compareAtPrice > displayPrice && (
                  <span className="text-base line-through text-[var(--fg-muted)]">
                    ${product.compareAtPrice.toFixed(2)}
                  </span>
                )}
                <div className="flex items-center gap-1.5 text-sm">
                  <Star
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                    aria-hidden="true"
                  />
                  <span className="font-bold text-[var(--fg-heading)]">
                    {product.averageRating.toFixed(1)}
                  </span>
                  <span className="text-[var(--fg-muted)]">
                    ({product.reviewCount} reviews)
                  </span>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-[var(--fg-primary)]">
                {product.description}
              </p>
            </div>

            {/* Color Selection */}
            {uniqueColors.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                    Color
                  </span>
                  <span className="font-semibold text-[var(--fg-heading)]">
                    {selectedColor}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {uniqueColors.map((c) => {
                    const isSelected = selectedColor === c.color;
                    return (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => setSelectedColor(c.color)}
                        aria-pressed={isSelected}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#5C5EDC] bg-[#5C5EDC]/12 text-[var(--fg-heading)] ring-1 ring-[#5C5EDC]'
                            : 'border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--fg-primary)] hover:border-[#5C5EDC]/60'
                        }`}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-white/40 shadow-xs"
                          style={{ backgroundColor: c.colorHex }}
                          aria-hidden="true"
                        />
                        <span>{c.color}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selection */}
            {uniqueSizes.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                    Size
                  </span>
                  <span className="text-[var(--fg-muted)]">
                    SKU: <code>{activeVariant?.sku || 'N/A'}</code>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {uniqueSizes.map((sz) => {
                    const variantForSize = product.variants.find(
                      (v) => v.size === sz && v.color === selectedColor
                    );
                    const avail = variantForSize
                      ? Math.max(
                          0,
                          variantForSize.stock -
                            (variantForSize.reservedStock || 0)
                        )
                      : 0;
                    const isSelected = selectedSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        aria-pressed={isSelected}
                        className={`min-w-[48px] rounded-lg border px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#5C5EDC] bg-[#5C5EDC] text-white'
                            : avail <= 0
                              ? 'border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--fg-muted)] opacity-50 line-through'
                              : 'border-[var(--border-color)] bg-[var(--surface-card)] text-[var(--fg-heading)] hover:border-[#5C5EDC]'
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Real-Time Stock Alert */}
            {isOutOfStock ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <strong className="block font-semibold">
                    Out of stock in {selectedColor} ({selectedSize})
                  </strong>
                  <span className="text-xs">
                    All units are currently allocated or sold out. Choose
                    another color or size variant.
                  </span>
                </div>
              </Alert>
            ) : isLowStock ? (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <strong className="block font-semibold">
                    Low Stock Alert — Only {availableStock} left!
                  </strong>
                  <span className="text-xs">
                    Variant <strong>{activeVariant?.color}</strong> (Size{' '}
                    <strong>{activeVariant?.size}</strong>) is selling fast.
                    Durable workflow reservations prevent double allocation at
                    checkout.
                  </span>
                </div>
              </Alert>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-500">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>
                  {availableStock} units available in {activeVariant?.color} (
                  {activeVariant?.size}) &bull; Protected against double
                  allocation
                </span>
              </div>
            )}

            {/* Quantity + Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="inline-flex items-center rounded-lg border border-[var(--border-color)] bg-[var(--surface-card)]">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={isOutOfStock || quantity <= 1}
                  aria-label="Decrease quantity"
                  className="p-2.5 text-[var(--fg-heading)] hover:text-[#5C5EDC] disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="w-10 text-center text-sm font-bold text-[var(--fg-heading)]">
                  {isOutOfStock ? 0 : quantity}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((q) => Math.min(availableStock, q + 1))
                  }
                  disabled={isOutOfStock || quantity >= availableStock}
                  aria-label="Increase quantity"
                  className="p-2.5 text-[var(--fg-heading)] hover:text-[#5C5EDC] disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <Button
                type="button"
                size="lg"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="flex-1 min-w-[180px] gap-2"
              >
                {addedFeedback ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>Added to Bag!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {isOutOfStock
                        ? 'Out of Stock'
                        : `Add to Bag — $${(displayPrice * quantity).toFixed(2)}`}
                    </span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => void toggleWishlist(product)}
                aria-label={wishlisted ? 'Remove from loved items' : 'Love item'}
                className="gap-1.5"
              >
                <Heart
                  className={`h-4 w-4 ${
                    wishlisted ? 'fill-rose-500 text-rose-500' : ''
                  }`}
                  aria-hidden="true"
                />
                <span>{wishlisted ? 'Loved' : 'Love'}</span>
              </Button>
            </div>

            {addedFeedback && (
              <div className="flex items-center justify-between rounded-lg border border-[#5C5EDC]/40 bg-[#5C5EDC]/10 px-4 py-2.5 text-xs">
                <span>Variant added to your shopping bag.</span>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(true)}
                  className="font-bold text-[#797BED] hover:underline cursor-pointer"
                >
                  Open Bag &amp; Checkout &rarr;
                </button>
              </div>
            )}

            {/* Garment Specifications */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] p-3.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                  Material
                </span>
                <span className="mt-1 block text-xs font-semibold text-[var(--fg-heading)]">
                  {product.material}
                </span>
              </div>
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] p-3.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                  Tailored Fit
                </span>
                <span className="mt-1 block text-xs font-semibold text-[var(--fg-heading)]">
                  {product.fit}
                </span>
              </div>
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] p-3.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                  Garment Care
                </span>
                <span className="mt-1 block text-xs font-semibold text-[var(--fg-heading)]">
                  {product.care}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
              <Truck className="h-4 w-4 text-[#797BED]" aria-hidden="true" />
              <span>
                Available for Pay &amp; Delivery, Pay then Collect, Pay on
                Delivery (COD), and Pay on Collection.
              </span>
            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <section
          aria-label="Customer Reviews"
          className="mt-14 pt-10 border-t border-[var(--border-color)]"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Review Form / Prompt */}
            <div className="lg:col-span-5 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#797BED]" aria-hidden="true" />
                    <span>Customer Reviews ({product.reviewCount})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-bold text-[var(--fg-heading)]">
                      {product.averageRating.toFixed(1)}
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= Math.round(product.averageRating)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-[var(--fg-muted)]'
                            }`}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                      <span className="block text-xs text-[var(--fg-muted)]">
                        Based on {product.reviewCount} rating(s)
                      </span>
                    </div>
                  </div>

                  {user ? (
                    <form
                      onSubmit={handleReviewSubmit}
                      className="space-y-3 border-t border-[var(--border-color)] pt-4"
                    >
                      <div className="text-xs font-semibold text-[var(--fg-heading)]">
                        Write a Review as {user.name}
                      </div>

                      {reviewError && (
                        <Alert variant="destructive">
                          <span className="text-xs">{reviewError}</span>
                        </Alert>
                      )}
                      {reviewSuccess && (
                        <Alert variant="success">
                          <span className="text-xs">{reviewSuccess}</span>
                        </Alert>
                      )}

                      <div className="space-y-1">
                        <span className="text-xs text-[var(--fg-muted)]">
                          Your Rating
                        </span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewRating(star)}
                              aria-label={`Rate ${star} out of 5 stars`}
                              className="p-1 cursor-pointer"
                            >
                              <Star
                                className={`h-5 w-5 ${
                                  star <= reviewRating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-[var(--fg-muted)]'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="review-title"
                          className="text-xs font-semibold text-[var(--fg-heading)]"
                        >
                          Headline
                        </label>
                        <Input
                          id="review-title"
                          placeholder="e.g., Tailored silhouette & superb fabric"
                          value={reviewTitle}
                          onChange={(e) => setReviewTitle(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="review-comment"
                          className="text-xs font-semibold text-[var(--fg-heading)]"
                        >
                          Review Details
                        </label>
                        <Textarea
                          id="review-comment"
                          placeholder="Share how this piece fits, feels, and wears..."
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          required
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={reviewSubmitting}
                        className="w-full"
                      >
                        {reviewSubmitting
                          ? 'Publishing Review...'
                          : 'Submit Review'}
                      </Button>
                    </form>
                  ) : (
                    <div className="border-t border-[var(--border-color)] pt-4 space-y-2">
                      <p className="text-xs text-[var(--fg-muted)]">
                        Sign in or create an account to leave a verified
                        clothing review.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => openAuthModal('review')}
                      >
                        Sign In to Write a Review
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Existing Reviews List */}
            <div className="lg:col-span-7 space-y-4">
              {reviews.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-sm text-[var(--fg-muted)]">
                    No customer reviews yet for {product.title}. Be the first to
                    review this piece!
                  </CardContent>
                </Card>
              ) : (
                reviews.map((rev) => (
                  <Card key={rev.id}>
                    <CardContent className="p-5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[var(--fg-heading)]">
                            {rev.authorName}
                          </span>
                          {rev.verifiedPurchase && (
                            <Badge variant="success" className="text-[10px]">
                              <CheckCircle2
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                              <span>Verified Purchase</span>
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-[var(--fg-muted)]">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-3.5 w-3.5 ${
                                s <= rev.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-[var(--fg-muted)]'
                              }`}
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                        {(rev.variantColor || rev.variantSize) && (
                          <span className="text-[11px] text-[var(--fg-muted)]">
                            Purchased:{' '}
                            {[rev.variantColor, rev.variantSize]
                              .filter(Boolean)
                              .join(' • ')}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-[var(--fg-heading)]">
                        {rev.title}
                      </h3>
                      <p className="text-xs sm:text-sm leading-relaxed text-[var(--fg-primary)]">
                        {rev.comment}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Related Clothing */}
        {relatedProducts.length > 0 && (
          <section className="mt-14 pt-8 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-bold text-[var(--fg-heading)] mb-4">
              Complete the Wardrobe
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {relatedProducts.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/products/${rel.slug}`}
                  className="group rounded-xl border border-[var(--border-color)] bg-[var(--surface-card)] p-4 transition-colors hover:border-[#5C5EDC]"
                >
                  <div className="flex h-36 items-center justify-center rounded-lg bg-[var(--surface-elevated)] p-3">
                    <OptimizedImage
                      src={rel.images[0] || '/images/shirt.png'}
                      alt={rel.title}
                      width={160}
                      height={160}
                      className="max-h-full w-auto object-contain"
                    />
                  </div>
                  <div className="mt-3">
                    <div className="text-xs font-bold text-[var(--fg-heading)] group-hover:text-[#5C5EDC] truncate">
                      {rel.title}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-xs text-[var(--fg-muted)]">
                      <span>{rel.brand}</span>
                      <span className="font-bold text-[#797BED]">
                        ${rel.price}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
