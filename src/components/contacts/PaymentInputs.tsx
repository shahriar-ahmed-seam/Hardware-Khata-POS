import { Banknote, Smartphone, CreditCard, Building2 } from 'lucide-react';
import { NumberField } from '@/components/ui/NumberField';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { cn, formatBDT } from '@/lib/utils';

/**
 * The money part of Receive payment / Pay supplier: a big Amount first (the
 * caret lands there), quick-fill chips, the method tiles, and a reference box
 * whose label says what to type for that method. The row height is kept so
 * nothing jumps when the method changes.
 */
export type PayMethod = 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank';

export const PAY_METHODS: { id: PayMethod; icon: typeof Banknote; label: string }[] = [
  { id: 'Cash', icon: Banknote, label: 'Cash' },
  { id: 'bKash', icon: Smartphone, label: 'bKash' },
  { id: 'Nagad', icon: Smartphone, label: 'Nagad' },
  { id: 'Card', icon: CreditCard, label: 'Card' },
  { id: 'Bank', icon: Building2, label: 'Bank' },
];

const REF_LABEL: Record<Exclude<PayMethod, 'Cash'>, string> = {
  bKash: 'bKash transaction ID (optional)',
  Nagad: 'Nagad transaction ID (optional)',
  Card: 'Card slip no. (optional)',
  Bank: 'Bank reference (optional)',
};

export function AmountInput({
  amount,
  onAmount,
  full,
  fullLabel,
}: {
  amount: number;
  onAmount: (n: number) => void;
  /** What "Full" fills in (the due / payable). */
  full: number;
  fullLabel: string;
}) {
  return (
    <FormField label="Amount">
      {(f) => (
        <div className="space-y-2">
          <NumberField
            {...f}
            autoFocus
            value={amount}
            onChangeNumber={onAmount}
            className="h-12 text-2xl text-right font-semibold"
          />
          {full > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onAmount(full)}
                className="h-9 px-3 text-sm rounded-md border border-border hover:bg-secondary inline-flex items-center gap-1.5"
              >
                <span>{fullLabel}</span>
                <span className="tabular font-semibold">{formatBDT(full)}</span>
              </button>
              <button
                type="button"
                onClick={() => onAmount(Math.round(full / 2))}
                className="h-9 px-3 text-sm rounded-md border border-border hover:bg-secondary"
              >
                Half
              </button>
            </div>
          )}
        </div>
      )}
    </FormField>
  );
}

export function MethodPicker({
  method,
  onMethod,
  reference,
  onReference,
}: {
  method: PayMethod;
  onMethod: (m: PayMethod) => void;
  reference: string;
  onReference: (s: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-5 gap-1.5">
        {PAY_METHODS.map((m) => {
          const Icon = m.icon;
          const on = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onMethod(m.id)}
              className={cn(
                'h-14 rounded-md border text-sm font-medium transition inline-flex flex-col items-center justify-center gap-1',
                on ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary',
              )}
            >
              <Icon className="size-4" />
              {m.label}
            </button>
          );
        })}
      </div>
      {/* Reserved height: the box appears for non-cash without shifting the layout. */}
      <div className="min-h-[4.75rem]">
        {method !== 'Cash' && (
          <FormField label={REF_LABEL[method]}>
            {(f) => <Input {...f} value={reference} onChange={(e) => onReference(e.target.value)} />}
          </FormField>
        )}
      </div>
    </div>
  );
}

/** Footer line: what is being paid and what is left after it. */
export function PaySummary({
  amount,
  owed,
  afterLabel,
  verb = 'Receiving',
}: {
  amount: number;
  owed: number;
  afterLabel: string;
  verb?: 'Receiving' | 'Paying';
}) {
  const after = Math.max(0, owed - amount);
  const advance = Math.max(0, amount - owed);
  return (
    <div className="text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
      <span>
        <span className="text-muted-foreground">{verb}</span>{' '}
        <span className="tabular font-semibold text-success">{formatBDT(amount)}</span>
      </span>
      {advance > 0 ? (
        <span>
          <span className="text-muted-foreground">Advance</span>{' '}
          <span className="tabular font-semibold">{formatBDT(advance)}</span>
        </span>
      ) : (
        <span>
          <span className="text-muted-foreground">{afterLabel}</span>{' '}
          <span className={cn('tabular font-semibold', after > 0 && 'text-destructive')}>{formatBDT(after)}</span>
        </span>
      )}
    </div>
  );
}
