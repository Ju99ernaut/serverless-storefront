import { NextRequest, NextResponse } from 'next/server';
import {
  executeDurableCheckoutWorkflow,
  CheckoutWorkflowInput,
} from '@/workflows/checkoutWorkflow';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<CheckoutWorkflowInput>;
    const {
      customer,
      items,
      payment,
      paymentOption,
      idempotencyKey,
      simulatePaymentFailure,
      userId,
    } = body || {};

    if (!customer?.email || !customer?.name) {
      return NextResponse.json(
        { error: 'Customer name and email address are required.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Cannot checkout with an empty cart.' },
        { status: 400 }
      );
    }

    const result = await executeDurableCheckoutWorkflow({
      idempotencyKey,
      userId,
      paymentOption: paymentOption || 'pay_and_delivery',
      simulatePaymentFailure: Boolean(simulatePaymentFailure),
      customer: {
        name: customer.name,
        email: customer.email,
        address: customer.address || '',
        phone: customer.phone || '',
        collectionLocation: customer.collectionLocation || '',
      },
      payment,
      items,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          stockReleased: result.stockReleased,
          insufficientItems: result.insufficientItems,
        },
        { status: result.status || 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred during checkout.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
