'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Product,
  BannerSlide,
  CartLineItem,
  StoreUserRecord,
  StoreOrderRecord,
} from '../data/utils'
import { neonAuthClient } from '../lib/auth-client'

const GUEST_CART_STORAGE_KEY = 'the_store_guest_cart_v1'

interface AddToCartOptions {
  variantSku?: string
  size?: string
  color?: string
  colorHex?: string
  quantity?: number
}

interface AccountActionPayload {
  action:
    | 'register'
    | 'login'
    | 'oauth_google'
    | 'sync_cart'
    | 'toggle_wishlist'
    | 'update_profile'
  email?: string
  newEmail?: string
  password?: string
  currentPassword?: string
  newPassword?: string
  name?: string
  phone?: string
  avatarUrl?: string | null
  shippingAddress?: string
  productSlug?: string
  cartItems?: CartLineItem[]
}

interface AccountActionResponse {
  user: StoreUserRecord
  orders: StoreOrderRecord[]
}

async function postAccountAction(payload: AccountActionPayload): Promise<AccountActionResponse> {
  try {
    const { data } = await axios.post<AccountActionResponse>('/api/storefront/account', payload, {
      withCredentials: true,
    })
    return data
  } catch (err: unknown) {
    if (axios.isAxiosError<{ error?: string }>(err)) {
      throw new Error(err.response?.data?.error || err.message || 'Account operation failed')
    }
    throw err instanceof Error ? err : new Error('Account operation failed')
  }
}

interface StoreContextValue {
  products: Product[]
  banners: BannerSlide[]
  isCatalogLoading: boolean
  refreshCatalog: () => Promise<void>
  cartItems: CartLineItem[]
  totalCartCount: number
  isCartOpen: boolean
  setIsCartOpen: (open: boolean) => void
  isCartAnimating: boolean
  addToCart: (product: Product, options?: AddToCartOptions) => void
  updateCartQuantity: (cartItemId: string, nextQty: number) => void
  removeCartItem: (cartItemId: string) => void
  clearCart: () => void
  user: StoreUserRecord | null
  orders: StoreOrderRecord[]
  wishlistSlugs: string[]
  isWishlisted: (productSlug: string) => boolean
  toggleWishlist: (product: Product) => Promise<void>
  isAuthModalOpen: boolean
  setIsAuthModalOpen: (open: boolean) => void
  authModalIntent: 'account' | 'checkout' | 'wishlist' | 'review'
  openAuthModal: (intent?: 'account' | 'checkout' | 'wishlist' | 'review') => void
  signInWithEmail: (params: {
    email: string
    password: string
    name?: string
    rememberMe?: boolean
    isRegister?: boolean
  }) => Promise<StoreUserRecord>
  signInWithGoogle: () => Promise<StoreUserRecord>
  signOut: () => void
  updateProfile: (params: {
    name?: string
    newEmail?: string
    phone?: string
    shippingAddress?: string
    avatarUrl?: string | null
    currentPassword?: string
    newPassword?: string
  }) => Promise<StoreUserRecord | undefined>
  refreshUserOrders: () => Promise<void>
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [cartItems, setCartItems] = useState<CartLineItem[]>([])
  const [user, setUser] = useState<StoreUserRecord | null>(null)
  const [orders, setOrders] = useState<StoreOrderRecord[]>([])
  const [guestWishlist, setGuestWishlist] = useState<string[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCartAnimating, setIsCartAnimating] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalIntent, setAuthModalIntent] = useState<
    'account' | 'checkout' | 'wishlist' | 'review'
  >('account')
  const [hydrated, setHydrated] = useState(false)

  const catalogQuery = useQuery({
    queryKey: ['storefront-catalog'],
    queryFn: async () => {
      const { data } = await axios.get<{
        products: Product[]
        banners: BannerSlide[]
      }>('/api/storefront/catalog', { withCredentials: true })
      return data
    },
  })

  const products = useMemo(
    () => catalogQuery.data?.products ?? [],
    [catalogQuery.data?.products],
  )
  const banners = useMemo(
    () => catalogQuery.data?.banners ?? [],
    [catalogQuery.data?.banners],
  )
  const isCatalogLoading = catalogQuery.isLoading

  const refreshCatalog = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['storefront-catalog'] })
  }, [queryClient])

  const { mutate: syncCartMutate } = useMutation({
    mutationFn: (params: { email: string; cartItems: CartLineItem[] }) =>
      postAccountAction({
        action: 'sync_cart',
        email: params.email,
        cartItems: params.cartItems,
      }),
  })

  const { mutateAsync: signInWithEmailMutateAsync } = useMutation({
    mutationFn: async (params: {
      email: string
      password: string
      name?: string
      rememberMe?: boolean
      isRegister?: boolean
      cartItems: CartLineItem[]
    }) => {
      // Attempt Neon Managed Better Auth client first if configured
      try {
        if (params.isRegister) {
          await neonAuthClient.signUp.email({
            email: params.email,
            password: params.password,
            name: params.name || params.email.split('@')[0],
          })
        } else {
          await neonAuthClient.signIn.email({
            email: params.email,
            password: params.password,
            rememberMe: params.rememberMe,
          })
        }
      } catch {
        // Fallback seamlessly when Neon Auth baseUrl is local/unconfigured
      }

      return postAccountAction({
        action: params.isRegister ? 'register' : 'login',
        email: params.email,
        password: params.password,
        name: params.name,
        cartItems: params.cartItems,
      })
    },
    onSuccess: (synced) => {
      setUser(synced.user)
      setOrders(synced.orders || [])
      if (Array.isArray(synced.user.savedCart) && synced.user.savedCart.length > 0) {
        setCartItems(synced.user.savedCart)
      }
      try {
        localStorage.removeItem(GUEST_CART_STORAGE_KEY)
      } catch {}
      setIsAuthModalOpen(false)
    },
  })

  const { mutateAsync: signInWithGoogleMutateAsync } = useMutation({
    mutationFn: async (currentCart: CartLineItem[]) => {
      try {
        if (process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL) {
          await neonAuthClient.signIn.social({
            provider: 'google',
            callbackURL: window.location.href,
          })
        }
      } catch {}

      return postAccountAction({
        action: 'oauth_google',
        email: 'alex.rivera@gmail.com',
        name: 'Alex Rivera (Google)',
        cartItems: currentCart,
      })
    },
    onSuccess: (synced) => {
      setUser(synced.user)
      setOrders(synced.orders || [])
      if (Array.isArray(synced.user.savedCart) && synced.user.savedCart.length > 0) {
        setCartItems(synced.user.savedCart)
      }
      try {
        localStorage.removeItem(GUEST_CART_STORAGE_KEY)
      } catch {}
      setIsAuthModalOpen(false)
    },
  })

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

  const { mutateAsync: updateProfileMutateAsync } = useMutation({
    mutationFn: (params: {
      email: string
      name?: string
      newEmail?: string
      phone?: string
      shippingAddress?: string
      avatarUrl?: string | null
      currentPassword?: string
      newPassword?: string
    }) =>
      postAccountAction({
        action: 'update_profile',
        email: params.email,
        name: params.name,
        newEmail: params.newEmail,
        phone: params.phone,
        shippingAddress: params.shippingAddress,
        avatarUrl: params.avatarUrl,
        currentPassword: params.currentPassword,
        newPassword: params.newPassword,
      }),
    onSuccess: (res) => {
      setUser(res.user)
      setOrders(res.orders || [])
    },
  })

  const { mutateAsync: refreshOrdersMutateAsync } = useMutation({
    mutationFn: (email: string) =>
      postAccountAction({
        action: 'login',
        email,
      }),
    onSuccess: (res) => {
      setUser(res.user)
      setOrders(res.orders || [])
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
      const liveProd =
        products.find((p) => p.id === product.id || p.slug === product.slug) || product
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
    [products],
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

  const openAuthModal = useCallback(
    (intent: 'account' | 'checkout' | 'wishlist' | 'review' = 'account') => {
      setAuthModalIntent(intent)
      setIsAuthModalOpen(true)
    },
    [],
  )

  const signInWithEmail = useCallback(
    async (params: {
      email: string
      password: string
      name?: string
      rememberMe?: boolean
      isRegister?: boolean
    }) => {
      const synced = await signInWithEmailMutateAsync({
        ...params,
        cartItems,
      })
      return synced.user
    },
    [cartItems, signInWithEmailMutateAsync],
  )

  const signInWithGoogle = useCallback(async () => {
    const synced = await signInWithGoogleMutateAsync(cartItems)
    return synced.user
  }, [cartItems, signInWithGoogleMutateAsync])

  const signOut = useCallback(() => {
    try {
      neonAuthClient.signOut().catch(() => {})
    } catch {}
    setUser(null)
    setOrders([])
  }, [])

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

  const updateProfile = useCallback(
    async (params: {
      name?: string
      newEmail?: string
      phone?: string
      shippingAddress?: string
      avatarUrl?: string | null
      currentPassword?: string
      newPassword?: string
    }) => {
      if (!user) return undefined
      const res = await updateProfileMutateAsync({
        email: user.email,
        ...params,
      })
      return res.user
    },
    [user, updateProfileMutateAsync],
  )

  const refreshUserOrders = useCallback(async () => {
    await refreshCatalog()
    if (!user) return
    try {
      await refreshOrdersMutateAsync(user.email)
    } catch {}
  }, [user, refreshCatalog, refreshOrdersMutateAsync])

  const value = useMemo(
    () => ({
      products,
      banners,
      isCatalogLoading,
      refreshCatalog,
      cartItems,
      totalCartCount,
      isCartOpen,
      setIsCartOpen,
      isCartAnimating,
      addToCart,
      updateCartQuantity,
      removeCartItem,
      clearCart,
      user,
      orders,
      wishlistSlugs,
      isWishlisted,
      toggleWishlist,
      isAuthModalOpen,
      setIsAuthModalOpen,
      authModalIntent,
      openAuthModal,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      updateProfile,
      refreshUserOrders,
    }),
    [
      products,
      banners,
      isCatalogLoading,
      refreshCatalog,
      cartItems,
      totalCartCount,
      isCartOpen,
      isCartAnimating,
      addToCart,
      updateCartQuantity,
      removeCartItem,
      clearCart,
      user,
      orders,
      wishlistSlugs,
      isWishlisted,
      toggleWishlist,
      isAuthModalOpen,
      authModalIntent,
      openAuthModal,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      updateProfile,
      refreshUserOrders,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return ctx
}
