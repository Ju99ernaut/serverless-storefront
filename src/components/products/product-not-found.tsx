import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import { buttonVariants } from '../ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../ui/empty'

export function ProductNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Empty className="max-w-md border border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShoppingBag aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle className="text-xl font-bold">Garment Not Found</EmptyTitle>
          <EmptyDescription>We couldn&apos;t locate the requested clothing item.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link className={buttonVariants()} href="/">
            Return to Storefront
          </Link>
        </EmptyContent>
      </Empty>
    </div>
  )
}
