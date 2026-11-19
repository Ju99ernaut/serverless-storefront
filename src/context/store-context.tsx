'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from './auth-context'
import { CartProvider } from './cart-context'
import { WishlistProvider } from './wishlist-context'

export function StoreProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>{children}</WishlistProvider>
      </CartProvider>
    </AuthProvider>
  )
}

export { AuthProvider, useAuth } from './auth-context'
export { CartProvider, useCart } from './cart-context'
export { WishlistProvider, useWishlist } from './wishlist-context'
export {
  CACHE_TIMES,
  fetchCatalogData,
  postAccountAction,
  storefrontQueryKeys,
  type AccountActionPayload,
  type AccountActionResponse,
  type AddToCartOptions,
  type AuthModalIntent,
  type CatalogResponse,
  type OrdersResponse,
  type ProductDetailResponse,
} from './query-keys'
