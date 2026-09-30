import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * A BUTTON THAT IS ONLY AN ICON — with the words it stands for.
 *
 * Replaces ~80 bare `size-7` (28px) icon buttons, most with no tooltip and no
 * name for a screen reader, often faded to 60% until hovered. `label` is
 * required and becomes both the tooltip and the accessible name, so nobody has
 * to guess what a pencil or a bin does.
 *
 * Sizes: `sm` 36px (table rows), `md` 40px (default, next to 40px fields).
 * Destructive actions: `tone="danger"`.
 */

type Variant = 'ghost' | 'outline';
type Tone = 'default' | 'danger' | 'primary';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** What the button does, in words: "Edit customer", "Delete line". */
  label: string;
  size?: 'sm' | 'md';
  variant?: Variant;
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  default: 'text-muted-foreground hover:text-foreground hover:bg-secondary',
  primary: 'text-primary hover:bg-primary/10',
  danger: 'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
};

export const IconButton = forwardRef<HTMLButtonElement, Props>(
  ({ label, size = 'md', variant = 'ghost', tone = 'default', className, title, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={title ?? label}
      className={cn(
        'inline-grid place-items-center shrink-0 rounded-md transition focus-ring disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'size-9' : 'size-10',
        variant === 'outline' && 'border border-border bg-card',
        tones[tone],
        variant === 'outline' && tone === 'danger' && 'hover:border-destructive/50',
        variant === 'outline' && tone !== 'danger' && 'hover:border-primary/50',
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = 'IconButton';
