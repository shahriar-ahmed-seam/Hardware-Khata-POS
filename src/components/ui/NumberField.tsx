import { InputHTMLAttributes, forwardRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Numeric input that allows free typing — including leading 0, decimals (".",
 * "5.", "0.5"), empty state, and negatives.
 *
 * Why a custom component:
 *   <input type="number" value={n || ''}> with `onChange={Number(...)}` silently
 *   eats `0` (because `0 || '' === ''`) and decimal points ("5." → Number → 5
 *   → dot disappears), making fields feel "broken".
 *
 * Implementation: keeps an internal *string* representation so the user can
 * type freely; emits a numeric value via onChangeNumber whenever the string
 * parses as a finite number (or 0 when empty).
 */
interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onChangeNumber: (n: number) => void;
  allowNegative?: boolean;
}

export const NumberField = forwardRef<HTMLInputElement, Props>(
  ({ value, onChangeNumber, allowNegative = false, className, placeholder, ...rest }, ref) => {
    const [text, setText] = useState<string>(value === 0 ? '' : String(value));

    // Keep internal text synced when the external value changes externally
    // (resets, programmatic updates) — but NOT while the user is mid-typing.
    useEffect(() => {
      const parsed = text === '' ? 0 : Number(text);
      if (parsed !== value) {
        setText(value === 0 ? '' : String(value));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const pattern = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder ?? '0'}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          if (next === '' || pattern.test(next)) {
            setText(next);
            // Treat blank, lone "-", or lone "." as zero for the numeric value
            const n = next === '' || next === '-' || next === '.' ? 0 : Number(next);
            if (Number.isFinite(n)) onChangeNumber(n);
          }
        }}
        className={cn(
          'h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring/60 disabled:opacity-50 font-mono tabular',
          className,
        )}
        {...rest}
      />
    );
  },
);
NumberField.displayName = 'NumberField';
