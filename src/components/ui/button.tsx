import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C5EDC] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-[#5C5EDC] text-white hover:bg-[#494BC7] border border-[#5C5EDC]',
        destructive:
          'bg-red-600 text-white hover:bg-red-700 border border-red-600',
        outline:
          'border border-[var(--border-color)] bg-transparent text-[var(--fg-primary)] hover:border-[#5C5EDC] hover:text-[#5C5EDC]',
        secondary:
          'bg-[var(--surface-elevated)] text-[var(--fg-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-color)]',
        ghost:
          'hover:bg-[var(--surface-elevated)] hover:text-[#5C5EDC] text-[var(--fg-primary)]',
        link: 'text-[#5C5EDC] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-none px-3 text-xs',
        lg: 'h-11 rounded-none px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
