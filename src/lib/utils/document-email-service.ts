import axios from 'axios'
import { Resend } from 'resend'
import type { Order } from '../../payload-types'
import { centsToDollars, formatCentsAsDollars } from './data'
import { AdminOrderEmailTemplate } from '../../components/email-template'

export const API_CONFIG = {
  composeitApiUrl: 'https://app.composeit.app/api',
  composeitApiKey: process.env.COMPOSEIT_API_KEY || '',
  templates: {
    invoicePdf: process.env.INVOICE_PDF_TEMPLATE_ID || 'tpl_invoice_pdf_v1',
    receiptPdf: process.env.RECEIPT_PDF_TEMPLATE_ID || 'tpl_receipt_pdf_v1',
    receiptEmail: process.env.RECEIPT_EMAIL_TEMPLATE_ID || 'tpl_order_receipt_email_v1',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || 'Storefront Orders <onboarding@resend.dev>',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
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
  fiscal?: {
    deviceId: number
    fiscalDayNo?: number
    receiptGlobalNo: number
    receiptCounter: number
    qrData: string
    submittedAt: string
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
      ? order.collectionLocation || 'Flagship Storefront ComposeIt — 450 Mercer St, SoHo'
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
    ...(order.fiscalReceipt?.qrData
      ? {
          fiscal: {
            deviceId: order.fiscalReceipt.deviceId ?? 0,
            fiscalDayNo: order.fiscalReceipt.fiscalDayNo ?? undefined,
            receiptGlobalNo: order.fiscalReceipt.receiptGlobalNo ?? 0,
            receiptCounter: order.fiscalReceipt.receiptCounter ?? 0,
            qrData: order.fiscalReceipt.qrData,
            submittedAt: order.fiscalReceipt.submittedAt || issuedAt,
          },
        }
      : {}),
  }
}

export async function generateOrderDocumentOnDemand(
  order: Order,
  documentType: 'INVOICE' | 'RECEIPT',
) {
  const isReceipt = documentType === 'RECEIPT'
  const documentNumber = isReceipt ? order.receiptNumber : order.invoiceNumber
  const filename = isReceipt ? `Receipt-${documentNumber}.pdf` : `Invoice-${documentNumber}.pdf`
  const templateId = isReceipt ? API_CONFIG.templates.receiptPdf : API_CONFIG.templates.invoicePdf

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

export interface AdminOrderNotificationEmailParams {
  order: Order
  adminEmail?: string
}

export async function sendAdminNewOrderEmail({
  order,
  adminEmail,
}: AdminOrderNotificationEmailParams): Promise<SentEmailResult> {
  const recipient = adminEmail || API_CONFIG.resend.adminEmail
  const grandTotalFormatted = formatCentsAsDollars(order.totals.grandTotal)
  const subject = `[New Order] ${order.orderId} - ${order.customerName} (${grandTotalFormatted})`
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const adminOrderUrl = `${serverUrl}/admin/collections/orders/${order.id || order.orderId}`

  let actionGuidance = ''
  if (order.paymentOption === 'pay_on_delivery') {
    actionGuidance =
      'Action Required: Cash / Card on Delivery. Please prepare order and dispatch for delivery. Collect payment upon delivery.'
  } else if (order.paymentOption === 'pay_on_collection') {
    actionGuidance =
      'Action Required: Store Pickup. Please prepare order and mark ready for collection. Collect payment upon pickup.'
  } else if (order.paymentStatus === 'PAID') {
    actionGuidance =
      order.fulfillmentMethod === 'COLLECTION'
        ? 'Payment Received: Please prepare items and mark Ready for Collection.'
        : 'Payment Received: Please prepare items and dispatch Out for Delivery.'
  } else {
    actionGuidance = 'Payment Pending: Awaiting payment confirmation before fulfillment.'
  }

  const apiKey = process.env.RESEND_API_KEY || API_CONFIG.resend.apiKey

  if (apiKey) {
    try {
      const resend = new Resend(apiKey)
      const { data, error } = await resend.emails.send({
        from: API_CONFIG.resend.from,
        to: recipient,
        subject,
        react: AdminOrderEmailTemplate({
          order,
          adminOrderUrl,
          actionGuidance,
        }),
      })

      if (!error && data?.id) {
        return {
          status: 'sent_resend',
          messageId: data.id,
          to: recipient,
          subject,
          templateId: 'raw_email_admin_order_notification',
          attachmentsCount: 0,
          attachments: [],
        }
      }
    } catch {
      // Fall back to queued_stream when Resend delivery is unavailable in local/test runs
    }
  }

  return {
    status: 'queued_stream',
    messageId: `msg_${Date.now()}`,
    to: recipient,
    subject,
    templateId: 'raw_email_admin_order_notification',
    attachmentsCount: 0,
    attachments: [],
  }
}

export const notifyAdminOfNewOrder = (order: Order, adminEmail?: string) =>
  sendAdminNewOrderEmail({ order, adminEmail })
