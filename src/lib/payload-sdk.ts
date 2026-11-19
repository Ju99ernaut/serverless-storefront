import { PayloadSDK } from '@payloadcms/sdk'
import type { Where } from 'payload'
import type { Order, Product, StockReservation, Wishlist } from '../payload-types'
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

const inventoryLockChains = new Map<string, Promise<void>>()

async function acquireSingleLock(key: string): Promise<() => void> {
  const prev = inventoryLockChains.get(key) ?? Promise.resolve()
  let releaseFn!: () => void
  const current = new Promise<void>((resolve) => {
    releaseFn = resolve
  })
  const nextChain = prev.then(() => current)
  inventoryLockChains.set(key, nextChain)
  await prev
  return () => {
    releaseFn()
    if (inventoryLockChains.get(key) === nextChain) {
      inventoryLockChains.delete(key)
    }
  }
}

async function withInventoryLock<T>(keys: string[], fn: () => Promise<T>): Promise<T> {
  const sortedUniqueKeys = Array.from(new Set(['__inventory_root__', ...keys])).sort()
  const releases: Array<() => void> = []
  try {
    for (const key of sortedUniqueKeys) {
      releases.push(await acquireSingleLock(key))
    }
    return await fn()
  } finally {
    for (let i = releases.length - 1; i >= 0; i--) {
      releases[i]()
    }
  }
}

export function parseWorkflowDurationMs(
  duration: string | number | undefined,
  fallbackMs: number,
): number {
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
    return duration
  }
  if (typeof duration === 'string') {
    const trimmed = duration.trim().toLowerCase()
    const match =
      /^(\d+(?:\.\d+)?)\s*(ms|s|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)?$/.exec(
        trimmed,
      )
    if (match) {
      const value = Number(match[1])
      const unit = match[2] || 'ms'
      if (Number.isFinite(value) && value > 0) {
        if (unit === 'ms') return value
        if (unit === 's') return value * 1000
        if (unit === 'm' || unit.startsWith('min')) return value * 60 * 1000
        if (unit === 'h' || unit.startsWith('hr') || unit.startsWith('hour')) {
          return value * 60 * 60 * 1000
        }
        if (unit === 'd' || unit.startsWith('day')) {
          return value * 24 * 60 * 60 * 1000
        }
      }
    }
  }
  return fallbackMs
}

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
    return res.docs || []
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

  const updatedProduct = await sdk.update({
    collection: 'products',
    id: product.id,
    data: {
      reviewCount: totalCount,
      averageRating: nextAvg,
    },
  })

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
    return res.docs?.[0] || null
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
    return res.docs?.[0] || null
  } catch (error) {
    console.error('Failed to fetch cart from Payload:', error)
    return null
  }
}

export async function syncCartWithPayload(neonUserId: string, items: CartLineItem[]) {
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
    return res.docs?.[0] || null
  } catch (error) {
    console.error('Failed to fetch wishlist from Payload:', error)
    return null
  }
}

export async function syncWishlistWithPayload(
  neonUserId: string,
  items: NonNullable<Wishlist['items']>,
) {
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

function stripVariantIds(variants: NonNullable<Product['variants']>) {
  return variants.map((v) => ({
    sku: v.sku,
    size: v.size,
    color: v.color,
    colorHex: v.colorHex,
    priceOverride: v.priceOverride,
    stock: v.stock,
    reservedStock: v.reservedStock,
    lowStockThreshold: v.lowStockThreshold,
    imageUrl: v.imageUrl,
  }))
}

async function applyVariantInventoryAdjustments(
  items: Array<{ productSlug: string; variantSku: string; quantity: number }>,
  mode: 'reserve' | 'release_reserved' | 'release_committed' | 'commit',
) {
  const uniqueSlugs = Array.from(new Set(items.map((i) => i.productSlug)))
  if (uniqueSlugs.length === 0) return

  const productsRes = await sdk.find({
    collection: 'products',
    where: {
      slug: { in: uniqueSlugs },
    },
    limit: 100,
  })

  const products = productsRes.docs || []
  for (const product of products) {
    const matchingItems = items.filter((i) => i.productSlug === product.slug)
    if (matchingItems.length === 0 || !product.variants) continue

    const updatedVariants = stripVariantIds(product.variants)
    let dirty = false

    for (const item of matchingItems) {
      const variant = updatedVariants.find((v) => v.sku === item.variantSku) || updatedVariants[0]
      if (!variant) continue

      if (mode === 'reserve') {
        variant.reservedStock += item.quantity
        dirty = true
      } else if (mode === 'release_reserved') {
        variant.reservedStock = Math.max(0, variant.reservedStock - item.quantity)
        dirty = true
      } else if (mode === 'release_committed') {
        variant.stock += item.quantity
        dirty = true
      } else if (mode === 'commit') {
        variant.reservedStock = Math.max(0, variant.reservedStock - item.quantity)
        variant.stock = Math.max(0, variant.stock - item.quantity)
        dirty = true
      }
    }

    if (dirty) {
      await sdk.update({
        collection: 'products',
        id: product.id,
        data: {
          variants: updatedVariants,
        },
      })
    }
  }
}

async function expireStaleReservationsUnlocked() {
  try {
    const nowIso = new Date().toISOString()
    const res = await sdk.find({
      collection: 'stock-reservations',
      where: {
        status: { equals: 'RESERVED' },
        expiresAt: { less_than_equal: nowIso },
      },
      limit: 50,
    })

    for (const reservation of res.docs || []) {
      const items = (reservation.items || []).map((i) => ({
        productSlug: i.productSlug,
        variantSku: i.variantSku,
        quantity: i.quantity,
      }))
      await applyVariantInventoryAdjustments(items, 'release_reserved')
      await sdk.update({
        collection: 'stock-reservations',
        id: reservation.id,
        data: { status: 'EXPIRED' },
      })
    }
  } catch (error) {
    console.error('Failed to expire stale reservations:', error)
  }
}

export async function expireStaleReservationsViaSdk() {
  return withInventoryLock(['__expire__'], () => expireStaleReservationsUnlocked())
}

export async function reserveVariantStockViaSdk(params: {
  reservationKey: string
  orderId: string
  ttlMs?: number
  items: Array<{
    productSlug: string
    variantSku: string
    quantity: number
  }>
}): Promise<{
  success: boolean
  error?: string
  reservation?: StockReservation
  insufficientItems?: Array<{
    variantSku: string
    requested: number
    available: number
  }>
}> {
  const productSlugs = params.items.map((i) => i.productSlug)
  return withInventoryLock(productSlugs, async () => {
    await expireStaleReservationsUnlocked()

    const existingRes = await sdk.find({
      collection: 'stock-reservations',
      where: {
        reservationKey: { equals: params.reservationKey },
      },
      limit: 1,
    })
    const existing = existingRes.docs?.[0]
    if (existing && existing.status === 'RESERVED') {
      return { success: true, reservation: existing }
    }

    const nowIso = new Date().toISOString()
    const uniqueSlugs = Array.from(new Set(productSlugs))
    const [productsRes, activeReservationsRes] = await Promise.all([
      sdk.find({
        collection: 'products',
        where: {
          slug: { in: uniqueSlugs },
        },
        limit: 100,
      }),
      sdk.find({
        collection: 'stock-reservations',
        where: {
          status: { equals: 'RESERVED' },
          expiresAt: { greater_than: nowIso },
        },
        limit: 200,
      }),
    ])

    const products = productsRes.docs || []
    const activeReservedBySku = new Map<string, number>()
    for (const resDoc of activeReservationsRes.docs || []) {
      for (const resItem of resDoc.items || []) {
        activeReservedBySku.set(
          resItem.variantSku,
          (activeReservedBySku.get(resItem.variantSku) ?? 0) + (Number(resItem.quantity) || 0),
        )
      }
    }

    const insufficient: Array<{
      variantSku: string
      requested: number
      available: number
    }> = []

    const resolvedItems: Array<{
      productSlug: string
      variantSku: string
      quantity: number
    }> = []

    const pendingSkuQty = new Map<string, number>()

    for (const reqItem of params.items) {
      const product = products.find((p) => p.slug === reqItem.productSlug)
      if (!product) {
        return {
          success: false,
          error: `Product "${reqItem.productSlug}" not found.`,
        }
      }

      const variant =
        product.variants?.find((v) => v.sku === reqItem.variantSku) || product.variants?.[0]

      if (!variant) {
        return {
          success: false,
          error: `Variant "${reqItem.variantSku}" not found for ${product.title}.`,
        }
      }

      const activeReservedFromLedger = activeReservedBySku.get(variant.sku) ?? 0
      const alreadyQueuedQty = pendingSkuQty.get(variant.sku) ?? 0
      const effectiveReserved =
        Math.max(variant.reservedStock, activeReservedFromLedger) + alreadyQueuedQty
      const available = Math.max(0, variant.stock - effectiveReserved)

      if (available < reqItem.quantity) {
        insufficient.push({
          variantSku: variant.sku,
          requested: reqItem.quantity,
          available,
        })
      } else {
        pendingSkuQty.set(variant.sku, alreadyQueuedQty + reqItem.quantity)
        resolvedItems.push({
          productSlug: product.slug,
          variantSku: variant.sku,
          quantity: reqItem.quantity,
        })
      }
    }

    if (insufficient.length > 0) {
      const detail = insufficient
        .map((i) => `${i.variantSku} (requested ${i.requested}, only ${i.available} available)`)
        .join(', ')
      return {
        success: false,
        error: `Insufficient stock for: ${detail}`,
        insufficientItems: insufficient,
      }
    }

    const ttlMs =
      typeof params.ttlMs === 'number' && params.ttlMs > 0 ? params.ttlMs : 30 * 60 * 1000
    const expiresAt = new Date(Date.now() + ttlMs).toISOString()

    let reservation: StockReservation
    try {
      reservation = await sdk.create({
        collection: 'stock-reservations',
        data: {
          reservationKey: params.reservationKey,
          orderId: params.orderId,
          status: 'RESERVED',
          expiresAt,
          items: resolvedItems,
        },
      })
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to reserve inventory due to a concurrent checkout.',
      }
    }

    try {
      await applyVariantInventoryAdjustments(resolvedItems, 'reserve')
    } catch (error) {
      await sdk
        .update({
          collection: 'stock-reservations',
          id: reservation.id,
          data: {
            status: 'RELEASED',
            failureReason: error instanceof Error ? error.message : 'Inventory adjustment failed',
          },
        })
        .catch(() => undefined)
      throw error
    }

    return { success: true, reservation }
  })
}

async function findStockReservation(reservationKeyOrOrderId: string) {
  const normalizedOrderId = reservationKeyOrOrderId.replace(/^res_/, '')
  const existingRes = await sdk.find({
    collection: 'stock-reservations',
    where: {
      or: [
        { reservationKey: { equals: reservationKeyOrOrderId } },
        { orderId: { equals: normalizedOrderId } },
      ],
    },
    limit: 1,
  })
  return existingRes.docs?.[0] || null
}

export async function releaseVariantStockViaSdk(
  reservationKey: string,
  reason = 'Transaction failed or cancelled',
) {
  return withInventoryLock(['__release__', reservationKey], async () => {
    const reservation = await findStockReservation(reservationKey)
    if (!reservation) return null

    const items = (reservation.items || []).map((i) => ({
      productSlug: i.productSlug,
      variantSku: i.variantSku,
      quantity: i.quantity,
    }))

    if (reservation.status === 'RESERVED') {
      await applyVariantInventoryAdjustments(items, 'release_reserved')
      return sdk.update({
        collection: 'stock-reservations',
        id: reservation.id,
        data: {
          status: 'RELEASED',
          failureReason: reason,
        },
      })
    }

    if (reservation.status === 'COMMITTED') {
      await applyVariantInventoryAdjustments(items, 'release_committed')
      return sdk.update({
        collection: 'stock-reservations',
        id: reservation.id,
        data: {
          status: 'RELEASED',
          failureReason: reason,
        },
      })
    }

    return reservation
  })
}

export async function commitVariantStockViaSdk(reservationKey: string) {
  return withInventoryLock(['__commit__', reservationKey], async () => {
    const reservation = await findStockReservation(reservationKey)
    if (!reservation) return null

    if (reservation.status === 'RESERVED') {
      const items = (reservation.items || []).map((i) => ({
        productSlug: i.productSlug,
        variantSku: i.variantSku,
        quantity: i.quantity,
      }))
      await applyVariantInventoryAdjustments(items, 'commit')
      return sdk.update({
        collection: 'stock-reservations',
        id: reservation.id,
        data: {
          status: 'COMMITTED',
        },
      })
    }

    return reservation
  })
}
