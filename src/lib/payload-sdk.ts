import { PayloadSDK } from '@payloadcms/sdk'
import type { Where } from 'payload'
import type { Order, Product, Wishlist } from '../payload-types'
import type { CartLineItem } from './utils/data'

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    return '/api'
  }
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  return `${serverUrl}/api`
}

export const sdk = new PayloadSDK({
  baseURL: getBaseURL(),
  fetch: (input, init) => globalThis.fetch(input, init),
})

export async function getProducts() {
  try {
    const res = await sdk.find({
      collection: 'products',
      limit: 100,
      sort: 'id',
    })
    return res.docs || []
  } catch (error) {
    console.error('Failed to fetch products from Payload:', error)
    return []
  }
}

export async function getBanners() {
  try {
    const res = await sdk.find({
      collection: 'banners',
      where: {
        active: {
          equals: true,
        },
      },
      sort: 'sortOrder',
      limit: 20,
    })
    return res.docs || []
  } catch (error) {
    console.error('Failed to fetch banners from Payload:', error)
    return []
  }
}

export async function getCatalogData() {
  const [products, banners] = await Promise.all([getProducts(), getBanners()])
  return { products, banners }
}

export async function getProductBySlug(slug: string) {
  try {
    const res = await sdk.find({
      collection: 'products',
      where: {
        slug: { equals: slug },
      },
      limit: 1,
    })
    return res.docs?.[0] || null
  } catch (error) {
    console.error(`Failed to fetch product with slug "${slug}":`, error)
    return null
  }
}

export async function getRelatedProducts(category: Product['category'], excludeSlug: string) {
  try {
    const res = await sdk.find({
      collection: 'products',
      where: {
        category: {
          equals: category,
        },
        slug: {
          not_equals: excludeSlug,
        },
      },
      limit: 4,
    })
    return res.docs || []
  } catch (error) {
    console.error('Failed to fetch related products from Payload:', error)
    return []
  }
}

export async function getReviewsByProductSlug(productSlug: string) {
  try {
    const res = await sdk.find({
      collection: 'reviews',
      where: {
        productSlug: {
          equals: productSlug,
        },
      },
      sort: '-createdAt',
      limit: 100,
    })
    return res.docs || []
  } catch (error) {
    console.error(`Failed to fetch reviews for "${productSlug}":`, error)
    return []
  }
}

export async function fetchProductBySlugWithReviews(slug: string) {
  const product = await getProductBySlug(slug)
  if (!product) {
    throw new Error(`Product "${slug}" not found`)
  }
  const [reviews, relatedProducts] = await Promise.all([
    getReviewsByProductSlug(product.slug),
    getRelatedProducts(product.category, product.slug),
  ])

  return {
    product,
    reviews,
    relatedProducts,
  }
}

export async function getOrdersByUser(params: {
  neonUserId?: string | null
  email?: string | null
}) {
  const neonUserId = params.neonUserId?.trim()
  const email = params.email?.trim().toLowerCase()
  if (!neonUserId && !email) return []

  try {
    const orConditions: Where[] = []
    if (neonUserId) {
      orConditions.push({ neonUserId: { equals: neonUserId } })
    }
    if (email) {
      orConditions.push({ customerEmail: { equals: email } })
    }

    const res = await sdk.find({
      collection: 'orders',
      where: orConditions.length === 1 ? orConditions[0] : { or: orConditions },
      sort: '-createdAt',
      limit: 100,
    })
    return (res.docs || []).filter((o) =>
      Boolean(
        (neonUserId && o.neonUserId === neonUserId) ||
          (email && o.customerEmail?.trim().toLowerCase() === email),
      ),
    )
  } catch (error) {
    console.error('Failed to fetch orders from Payload:', error)
    return []
  }
}

export async function getOrderByOrderId(orderId: string) {
  if (!orderId) return null
  try {
    const res = await sdk.find({
      collection: 'orders',
      where: {
        orderId: {
          equals: orderId,
        },
      },
      limit: 1,
    })
    return res.docs?.[0] || null
  } catch (error) {
    console.error(`Failed to fetch order "${orderId}":`, error)
    return null
  }
}

export async function createProductReview(payload: {
  productId?: number
  productSlug: string
  neonUserId?: string
  authorName: string
  authorEmail?: string
  rating: number
  title: string
  comment: string
  variantSize?: string
  variantColor?: string
}) {
  if (!payload.neonUserId?.trim()) {
    throw new Error('Authentication required to publish a review.')
  }

  const product = await getProductBySlug(payload.productSlug)
  if (!product) {
    throw new Error(`Product "${payload.productSlug}" not found`)
  }

  const rating = Math.min(5, Math.max(1, Number(payload.rating) || 5))
  const title = payload.title.trim()
  const comment = payload.comment.trim()
  if (!title || !comment) {
    throw new Error('Please provide both a review headline and your feedback.')
  }

  let verifiedPurchase = false
  if (payload.neonUserId || payload.authorEmail) {
    const userOrders = await getOrdersByUser({
      neonUserId: payload.neonUserId,
      email: payload.authorEmail,
    })
    verifiedPurchase = userOrders.some((o) =>
      o.items?.some((i) => i.productSlug === product.slug || i.productId === String(product.id)),
    )
  }

  const review = await sdk.create({
    collection: 'reviews',
    data: {
      product: payload.productId ?? product.id,
      productSlug: product.slug,
      neonUserId: payload.neonUserId,
      authorName: payload.authorName,
      authorEmail: payload.authorEmail,
      rating,
      title,
      comment,
      variantSize: payload.variantSize || 'M',
      variantColor: payload.variantColor || product.variants?.[0]?.color || 'Signature',
      verifiedPurchase,
    },
  })

  const currentCount = product.reviewCount ?? 0
  const currentAvg = product.averageRating ?? 4.8
  const totalCount = currentCount + 1
  const nextAvg = Number(((currentAvg * currentCount + rating) / totalCount).toFixed(1))

  const updatedProduct = await sdk
    .update({
      collection: 'products',
      id: product.id,
      data: {
        reviewCount: totalCount,
        averageRating: nextAvg,
      },
    })
    .catch(() => ({
      ...product,
      reviewCount: totalCount,
      averageRating: nextAvg,
    }))

  return {
    review,
    product: updatedProduct,
  }
}

export async function getBillingDetails(neonUserId: string) {
  if (!neonUserId) return null
  try {
    const res = await sdk.find({
      collection: 'billing-details',
      where: {
        neonUserId: {
          equals: neonUserId,
        },
      },
      limit: 1,
    })
    const doc = res.docs?.[0]
    return doc && doc.neonUserId === neonUserId ? doc : null
  } catch (error) {
    console.error('Failed to fetch billing details from Payload:', error)
    return null
  }
}

export async function upsertBillingDetails(params: {
  neonUserId: string
  phone?: string | null
  shippingAddress?: string | null
}) {
  if (!params.neonUserId) {
    throw new Error('Authentication required to update billing details.')
  }
  const existing = await getBillingDetails(params.neonUserId)
  if (existing) {
    return sdk.update({
      collection: 'billing-details',
      id: existing.id,
      data: {
        phone: params.phone ?? existing.phone ?? '',
        shippingAddress: params.shippingAddress ?? existing.shippingAddress ?? '',
      },
    })
  }

  return sdk.create({
    collection: 'billing-details',
    data: {
      neonUserId: params.neonUserId,
      phone: params.phone ?? '',
      shippingAddress: params.shippingAddress ?? '',
    },
  })
}

function normalizeCartItemsForPayload(items: CartLineItem[]): CartLineItem[] {
  return items.map((item) => ({
    product:
      typeof item.product === 'object' && item.product !== null
        ? item.product.id
        : (item.product ?? undefined),
    productSlug: item.productSlug,
    cartItemId: item.cartItemId,
    variantSku: item.variantSku,
    title: item.title,
    brand: item.brand,
    category: item.category,
    subcategory: item.subcategory,
    selectedSize: item.selectedSize,
    selectedColor: item.selectedColor,
    selectedColorHex: item.selectedColorHex,
    unitPrice: item.unitPrice,
    price: item.price,
    quantity: item.quantity,
    maxAvailableStock: item.maxAvailableStock,
    imageUrl: item.imageUrl ?? undefined,
  }))
}

export async function getCartByNeonUserId(neonUserId: string) {
  if (!neonUserId) return null
  try {
    const res = await sdk.find({
      collection: 'carts',
      where: {
        neonUserId: {
          equals: neonUserId,
        },
      },
      limit: 1,
    })
    const doc = res.docs?.[0]
    return doc && doc.neonUserId === neonUserId ? doc : null
  } catch (error) {
    console.error('Failed to fetch cart from Payload:', error)
    return null
  }
}

export async function syncCartWithPayload(neonUserId: string, items: CartLineItem[]) {
  if (!neonUserId) {
    throw new Error('Authentication required to sync cart.')
  }
  const normalizedItems = normalizeCartItemsForPayload(items)
  const existing = await getCartByNeonUserId(neonUserId)
  if (existing) {
    return sdk.update({
      collection: 'carts',
      id: existing.id,
      data: {
        items: normalizedItems,
      },
    })
  }

  return sdk.create({
    collection: 'carts',
    data: {
      neonUserId,
      items: normalizedItems,
    },
  })
}

function normalizeWishlistItemsForPayload(
  items: NonNullable<Wishlist['items']>,
): NonNullable<Wishlist['items']> {
  return items.map((item) => ({
    product:
      typeof item.product === 'object' && item.product !== null
        ? item.product.id
        : (item.product ?? undefined),
    productSlug: item.productSlug,
  }))
}

export async function getWishlistByNeonUserId(neonUserId: string) {
  if (!neonUserId) return null
  try {
    const res = await sdk.find({
      collection: 'wishlists',
      where: {
        neonUserId: {
          equals: neonUserId,
        },
      },
      limit: 1,
    })
    const doc = res.docs?.[0]
    return doc && doc.neonUserId === neonUserId ? doc : null
  } catch (error) {
    console.error('Failed to fetch wishlist from Payload:', error)
    return null
  }
}

export async function syncWishlistWithPayload(
  neonUserId: string,
  items: NonNullable<Wishlist['items']>,
) {
  if (!neonUserId) {
    throw new Error('Authentication required to sync wishlist.')
  }
  const normalizedItems = normalizeWishlistItemsForPayload(items)
  const existing = await getWishlistByNeonUserId(neonUserId)
  if (existing) {
    return sdk.update({
      collection: 'wishlists',
      id: existing.id,
      data: {
        items: normalizedItems,
      },
    })
  }

  return sdk.create({
    collection: 'wishlists',
    data: {
      neonUserId,
      items: normalizedItems,
    },
  })
}

export async function toggleWishlistItemInPayload(
  neonUserId: string,
  product: Pick<Product, 'id' | 'slug'>,
) {
  if (!neonUserId) {
    throw new Error('Authentication required to update wishlist.')
  }
  const existing = await getWishlistByNeonUserId(neonUserId)
  const currentItems = existing?.items ?? []
  const alreadySaved = currentItems.some((item) => item.productSlug === product.slug)
  const nextItems = alreadySaved
    ? currentItems.filter((item) => item.productSlug !== product.slug)
    : [...currentItems, { product: product.id, productSlug: product.slug }]

  return syncWishlistWithPayload(neonUserId, nextItems)
}

export async function updateOrderStatusViaSdk(payload: {
  orderId: string
  nextStatus: Order['orderStatus']
  note?: string
  deliveryFailed?: boolean
}) {
  const res = await sdk.request({
    method: 'PATCH',
    path: '/storefront/orders',
    json: payload,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update order status')
  }
  return data
}

export async function generateOrderDocumentViaSdk(payload: {
  orderId: string
  documentType: 'INVOICE' | 'RECEIPT'
}): Promise<{
  order: Order
  document: {
    documentType: 'INVOICE' | 'RECEIPT'
    documentNumber: string
    filename: string
    templateId: string
    generatedAt: string
    pdfUrl: string | null
  }
}> {
  const res = await sdk.request({
    method: 'PATCH',
    path: '/storefront/orders',
    json: {
      action: 'generate_document',
      orderId: payload.orderId,
      documentType: payload.documentType,
    },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate document')
  }
  return data
}
