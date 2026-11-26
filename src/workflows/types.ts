import type { PaymentOptionType } from '../lib/utils/products'
import type { PaynowMobileMethod } from '../lib/paynow'
import type { Order } from '@/payload-types'

export type WorkflowTimeoutValue =
  number | `${number}ms` | `${number}s` | `${number}m` | `${number}h` | `${number}d`

export const WORKFLOW_TIMEOUT_DEFAULTS = {
  paymentWaitTimeout: (process.env.WORKFLOW_PAYMENT_WAIT_TIMEOUT || '5m') as WorkflowTimeoutValue,
  payOnCollectionTimeout: (process.env.WORKFLOW_PAY_ON_COLLECTION_TIMEOUT ||
    '8h') as WorkflowTimeoutValue,
  payOnDeliveryTimeout: (process.env.WORKFLOW_PAY_ON_DELIVERY_TIMEOUT ||
    '24h') as WorkflowTimeoutValue,
}

export interface OrderPaymentHookPayload {
  authorized: boolean
  cardNumber?: string
  cardholderName?: string
  mobileMethod?: PaynowMobileMethod
  mobileNumber?: string
  pollUrl?: string
  paynowReference?: string
  error?: string
}

export interface OrderFulfillmentHookPayload {
  nextStatus: Order['orderStatus']
  note?: string
  deliveryFailed?: boolean
}

export interface CheckoutWorkflowInput {
  idempotencyKey?: string
  orderId?: string
  userId?: string
  paymentOption?: PaymentOptionType
  waitForFulfillment?: boolean
  timeouts?: {
    paymentWaitTimeout?: WorkflowTimeoutValue
    payOnCollectionTimeout?: WorkflowTimeoutValue
    payOnDeliveryTimeout?: WorkflowTimeoutValue
  }
  customer: {
    name: string
    email: string
    address?: string
    phone?: string
    collectionLocation?: string
  }
  payment?: {
    provider?: 'paynow_mobile' | 'card'
    cardholderName?: string
    cardNumber?: string
    expiry?: string
    mobileMethod?: PaynowMobileMethod
    mobileNumber?: string
    pollUrl?: string
  }
  items: Array<{
    id: string
    slug?: string
    variantSku?: string
    title: string
    brand: string
    category: string
    subcategory: string
    size?: string
    color?: string
    price: number
    quantity: number
    images?: string[]
  }>
}
