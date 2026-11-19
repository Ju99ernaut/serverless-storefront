'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { Product } from '../data/utils'
import { useAuth } from './auth-context'
import { postAccountAction } from './query-keys'

interface WishlistContextValue {
  wishlistSlugs: string[]
  isWishlisted: (productSlug: string) => boolean
  toggleWishlist: (product: Product) => Promise<void>
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth()
  const [guestWishlist, setGuestWishlist] = useState<string[]>([])

  const { mutateAsync: toggleWishlistMutateAsync } = useMutation({
    mutationFn: (params: { email: string; productSlug: string }) =>
      postAccountAction({
        action: 'toggle_wishlist',
        email: params.email,
        productSlug: params.productSlug,
      }),
    onSuccess: (res) => {
      setUser(res.user)
    },
  })

  const wishlistSlugs = useMemo(
    () => (user ? user.wishlistProductSlugs || [] : guestWishlist),
    [user, guestWishlist],
  )

  const isWishlisted = useCallback(
    (productSlug: string) => wishlistSlugs.includes(productSlug),
    [wishlistSlugs],
  )

  const toggleWishlist = useCallback(
    async (product: Product) => {
      if (!user) {
        setGuestWishlist((prev) =>
          prev.includes(product.slug)
            ? prev.filter((s) => s !== product.slug)
            : [...prev, product.slug],
        )
        return
      }

      await toggleWishlistMutateAsync({
        email: user.email,
        productSlug: product.slug,
      })
    },
    [user, toggleWishlistMutateAsync],
  )

  const value = useMemo(
    () => ({
      wishlistSlugs,
      isWishlisted,
      toggleWishlist,
    }),
    [wishlistSlugs, isWishlisted, toggleWishlist],
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) {
    throw new Error('useWishlist must be used within a WishlistProvider')
  }
  return ctx
}
