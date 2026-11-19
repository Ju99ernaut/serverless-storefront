'use client'

import {
  AlertTriangle,
  Check,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react'
import { cn } from 'cn'
import type { Product, ProductVariant } from '@/lib/utils/data'
import { Alert } from '../ui/alert'
import { Button } from '../ui/button'

interface ProductInfoPanelProps {
  product: Product
  uniqueColors: Array<{ color: string; colorHex: string }>
  uniqueSizes: string[]
  selectedColor: string
  selectedSize: string
  activeVariant?: ProductVariant
  availableStock: number
  isLowStock: boolean
  isOutOfStock: boolean
  quantity: number
  addedFeedback: boolean
  wishlisted: boolean
  onSelectColor: (color: string) => void
  onSelectSize: (size: string) => void
  onDecreaseQuantity: () => void
  onIncreaseQuantity: () => void
  onAddToCart: () => void
  onToggleWishlist: () => void
  onOpenCart: () => void
}

export function ProductInfoPanel({
  product,
  uniqueColors,
  uniqueSizes,
  selectedColor,
  selectedSize,
  activeVariant,
  availableStock,
  isLowStock,
  isOutOfStock,
  quantity,
  addedFeedback,
  wishlisted,
  onSelectColor,
  onSelectSize,
  onDecreaseQuantity,
  onIncreaseQuantity,
  onAddToCart,
  onToggleWishlist,
  onOpenCart,
}: ProductInfoPanelProps) {
  const displayPrice = activeVariant?.priceOverride ?? product.price

  return (
    <div className="lg:col-span-6 space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <span>{product.brand}</span>
          <span>&bull;</span>
          <span>{product.subcategory}</span>
        </div>

        <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold text-foreground">{product.title}</h1>

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
              {(product.averageRating ?? 0).toFixed(1)}
            </span>
            <span className="text-muted-foreground">({product.reviewCount ?? 0} reviews)</span>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
      </div>

      {/* Color Selection */}
      {uniqueColors.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-muted-foreground">Color</span>
            <span className="font-semibold text-foreground">{selectedColor}</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {uniqueColors.map((c) => {
              const isSelected = selectedColor === c.color
              return (
                <Button
                  key={c.color}
                  type="button"
                  onClick={() => onSelectColor(c.color)}
                  aria-pressed={isSelected}
                  variant="outline"
                  className={cn(isSelected && 'border-primary text-foreground ring-1 ring-primary')}
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
            <span className="font-bold uppercase tracking-wider text-muted-foreground">Size</span>
            <span className="text-muted-foreground">
              SKU: <code>{activeVariant?.sku || 'N/A'}</code>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {uniqueSizes.map((sz) => {
              const isSelected = selectedSize === sz
              return (
                <Button
                  key={sz}
                  type="button"
                  onClick={() => onSelectSize(sz)}
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
              All units are currently allocated or sold out. Choose another color or size variant.
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
            {availableStock} units available in {activeVariant?.color} ({activeVariant?.size}).
          </span>
        </div>
      )}

      {/* Quantity + Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-4">
        <div className="inline-flex items-center rounded-md border border-border bg-card">
          <Button
            type="button"
            onClick={onDecreaseQuantity}
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
            onClick={onIncreaseQuantity}
            disabled={isOutOfStock || quantity >= availableStock}
            aria-label="Increase quantity"
            variant="ghost"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <Button
          type="button"
          onClick={onAddToCart}
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
                {isOutOfStock ? (
                  'Out of Stock'
                ) : (
                  <>
                    <span>Add</span>
                    <span className="hidden md:inline">{' to Bag'}</span>
                    <span>{`: $${(displayPrice * quantity).toFixed(2)}`}</span>
                  </>
                )}
              </span>
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onToggleWishlist}
          aria-label={wishlisted ? 'Remove from loved items' : 'Love item'}
          className="gap-1.5"
        >
          <Heart
            className={cn('h-4 w-4', wishlisted && 'fill-rose-500 text-rose-500')}
            aria-hidden="true"
          />
        </Button>
      </div>

      {addedFeedback && (
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 text-xs">
          <span>Variant added to your shopping bag.</span>
          <Button type="button" className="text-xs" onClick={onOpenCart} variant="link">
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
          <span className="mt-1 block text-xs font-semibold text-foreground">{product.fit}</span>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Garment Care
          </span>
          <span className="mt-1 block text-xs font-semibold text-foreground">{product.care}</span>
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
  )
}
