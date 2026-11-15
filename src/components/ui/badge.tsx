import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-none border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#5C5EDC] text-white',
        secondary:
          'border-[var(--border-color)] bg-[var(--surface-elevated)] text-[var(--fg-primary)]',
        outline:
          'border-[#5C5EDC] text-[#5C5EDC] bg-[#5C5EDC]/10',
        warning:
          'border-amber-500/40 bg-amber-500/15 text-amber-500 dark:text-amber-400',
        destructive:
          'border-red-500/40 bg-red-500/15 text-red-500 dark:text-red-400',
        success:
          'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
