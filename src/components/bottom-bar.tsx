'use client'

import { forwardRef } from 'react'
import { ShoppingCart } from 'lucide-react'
import { BOTTOM_BAR_FILTERS, BottomBarFilter, getMainCategoryForFilter } from '../data/utils'
import { OptimizedImage } from './ui/optimized-image'
import { cn } from 'cn'

interface BottomBarProps {
  activeFilter: string
  onSelectFilter: (filter: string) => void
  cartCount: number
  isCartAnimating: boolean
  onOpenCart: () => void
}

function renderFilterIcon(icon: BottomBarFilter['icon']) {
  if (icon === 'all') return null

  return (
    <OptimizedImage
      src={`/images/${icon}.png`}
      alt={icon}
      width={20}
      height={20}
      className="w-6 h-6 w-auto object-contain"
    />
  )
}

const BottomBar = forwardRef<HTMLButtonElement, BottomBarProps>(
  ({ activeFilter, onSelectFilter, cartCount, isCartAnimating, onOpenCart }, cartBtnRef) => {
    const activeMainCategory = getMainCategoryForFilter(activeFilter)

    return (
      <div className="bar">
        <div className="filter" role="toolbar" aria-label="Product category filters">
          {BOTTOM_BAR_FILTERS.map((item) => {
            const isSelected =
              item.id === 'all'
                ? activeFilter === 'all'
                : activeFilter === item.id || activeMainCategory === item.id
            const iconNode = renderFilterIcon(item.icon)

            return (
              <button
                key={item.id}
                type="button"
                className={cn('action filter__item', isSelected && 'filter__item--selected')}
                data-filter={item.id}
                aria-pressed={isSelected}
                onClick={() => onSelectFilter(item.id)}
              >
                {iconNode}
                <span className={iconNode ? 'action__text' : undefined}>{item.label}</span>
              </button>
            )
          })}
        </div>
        <button
          ref={cartBtnRef}
          type="button"
          className={`cart${isCartAnimating ? ' cart--animate' : ''}`}
          onClick={onOpenCart}
          aria-label={`Shopping cart with ${cartCount} items`}
        >
          <ShoppingCart className="cart__icon h-5 w-5" aria-hidden="true" />
          <span className="text-hidden">Shopping cart</span>
          <span className="cart__count">{cartCount}</span>
        </button>
      </div>
    )
  },
)

BottomBar.displayName = 'BottomBar'

export default BottomBar
