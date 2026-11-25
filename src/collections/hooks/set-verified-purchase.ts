import { Order, Review } from '@/payload-types'
import type { CollectionBeforeChangeHook, Where } from 'payload'

function extractId(val: unknown): string | number | undefined {
  if (typeof val === 'string' || typeof val === 'number') return val
  if (val && typeof val === 'object' && 'id' in val) {
    const id = (val as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return undefined
}

function isSuccessfulOrder(order: Order): boolean {
  if (order.orderStatus === 'CANCELLED') return false
  if (order.paymentStatus === 'FAILED' || order.paymentStatus === 'REFUNDED') {
    return false
  }
  return order.paymentStatus === 'PAID' || order.orderStatus === 'COMPLETED'
}

export const setVerifiedPurchaseHook: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation !== 'create' || !req?.payload) {
    return data
  }

  const incoming = (data ?? {}) as Review
  const existing = (originalDoc ?? {}) as Review
  const reqUser = req.user as
    { id?: string | number; neonUserId?: string | null; email?: string | null } | undefined

  const productSlug = incoming.productSlug ?? existing.productSlug
  const productId = extractId(incoming.product) ?? extractId(existing.product)

  if (!productSlug && !productId) {
    return { ...data, verifiedPurchase: false }
  }

  const userId = reqUser?.id
  const neonUserId = incoming.neonUserId ?? existing.neonUserId ?? reqUser?.neonUserId
  const authorEmail = (incoming.authorEmail ?? existing.authorEmail ?? reqUser?.email ?? '')
    .trim()
    .toLowerCase()

  const customerClauses: Where[] = []
  if (userId !== undefined) {
    customerClauses.push({ user: { equals: userId } })
  }
  if (neonUserId) {
    customerClauses.push({ neonUserId: { equals: neonUserId } })
  }
  if (authorEmail) {
    customerClauses.push({ customerEmail: { equals: authorEmail } })
  }

  if (customerClauses.length === 0) {
    return { ...data, verifiedPurchase: false }
  }

  const productItemClauses: Where[] = []
  if (productSlug) {
    productItemClauses.push({ 'items.productSlug': { equals: productSlug } })
  }
  if (productId !== undefined) {
    productItemClauses.push({ 'items.productId': { equals: String(productId) } })
  }

  try {
    const ordersRes = await req.payload.find({
      collection: 'orders',
      where: {
        and: [
          { or: customerClauses },
          { or: productItemClauses },
          { orderStatus: { not_equals: 'CANCELLED' } },
        ],
      },
      limit: 25,
      overrideAccess: true,
      req,
    })

    const hasVerifiedOrder = (ordersRes.docs as Order[]).some((order) => {
      if (!isSuccessfulOrder(order)) return false

      return (order.items ?? []).some((item) => {
        const matchesSlug = Boolean(productSlug && item.productSlug === productSlug)
        const matchesId = Boolean(
          productId !== undefined && String(item.productId) === String(productId),
        )
        return matchesSlug || matchesId
      })
    })

    return {
      ...data,
      verifiedPurchase: hasVerifiedOrder,
    }
  } catch (err) {
    req.payload.logger?.error?.({
      err,
      msg: `Failed to evaluate verifiedPurchase for product "${productSlug ?? productId}"`,
    })
    return {
      ...data,
      verifiedPurchase: Boolean(incoming.verifiedPurchase ?? false),
    }
  }
}
