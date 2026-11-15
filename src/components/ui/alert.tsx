import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border p-3.5 text-sm flex items-start gap-3',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--surface-elevated)] text-[var(--fg-primary)] border-[var(--border-color)]',
        warning:
          'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300',
        destructive:
          'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-300',
        success:
          'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = 'Alert';

export { Alert };
