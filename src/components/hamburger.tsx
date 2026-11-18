'use client'

import { forwardRef } from 'react'
import { Filter } from 'lucide-react'
import { Button } from './ui/button'

interface HamburgerProps {
  onOpen: () => void
  className?: string
}

const Hamburger = forwardRef<HTMLButtonElement, HamburgerProps>(
  ({ onOpen, className = '' }, ref) => {
    return (
      <Button
        ref={ref}
        type="button"
        className={className}
        aria-label="Filter products by category"
        title="Filter products"
        onClick={onOpen}
        variant="outline"
        size="icon"
      >
        <Filter className="h-4 w-4" aria-hidden="true" />
      </Button>
    )
  },
)

Hamburger.displayName = 'Hamburger'

export default Hamburger
