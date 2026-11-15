import { NextRequest, NextResponse } from 'next/server';
import { getRuntimeStore } from '@/lib/storefront-db';
import { executeOrderStatusUpdateWorkflow } from '@/workflows/orderStatusWorkflow';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = (searchParams.get('email') || '').trim().toLowerCase();
  const orderId = (searchParams.get('orderId') || '').trim();
  const store = getRuntimeStore();

  let orders = store.orders;
  if (orderId) {
    orders = orders.filter((o) => o.orderId === orderId);
  } else if (email) {
    orders = orders.filter((o) => o.customerEmail.toLowerCase() === email);
  }

  return NextResponse.json({ orders });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, nextStatus, note } = body || {};

    if (!orderId || !nextStatus) {
      return NextResponse.json(
        { error: 'orderId and nextStatus are required.' },
        { status: 400 }
      );
    }

    const result = await executeOrderStatusUpdateWorkflow({
      orderId,
      nextStatus,
      note,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Failed to update order status',
      },
      { status: 500 }
    );
  }
}
