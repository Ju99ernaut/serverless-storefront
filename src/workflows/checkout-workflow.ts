import { defineHook, sleep } from 'workflow'
import { start } from 'workflow/api'
import {
  PAYMENT_OPTIONS,
  calculateOrderTotalsCents,
  type PaymentOptionType,
} from '../lib/utils/products'
import type { Order } from '@/payload-types'
import { applyOrderStatusStep } from './steps/apply-order-status'
import { commitOrderStockStep } from './steps/commit-order-stock'
import { createOrderAndDocumentsStep } from './steps/create-order-and-documents'
import { processPaymentTransactionStep } from './steps/process-payment-transaction'
import { releaseReservedStockStep } from './steps/release-reserved-stock'
import { reserveInventoryStep } from './steps/reserve-inventory'
import {
  WORKFLOW_TIMEOUT_DEFAULTS,
  type CheckoutWorkflowInput,
  type OrderFulfillmentHookPayload,
  type OrderPaymentHookPayload,
  type WorkflowTimeoutValue,
} from './types'
import { calculateDeliveryFee } from '@/lib/utils/delivery-fee'

export {
  WORKFLOW_TIMEOUT_DEFAULTS,
  type CheckoutWorkflowInput,
  type OrderFulfillmentHookPayload,
  type OrderPaymentHookPayload,
  type WorkflowTimeoutValue,
}

function sleepForTimeout(timeout: WorkflowTimeoutValue): Promise<void> {
  return typeof timeout === 'number' ? sleep(timeout) : sleep(timeout)
}

export function getOrderPaymentHookToken(orderId: string): string {
  return `order-payment:${orderId}`
}

export function getOrderFulfillmentHookToken(orderId: string): string {
  return `order-fulfillment:${orderId}`
}

export const orderPaymentHook = defineHook<OrderPaymentHookPayload>()
export const orderFulfillmentHook = defineHook<OrderFulfillmentHookPayload>()

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
  const shortId = input.orderId?.replace('ORD-', '') || Math.floor(100000 + Math.random() * 900000)
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

  // Step 2: Wait for Payment (5m configurable window for pay_and_delivery & pay_then_collect)
  const calculationItems = input.items.map((i) => ({
    unitPriceCents: Math.round(Number(i.price) || 0),
    quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
  }))
  const delivery = calculateDeliveryFee({
    items: calculationItems,
    customerAddress: input.customer.address || null,
  })
  const { grandTotalCents: grandTotal } = calculateOrderTotalsCents(
    input.items.map((i) => ({
      unitPriceCents: Math.round(Number(i.price) || 0),
      quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
    })),
    optionMeta.fulfillmentMethod,
    delivery.feeCents,
  )

  let paymentOutcome: Awaited<ReturnType<typeof processPaymentTransactionStep>>
  const isPaynowMobile = input.payment?.provider === 'paynow_mobile'
  const requiresPaymentFirst = optionMeta.requiresCardNow && isPaynowMobile

  if (requiresPaymentFirst) {
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
      mobileMethod: paymentRace.payload.mobileMethod ?? input.payment?.mobileMethod,
      mobileNumber: paymentRace.payload.mobileNumber ?? input.payment?.mobileNumber,
      authorized: paymentRace.payload.authorized,
      grandTotal,
      customError: paymentRace.payload.error,
    })
  } else {
    paymentOutcome = await processPaymentTransactionStep({
      paymentOption,
      cardNumber: input.payment?.cardNumber,
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
        // Fulfillment can also be advanced directly via Admin
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
