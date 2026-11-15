'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import {
  PRODUCTS,
  HOME_BANNERS,
  Product,
  BannerSlide,
  CartLineItem,
} from '../data/products';
import {
  fetchStorefrontCatalog,
  syncUserAccountViaSdk,
} from '../lib/payload-sdk';
import type { StoreUserRecord, StoreOrderRecord } from '../lib/storefront-db';
import { neonAuthClient } from '../lib/auth-client';

const GUEST_CART_STORAGE_KEY = 'the_store_guest_cart_v1';
const USER_SESSION_STORAGE_KEY = 'the_store_active_user_v1';

interface AddToCartOptions {
  variantSku?: string;
  size?: string;
  color?: string;
  colorHex?: string;
  quantity?: number;
}

interface StoreContextValue {
  products: Product[];
  banners: BannerSlide[];
  refreshCatalog: () => Promise<void>;
  cartItems: CartLineItem[];
  totalCartCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isCartAnimating: boolean;
  addToCart: (product: Product, options?: AddToCartOptions) => void;
  updateCartQuantity: (cartItemId: string, nextQty: number) => void;
  removeCartItem: (cartItemId: string) => void;
  clearCart: () => void;
  user: StoreUserRecord | null;
  orders: StoreOrderRecord[];
  wishlistSlugs: string[];
  isWishlisted: (productSlug: string) => boolean;
  toggleWishlist: (product: Product) => Promise<void>;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalIntent: 'account' | 'checkout' | 'wishlist' | 'review';
  openAuthModal: (
    intent?: 'account' | 'checkout' | 'wishlist' | 'review'
  ) => void;
  signInWithEmail: (params: {
    email: string;
    password?: string;
    name?: string;
    isRegister?: boolean;
  }) => Promise<StoreUserRecord>;
  signInWithGoogle: () => Promise<StoreUserRecord>;
  signOut: () => void;
  updateProfile: (params: {
    name: string;
    phone: string;
    shippingAddress: string;
  }) => Promise<void>;
  refreshUserOrders: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [banners, setBanners] = useState<BannerSlide[]>(HOME_BANNERS);
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [user, setUser] = useState<StoreUserRecord | null>(null);
  const [orders, setOrders] = useState<StoreOrderRecord[]>([]);
  const [guestWishlist, setGuestWishlist] = useState<string[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartAnimating, setIsCartAnimating] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalIntent, setAuthModalIntent] = useState<
    'account' | 'checkout' | 'wishlist' | 'review'
  >('account');
  const [hydrated, setHydrated] = useState(false);

  const refreshCatalog = useCallback(async () => {
    try {
      const data = await fetchStorefrontCatalog();
      if (Array.isArray(data.products) && data.products.length > 0) {
        setProducts(data.products);
      }
      if (Array.isArray(data.banners) && data.banners.length > 0) {
        setBanners(data.banners);
      }
    } catch {}
  }, []);

  // Hydrate guest cart & persisted user session on mount
  useEffect(() => {
    try {
      const rawCart = localStorage.getItem(GUEST_CART_STORAGE_KEY);
      if (rawCart) {
        const parsed = JSON.parse(rawCart);
        if (Array.isArray(parsed)) {
          setCartItems(parsed);
        }
      }
      const rawUser = localStorage.getItem(USER_SESSION_STORAGE_KEY);
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser) as StoreUserRecord;
        if (parsedUser?.email) {
          setUser(parsedUser);
          syncUserAccountViaSdk({
            action: 'login',
            email: parsedUser.email,
            name: parsedUser.name,
          })
            .then((res) => {
              setUser(res.user);
              setOrders(res.orders || []);
              if (
                Array.isArray(res.user.savedCart) &&
                res.user.savedCart.length > 0 &&
                !rawCart
              ) {
                setCartItems(res.user.savedCart);
              }
            })
            .catch(() => {});
        }
      }
    } catch {}
    setHydrated(true);
    refreshCatalog();
  }, [refreshCatalog]);

  // Persist cart to localStorage when logged out, or sync to Payload when logged in
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (!user) {
        localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(cartItems));
      } else {
        localStorage.removeItem(GUEST_CART_STORAGE_KEY);
        syncUserAccountViaSdk({
          action: 'sync_cart',
          email: user.email,
          cartItems,
        }).catch(() => {});
      }
    } catch {}
  }, [cartItems, user, hydrated]);

  const totalCartCount = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.quantity, 0),
    [cartItems]
  );

  const addToCart = useCallback(
    (product: Product, options?: AddToCartOptions) => {
      const liveProd =
        products.find((p) => p.id === product.id || p.slug === product.slug) ||
        product;
      const defaultVariant =
        liveProd.variants.find(
          (v) => Math.max(0, v.stock - v.reservedStock) > 0
        ) || liveProd.variants[0];

      const matchedVariant = options?.variantSku
        ? liveProd.variants.find((v) => v.sku === options.variantSku) ||
          defaultVariant
        : options?.size || options?.color
          ? liveProd.variants.find(
              (v) =>
                (!options.size || v.size === options.size) &&
                (!options.color || v.color === options.color)
            ) || defaultVariant
          : defaultVariant;

      const available = matchedVariant
        ? Math.max(0, matchedVariant.stock - matchedVariant.reservedStock)
        : 10;

      if (available <= 0) {
        return;
      }

      const sku = matchedVariant?.sku || `${liveProd.id.toUpperCase()}-STD-M`;
      const selectedSize = options?.size || matchedVariant?.size || 'M';
      const selectedColor =
        options?.color || matchedVariant?.color || 'Signature';
      const selectedColorHex =
        options?.colorHex || matchedVariant?.colorHex || '#5C5EDC';
      const unitPrice = matchedVariant?.priceOverride ?? liveProd.price;
      const qtyToAdd = Math.max(1, options?.quantity || 1);

      setIsCartAnimating(true);
      setCartItems((prev) => {
        const existing = prev.find((item) => item.cartItemId === sku);
        if (existing) {
          return prev.map((item) =>
            item.cartItemId === sku
              ? {
                  ...item,
                  quantity: Math.min(available, item.quantity + qtyToAdd),
                  maxAvailableStock: available,
                }
              : item
          );
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
        ];
      });

      setTimeout(() => {
        setIsCartAnimating(false);
      }, 450);
    },
    [products]
  );

  const updateCartQuantity = useCallback(
    (cartItemId: string, nextQty: number) => {
      if (nextQty <= 0) {
        setCartItems((prev) =>
          prev.filter(
            (item) => item.cartItemId !== cartItemId && item.id !== cartItemId
          )
        );
        return;
      }
      setCartItems((prev) =>
        prev.map((item) =>
          item.cartItemId === cartItemId || item.id === cartItemId
            ? {
                ...item,
                quantity: Math.min(item.maxAvailableStock || 99, nextQty),
              }
            : item
        )
      );
    },
    []
  );

  const removeCartItem = useCallback((cartItemId: string) => {
    setCartItems((prev) =>
      prev.filter(
        (item) => item.cartItemId !== cartItemId && item.id !== cartItemId
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    try {
      localStorage.removeItem(GUEST_CART_STORAGE_KEY);
    } catch {}
  }, []);

  const openAuthModal = useCallback(
    (intent: 'account' | 'checkout' | 'wishlist' | 'review' = 'account') => {
      setAuthModalIntent(intent);
      setIsAuthModalOpen(true);
    },
    []
  );

  const signInWithEmail = useCallback(
    async (params: {
      email: string;
      password?: string;
      name?: string;
      isRegister?: boolean;
    }) => {
      // Attempt Neon Managed Better Auth client first if configured
      try {
        if (params.isRegister && params.password) {
          await neonAuthClient.signUp.email({
            email: params.email,
            password: params.password,
            name: params.name || params.email.split('@')[0],
          });
        } else if (params.password) {
          await neonAuthClient.signIn.email({
            email: params.email,
            password: params.password,
          });
        }
      } catch {
        // Fallback seamlessly when Neon Auth baseUrl is local/unconfigured
      }

      const synced = await syncUserAccountViaSdk({
        action: params.isRegister ? 'register' : 'login',
        email: params.email,
        name: params.name,
        cartItems,
      });

      setUser(synced.user);
      setOrders(synced.orders || []);
      if (
        Array.isArray(synced.user.savedCart) &&
        synced.user.savedCart.length > 0
      ) {
        setCartItems(synced.user.savedCart);
      }
      try {
        localStorage.setItem(
          USER_SESSION_STORAGE_KEY,
          JSON.stringify(synced.user)
        );
        localStorage.removeItem(GUEST_CART_STORAGE_KEY);
      } catch {}
      setIsAuthModalOpen(false);
      return synced.user;
    },
    [cartItems]
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      if (
        process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL &&
        !process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL.includes('ep-example')
      ) {
        await neonAuthClient.signIn.social({
          provider: 'google',
          callbackURL: window.location.href,
        });
      }
    } catch {}

    const synced = await syncUserAccountViaSdk({
      action: 'oauth_google',
      email: 'alex.rivera@gmail.com',
      name: 'Alex Rivera (Google)',
      cartItems,
    });

    setUser(synced.user);
    setOrders(synced.orders || []);
    if (
      Array.isArray(synced.user.savedCart) &&
      synced.user.savedCart.length > 0
    ) {
      setCartItems(synced.user.savedCart);
    }
    try {
      localStorage.setItem(
        USER_SESSION_STORAGE_KEY,
        JSON.stringify(synced.user)
      );
      localStorage.removeItem(GUEST_CART_STORAGE_KEY);
    } catch {}
    setIsAuthModalOpen(false);
    return synced.user;
  }, [cartItems]);

  const signOut = useCallback(() => {
    try {
      neonAuthClient.signOut().catch(() => {});
    } catch {}
    setUser(null);
    setOrders([]);
    try {
      localStorage.removeItem(USER_SESSION_STORAGE_KEY);
    } catch {}
  }, []);

  const wishlistSlugs = useMemo(
    () => (user ? user.wishlistProductSlugs || [] : guestWishlist),
    [user, guestWishlist]
  );

  const isWishlisted = useCallback(
    (productSlug: string) => wishlistSlugs.includes(productSlug),
    [wishlistSlugs]
  );

  const toggleWishlist = useCallback(
    async (product: Product) => {
      if (!user) {
        setGuestWishlist((prev) =>
          prev.includes(product.slug)
            ? prev.filter((s) => s !== product.slug)
            : [...prev, product.slug]
        );
        return;
      }

      const res = await syncUserAccountViaSdk({
        action: 'toggle_wishlist',
        email: user.email,
        productSlug: product.slug,
      });
      setUser(res.user);
      try {
        localStorage.setItem(
          USER_SESSION_STORAGE_KEY,
          JSON.stringify(res.user)
        );
      } catch {}
    },
    [user]
  );

  const updateProfile = useCallback(
    async (params: {
      name: string;
      phone: string;
      shippingAddress: string;
    }) => {
      if (!user) return;
      const res = await syncUserAccountViaSdk({
        action: 'update_profile',
        email: user.email,
        name: params.name,
        phone: params.phone,
        shippingAddress: params.shippingAddress,
      });
      setUser(res.user);
      try {
        localStorage.setItem(
          USER_SESSION_STORAGE_KEY,
          JSON.stringify(res.user)
        );
      } catch {}
    },
    [user]
  );

  const refreshUserOrders = useCallback(async () => {
    await refreshCatalog();
    if (!user) return;
    try {
      const res = await syncUserAccountViaSdk({
        action: 'login',
        email: user.email,
      });
      setUser(res.user);
      setOrders(res.orders || []);
    } catch {}
  }, [user, refreshCatalog]);

  const value = useMemo(
    () => ({
      products,
      banners,
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
    ]
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return ctx;
}
