'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CartLineItem, Product } from '../data/utils'
import { useAuth } from './auth-context'
import {
  postAccountAction,
  storefrontQueryKeys,
  type AddToCartOptions,
  type CatalogResponse,
} from './query-keys'

const GUEST_CART_STORAGE_KEY = 'the_store_guest_cart_v1'

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
  const { user } = useAuth()
  const [cartItems, setCartItems] = useState<CartLineItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCartAnimating, setIsCartAnimating] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const { mutate: syncCartMutate } = useMutation({
    mutationFn: (params: { email: string; cartItems: CartLineItem[] }) =>
      postAccountAction({
        action: 'sync_cart',
        email: params.email,
        cartItems: params.cartItems,
      }),
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

  // Persist cart to localStorage when logged out, or sync to Payload when logged in
  useEffect(() => {
    if (!hydrated) return
    try {
      if (!user) {
        localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(cartItems))
      } else {
        localStorage.removeItem(GUEST_CART_STORAGE_KEY)
        syncCartMutate({
          email: user.email,
          cartItems,
        })
      }
    } catch {}
  }, [cartItems, user, hydrated, syncCartMutate])

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
      const defaultVariant =
        liveProd.variants.find((v) => Math.max(0, v.stock - v.reservedStock) > 0) ||
        liveProd.variants[0]

      const matchedVariant = options?.variantSku
        ? liveProd.variants.find((v) => v.sku === options.variantSku) || defaultVariant
        : options?.size || options?.color
          ? liveProd.variants.find(
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

      const sku = matchedVariant?.sku || `${liveProd.id.toUpperCase()}-STD-M`
      const selectedSize = options?.size || matchedVariant?.size || 'M'
      const selectedColor = options?.color || matchedVariant?.color || 'Signature'
      const selectedColorHex = options?.colorHex || matchedVariant?.colorHex || '#5C5EDC'
      const unitPrice = matchedVariant?.priceOverride ?? liveProd.price
      const qtyToAdd = Math.max(1, options?.quantity || 1)

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
            ...liveProd,
            cartItemId: sku,
            variantSku: sku,
            selectedSize,
            selectedColor,
            selectedColorHex,
            unitPrice,
            price: unitPrice,
            quantity: Math.min(available, qtyToAdd),
            maxAvailableStock: available,
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
        prev.filter((item) => item.cartItemId !== cartItemId && item.id !== cartItemId),
      )
      return
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId || item.id === cartItemId
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
      prev.filter((item) => item.cartItemId !== cartItemId && item.id !== cartItemId),
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
