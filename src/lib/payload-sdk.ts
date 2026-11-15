import { PayloadSDK } from '@payloadcms/sdk';
import type { Config } from '../payload-types';
import type {
  Product,
  BannerSlide,
  ProductReviewItem,
  CartLineItem,
  StoreOrderRecord,
  StoreUserRecord,
} from '../data/utils';

const getBaseApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }
  return `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}/api`;
};

/**
 * Official @payloadcms/sdk typed instance for interacting with Payload CMS collections and routes.
 */
export const payloadSdk = new PayloadSDK<Config>({
  baseURL: getBaseApiUrl(),
  baseInit: {
    credentials: 'include',
  },
});

export async function fetchStorefrontCatalog(params?: {
  search?: string;
  filter?: string;
  sort?: string;
}): Promise<{
  products: Product[];
  banners: BannerSlide[];
}> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('q', params.search);
  if (params?.filter) qs.set('filter', params.filter);
  if (params?.sort) qs.set('sort', params.sort);

  const res = await payloadSdk.request({
    method: 'GET',
    path: `/storefront/catalog${qs.toString() ? `?${qs.toString()}` : ''}`,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch storefront catalog (${res.status})`);
  }
  return res.json();
}

export async function fetchProductBySlugWithReviews(slug: string): Promise<{
  product: Product;
  reviews: ProductReviewItem[];
  relatedProducts: Product[];
}> {
  const res = await payloadSdk.request({
    method: 'GET',
    path: `/storefront/products/${encodeURIComponent(slug)}`,
  });

  if (!res.ok) {
    throw new Error(`Product "${slug}" not found (${res.status})`);
  }
  return res.json();
}

export async function submitProductReviewViaSdk(payload: {
  productSlug: string;
  authorName: string;
  authorEmail?: string;
  rating: number;
  title: string;
  comment: string;
  variantSize?: string;
  variantColor?: string;
}): Promise<{
  review: ProductReviewItem;
  product: Product;
}> {
  const res = await payloadSdk.request({
    method: 'POST',
    path: `/storefront/products/${encodeURIComponent(payload.productSlug)}/reviews`,
    json: payload,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to submit review');
  }
  return data;
}

export async function syncUserAccountViaSdk(payload: {
  action:
    | 'register'
    | 'login'
    | 'oauth_google'
    | 'sync_cart'
    | 'toggle_wishlist'
    | 'update_profile';
  email?: string;
  newEmail?: string;
  password?: string;
  currentPassword?: string;
  newPassword?: string;
  name?: string;
  phone?: string;
  avatarUrl?: string | null;
  shippingAddress?: string;
  productSlug?: string;
  cartItems?: CartLineItem[];
}): Promise<{
  user: StoreUserRecord;
  orders: StoreOrderRecord[];
}> {
  const res = await payloadSdk.request({
    method: 'POST',
    path: '/storefront/account',
    json: payload,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Account operation failed');
  }
  return data;
}

export async function fetchUserOrdersViaSdk(email: string): Promise<{
  orders: StoreOrderRecord[];
}> {
  const res = await payloadSdk.request({
    method: 'GET',
    path: `/storefront/orders?email=${encodeURIComponent(email)}`,
  });
  if (!res.ok) {
    throw new Error('Failed to load orders');
  }
  return res.json();
}

export async function updateOrderStatusViaSdk(payload: {
  orderId: string;
  nextStatus: StoreOrderRecord['orderStatus'];
  note?: string;
}): Promise<{
  order: StoreOrderRecord;
  emailDispatched: boolean;
}> {
  const res = await payloadSdk.request({
    method: 'PATCH',
    path: '/storefront/orders',
    json: payload,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update order status');
  }
  return data;
}
