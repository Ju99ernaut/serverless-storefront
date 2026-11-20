'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getProductImages, type CartLineItem, type Product } from '../lib/utils/data'
import { getCartByNeonUserId, syncCartWithPayload } from '../lib/payload-sdk'
import {
  CACHE_TIMES,
  storefrontQueryKeys,
  type AddToCartOptions,
  type CatalogResponse,
} from './query-keys'
import { neonAuthClient } from '@/lib/auth-client'

const GUEST_CART_STORAGE_KEY = 'the_store_guest_cart_v1'

function mergeCartItems(existing: CartLineItem[], incoming: CartLineItem[]): CartLineItem[] {
  const map = new Map<string, CartLineItem>()
  for (const item of existing) {
    const key = item.variantSku || item.cartItemId || item.productSlug
    map.set(key, { ...item })
  }
  for (const item of incoming) {
    const key = item.variantSku || item.cartItemId || item.productSlug
    const prev = map.get(key)
    if (prev) {
      map.set(key, {
        ...prev,
        quantity: Math.min(item.maxAvailableStock || 99, prev.quantity + item.quantity),
      })
    } else {
      map.set(key, { ...item })
    }
  }
  return Array.from(map.values())
}

interface CartContextValue {
  cartItems: CartLineItem[]
  setCartItems: Dispatch<SetStateAction<CartLineItem[]>>
  totalCartCount: number
  isCartOpen: boolean
  setIsCartOpen: (open: boolean) => void
  isCartAnimating: boolean
  addToCart: (product: Product, options?: AddToCartOptions) => void
  updateCartQuantity: (cartItemId: string, nextQty: number) => void
  removeCartItem: (cartItemId: string) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data: sessionData } = neonAuthClient.useSession()
  const user = sessionData?.user
  const [cartItems, setCartItems] = useState<CartLineItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCartAnimating, setIsCartAnimating] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const syncedUserIdRef = useRef<string | null>(null)
  const prevUserIdRef = useRef<string | null>(null)

  const { data: payloadCart, isFetched: isPayloadCartFetched } = useQuery({
    queryKey: storefrontQueryKeys.cart(user?.id),
    queryFn: () => getCartByNeonUserId(user!.id),
    enabled: Boolean(user?.id),
    ...CACHE_TIMES.userState,
  })

  const { mutate: syncCartMutate } = useMutation({
    mutationFn: (params: { neonUserId: string; items: CartLineItem[] }) => {
      return syncCartWithPayload(params.neonUserId, params.items)
    },
    onSuccess: (updatedCart, variables) => {
      queryClient.setQueryData(storefrontQueryKeys.cart(variables.neonUserId), updatedCart)
    },
  })

  // Hydrate guest cart on mount
  useEffect(() => {
    try {
      const rawCart = localStorage.getItem(GUEST_CART_STORAGE_KEY)
      if (rawCart) {
        const parsed = JSON.parse(rawCart)
        if (Array.isArray(parsed)) {
          setCartItems(parsed)
        }
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Handle user sign-out reset
  useEffect(() => {
    const prevUserId = prevUserIdRef.current
    const currentUserId = user?.id ?? null
    if (prevUserId && !currentUserId) {
      syncedUserIdRef.current = null
      setCartItems([])
      try {
        localStorage.removeItem(GUEST_CART_STORAGE_KEY)
      } catch {}
    }
    prevUserIdRef.current = currentUserId
  }, [user?.id])

  // Merge guest cart with Payload Carts collection when user signs in and query settles
  useEffect(() => {
    if (!hydrated || !user?.id || !isPayloadCartFetched) return
    if (syncedUserIdRef.current === user.id) return

    syncedUserIdRef.current = user.id
    const remoteItems = payloadCart?.items ?? []

    let guestItems: CartLineItem[] = []
    try {
      const rawGuest = localStorage.getItem(GUEST_CART_STORAGE_KEY)
      if (rawGuest) {
        const parsed = JSON.parse(rawGuest)
        if (Array.isArray(parsed)) {
          guestItems = parsed
        }
      }
      localStorage.removeItem(GUEST_CART_STORAGE_KEY)
    } catch {}

    if (guestItems.length > 0) {
      const merged = mergeCartItems(remoteItems, guestItems)
      setCartItems(merged)
      syncCartMutate({ neonUserId: user.id, items: merged })
    } else {
      setCartItems(remoteItems)
    }
  }, [hydrated, user?.id, isPayloadCartFetched, payloadCart, syncCartMutate])

  // Persist guest cart to localStorage, or sync signed-in cart to Payload
  useEffect(() => {
    if (!hydrated) return
    try {
      if (!user?.id) {
        localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(cartItems))
      } else if (syncedUserIdRef.current === user.id) {
        syncCartMutate({
          neonUserId: user.id,
          items: cartItems,
        })
      }
    } catch {}
  }, [cartItems, user?.id, hydrated, syncCartMutate])

  const totalCartCount = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.quantity, 0),
    [cartItems],
  )

  const addToCart = useCallback(
    (product: Product, options?: AddToCartOptions) => {
      const cachedProducts =
        queryClient.getQueryData<CatalogResponse>(storefrontQueryKeys.catalog)?.products ?? []
      const liveProd =
        cachedProducts.find((p) => p.id === product.id || p.slug === product.slug) || product
      const variants = liveProd.variants ?? []
      const defaultVariant =
        variants.find((v) => Math.max(0, v.stock - v.reservedStock) > 0) || variants[0]

      const matchedVariant = options?.variantSku
        ? variants.find((v) => v.sku === options.variantSku) || defaultVariant
        : options?.size || options?.color
          ? variants.find(
              (v) =>
                (!options.size || v.size === options.size) &&
                (!options.color || v.color === options.color),
            ) || defaultVariant
          : defaultVariant

      const available = matchedVariant
        ? Math.max(0, matchedVariant.stock - matchedVariant.reservedStock)
        : 10

      if (available <= 0) {
        return
      }

      const sku = matchedVariant?.sku || `${String(liveProd.id).toUpperCase()}-STD-M`
      const selectedSize = options?.size || matchedVariant?.size || 'M'
      const selectedColor = options?.color || matchedVariant?.color || 'Signature'
      const selectedColorHex = options?.colorHex || matchedVariant?.colorHex || '#5C5EDC'
      const unitPrice = matchedVariant?.priceOverride ?? liveProd.price
      const qtyToAdd = Math.max(1, options?.quantity || 1)
      const primaryImage = matchedVariant?.imageUrl || getProductImages(liveProd)[0]

      setIsCartAnimating(true)
      setCartItems((prev) => {
        const existing = prev.find((item) => item.cartItemId === sku)
        if (existing) {
          return prev.map((item) =>
            item.cartItemId === sku
              ? {
                  ...item,
                  quantity: Math.min(available, item.quantity + qtyToAdd),
                  maxAvailableStock: available,
                }
              : item,
          )
        }
        return [
          ...prev,
          {
            product: liveProd.id,
            productSlug: liveProd.slug,
            cartItemId: sku,
            variantSku: sku,
            title: liveProd.title,
            brand: liveProd.brand,
            category: liveProd.category,
            subcategory: liveProd.subcategory,
            selectedSize,
            selectedColor,
            selectedColorHex,
            unitPrice,
            price: unitPrice,
            quantity: Math.min(available, qtyToAdd),
            maxAvailableStock: available,
            imageUrl: primaryImage,
          },
        ]
      })

      setTimeout(() => {
        setIsCartAnimating(false)
      }, 450)
    },
    [queryClient],
  )

  const updateCartQuantity = useCallback((cartItemId: string, nextQty: number) => {
    if (nextQty <= 0) {
      setCartItems((prev) =>
        prev.filter(
          (item) =>
            item.cartItemId !== cartItemId &&
            item.variantSku !== cartItemId &&
            item.productSlug !== cartItemId,
        ),
      )
      return
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId ||
        item.variantSku === cartItemId ||
        item.productSlug === cartItemId
          ? {
              ...item,
              quantity: Math.min(item.maxAvailableStock || 99, nextQty),
            }
          : item,
      ),
    )
  }, [])

  const removeCartItem = useCallback((cartItemId: string) => {
    setCartItems((prev) =>
      prev.filter(
        (item) =>
          item.cartItemId !== cartItemId &&
          item.variantSku !== cartItemId &&
          item.productSlug !== cartItemId,
      ),
    )
  }, [])

  const clearCart = useCallback(() => {
    setCartItems([])
    try {
      localStorage.removeItem(GUEST_CART_STORAGE_KEY)
    } catch {}
  }, [])

  const value = useMemo(
    () => ({
      cartItems,
      setCartItems,
      totalCartCount,
      isCartOpen,
      setIsCartOpen,
      isCartAnimating,
      addToCart,
      updateCartQuantity,
      removeCartItem,
      clearCart,
    }),
    [
      cartItems,
      totalCartCount,
      isCartOpen,
      isCartAnimating,
      addToCart,
      updateCartQuantity,
      removeCartItem,
      clearCart,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return ctx
}
