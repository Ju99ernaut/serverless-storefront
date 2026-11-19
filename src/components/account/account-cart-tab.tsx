'use client'

import Link from 'next/link'
import { ShoppingBag, Trash2 } from 'lucide-react'
import type { CartLineItem } from '@/lib/utils/data'
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

export function AccountCartTab({ cartItems, onRemoveCartItem, onOpenCart }: AccountCartTabProps) {
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
                  className="flex items-center justify-between gap-3 rounded-none border border-border bg-secondary p-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <OptimizedImage
                      src={ci.imageUrl || '/images/shirt.png'}
                      alt={ci.title}
                      width={52}
                      height={52}
                      className="h-12 w-12 object-contain rounded-none bg-card p-1"
                    />
                    <div>
                      <Link
                        href={`/products/${ci.productSlug}`}
                        className="font-bold text-foreground hover:text-primary"
                      >
                        {ci.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {ci.selectedColor} / Size {ci.selectedSize} &bull; Qty {ci.quantity}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary">
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
