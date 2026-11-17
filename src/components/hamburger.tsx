'use client'

import { forwardRef } from 'react'
import { Filter } from 'lucide-react'
import { cn } from 'cn'

interface HamburgerProps {
  onOpen: () => void
  className?: string
}

const Hamburger = forwardRef<HTMLButtonElement, HamburgerProps>(
  ({ onOpen, className = '' }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-foreground hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors cursor-pointer',
          className,
        )}
        aria-label="Filter products by category"
        title="Filter products"
        onClick={onOpen}
      >
        <Filter className="h-4 w-4" aria-hidden="true" />
      </button>
    )
  },
)

Hamburger.displayName = 'Hamburger'

export default Hamburger
