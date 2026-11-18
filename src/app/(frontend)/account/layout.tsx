import type { ReactNode } from 'react'
import { PageHeader } from '@/components/page-header'

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-anchor-parent bg-background pb-16">
      <PageHeader title="My Account Portal" />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
