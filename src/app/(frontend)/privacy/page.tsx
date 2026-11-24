import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy describing how Storefront ComposeIt collects, authenticates, stores, and protects customer information.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    type: 'website',
    url: '/privacy',
    title: 'Privacy Policy — Storefront ComposeIt',
    description:
      'How Storefront ComposeIt collects, uses, and protects your personal information when you browse, sign in, and place orders.',
  },
}

export default function PrivacyPolicyPage() {
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
              Storefront ComposeIt
            </span>
          </div>

          <Link href="/terms" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Terms of Service
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <Card>
          <CardHeader className="space-y-2 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Data Protection &amp; Privacy</span>
              </Badge>
              <span className="text-xs text-muted-foreground">Effective: November 2026</span>
            </div>
            <CardTitle className="text-2xl font-bold">Privacy Policy</CardTitle>
            <CardDescription>
              How Storefront ComposeIt collects, uses, and protects your personal information when
              you browse, sign in, and place orders.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-6 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">1. Information We Collect</h2>
              <p>
                When you register or check out on Storefront ComposeIt, we collect the details
                needed to maintain your account and fulfill your orders, including your full name,
                email address, phone number, shipping or boutique collection preferences, saved
                shopping bag items, loved products, and order history.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                2. Authentication, Sessions &amp; &ldquo;Remember Me&rdquo; Cookies
              </h2>
              <p>
                Authentication is managed through Neon Managed Better Auth using secure HTTP session
                cookies. When you sign in with email and password or Google OAuth, we store session
                tokens to keep your account authenticated. Checking <strong>Remember me</strong>{' '}
                instructs the session handler to retain your authenticated session across browser
                restarts. Guest shopping bags are stored locally in your browser&apos;s{' '}
                <code>localStorage</code> and merged into your account upon sign-in.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">3. How We Use Your Data</h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Allocating SKU stock reservations and executing durable checkout workflows.</li>
                <li>Coordinating courier deliveries or preparing in-store boutique collections.</li>
                <li>
                  Generating downloadable Invoice and Receipt PDFs and sending transactional order
                  confirmation and status emails.
                </li>
                <li>
                  Syncing your saved bag, wishlist items, and profile preferences across sessions.
                </li>
              </ul>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                4. Infrastructure &amp; Security
              </h2>
              <p>
                Storefront data is persisted using Neon Postgres and Payload CMS, with media assets
                served through Cloudflare R2(or any S3 compatible media storage) and ImageKit.
                Cardholder inputs submitted during upfront checkout are transmitted over encrypted
                connections for payment processing and are never stored in plain text.
              </p>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                5. Your Rights &amp; Account Controls
              </h2>
              <p>
                You can view and update your profile name, email address, phone number, avatar,
                password, and saved shipping address anytime inside the{' '}
                <Link
                  href="/account?tab=profile"
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  Account Portal
                </Link>
                , or clear your local guest bag directly from the shopping bag drawer.
              </p>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/50 p-4 text-xs">
              <div className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Review our storefront terms for orders, stock holds, and returns.</span>
              </div>
              <Link href="/terms" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                Read Terms of Service
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
