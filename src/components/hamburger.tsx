'use client';

import { forwardRef } from 'react';
import { Filter } from 'lucide-react';

interface HamburgerProps {
  onOpen: () => void;
  className?: string;
}

const Hamburger = forwardRef<HTMLButtonElement, HamburgerProps>(
  ({ onOpen, className = '' }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-[var(--border-color)] bg-[var(--surface-elevated)] text-[var(--fg-heading)] hover:border-[#5C5EDC] hover:text-[#5C5EDC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C5EDC] transition-colors cursor-pointer ${className}`}
        aria-label="Filter products by category"
        title="Filter products"
        onClick={onOpen}
      >
        <Filter className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }
);

Hamburger.displayName = 'Hamburger';

export default Hamburger;
