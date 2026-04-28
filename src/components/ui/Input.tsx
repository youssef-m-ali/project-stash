import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-lg border px-3 py-2 text-sm bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 ${
        error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-zinc-600'
      } ${className}`}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
