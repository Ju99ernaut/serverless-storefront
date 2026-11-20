'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, FileText, Loader2, Package, Truck } from 'lucide-react'
import { storefrontQueryKeys } from '@/context'
import { generateOrderDocumentViaSdk } from '@/lib/payload-sdk'
import { formatCentsAsDollars, type Order } from '@/lib/utils/data'
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
import { toast } from '../ui/toast'
import { neonAuthClient } from '@/lib/auth-client'

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
  const { data: sessionData } = neonAuthClient.useSession()
  const user = sessionData?.user
  const queryClient = useQueryClient()
  const [generatingKey, setGeneratingKey] = useState<string | null>(null)
  const isAuthorizedOperator = Boolean(
    user?.role && ['admin', 'staff', 'fulfillment'].includes(user.role.trim().toLowerCase()),
  )

  const generateDocMutation = useMutation({
    mutationFn: ({
      orderId,
      documentType,
    }: {
      orderId: string
      documentType: 'INVOICE' | 'RECEIPT'
    }) => {
      setGeneratingKey(`${orderId}:${documentType}`)
      return generateOrderDocumentViaSdk({ orderId, documentType })
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({
        queryKey: storefrontQueryKeys.orders(user?.id || user?.email),
      })
      toast.add({
        type: 'success',
        description: `${res.document.filename} generated on demand via ComposeIt.`,
      })
      if (res.document.pdfUrl) {
        window.open(res.document.pdfUrl, '_blank', 'noopener,noreferrer')
      }
    },
    onError: (err: unknown) => {
      toast.add({
        type: 'error',
        description: err instanceof Error ? err.message : 'Unable to generate document.',
      })
    },
    onSettled: () => {
      setGeneratingKey(null)
    },
  })

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
                Your confirmed orders, on-demand invoices and receipts, and live delivery milestones
                will appear here.
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
        const isGeneratingInvoice = generatingKey === `${order.orderId}:INVOICE`
        const isGeneratingReceipt = generatingKey === `${order.orderId}:RECEIPT`
        const docHistory = order.documentHistory ?? []

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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={generatingKey !== null}
                  onClick={() =>
                    generateDocMutation.mutate({ orderId: order.orderId, documentType: 'INVOICE' })
                  }
                >
                  {isGeneratingInvoice ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Generate Invoice</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={generatingKey !== null}
                  onClick={() =>
                    generateDocMutation.mutate({ orderId: order.orderId, documentType: 'RECEIPT' })
                  }
                >
                  {isGeneratingReceipt ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Generate Receipt</span>
                </Button>
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
                    <span className="font-bold text-foreground">
                      {formatCentsAsDollars(item.lineTotal)}
                    </span>
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
                  Total: {formatCentsAsDollars(order.totals.grandTotal)}
                </div>
              </div>

              {/* Invoices & Receipts History */}
              {docHistory.length > 0 && (
                <div className="space-y-2 rounded-none border border-border bg-popover p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Invoices &amp; Receipts History
                  </div>
                  <div className="space-y-2 pt-1">
                    {docHistory.map((doc, idx) => (
                      <div
                        key={`${order.orderId}-doc-${idx}`}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{doc.documentType}</Badge>
                          <span className="font-semibold text-foreground">
                            {doc.documentNumber}
                          </span>
                          <span className="text-muted-foreground">{doc.filename}</span>
                        </div>
                        <span className="text-muted-foreground">
                          Generated {new Date(doc.generatedAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Timeline */}
              <div className="space-y-2 rounded-none border border-border bg-popover p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Live Tracking Updates
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
                      </div>
                    </div>
                  ))}
                </div>

                {!isTerminal && isAuthorizedOperator && (
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
                    <span className="text-[11px] text-muted-foreground mr-1">
                      Admin Fulfillment Controls:
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

                {!isTerminal &&
                  !isAuthorizedOperator &&
                  order.orderStatus !== 'OUT_FOR_DELIVERY' && (
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={updatingOrderId === order.orderId}
                        onClick={() =>
                          onAdvanceStatus(order.orderId, 'CANCELLED', { deliveryFailed: false })
                        }
                      >
                        Cancel Order
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
