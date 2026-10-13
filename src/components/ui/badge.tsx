import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-white/20',
  {
    variants: {
      variant: {
        default: 'border-white/10 bg-white/[0.08] text-[#F0F0F0]',
        secondary: 'border-white/10 bg-white/[0.04] text-[#B5B5B5]',
        destructive: 'border-red-800/40 bg-red-950/60 text-red-300',
        outline: 'border-white/15 text-[#B5B5B5]',
        success: 'border-emerald-800/40 bg-emerald-950/60 text-emerald-300',
        warning: 'border-amber-800/40 bg-amber-950/60 text-amber-300',
        info: 'border-white/15 bg-white/[0.06] text-[#F0F0F0]',
        present: 'border-emerald-700/50 bg-emerald-950/70 text-emerald-300 font-mono font-bold tracking-wide shadow-xs',
        absent: 'border-white/10 bg-white/[0.04] text-[#808080]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
