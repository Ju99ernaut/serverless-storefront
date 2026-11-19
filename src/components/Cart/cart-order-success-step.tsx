'use client'

import Link from 'next/link'
import { Check, ExternalLink, FileText } from 'lucide-react'
import { Button, buttonVariants } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../ui/empty'
import { Separator } from '../ui/separator'
import type { CheckoutSuccessResponse } from './checkout-schema'

interface CartOrderSuccessStepProps {
  orderResult: CheckoutSuccessResponse
  onClose: () => void
}

export function CartOrderSuccessStep({ orderResult, onClose }: CartOrderSuccessStepProps) {
  const encodedOrderId = encodeURIComponent(orderResult.order.orderId)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6" role="status" aria-live="polite">
      <Empty className="p-2">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-16 rounded-full border border-dashed border-border bg-secondary text-emerald-500 [&_svg:not([class*='size-'])]:size-8"
          >
            <Check aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle className="text-xl font-bold">Order Confirmed!</EmptyTitle>
          <EmptyDescription>
            Order <strong>{orderResult.order.orderId}</strong> has been allocated cleanly by our
            durable checkout workflow. Your <strong>Invoice</strong> &amp; <strong>Receipt</strong>{' '}
            PDFs and confirmation email have been dispatched to{' '}
            <strong>{orderResult.email.to}</strong>.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent className="w-full max-w-none gap-3">
          <Card className="w-full text-left text-xs">
            <CardContent className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Order ID</span>
                <strong className="text-foreground">{orderResult.order.orderId}</strong>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Payment Mode</span>
                <code className="text-primary">{orderResult.order.paymentSummary?.method}</code>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Payment Status</span>
                <code className="text-primary">{orderResult.order.paymentSummary?.status}</code>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Fulfillment</span>
                <code className="text-primary">{orderResult.order.fulfillmentMethod}</code>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Total</span>
                <strong className="text-foreground">
                  ${orderResult.order.totals.grandTotal.toFixed(2)}
                </strong>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Email Status</span>
                <code className="text-primary">{orderResult.email.status}</code>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Invoice PDF</span>
                <a
                  href={`/api/storefront/documents/${encodedOrderId}?type=invoice`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="truncate max-w-[170px]">
                    {orderResult.documents.invoice.filename}
                  </span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Receipt PDF</span>
                <a
                  href={`/api/storefront/documents/${encodedOrderId}?type=receipt`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="truncate max-w-[170px]">
                    {orderResult.documents.receipt.filename}
                  </span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
              </div>
            </CardContent>
          </Card>

          <Link
            href="/account"
            onClick={onClose}
            className={buttonVariants({ className: 'w-full' })}
          >
            Track Order in My Account
          </Link>

          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Continue Shopping
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
