import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  Smartphone,
  CreditCard,
  Building2,
  Plus,
  Trash2,
  AlertTriangle,
  Check,
  NotebookPen,
  UserPlus,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn, formatBDT } from '@/lib/utils';
import { NumberField } from '@/components/ui/NumberField';
import { round2, sum2 } from '@/lib/money';

/**
 * ============================================================================
 *  TAKING THE MONEY
 * ============================================================================
 *
 * WHAT WAS WRONG WITH THE OLD VERSION
 *
 * It was built around accounting words and it blocked the second most common
 * thing that happens at a hardware counter.
 *
 *  1. It opened on a choice — "Single" or "Split Payment" — before any money had
 *     been counted. Nobody at a counter thinks in those terms.
 *  2. "Credit" sat in the method grid next to Cash and bKash, as though not
 *     paying were a way of paying. Tapping it silently put the WHOLE bill on the
 *     customer's khata.
 *  3. Worst: if the customer handed over ৳10,000 of a ৳12,450 bill, the Confirm
 *     button was DISABLED. `canConfirm` required `totalPaid >= total ||
 *     creditAmount > 0`, so recording "he paid some, he owes the rest" — the
 *     everyday বাকি sale — required knowing that you must switch to Split, add a
 *     second line, and set its method to Credit. The commonest partial payment in
 *     the shop was effectively unreachable.
 *  4. "Tendered amount", "Remaining", "To Credit", "Status: Ready" — all of it
 *     reads like a ledger, not like a counter.
 *  5. The quick amounts were a fixed 100/200/500/1000/2000, unrelated to the
 *     bill. On a ৳12,450 bill not one of them is a plausible thing to hand over.
 *
 * HOW IT WORKS NOW
 *
 * One question — "How much is the customer paying now?" — and everything else is
 * shown as a CONSEQUENCE, in words, before anything is saved:
 *
 *   paid == bill   ->  "Paid in full. Nothing owing."
 *   paid >  bill   ->  "Give ৳550 change back."
 *   paid <  bill   ->  "Rahim will still owe ৳2,450." (+ what their khata becomes)
 *
 * Nothing is ever disabled for being a partial payment. The CONFIRM BUTTON SAYS
 * WHAT WILL HAPPEN, so the decision is visible rather than hidden in a mode.
 *
 * "Credit" is gone as a method. It was never a payment: the backend already
 * derives `due = total − payments` and POS already stripped Credit lines before
 * sending them. It is replaced by one button — "Nothing now, all on khata" —
 * which simply sets the amount to zero.
 *
 * THE ONE HARD RULE: বাকি NEEDS A NAME.
 * Leaving money unpaid on a walk-in sale used to be allowed, and it put a due on
 * the invoice that belonged to nobody: `customerDue()` in the backend sums by
 * `customer_id`, so a NULL-customer due appears in no khata, on no Customer Dues
 * screen, and in no receivables figure. The shop's own money quietly left the
 * books. So if anything is left unpaid, a real customer must be chosen — the one
 * thing here that does block Confirm, with a message saying exactly why.
 */

export type PaymentMethod = 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank' | 'Credit';

/**
 * Ways money can actually arrive. 'Credit' is deliberately NOT here — see the
 * header. It stays in the `PaymentMethod` union only because stored history and
 * the backend's method column still know about it.
 */
const METHODS: { id: PaymentMethod; icon: any; label: string; needsRef?: boolean }[] = [
  { id: 'Cash', icon: Banknote, label: 'Cash' },
  { id: 'bKash', icon: Smartphone, label: 'bKash', needsRef: true },
  { id: 'Nagad', icon: Smartphone, label: 'Nagad', needsRef: true },
  { id: 'Card', icon: CreditCard, label: 'Card', needsRef: true },
  { id: 'Bank', icon: Building2, label: 'Bank', needsRef: true },
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
  /** The chosen customer's name, for saying whose khata this lands on. */
  customerName?: string;
  /**
   * False for a walk-in / nobody selected. Anything left unpaid needs a real
   * customer, so this gates the Confirm button — see the header.
   */
  hasNamedCustomer?: boolean;
  /** Opens the customer picker, so the block is one tap from being resolved. */
  onPickCustomer?: () => void;
  startMode?: 'single' | 'split';
  onConfirm: (result: PaymentResult) => void;
}

/**
 * Plausible notes a customer actually hands over for THIS bill: the exact amount
 * rounded up to the next 100, 500, 1000 and 5000. A fixed 100/200/500 list is
 * useless on a ৳12,450 bill.
 */
function quickTenders(total: number): number[] {
  if (total <= 0) return [];
  const steps = [100, 500, 1000, 5000];
  const out: number[] = [];
  for (const step of steps) {
    const up = Math.ceil(total / step) * step;
    if (up > total && !out.includes(up)) out.push(up);
  }
  return out.slice(0, 3);
}

export function PaymentModal({
  open,
  onClose,
  total,
  customerCreditLimit,
  customerCurrentDue = 0,
  customerName,
  hasNamedCustomer = false,
  onPickCustomer,
  onConfirm,
}: Props) {
  /**
   * The FIRST payment is the one everybody makes; extra rows only appear if the
   * customer genuinely splits (part cash, part bKash). No mode switch.
   */
  const [payments, setPayments] = useState<PaymentLine[]>([
    { id: 'p1', method: 'Cash', amount: total },
  ]);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPayments([{ id: 'p1', method: 'Cash', amount: total }]);
    }
  }, [open, total]);

  const totalPaid = useMemo(() => sum2(payments.map((p) => p.amount || 0)), [payments]);
  const owing = round2(Math.max(0, total - totalPaid));
  const change = round2(Math.max(0, totalPaid - total));

  /** What the customer's khata becomes if this sale is saved as it stands. */
  const newDue = round2(customerCurrentDue + owing);
  const overCreditLimit =
    owing > 0 && customerCreditLimit !== undefined && newDue > customerCreditLimit;

  /** Unpaid money must belong to somebody. This is the only hard block. */
  const needsCustomer = owing > 0 && !hasNamedCustomer;

  const setPayment = (id: string, patch: Partial<PaymentLine>) =>
    setPayments((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addPayment = () =>
    setPayments((ps) => [
      ...ps,
      { id: 'p' + ps.length + '_' + Date.now(), method: 'Cash', amount: owing },
    ]);

  const removePayment = (id: string) =>
    setPayments((ps) => (ps.length > 1 ? ps.filter((p) => p.id !== id) : ps));

  /** Set the whole payment to one amount, collapsing any split back to one row. */
  const setSingleAmount = (amount: number) =>
    setPayments((ps) => [{ ...(ps[0] ?? { id: 'p1', method: 'Cash' as PaymentMethod }), amount }]);

  const first = payments[0];
  const isSplit = payments.length > 1;

  const confirm = () => {
    if (needsCustomer || overCreditLimit) return;
    onConfirm({
      payments: payments.filter((p) => p.amount > 0),
      totalPaid,
      change,
      due: owing,
    });
  };

  const canConfirm = !needsCustomer && !overCreditLimit;

  /** The button says what is about to happen. No hidden modes. */
  const confirmLabel = needsCustomer
    ? 'Choose a customer first'
    : change > 0
      ? `Take ৳${formatBDT(total, { withSymbol: false })} · give ৳${formatBDT(change, { withSymbol: false })} change`
      : owing > 0
        ? totalPaid > 0
          ? `Take ৳${formatBDT(totalPaid, { withSymbol: false })} · ৳${formatBDT(owing, { withSymbol: false })} on khata`
          : `Put all ৳${formatBDT(total, { withSymbol: false })} on khata`
        : `Take ৳${formatBDT(total, { withSymbol: false })} — paid in full`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title="Take payment"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground hidden sm:block">
            <kbd className="font-mono">Esc</kbd> cancel
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={!canConfirm} className="min-w-48 h-11 text-base">
              {confirmLabel}
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-5 space-y-5">
        {/* ---------- THE BILL ---------- */}
        <div className="flex items-baseline justify-between border-b border-border pb-3">
          <span className="text-sm text-muted-foreground">Bill total</span>
          <span className="text-3xl font-bold font-mono tabular">
            ৳ {formatBDT(total, { withSymbol: false })}
          </span>
        </div>

        {/* ---------- THE ONE QUESTION ---------- */}
        <div className="space-y-3">
          <label className="block text-base font-semibold">
            How much is the customer paying now?
          </label>

          {!isSplit && (
            <NumberField
              ref={amountRef}
              autoFocus
              value={first?.amount ?? 0}
              onChangeNumber={(v) => setSingleAmount(v)}
              placeholder="0.00"
              className="h-16 px-4 text-3xl text-right font-bold"
            />
          )}

          {/* Amounts a customer plausibly hands over for THIS bill. */}
          {!isSplit && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSingleAmount(total)}
                className="px-3 h-10 rounded-md border border-primary bg-primary/10 text-primary text-sm font-semibold"
              >
                Full amount
              </button>
              {quickTenders(total).map((v) => (
                <button
                  key={v}
                  onClick={() => setSingleAmount(v)}
                  className="px-3 h-10 rounded-md border border-border bg-card hover:border-primary text-sm font-mono tabular"
                >
                  ৳ {v.toLocaleString('en-IN')}
                </button>
              ))}
              <button
                onClick={() => setSingleAmount(0)}
                className="px-3 h-10 rounded-md border border-border bg-card hover:border-warning text-sm font-medium inline-flex items-center gap-1.5"
                title="Record the whole bill as owing"
              >
                <NotebookPen className="size-4" /> Nothing now
              </button>
            </div>
          )}
        </div>

        {/* ---------- HOW IT ARRIVED ---------- */}
        {totalPaid > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Paid by</div>
            {!isSplit ? (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {METHODS.map((mt) => {
                    const Icon = mt.icon;
                    const active = first?.method === mt.id;
                    return (
                      <button
                        key={mt.id}
                        onClick={() => setPayment(first.id, { method: mt.id })}
                        className={cn(
                          'flex flex-col items-center justify-center gap-1 h-14 rounded-md border text-xs font-medium transition',
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
                {METHODS.find((m) => m.id === first?.method)?.needsRef && (
                  <input
                    value={first?.reference ?? ''}
                    onChange={(e) => setPayment(first.id, { reference: e.target.value })}
                    placeholder={`${first.method} transaction number (optional)`}
                    className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm font-mono outline-none focus:ring-2 focus:ring-ring/50"
                  />
                )}
              </>
            ) : (
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
              </div>
            )}
            <button
              onClick={addPayment}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Plus className="size-3" /> Part of it another way (cash + bKash)
            </button>
          </div>
        )}

        {/* ---------- WHAT WILL HAPPEN, IN WORDS ---------- */}
        <div
          className={cn(
            'rounded-xl border p-4',
            needsCustomer || overCreditLimit
              ? 'border-destructive/40 bg-destructive/5'
              : owing > 0
                ? 'border-warning/40 bg-warning/5'
                : 'border-success/40 bg-success/5',
          )}
        >
          {needsCustomer ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-destructive">
                    Who owes the ৳{formatBDT(owing, { withSymbol: false })}?
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Money left on khata has to be against a name, or it is not in anyone's
                    account and you will never be able to collect it. Choose the customer, or
                    take the full amount now.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {onPickCustomer && (
                  <Button size="sm" onClick={onPickCustomer}>
                    <UserPlus className="size-4" /> Choose customer
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setSingleAmount(total)}>
                  Take the full ৳{formatBDT(total, { withSymbol: false })} instead
                </Button>
              </div>
            </div>
          ) : change > 0 ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Give back as change</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  The bill is paid in full.
                </div>
              </div>
              <div className="text-3xl font-bold font-mono tabular text-success">
                ৳ {formatBDT(change, { withSymbol: false })}
              </div>
            </div>
          ) : owing > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-semibold">
                    {customerName || 'This customer'} will still owe
                  </span>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Goes on their khata. You can collect it any time.
                  </div>
                </div>
                <div className="text-3xl font-bold font-mono tabular text-warning">
                  ৳ {formatBDT(owing, { withSymbol: false })}
                </div>
              </div>
              {customerCurrentDue > 0 && (
                <div className="text-xs text-muted-foreground border-t border-warning/20 pt-2">
                  Already owed ৳{formatBDT(customerCurrentDue, { withSymbol: false })} · khata
                  becomes ৳{formatBDT(newDue, { withSymbol: false })}
                </div>
              )}
              {overCreditLimit && (
                <div className="flex items-start gap-2 text-destructive text-sm border-t border-destructive/20 pt-2">
                  <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                  <span>
                    That is over the ৳
                    {formatBDT(customerCreditLimit ?? 0, { withSymbol: false })} limit set for
                    them. Take more now, or raise their limit in Customers.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-success">
              <Check className="size-5" />
              <span className="font-semibold">Paid in full. Nothing owing.</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
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
  const m = METHODS.find((x) => x.id === line.method) ?? METHODS[0];
  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <select
        value={line.method}
        onChange={(e) => onChange({ method: e.target.value as PaymentMethod })}
        className="col-span-4 h-10 px-2 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring/50"
      >
        {METHODS.map((mt) => (
          <option key={mt.id} value={mt.id}>
            {mt.label}
          </option>
        ))}
      </select>
      <NumberField
        value={line.amount}
        onChangeNumber={(v) => onChange({ amount: v })}
        placeholder="0.00"
        className="col-span-3 h-10 px-2 text-right"
      />
      <input
        value={line.reference ?? ''}
        onChange={(e) => onChange({ reference: e.target.value })}
        placeholder={m.needsRef ? 'TxID' : 'note'}
        className="col-span-4 h-10 px-2 rounded-md border border-input bg-background text-xs font-mono outline-none focus:ring-2 focus:ring-ring/50"
      />
      <button
        onClick={onRemove}
        disabled={!canRemove}
        className="col-span-1 h-10 rounded-md border border-border hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:pointer-events-none grid place-items-center"
        title="Remove"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
