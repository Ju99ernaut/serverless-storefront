import { Suspense } from 'react'
import { AccountPortalContent } from '@/components/account'
import { AccountSkeleton } from '@/components/account/account-skeleton'

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountPortalContent />
    </Suspense>
  )
}
