import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AccountPortalContent } from '@/components/account'
import { AccountSkeleton } from '@/components/account/account-skeleton'

export const metadata: Metadata = {
  title: 'My Account',
  description:
    'Manage your Storefront ComposeIt orders, live delivery tracking, invoices, saved shopping bag, loved items, and profile details.',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: 'website',
    url: '/account',
    title: 'My Account — Storefront ComposeIt',
    description:
      'Manage your Storefront ComposeIt orders, live delivery tracking, invoices, saved bag, and profile settings.',
  },
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountPortalContent />
    </Suspense>
  )
}
