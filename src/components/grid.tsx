'use client'

import { useState, useEffect, useRef, useCallback, CSSProperties } from 'react'
import Link from 'next/link'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination, EffectCoverflow, Zoom } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/effect-coverflow'
import 'swiper/css/zoom'
import { AlertTriangle, Check, Heart, Loader2, Plus, Star } from 'lucide-react'
import { OptimizedImage } from './ui/optimized-image'
import { Badge } from './ui/badge'
import { useStore } from '../context/store-context'
import { getProductLowestAvailableVariantStock, type Product } from '../data/utils'
import { cn } from 'cn'
import { Button, buttonVariants } from './ui/button'

interface ItemPosition {
  visible: boolean
  x: number
  y: number
  width: number
}

interface GridLayoutState {
  height: number
  items: Record<string, ItemPosition>
}

interface GridProps {
  products: Product[]
  activeFilter: string
  searchQuery?: string
  compareIds: string[]
  maxCompareReached: boolean
  onToggleCompare: (product: Product) => void
  onAddToCart: (product: Product) => void
}

const Grid = ({
  products,
  activeFilter,
  searchQuery = '',
  compareIds,
  maxCompareReached,
  onToggleCompare,
}: GridProps) => {
  const { isWishlisted, toggleWishlist } = useStore()
  const gridRef = useRef<HTMLElement | null>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [isLoaded, setIsLoaded] = useState(false)
  const [layout, setLayout] = useState<GridLayoutState>({
    height: 800,
    items: {},
  })

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const isProductVisible = useCallback(
    (product: Product) => {
      const matchesCategory =
        !activeFilter ||
        activeFilter === 'all' ||
        product.category === activeFilter ||
        (Array.isArray(product.tags) && product.tags.includes(activeFilter))

      if (!matchesCategory) return false

      if (!normalizedQuery) return true

      const haystack = [
        product.title,
        product.brand,
        product.category,
        product.subcategory,
        product.description,
        product.material,
        ...(product.tags || []),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    },
    [activeFilter, normalizedQuery],
  )

  const computeShuffleLayout = useCallback(() => {
    const gridEl = gridRef.current
    if (!gridEl) return

    const containerWidth = gridEl.clientWidth
    if (!containerWidth) return

    const vw = typeof window !== 'undefined' ? window.innerWidth : containerWidth
    let numCols = 5
    if (vw <= 400) {
      numCols = 1
    } else if (vw <= 800) {
      numCols = 2
    } else if (vw <= 1040) {
      numCols = 3
    }

    const colWidth = containerWidth / numCols
    const colHeights = new Array<number>(numCols).fill(24)
    const nextItems: Record<string, ItemPosition> = {}

    products.forEach((product) => {
      const el = itemRefs.current[product.id]
      const visible = isProductVisible(product)
      const span = numCols === 5 && product.size === 'large' ? 2 : 1
      const itemWidth = colWidth * span
      const itemHeight = el ? el.offsetHeight || 380 : 380

      if (!visible) {
        const prev = layout.items[product.id]
        nextItems[product.id] = {
          visible: false,
          x: prev ? prev.x : 0,
          y: prev ? prev.y : 0,
          width: itemWidth,
        }
        return
      }

      let bestCol = 0
      let minMaxY = Infinity
      for (let c = 0; c <= numCols - span; c++) {
        let regionMaxY = 0
        for (let s = 0; s < span; s++) {
          regionMaxY = Math.max(regionMaxY, colHeights[c + s])
        }
        if (regionMaxY < minMaxY) {
          minMaxY = regionMaxY
          bestCol = c
        }
      }

      const x = Math.round(bestCol * colWidth)
      const y = Math.round(minMaxY)

      for (let s = 0; s < span; s++) {
        colHeights[bestCol + s] = y + itemHeight
      }

      nextItems[product.id] = {
        visible: true,
        x,
        y,
        width: itemWidth,
      }
    })

    const maxHeight = Math.max(320, ...colHeights) + 120
    setLayout({ height: maxHeight, items: nextItems })
  }, [products, isProductVisible])

  useEffect(() => {
    setIsLoaded(true)
    const timer = setTimeout(() => {
      computeShuffleLayout()
    }, 60)
    return () => clearTimeout(timer)
  }, [computeShuffleLayout])

  useEffect(() => {
    const gridEl = gridRef.current
    if (!gridEl) return

    const handleResize = () => {
      computeShuffleLayout()
    }

    window.addEventListener('resize', handleResize)
    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        computeShuffleLayout()
      })
      observer.observe(gridEl)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      if (observer) observer.disconnect()
    }
  }, [computeShuffleLayout])

  const anyVisible = products.some((p) => isProductVisible(p))

  return (
    <section
      ref={gridRef}
      className={cn('product-grid', !isLoaded && ' grid--loading')}
      style={{
        height: isLoaded ? `${layout.height}px` : undefined,
        transition: 'height 600ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className="grid__loader text-primary" aria-hidden="true">
        <Loader2 className="h-10 w-10 animate-spin mx-auto" />
      </div>
      <div className="grid__sizer"></div>

      {!anyVisible && isLoaded && (
        <div className="mx-auto my-12 max-w-md rounded-none border border-border bg-card p-8 text-center">
          <p className="text-base font-bold text-foreground">No matching clothing items found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try clearing your search term or selecting another category filter.
          </p>
        </div>
      )}

      {products.map((product, prodIdx) => {
        const isCompared = compareIds.includes(product.id)
        const wishlisted = isWishlisted(product.slug)
        const stockStatus = getProductLowestAvailableVariantStock(product)
        const itemLayout = layout.items[product.id]
        const visible = itemLayout ? itemLayout.visible : isProductVisible(product)

        const itemStyle: CSSProperties | undefined =
          isLoaded && itemLayout
            ? {
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${itemLayout.width}px`,
                transform: `translate3d(${itemLayout.x}px, ${
                  itemLayout.y
                }px, 0) scale(${visible ? 1 : 0.001})`,
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? 'auto' : 'none',
                visibility: visible ? 'visible' : 'hidden',
                transition:
                  'transform 600ms cubic-bezier(0.4, 0, 0.2, 1), opacity 600ms cubic-bezier(0.4, 0, 0.2, 1), visibility 600ms',
              }
            : undefined

        const isPriorityCard = prodIdx < 4

        return (
          <div
            key={product.id}
            ref={(el) => {
              itemRefs.current[product.id] = el
            }}
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
                onAfterInit={() => computeShuffleLayout()}
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
                          onLoad={() => computeShuffleLayout()}
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
                    <Star
                      className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                      aria-hidden="true"
                    />
                    {product.averageRating.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">({product.reviewCount})</span>
                </div>
              </div>
            </div>

            {/* Love / Wishlist toggle */}
            <Button
              type="button"
              className="absolute top-4 right-4 z-2 transition-opacity opacity-0 group-hover:opacity-100"
              data-active={wishlisted ? 'true' : 'false'}
              onClick={() => void toggleWishlist(product)}
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
                'transition-opacity opacity-0 group-hover:opacity-100',
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
      })}
    </section>
  )
}

export default Grid
