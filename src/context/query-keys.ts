import axios from 'axios'
import type {
  BannerSlide,
  CartLineItem,
  Product,
  ProductReviewItem,
  StoreOrderRecord,
  StoreUserRecord,
} from '../data/utils'

export type AuthModalIntent = 'account' | 'checkout' | 'wishlist' | 'review'

export interface AddToCartOptions {
  variantSku?: string
  size?: string
  color?: string
  colorHex?: string
  quantity?: number
}

export interface AccountActionPayload {
  action: 'register' | 'login' | 'oauth_google' | 'sync_cart' | 'toggle_wishlist' | 'update_profile'
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

export interface AccountActionResponse {
  user: StoreUserRecord
  orders: StoreOrderRecord[]
}

export interface CatalogResponse {
  products: Product[]
  banners: BannerSlide[]
}

export interface ProductDetailResponse {
  product: Product
  reviews: ProductReviewItem[]
  relatedProducts: Product[]
}

export interface OrdersResponse {
  orders: StoreOrderRecord[]
}

export const CACHE_TIMES = {
  catalog: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  },
  productDetail: {
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  },
  orders: {
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
} as const

export const storefrontQueryKeys = {
  catalog: ['storefront-catalog'] as const,
  productDetail: (slug: string) => ['storefront-product', slug] as const,
  orders: (email?: string | null) =>
    ['storefront-orders', (email || '').trim().toLowerCase()] as const,
}

export async function fetchCatalogData(): Promise<CatalogResponse> {
  const { data } = await axios.get<CatalogResponse>('/api/storefront/catalog', {
    withCredentials: true,
  })
  return data
}

export async function postAccountAction(
  payload: AccountActionPayload,
): Promise<AccountActionResponse> {
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
