'use client'

import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from 'cn'
import { CACHE_TIMES, storefrontQueryKeys, useWishlist } from '../../context'
import type { Product } from '@/payload-types'
import { GridSkeleton } from './grid-skeleton'
import { GridEmptyState } from './grid-empty-state'
import { GridProductCard } from './grid-product-card'
import { getCatalogData } from '@/lib/payload-sdk'

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
  compareIds: Array<Product['id']>
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
  const { isWishlisted, toggleWishlist } = useWishlist()
  const { isLoading: isCatalogLoading } = useQuery({
    queryKey: storefrontQueryKeys.catalog,
    queryFn: getCatalogData,
    ...CACHE_TIMES.catalog,
  })
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
        Boolean(product.tags?.some((t) => t.tag === activeFilter))

      if (!matchesCategory) return false

      if (!normalizedQuery) return true

      const haystack = [
        product.title,
        product.brand,
        product.category,
        product.subcategory,
        product.description,
        product.material,
        ...(product.tags?.map((t) => t.tag) || []),
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
  const showSkeleton = !isLoaded || (isCatalogLoading && products.length === 0)

  return (
    <section
      ref={gridRef}
      className={cn('product-grid', showSkeleton && 'grid--loading')}
      aria-busy={showSkeleton}
      style={{
        height: isLoaded && !showSkeleton && anyVisible ? `${layout.height}px` : undefined,
        transition: 'height 600ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {showSkeleton && <GridSkeleton />}
      <div className="grid__sizer"></div>

      {isLoaded && !isCatalogLoading && !anyVisible && <GridEmptyState />}

      {products.map((product, prodIdx) => {
        const isCompared = compareIds.includes(product.id)
        const wishlisted = isWishlisted(product.slug)
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

        return (
          <GridProductCard
            key={product.id}
            product={product}
            isPriorityCard={prodIdx < 4}
            visible={visible}
            itemStyle={itemStyle}
            isCompared={isCompared}
            wishlisted={wishlisted}
            maxCompareReached={maxCompareReached}
            itemRef={(el) => {
              itemRefs.current[product.id] = el
            }}
            onLayoutChange={computeShuffleLayout}
            onToggleCompare={onToggleCompare}
            onToggleWishlist={(item) => void toggleWishlist(item)}
          />
        )
      })}
    </section>
  )
}

export default Grid
