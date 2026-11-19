'use client'

import Link from 'next/link'
import { CheckCircle2, Clock, ExternalLink, FileText, Mail, Package, Truck } from 'lucide-react'
import type { Order } from '@/data/utils'
import { Badge } from '../ui/badge'
import { Button, buttonVariants } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../ui/empty'
import { OptimizedImage } from '../ui/optimized-image'

const STATUS_BADGE_MAP: Record<
  Order['orderStatus'],
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  PENDING: { label: 'Pending', variant: 'secondary' },
  CONFIRMED: { label: 'Confirmed & Reserved', variant: 'outline' },
  PROCESSING: { label: 'Preparing in Atelier', variant: 'default' },
  READY_FOR_COLLECTION: { label: 'Ready for Collection', variant: 'secondary' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', variant: 'secondary' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  CANCELLED: { label: 'Cancelled & Stock Released', variant: 'destructive' },
}

interface AccountOrdersTabProps {
  orders: Order[]
  updatingOrderId: string | null
  onAdvanceStatus: (
    orderId: string,
    nextStatus: Order['orderStatus'],
    options?: { deliveryFailed?: boolean },
  ) => void
}

export function AccountOrdersTab({
  orders,
  updatingOrderId,
  onAdvanceStatus,
}: AccountOrdersTabProps) {
  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>You haven&apos;t placed an order yet</EmptyTitle>
              <EmptyDescription>
                Your confirmed orders, PDF invoices, and live delivery milestones will appear here.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link className={buttonVariants({ size: 'sm' })} href="/">
                Explore Clothing Storefront
              </Link>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const statusBadge = STATUS_BADGE_MAP[order.orderStatus] || STATUS_BADGE_MAP.CONFIRMED
        const isTerminal = order.orderStatus === 'COMPLETED' || order.orderStatus === 'CANCELLED'

        return (
          <Card key={order.orderId}>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{order.orderId}</CardTitle>
                  <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                  <Badge variant="secondary">Payment: {order.paymentStatus}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Placed {new Date(order.issuedAt || order.createdAt).toLocaleString()} &bull;{' '}
                  {order.paymentMethodLabel || order.paymentOption} &bull; {order.fulfillmentMethod}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/storefront/documents/${encodeURIComponent(order.orderId)}?type=invoice`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({
                    variant: 'outline',
                    size: 'sm',
                    className: 'gap-1.5',
                  })}
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Invoice PDF</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
                <a
                  href={`/api/storefront/documents/${encodeURIComponent(order.orderId)}?type=receipt`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({
                    variant: 'outline',
                    size: 'sm',
                    className: 'gap-1.5',
                  })}
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Receipt PDF</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              {/* Items */}
              <div className="space-y-2.5">
                {(order.items ?? []).map((item, idx) => (
                  <div
                    key={`${order.orderId}-item-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-none border border-border bg-secondary p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-none bg-card p-1 flex items-center justify-center border border-border">
                        <OptimizedImage
                          src={item.imageUrl || '/images/shirt.png'}
                          alt={item.title}
                          width={48}
                          height={48}
                          className="max-h-full w-auto object-contain"
                        />
                      </div>
                      <div>
                        <Link
                          href={`/products/${item.productSlug || item.productId}`}
                          className="font-bold text-foreground hover:text-primary"
                        >
                          {item.title}
                        </Link>
                        <div className="text-muted-foreground">
                          {item.color} / Size {item.size} &bull; Qty {item.quantity} &bull; SKU{' '}
                          <code>{item.variantSku}</code>
                        </div>
                      </div>
                    </div>
                    <span className="font-bold text-foreground">${item.lineTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Destination & Total */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-t border-border pt-3">
                <div className="text-muted-foreground">
                  <strong className="text-foreground">
                    {order.fulfillmentMethod === 'COLLECTION'
                      ? 'Pickup Boutique:'
                      : 'Delivery Address:'}
                  </strong>{' '}
                  {order.shippingAddress ||
                    order.collectionLocation ||
                    'Flagship Storefront Atelier'}
                </div>
                <div className="text-sm font-bold text-primary">
                  Total: ${order.totals.grandTotal.toFixed(2)}
                </div>
              </div>

              {/* Status Timeline */}
              <div className="space-y-2 rounded-none border border-border bg-popover p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Live Tracking &amp; Email Updates
                </div>
                <div className="space-y-2.5 pt-1">
                  {(order.statusTimeline ?? []).map((entry, idx) => (
                    <div
                      key={`${order.orderId}-tl-${idx}`}
                      className="flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="flex items-start gap-2">
                        <CheckCircle2
                          className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <div className="font-semibold text-foreground">{entry.label}</div>
                          {entry.note && <div className="text-muted-foreground">{entry.note}</div>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        {entry.emailSent && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                            <Mail className="h-2.5 w-2.5" aria-hidden="true" />
                            Emailed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {!isTerminal && (
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
                    <span className="text-[11px] text-muted-foreground mr-1">
                      Simulate Tracking Update (Emails Customer):
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={updatingOrderId === order.orderId}
                      onClick={() => onAdvanceStatus(order.orderId, 'PROCESSING')}
                    >
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      Preparing
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={updatingOrderId === order.orderId}
                      onClick={() =>
                        onAdvanceStatus(
                          order.orderId,
                          order.fulfillmentMethod === 'COLLECTION'
                            ? 'READY_FOR_COLLECTION'
                            : 'OUT_FOR_DELIVERY',
                        )
                      }
                    >
                      <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                      {order.fulfillmentMethod === 'COLLECTION'
                        ? 'Ready for Collection'
                        : 'Out for Delivery'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updatingOrderId === order.orderId}
                      onClick={() => onAdvanceStatus(order.orderId, 'COMPLETED')}
                    >
                      {order.fulfillmentMethod === 'COLLECTION'
                        ? 'Mark Collected'
                        : 'Mark Delivered'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={updatingOrderId === order.orderId}
                      onClick={() =>
                        onAdvanceStatus(order.orderId, 'CANCELLED', {
                          deliveryFailed: order.fulfillmentMethod === 'DELIVERY',
                        })
                      }
                    >
                      {order.fulfillmentMethod === 'DELIVERY'
                        ? 'Delivery Failed / Cancel'
                        : 'Cancel & Release Stock'}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
