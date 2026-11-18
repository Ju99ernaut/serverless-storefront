'use client'

import type { StoreUserRecord } from '@/data/utils'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { getUserInitials } from '../user-menu'

interface AccountHeaderProps {
  user: StoreUserRecord
  ordersCount: number
  wishlistCount: number
  totalCartCount: number
}

export function AccountHeader({
  user,
  ordersCount,
  wishlistCount,
  totalCartCount,
}: AccountHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-none border border-[var(--border-color)] bg-[var(--surface-card)] p-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14 border border-[#5C5EDC]/40">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
          <AvatarFallback className="text-lg">
            {getUserInitials(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--fg-heading)]">{user.name}</h1>
          </div>
          <p className="text-sm text-[var(--fg-muted)]">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-none border border-[var(--border-color)] bg-[var(--surface-elevated)] px-4 py-2.5">
          <div className="text-lg font-bold text-[var(--fg-heading)]">{ordersCount}</div>
          <div className="text-[11px] text-[var(--fg-muted)]">Orders</div>
        </div>
        <div className="rounded-none border border-[var(--border-color)] bg-[var(--surface-elevated)] px-4 py-2.5">
          <div className="text-lg font-bold text-[var(--fg-heading)]">{wishlistCount}</div>
          <div className="text-[11px] text-[var(--fg-muted)]">Loved</div>
        </div>
        <div className="rounded-none border border-[var(--border-color)] bg-[var(--surface-elevated)] px-4 py-2.5">
          <div className="text-lg font-bold text-[var(--fg-heading)]">{totalCartCount}</div>
          <div className="text-[11px] text-[var(--fg-muted)]">Saved Bag</div>
        </div>
      </div>
    </div>
  )
}
