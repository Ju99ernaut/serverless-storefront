'use client'

import { Loader2, Lock } from 'lucide-react'
import { formatCentsAsDollars, type CartLineItem } from '../../lib/utils/data'
import { Alert } from '../ui/alert'
import { Button } from '../ui/button'
import { DrawerFooter, DrawerHeader, DrawerTitle } from '../ui/drawer'
import { Separator } from '../ui/separator'
import CartItem from './cart-item'

interface CartBagStepProps {
  items: CartLineItem[]
  totalItemCount: number
  subTotal: number
  tax: number
  isAuthenticated: boolean
  isSessionPending?: boolean
  onUpdateQuantity: (cartItemId: string, nextQty: number) => void
  onRemoveItem: (cartItemId: string) => void
  onClearCart: () => void
  onProceedToCheckout: () => void
}

export function CartBagStep({
  items,
  totalItemCount,
  subTotal,
  tax,
  isAuthenticated,
  isSessionPending = false,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
}: CartBagStepProps) {
  const estimatedTotal = formatCentsAsDollars(subTotal + tax)

  return (
    <>
      <DrawerHeader className="border-b border-border pb-3">
        <div className="flex items-center justify-between gap-2">
          <DrawerTitle className="text-lg font-bold">My Bag ({totalItemCount})</DrawerTitle>
          <Button type="button" variant="outline" size="sm" onClick={onClearCart}>
            Clear All
          </Button>
        </div>
      </DrawerHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        <ul className="m-0 list-none p-0">
          {items.map((item) => (
            <CartItem
              key={item.cartItemId || item.id}
              item={item}
              onUpdateQuantity={onUpdateQuantity}
              onRemove={onRemoveItem}
            />
          ))}
        </ul>
      </div>

      <DrawerFooter className="border-t border-border bg-popover pt-3">
        {!isAuthenticated && !isSessionPending && (
          <Alert>
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-xs">
              Sign in or create a free account at checkout to reserve stock.
            </span>
          </Alert>
        )}

        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCentsAsDollars(subTotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Taxes (8%)</span>
            <span>{formatCentsAsDollars(tax)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Delivery / Collection</span>
            <span className="font-bold text-primary">FREE</span>
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between pb-1 text-base font-bold">
            <span>Estimated Total</span>
            <span>{estimatedTotal}</span>
          </div>
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={isSessionPending}
          onClick={onProceedToCheckout}
        >
          {isSessionPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Checking session...</span>
            </>
          ) : isAuthenticated ? (
            `Proceed to Checkout (${estimatedTotal})`
          ) : (
            'Sign In / Register to Checkout'
          )}
        </Button>
      </DrawerFooter>
    </>
  )
}
