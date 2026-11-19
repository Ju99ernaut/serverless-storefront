'use client'

import { Check, X } from 'lucide-react'
import { OptimizedImage } from './ui/optimized-image'
import { getProductImages, type Product } from '../lib/utils/data'
import { cn } from 'cn'
import { Button } from './ui/button'

interface CompareBasketProps {
  compareItems: Product[]
  isCompareOpen: boolean
  onRemoveCompare: (productId: Product['id']) => void
  onOpenCompare: () => void
}

const CompareBasket = ({
  compareItems,
  isCompareOpen,
  onRemoveCompare,
  onOpenCompare,
}: CompareBasketProps) => {
  const isActive = compareItems.length > 0 && !isCompareOpen
  const canCompare = compareItems.length >= 2

  return (
    <div
      className={cn('compare-basket', isActive && 'compare-basket--active')}
      aria-label="Product comparison basket"
    >
      {compareItems.map((product) => (
        <div
          key={product.id}
          className="relative bg-secondary w-10 h-10 p-2 rounded-md"
          data-idx={product.id}
        >
          <OptimizedImage
            src={getProductImages(product)[0]}
            alt={product.title}
            width={40}
            height={40}
            className="h-full w-full object-contain"
          />
          <Button
            type="button"
            className="absolute -top-2 -right-2 z-10"
            onClick={() => onRemoveCompare(product.id)}
            aria-label={`Remove ${product.title} from comparison`}
            variant="destructive"
            size="icon-xs"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">Remove product</span>
          </Button>
        </div>
      ))}
      <Button
        type="button"
        onClick={() => {
          if (canCompare) {
            onOpenCompare()
          }
        }}
        disabled={!canCompare}
      >
        <Check className="h-4 w-4" aria-hidden="true" />
        Compare{compareItems.length > 0 ? ` (${compareItems.length})` : ''}
      </Button>
    </div>
  )
}

export default CompareBasket
