import { NextRequest, NextResponse } from 'next/server'
import { start } from 'workflow/api'
import { getServerNeonUser } from '@/lib/auth'
import { initiatePaynowPayment } from '@/lib/paynow'
import { PAYMENT_OPTIONS, calculateOrderTotalsCents } from '@/lib/utils/products'
import {
  executeDurableCheckoutWorkflow,
  type CheckoutWorkflowInput,
} from '@/workflows/checkout-workflow'
import { calculateDeliveryFee } from '@/lib/utils/delivery-fee'

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
    const { customer, items, payment, paymentOption, waitForFulfillment, timeouts, userId } =
      body || {}
    const idempotencyKey = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    if (userId && userId !== sessionUser.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
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

    const shortId = Math.floor(100000 + Math.random() * 900000)
    const orderId = `ORD-${shortId}`
    const resolvedPaymentOption = paymentOption || 'pay_and_delivery'
    const optionMeta =
      PAYMENT_OPTIONS.find((opt) => opt.id === resolvedPaymentOption) || PAYMENT_OPTIONS[0]

    // Express Mobile Payments via Paynow (EcoCash / InnBucks) or Redirect:
    // Initiate mobile push immediately so we can return instructions & pollUrl to the user
    // while the durable checkout workflow reserves stock and waits on the payment hook.
    if (optionMeta.requiresCardNow && payment?.provider?.includes('paynow')) {
      const mobileNumber = payment.mobileNumber?.trim() || customer?.phone?.trim() || ''
      const mobileMethod =
        payment.provider === 'paynow' ? 'paynow' : payment.mobileMethod || 'ecocash'

      const calculationItems = items.map((item) => ({
        unitPriceCents: Math.round(Number(item.price) || 0),
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
      }))
      const delivery = calculateDeliveryFee({
        items: calculationItems,
        customerAddress: customer?.address || null,
      })
      const { taxCents, shippingCents } = calculateOrderTotalsCents(
        calculationItems,
        optionMeta.fulfillmentMethod,
        delivery.feeCents,
      )

      const paynowItems = [
        ...items.map((item) => {
          const qty = Math.max(1, Math.round(Number(item.quantity) || 1))
          return {
            title: `${item.title} x${qty}`,
            amountCents: Math.round(Number(item.price) || 0) * qty,
          }
        }),
        ...(taxCents > 0 ? [{ title: 'Tax', amountCents: taxCents }] : []),
        ...(shippingCents > 0 ? [{ title: 'Courier Delivery', amountCents: shippingCents }] : []),
      ]

      const initResult = await initiatePaynowPayment({
        reference: orderId,
        authEmail: customerEmail,
        phone: mobileNumber,
        method: mobileMethod,
        items: paynowItems,
      })

      if (!initResult.success || !initResult.pollUrl) {
        return NextResponse.json(
          {
            error: initResult.error || 'Unable to initiate Paynow mobile payment.',
            stockReleased: false,
          },
          { status: 402 },
        )
      }

      await start(executeDurableCheckoutWorkflow, [
        {
          idempotencyKey,
          orderId,
          userId: sessionUser.id,
          paymentOption: resolvedPaymentOption,
          waitForFulfillment: Boolean(waitForFulfillment),
          timeouts,
          customer: {
            name: customerName,
            email: customerEmail,
            address: customer?.address || '',
            phone: customer?.phone || mobileNumber,
            collectionLocation: customer?.collectionLocation || '',
          },
          payment: {
            provider: payment.provider,
            mobileMethod,
            mobileNumber,
            pollUrl: initResult.pollUrl,
          },
          items,
        },
      ])

      return NextResponse.json(
        {
          success: true,
          pendingPayment: true,
          orderId,
          pollUrl: initResult.pollUrl,
          instructions:
            initResult.instructions || mobileMethod === 'ecocash'
              ? `Check your EcoCash phone (${mobileNumber}) to authorize the payment prompt.`
              : mobileMethod === 'innbucks'
                ? `Scan to pay with InnBucks app or pay using code.`
                : `Complete payment on paynow website. Then return to this page.`,
          mobileMethod,
          mobileNumber,
          initResult,
        },
        { status: 202 },
      )
    }

    await start(executeDurableCheckoutWorkflow, [
      {
        idempotencyKey,
        orderId,
        userId: sessionUser.id,
        paymentOption: resolvedPaymentOption,
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
      },
    ])

    return NextResponse.json({
      success: true,
      pendingPayment: true,
      orderId,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred during checkout.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
