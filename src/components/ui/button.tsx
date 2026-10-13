import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-[#F0F0F0] text-[#080808] hover:bg-white font-semibold shadow-sm',
        destructive: 'bg-red-950/60 text-red-300 border border-red-800/50 hover:bg-red-900/60',
        outline: 'border border-white/10 bg-white/[0.045] text-[#F0F0F0] hover:bg-white/[0.08] hover:border-white/20',
        secondary: 'bg-white/[0.08] text-[#F0F0F0] hover:bg-white/[0.12] border border-white/10',
        ghost: 'text-[#B5B5B5] hover:text-[#F0F0F0] hover:bg-white/[0.05]',
        link: 'text-[#F0F0F0] underline-offset-4 hover:underline',
        success: 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/60',
        warning: 'bg-amber-950/60 text-amber-300 border border-amber-800/50 hover:bg-amber-900/60',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 rounded-md px-2.5 text-xs',
        lg: 'h-10 rounded-lg px-6 text-sm',
        icon: 'h-8 w-8 rounded-md',
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
