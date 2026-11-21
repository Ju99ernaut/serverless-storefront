'use client'

import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
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
import { useAuth } from '@/context'

export function AccountGuestPrompt() {
  const { openAuthModal } = useAuth()

  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="p-6">
        <Empty className="p-2">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldCheck aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle className="text-xl font-bold">
              Sign in to manage orders &amp; saved wardrobe
            </EmptyTitle>
            <EmptyDescription>
              Create an account or sign in via email or Google to track orders, download
              Invoice/Receipt PDFs, sync your saved bag, and see delivery updates.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="w-full max-w-none space-y-4">
            <div className="flex flex-wrap justify-center gap-3">
              <Button type="button" onClick={() => openAuthModal('account')}>
                Sign In / Create Account
              </Button>
              <Link className={buttonVariants({ variant: 'outline' })} href="/">
                Continue Browsing
              </Link>
            </div>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  )
}
