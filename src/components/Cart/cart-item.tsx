'use client'

import type { ChangeEvent } from 'react'
import Link from 'next/link'
import { AlertTriangle, Minus, Plus, Trash2 } from 'lucide-react'
import { OptimizedImage } from '../ui/optimized-image'
import { formatCentsAsDollars, type CartLineItem } from '../../lib/utils/data'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

interface CartItemProps {
  item: CartLineItem
  onUpdateQuantity: (cartItemId: string, nextQty: number) => void
  onRemove: (cartItemId: string) => void
}

const CartItem = ({ item, onUpdateQuantity, onRemove }: CartItemProps) => {
  const {
    cartItemId,
    productSlug,
    title,
    brand,
    selectedSize,
    selectedColor,
    selectedColorHex,
    price,
    quantity,
    imageUrl,
    maxAvailableStock = 99,
  } = item

  const itemKey = cartItemId || item.variantSku || productSlug
  const displayImage = imageUrl || '/images/shirt.png'
  const isLowStock = maxAvailableStock > 0 && maxAvailableStock <= 5

  const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    if (!Number.isNaN(val)) {
      onUpdateQuantity(itemKey, Math.min(maxAvailableStock, Math.max(1, val)))
    }
  }

  return (
    <li className="flex gap-2 py-1 border-b border-border">
      <div className="w-24 h-24 rounded-md border border-border bg-secondary relative overflow-hidden flex items-center justify-center">
        <OptimizedImage
          className="w-[85%] h-[85%] object-contain"
          width={96}
          height={96}
          src={displayImage}
          alt={title}
        />
      </div>
      <div className="flex flex-1 justify-between">
        <div className="flex flex-col">
          <Link
            href={`/products/${productSlug}`}
            className="font-bold hover:text-primary transition-colors"
          >
            {title}
          </Link>
          <span className="text-xs text-muted-foreground">{brand}</span>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-1.5 py-0.5 font-medium text-primary">
              {selectedColorHex && (
                <span
                  className="h-2 w-2 rounded-md border border-border"
                  style={{ backgroundColor: selectedColorHex }}
                  aria-hidden="true"
                />
              )}
              <span>{selectedColor || 'Default'}</span>
            </span>
            <span className="rounded-md border border-border bg-secondary px-1.5 py-0.5 font-semibold text-foreground">
              Size: {selectedSize || 'M'}
            </span>
          </div>

          {isLowStock && (
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-500">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              <span>Only {maxAvailableStock} in stock</span>
            </div>
          )}

          <div className="flex gap-1 items-center mt-1">
            <Button
              variant="outline"
              type="button"
              size="icon-sm"
              aria-label={`Decrease quantity of ${title}`}
              onClick={() => onUpdateQuantity(itemKey, quantity - 1)}
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <label>
              <span className="text-hidden">Quantity for {title}</span>
              <Input
                type="number"
                max={maxAvailableStock}
                min={1}
                value={quantity}
                className="min-w-10 h-7"
                onChange={handleQuantityChange}
              />
            </label>
            <Button
              variant="outline"
              size="icon-sm"
              type="button"
              disabled={quantity >= maxAvailableStock}
              aria-label={`Increase quantity of ${title}`}
              title={
                quantity >= maxAvailableStock
                  ? `Maximum available stock (${maxAvailableStock}) reached`
                  : 'Increase quantity'
              }
              onClick={() => onUpdateQuantity(itemKey, Math.min(maxAvailableStock, quantity + 1))}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="flex flex-col justify-between items-end font-bold">
          <span>{formatCentsAsDollars(price * quantity)}</span>
          <Button
            type="button"
            variant="destructive"
            onClick={() => onRemove(itemKey)}
            aria-label={`Remove ${title} from cart`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  )
}

export default CartItem
