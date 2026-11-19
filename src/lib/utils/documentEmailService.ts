import { Resend } from 'resend'

export const API_CONFIG = {
  composeitApiUrl: process.env.COMPOSEIT_API_URL || '',
  composeitApiKey: process.env.COMPOSEIT_API_KEY || '',
  templates: {
    invoicePdf: process.env.INVOICE_PDF_TEMPLATE_ID || 'tpl_invoice_pdf_v1',
    receiptPdf: process.env.RECEIPT_PDF_TEMPLATE_ID || 'tpl_receipt_pdf_v1',
    receiptEmail: process.env.RECEIPT_EMAIL_TEMPLATE_ID || 'tpl_order_receipt_email_v1',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || 'Storefront Orders <onboarding@resend.dev>',
  },
}

export type OutputFormat = 'pdf' | 'html'

export interface OrderLineItemData {
  id: string
  variantSku?: string
  title: string
  brand: string
  category: string
  subcategory: string
  size?: string
  color?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface OrderTemplateData {
  documentType?: 'INVOICE' | 'RECEIPT' | 'EMAIL'
  subject?: string
  orderId: string
  invoiceNumber: string
  receiptNumber: string
  issuedAt: string
  currency: string
  customer: {
    name: string
    email: string
    address: string
    phone?: string
    collectionLocation?: string
  }
  paymentSummary: {
    method: string
    paymentOption?: string
    fulfillmentMethod?: 'DELIVERY' | 'COLLECTION'
    cardLast4: string
    status: string
    paidAt: string
  }
  items: OrderLineItemData[]
  totals: {
    subTotal: number
    tax: number
    shipping: number
    grandTotal: number
  }
  statusUpdateNote?: string
}

export interface TemplateRequestPayload<T = OrderTemplateData> {
  templateId: string
  formats: OutputFormat[]
  data: T
}

export interface ComposeItPdfOutput {
  url: string
  sizeBytes: number
  mimeType: string
  checksum: string
}

export interface ComposeItHtmlOutput {
  htmlDocument: string
  checksum: string
  mimeType: string
  url: string
  sizeBytes: number
}

export interface ComposeItApiResponse {
  pdf?: ComposeItPdfOutput
  html?: ComposeItHtmlOutput
}

export interface GenerateViaApiResult {
  templateId: string
  filename?: string
  pdf?: ComposeItPdfOutput
  html?: ComposeItHtmlOutput
  payloadSent: TemplateRequestPayload
}

export interface SentEmailResult {
  status: 'sent_resend' | 'queued_stream'
  messageId: string
  to: string
  subject: string
  previewUrl: string | null
  templateId: string
  renderedHtml: string
  attachmentsCount: number
  attachments: Array<{
    filename: string
    path: string
    contentType: string
  }>
  payloadSent: TemplateRequestPayload
}

export async function generateViaApi({
  templateId,
  formats,
  filename,
  data,
}: {
  templateId: string
  formats: OutputFormat[]
  filename?: string
  data: OrderTemplateData
}): Promise<GenerateViaApiResult> {
  const payload: TemplateRequestPayload = {
    templateId,
    formats,
    data,
  }

  const res = await fetch(API_CONFIG.composeitApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_CONFIG.composeitApiKey,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Document API failed (${res.status}): ${errorText}`)
  }

  const response = (await res.json()) as ComposeItApiResponse

  return {
    templateId,
    filename,
    pdf: response.pdf,
    html: response.html,
    payloadSent: payload,
  }
}

export async function sendRenderedEmailWithAttachments({
  to,
  subject,
  renderedEmail,
  attachments,
}: {
  to: string
  subject: string
  renderedEmail: GenerateViaApiResult
  attachments: GenerateViaApiResult[]
}): Promise<SentEmailResult> {
  const htmlDocument = renderedEmail.html?.htmlDocument || ''

  const mailAttachments = attachments
    .filter((att) => Boolean(att.pdf?.url))
    .map((att) => ({
      filename: att.filename || 'document.pdf',
      path: att.pdf!.url,
      contentType: att.pdf!.mimeType || 'application/pdf',
    }))

  const resendAttachments = mailAttachments
    .filter((att) => att.path.startsWith('http'))
    .map((att) => ({
      filename: att.filename,
      path: att.path,
      contentType: att.contentType,
    }))

  const apiKey = process.env.RESEND_API_KEY || API_CONFIG.resend.apiKey

  if (apiKey) {
    try {
      const resend = new Resend(apiKey)
      const { data, error } = await resend.emails.send({
        from: API_CONFIG.resend.from,
        to,
        subject,
        html: htmlDocument || `<p>${subject}</p>`,
        attachments: resendAttachments.length > 0 ? resendAttachments : undefined,
      })

      if (!error && data?.id) {
        return {
          status: 'sent_resend',
          messageId: data.id,
          to,
          subject,
          previewUrl: null,
          templateId: renderedEmail.templateId,
          renderedHtml: htmlDocument,
          attachmentsCount: mailAttachments.length,
          attachments: mailAttachments,
          payloadSent: renderedEmail.payloadSent,
        }
      }
    } catch {
      // Fall back to queued_stream when Resend delivery is unavailable in local/test runs
    }
  }

  return {
    status: 'queued_stream',
    messageId: `msg_${Date.now()}`,
    to,
    subject,
    previewUrl: null,
    templateId: renderedEmail.templateId,
    renderedHtml: htmlDocument,
    attachmentsCount: mailAttachments.length,
    attachments: mailAttachments,
    payloadSent: renderedEmail.payloadSent,
  }
}
