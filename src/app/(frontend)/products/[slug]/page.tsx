'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  CACHE_TIMES,
  fetchCatalogData,
  storefrontQueryKeys,
  useAuth,
  useCart,
  useWishlist,
} from '@/context'
import { fetchProductBySlugWithReviews } from '@/lib/payload-sdk'
import type { Product, ProductVariant } from '@/data/utils'
import {
  ProductDetailSkeleton,
  ProductImageGallery,
  ProductInfoPanel,
  ProductNotFound,
  ProductReviewsSection,
  RelatedProductsSection,
} from '@/components/products'

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug || ''

  const { user, openAuthModal } = useAuth()
  const { setIsCartOpen, addToCart } = useCart()
  const { isWishlisted, toggleWishlist } = useWishlist()

  const { data: catalog } = useQuery({
    queryKey: storefrontQueryKeys.catalog,
    queryFn: fetchCatalogData,
    ...CACHE_TIMES.catalog,
  })

  const fallbackProduct = useMemo(() => {
    const products = catalog?.products ?? []
    return products.find((p) => p.slug === slug || p.id === slug) || null
  }, [catalog?.products, slug])

  const productDetailQuery = useQuery({
    queryKey: storefrontQueryKeys.productDetail(slug),
    queryFn: () => fetchProductBySlugWithReviews(slug),
    enabled: Boolean(slug),
    ...CACHE_TIMES.productDetail,
  })

  const product = productDetailQuery.data?.product ?? fallbackProduct
  const reviews = productDetailQuery.data?.reviews ?? []
  const relatedProducts = productDetailQuery.data?.relatedProducts ?? []
  const isInitialLoading = productDetailQuery.isLoading && !product

  const [selectedColor, setSelectedColor] = useState<string>('')
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [addedFeedback, setAddedFeedback] = useState(false)

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

  if (isInitialLoading) {
    return <ProductDetailSkeleton />
  }

  if (!product) {
    return <ProductNotFound />
  }

  const wishlisted = isWishlisted(product.slug)

  return (
    <>
      {/* Product Showcase Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <ProductImageGallery
          productId={product.id}
          productTitle={product.title}
          galleryImages={galleryImages}
          activeVariantImageUrl={activeVariant?.imageUrl || undefined}
          isOutOfStock={isOutOfStock}
          isLowStock={isLowStock}
          availableStock={availableStock}
        />

        <ProductInfoPanel
          product={product}
          uniqueColors={uniqueColors}
          uniqueSizes={uniqueSizes}
          selectedColor={selectedColor}
          selectedSize={selectedSize}
          activeVariant={activeVariant}
          availableStock={availableStock}
          isLowStock={isLowStock}
          isOutOfStock={isOutOfStock}
          quantity={quantity}
          addedFeedback={addedFeedback}
          wishlisted={wishlisted}
          onSelectColor={setSelectedColor}
          onSelectSize={setSelectedSize}
          onDecreaseQuantity={() => setQuantity((q) => Math.max(1, q - 1))}
          onIncreaseQuantity={() => setQuantity((q) => Math.min(availableStock, q + 1))}
          onAddToCart={handleAddToCart}
          onToggleWishlist={() => void toggleWishlist(product)}
          onOpenCart={() => setIsCartOpen(true)}
        />
      </div>

      <ProductReviewsSection
        product={product}
        activeVariant={activeVariant}
        reviews={reviews}
        loading={productDetailQuery.isLoading}
        user={user}
        onOpenAuthModal={() => openAuthModal('review')}
      />

      <RelatedProductsSection relatedProducts={relatedProducts} />
    </>
  )
}
