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
import type { Product, Wishlist } from '@/payload-types'
import {
  getWishlistByNeonUserId,
  syncWishlistWithPayload,
  toggleWishlistItemInPayload,
} from '../lib/payload-sdk'
import { CACHE_TIMES, storefrontQueryKeys } from './query-keys'
import { neonAuthClient } from '@/lib/auth-client'
import { toast } from '../components/ui/toast'

interface WishlistContextValue {
  wishlistSlugs: string[]
  isWishlisted: (productSlug: string) => boolean
  toggleWishlist: (product: Product) => Promise<void>
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data: sessionData } = neonAuthClient.useSession()
  const user = sessionData?.user
  const [guestWishlist, setGuestWishlist] = useState<string[]>([])
  const mergedGuestForUserRef = useRef<string | null>(null)

  const { data: payloadWishlist, isFetched: isWishlistFetched } = useQuery({
    queryKey: storefrontQueryKeys.wishlist(user?.id),
    queryFn: () => getWishlistByNeonUserId(user!.id),
    enabled: Boolean(user?.id),
    ...CACHE_TIMES.userState,
  })

  const { mutateAsync: syncWishlistMutateAsync } = useMutation({
    mutationFn: (params: { neonUserId: string; items: NonNullable<Wishlist['items']> }) => {
      return syncWishlistWithPayload(params.neonUserId, params.items)
    },
    onSuccess: (updatedWishlist, variables) => {
      queryClient.setQueryData(storefrontQueryKeys.wishlist(variables.neonUserId), updatedWishlist)
    },
  })

  const { mutateAsync: toggleWishlistMutateAsync } = useMutation({
    mutationKey: ['wishlist', 'toggle'],
    mutationFn: (params: { neonUserId: string; product: Pick<Product, 'id' | 'slug'> }) => {
      return toggleWishlistItemInPayload(params.neonUserId, params.product)
    },
    onMutate: async (variables) => {
      const queryKey = storefrontQueryKeys.wishlist(variables.neonUserId)
      await queryClient.cancelQueries({ queryKey })

      const previousWishlist = queryClient.getQueryData<Wishlist | null>(queryKey)

      queryClient.setQueryData<Wishlist | null>(queryKey, (current) => {
        const existingItems = current?.items ?? []
        const alreadyExists = existingItems.some(
          (item) => item.productSlug === variables.product.slug,
        )
        const nextItems = alreadyExists
          ? existingItems.filter((item) => item.productSlug !== variables.product.slug)
          : [
              ...existingItems,
              {
                product: variables.product.id,
                productSlug: variables.product.slug,
              },
            ]

        if (current) {
          return {
            ...current,
            items: nextItems,
          }
        }

        const now = new Date().toISOString()
        return {
          id: -1,
          neonUserId: variables.neonUserId,
          items: nextItems,
          createdAt: now,
          updatedAt: now,
        }
      })

      return { previousWishlist, queryKey }
    },
    onError: (_error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previousWishlist)
      }
      toast.add({
        type: 'error',
        description: 'Could not update your loved items. Please try again.',
      })
    },
    onSuccess: (updatedWishlist, variables) => {
      if (queryClient.isMutating({ mutationKey: ['wishlist', 'toggle'] }) <= 1) {
        queryClient.setQueryData(
          storefrontQueryKeys.wishlist(variables.neonUserId),
          updatedWishlist,
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      if (queryClient.isMutating({ mutationKey: ['wishlist', 'toggle'] }) <= 1) {
        void queryClient.invalidateQueries({
          queryKey: storefrontQueryKeys.wishlist(variables.neonUserId),
        })
      }
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

      try {
        await toggleWishlistMutateAsync({
          neonUserId: user.id,
          product: {
            id: product.id,
            slug: product.slug,
          },
        })
      } catch {
        // Handled by mutation onError rollback + toast
      }
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
