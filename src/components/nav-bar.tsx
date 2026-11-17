'use client'

import { useState, useEffect, type RefObject } from 'react'
import { useTheme } from 'next-themes'
import { ArrowUpDown, Moon, Search, Sun } from 'lucide-react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import Hamburger from './hamburger'
import UserMenu from './user-menu'

export type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'rating'

interface NavBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  sortBy: SortOption
  onSortChange: (value: SortOption) => void
  onOpenMenu: () => void
  hamburgerRef?: RefObject<HTMLButtonElement | null>
}

const NavBar = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  onOpenMenu,
  hamburgerRef,
}: NavBarProps) => {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme !== 'light' : true

  return (
    <div className="sticky-topbar-container">
      <div className="sticky-topbar-inner mx-auto max-w-[1300px]">
        <div className="flex items-center justify-between gap-2.5 sm:gap-4 px-4 py-3 sm:px-6">
          <Hamburger ref={hamburgerRef} onOpen={onOpenMenu} />

          <div className="flex flex-1 min-w-0 max-w-2xl items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search jackets, oxford shirts, boots..."
                aria-label="Search clothing products"
                className="pl-9"
              />
            </div>

            <div className="hidden lg:block w-44 shrink-0">
              <Select value={sortBy} onValueChange={(val) => onSortChange(val as SortOption)}>
                <SelectTrigger
                  aria-label="Sort products"
                  className="h-10 w-full border-border bg-secondary text-sm font-medium text-foreground cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ArrowUpDown
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <SelectValue placeholder="Sort products" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="price-asc">Price Asc</SelectItem>
                  <SelectItem value="price-desc">Price Desc</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex"
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-[#5C5EDC]" aria-hidden="true" />
              )}
            </Button>

            <UserMenu />
          </div>
        </div>
      </div>
    </div>
  )
}

export default NavBar
