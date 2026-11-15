'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  ArrowUpDown,
  Heart,
  LogOut,
  Moon,
  Search,
  ShoppingCart,
  Sparkles,
  Sun,
  User,
  X,
} from 'lucide-react';
import { getFilterDisplayName } from '../data/products';
import { useStore } from '../context/StoreContext';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'rating';

interface NavBarProps {
  activeFilter: string;
  onResetFilter: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  totalShowing: number;
  totalProducts: number;
}

const NavBar = ({
  activeFilter,
  onResetFilter,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  totalShowing,
  totalProducts,
}: NavBarProps) => {
  const filterLabel = getFilterDisplayName(activeFilter);
  const {
    user,
    wishlistSlugs,
    totalCartCount,
    setIsCartOpen,
    openAuthModal,
    signOut,
  } = useStore();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme !== 'light' : true;
  const hasActiveCriteria =
    (activeFilter && activeFilter !== 'all') || searchQuery.trim().length > 0;

  return (
    <header className="bp-header cf">
      {/* Top utility bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 pl-12 md:pl-0">
        <div className="flex items-center gap-2 text-left">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#5C5EDC] text-white shadow-sm">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <span className="block text-xs font-bold uppercase tracking-[0.22em] text-[#797BED]">
              Storefront Atelier
            </span>
            <span className="block text-xs text-[var(--fg-muted)]">
              Curated Apparel &amp; Footwear
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 text-[#5C5EDC]" aria-hidden="true" />
            )}
          </Button>

          <Button asChild variant="secondary" size="sm" className="gap-1.5">
            <Link href="/account?tab=wishlist" aria-label="Loved items wishlist">
              <Heart className="h-4 w-4 text-rose-500" aria-hidden="true" />
              <span className="hidden sm:inline">Loved</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {wishlistSlugs.length}
              </Badge>
            </Link>
          </Button>

          {user ? (
            <div className="flex items-center gap-1.5">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href="/account">
                  <User className="h-4 w-4 text-[#797BED]" aria-hidden="true" />
                  <span className="max-w-[120px] truncate">{user.name}</span>
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openAuthModal('account')}
              className="gap-1.5"
            >
              <User className="h-4 w-4" aria-hidden="true" />
              <span>Sign In</span>
            </Button>
          )}

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setIsCartOpen(true)}
            className="gap-1.5"
            aria-label={`Open shopping bag (${totalCartCount} items)`}
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            <span>Bag</span>
            <Badge className="bg-white/20 text-white border-none px-1.5 py-0 text-[11px]">
              {totalCartCount}
            </Badge>
          </Button>
        </div>
      </div>

      <h1>
        Filterable Clothing Atelier
        <span>
          Real-Time Variant Stock &bull; ImageKit Optimized &bull; Payload CMS +
          Neon Auth
        </span>
      </h1>

      {/* Search + Sort Toolbar */}
      <div className="mx-auto mt-4 flex max-w-2xl flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search jackets, oxford shirts, leather boots, brands..."
            aria-label="Search clothing products"
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search query"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--fg-muted)] hover:text-[var(--fg-heading)] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="relative flex items-center">
          <ArrowUpDown
            className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--fg-muted)]"
            aria-hidden="true"
          />
          <select
            aria-label="Sort products"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="h-10 w-full sm:w-48 rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] pl-9 pr-3 text-sm font-medium text-[var(--fg-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C5EDC] cursor-pointer"
          >
            <option value="featured">Sort: Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>
      </div>

      {hasActiveCriteria && (
        <div className="active-filter-banner" role="status" aria-live="polite">
          <span>
            Showing{' '}
            <strong>
              {activeFilter !== 'all' ? filterLabel : 'All Categories'}
            </strong>
            {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ''} (
            {totalShowing} of {totalProducts})
          </span>
          <button
            type="button"
            className="active-filter-reset"
            onClick={() => {
              onResetFilter();
              onSearchChange('');
            }}
          >
            <X className="h-3 w-3" aria-hidden="true" /> Reset
          </button>
        </div>
      )}
    </header>
  );
};

export default NavBar;
