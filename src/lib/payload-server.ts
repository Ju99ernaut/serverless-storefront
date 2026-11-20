import { getPayload } from 'payload'
import config from '@payload-config'
import type { Order, Product, StockReservation } from '../payload-types'
import { generateOrderDocumentOnDemand } from './utils/document-email-service'

export async function getServerPayload() {
  return getPayload({ config })
}

const inventoryLockChains = new Map<string, Promise<void>>()

async function acquireSingleLock(key: string) {
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

export function parseWorkflowDurationMs(duration: string | number | undefined, fallbackMs: number) {
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

export async function getOrderByOrderIdServer(orderId: string) {
  if (!orderId) return null
  try {
    const payload = await getServerPayload()
    const res = await payload.find({
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

export async function createOrderServer(data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) {
  const payload = await getServerPayload()
  return payload.create({
    collection: 'orders',
    data,
  })
}

export async function updateOrderServer(
  id: number,
  data: Partial<Omit<Order, 'id' | 'createdAt' | 'updatedAt'>>,
) {
  const payload = await getServerPayload()
  return payload.update({
    collection: 'orders',
    id,
    data,
  })
}

export async function generateAndRecordOrderDocumentServer(params: {
  orderId: string
  documentType: 'INVOICE' | 'RECEIPT'
}) {
  const order = await getOrderByOrderIdServer(params.orderId)
  if (!order) {
    throw new Error(`Order ${params.orderId} not found.`)
  }

  const generated = await generateOrderDocumentOnDemand(order, params.documentType)
  const existingHistory = (order.documentHistory || []).map((entry) => ({
    documentType: entry.documentType,
    documentNumber: entry.documentNumber,
    filename: entry.filename,
    templateId: entry.templateId,
    generatedAt: entry.generatedAt,
  }))

  const nextHistory = [
    ...existingHistory,
    {
      documentType: generated.documentType,
      documentNumber: generated.documentNumber,
      filename: generated.filename,
      templateId: generated.templateId,
      generatedAt: generated.generatedAt,
    },
  ]

  const updatedOrder = await updateOrderServer(order.id, {
    documentHistory: nextHistory,
  })

  return {
    order: updatedOrder,
    document: generated,
  }
}

export async function clearUserCartServer(neonUserId: string) {
  if (!neonUserId) return
  try {
    const payload = await getServerPayload()
    const res = await payload.find({
      collection: 'carts',
      where: {
        neonUserId: {
          equals: neonUserId,
        },
      },
      limit: 1,
    })
    const existing = res.docs?.[0]
    if (existing) {
      await payload.update({
        collection: 'carts',
        id: existing.id,
        data: {
          items: [],
        },
      })
    }
  } catch (error) {
    console.error(`Failed to clear cart for "${neonUserId}":`, error)
  }
}

function stripVariantIds(variants: NonNullable<Product['variants']>) {
  return variants.map((v) => {
    const { id: _, ...rest } = v
    return rest
  })
}

async function applyVariantInventoryAdjustments(
  items: Array<{ productSlug: string; variantSku: string; quantity: number }>,
  mode: 'reserve' | 'release_reserved' | 'release_committed' | 'commit',
) {
  const uniqueSlugs = Array.from(new Set(items.map((i) => i.productSlug)))
  if (uniqueSlugs.length === 0) return

  const payload = await getServerPayload()
  const productsRes = await payload.find({
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
      await payload.update({
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
    const payload = await getServerPayload()
    const nowIso = new Date().toISOString()
    const res = await payload.find({
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
      await payload.update({
        collection: 'stock-reservations',
        id: reservation.id,
        data: { status: 'EXPIRED' },
      })
    }
  } catch (error) {
    console.error('Failed to expire stale reservations:', error)
  }
}

export async function expireStaleReservations() {
  return withInventoryLock(['__expire__'], () => expireStaleReservationsUnlocked())
}

export async function reserveVariantStock(params: {
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

    const payload = await getServerPayload()
    const existingRes = await payload.find({
      collection: 'stock-reservations',
      where: {
        reservationKey: { equals: params.reservationKey },
      },
      limit: 1,
    })
    const existing = existingRes.docs?.[0] || undefined
    if (existing && existing.status === 'RESERVED') {
      return { success: true, reservation: existing }
    }

    const nowIso = new Date().toISOString()
    const uniqueSlugs = Array.from(new Set(productSlugs))
    const [productsRes, activeReservationsRes] = await Promise.all([
      payload.find({
        collection: 'products',
        where: {
          slug: { in: uniqueSlugs },
        },
        limit: 100,
      }),
      payload.find({
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
      reservation = await payload.create({
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
      await payload
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
  const payload = await getServerPayload()
  const normalizedOrderId = reservationKeyOrOrderId.replace(/^res_/, '')
  const existingRes = await payload.find({
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

export async function releaseVariantStock(
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

    const payload = await getServerPayload()
    if (reservation.status === 'RESERVED') {
      await applyVariantInventoryAdjustments(items, 'release_reserved')
      return payload.update({
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
      return (await payload.update({
        collection: 'stock-reservations',
        id: reservation.id,
        data: {
          status: 'RELEASED',
          failureReason: reason,
        },
      })) as StockReservation
    }

    return reservation
  })
}

export async function commitVariantStock(reservationKey: string): Promise<StockReservation | null> {
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
      const payload = await getServerPayload()
      return payload.update({
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

export async function getProductBySlugServer(slug: string): Promise<Product | null> {
  if (!slug) return null
  try {
    const payload = await getServerPayload()
    const bySlug = await payload.find({
      collection: 'products',
      where: {
        slug: {
          equals: slug,
        },
      },
      limit: 1,
    })
    if (bySlug.docs?.[0]) {
      return bySlug.docs[0]
    }

    if (/^\d+$/.test(slug)) {
      const byId = await payload.find({
        collection: 'products',
        where: {
          id: {
            equals: Number(slug),
          },
        },
        limit: 1,
      })
      return byId.docs?.[0] || null
    }

    return null
  } catch (error) {
    console.error(`Failed to fetch product "${slug}" on server:`, error)
    return null
  }
}

export async function getFeaturedProductServer(): Promise<Product | null> {
  try {
    const payload = await getServerPayload()
    const featured = await payload.find({
      collection: 'products',
      where: {
        size: {
          equals: 'large',
        },
      },
      sort: '-averageRating',
      limit: 1,
    })
    if (featured.docs?.[0]) {
      return featured.docs[0]
    }

    const fallback = await payload.find({
      collection: 'products',
      sort: '-averageRating',
      limit: 1,
    })
    return fallback.docs?.[0] || null
  } catch (error) {
    console.error('Failed to fetch featured product on server:', error)
    return null
  }
}
