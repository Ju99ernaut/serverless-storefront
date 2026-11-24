import { z } from 'zod'
import { PAYMENT_OPTIONS, type PaymentOptionType } from '../../lib/utils/data'
import type { PaynowMobileMethod } from '@/lib/paynow'

export type PaymentOptionMeta = (typeof PAYMENT_OPTIONS)[number]

export interface CheckoutPendingMobilePaymentResponse {
  success: true
  pendingPayment: true
  workflowRunId?: string
  orderId: string
  pollUrl: string
  instructions: string
  mobileMethod: PaynowMobileMethod
  mobileNumber: string
}

export interface CheckoutWorkflowResponse {
  success: true
  pendingPayment: true
  workflowRunId?: string
  orderId: string
}

export interface CheckoutSuccessResponse {
  success: boolean
  pendingPayment?: false
  reservationKey?: string
  documentHistory?: Array<{
    documentType: 'INVOICE' | 'RECEIPT'
    documentNumber: string
    filename: string
    templateId: string
    generatedAt: string
  }>
  order: {
    orderId: string
    invoiceNumber: string
    receiptNumber: string
    issuedAt: string
    paymentOption: PaymentOptionType
    fulfillmentMethod: 'DELIVERY' | 'COLLECTION'
    orderStatus: string
    paymentSummary: {
      method: string
      status: string
    }
    totals: {
      subTotal: number
      tax: number
      shipping: number
      grandTotal: number
    }
  }
  documents: {
    invoice: {
      filename: string
      templateId: string
    }
    receipt: {
      filename: string
      templateId: string
    }
  }
  email: {
    status: string
    messageId: string
    to: string
    subject: string
    templateId: string
    attachmentsCount: number
  }
}

export type CheckoutApiResponse = CheckoutWorkflowResponse | CheckoutPendingMobilePaymentResponse

export const COLLECTION_LOCATIONS = process.env.COLLECTION_LOCATIONS
  ? process.env.COLLECTION_LOCATIONS.split(',')
  : [
      'Flagship Storefront ComposeIt — 450 Mercer St, SoHo',
      'Midtown Boutique — 685 Fifth Ave, Lounge B',
      'San Francisco Jackson Square Showroom',
    ]

export const checkoutSchema = z
  .object({
    paymentOption: z.enum([
      'pay_and_delivery',
      'pay_then_collect',
      'pay_on_delivery',
      'pay_on_collection',
    ]),
    paymentProvider: z.enum(['paynow_mobile', 'card']),
    mobileMethod: z.enum(['ecocash', 'innbucks']),
    mobileNumber: z.string(),
    customerName: z
      .string()
      .trim()
      .min(2, { message: 'Please enter your full name.' })
      .max(100, { message: 'Full name must be 100 characters or fewer.' }),
    customerEmail: z.email({ message: 'Please enter a valid email address.' }),
    customerPhone: z.string().trim(),
    shippingAddress: z.string().max(300, {
      message: 'Delivery address must be 300 characters or fewer.',
    }),
    collectionLocation: z.string(),
    ccName: z.string().max(50, {
      message: 'Cardholder name must be 50 characters or fewer.',
    }),
    ccNumber: z.string(),
    ccExp: z.string(),
    ccCsc: z.string(),
  })
  .superRefine((values, ctx) => {
    const meta =
      PAYMENT_OPTIONS.find((opt) => opt.id === values.paymentOption) || PAYMENT_OPTIONS[0]

    if (meta.requiresShippingAddress && !values.shippingAddress.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['shippingAddress'],
        message: 'Please enter a delivery address.',
      })
    }

    if (!meta.requiresShippingAddress && !values.collectionLocation.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['collectionLocation'],
        message: 'Please select a collection point.',
      })
    }

    if (meta.requiresCardNow && values.paymentProvider === 'paynow_mobile') {
      const digits = values.mobileNumber.replace(/\D/g, '')
      if (digits.length < 9 || digits.length > 13) {
        ctx.addIssue({
          code: 'custom',
          path: ['mobileNumber'],
          message: 'Enter a valid mobile money number (e.g. 0777 000 000).',
        })
      }
    }

    if (meta.requiresCardNow && values.paymentProvider === 'card') {
      if (!values.ccName.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['ccName'],
          message: 'Enter the cardholder name.',
        })
      }
      if (!/^[\d ]{13,19}$/.test(values.ccNumber.trim())) {
        ctx.addIssue({
          code: 'custom',
          path: ['ccNumber'],
          message: 'Enter a valid 13–19 digit card number.',
        })
      }
      if (!/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(values.ccExp.trim())) {
        ctx.addIssue({
          code: 'custom',
          path: ['ccExp'],
          message: 'Use MM/YY.',
        })
      }
      if (!/^[0-9]{3,4}$/.test(values.ccCsc.trim())) {
        ctx.addIssue({
          code: 'custom',
          path: ['ccCsc'],
          message: '3–4 digits.',
        })
      }
    }
  })

export type CheckoutFormValues = z.infer<typeof checkoutSchema>
