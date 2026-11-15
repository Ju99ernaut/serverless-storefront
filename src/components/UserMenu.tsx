'use client'

import Link from 'next/link'
import { ChevronDown, Heart, LogIn, LogOut, Package, User as UserIcon } from 'lucide-react'
import { useStore } from '../context/StoreContext'
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
  const { user, openAuthModal, signOut, wishlistSlugs, orders } = useStore()

  if (!user) {
    return (
      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={() => openAuthModal('account')}
        className={`rounded-none h-9 px-3 text-xs ${className}`}
      >
        <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Sign In</span>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open account menu"
          className={`inline-flex items-center gap-2 rounded-none border border-[var(--border-color)] bg-[var(--surface-elevated)] px-2 py-1 md:px-2 text-xs font-semibold text-[var(--fg-heading)] hover:border-[#5C5EDC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C5EDC] transition-colors cursor-pointer ${className}`}
        >
          <Avatar className="h-6 w-6 border border-[#5C5EDC]/40">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.name || 'User avatar'} />
            ) : null}
            <AvatarFallback>{getUserInitials(user.name, user.email)}</AvatarFallback>
          </Avatar>
          <ChevronDown
            className="hidden md:inline h-3.5 w-3.5 text-[var(--fg-muted)]"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9 border border-[#5C5EDC]/40 shrink-0">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.name || 'User avatar'} />
              ) : null}
              <AvatarFallback>{getUserInitials(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--fg-heading)] truncate">{user.name}</p>
              <p className="text-[11px] text-[var(--fg-muted)] truncate">{user.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account?tab=profile" className="w-full">
            <UserIcon className="h-4 w-4" aria-hidden="true" />
            <span>Profile &amp; Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account?tab=orders" className="w-full">
            <Package className="h-4 w-4" aria-hidden="true" />
            <span>Orders ({orders.length})</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account?tab=wishlist" className="w-full">
            <Heart className="h-4 w-4" aria-hidden="true" />
            <span>Loved Items ({wishlistSlugs.length})</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => signOut()}
          className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
