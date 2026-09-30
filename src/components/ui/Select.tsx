import { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * The native dropdown, styled to match `Input` (40px, same border, focus ring
 * and text size). Native on purpose: it is keyboard friendly, opens a list the
 * size of the screen, and needs no library.
 *
 * Replaces the ~50 hand-copied `<select className="h-9 …">` strings, which had
 * drifted (some h-8, some text-xs, some without a focus ring).
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/50 focus:border-ring/60 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = 'Select';
