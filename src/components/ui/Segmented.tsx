import { KeyboardEvent, ReactNode, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * A ROW OF CHOICES WHERE EXACTLY ONE IS PICKED (Cash | bKash | Card, Retail |
 * Wholesale, Today | This week …).
 *
 * Replaces ~20 hand-made chip rows that each had their own size (often 28px and
 * 11px text) and no keyboard or screen-reader support. 40px tall, `text-sm`,
 * the picked one filled with the accent colour so it is obvious at a glance.
 *
 * Keyboard: Tab lands on the picked choice; ← / → (and Home / End) move and pick.
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Tooltip, e.g. a shortcut key. */
  title?: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** Read out by screen readers for the whole group, e.g. "Payment method". */
  ariaLabel: string;
  /** Stretch to the container, all choices the same width. */
  fullWidth?: boolean;
  /** `sm` = 32px for dense toolbars; default 40px. */
  size?: 'sm' | 'md';
  className?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  fullWidth,
  size = 'md',
  className,
}: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, dir: 1 | -1 | 'first' | 'last') => {
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    if (enabled.length === 0) return;
    let next: number;
    if (dir === 'first') next = enabled[0];
    else if (dir === 'last') next = enabled[enabled.length - 1];
    else {
      const pos = enabled.indexOf(from);
      next = enabled[(pos + dir + enabled.length) % enabled.length];
    }
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(i, 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(i, -1);
    else if (e.key === 'Home') move(i, 'first');
    else if (e.key === 'End') move(i, 'last');
    else return;
    e.preventDefault();
  };

  const picked = options.findIndex((o) => o.value === value);

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'rounded-md border border-border bg-secondary/40 p-0.5 gap-0.5',
        fullWidth ? 'grid w-full' : 'inline-flex flex-wrap',
        className,
      )}
      style={fullWidth ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            title={o.title}
            // Roving tab stop: only the picked choice (or the first) is in the Tab order.
            tabIndex={on || (picked === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded px-3 font-medium whitespace-nowrap transition focus-ring disabled:opacity-40 disabled:pointer-events-none',
              size === 'sm' ? 'h-7 text-xs' : 'h-9 text-sm',
              on
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground/80 hover:bg-card hover:text-foreground',
            )}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
