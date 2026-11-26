import {
  API_CONFIG,
  generateViaApi,
  sendRenderedEmailWithAttachments,
} from '../../lib/utils/document-email-service'
import {
  commitVariantStock,
  getOrderByOrderIdServer,
  releaseVariantStock,
  updateOrderServer,
} from '../../lib/payload-server'
import { centsToDollars } from '../../lib/utils/products'
import type { Order } from '@/payload-types'

const STATUS_LABELS: Record<Order['orderStatus'], string> = {
  PENDING: 'Order Pending',
  CONFIRMED: 'Order Confirmed',
  PROCESSING: 'Preparing Your Garments in Store',
  READY_FOR_COLLECTION: 'Ready for In-Store Collection',
  OUT_FOR_DELIVERY: 'Out for Courier Delivery',
  COMPLETED: 'Delivered / Collected — Completed',
  CANCELLED: 'Order Cancelled & Stock Released',
}

export async function applyOrderStatusStep(input: {
  orderId: string
  nextStatus: Order['orderStatus']
  note?: string
  deliveryFailed?: boolean
  commitStock?: boolean
  releaseStock?: boolean
}) {
  'use step'
  const order = await getOrderByOrderIdServer(input.orderId)
  if (!order) {
    throw new Error(`Order ${input.orderId} not found.`)
  }

  const effectiveStatus: Order['orderStatus'] = input.deliveryFailed
    ? 'CANCELLED'
    : input.nextStatus

  let nextPaymentStatus = order.paymentStatus
  let nextPaidAt = order.paidAt

  if (effectiveStatus === 'COMPLETED' && nextPaymentStatus === 'PENDING') {
    nextPaymentStatus = 'PAID'
    nextPaidAt = new Date().toISOString()
  }

  const shouldCommitStock =
    input.commitStock !== false &&
    (effectiveStatus === 'COMPLETED' ||
      (order.paymentOption === 'pay_then_collect' && effectiveStatus === 'READY_FOR_COLLECTION'))

  if (shouldCommitStock) {
    await commitVariantStock(`res_${order.orderId}`)
  }

  if (effectiveStatus === 'CANCELLED') {
    if (input.releaseStock !== false) {
      await releaseVariantStock(
        `res_${order.orderId}`,
        input.note ||
          (input.deliveryFailed
            ? 'Delivery failed; reserved stock released'
            : 'Order cancelled by customer/admin'),
      )
    }
    if (nextPaymentStatus === 'PAID') {
      nextPaymentStatus = 'REFUNDED'
    }
  }

  const label = input.deliveryFailed
    ? 'Delivery Failed — Stock Released'
    : STATUS_LABELS[effectiveStatus] || effectiveStatus
  const statusNote =
    input.note ||
    (input.deliveryFailed
      ? `Delivery failed for order ${order.orderId}; reserved stock has been released.`
      : `Your order ${order.orderId} status has been updated to: ${label}.`)

  const subject = `Order Update: ${order.orderId} is now ${label}`
  const issuedAt = order.issuedAt || order.createdAt
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
      issuedAt,
      currency: 'USD',
      customer: {
        name: order.customerName,
        email: order.customerEmail,
        address: order.shippingAddress || '',
      },
      paymentSummary: {
        method: order.paymentMethodLabel || order.paymentOption,
        cardLast4: order.cardLast4 || 'N/A',
        status: nextPaymentStatus,
        paidAt: nextPaidAt || issuedAt,
      },
      items: (order.items || []).map((i) => ({
        id: i.productId,
        variantSku: i.variantSku,
        title: i.title,
        brand: i.brand || '',
        category: i.category || '',
        subcategory: i.subcategory || '',
        size: i.size || undefined,
        color: i.color || undefined,
        quantity: i.quantity,
        unitPrice: centsToDollars(i.unitPrice),
        lineTotal: centsToDollars(i.lineTotal),
      })),
      totals: {
        subTotal: centsToDollars(order.totals.subTotal),
        tax: centsToDollars(order.totals.tax),
        shipping: centsToDollars(order.totals.shipping),
        grandTotal: centsToDollars(order.totals.grandTotal),
      },
    },
  })

  const emailResult = await sendRenderedEmailWithAttachments({
    to: order.customerEmail,
    subject,
    renderedEmail,
    attachments: [],
  })

  const nextTimeline = [
    ...(order.statusTimeline || []).map((entry) => ({
      status: entry.status,
      label: entry.label,
      timestamp: entry.timestamp,
      note: entry.note,
    })),
    {
      status: effectiveStatus,
      label,
      timestamp: new Date().toISOString(),
      note: statusNote,
    },
  ]

  const updatedOrder = await updateOrderServer(order.id, {
    orderStatus: effectiveStatus,
    paymentStatus: nextPaymentStatus,
    paidAt: nextPaidAt,
    statusTimeline: nextTimeline,
  })

  return {
    order: updatedOrder,
    emailDispatched: true,
    emailStatus: emailResult.status,
  }
}
