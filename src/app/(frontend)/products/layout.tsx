import type { ReactNode } from 'react'
import { PageHeader } from '@/components/page-header'

export default function ProductsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-anchor-parent bg-background pb-16">
      <PageHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
