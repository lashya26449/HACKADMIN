import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-lg border border-white/12 bg-white/[0.035] px-3 py-1 text-xs text-[#F0F0F0] placeholder:text-[#808080] backdrop-blur-md transition-all file:border-0 file:bg-transparent file:text-xs file:font-medium focus-visible:border-white/35 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-40',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
