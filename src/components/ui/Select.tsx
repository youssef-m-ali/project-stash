import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className = '', children, ...props }, ref) => (
    <select
      ref={ref}
      className={`w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 disabled:opacity-50 ${
        error
          ? 'border-red-400 focus:ring-red-400'
          : 'border-zinc-200 dark:border-zinc-800'
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
