'use client'

import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Link,
  Loader2,
  RefreshCw,
  Smartphone,
} from 'lucide-react'
import { Alert } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { DrawerHeader, DrawerTitle } from '../ui/drawer'
import { Separator } from '../ui/separator'
import type { CheckoutPendingMobilePaymentResponse } from './checkout-schema'
import QRCode from 'react-qr-code'
import { useEffect, useState } from 'react'

export function formatExpiresAt(
  value: string | number | Date | null | undefined,
  options?: {
    locale?: string
    formatOptions?: Intl.DateTimeFormatOptions
    fallback?: string
  },
): string {
  if (value === null || value === undefined || value === '') {
    return options?.fallback ?? ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return options?.fallback ?? ''
  }

  const locale = options?.locale ?? undefined
  const formatOptions: Intl.DateTimeFormatOptions = options?.formatOptions ?? {
    dateStyle: 'medium',
    timeStyle: 'short',
  }

  try {
    return `Expires At: ${new Intl.DateTimeFormat(locale, formatOptions).format(date)}`
  } catch {
    return options?.fallback ?? ''
  }
}

interface CartMobilePaymentStepProps {
  pendingPayment: CheckoutPendingMobilePaymentResponse
  paymentStatus: string
  isChecking: boolean
  onCheckStatus: () => void
  onBackToCheckout: () => void
}

export function CartMobilePaymentStep({
  pendingPayment,
  paymentStatus,
  isChecking,
  onCheckStatus,
  onBackToCheckout,
}: CartMobilePaymentStepProps) {
  const walletLabel =
    pendingPayment.mobileMethod === 'ecocash'
      ? 'EcoCash'
      : pendingPayment.mobileMethod === 'innbucks'
        ? 'InnBucks'
        : 'Paynow'
  const innbucksInfo = pendingPayment.initResult.innbucks_info?.[0]
  const [copiedCode, setCopiedCode] = useState(false)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  useEffect(() => {
    if (pendingPayment.initResult.redirectUrl && walletLabel === 'Paynow') {
      window.location.replace(pendingPayment.initResult.redirectUrl)
    }
  }, [pendingPayment.initResult.redirectUrl, walletLabel])

  return (
    <>
      <DrawerHeader className="border-b border-border pb-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5"
            onClick={onBackToCheckout}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back</span>
          </Button>
          <Badge variant="secondary">Paynow</Badge>
        </div>
        <DrawerTitle className="pt-1 text-lg font-bold">Authorize Payment</DrawerTitle>
      </DrawerHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 space-y-5">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex size-16 items-center justify-center rounded-full border border-dashed border-primary/50 bg-primary/10 text-primary">
            <Smartphone className="size-8" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Waiting for {walletLabel} confirmation
            </p>
            <p className="text-xs text-muted-foreground">
              Your items are reserved while we await confirmation.
            </p>
          </div>
        </div>

        <Alert>
          <div className="space-y-1 text-xs leading-relaxed">
            <div className="font-semibold text-foreground">Payment Instructions</div>
            <p className="text-muted-foreground whitespace-pre-line">
              {pendingPayment.instructions}
            </p>
          </div>
        </Alert>

        <Card className="text-xs">
          <CardContent className="space-y-2.5">
            {pendingPayment.mobileMethod === 'innbucks' && innbucksInfo && (
              <div className="flex flex-col items-center justify-center gap-2">
                <QRCode
                  className="rounded-lg border border-border"
                  value={innbucksInfo.authorizationcode}
                />
                <div className="relative w-[256px]">
                  <pre className="p-4 bg-muted text-xs overflow-x-auto border border-border rounded-lg">
                    <code>{innbucksInfo.authorizationcode}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2 h-8 gap-1 text-xs"
                    onClick={() => handleCopy('hey')}
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Code
                      </>
                    )}
                  </Button>
                </div>
                <Link
                  href={innbucksInfo.deep_link_url}
                  className="flex items-center gap-2 hover:text-primary hover:underline"
                >
                  <span>Pay in app</span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </Link>
                <div className="text-muted text-xs">
                  {formatExpiresAt(innbucksInfo.expires_at, { fallback: 'This code will expire' })}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Order Reference</span>
              <strong className="text-foreground">{pendingPayment.orderId}</strong>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Wallet</span>
              <strong className="text-foreground">{walletLabel}</strong>
            </div>
            {!!pendingPayment.mobileNumber && (
              <>
                <Separator />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Phone Number</span>
                  <strong className="text-foreground">{pendingPayment.mobileNumber}</strong>
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Paynow Status</span>
              <Badge variant="outline" className="gap-1.5 capitalize">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                <span>{paymentStatus || 'sent'}</span>
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Button
          type="button"
          size="lg"
          className="w-full gap-2"
          disabled={isChecking}
          onClick={onCheckStatus}
        >
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{isChecking ? 'Checking Paynow Status...' : 'I Have Paid — Check Status'}</span>
        </Button>
      </div>
    </>
  )
}
