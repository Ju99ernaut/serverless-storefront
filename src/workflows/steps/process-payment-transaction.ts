import { PAYMENT_OPTIONS, type PaymentOptionType } from '../../lib/utils/data'
import type { PaynowMobileMethod } from '../../lib/paynow'

export async function processPaymentTransactionStep(input: {
  paymentOption: PaymentOptionType
  cardNumber?: string
  mobileMethod?: PaynowMobileMethod
  mobileNumber?: string
  authorized?: boolean
  grandTotal: number
  customError?: string
}) {
  'use step'
  const optionMeta = PAYMENT_OPTIONS.find((o) => o.id === input.paymentOption) || PAYMENT_OPTIONS[0]

  const isMobilePayment = Boolean(input.mobileMethod || input.mobileNumber)
  const cleanCard = (input.cardNumber || '').replace(/\D/g, '')
  const cleanMobile = (input.mobileNumber || '').replace(/\D/g, '')

  const mobileLabel = input.mobileMethod === 'ecocash' ? 'EcoCash' : 'InnBucks'
  const last4 = isMobilePayment ? cleanMobile.slice(-4) || 'MOBILE' : cleanCard.slice(-4) || 'N/A'

  const methodLabel = isMobilePayment
    ? `${optionMeta.shortLabel} (${mobileLabel} •••• ${last4})`
    : `${optionMeta.shortLabel} (Card •••• ${last4})`

  if (optionMeta.requiresCardNow) {
    if (input.authorized === false) {
      return {
        authorized: false,
        paymentStatus: 'FAILED' as const,
        methodLabel,
        cardLast4: last4,
        fulfillmentMethod: optionMeta.fulfillmentMethod,
        error:
          input.customError ||
          'Payment authorization declined. Reserved stock has been automatically released back to inventory.',
      }
    }

    return {
      authorized: true,
      paymentStatus: 'PAID' as const,
      methodLabel,
      cardLast4: last4,
      fulfillmentMethod: optionMeta.fulfillmentMethod,
      paidAt: new Date().toISOString(),
    }
  }

  return {
    authorized: true,
    paymentStatus: 'PENDING' as const,
    methodLabel:
      input.paymentOption === 'pay_on_delivery'
        ? 'Pay on Delivery (Cash/Card on Courier Arrival)'
        : 'Pay on Collection (In-Store Payment at Pickup)',
    cardLast4: 'PAY-LATER',
    fulfillmentMethod: optionMeta.fulfillmentMethod,
    paidAt: 'Due upon ' + (optionMeta.fulfillmentMethod === 'DELIVERY' ? 'delivery' : 'collection'),
  }
}
