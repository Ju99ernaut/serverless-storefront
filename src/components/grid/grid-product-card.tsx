'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { Swiper, SwiperSlide } from 'swiper/react'
import { EffectCoverflow, Pagination, Zoom } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/effect-coverflow'
import 'swiper/css/zoom'
import { AlertTriangle, Check, Heart, Plus, Star } from 'lucide-react'
import { cn } from 'cn'
import { getProductLowestAvailableVariantStock, type Product } from '../../data/utils'
import { Badge } from '../ui/badge'
import { Button, buttonVariants } from '../ui/button'
import { OptimizedImage } from '../ui/optimized-image'

interface GridProductCardProps {
  product: Product
  isPriorityCard: boolean
  visible: boolean
  itemStyle?: CSSProperties
  isCompared: boolean
  wishlisted: boolean
  maxCompareReached: boolean
  itemRef: (el: HTMLDivElement | null) => void
  onLayoutChange: () => void
  onToggleCompare: (product: Product) => void
  onToggleWishlist: (product: Product) => void
}

export function GridProductCard({
  product,
  isPriorityCard,
  visible,
  itemStyle,
  isCompared,
  wishlisted,
  maxCompareReached,
  itemRef,
  onLayoutChange,
  onToggleCompare,
  onToggleWishlist,
}: GridProductCardProps) {
  const stockStatus = getProductLowestAvailableVariantStock(product)

  return (
    <div
      ref={itemRef}
      className={cn(
        'grid__item absolute top-2 left-2 group',
        product.size === 'large' && 'grid__item--size-a',
        product.category,
      )}
      style={itemStyle}
      aria-hidden={!visible}
    >
      <div className="relative">
        {/* Stock status badge overlay */}
        {stockStatus.isCompletelyOutOfStock ? (
          <Badge
            variant="destructive"
            className="pointer-events-none absolute bottom-3 left-3 z-10 text-[10px]"
          >
            Out of Stock
          </Badge>
        ) : stockStatus.hasLowStockVariant ? (
          <Badge
            variant="outline"
            className="pointer-events-none absolute bottom-3 left-3 z-10 text-[10px]"
          >
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            <span>Only {stockStatus.minAvailable} left</span>
          </Badge>
        ) : null}

        <Swiper
          className={cn(
            'swiper-container slider bg-card border border-border rounded-lg',
            isCompared && ' product--selected',
          )}
          modules={[Pagination, EffectCoverflow, Zoom]}
          effect="coverflow"
          grabCursor={true}
          zoom={true}
          autoHeight={true}
          pagination={{ clickable: true }}
          onAfterInit={onLayoutChange}
        >
          {product.images.map((imgSrc, imgIdx) => {
            const isLcpCandidate = isPriorityCard && imgIdx === 0
            return (
              <SwiperSlide key={`${product.id}-slide-${imgIdx}`} className="slider__item">
                <div className="swiper-zoom-container ">
                  <OptimizedImage
                    src={imgSrc}
                    alt={`${product.title} view ${imgIdx + 1}`}
                    width={product.size === 'large' ? 540 : 340}
                    height={product.size === 'large' ? 540 : 340}
                    priority={isLcpCandidate}
                    fetchPriority={isLcpCandidate ? 'high' : 'low'}
                    loading={isLcpCandidate ? 'eager' : 'lazy'}
                    onLoad={onLayoutChange}
                  />
                </div>
              </SwiperSlide>
            )
          })}
        </Swiper>
      </div>

      <div className="meta">
        <Link href={`/products/${product.slug}`} className="group inline-block pr-2">
          <h3 className="meta__title group-hover:text-primary transition-colors">
            {product.title}
          </h3>
        </Link>
        <span className="meta__brand">
          {product.brand} &middot; {product.subcategory}
        </span>
        <span className="meta__price">${product.price}</span>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-0.5 font-semibold text-amber-500"
              title={`${product.averageRating.toFixed(1)} out of 5 stars`}
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
              {product.averageRating.toFixed(1)}
            </span>
            <span className="text-muted-foreground">({product.reviewCount})</span>
          </div>
        </div>
      </div>

      {/* Love / Wishlist toggle */}
      <Button
        type="button"
        className={cn(
          'absolute top-4 right-4 z-2 transition-opacity',
          wishlisted
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
        data-active={wishlisted ? 'true' : 'false'}
        onClick={() => onToggleWishlist(product)}
        variant="outline"
        size="icon"
        aria-label={
          wishlisted ? `Remove ${product.title} from loved items` : `Love ${product.title}`
        }
        aria-pressed={wishlisted}
        title={wishlisted ? 'Remove from loved items' : 'Love item'}
      >
        <Heart
          className={cn('h-4 w-4', wishlisted && 'fill-rose-500 text-rose-500')}
          aria-hidden="true"
        />
      </Button>

      {/* Compare toggle */}
      <label
        className={cn(
          buttonVariants({
            variant: 'outline',
            size: 'icon',
            className: 'absolute top-4 left-4 z-2',
          }),
          'transition-opacity',
          isCompared ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
        )}
        data-active={isCompared ? 'true' : 'false'}
        title={
          !isCompared && maxCompareReached
            ? 'Maximum 3 products can be compared at once'
            : isCompared
              ? 'Remove from comparison'
              : 'Add to compare'
        }
      >
        <input
          className="sr-only"
          type="checkbox"
          checked={isCompared}
          onChange={() => onToggleCompare(product)}
        />
        {isCompared ? (
          <Check className="h-4 w-4 text-primary" aria-hidden="true" />
        ) : (
          <Plus className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="sr-only">Add to compare</span>
      </label>
    </div>
  )
}
