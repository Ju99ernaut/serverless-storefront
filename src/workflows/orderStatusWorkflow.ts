import {
  API_CONFIG,
  generateViaApi,
  sendRenderedEmailWithAttachments,
} from '../lib/utils/documentEmailService'
import { getRuntimeStore, releaseVariantStockAtomic, StoreOrderRecord } from '../lib/storefront-db'

const STATUS_LABELS: Record<StoreOrderRecord['orderStatus'], string> = {
  PENDING: 'Order Pending',
  CONFIRMED: 'Order Confirmed',
  PROCESSING: 'Preparing Your Garments in Atelier',
  READY_FOR_COLLECTION: 'Ready for In-Store Collection',
  OUT_FOR_DELIVERY: 'Out for Courier Delivery',
  COMPLETED: 'Delivered / Collected — Completed',
  CANCELLED: 'Order Cancelled & Stock Released',
}

async function applyOrderStatusStep(input: {
  orderId: string
  nextStatus: StoreOrderRecord['orderStatus']
  note?: string
}) {
  'use step'
  const store = getRuntimeStore()
  const order = store.orders.find((o) => o.orderId === input.orderId)
  if (!order) {
    throw new Error(`Order ${input.orderId} not found.`)
  }

  order.orderStatus = input.nextStatus
  if (input.nextStatus === 'COMPLETED' && order.paymentStatus === 'PENDING') {
    order.paymentStatus = 'PAID'
    order.paidAt = new Date().toISOString()
  }

  if (input.nextStatus === 'CANCELLED') {
    releaseVariantStockAtomic(
      `res_${order.orderId}`,
      input.note || 'Order cancelled by customer/admin',
    )
    if (order.paymentStatus === 'PAID') {
      order.paymentStatus = 'REFUNDED'
    }
  }

  const label = STATUS_LABELS[input.nextStatus] || input.nextStatus
  const statusNote =
    input.note || `Your order ${order.orderId} status has been updated to: ${label}.`

  const subject = `Order Update: ${order.orderId} is now ${label}`
  const renderedEmail = await generateViaApi({
    templateId: API_CONFIG.templates.receiptEmail,
    formats: ['html'],
    data: {
      documentType: 'EMAIL',
      subject,
      statusUpdateNote: statusNote,
      orderId: order.orderId,
      invoiceNumber: order.invoiceNumber,
      receiptNumber: order.receiptNumber,
      issuedAt: order.issuedAt,
      currency: 'USD',
      customer: {
        name: order.customerName,
        email: order.customerEmail,
        address: order.shippingAddress || '',
      },
      paymentSummary: {
        method: order.paymentMethodLabel,
        cardLast4: order.cardLast4,
        status: order.paymentStatus,
        paidAt: order.paidAt || order.issuedAt,
      },
      items: order.items.map((i) => ({
        id: i.productId,
        variantSku: i.variantSku,
        title: i.title,
        brand: i.brand,
        category: i.category,
        subcategory: i.subcategory,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
      })),
      totals: order.totals,
    },
  })

  const emailResult = await sendRenderedEmailWithAttachments({
    to: order.customerEmail,
    subject,
    renderedEmail,
    attachments: [],
  })

  order.statusTimeline.push({
    status: input.nextStatus,
    label,
    timestamp: new Date().toISOString(),
    note: statusNote,
    emailSent: true,
  })

  return {
    order,
    emailDispatched: true,
    emailStatus: emailResult.status,
    previewUrl: emailResult.previewUrl,
  }
}

export async function executeOrderStatusUpdateWorkflow(input: {
  orderId: string
  nextStatus: StoreOrderRecord['orderStatus']
  note?: string
}) {
  'use workflow'
  return await applyOrderStatusStep(input)
}
