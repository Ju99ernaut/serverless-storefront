'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { storefrontQueryKeys } from '@/context'
import { generateOrderDocumentViaSdk } from '@/lib/payload-sdk'
import { formatCentsAsDollars } from '@/lib/utils/data'
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
import { toast } from '../ui/toast'
import type { CheckoutSuccessResponse } from './checkout-schema'
import { neonAuthClient } from '@/lib/auth-client'

interface CartOrderSuccessStepProps {
  orderResult: CheckoutSuccessResponse
  onClose: () => void
}

export function CartOrderSuccessStep({ orderResult, onClose }: CartOrderSuccessStepProps) {
  const { data: sessionData } = neonAuthClient.useSession()
  const user = sessionData?.user
  const queryClient = useQueryClient()
  const [generatingType, setGeneratingType] = useState<'INVOICE' | 'RECEIPT' | null>(null)

  const generateDocMutation = useMutation({
    mutationFn: (documentType: 'INVOICE' | 'RECEIPT') => {
      setGeneratingType(documentType)
      return generateOrderDocumentViaSdk({
        orderId: orderResult.order.orderId,
        documentType,
      })
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
      setGeneratingType(null)
    },
  })

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
            confirmation email has been dispatched to <strong>{orderResult.email.to}</strong>.
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
                  {formatCentsAsDollars(orderResult.order.totals.grandTotal)}
                </strong>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Invoice PDF</span>
                <Button
                  type="button"
                  size="sm"
                  variant="link"
                  className="h-auto p-0 text-xs font-semibold text-primary"
                  disabled={generatingType !== null}
                  onClick={() => generateDocMutation.mutate('INVOICE')}
                >
                  {generatingType === 'INVOICE' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span className="truncate max-w-[170px]">
                    {orderResult.documents.invoice.filename}
                  </span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Receipt PDF</span>
                <Button
                  type="button"
                  size="sm"
                  variant="link"
                  className="h-auto p-0 text-xs font-semibold text-primary"
                  disabled={generatingType !== null}
                  onClick={() => generateDocMutation.mutate('RECEIPT')}
                >
                  {generatingType === 'RECEIPT' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span className="truncate max-w-[170px]">
                    {orderResult.documents.receipt.filename}
                  </span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </Button>
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
