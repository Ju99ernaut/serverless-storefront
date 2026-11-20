import { NextRequest, NextResponse } from 'next/server'
import { parsePaynowStatusUpdate } from '@/lib/paynow'
import { getOrderPaymentHookToken, orderPaymentHook } from '@/workflows/checkout-workflow'

/**
 * Paynow `resultUrl` webhook endpoint.
 * Receives form-urlencoded status updates from Paynow, verifies the SHA-512 hash,
 * and resumes the waiting checkout workflow payment hook on terminal status.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    if (!rawBody) {
      return NextResponse.json({ error: 'Empty Paynow status update body.' }, { status: 400 })
    }

    const statusUpdate = parsePaynowStatusUpdate(rawBody)
    const orderId = statusUpdate.reference

    if (!orderId) {
      return NextResponse.json({ error: 'Missing transaction reference.' }, { status: 400 })
    }

    if (statusUpdate.paid || statusUpdate.failed) {
      try {
        await orderPaymentHook.resume(getOrderPaymentHookToken(orderId), {
          authorized: statusUpdate.paid,
          pollUrl: statusUpdate.pollUrl,
          paynowReference: statusUpdate.paynowReference,
          error: statusUpdate.failed
            ? statusUpdate.error || `Paynow mobile payment ${statusUpdate.status}.`
            : undefined,
        })
      } catch (err) {
        // Hook may have already been resumed by client polling or timed out
        console.warn(`Paynow webhook hook resume skipped for ${orderId}:`, err)
      }
    }

    return NextResponse.json({
      received: true,
      orderId,
      status: statusUpdate.status,
      paid: statusUpdate.paid,
      failed: statusUpdate.failed,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Invalid Paynow status update payload.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
