'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Heart, LogIn, LogOut, Package, User as UserIcon } from 'lucide-react'
import { CACHE_TIMES, storefrontQueryKeys, useAuth, useWishlist } from '../context'
import { fetchUserOrdersViaSdk } from '../lib/payload-sdk'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Button } from './ui/button'

export function getUserInitials(name?: string | null, email?: string | null): string {
  const cleanName = String(name || '').trim()
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return cleanName.slice(0, 2).toUpperCase()
  }
  const cleanEmail = String(email || '').trim()
  if (cleanEmail) {
    return cleanEmail.slice(0, 2).toUpperCase()
  }
  return 'TS'
}

interface UserMenuProps {
  className?: string
}

export default function UserMenu({ className = '' }: UserMenuProps) {
  const { user, openAuthModal, signOut } = useAuth()
  const { wishlistSlugs } = useWishlist()
  const { data: ordersData } = useQuery({
    queryKey: storefrontQueryKeys.orders(user?.email),
    queryFn: () => fetchUserOrdersViaSdk(user!.email),
    enabled: Boolean(user?.email),
    ...CACHE_TIMES.orders,
  })
  const orders = ordersData?.orders ?? []

  if (!user) {
    return (
      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={() => openAuthModal('account')}
        className={className}
      >
        <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Sign In</span>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            aria-label="Open account menu"
            className={className}
            variant="outline"
          >
            <Avatar className="h-6 w-6">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.name || 'User avatar'} />
              ) : null}
              <AvatarFallback>{getUserInitials(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <ChevronDown
              className="hidden md:inline h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9 shrink-0">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.name || 'User avatar'} />
              ) : null}
              <AvatarFallback>{getUserInitials(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{user.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link href="/account?tab=profile" className="w-full">
              <UserIcon className="h-4 w-4" aria-hidden="true" />
              <span>Profile &amp; Settings</span>
            </Link>
          }
        />
        <DropdownMenuItem
          render={
            <Link href="/account?tab=orders" className="w-full">
              <Package className="h-4 w-4" aria-hidden="true" />
              <span>Orders ({orders.length})</span>
            </Link>
          }
        />

        <DropdownMenuItem
          render={
            <Link href="/account?tab=wishlist" className="w-full">
              <Heart className="h-4 w-4" aria-hidden="true" />
              <span>Loved Items ({wishlistSlugs.length})</span>
            </Link>
          }
        />

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()} variant="destructive">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
