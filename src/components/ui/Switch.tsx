import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * ON / OFF SWITCH, 44×24, with the state also written next to it.
 *
 * The old toggle was 36×20 and its Off state was a grey pill on a grey card —
 * on the owner's screen "off" and "missing" looked the same. Now Off has a
 * visible outline and the knob sits left, On is filled with the accent colour,
 * and the words "On" / "Off" remove any doubt.
 */

/** The picture only — for use inside a larger clickable row (see ToggleRow). */
export function SwitchTrack({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-block w-11 h-6 shrink-0 rounded-full border-2 transition-colors',
        checked ? 'bg-primary border-primary' : 'bg-muted border-muted-foreground/50',
        className,
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 -translate-y-1/2 size-4 rounded-full shadow transition-all',
          checked ? 'left-[22px] bg-white' : 'left-0.5 bg-muted-foreground/80',
        )}
      />
    </span>
  );
}

/** "On" / "Off" next to the switch. Own text node so Bangla translates it. */
export function SwitchState({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        'text-sm font-medium w-8 shrink-0',
        checked ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {checked ? 'On' : 'Off'}
    </span>
  );
}

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name when there is no visible label next to it. */
  label?: string;
  /** Write "On" / "Off" after the switch (default true). */
  showState?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const Switch = forwardRef<HTMLButtonElement, Props>(
  ({ checked, onChange, label, showState = true, disabled, className, id }, ref) => (
    <button
      ref={ref}
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex items-center gap-2 rounded-md focus-ring disabled:opacity-50 disabled:pointer-events-none',
        className,
      )}
    >
      <SwitchTrack checked={checked} />
      {showState && <SwitchState checked={checked} />}
    </button>
  ),
);
Switch.displayName = 'Switch';
