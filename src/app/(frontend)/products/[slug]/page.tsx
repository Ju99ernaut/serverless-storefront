'use client'

import { useState, useEffect, useMemo, FormEvent } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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
  Star,
  Truck,
} from 'lucide-react'
import { useStore } from '@/context/store-context'
import { fetchProductBySlugWithReviews, submitProductReviewViaSdk } from '@/lib/payload-sdk'
import type { Product, ProductReviewItem, ProductVariant } from '@/data/utils'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import Cart from '@/components/cart'
import UserMenu from '@/components/user-menu'
import { cn } from 'cn'

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug || ''

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
  } = useStore()

  const fallbackProduct = useMemo(
    () => products.find((p) => p.slug === slug || p.id === slug) || null,
    [products, slug],
  )

  const [product, setProduct] = useState<Product | null>(fallbackProduct)
  const [reviews, setReviews] = useState<ProductReviewItem[]>([])
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(!fallbackProduct)

  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [addedFeedback, setAddedFeedback] = useState(false)

  // Review Form State
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewTitle, setReviewTitle] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')

  useEffect(() => {
    if (fallbackProduct && !product) {
      setProduct(fallbackProduct)
    }
  }, [fallbackProduct, product])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    fetchProductBySlugWithReviews(slug)
      .then((res) => {
        if (cancelled) return
        setProduct(res.product)
        setReviews(res.reviews || [])
        setRelatedProducts(res.relatedProducts || [])
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        if (fallbackProduct) {
          setProduct(fallbackProduct)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  // Synchronize default color and size when product loads
  useEffect(() => {
    if (!product || !product.variants || product.variants.length === 0) return
    const firstInStock =
      product.variants.find((v) => v.stock - (v.reservedStock || 0) > 0) || product.variants[0]
    setSelectedColor((prev) =>
      product.variants.some((v) => v.color === prev) ? prev : firstInStock.color,
    )
    setSelectedSize((prev) =>
      product.variants.some((v) => v.size === prev) ? prev : firstInStock.size,
    )
  }, [product])

  const uniqueColors = useMemo(() => {
    if (!product?.variants) return []
    const seen = new Map<string, string>()
    for (const v of product.variants) {
      if (!seen.has(v.color)) {
        seen.set(v.color, v.colorHex)
      }
    }
    return Array.from(seen.entries()).map(([color, colorHex]) => ({
      color,
      colorHex,
    }))
  }, [product])

  const uniqueSizes = useMemo(() => {
    if (!product?.variants) return []
    const set = new Set<string>()
    for (const v of product.variants) {
      set.add(v.size)
    }
    return Array.from(set)
  }, [product])

  const activeVariant: ProductVariant | undefined = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return undefined
    return (
      product.variants.find((v) => v.color === selectedColor && v.size === selectedSize) ||
      product.variants.find((v) => v.color === selectedColor) ||
      product.variants.find((v) => v.size === selectedSize) ||
      product.variants[0]
    )
  }, [product, selectedColor, selectedSize])

  const availableStock = activeVariant
    ? Math.max(0, activeVariant.stock - (activeVariant.reservedStock || 0))
    : 0
  const lowStockThreshold = activeVariant?.lowStockThreshold || 5
  const isLowStock = availableStock > 0 && availableStock <= lowStockThreshold
  const isOutOfStock = availableStock <= 0

  useEffect(() => {
    if (availableStock > 0 && quantity > availableStock) {
      setQuantity(availableStock)
    } else if (availableStock > 0 && quantity < 1) {
      setQuantity(1)
    }
  }, [availableStock, quantity])

  const galleryImages = useMemo(() => {
    const imgs = [...(product?.images || ['/images/shirt.png'])]
    if (activeVariant?.imageUrl && !imgs.includes(activeVariant.imageUrl)) {
      imgs.unshift(activeVariant.imageUrl)
    }
    return imgs
  }, [product, activeVariant])

  const handleAddToCart = () => {
    if (!product || !activeVariant || isOutOfStock) return
    addToCart(product, {
      variantSku: activeVariant.sku,
      size: activeVariant.size,
      color: activeVariant.color,
      colorHex: activeVariant.colorHex,
      quantity,
    })
    setAddedFeedback(true)
    setTimeout(() => setAddedFeedback(false), 3600)
  }

  const handleReviewSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!product || !user) return
    if (!reviewTitle.trim() || !reviewComment.trim()) {
      setReviewError('Please enter a review headline and comment.')
      return
    }

    setReviewSubmitting(true)
    setReviewError('')
    setReviewSuccess('')

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
      })
      setReviews((prev) => [res.review, ...prev])
      setProduct(res.product)
      setReviewTitle('')
      setReviewComment('')
      setReviewRating(5)
      setReviewSuccess('Thank you! Your review has been published.')
      await refreshCatalog()
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Unable to submit review.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  if (loading && !product) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-[var(--fg-muted)]">
        Loading garment details...
      </div>
    )
  }

  if (!product) {
    return (
      <div className="bg-background min-h-screen flex flex-col items-center justify-center p-8 text-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">Garment Not Found</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t locate the requested clothing item.
        </p>
        <Link className={buttonVariants()} href="/">
          Return to Storefront
        </Link>
      </div>
    )
  }

  const wishlisted = isWishlisted(product.slug)
  const displayPrice = activeVariant?.priceOverride ?? product.price

  return (
    <div className="bg-background min-h-screen overflow-anchor-parent pb-16">
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeCartItem}
        onClearCart={clearCart}
      />

      {/* Sticky Top Navigation */}
      <header className="sticky-topbar-container">
        <div className="sticky-topbar-inner mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link className={buttonVariants({ variant: 'ghost', className: 'gap-1.5' })} href="/">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Store</span>
            </Link>
            <span className="hidden sm:inline text-xs text-muted-foreground">
              / {product.category} / {product.subcategory}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <UserMenu />
            <Button type="button" size="sm" onClick={() => setIsCartOpen(true)} className="gap-1.5">
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
            <div className="relative overflow-hidden rounded-md border border-border bg-card p-8 flex items-center justify-center min-h-[380px] sm:min-h-[460px]">
              {isOutOfStock ? (
                <Badge variant="destructive" className="absolute top-4 left-4 z-10">
                  Out of Stock
                </Badge>
              ) : isLowStock ? (
                <Badge variant="outline" className="absolute top-4 left-4 z-10">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Low Stock: Only {availableStock} Left</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="absolute top-4 left-4 z-10">
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
                    className={cn(
                      'rounded-md border p-2.5 bg-card flex items-center justify-center h-20 transition-all cursor-pointer',
                      activeImageIndex === idx
                        ? 'border-primary ring-2 ring-primary/40'
                        : 'border-border hover:border-primary/60',
                    )}
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
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <span>{product.brand}</span>
                <span>&bull;</span>
                <span>{product.subcategory}</span>
              </div>

              <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold text-foreground">
                {product.title}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <span className="text-2xl font-bold text-primary">${displayPrice.toFixed(2)}</span>
                {product.compareAtPrice && product.compareAtPrice > displayPrice && (
                  <span className="text-base line-through text-muted-foreground">
                    ${product.compareAtPrice.toFixed(2)}
                  </span>
                )}
                <div className="flex items-center gap-1.5 text-sm">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                  <span className="font-bold text-foreground">
                    {product.averageRating.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">({product.reviewCount} reviews)</span>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            </div>

            {/* Color Selection */}
            {uniqueColors.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-muted-foreground">
                    Color
                  </span>
                  <span className="font-semibold text-foreground">{selectedColor}</span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {uniqueColors.map((c) => {
                    const isSelected = selectedColor === c.color
                    return (
                      <Button
                        key={c.color}
                        type="button"
                        onClick={() => setSelectedColor(c.color)}
                        aria-pressed={isSelected}
                        variant="outline"
                        className={cn(
                          isSelected && 'border-primary text-foreground ring-1 ring-primary',
                        )}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-none border border-white/40 shadow-xs"
                          style={{ backgroundColor: c.colorHex }}
                          aria-hidden="true"
                        />
                        <span>{c.color}</span>
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Size Selection */}
            {uniqueSizes.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-muted-foreground">
                    Size
                  </span>
                  <span className="text-muted-foreground">
                    SKU: <code>{activeVariant?.sku || 'N/A'}</code>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {uniqueSizes.map((sz) => {
                    const variantForSize = product.variants.find(
                      (v) => v.size === sz && v.color === selectedColor,
                    )
                    const avail = variantForSize
                      ? Math.max(0, variantForSize.stock - (variantForSize.reservedStock || 0))
                      : 0
                    const isSelected = selectedSize === sz
                    return (
                      <Button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        aria-pressed={isSelected}
                        variant={isSelected ? 'default' : 'outline'}
                        className="font-bold min-w-[44px]"
                      >
                        {sz}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}

            {isOutOfStock ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <strong className="block font-semibold">
                    Out of stock in {selectedColor} ({selectedSize})
                  </strong>
                  <span className="text-xs">
                    All units are currently allocated or sold out. Choose another color or size
                    variant.
                  </span>
                </div>
              </Alert>
            ) : isLowStock ? (
              <Alert>
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <strong className="block font-semibold">
                    Low Stock Alert — Only {availableStock} left!
                  </strong>
                  <span className="text-xs">
                    Variant <strong>{activeVariant?.color}</strong> (Size{' '}
                    <strong>{activeVariant?.size}</strong>) is selling fast.
                  </span>
                </div>
              </Alert>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-500">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>
                  {availableStock} units available in {activeVariant?.color} ({activeVariant?.size}
                  ).
                </span>
              </div>
            )}

            {/* Quantity + Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <div className="inline-flex items-center rounded-md border border-border bg-card">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={isOutOfStock || quantity <= 1}
                  aria-label="Decrease quantity"
                  variant="ghost"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="w-10 text-center text-sm font-bold text-foreground">
                  {isOutOfStock ? 0 : quantity}
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                  disabled={isOutOfStock || quantity >= availableStock}
                  aria-label="Increase quantity"
                  variant="ghost"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="flex-1 gap-2 font-bold"
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
                        : `Add to Bag: $${(displayPrice * quantity).toFixed(2)}`}
                    </span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void toggleWishlist(product)}
                aria-label={wishlisted ? 'Remove from loved items' : 'Love item'}
                className="gap-1.5"
              >
                <Heart
                  className={`h-4 w-4 ${wishlisted ? 'fill-rose-500 text-rose-500' : ''}`}
                  aria-hidden="true"
                />
              </Button>
            </div>

            {addedFeedback && (
              <div className="flex items-center justify-between rounded-none border border-border px-4 py-2.5 text-xs">
                <span>Variant added to your shopping bag.</span>
                <Button
                  type="button"
                  className="text-xs"
                  onClick={() => setIsCartOpen(true)}
                  variant="link"
                >
                  Open Bag &amp; Checkout &rarr;
                </Button>
              </div>
            )}

            {/* Garment Specifications */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-md border border-border bg-card p-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Material
                </span>
                <span className="mt-1 block text-xs font-semibold text-foreground">
                  {product.material}
                </span>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tailored Fit
                </span>
                <span className="mt-1 block text-xs font-semibold text-foreground">
                  {product.fit}
                </span>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Garment Care
                </span>
                <span className="mt-1 block text-xs font-semibold text-foreground">
                  {product.care}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Truck className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>
                Available for Pay &amp; Delivery, Pay then Collect, Pay on Delivery, and Pay on
                Collection.
              </span>
            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <section aria-label="Customer Reviews" className="mt-14 pt-10 border-t border-border">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Review Form / Prompt */}
            <div className="lg:col-span-5 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" aria-hidden="true" />
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
                                : 'text-muted-foreground'
                            }`}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                      <span className="block text-xs text-muted-foreground">
                        Based on {product.reviewCount} rating(s)
                      </span>
                    </div>
                  </div>

                  {user ? (
                    <form
                      onSubmit={handleReviewSubmit}
                      className="space-y-3 border-t border-border pt-4"
                    >
                      <div className="text-xs font-semibold text-foreground">
                        Write a Review as {user.name}
                      </div>

                      {reviewError && (
                        <Alert variant="destructive">
                          <span className="text-xs">{reviewError}</span>
                        </Alert>
                      )}
                      {reviewSuccess && (
                        <Alert>
                          <span className="text-xs">{reviewSuccess}</span>
                        </Alert>
                      )}

                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Your Rating</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Button
                              key={star}
                              type="button"
                              size="icon-sm"
                              onClick={() => setReviewRating(star)}
                              aria-label={`Rate ${star} out of 5 stars`}
                              variant="ghost"
                            >
                              <Star
                                className={cn(
                                  'h-5 w-5',
                                  star <= reviewRating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-muted-foreground',
                                )}
                              />
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="review-title"
                          className="text-xs font-semibold text-foreground"
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
                          className="text-xs font-semibold text-foreground"
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

                      <Button type="submit" disabled={reviewSubmitting} className="w-full">
                        {reviewSubmitting ? 'Publishing Review...' : 'Submit Review'}
                      </Button>
                    </form>
                  ) : (
                    <div className="border-t border-border pt-4 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Sign in or create an account to leave a verified clothing review.
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
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    No customer reviews yet for {product.title}. Be the first to review this piece!
                  </CardContent>
                </Card>
              ) : (
                reviews.map((rev) => (
                  <Card key={rev.id}>
                    <CardContent className="p-5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            {rev.authorName}
                          </span>
                          {rev.verifiedPurchase && (
                            <Badge className="text-[10px]">
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              <span>Verified Purchase</span>
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn(
                                'h-3.5 w-3.5',
                                s <= rev.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-muted-foreground',
                              )}
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                        {(rev.variantColor || rev.variantSize) && (
                          <span className="text-[11px] text-muted-foreground">
                            Purchased:{' '}
                            {[rev.variantColor, rev.variantSize].filter(Boolean).join(' • ')}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-foreground">{rev.title}</h3>
                      <p className="text-xs sm:text-sm leading-relaxed text-primary">
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
          <section className="mt-14 pt-8 border-t border-border">
            <h2 className="text-lg font-bold text-foreground mb-4">Complete the Wardrobe</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {relatedProducts.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/products/${rel.slug}`}
                  className="group rounded-md border border-border bg-card p-4 transition-colors hover:border-primary"
                >
                  <div className="flex h-36 items-center justify-center rounded-none bg-secondary p-3">
                    <OptimizedImage
                      src={rel.images[0] || '/images/shirt.png'}
                      alt={rel.title}
                      width={160}
                      height={160}
                      className="max-h-full w-auto object-contain"
                    />
                  </div>
                  <div className="mt-3">
                    <div className="text-xs font-bold text-foreground group-hover:text-primary truncate">
                      {rel.title}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{rel.brand}</span>
                      <span className="font-bold text-primary">${rel.price}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
