import { APIError, type CollectionBeforeChangeHook } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'

export const preventDoubleAllocationHook: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== 'create' || data?.status !== 'RESERVED') {
    return data
  }

  const items = Array.isArray(data.items)
    ? (data.items as Array<{
        productSlug?: string
        variantSku?: string
        quantity?: number
      }>)
    : []

  if (items.length === 0 || !req?.payload) {
    return data
  }

  const uniqueSkus = Array.from(
    new Set(
      items
        .map((i) => i.variantSku)
        .filter((sku): sku is string => typeof sku === 'string' && sku.length > 0),
    ),
  ).sort()

  const db = req.payload.db as unknown as {
    drizzle?: { execute?: (query: unknown) => Promise<unknown> }
    sessions?: Record<number | string, { db?: { execute?: (query: unknown) => Promise<unknown> } }>
  }

  let execClient = db?.drizzle
  if (req.transactionID != null && db?.sessions) {
    const resolvedTxId = await req.transactionID
    if (resolvedTxId != null && db.sessions[resolvedTxId]?.db) {
      execClient = db.sessions[resolvedTxId].db
    }
  }

  if (typeof execClient?.execute === 'function') {
    for (const sku of uniqueSkus) {
      try {
        await execClient.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`stock_res_${sku}`}))`)
      } catch {
        // Ignore if database engine does not support Postgres advisory locks
      }
    }
  }

  const uniqueSlugs = Array.from(
    new Set(
      items
        .map((i) => i.productSlug)
        .filter((s): s is string => typeof s === 'string' && s.length > 0),
    ),
  )

  const nowIso = new Date().toISOString()
  const [productsRes, activeReservationsRes] = await Promise.all([
    req.payload.find({
      collection: 'products',
      where: {
        slug: { in: uniqueSlugs },
      },
      limit: Math.max(uniqueSlugs.length, 50),
      req,
    }),
    req.payload.find({
      collection: 'stock-reservations',
      where: {
        status: { equals: 'RESERVED' },
        expiresAt: { greater_than: nowIso },
      },
      limit: 500,
      req,
    }),
  ])

  const activeReservedBySku = new Map<string, number>()
  for (const resDoc of activeReservationsRes.docs || []) {
    if (typeof data.reservationKey === 'string' && resDoc.reservationKey === data.reservationKey) {
      continue
    }
    for (const resItem of resDoc.items || []) {
      const qty = Number(resItem.quantity) || 0
      activeReservedBySku.set(
        resItem.variantSku,
        (activeReservedBySku.get(resItem.variantSku) ?? 0) + qty,
      )
    }
  }

  const requestedByKey = new Map<
    string,
    { productSlug: string; variantSku: string; quantity: number }
  >()
  for (const item of items) {
    if (!item.productSlug || !item.variantSku) continue
    const qty = Number(item.quantity) || 0
    const key = `${item.productSlug}::${item.variantSku}`
    const prev = requestedByKey.get(key)
    if (prev) {
      prev.quantity += qty
    } else {
      requestedByKey.set(key, {
        productSlug: item.productSlug,
        variantSku: item.variantSku,
        quantity: qty,
      })
    }
  }

  for (const reqItem of requestedByKey.values()) {
    const product = productsRes.docs.find((p) => p.slug === reqItem.productSlug)
    if (!product) {
      throw new APIError(`Product "${reqItem.productSlug}" not found.`, 404)
    }
    const variant =
      product.variants?.find((v) => v.sku === reqItem.variantSku) || product.variants?.[0]
    if (!variant) {
      throw new APIError(`Variant "${reqItem.variantSku}" not found for ${product.title}.`, 404)
    }
    const activeReservedQty = activeReservedBySku.get(variant.sku) ?? 0
    const available = Math.max(0, variant.stock - activeReservedQty)
    if (activeReservedQty + reqItem.quantity > variant.stock) {
      throw new APIError(
        `Insufficient stock for ${variant.sku} (requested ${reqItem.quantity}, only ${available} available)`,
        409,
      )
    }
  }

  return data
}
