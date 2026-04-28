import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className = '', children, ...props }, ref) => (
    <select
      ref={ref}
      className={`w-full rounded-lg border px-3 py-2 text-sm bg-zinc-800 text-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 ${
        error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-zinc-600'
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
