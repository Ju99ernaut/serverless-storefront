'use client'

import Link from 'next/link'
import { ShieldCheck, Sparkles } from 'lucide-react'
import { Alert } from '../ui/alert'
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

interface AccountGuestPromptProps {
  totalCartCount: number
  onOpenAuthModal: () => void
}

export function AccountGuestPrompt({ totalCartCount, onOpenAuthModal }: AccountGuestPromptProps) {
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
              Create an account or sign in via Neon Managed Better Auth (Email or Google) to track
              orders, download Invoice/Receipt PDFs, sync your saved bag, and receive email shipping
              updates.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="w-full max-w-none space-y-4">
            {totalCartCount > 0 && (
              <Alert>
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="text-xs">
                  You currently have <strong>{totalCartCount}</strong> item(s) in your guest{' '}
                  <code>localStorage</code> bag &mdash; signing in will merge them automatically.
                </span>
              </Alert>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <Button type="button" onClick={onOpenAuthModal}>
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
