import { NextRequest, NextResponse } from 'next/server'
import { getServerNeonUser } from '@/lib/auth'
import {
  executeDurableCheckoutWorkflow,
  type CheckoutWorkflowInput,
} from '@/workflows/checkout-workflow'

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getServerNeonUser()
    if (!sessionUser) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to checkout.' },
        { status: 401 },
      )
    }

    const body = (await request.json()) as Partial<CheckoutWorkflowInput>
    const {
      customer,
      items,
      payment,
      paymentOption,
      idempotencyKey,
      orderId,
      simulatePaymentFailure,
      simulatePaymentTimeout,
      awaitPaymentHook,
      waitForFulfillment,
      timeouts,
      userId,
    } = body || {}

    if (userId && userId !== sessionUser.id) {
      return NextResponse.json({ error: 'Forbidden: session user mismatch.' }, { status: 403 })
    }

    const customerName = customer?.name?.trim() || sessionUser.name
    const customerEmail = customer?.email?.trim() || sessionUser.email

    if (!customerEmail || !customerName) {
      return NextResponse.json(
        { error: 'Customer name and email address are required.' },
        { status: 400 },
      )
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cannot checkout with an empty cart.' }, { status: 400 })
    }

    const result = await executeDurableCheckoutWorkflow({
      idempotencyKey,
      orderId,
      userId: sessionUser.id,
      paymentOption: paymentOption || 'pay_and_delivery',
      simulatePaymentFailure: Boolean(simulatePaymentFailure),
      simulatePaymentTimeout: Boolean(simulatePaymentTimeout),
      awaitPaymentHook: Boolean(awaitPaymentHook),
      waitForFulfillment: Boolean(waitForFulfillment),
      timeouts,
      customer: {
        name: customerName,
        email: customerEmail,
        address: customer?.address || '',
        phone: customer?.phone || '',
        collectionLocation: customer?.collectionLocation || '',
      },
      payment,
      items,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          orderId: 'orderId' in result ? result.orderId : undefined,
          stockReleased: result.stockReleased,
          timedOut: 'timedOut' in result ? result.timedOut : false,
          insufficientItems: 'insufficientItems' in result ? result.insufficientItems : undefined,
        },
        { status: result.status || 400 },
      )
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred during checkout.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
