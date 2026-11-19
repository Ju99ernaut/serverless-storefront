'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Product, Wishlist } from '../lib/utils/data'
import {
  getWishlistByNeonUserId,
  syncWishlistWithPayload,
  toggleWishlistItemInPayload,
} from '../lib/payload-sdk'
import { useAuth } from './auth-context'
import { CACHE_TIMES, storefrontQueryKeys } from './query-keys'

interface WishlistContextValue {
  wishlistSlugs: string[]
  isWishlisted: (productSlug: string) => boolean
  toggleWishlist: (product: Product) => Promise<void>
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [guestWishlist, setGuestWishlist] = useState<string[]>([])
  const mergedGuestForUserRef = useRef<string | null>(null)

  const { data: payloadWishlist, isFetched: isWishlistFetched } = useQuery({
    queryKey: storefrontQueryKeys.wishlist(user?.id),
    queryFn: () => getWishlistByNeonUserId(user!.id),
    enabled: Boolean(user?.id),
    ...CACHE_TIMES.userState,
  })

  const { mutateAsync: syncWishlistMutateAsync } = useMutation({
    mutationFn: (params: { neonUserId: string; items: NonNullable<Wishlist['items']> }) =>
      syncWishlistWithPayload(params.neonUserId, params.items),
    onSuccess: (updatedWishlist, variables) => {
      queryClient.setQueryData(storefrontQueryKeys.wishlist(variables.neonUserId), updatedWishlist)
    },
  })

  const { mutateAsync: toggleWishlistMutateAsync } = useMutation({
    mutationFn: (params: { neonUserId: string; product: Pick<Product, 'id' | 'slug'> }) =>
      toggleWishlistItemInPayload(params.neonUserId, params.product),
    onSuccess: (updatedWishlist, variables) => {
      queryClient.setQueryData(storefrontQueryKeys.wishlist(variables.neonUserId), updatedWishlist)
    },
  })

  // Merge guest wishlist items into Payload when signed in
  useEffect(() => {
    if (!user?.id || !isWishlistFetched) return
    if (mergedGuestForUserRef.current === user.id) return
    mergedGuestForUserRef.current = user.id

    if (guestWishlist.length === 0) return

    const existingItems = payloadWishlist?.items ?? []
    const existingSlugs = new Set(existingItems.map((i) => i.productSlug))
    const newItems = guestWishlist
      .filter((slug) => !existingSlugs.has(slug))
      .map((productSlug) => ({ productSlug }))

    if (newItems.length > 0) {
      void syncWishlistMutateAsync({
        neonUserId: user.id,
        items: [...existingItems, ...newItems],
      })
    }
    setGuestWishlist([])
  }, [user?.id, isWishlistFetched, payloadWishlist, guestWishlist, syncWishlistMutateAsync])

  useEffect(() => {
    if (!user?.id) {
      mergedGuestForUserRef.current = null
    }
  }, [user?.id])

  const wishlistSlugs = useMemo(
    () => (user ? (payloadWishlist?.items ?? []).map((item) => item.productSlug) : guestWishlist),
    [user, payloadWishlist, guestWishlist],
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
        neonUserId: user.id,
        product: {
          id: product.id,
          slug: product.slug,
        },
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
