'use client'

import Link from 'next/link'
import { ArrowLeft, ShoppingCart } from 'lucide-react'
import { useCart } from '@/context'
import { Button, buttonVariants } from './ui/button'
import Cart from './cart'
import UserMenu from './user-menu'

interface PageHeaderProps {
  title?: string
  subtitle?: string
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  const {
    cartItems,
    totalCartCount,
    isCartOpen,
    setIsCartOpen,
    updateCartQuantity,
    removeCartItem,
    clearCart,
  } = useCart()

  return (
    <>
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeCartItem}
        onClearCart={clearCart}
      />

      <header className="sticky-topbar-container border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-1.5' })}
              href="/"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Store</span>
            </Link>
            {title && (
              <span className="hidden sm:inline text-sm font-bold text-foreground">{title}</span>
            )}
            {subtitle && (
              <span className="hidden sm:inline text-xs text-muted-foreground">{subtitle}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <UserMenu />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCartOpen(true)}
              className="gap-1.5"
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              <span>Bag ({totalCartCount})</span>
            </Button>
          </div>
        </div>
      </header>
    </>
  )
}
