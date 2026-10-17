import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-medium transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 cursor-pointer select-none',
  {
    variants: {
      variant: {
        default: 'bg-[#F0F0F0] text-[#080808] hover:bg-white font-semibold shadow-[0_2px_10px_rgba(255,255,255,0.12)] hover:shadow-[0_4px_16px_rgba(255,255,255,0.2)]',
        destructive: 'bg-red-950/60 text-red-300 border border-red-800/50 border-t-red-700/60 hover:bg-red-900/60 shadow-[0_0_15px_-3px_rgba(239,68,68,0.25)]',
        outline: 'border border-white/10 border-t-white/20 bg-white/[0.04] text-[#F0F0F0] hover:bg-white/[0.08] hover:border-white/25 backdrop-blur-md shadow-sm',
        secondary: 'bg-white/[0.08] text-[#F0F0F0] hover:bg-white/[0.14] border border-white/10 border-t-white/25 backdrop-blur-md shadow-sm',
        ghost: 'text-[#B5B5B5] hover:text-[#F0F0F0] hover:bg-white/[0.06] rounded-md',
        link: 'text-[#F0F0F0] underline-offset-4 hover:underline',
        success: 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 border-t-emerald-600/60 hover:bg-emerald-900/60 shadow-[0_0_15px_-3px_rgba(16,185,129,0.25)]',
        warning: 'bg-amber-950/60 text-amber-300 border border-amber-800/50 border-t-amber-600/60 hover:bg-amber-900/60 shadow-[0_0_15px_-3px_rgba(245,158,11,0.25)]',
        illuminated: 'bg-gradient-to-b from-white/[0.14] to-white/[0.04] border border-white/15 border-t-white/30 text-white hover:border-white/30 hover:from-white/[0.2] hover:to-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md',
        emerald: 'bg-emerald-600 hover:bg-emerald-500 text-white font-medium border border-emerald-400/30 border-t-emerald-300/50 shadow-[0_0_20px_-3px_rgba(16,185,129,0.4)] hover:shadow-[0_0_28px_0_rgba(16,185,129,0.55)]',
        purple: 'bg-purple-600/80 hover:bg-purple-500 text-white font-medium border border-purple-400/30 border-t-purple-300/50 shadow-[0_0_20px_-3px_rgba(168,85,247,0.35)] hover:shadow-[0_0_28px_0_rgba(168,85,247,0.5)]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7.5 rounded-lg px-3 text-xs',
        lg: 'h-10 rounded-xl px-6 text-sm',
        icon: 'h-8 w-8 rounded-lg',
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
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
