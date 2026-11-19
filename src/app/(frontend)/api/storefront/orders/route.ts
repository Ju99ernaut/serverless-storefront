import { NextRequest, NextResponse } from 'next/server'
import { getOrderByOrderId } from '@/lib/payload-sdk'
import {
  getOrderFulfillmentHookToken,
  getOrderPaymentHookToken,
  orderFulfillmentHook,
  orderPaymentHook,
} from '@/workflows/checkoutWorkflow'
import { executeOrderStatusUpdateWorkflow } from '@/workflows/orderStatusWorkflow'

export async function PATCH(request: NextRequest) {
  try {
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

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 })
    }

    if (action === 'payment') {
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

    if (!nextStatus && !deliveryFailed) {
      return NextResponse.json({ error: 'orderId and nextStatus are required.' }, { status: 400 })
    }

    const resolvedStatus = deliveryFailed ? 'CANCELLED' : nextStatus

    try {
      await orderFulfillmentHook.resume(getOrderFulfillmentHookToken(orderId), {
        nextStatus: resolvedStatus,
        note,
        deliveryFailed: Boolean(deliveryFailed),
      })
      await new Promise((resolve) => setTimeout(resolve, 25))
      const updatedOrder = await getOrderByOrderId(orderId)
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
