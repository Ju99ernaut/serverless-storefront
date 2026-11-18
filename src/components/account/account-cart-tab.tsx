'use client'

import Link from 'next/link'
import { ShoppingBag, Trash2 } from 'lucide-react'
import type { CartLineItem } from '@/data/utils'
import { Button, buttonVariants } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../ui/empty'
import { OptimizedImage } from '../ui/optimized-image'

interface AccountCartTabProps {
  cartItems: CartLineItem[]
  onRemoveCartItem: (cartItemId: string) => void
  onOpenCart: () => void
}

export function AccountCartTab({
  cartItems,
  onRemoveCartItem,
  onOpenCart,
}: AccountCartTabProps) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {cartItems.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShoppingBag aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Your saved shopping bag is currently empty</EmptyTitle>
              <EmptyDescription>
                Add clothing items from the storefront to reserve stock and check out.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link className={buttonVariants({ size: 'sm' })} href="/">
                Browse Clothing Grid
              </Link>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="space-y-3">
              {cartItems.map((ci) => (
                <div
                  key={ci.cartItemId}
                  className="flex items-center justify-between gap-3 rounded-none border border-[var(--border-color)] bg-[var(--surface-elevated)] p-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <OptimizedImage
                      src={ci.images[0] || '/images/shirt.png'}
                      alt={ci.title}
                      width={52}
                      height={52}
                      className="h-12 w-12 object-contain rounded-none bg-[var(--surface-card)] p-1"
                    />
                    <div>
                      <Link
                        href={`/products/${ci.slug}`}
                        className="font-bold text-[var(--fg-heading)] hover:text-[#5C5EDC]"
                      >
                        {ci.title}
                      </Link>
                      <div className="text-xs text-[var(--fg-muted)]">
                        {ci.selectedColor} / Size {ci.selectedSize} &bull; Qty {ci.quantity}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#797BED]">
                      ${(ci.price * ci.quantity).toFixed(2)}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${ci.title}`}
                      onClick={() => onRemoveCartItem(ci.cartItemId)}
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button type="button" onClick={onOpenCart}>
                Open Checkout Drawer
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
