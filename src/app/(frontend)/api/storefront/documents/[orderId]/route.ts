import { NextRequest, NextResponse } from 'next/server';
import { getOrderByOrderId } from '@/lib/payload-sdk';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const { searchParams } = new URL(request.url);
  const docType = (searchParams.get('type') || 'invoice').toLowerCase();

  const order = await getOrderByOrderId(orderId);

  if (docType === 'html' && order?.documents?.renderedHtml) {
    return new NextResponse(order.documents.renderedHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }

  const label = docType === 'receipt' ? 'RECEIPT' : 'INVOICE';
  const docNum =
    docType === 'receipt'
      ? order?.receiptNumber || `RCP-${orderId}`
      : order?.invoiceNumber || `INV-${orderId}`;

  const issuedAt = order ? order.issuedAt || order.createdAt : '';

  const htmlView = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${label} ${docNum} — Storefront</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1c1d22; color: #e4e4e7; padding: 32px; margin: 0; }
    .sheet { max-width: 720px; margin: 0 auto; background: #24252a; border: 1px solid #34363d; border-radius: 0; padding: 36px; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #34363d; }
    .btn { background: #5C5EDC; color: #fff; border: none; padding: 8px 16px; border-radius: 0; font-weight: 600; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #2e3038; text-align: left; font-size: 14px; }
    @media print { body { background: #fff; color: #111; } .sheet { border: none; background: #fff; color: #111; } .toolbar { display: none; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="toolbar">
      <div>
        <span style="color:#5C5EDC;font-weight:700;letter-spacing:0.15em;font-size:12px;">STOREFRONT ATELIER • ${label}</span>
        <h1 style="margin:4px 0 0;font-size:24px;">${docNum}</h1>
      </div>
      <button class="btn" onclick="window.print()">Print / Save as PDF</button>
    </div>
    ${
      order
        ? `
      <p><strong>Order ID:</strong> ${order.orderId} &bull; <strong>Issued:</strong> ${new Date(issuedAt).toLocaleString()}</p>
      <p><strong>Customer:</strong> ${order.customerName} (${order.customerEmail})</p>
      <p><strong>Fulfillment:</strong> ${order.fulfillmentMethod} &bull; <strong>Address / Pickup:</strong> ${order.shippingAddress || ''}</p>
      <p><strong>Payment:</strong> ${order.paymentMethodLabel || order.paymentOption} &bull; <strong>Status:</strong> ${order.paymentStatus}</p>
      <table>
        <thead>
          <tr><th>Item</th><th>Variant</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${(order.items || [])
            .map(
              (i) =>
                `<tr><td>${i.title} (${i.brand || ''})</td><td>${i.color || ''} / ${i.size || ''}</td><td>${i.quantity}</td><td>$${i.unitPrice.toFixed(2)}</td><td>$${i.lineTotal.toFixed(2)}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
      <div style="text-align:right;line-height:1.8;">
        <div>Subtotal: $${order.totals.subTotal.toFixed(2)}</div>
        <div>Tax (8%): $${order.totals.tax.toFixed(2)}</div>
        <div style="font-size:18px;font-weight:700;color:#797BED;">Grand Total: $${order.totals.grandTotal.toFixed(2)}</div>
      </div>`
        : `<p>Document ${docNum} for Order ${orderId}</p>`
    }
  </div>
</body>
</html>`;

  return new NextResponse(htmlView, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
