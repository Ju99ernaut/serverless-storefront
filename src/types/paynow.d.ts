declare module 'paynow' {
  export type PaynowMobileMethod = 'ecocash' | 'onemoney'

  export class Payment {
    reference: string
    authEmail?: string
    constructor(reference: string, authEmail?: string)
    add(title: string, amount: number): Payment
    total(): number
    info(): string
  }

  export class InitResponse {
    status: string
    success: boolean
    hasRedirect: boolean
    isInnbucks: boolean
    error?: string
    pollUrl?: string
    redirectUrl?: string
    instructions?: string
    innbucks_info?: Array<{
      authorizationcode: string
      deep_link_url: string
      qr_code: string
      expires_at: string
    }>
    paid?: () => boolean
  }

  export class StatusResponse {
    error?: string
    reference?: string
    amount?: string
    paynowReference?: string
    pollUrl?: string
    status?: string
    paid?: () => boolean
  }

  export class Paynow {
    integrationId: string
    integrationKey: string
    resultUrl: string
    returnUrl: string

    constructor(
      integrationId?: string,
      integrationKey?: string,
      resultUrl?: string,
      returnUrl?: string,
    )

    createPayment(reference: string, authEmail?: string): Payment
    send(payment: Payment): Promise<InitResponse | null | undefined>
    sendMobile(
      payment: Payment,
      phone: string,
      method: PaynowMobileMethod,
    ): Promise<InitResponse | null | undefined>
    pollTransaction(url: string): Promise<InitResponse | StatusResponse | null | undefined>
    parseStatusUpdate(response: string): StatusResponse
  }
}
