import {
  initiatePaynowMobilePayment,
  type PaynowMobileMethod,
  type PaynowMobilePaymentItem,
} from '../../lib/paynow'

export async function initiatePaynowMobilePaymentStep(input: {
  orderId: string
  authEmail: string
  phone: string
  method: PaynowMobileMethod
  items: PaynowMobilePaymentItem[]
}) {
  'use step'
  return await initiatePaynowMobilePayment({
    reference: input.orderId,
    authEmail: input.authEmail,
    phone: input.phone,
    method: input.method,
    items: input.items,
  })
}
