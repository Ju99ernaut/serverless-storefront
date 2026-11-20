import { NextRequest, NextResponse } from 'next/server'
import {
  canUserAccessOrder,
  getServerNeonUser,
  isAuthorizedAdminOrStaff,
  isAuthorizedPayloadAdminRequest,
  verifyPaymentWebhookSecret,
} from '@/lib/auth'
import { generateAndRecordOrderDocumentServer, getOrderByOrderIdServer } from '@/lib/payload-server'
import type { Order } from '@/lib/utils/data'
import {
  getOrderFulfillmentHookToken,
  getOrderPaymentHookToken,
  orderFulfillmentHook,
  orderPaymentHook,
} from '@/workflows/checkout-workflow'
import { executeOrderStatusUpdateWorkflow } from '@/workflows/order-status-workflow'

const VALID_ORDER_STATUSES = new Set<Order['orderStatus']>([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'READY_FOR_COLLECTION',
  'OUT_FOR_DELIVERY',
  'COMPLETED',
  'CANCELLED',
])

const CUSTOMER_CANCELLABLE_STATUSES = new Set<Order['orderStatus']>([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'READY_FOR_COLLECTION',
])

export async function PATCH(request: NextRequest) {
  try {
    const [sessionUser, isPayloadAdmin] = await Promise.all([
      getServerNeonUser(),
      isAuthorizedPayloadAdminRequest(request),
    ])
    const isPaymentWebhookAuthorized = verifyPaymentWebhookSecret(request)
    const isAuthorizedOperator = isPayloadAdmin || isAuthorizedAdminOrStaff(sessionUser)

    const body = await request.json()
    const {
      action,
      orderId,
      nextStatus,
      note,
      deliveryFailed,
      authorized,
      cardNumber,
      cardholderName,
      simulatePaymentFailure,
      error: paymentError,
    } = body || {}

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 })
    }

    // 1. Payment webhook / authorization callback — strictly restricted to authorized payment webhook or admin/staff
    if (action === 'payment') {
      if (!isPaymentWebhookAuthorized && !isAuthorizedOperator) {
        if (!sessionUser) {
          return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
        }
        return NextResponse.json(
          {
            error:
              'Forbidden: only an authorized payment provider or admin can confirm order payments.',
          },
          { status: 403 },
        )
      }

      const existingOrder = await getOrderByOrderIdServer(orderId)
      if (
        existingOrder &&
        (existingOrder.paymentStatus === 'PAID' ||
          existingOrder.orderStatus === 'COMPLETED' ||
          existingOrder.orderStatus === 'CANCELLED')
      ) {
        return NextResponse.json(
          { error: `Order ${orderId} is already finalized and cannot accept payment updates.` },
          { status: 409 },
        )
      }

      await orderPaymentHook.resume(getOrderPaymentHookToken(orderId), {
        authorized: Boolean(authorized),
        cardNumber,
        cardholderName,
        simulatePaymentFailure: Boolean(simulatePaymentFailure),
        error: paymentError,
      })
      return NextResponse.json({
        success: true,
        resumed: 'payment',
        orderId,
      })
    }

    // All remaining actions require an authenticated user or Payload admin
    if (!sessionUser && !isPayloadAdmin) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const existingOrder = await getOrderByOrderIdServer(orderId)

    // 2. On-demand Invoice / Receipt generation via ComposeIt — allowed for order owner or admin/staff
    if (action === 'generate_document') {
      if (!existingOrder) {
        return NextResponse.json({ error: `Order ${orderId} not found.` }, { status: 404 })
      }
      if (!isAuthorizedOperator && !canUserAccessOrder(sessionUser, existingOrder)) {
        return NextResponse.json(
          { error: 'Forbidden: you do not own this order.' },
          { status: 403 },
        )
      }
      const docType = body?.documentType === 'RECEIPT' ? 'RECEIPT' : 'INVOICE'
      const result = await generateAndRecordOrderDocumentServer({
        orderId,
        documentType: docType,
      })
      return NextResponse.json(result)
    }

    // 3. Order status advancement / fulfillment transitions
    if (!nextStatus && !deliveryFailed) {
      return NextResponse.json({ error: 'orderId and nextStatus are required.' }, { status: 400 })
    }

    const resolvedStatus = (deliveryFailed ? 'CANCELLED' : nextStatus) as Order['orderStatus']
    if (!VALID_ORDER_STATUSES.has(resolvedStatus)) {
      return NextResponse.json(
        { error: `Invalid order status: ${String(resolvedStatus)}` },
        { status: 400 },
      )
    }

    if (!existingOrder) {
      return NextResponse.json({ error: `Order ${orderId} not found.` }, { status: 404 })
    }

    // Determine whether this transition requires admin / authorized fulfillment staff
    const isCustomerSelfCancel = resolvedStatus === 'CANCELLED' && !deliveryFailed

    if (!isAuthorizedOperator) {
      if (!canUserAccessOrder(sessionUser, existingOrder)) {
        return NextResponse.json(
          { error: 'Forbidden: you do not own this order.' },
          { status: 403 },
        )
      }

      if (!isCustomerSelfCancel) {
        return NextResponse.json(
          {
            error:
              'Forbidden: only an admin or authorized fulfillment operator can advance order fulfillment or mark orders paid/delivered.',
          },
          { status: 403 },
        )
      }
    }

    if (existingOrder.orderStatus === 'COMPLETED' || existingOrder.orderStatus === 'CANCELLED') {
      return NextResponse.json(
        {
          error: `Order ${orderId} is already ${existingOrder.orderStatus} and cannot be modified.`,
        },
        { status: 409 },
      )
    }

    if (!isAuthorizedOperator && !CUSTOMER_CANCELLABLE_STATUSES.has(existingOrder.orderStatus)) {
      return NextResponse.json(
        {
          error: `Order ${orderId} is already ${existingOrder.orderStatus} and can no longer be cancelled by the customer.`,
        },
        { status: 409 },
      )
    }

    try {
      await orderFulfillmentHook.resume(getOrderFulfillmentHookToken(orderId), {
        nextStatus: resolvedStatus,
        note,
        deliveryFailed: Boolean(deliveryFailed),
      })
      await new Promise((resolve) => setTimeout(resolve, 25))
      const updatedOrder = await getOrderByOrderIdServer(orderId)
      return NextResponse.json({
        order: updatedOrder,
        emailDispatched: true,
        resumed: 'fulfillment',
      })
    } catch {
      const result = await executeOrderStatusUpdateWorkflow({
        orderId,
        nextStatus: resolvedStatus,
        note,
        deliveryFailed: Boolean(deliveryFailed),
      })
      return NextResponse.json(result)
    }
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Failed to update order status',
      },
      { status: 500 },
    )
  }
}
