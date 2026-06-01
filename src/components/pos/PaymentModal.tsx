import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Smartphone,
  CreditCard,
  Building2,
  HandCoins,
  Plus,
  Trash2,
  ArrowRight,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn, formatBDT } from '@/lib/utils';
import { NumberField } from '@/components/ui/NumberField';

export type PaymentMethod = 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank' | 'Credit';

const METHODS: { id: PaymentMethod; icon: any; label: string; needsRef?: boolean }[] = [
  { id: 'Cash',   icon: Banknote,   label: 'Cash' },
  { id: 'bKash',  icon: Smartphone, label: 'bKash', needsRef: true },
  { id: 'Nagad',  icon: Smartphone, label: 'Nagad', needsRef: true },
  { id: 'Card',   icon: CreditCard, label: 'Card',  needsRef: true },
  { id: 'Bank',   icon: Building2,  label: 'Bank',  needsRef: true },
  { id: 'Credit', icon: HandCoins,  label: 'Credit' },
];

export interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface PaymentResult {
  payments: PaymentLine[];
  totalPaid: number;
  change: number;
  due: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  total: number;
  customerCreditLimit?: number;
  customerCurrentDue?: number;
  startMode?: 'single' | 'split';
  onConfirm: (result: PaymentResult) => void;
}

const QUICK_TENDERS = [100, 200, 500, 1000, 2000];

export function PaymentModal({
  open,
  onClose,
  total,
  customerCreditLimit,
  customerCurrentDue = 0,
  startMode = 'single',
  onConfirm,
}: Props) {
  const [mode, setMode] = useState<'single' | 'split'>(startMode);
  const [payments, setPayments] = useState<PaymentLine[]>([
    { id: 'p1', method: 'Cash', amount: total },
  ]);

  // Reset state when re-opened
  useEffect(() => {
    if (open) {
      setMode(startMode);
      setPayments([{ id: 'p1', method: 'Cash', amount: total }]);
    }
  }, [open, total, startMode]);

  const totalPaid = useMemo(() => payments.reduce((s, p) => s + (p.amount || 0), 0), [payments]);
  const remaining = Math.max(0, total - totalPaid);
  const change = totalPaid > total ? totalPaid - total : 0;
  // Credit cap check (only if any line is "Credit")
  const creditAmount = payments.filter((p) => p.method === 'Credit').reduce((s, p) => s + p.amount, 0);
  const newDue = customerCurrentDue + creditAmount;
  const overCreditLimit =
    creditAmount > 0 && customerCreditLimit !== undefined && newDue > customerCreditLimit;

  const setPayment = (id: string, patch: Partial<PaymentLine>) =>
    setPayments((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addPayment = () =>
    setPayments((ps) => [
      ...ps,
      { id: 'p' + (ps.length + 1) + Date.now(), method: 'Cash', amount: remaining },
    ]);

  const removePayment = (id: string) =>
    setPayments((ps) => (ps.length > 1 ? ps.filter((p) => p.id !== id) : ps));

  // SINGLE-MODE convenience: switching method updates the single payment line.
  // SPLIT mode keeps multiple lines.
  const single = payments[0];

  const confirm = () => {
    onConfirm({
      payments: payments.filter((p) => p.amount > 0),
      totalPaid,
      change,
      due: remaining,
    });
  };

  const canConfirm =
    !overCreditLimit && (totalPaid >= total || creditAmount > 0); // either fully paid OR explicit credit

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title="Payment"
      subtitle={`Total ৳ ${formatBDT(total, { withSymbol: false })}`}
      footer={
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            <kbd className="font-mono">Esc</kbd> cancel · <kbd className="font-mono">Enter</kbd> confirm
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={!canConfirm} className="min-w-32">
              Confirm Payment <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* LEFT: methods + amounts */}
        <div className="md:col-span-3 space-y-3">
          {/* Mode tabs */}
          <div className="flex items-center gap-1 p-0.5 bg-secondary rounded-md text-xs w-max">
            {(['single', 'split'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  if (m === 'single') {
                    setPayments([{ id: 'p1', method: payments[0]?.method ?? 'Cash', amount: total }]);
                  }
                }}
                className={cn(
                  'px-3 h-8 rounded font-medium transition capitalize',
                  mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'single' ? 'Single' : 'Split Payment'}
              </button>
            ))}
          </div>

          {mode === 'single' && (
            <SingleLine
              line={single}
              total={total}
              onChange={(patch) => setPayment(single.id, patch)}
            />
          )}

          {mode === 'split' && (
            <div className="space-y-2">
              {payments.map((p) => (
                <SplitRow
                  key={p.id}
                  line={p}
                  onChange={(patch) => setPayment(p.id, patch)}
                  onRemove={() => removePayment(p.id)}
                  canRemove={payments.length > 1}
                />
              ))}
              <Button variant="outline" size="sm" onClick={addPayment}>
                <Plus className="size-3.5" /> Add Payment Line
              </Button>
            </div>
          )}

          {/* Quick tenders only for cash-only single mode */}
          {mode === 'single' && single.method === 'Cash' && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Quick</span>
              {QUICK_TENDERS.map((v) => (
                <button
                  key={v}
                  onClick={() => setPayment(single.id, { amount: v })}
                  className="px-2.5 h-7 rounded-md border border-border bg-card hover:border-primary text-xs font-mono tabular"
                >
                  ৳ {v.toLocaleString()}
                </button>
              ))}
              <button
                onClick={() => setPayment(single.id, { amount: total })}
                className="px-2.5 h-7 rounded-md border border-primary/40 bg-primary/5 hover:bg-primary/10 text-xs font-medium text-primary"
              >
                Exact
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: summary */}
        <div className="md:col-span-2 rounded-xl border border-border bg-card edge-top p-4 space-y-3">
          <Row label="Total" value={formatBDT(total)} />
          <Row label="Paid" value={formatBDT(totalPaid)} tone={totalPaid >= total ? 'success' : undefined} />
          {change > 0 && <Row label="Change" value={formatBDT(change)} tone="success" big />}
          {remaining > 0 && creditAmount === 0 && (
            <Row label="Remaining" value={formatBDT(remaining)} tone="warning" />
          )}
          {creditAmount > 0 && (
            <Row label="To Credit" value={formatBDT(creditAmount)} tone="warning" />
          )}

          {creditAmount > 0 && customerCreditLimit !== undefined && (
            <div
              className={cn(
                'rounded-md px-3 py-2 text-xs',
                overCreditLimit
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-warning/10 text-warning',
              )}
            >
              <div className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="size-3.5" />
                {overCreditLimit ? 'Over credit limit' : 'Credit usage'}
              </div>
              <div className="mt-0.5">
                New due ৳ {formatBDT(newDue, { withSymbol: false })} / limit ৳{' '}
                {customerCreditLimit.toLocaleString()}
              </div>
            </div>
          )}

          <div className="border-t border-border pt-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Status</span>
            {totalPaid >= total ? (
              <span className="inline-flex items-center gap-1 text-success font-semibold">
                <Check className="size-4" /> Ready
              </span>
            ) : creditAmount > 0 && totalPaid + creditAmount >= total ? (
              <span className="inline-flex items-center gap-1 text-warning font-semibold">
                Credit Sale
              </span>
            ) : (
              <span className="text-muted-foreground">Add payment</span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SingleLine({
  line,
  total,
  onChange,
}: {
  line: PaymentLine;
  total: number;
  onChange: (patch: Partial<PaymentLine>) => void;
}) {
  const m = METHODS.find((x) => x.id === line.method)!;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {METHODS.map((mt) => {
          const Icon = mt.icon;
          const active = line.method === mt.id;
          return (
            <button
              key={mt.id}
              onClick={() => onChange({ method: mt.id, amount: total })}
              className={cn(
                'flex flex-col items-center justify-center gap-1 h-14 rounded-md border text-xs font-medium transition edge-top',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:border-primary/40',
              )}
            >
              <Icon className="size-4" />
              {mt.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FieldBox label="Tendered amount">
          <NumberField
            autoFocus
            value={line.amount}
            onChangeNumber={(v) => onChange({ amount: v })}
            placeholder="0.00"
            className="h-12 px-3 text-2xl text-right"
          />
        </FieldBox>
        {m.needsRef && (
          <FieldBox label={`${m.label} reference / TxID`}>
            <input
              value={line.reference ?? ''}
              onChange={(e) => onChange({ reference: e.target.value })}
              placeholder="TX1234567"
              className="h-12 px-3 rounded-md border border-input bg-background text-sm font-mono outline-none focus:ring-2 focus:ring-ring/50"
            />
          </FieldBox>
        )}
      </div>
    </div>
  );
}

function SplitRow({
  line,
  onChange,
  onRemove,
  canRemove,
}: {
  line: PaymentLine;
  onChange: (patch: Partial<PaymentLine>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const m = METHODS.find((x) => x.id === line.method)!;
  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <FieldBox label="Method" className="col-span-3">
        <select
          value={line.method}
          onChange={(e) => onChange({ method: e.target.value as PaymentMethod })}
          className="h-9 px-2 rounded-md border border-input bg-background text-xs outline-none focus:ring-2 focus:ring-ring/50"
        >
          {METHODS.map((mt) => (
            <option key={mt.id} value={mt.id}>
              {mt.label}
            </option>
          ))}
        </select>
      </FieldBox>
      <FieldBox label="Amount" className="col-span-3">
        <NumberField
          value={line.amount}
          onChangeNumber={(v) => onChange({ amount: v })}
          placeholder="0.00"
          className="h-9 px-2 text-right text-xs"
        />
      </FieldBox>
      <FieldBox label={m.needsRef ? `${m.label} reference` : 'Note'} className="col-span-5">
        <input
          value={line.reference ?? ''}
          onChange={(e) => onChange({ reference: e.target.value })}
          placeholder={m.needsRef ? 'TxID / last 4 digits' : 'optional'}
          className="h-9 px-2 rounded-md border border-input bg-background text-xs font-mono outline-none focus:ring-2 focus:ring-ring/50"
        />
      </FieldBox>
      <button
        onClick={onRemove}
        disabled={!canRemove}
        className="h-9 col-span-1 rounded-md border border-border hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:pointer-events-none grid place-items-center"
        title="Remove"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function FieldBox({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-[9px] font-semibold uppercase text-muted-foreground tracking-[0.06em] leading-none">
        {label}
      </span>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'destructive';
  big?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-mono tabular',
          big ? 'text-xl font-bold' : 'text-sm',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </span>
    </div>
  );
}
