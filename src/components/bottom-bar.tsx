'use client'

import { forwardRef, useEffect, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import {
  BOTTOM_BAR_FILTERS,
  BottomBarFilter,
  getMainCategoryForFilter,
} from '../lib/utils/categories'
import Image from 'next/image'
import { cn } from 'cn'
import { Button } from './ui/button'
import { useTheme } from 'next-themes'

interface BottomBarProps {
  activeFilter: string
  onSelectFilter: (filter: string) => void
  cartCount: number
  isCartAnimating: boolean
  onOpenCart: () => void
}

function renderFilterIcon(icon: BottomBarFilter['icon']) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme !== 'light' : true

  if (icon === 'all') return null

  return (
    <Image
      src={`/images/${icon}.png`}
      alt={icon}
      width={20}
      height={20}
      className={cn('w-6 h-6 w-auto object-contain', !isDark && 'invert')}
    />
  )
}

const BottomBar = forwardRef<HTMLButtonElement, BottomBarProps>(
  ({ activeFilter, onSelectFilter, cartCount, onOpenCart }, cartBtnRef) => {
    const activeMainCategory = getMainCategoryForFilter(activeFilter)

    return (
      <div className="fixed z-50 bottom-0 left-0 w-full text-left sm:text-center bg-background border-t border-border py-3 px-0 sm:px-3">
        <div
          className="flex items-center justify-center gap-0 sm:gap-2 w-[85%] sm:w-full"
          role="toolbar"
          aria-label="Product category filters"
        >
          {BOTTOM_BAR_FILTERS.map((item) => {
            const isSelected =
              item.id === 'all'
                ? activeFilter === 'all'
                : activeFilter === item.id || activeMainCategory === item.id
            const iconNode = renderFilterIcon(item.icon)

            return (
              <Button
                key={item.id}
                type="button"
                data-filter={item.id}
                aria-pressed={isSelected}
                onClick={() => onSelectFilter(item.id)}
                size="lg"
                variant={isSelected ? 'secondary' : 'ghost'}
              >
                {iconNode}
                <span className={cn(iconNode && 'hidden sm:inline')}>{item.label}</span>
              </Button>
            )
          })}
        </div>
        <Button
          ref={cartBtnRef}
          type="button"
          className="absolute top-0 right-0 overflow-hidden h-full sm:px-5 px-4 rounded-none"
          onClick={onOpenCart}
          aria-label={`Shopping cart with ${cartCount} items`}
          variant="secondary"
        >
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          <span className="text-hidden">Shopping cart</span>
          <span className="text-[9px] font-bold absolute top-[20%] left-[10px] h-[18px] w-[18px] py-1 bg-primary text-white rounded-full">
            {cartCount}
          </span>
        </Button>
      </div>
    )
  },
)

BottomBar.displayName = 'BottomBar'

export default BottomBar
