import { parseWorkflowDurationMs, reserveVariantStock } from '../../lib/payload-server'
import type { CheckoutWorkflowInput, WorkflowTimeoutValue } from '../types'

export async function reserveInventoryStep(input: {
  reservationKey: string
  orderId: string
  ttlDuration: WorkflowTimeoutValue
  fallbackTtlMs: number
  rawItems: CheckoutWorkflowInput['items']
}) {
  'use step'
  const reservationItems = input.rawItems.map((item) => ({
    productSlug: item.slug || item.id,
    variantSku: item.variantSku || `${item.id.toUpperCase()}-STD-M`,
    quantity: Math.max(1, Number(item.quantity) || 1),
  }))

  const ttlMs = parseWorkflowDurationMs(input.ttlDuration, input.fallbackTtlMs)

  return await reserveVariantStock({
    reservationKey: input.reservationKey,
    orderId: input.orderId,
    ttlMs,
    items: reservationItems,
  })
}
