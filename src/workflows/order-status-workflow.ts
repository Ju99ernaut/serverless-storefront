import type { Order } from '@/payload-types'
import { applyOrderStatusStep } from './steps/apply-order-status'

export { applyOrderStatusStep }

export async function executeOrderStatusUpdateWorkflow(input: {
  orderId: string
  nextStatus: Order['orderStatus']
  note?: string
  deliveryFailed?: boolean
}) {
  'use workflow'
  return await applyOrderStatusStep(input)
}
