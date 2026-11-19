import {
  API_CONFIG,
  generateViaApi,
  sendRenderedEmailWithAttachments,
  OrderTemplateData,
} from '../lib/utils/documentEmailService'
import {
  getRuntimeStore,
  getPayloadIfAvailable,
  reserveVariantStockAtomic,
  releaseVariantStockAtomic,
  commitVariantStockAtomic,
} from '../lib/storefront-db'
import { PAYMENT_OPTIONS, PaymentOptionType, StoreOrderRecord } from '../data/utils'

export interface CheckoutWorkflowInput {
  idempotencyKey?: string
  userId?: string
  paymentOption?: PaymentOptionType
  simulatePaymentFailure?: boolean
  customer: {
    name: string
    email: string
    address?: string
    phone?: string
    collectionLocation?: string
  }
  payment?: {
    cardholderName?: string
    cardNumber?: string
    expiry?: string
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

async function reserveInventoryStep(input: {
  reservationKey: string
  orderId: string
  rawItems: CheckoutWorkflowInput['items']
}) {
  'use step'
  const store = getRuntimeStore()
  const reservationItems = input.rawItems.map((item) => {
    const matchedProd = store.products.find(
      (p) => p.id === item.id || p.slug === item.slug || p.slug === item.id,
    )
    const defaultVariant = matchedProd?.variants[0]
    return {
      productSlug: matchedProd?.slug || item.slug || item.id,
      variantSku: item.variantSku || defaultVariant?.sku || `${item.id.toUpperCase()}-STD-M`,
      quantity: Math.max(1, Number(item.quantity) || 1),
    }
  })

  const result = reserveVariantStockAtomic({
    reservationKey: input.reservationKey,
    orderId: input.orderId,
    items: reservationItems,
  })

  if (result.success && result.reservation) {
    const payload = await getPayloadIfAvailable()
    if (payload) {
      await payload
        .create({
          collection: 'stock-reservations',
          data: {
            reservationKey: result.reservation.reservationKey,
            orderId: input.orderId,
            status: 'RESERVED',
            expiresAt: result.reservation.expiresAt,
            items: result.reservation.items,
          },
        })
        .catch(() => {})
    }
  }

  return result
}

async function releaseReservedStockStep(input: { reservationKey: string; reason: string }) {
  'use step'
  const released = releaseVariantStockAtomic(input.reservationKey, input.reason)
  const payload = await getPayloadIfAvailable()
  if (payload && released) {
    await payload
      .update({
        collection: 'stock-reservations',
        where: {
          reservationKey: { equals: input.reservationKey },
        },
        data: {
          status: 'RELEASED',
          failureReason: input.reason,
        },
      })
      .catch(() => {})
  }
  return {
    released: Boolean(released),
    reservationKey: input.reservationKey,
    reason: input.reason,
  }
}

async function processPaymentTransactionStep(input: {
  paymentOption: PaymentOptionType
  cardNumber?: string
  simulatePaymentFailure?: boolean
  grandTotal: number
}) {
  'use step'
  const optionMeta = PAYMENT_OPTIONS.find((o) => o.id === input.paymentOption) || PAYMENT_OPTIONS[0]

  const cleanCard = (input.cardNumber || '').replace(/\D/g, '')
  const cardLast4 = cleanCard.slice(-4) || (optionMeta.requiresCardNow ? '4242' : 'N/A')

  if (optionMeta.requiresCardNow) {
    if (input.simulatePaymentFailure || cleanCard.endsWith('0000')) {
      return {
        authorized: false,
        paymentStatus: 'FAILED' as const,
        methodLabel: `${optionMeta.shortLabel} (Card •••• ${cardLast4})`,
        cardLast4,
        fulfillmentMethod: optionMeta.fulfillmentMethod,
        error:
          'Payment authorization declined by card issuer. Reserved stock has been automatically released back to inventory.',
      }
    }

    return {
      authorized: true,
      paymentStatus: 'PAID' as const,
      methodLabel: `${optionMeta.shortLabel} (Card •••• ${cardLast4})`,
      cardLast4,
      fulfillmentMethod: optionMeta.fulfillmentMethod,
      paidAt: new Date().toISOString(),
    }
  }

  // Pay on Delivery or Pay on Collection
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

async function commitOrderAndDocumentsStep(input: {
  reservationKey: string
  orderId: string
  invoiceNumber: string
  receiptNumber: string
  timestamp: string
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
  commitVariantStockAtomic(input.reservationKey)

  const lineItems = input.items.map((item) => {
    const unitPrice = Number(item.price) || 0
    const quantity = Number(item.quantity) || 1
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
      lineTotal: Number((unitPrice * quantity).toFixed(2)),
      imageUrl: item.images?.[0] || '/images/shirt.png',
    }
  })

  const subTotal = Number(lineItems.reduce((acc, item) => acc + item.lineTotal, 0).toFixed(2))
  const taxRate = 0.08
  const tax = Number((subTotal * taxRate).toFixed(2))
  const shipping = input.paymentResult.fulfillmentMethod === 'DELIVERY' ? 12 : 0
  const grandTotal = Number((subTotal + tax + shipping).toFixed(2))

  const resolvedAddress =
    input.paymentResult.fulfillmentMethod === 'COLLECTION'
      ? input.customer.collectionLocation || 'Flagship Storefront Atelier — 450 Mercer St, SoHo'
      : input.customer.address || ''

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
    items: lineItems,
    totals: {
      subTotal,
      tax,
      shipping,
      grandTotal,
    },
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

  const initialStatus =
    input.paymentResult.fulfillmentMethod === 'COLLECTION' ? 'READY_FOR_COLLECTION' : 'CONFIRMED'

  const orderRecord: StoreOrderRecord = {
    id: `ord_${Date.now()}`,
    orderId: input.orderId,
    invoiceNumber: input.invoiceNumber,
    receiptNumber: input.receiptNumber,
    customerEmail: input.customer.email,
    customerName: input.customer.name,
    customerPhone: input.customer.phone,
    shippingAddress: resolvedAddress,
    collectionLocation: input.customer.collectionLocation,
    paymentOption: input.paymentOption,
    paymentMethodLabel: input.paymentResult.methodLabel,
    fulfillmentMethod: input.paymentResult.fulfillmentMethod,
    paymentStatus: input.paymentResult.paymentStatus,
    orderStatus: initialStatus,
    cardLast4: input.paymentResult.cardLast4,
    paidAt: input.paymentResult.paidAt,
    issuedAt: input.timestamp,
    createdAt: input.timestamp,
    items: lineItems,
    totals: sharedTemplateData.totals,
    documents: {
      invoiceFilename: invoicePdf.filename,
      invoiceTemplateId: invoicePdf.templateId,
      invoicePdfUrl: invoicePdf.pdf?.url,
      receiptFilename: receiptPdf.filename,
      receiptTemplateId: receiptPdf.templateId,
      receiptPdfUrl: receiptPdf.pdf?.url,
      emailStatus: emailResult.status,
      emailMessageId: emailResult.messageId,
      emailPreviewUrl: emailResult.previewUrl,
      emailTemplateId: emailResult.templateId,
      renderedHtml: emailResult.renderedHtml,
      payloadPreviewJson: {
        invoicePdfApiPost: invoicePdf.payloadSent,
        receiptPdfApiPost: receiptPdf.payloadSent,
        emailTemplateApiPost: emailResult.payloadSent,
      },
    },
    statusTimeline: [
      {
        status: 'CONFIRMED',
        label: 'Order Confirmed & Stock Allocated',
        timestamp: input.timestamp,
        note: `Fulfillment: ${input.paymentResult.fulfillmentMethod} • Payment: ${input.paymentResult.methodLabel}`,
        emailSent: true,
      },
    ],
  }

  const store = getRuntimeStore()
  store.orders.unshift(orderRecord)

  // Clear saved cart for this user if registered
  const matchedUser = store.users.find(
    (u) => u.email.toLowerCase() === input.customer.email.toLowerCase(),
  )
  if (matchedUser) {
    matchedUser.savedCart = []
  }

  const payload = await getPayloadIfAvailable()
  if (payload) {
    await payload
      .create({
        collection: 'orders',
        data: {
          orderId: orderRecord.orderId,
          invoiceNumber: orderRecord.invoiceNumber,
          receiptNumber: orderRecord.receiptNumber,
          customerEmail: orderRecord.customerEmail,
          customerName: orderRecord.customerName,
          customerPhone: orderRecord.customerPhone,
          shippingAddress: orderRecord.shippingAddress,
          collectionLocation: orderRecord.collectionLocation,
          paymentOption: orderRecord.paymentOption,
          paymentMethodLabel: orderRecord.paymentMethodLabel,
          fulfillmentMethod: orderRecord.fulfillmentMethod,
          paymentStatus: orderRecord.paymentStatus,
          orderStatus: orderRecord.orderStatus,
          cardLast4: orderRecord.cardLast4,
          paidAt: orderRecord.paidAt,
          items: orderRecord.items,
          totals: orderRecord.totals,
          documents: {
            invoiceFilename: orderRecord.documents.invoiceFilename,
            invoiceTemplateId: orderRecord.documents.invoiceTemplateId,
            invoicePdfUrl: orderRecord.documents.invoicePdfUrl,
            receiptFilename: orderRecord.documents.receiptFilename,
            receiptTemplateId: orderRecord.documents.receiptTemplateId,
            receiptPdfUrl: orderRecord.documents.receiptPdfUrl,
            emailStatus: orderRecord.documents.emailStatus,
            emailMessageId: orderRecord.documents.emailMessageId,
            emailPreviewUrl: orderRecord.documents.emailPreviewUrl || undefined,
            emailTemplateId: orderRecord.documents.emailTemplateId,
            payloadPreviewJson: orderRecord.documents.payloadPreviewJson as Record<string, unknown>,
          },
          statusTimeline: orderRecord.statusTimeline,
        },
      })
      .catch(() => {})
  }

  return {
    orderRecord,
    sharedTemplateData,
    invoicePdf,
    receiptPdf,
    renderedEmail,
    emailResult,
  }
}

/**
 * Durable serverless checkout workflow using the `workflow` SDK.
 * Coordinates atomic stock reservation, payment authorization, rollback on failure,
 * order persistence, and ComposeIt PDF/HTML email dispatch.
 */
export async function executeDurableCheckoutWorkflow(input: CheckoutWorkflowInput) {
  'use workflow'

  const timestamp = new Date().toISOString()
  const shortId = Math.floor(100000 + Math.random() * 900000)
  const orderId = `ORD-${shortId}`
  const invoiceNumber = `INV-${shortId}`
  const receiptNumber = `RCP-${shortId}`
  const reservationKey = input.idempotencyKey || `res_${orderId}`
  const paymentOption: PaymentOptionType = input.paymentOption || 'pay_and_delivery'

  // Step 1: Reserve Stock Atomically
  const reservationOutcome = await reserveInventoryStep({
    reservationKey,
    orderId,
    rawItems: input.items,
  })

  if (!reservationOutcome.success) {
    return {
      success: false as const,
      status: 409,
      error: reservationOutcome.error || 'Insufficient stock for checkout.',
      insufficientItems: reservationOutcome.insufficientItems,
      stockReleased: false,
    }
  }

  // Step 2: Process Payment (or Reserve for Pay-on-Delivery / Pay-on-Collection)
  const subTotal = input.items.reduce(
    (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1),
    0,
  )
  const deliveryFee =
    paymentOption === 'pay_and_delivery' || paymentOption === 'pay_on_delivery' ? 12 : 0
  const grandTotal = Number((subTotal * 1.08 + deliveryFee).toFixed(2))

  const paymentOutcome = await processPaymentTransactionStep({
    paymentOption,
    cardNumber: input.payment?.cardNumber,
    simulatePaymentFailure: input.simulatePaymentFailure,
    grandTotal,
  })

  if (!paymentOutcome.authorized || paymentOutcome.paymentStatus === 'FAILED') {
    // Compensation Step: Release reserved stock immediately
    await releaseReservedStockStep({
      reservationKey,
      reason: paymentOutcome.error || 'Payment failed',
    })

    return {
      success: false as const,
      status: 402,
      error: paymentOutcome.error || 'Payment failed; reserved stock released.',
      stockReleased: true,
      reservationKey,
    }
  }

  try {
    // Step 3 & 4: Commit Order, Decrement Stock, Generate PDFs & Send Email
    const committed = await commitOrderAndDocumentsStep({
      reservationKey,
      orderId,
      invoiceNumber,
      receiptNumber,
      timestamp,
      paymentOption,
      paymentResult: {
        paymentStatus: paymentOutcome.paymentStatus,
        methodLabel: paymentOutcome.methodLabel,
        cardLast4: paymentOutcome.cardLast4,
        fulfillmentMethod: paymentOutcome.fulfillmentMethod,
        paidAt: paymentOutcome.paidAt,
      },
      customer: input.customer,
      items: input.items,
    })

    return {
      success: true as const,
      status: 200,
      reservationKey,
      order: {
        orderId,
        invoiceNumber,
        receiptNumber,
        issuedAt: timestamp,
        paymentOption,
        fulfillmentMethod: paymentOutcome.fulfillmentMethod,
        orderStatus: committed.orderRecord.orderStatus,
        customer: committed.sharedTemplateData.customer,
        paymentSummary: committed.sharedTemplateData.paymentSummary,
        items: committed.sharedTemplateData.items,
        totals: committed.sharedTemplateData.totals,
      },
      documents: {
        invoice: {
          filename: committed.invoicePdf.filename,
          templateId: committed.invoicePdf.templateId,
          pdf: committed.invoicePdf.pdf,
          payloadSent: committed.invoicePdf.payloadSent,
        },
        receipt: {
          filename: committed.receiptPdf.filename,
          templateId: committed.receiptPdf.templateId,
          pdf: committed.receiptPdf.pdf,
          payloadSent: committed.receiptPdf.payloadSent,
        },
      },
      email: {
        status: committed.emailResult.status,
        messageId: committed.emailResult.messageId,
        to: committed.emailResult.to,
        subject: committed.emailResult.subject,
        previewUrl: committed.emailResult.previewUrl,
        templateId: committed.emailResult.templateId,
        attachmentsCount: committed.emailResult.attachmentsCount,
        attachments: committed.emailResult.attachments,
        renderedHtml: committed.emailResult.renderedHtml,
        html: committed.renderedEmail.html,
        payloadSent: committed.emailResult.payloadSent,
      },
    }
  } catch (err) {
    await releaseReservedStockStep({
      reservationKey,
      reason: err instanceof Error ? err.message : 'Unexpected error during order commit',
    })
    throw err
  }
}
