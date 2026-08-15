import { forwardRef, useRef } from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { nowLocalInput, todayLocalDateInput } from '@/lib/datetime';

/**
 * A DATE (+ TIME) BOX YOU CAN EITHER TYPE INTO OR PICK FROM A CALENDAR.
 *
 * WHY THE CALENDAR WAS "MISSING"
 * These were already `<input type="datetime-local">`, which Chromium does give a
 * calendar to — but only through a small indicator glyph at the right-hand edge,
 * and clicking the rest of the box just puts a caret in it. Two things made that
 * glyph effectively invisible in this app:
 *
 *   1. The app never declared `color-scheme`, so in dark mode Chromium drew its
 *      dark glyph on a dark input. (Fixed globally in styles/globals.css — that
 *      one line also fixes the native dropdown and scrollbar rendering.)
 *   2. Even in light mode it is ~12px of low-contrast icon with no hit target an
 *      elderly user would find, let alone aim at.
 *
 * So this adds an unmissable button that calls `showPicker()` — the same native
 * calendar, on purpose: it is keyboard accessible, localised by Windows, and
 * there is no third-party date library in this project to hand-roll one with.
 * `showPicker()` needs a user gesture, which a click is, and it has been in
 * Chromium since 99 (this app ships Electron 22 / Chromium 108).
 *
 * TYPING STILL WORKS. The input is untouched underneath, so a fast user can key
 * `15/08/2026 10:30` straight in and never see the calendar. That was the
 * requirement: keep both.
 *
 * THE VALUE IS LOCAL WALL-CLOCK TIME, not an instant. Fill it with
 * `toLocalInput()` and convert on save with `fromLocalInput()` — see
 * lib/datetime.ts for why that distinction matters here.
 */

interface BaseProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  title?: string;
  /** Jump the field to right now / today. Shown by default on datetime fields. */
  showNowButton?: boolean;
}

/** Date **and** time. Use for anything that happens at a moment (a sale, a payment). */
export const DateTimeField = forwardRef<HTMLInputElement, BaseProps>(function DateTimeField(
  { value, onChange, className, min, max, required, disabled, title, showNowButton = true },
  forwardedRef,
) {
  const localRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    const el = localRef.current;
    if (!el || disabled) return;
    // Not every engine has it (and a browser preview might not). Focusing is a
    // reasonable fallback — it at least puts the caret where the user aimed.
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // Chromium throws if it decides the gesture was not user-initiated.
      }
    }
    el.focus();
  };

  return (
    <div className={cn('flex items-stretch gap-1.5', className)}>
      <input
        ref={(node) => {
          localRef.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        type="datetime-local"
        value={value}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        title={title}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/50 focus:border-ring/60 disabled:opacity-50 tabular"
      />
      {showNowButton && (
        <button
          type="button"
          onClick={() => onChange(nowLocalInput())}
          disabled={disabled}
          title="Set to right now"
          aria-label="Set to right now"
          className="h-9 w-9 shrink-0 grid place-items-center rounded-md border border-border text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-primary transition disabled:opacity-50"
        >
          <Clock className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        title="Pick from a calendar"
        aria-label="Pick from a calendar"
        className="h-9 w-9 shrink-0 grid place-items-center rounded-md border border-border text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-primary transition disabled:opacity-50"
      >
        <CalendarDays className="size-4" />
      </button>
    </div>
  );
});

/** Date only. Use for a day with no meaningful time (a birthday, "valid until"). */
export const DateField = forwardRef<HTMLInputElement, BaseProps>(function DateField(
  { value, onChange, className, min, max, required, disabled, title, showNowButton = false },
  forwardedRef,
) {
  const localRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    const el = localRef.current;
    if (!el || disabled) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // See the note in DateTimeField.
      }
    }
    el.focus();
  };

  return (
    <div className={cn('flex items-stretch gap-1.5', className)}>
      <input
        ref={(node) => {
          localRef.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        type="date"
        value={value}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        title={title}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/50 focus:border-ring/60 disabled:opacity-50 tabular"
      />
      {showNowButton && (
        <button
          type="button"
          onClick={() => onChange(todayLocalDateInput())}
          disabled={disabled}
          title="Set to today"
          aria-label="Set to today"
          className="h-9 w-9 shrink-0 grid place-items-center rounded-md border border-border text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-primary transition disabled:opacity-50"
        >
          <Clock className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        title="Pick from a calendar"
        aria-label="Pick from a calendar"
        className="h-9 w-9 shrink-0 grid place-items-center rounded-md border border-border text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-primary transition disabled:opacity-50"
      >
        <CalendarDays className="size-4" />
      </button>
    </div>
  );
});
