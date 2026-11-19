import { getCatalogData } from '@/lib/payload-sdk'
import type { Banner, Order, Product, Review } from '../lib/utils/data'

export type AuthModalIntent = 'account' | 'checkout' | 'wishlist' | 'review'

export interface AddToCartOptions {
  variantSku?: string
  size?: string
  color?: string
  colorHex?: string
  quantity?: number
}

export interface CatalogResponse {
  products: Product[]
  banners: Banner[]
}

export interface ProductDetailResponse {
  product: Product
  reviews: Review[]
  relatedProducts: Product[]
}

export interface OrdersResponse {
  orders: Order[]
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
  userState: {
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
} as const

export const storefrontQueryKeys = {
  catalog: ['storefront-catalog'] as const,
  productDetail: (slug: string) => ['storefront-product', slug] as const,
  orders: (userKey?: string | null) =>
    ['storefront-orders', (userKey || '').trim().toLowerCase()] as const,
  billingDetails: (neonUserId?: string | null) =>
    ['storefront-billing-details', (neonUserId || '').trim()] as const,
  cart: (neonUserId?: string | null) => ['storefront-cart', (neonUserId || '').trim()] as const,
  wishlist: (neonUserId?: string | null) =>
    ['storefront-wishlist', (neonUserId || '').trim()] as const,
}

export async function fetchCatalogData(): Promise<CatalogResponse> {
  return getCatalogData()
}
