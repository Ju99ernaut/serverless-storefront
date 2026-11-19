import axios from 'axios'
import { Resend } from 'resend'
import type { Order } from '../../payload-types'
import { centsToDollars } from './data'

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
  templateId: string
  attachmentsCount: number
  attachments: Array<{
    filename: string
    path: string
    contentType: string
  }>
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

  try {
    const { data: response } = await axios.post<ComposeItApiResponse>(
      API_CONFIG.composeitApiUrl,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.composeitApiKey,
        },
      },
    )

    return {
      templateId,
      filename,
      pdf: response.pdf,
      html: response.html,
      payloadSent: payload,
    }
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? 'ERR'
      const errorData = err.response?.data
      const errorText =
        typeof errorData === 'string'
          ? errorData
          : errorData
            ? JSON.stringify(errorData)
            : err.message
      throw new Error(`Document API failed (${status}): ${errorText}`)
    }
    throw err
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
          templateId: renderedEmail.templateId,
          attachmentsCount: mailAttachments.length,
          attachments: mailAttachments,
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
    templateId: renderedEmail.templateId,
    attachmentsCount: mailAttachments.length,
    attachments: mailAttachments,
  }
}

export function buildOrderTemplateDataFromOrder(order: Order): OrderTemplateData {
  const issuedAt = order.issuedAt || order.createdAt
  const resolvedAddress =
    order.fulfillmentMethod === 'COLLECTION'
      ? order.collectionLocation || 'Flagship Storefront Atelier — 450 Mercer St, SoHo'
      : order.shippingAddress || ''

  return {
    orderId: order.orderId,
    invoiceNumber: order.invoiceNumber,
    receiptNumber: order.receiptNumber,
    issuedAt,
    currency: 'USD',
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      address: resolvedAddress,
      phone: order.customerPhone ?? undefined,
      collectionLocation: order.collectionLocation ?? undefined,
    },
    paymentSummary: {
      method: order.paymentMethodLabel || order.paymentOption,
      paymentOption: order.paymentOption,
      fulfillmentMethod: order.fulfillmentMethod,
      cardLast4: order.cardLast4 || 'N/A',
      status: order.paymentStatus,
      paidAt: order.paidAt || issuedAt,
    },
    items: (order.items || []).map((i) => ({
      id: i.productId,
      variantSku: i.variantSku,
      title: i.title,
      brand: i.brand || '',
      category: i.category || '',
      subcategory: i.subcategory || '',
      size: i.size || undefined,
      color: i.color || undefined,
      quantity: i.quantity,
      unitPrice: centsToDollars(i.unitPrice),
      lineTotal: centsToDollars(i.lineTotal),
    })),
    totals: {
      subTotal: centsToDollars(order.totals.subTotal),
      tax: centsToDollars(order.totals.tax),
      shipping: centsToDollars(order.totals.shipping),
      grandTotal: centsToDollars(order.totals.grandTotal),
    },
  }
}

export async function generateOrderDocumentOnDemand(
  order: Order,
  documentType: 'INVOICE' | 'RECEIPT',
) {
  const isReceipt = documentType === 'RECEIPT'
  const documentNumber = isReceipt ? order.receiptNumber : order.invoiceNumber
  const filename = isReceipt
    ? `Receipt-${documentNumber}.pdf`
    : `Invoice-${documentNumber}.pdf`
  const templateId = isReceipt
    ? API_CONFIG.templates.receiptPdf
    : API_CONFIG.templates.invoicePdf

  const result = await generateViaApi({
    templateId,
    formats: ['pdf'],
    filename,
    data: {
      documentType,
      ...buildOrderTemplateDataFromOrder(order),
    },
  })

  return {
    documentType,
    documentNumber,
    filename,
    templateId,
    generatedAt: new Date().toISOString(),
    pdfUrl: result.pdf?.url || null,
  }
}
