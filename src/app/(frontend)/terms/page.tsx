import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service governing accounts, stock reservation, checkout, payments, and orders on Storefront Atelier.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    type: 'website',
    url: '/terms',
    title: 'Terms of Service — Storefront Atelier',
    description:
      'Terms of Service governing accounts, stock reservation, checkout, payments, and orders on Storefront Atelier.',
  },
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky-topbar-container border-b border-border bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-1.5' })}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Store</span>
            </Link>
            <span className="hidden text-sm font-bold text-foreground sm:inline">
              Storefront Atelier
            </span>
          </div>

          <Link href="/privacy" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Privacy Policy
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <Card>
          <CardHeader className="space-y-2 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Legal &amp; Storefront Terms</span>
              </Badge>
              <span className="text-xs text-muted-foreground">Effective: November 2026</span>
            </div>
            <CardTitle className="text-2xl font-bold">Terms of Service</CardTitle>
            <CardDescription>
              Please review these terms carefully before creating an account, reserving inventory,
              or placing an order with Storefront Atelier.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-6 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                1. Overview &amp; Acceptance of Terms
              </h2>
              <p>
                By accessing Storefront Atelier, browsing our curated clothing and footwear catalog,
                registering an account, or completing a purchase, you agree to be bound by these
                Terms of Service and our{' '}
                <Link
                  href="/privacy"
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                2. Account Registration &amp; Authentication
              </h2>
              <p>
                Accounts are powered by Neon Managed Better Auth and support both email/password
                authentication and Google OAuth sign-in. You are responsible for safeguarding your
                credentials and any activity performed under your account. When signing in or
                registering, selecting <strong>Remember me</strong> extends session persistence
                across browser restarts on trusted devices.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                3. Durable Stock Reservation &amp; Checkout Workflow
              </h2>
              <p>
                Inventory is tracked per SKU variant (size and color) and allocated atomically
                during checkout via our durable checkout workflow. Submitting an order places a
                temporary reservation lock on the requested quantities to prevent overselling. If an
                upfront card payment fails or is cancelled prior to completion, reserved stock is
                automatically released back to live storefront availability.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                4. Payment &amp; Fulfillment Options
              </h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong className="text-foreground">Pay Now &amp; Home Delivery:</strong> Upfront
                  card payment with tracked courier delivery ($12 flat fee) to your shipping
                  address.
                </li>
                <li>
                  <strong className="text-foreground">Pay Now &amp; Store Collection:</strong>{' '}
                  Upfront card payment with complimentary pickup at your selected boutique location.
                </li>
                <li>
                  <strong className="text-foreground">Pay on Delivery (COD):</strong> Stock is
                  reserved now and payment is collected by the courier upon arrival ($12 delivery
                  fee applies).
                </li>
                <li>
                  <strong className="text-foreground">Pay on Collection:</strong> Items are held at
                  your chosen boutique for up to 48 hours so you can inspect and pay in-store.
                </li>
              </ul>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                5. Invoices, Receipts &amp; Order Tracking
              </h2>
              <p>
                Upon order confirmation, Storefront Atelier generates PDF Invoice and Receipt
                documents and dispatches confirmation and fulfillment status notifications to your
                checkout email address. You can review order history, download documents, and track
                fulfillment milestones at any time in your{' '}
                <Link
                  href="/account"
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  Account Portal
                </Link>
                .
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                6. User Reviews &amp; Conduct
              </h2>
              <p>
                Signed-in customers may submit product ratings and reviews. Submitted reviews must
                reflect genuine product feedback and must not contain unlawful, abusive, or
                misleading content. We reserve the right to moderate or remove content that violates
                these standards.
              </p>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/50 p-4 text-xs">
              <div className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Questions about these terms or how your account data is handled?</span>
              </div>
              <Link
                href="/privacy"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Read Privacy Policy
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
