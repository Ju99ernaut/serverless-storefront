import { NextRequest, NextResponse } from 'next/server'
import { getServerNeonUser } from '@/lib/auth'
import { pollPaynowTransaction, type PaynowMobileMethod } from '@/lib/paynow'
import { getOrderByOrderIdServer } from '@/lib/payload-server'
import { getOrderPaymentHookToken, orderPaymentHook } from '@/workflows/checkout-workflow'

/**
 * Authenticated Paynow transaction status polling endpoint.
 * Polls Paynow using the saved `pollUrl`, resumes the checkout workflow payment hook
 * when a terminal paid/failed state is reached, and returns the finalized order once created.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getServerNeonUser()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const body = (await request.json()) as {
      orderId?: string
      pollUrl?: string
      mobileMethod?: PaynowMobileMethod
      mobileNumber?: string
    }

    const { orderId, pollUrl, mobileMethod, mobileNumber } = body || {}
    if (!orderId || !pollUrl) {
      return NextResponse.json(
        { error: 'orderId and pollUrl are required to check payment status.' },
        { status: 400 },
      )
    }

    const pollResult = await pollPaynowTransaction(pollUrl)

    if (pollResult.paid || pollResult.failed) {
      try {
        await orderPaymentHook.resume(getOrderPaymentHookToken(orderId), {
          authorized: pollResult.paid,
          mobileMethod,
          mobileNumber,
          pollUrl: pollResult.pollUrl || pollUrl,
          paynowReference: pollResult.paynowReference,
          error: pollResult.failed
            ? pollResult.error || `Paynow payment ${pollResult.status}.`
            : undefined,
        })
      } catch {
        // Hook may already have been resumed by webhook or a previous poll
      }
    }

    let order = null
    if (pollResult.paid) {
      order = await getOrderByOrderIdServer(orderId)
    }

    return NextResponse.json({
      orderId,
      status: pollResult.status,
      paid: pollResult.paid,
      failed: pollResult.failed,
      pending: pollResult.pending,
      error: pollResult.error,
      order,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unable to check Paynow payment status.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
