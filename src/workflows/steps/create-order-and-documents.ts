import {
  API_CONFIG,
  generateViaApi,
  notifyAdminOfNewOrder,
  sendRenderedEmailWithAttachments,
  type OrderTemplateData,
} from '../../lib/utils/document-email-service'
import { clearUserCartServer, createOrderServer } from '../../lib/payload-server'
import { submitFiscalReceiptIfConfigured } from '../../lib/zimra-fdms'
import {
  calculateOrderTotalsCents,
  centsToDollars,
  type PaymentOptionType,
} from '../../lib/utils/products'
import type { CheckoutWorkflowInput } from '../types'
import { calculateDeliveryFee } from '@/lib/utils/delivery-fee'

export async function createOrderAndDocumentsStep(input: {
  orderId: string
  invoiceNumber: string
  receiptNumber: string
  timestamp: string
  userId?: string
  paymentOption: PaymentOptionType
  paymentResult: {
    paymentStatus: 'PAID' | 'PENDING'
    methodLabel: string
    cardLast4: string
    fulfillmentMethod: 'DELIVERY' | 'COLLECTION'
    paidAt?: string
  }
  customer: CheckoutWorkflowInput['customer']
  items: CheckoutWorkflowInput['items']
}) {
  'use step'
  const lineItems = input.items.map((item) => {
    const unitPrice = Math.round(Number(item.price) || 0)
    const quantity = Math.max(1, Math.round(Number(item.quantity) || 1))
    const slug = item.slug || item.id
    const defaultSku = `${item.id.toUpperCase()}-STD-${item.size || 'M'}`
    return {
      id: item.id,
      productId: item.id,
      productSlug: slug,
      variantSku: item.variantSku || defaultSku,
      title: item.title,
      brand: item.brand,
      category: item.category,
      subcategory: item.subcategory,
      size: item.size || 'M',
      color: item.color || 'Signature',
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      imageUrl: item.images?.[0] || '/images/shirt.png',
    }
  })

  const calculationItems = lineItems.map((item) => ({
    unitPriceCents: item.unitPrice,
    quantity: item.quantity,
  }))
  const delivery = calculateDeliveryFee({
    items: calculationItems,
    customerAddress: input.customer.address || null,
  })
  const { subTotalCents, taxCents, shippingCents, grandTotalCents } = calculateOrderTotalsCents(
    calculationItems,
    input.paymentResult.fulfillmentMethod,
    delivery.feeCents,
  )
  const orderTotals = {
    subTotal: subTotalCents,
    tax: taxCents,
    shipping: shippingCents,
    grandTotal: grandTotalCents,
  }

  const resolvedAddress =
    input.paymentResult.fulfillmentMethod === 'COLLECTION'
      ? input.customer.collectionLocation || 'Flagship Storefront ComposeIt — 450 Mercer St, SoHo'
      : input.customer.address || ''

  // Optionally submit receipt to ZIMRA FDMS when configured (for paid orders) to attach fiscal QR code
  let fiscalReceipt = null
  if (input.paymentResult.paymentStatus === 'PAID') {
    try {
      fiscalReceipt = await submitFiscalReceiptIfConfigured({
        invoiceNo: input.invoiceNumber,
        paymentMethodLabel: input.paymentResult.methodLabel,
        paymentOption: input.paymentOption,
        currency: 'USD',
        buyer: {
          name: input.customer.name,
          email: input.customer.email,
          phone: input.customer.phone,
        },
        items: lineItems.map((item) => ({
          title: item.title,
          unitPriceCents: item.unitPrice,
          quantity: item.quantity,
        })),
        taxCents,
        shippingCents,
        grandTotalCents,
      })
    } catch (err) {
      console.error(`ZIMRA FDMS fiscalization failed for order ${input.orderId}:`, err)
    }
  }

  const sharedTemplateData: OrderTemplateData = {
    orderId: input.orderId,
    invoiceNumber: input.invoiceNumber,
    receiptNumber: input.receiptNumber,
    issuedAt: input.timestamp,
    currency: 'USD',
    customer: {
      name: input.customer.name,
      email: input.customer.email,
      address: resolvedAddress,
      phone: input.customer.phone,
      collectionLocation: input.customer.collectionLocation,
    },
    paymentSummary: {
      method: input.paymentResult.methodLabel,
      paymentOption: input.paymentOption,
      fulfillmentMethod: input.paymentResult.fulfillmentMethod,
      cardLast4: input.paymentResult.cardLast4,
      status: input.paymentResult.paymentStatus,
      paidAt: input.paymentResult.paidAt || input.timestamp,
    },
    items: lineItems.map((item) => ({
      ...item,
      unitPrice: centsToDollars(item.unitPrice),
      lineTotal: centsToDollars(item.lineTotal),
    })),
    totals: {
      subTotal: centsToDollars(subTotalCents),
      tax: centsToDollars(taxCents),
      shipping: centsToDollars(shippingCents),
      grandTotal: centsToDollars(grandTotalCents),
    },
    ...(fiscalReceipt ? { fiscal: fiscalReceipt } : {}),
  }

  const subject = `Your Storefront Order ${input.orderId} — Invoice & Receipt (${input.paymentResult.methodLabel})`

  const [invoicePdf, receiptPdf, renderedEmail] = await Promise.all([
    generateViaApi({
      templateId: API_CONFIG.templates.invoicePdf,
      formats: ['pdf'],
      filename: `Invoice-${input.invoiceNumber}.pdf`,
      data: {
        documentType: 'INVOICE',
        ...sharedTemplateData,
      },
    }),
    generateViaApi({
      templateId: API_CONFIG.templates.receiptPdf,
      formats: ['pdf'],
      filename: `Receipt-${input.receiptNumber}.pdf`,
      data: {
        documentType: 'RECEIPT',
        ...sharedTemplateData,
      },
    }),
    generateViaApi({
      templateId: API_CONFIG.templates.receiptEmail,
      formats: ['html'],
      data: {
        documentType: 'EMAIL',
        subject,
        ...sharedTemplateData,
      },
    }),
  ])

  const emailResult = await sendRenderedEmailWithAttachments({
    to: input.customer.email,
    subject,
    renderedEmail,
    attachments: [invoicePdf, receiptPdf],
  })

  const orderRecord = await createOrderServer({
    orderId: input.orderId,
    invoiceNumber: input.invoiceNumber,
    receiptNumber: input.receiptNumber,
    neonUserId: input.userId,
    issuedAt: input.timestamp,
    customerEmail: input.customer.email.trim().toLowerCase(),
    customerName: input.customer.name,
    customerPhone: input.customer.phone,
    shippingAddress: resolvedAddress,
    collectionLocation: input.customer.collectionLocation,
    paymentOption: input.paymentOption,
    paymentMethodLabel: input.paymentResult.methodLabel,
    fulfillmentMethod: input.paymentResult.fulfillmentMethod,
    paymentStatus: input.paymentResult.paymentStatus,
    orderStatus: 'CONFIRMED',
    cardLast4: input.paymentResult.cardLast4,
    paidAt: input.paymentResult.paidAt,
    items: lineItems.map((i) => ({
      productId: i.productId,
      productSlug: i.productSlug,
      variantSku: i.variantSku,
      title: i.title,
      brand: i.brand,
      category: i.category,
      subcategory: i.subcategory,
      size: i.size,
      color: i.color,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      imageUrl: i.imageUrl,
    })),
    totals: orderTotals,
    documentHistory: [
      {
        documentType: 'INVOICE',
        documentNumber: input.invoiceNumber,
        filename: invoicePdf.filename || `Invoice-${input.invoiceNumber}.pdf`,
        templateId: invoicePdf.templateId,
        generatedAt: input.timestamp,
      },
      {
        documentType: 'RECEIPT',
        documentNumber: input.receiptNumber,
        filename: receiptPdf.filename || `Receipt-${input.receiptNumber}.pdf`,
        templateId: receiptPdf.templateId,
        generatedAt: input.timestamp,
      },
    ],
    statusTimeline: [
      {
        status: 'CONFIRMED',
        label: 'Order Confirmed & Stock Reserved',
        timestamp: input.timestamp,
        note: `Fulfillment: ${input.paymentResult.fulfillmentMethod} • Payment: ${input.paymentResult.methodLabel}`,
      },
    ],
    ...(fiscalReceipt ? { fiscalReceipt } : {}),
  })

  // Notify the admin of new order via Resend
  await notifyAdminOfNewOrder(orderRecord as never).catch((err) => {
    console.error(`Failed to send new order admin notification for ${input.orderId}:`, err)
  })

  if (input.userId) {
    await clearUserCartServer(input.userId).catch(() => {})
  }

  return {
    orderRecord,
    sharedTemplateData,
    orderLineItems: lineItems,
    orderTotals,
    invoicePdf,
    receiptPdf,
    renderedEmail,
    emailResult,
  }
}
