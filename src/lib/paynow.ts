import { Paynow, type PaynowMobileMethod } from 'paynow'
import { centsToDollars } from './utils/data'
import { getSiteUrl } from './og-image'

export type { PaynowMobileMethod }

export interface PaynowMobilePaymentItem {
  title: string
  amountCents: number
}

export interface PaynowMobileInitResult {
  success: boolean
  pollUrl?: string
  instructions?: string
  status?: string
  error?: string
}

export interface PaynowPollResult {
  status: string
  paid: boolean
  failed: boolean
  pending: boolean
  paynowReference?: string
  reference?: string
  pollUrl?: string
  error?: string
}

const PAID_STATUSES = new Set(['paid', 'awaiting delivery', 'delivered'])
const FAILED_STATUSES = new Set(['cancelled', 'failed', 'disputed', 'refunded'])

export function isPaynowConfigured(): boolean {
  return Boolean(process.env.PAYNOW_INTEGRATION_ID && process.env.PAYNOW_INTEGRATION_KEY)
}

export function createPaynowClient(reference?: string): Paynow {
  const integrationId = process.env.PAYNOW_INTEGRATION_ID
  const integrationKey = process.env.PAYNOW_INTEGRATION_KEY

  if (!integrationId || !integrationKey) {
    throw new Error(
      'Paynow is not configured. Please set PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY environment variables.',
    )
  }

  const siteUrl = getSiteUrl()
  const paynow = new Paynow(integrationId, integrationKey)
  paynow.resultUrl = `${siteUrl}/api/gateways/paynow/update`
  paynow.returnUrl = reference
    ? `${siteUrl}/account?tab=orders&gateway=paynow&reference=${encodeURIComponent(reference)}`
    : `${siteUrl}/account?tab=orders&gateway=paynow`

  return paynow
}

export function normalizeZimbabwePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('263') && digits.length === 12) {
    return `0${digits.slice(3)}`
  }
  return digits
}

export async function initiatePaynowMobilePayment(params: {
  reference: string
  authEmail: string
  phone: string
  method: PaynowMobileMethod
  items: PaynowMobilePaymentItem[]
}): Promise<PaynowMobileInitResult> {
  try {
    const paynow = createPaynowClient(params.reference)
    const payment = paynow.createPayment(params.reference, params.authEmail.trim())

    for (const item of params.items) {
      const dollars = centsToDollars(item.amountCents)
      if (dollars > 0) {
        payment.add(item.title, dollars)
      }
    }

    const normalizedPhone = normalizeZimbabwePhone(params.phone)
    const response = await paynow.sendMobile(payment, normalizedPhone, params.method)

    if (!response) {
      return {
        success: false,
        error: 'Unable to reach Paynow mobile payment gateway. Please try again.',
      }
    }

    if (response.success) {
      return {
        success: true,
        pollUrl: response.pollUrl,
        instructions: response.instructions,
        status: response.status,
      }
    }

    return {
      success: false,
      status: response.status,
      error: response.error || 'Paynow mobile payment initiation failed.',
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected error initiating Paynow payment.',
    }
  }
}

export function interpretPaynowStatus(
  rawStatus?: string,
  paidFn?: () => boolean,
): {
  status: string
  paid: boolean
  failed: boolean
  pending: boolean
} {
  const normalized = (rawStatus || 'unknown').trim().toLowerCase()
  const paid = typeof paidFn === 'function' ? Boolean(paidFn()) : PAID_STATUSES.has(normalized)
  const failed = !paid && FAILED_STATUSES.has(normalized)
  const pending = !paid && !failed
  return {
    status: normalized,
    paid,
    failed,
    pending,
  }
}

export async function pollPaynowTransaction(pollUrl: string): Promise<PaynowPollResult> {
  try {
    const paynow = createPaynowClient()
    const response = await paynow.pollTransaction(pollUrl)

    if (!response) {
      return {
        status: 'error',
        paid: false,
        failed: false,
        pending: true,
        error: 'Empty status response from Paynow.',
      }
    }

    const state = interpretPaynowStatus(response.status, response.paid)
    return {
      ...state,
      paynowReference: 'paynowReference' in response ? response.paynowReference : undefined,
      reference: 'reference' in response ? response.reference : undefined,
      pollUrl: response.pollUrl || pollUrl,
      error: response.error,
    }
  } catch (err) {
    return {
      status: 'error',
      paid: false,
      failed: false,
      pending: true,
      error: err instanceof Error ? err.message : 'Unable to check Paynow transaction status.',
    }
  }
}

export function parsePaynowStatusUpdate(rawBody: string): PaynowPollResult {
  const paynow = createPaynowClient()
  const parsed = paynow.parseStatusUpdate(rawBody)
  const state = interpretPaynowStatus(parsed.status, parsed.paid)

  return {
    ...state,
    reference: parsed.reference,
    paynowReference: parsed.paynowReference,
    pollUrl: parsed.pollUrl,
    error: parsed.error,
  }
}
