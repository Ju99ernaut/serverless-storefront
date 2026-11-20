import { defineHook, sleep } from 'workflow'
import { start } from 'workflow/api'
import {
  API_CONFIG,
  generateViaApi,
  sendRenderedEmailWithAttachments,
  type OrderTemplateData,
} from '../lib/utils/document-email-service'
import {
  clearUserCartServer,
  commitVariantStock,
  createOrderServer,
  parseWorkflowDurationMs,
  releaseVariantStock,
  reserveVariantStock,
} from '../lib/payload-server'
import {
  PAYMENT_OPTIONS,
  calculateOrderTotalsCents,
  centsToDollars,
  type Order,
  type PaymentOptionType,
} from '../lib/utils/data'
import { applyOrderStatusStep } from './order-status-workflow'

export type WorkflowTimeoutValue =
  number | `${number}ms` | `${number}s` | `${number}m` | `${number}h` | `${number}d`

export const WORKFLOW_TIMEOUT_DEFAULTS = {
  paymentWaitTimeout: (process.env.WORKFLOW_PAYMENT_WAIT_TIMEOUT || '30m') as WorkflowTimeoutValue,
  payOnCollectionTimeout: (process.env.WORKFLOW_PAY_ON_COLLECTION_TIMEOUT ||
    '8h') as WorkflowTimeoutValue,
  payOnDeliveryTimeout: (process.env.WORKFLOW_PAY_ON_DELIVERY_TIMEOUT ||
    '24h') as WorkflowTimeoutValue,
}

function sleepForTimeout(timeout: WorkflowTimeoutValue): Promise<void> {
  return typeof timeout === 'number' ? sleep(timeout) : sleep(timeout)
}

export interface OrderPaymentHookPayload {
  authorized: boolean
  cardNumber?: string
  cardholderName?: string
  simulatePaymentFailure?: boolean
  error?: string
}

export interface OrderFulfillmentHookPayload {
  nextStatus: Order['orderStatus']
  note?: string
  deliveryFailed?: boolean
}

export function getOrderPaymentHookToken(orderId: string): string {
  return `order-payment:${orderId}`
}

export function getOrderFulfillmentHookToken(orderId: string): string {
  return `order-fulfillment:${orderId}`
}

export const orderPaymentHook = defineHook<OrderPaymentHookPayload>()
export const orderFulfillmentHook = defineHook<OrderFulfillmentHookPayload>()

export interface CheckoutWorkflowInput {
  idempotencyKey?: string
  orderId?: string
  userId?: string
  paymentOption?: PaymentOptionType
  simulatePaymentFailure?: boolean
  simulatePaymentTimeout?: boolean
  awaitPaymentHook?: boolean
  waitForFulfillment?: boolean
  timeouts?: {
    paymentWaitTimeout?: WorkflowTimeoutValue
    payOnCollectionTimeout?: WorkflowTimeoutValue
    payOnDeliveryTimeout?: WorkflowTimeoutValue
  }
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
  ttlDuration: WorkflowTimeoutValue
  fallbackTtlMs: number
  rawItems: CheckoutWorkflowInput['items']
}) {
  'use step'
  const reservationItems = input.rawItems.map((item) => ({
    productSlug: item.slug || item.id,
    variantSku: item.variantSku || `${item.id.toUpperCase()}-STD-M`,
    quantity: Math.max(1, Number(item.quantity) || 1),
  }))

  const ttlMs = parseWorkflowDurationMs(input.ttlDuration, input.fallbackTtlMs)

  return await reserveVariantStock({
    reservationKey: input.reservationKey,
    orderId: input.orderId,
    ttlMs,
    items: reservationItems,
  })
}

async function releaseReservedStockStep(input: { reservationKey: string; reason: string }) {
  'use step'
  const released = await releaseVariantStock(input.reservationKey, input.reason)
  return {
    released: Boolean(released),
    reservationKey: input.reservationKey,
    reason: input.reason,
  }
}

async function commitOrderStockStep(input: { reservationKey: string }) {
  'use step'
  const committed = await commitVariantStock(input.reservationKey)
  return {
    committed: Boolean(committed),
    reservationKey: input.reservationKey,
  }
}

async function processPaymentTransactionStep(input: {
  paymentOption: PaymentOptionType
  cardNumber?: string
  simulatePaymentFailure?: boolean
  grandTotal: number
  customError?: string
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
          input.customError ||
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

async function createOrderAndDocumentsStep(input: {
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

  const { subTotalCents, taxCents, shippingCents, grandTotalCents } = calculateOrderTotalsCents(
    lineItems.map((item) => ({ unitPriceCents: item.unitPrice, quantity: item.quantity })),
    input.paymentResult.fulfillmentMethod,
  )
  const orderTotals = {
    subTotal: subTotalCents,
    tax: taxCents,
    shipping: shippingCents,
    grandTotal: grandTotalCents,
  }

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

async function runOrderFulfillmentLoop(params: {
  orderId: string
  reservationKey: string
  paymentOption: PaymentOptionType
  fulfillmentTimeout?: WorkflowTimeoutValue
}) {
  using fulfillmentHook = orderFulfillmentHook.create({
    token: getOrderFulfillmentHookToken(params.orderId),
  })

  const deadlinePromise = params.fulfillmentTimeout
    ? sleepForTimeout(params.fulfillmentTimeout).then(() => ({ timedOut: true as const }))
    : null

  const iterator = fulfillmentHook[Symbol.asyncIterator]()
  while (true) {
    const nextPromise = iterator
      .next()
      .then((res) =>
        res.done ? { timedOut: true as const } : { timedOut: false as const, event: res.value },
      )

    const outcome = deadlinePromise
      ? await Promise.race([nextPromise, deadlinePromise])
      : await nextPromise

    if (outcome.timedOut) {
      const timeoutReason = `Reservation window (${String(params.fulfillmentTimeout)}) expired; reserved stock released.`
      await releaseReservedStockStep({
        reservationKey: params.reservationKey,
        reason: timeoutReason,
      })
      await applyOrderStatusStep({
        orderId: params.orderId,
        nextStatus: 'CANCELLED',
        note: timeoutReason,
        releaseStock: false,
      })
      return {
        orderId: params.orderId,
        finalStatus: 'CANCELLED' as const,
        stockCommitted: false,
        stockReleased: true,
        timedOut: true,
      }
    }

    const { event } = outcome
    const effectiveStatus: Order['orderStatus'] = event.deliveryFailed
      ? 'CANCELLED'
      : event.nextStatus

    if (effectiveStatus === 'CANCELLED') {
      const cancelReason =
        event.note ||
        (event.deliveryFailed
          ? 'Delivery failed; reserved stock released.'
          : 'Order cancelled; reserved stock released.')
      await releaseReservedStockStep({
        reservationKey: params.reservationKey,
        reason: cancelReason,
      })
      await applyOrderStatusStep({
        orderId: params.orderId,
        nextStatus: 'CANCELLED',
        note: cancelReason,
        deliveryFailed: event.deliveryFailed,
        releaseStock: false,
      })
      return {
        orderId: params.orderId,
        finalStatus: 'CANCELLED' as const,
        stockCommitted: false,
        stockReleased: true,
        timedOut: false,
      }
    }

    if (
      (params.paymentOption === 'pay_then_collect' &&
        (effectiveStatus === 'READY_FOR_COLLECTION' || effectiveStatus === 'COMPLETED')) ||
      effectiveStatus === 'COMPLETED'
    ) {
      await commitOrderStockStep({ reservationKey: params.reservationKey })
      await applyOrderStatusStep({
        orderId: params.orderId,
        nextStatus: effectiveStatus,
        note: event.note,
        commitStock: false,
      })
      return {
        orderId: params.orderId,
        finalStatus: effectiveStatus,
        stockCommitted: true,
        stockReleased: false,
        timedOut: false,
      }
    }

    await applyOrderStatusStep({
      orderId: params.orderId,
      nextStatus: effectiveStatus,
      note: event.note,
    })
  }
}

export async function executeOrderFulfillmentWorkflow(params: {
  orderId: string
  reservationKey: string
  paymentOption: PaymentOptionType
  fulfillmentTimeout?: WorkflowTimeoutValue
}) {
  'use workflow'
  return await runOrderFulfillmentLoop(params)
}

/**
 * Durable serverless checkout workflow using the `workflow` SDK.
 * Coordinates atomic stock reservation, configurable payment & fulfillment windows,
 * ComposeIt PDF/HTML email dispatch, and stock deduction or release on timeout/failure.
 */
export async function executeDurableCheckoutWorkflow(input: CheckoutWorkflowInput) {
  'use workflow'

  const timestamp = new Date().toISOString()
  const shortId = Math.floor(100000 + Math.random() * 900000)
  const orderId = input.orderId || `ORD-${shortId}`
  const invoiceNumber = `INV-${shortId}`
  const receiptNumber = `RCP-${shortId}`
  const reservationKey = input.idempotencyKey || `res_${orderId}`
  const paymentOption: PaymentOptionType = input.paymentOption || 'pay_and_delivery'
  const optionMeta = PAYMENT_OPTIONS.find((o) => o.id === paymentOption) || PAYMENT_OPTIONS[0]

  const paymentWaitTimeout: WorkflowTimeoutValue =
    input.timeouts?.paymentWaitTimeout ?? WORKFLOW_TIMEOUT_DEFAULTS.paymentWaitTimeout
  const payOnCollectionTimeout: WorkflowTimeoutValue =
    input.timeouts?.payOnCollectionTimeout ?? WORKFLOW_TIMEOUT_DEFAULTS.payOnCollectionTimeout
  const payOnDeliveryTimeout: WorkflowTimeoutValue =
    input.timeouts?.payOnDeliveryTimeout ?? WORKFLOW_TIMEOUT_DEFAULTS.payOnDeliveryTimeout

  const initialReservationTtl: WorkflowTimeoutValue =
    paymentOption === 'pay_on_collection'
      ? payOnCollectionTimeout
      : paymentOption === 'pay_on_delivery'
        ? payOnDeliveryTimeout
        : paymentWaitTimeout

  const fallbackTtlMs =
    paymentOption === 'pay_on_collection'
      ? 8 * 60 * 60 * 1000
      : paymentOption === 'pay_on_delivery'
        ? 24 * 60 * 60 * 1000
        : 30 * 60 * 1000

  // Step 1: Reserve Stock Atomically
  const reservationOutcome = await reserveInventoryStep({
    reservationKey,
    orderId,
    ttlDuration: initialReservationTtl,
    fallbackTtlMs,
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

  // Step 2: Process / Wait for Payment (30m configurable window for pay_and_delivery & pay_then_collect)
  const { grandTotalCents: grandTotal } = calculateOrderTotalsCents(
    input.items.map((i) => ({
      unitPriceCents: Math.round(Number(i.price) || 0),
      quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
    })),
    optionMeta.fulfillmentMethod,
  )

  let paymentOutcome: Awaited<ReturnType<typeof processPaymentTransactionStep>>
  const requiresExternalPaymentHook =
    optionMeta.requiresCardNow &&
    (Boolean(input.awaitPaymentHook) ||
      Boolean(input.simulatePaymentTimeout) ||
      !input.payment?.cardNumber)

  if (requiresExternalPaymentHook) {
    using paymentHook = orderPaymentHook.create({
      token: getOrderPaymentHookToken(orderId),
    })

    const paymentRace = await Promise.race([
      paymentHook.then((payload) => ({ timedOut: false as const, payload })),
      sleepForTimeout(paymentWaitTimeout).then(() => ({ timedOut: true as const })),
    ])

    if (paymentRace.timedOut) {
      const reason = `Payment not received within ${String(paymentWaitTimeout)}; workflow stopped and reserved stock released.`
      await releaseReservedStockStep({ reservationKey, reason })
      return {
        success: false as const,
        status: 408,
        orderId,
        reservationKey,
        error: reason,
        stockReleased: true,
        timedOut: true,
      }
    }

    paymentOutcome = await processPaymentTransactionStep({
      paymentOption,
      cardNumber: paymentRace.payload.cardNumber ?? input.payment?.cardNumber,
      simulatePaymentFailure:
        paymentRace.payload.simulatePaymentFailure ??
        (!paymentRace.payload.authorized || input.simulatePaymentFailure),
      grandTotal,
      customError: paymentRace.payload.error,
    })
  } else if (optionMeta.requiresCardNow) {
    const paymentRace = await Promise.race([
      processPaymentTransactionStep({
        paymentOption,
        cardNumber: input.payment?.cardNumber,
        simulatePaymentFailure: input.simulatePaymentFailure,
        grandTotal,
      }).then((result) => ({ timedOut: false as const, result })),
      sleepForTimeout(paymentWaitTimeout).then(() => ({ timedOut: true as const })),
    ])

    if (paymentRace.timedOut) {
      const reason = `Payment authorization timed out after ${String(paymentWaitTimeout)}; reserved stock released.`
      await releaseReservedStockStep({ reservationKey, reason })
      return {
        success: false as const,
        status: 408,
        orderId,
        reservationKey,
        error: reason,
        stockReleased: true,
        timedOut: true,
      }
    }

    paymentOutcome = paymentRace.result
  } else {
    paymentOutcome = await processPaymentTransactionStep({
      paymentOption,
      cardNumber: input.payment?.cardNumber,
      simulatePaymentFailure: input.simulatePaymentFailure,
      grandTotal,
    })
  }

  if (!paymentOutcome.authorized || paymentOutcome.paymentStatus === 'FAILED') {
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

  const fulfillmentTimeout: WorkflowTimeoutValue | undefined =
    paymentOption === 'pay_on_collection'
      ? payOnCollectionTimeout
      : paymentOption === 'pay_on_delivery'
        ? payOnDeliveryTimeout
        : undefined

  try {
    // Step 3: Create Order, Generate Invoice/Receipt PDFs & Email (items remain reserved until fulfilled)
    const committed = await createOrderAndDocumentsStep({
      orderId,
      invoiceNumber,
      receiptNumber,
      timestamp,
      userId: input.userId,
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

    let fulfillmentOutcome: Awaited<ReturnType<typeof runOrderFulfillmentLoop>> | undefined
    let fulfillmentRunId: string | undefined

    if (input.waitForFulfillment) {
      fulfillmentOutcome = await runOrderFulfillmentLoop({
        orderId,
        reservationKey,
        paymentOption,
        fulfillmentTimeout,
      })
    } else {
      try {
        const fulfillmentRun = await start(executeOrderFulfillmentWorkflow, [
          {
            orderId,
            reservationKey,
            paymentOption,
            fulfillmentTimeout,
          },
        ])
        fulfillmentRunId = fulfillmentRun.runId
      } catch {
        // Fulfillment can also be advanced directly via PATCH /api/storefront/orders
      }
    }

    return {
      success: true as const,
      status: 200,
      reservationKey,
      fulfillmentRunId,
      fulfillmentOutcome,
      order: {
        orderId,
        invoiceNumber,
        receiptNumber,
        issuedAt: timestamp,
        paymentOption,
        fulfillmentMethod: paymentOutcome.fulfillmentMethod,
        orderStatus: fulfillmentOutcome?.finalStatus ?? committed.orderRecord.orderStatus,
        customer: committed.sharedTemplateData.customer,
        paymentSummary: committed.sharedTemplateData.paymentSummary,
        items: committed.orderLineItems,
        totals: committed.orderTotals,
      },
      documentHistory: committed.orderRecord.documentHistory ?? [],
      documents: {
        invoice: {
          filename: committed.invoicePdf.filename || `Invoice-${invoiceNumber}.pdf`,
          templateId: committed.invoicePdf.templateId,
        },
        receipt: {
          filename: committed.receiptPdf.filename || `Receipt-${receiptNumber}.pdf`,
          templateId: committed.receiptPdf.templateId,
        },
      },
      email: {
        status: committed.emailResult.status,
        messageId: committed.emailResult.messageId,
        to: committed.emailResult.to,
        subject: committed.emailResult.subject,
        templateId: committed.emailResult.templateId,
        attachmentsCount: committed.emailResult.attachmentsCount,
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
