import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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
  Delete,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn, formatBDT } from '@/lib/utils';
import { NumberField } from '@/components/ui/NumberField';
import { round2, sum2 } from '@/lib/money';
import { useCan } from '@/hooks/useCan';
import { IconButton } from '@/components/ui/IconButton';
import { Select } from '@/components/ui/Select';
import { keyLabel, matchesKey } from './shortcuts';

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
  /** Settings → POS: the method picked when the modal opens ('Credit' = nothing now). */
  defaultMethod?: PaymentMethod;
  /** Settings → POS: which methods are offered. Empty/undefined = all. */
  visibleMethods?: string[];
  /** Big-button mode: larger tiles and an on-screen number pad. */
  big?: boolean;
  /** The Pay key (F8 by default) confirms while the modal is open. */
  confirmKey?: string;
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
  startMode = 'single',
  defaultMethod = 'Cash',
  visibleMethods,
  big = false,
  confirmKey,
  onConfirm,
}: Props) {
  // Methods offered (Settings → POS). 'Credit' is not a tile: it decides
  // whether "Nothing now" is offered.
  const methods = useMemo(() => {
    if (!visibleMethods || visibleMethods.length === 0) return METHODS;
    const list = METHODS.filter((m) => visibleMethods.includes(m.id));
    return list.length > 0 ? list : METHODS;
  }, [visibleMethods]);
  const allowNothingNow = !visibleMethods || visibleMethods.length === 0 || visibleMethods.includes('Credit');
  const startMethod: PaymentMethod = methods.some((m) => m.id === defaultMethod)
    ? defaultMethod
    : methods[0].id;
  // A default of 'Credit' opens on "Nothing now" (all on khata).
  const startAmount = defaultMethod === 'Credit' && allowNothingNow ? 0 : total;
  /**
   * The FIRST payment is the one everybody makes; extra rows only appear if the
   * customer genuinely splits (part cash, part bKash). No mode switch.
   */
  /**
   * Multi-Pay (B3) opens with the bill split over two rows — all of it in cash
   * and a bKash row at 0 — so the cashier just moves part of it across. It used
   * to open exactly the same screen as Pay: `startMode` was never read.
   */
  const initialPayments = (): PaymentLine[] =>
    startMode === 'split'
      ? [
          { id: 'p1', method: startMethod, amount: total },
          {
            id: 'p2',
            method: (methods.find((m) => m.id !== startMethod) ?? methods[0]).id,
            amount: 0,
          },
        ]
      : [{ id: 'p1', method: startMethod, amount: startAmount }];
  const [payments, setPayments] = useState<PaymentLine[]>(initialPayments);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setPayments(initialPayments());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, total, startMode]);

  const totalPaid = useMemo(() => sum2(payments.map((p) => p.amount || 0)), [payments]);
  const owing = round2(Math.max(0, total - totalPaid));
  const change = round2(Math.max(0, totalPaid - total));

  /** What the customer's khata becomes if this sale is saved as it stands. */
  const newDue = round2(customerCurrentDue + owing);
  // An empty or zero limit means none (the customer form saves it that way),
  // the same rule the main process enforces (backend/services/saleRules.ts).
  const overLimitBy =
    owing > 0 && (customerCreditLimit ?? 0) > 0 && newDue > (customerCreditLimit ?? 0);
  // The owner or a manager may pass the limit; the sale's record says so.
  const canPassLimit = useCan('sales.void');
  const overCreditLimit = overLimitBy && !canPassLimit;

  /** Unpaid money must belong to somebody. This is the only hard block. */
  const needsCustomer = owing > 0 && !hasNamedCustomer;

  const setPayment = (id: string, patch: Partial<PaymentLine>) =>
    setPayments((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addPayment = () =>
    setPayments((ps) => [
      ...ps,
      {
        id: 'p' + ps.length + '_' + Date.now(),
        method: (methods.find((m) => m.id !== ps[0]?.method) ?? methods[0]).id,
        amount: owing,
      },
    ]);

  const removePayment = (id: string) =>
    setPayments((ps) => (ps.length > 1 ? ps.filter((p) => p.id !== id) : ps));

  /** Set the whole payment to one amount, collapsing any split back to one row. */
  const setSingleAmount = (amount: number) =>
    setPayments((ps) => [{ ...(ps[0] ?? { id: 'p1', method: startMethod }), amount }]);

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

  /**
   * Enter in an amount box takes the payment, as the button says. In a split
   * it only does so once nothing is left owing, so an Enter after the first
   * row cannot put the rest on the khata by accident.
   */
  const onAmountKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey) return;
    if ((e.target as HTMLElement).tagName !== 'INPUT') return;
    e.preventDefault();
    if (!canConfirm) return;
    if (isSplit && owing > 0) return;
    confirm();
  };

  // The Pay key pressed again confirms (the cashier's hand is already there).
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;
  const canConfirmRef = useRef(false);
  canConfirmRef.current = canConfirm && !(isSplit && owing > 0);
  useEffect(() => {
    if (!open || !confirmKey) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!matchesKey(e, confirmKey)) return;
      e.preventDefault();
      if (canConfirmRef.current) confirmRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, confirmKey]);

  /** Whole phrases, so Bangla translates them; the outcome panel says the amounts. */
  const confirmLabel = needsCustomer
    ? 'Choose a customer first'
    : owing > 0 && totalPaid === 0
      ? 'Put it all on khata'
      : 'Confirm sale';

  /** On-screen number pad (big-button mode). The first press replaces the prefill. */
  const padFresh = useRef(true);
  useEffect(() => {
    padFresh.current = true;
  }, [open]);
  const pad = (k: string) => {
    const cur = padFresh.current ? '' : String(first?.amount ?? 0);
    padFresh.current = false;
    let next = cur;
    if (k === 'back') next = cur.slice(0, -1);
    else if (k === '.') next = cur.includes('.') ? cur : (cur || '0') + '.';
    else next = (cur === '0' ? '' : cur) + k;
    setSingleAmount(Number(next) || 0);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={big ? 'max-w-3xl' : 'max-w-xl'}
      title="Take payment"
      subtitle={customerName}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" onClick={confirm} disabled={!canConfirm} className="min-w-48">
            <span>{confirmLabel}</span>
            {canConfirm && (
              <kbd className="text-xs opacity-80 ml-1">
                {confirmKey ? `Enter / ${keyLabel(confirmKey)}` : 'Enter'}
              </kbd>
            )}
          </Button>
        </div>
      }
    >
      <div className="p-5 space-y-5" onKeyDown={onAmountKeyDown}>
        {/* ---------- THE BILL ---------- */}
        <div className="flex items-baseline justify-between border-b border-border pb-3">
          <span className="text-sm text-muted-foreground">Bill total</span>
          <span className="text-3xl font-bold tabular">{formatBDT(total)}</span>
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
              onChangeNumber={(v) => {
                padFresh.current = false;
                setSingleAmount(v);
              }}
              placeholder="0.00"
              aria-label="Amount paid now"
              className="h-16 px-4 text-3xl text-right font-bold"
            />
          )}

          {!isSplit && big && (
            <div className="grid grid-cols-4 gap-2">
              {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', 'back'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => pad(k)}
                  className="h-14 rounded-md border border-border bg-card hover:border-primary text-2xl font-semibold tabular grid place-items-center"
                  aria-label={k === 'back' ? 'Delete last digit' : k}
                >
                  {k === 'back' ? <Delete className="size-6" /> : k}
                </button>
              ))}
            </div>
          )}

          {/* Amounts a customer plausibly hands over for THIS bill. */}
          {!isSplit && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSingleAmount(total)}
                className={cn(
                  'px-3 rounded-md border border-primary bg-primary/10 text-primary text-sm font-semibold',
                  big ? 'h-14 text-base' : 'h-10',
                )}
              >
                Full amount
              </button>
              {quickTenders(total).map((v) => (
                <button
                  key={v}
                  onClick={() => setSingleAmount(v)}
                  className={cn(
                    'px-3 rounded-md border border-border bg-card hover:border-primary text-sm tabular',
                    big ? 'h-14 text-base' : 'h-10',
                  )}
                >
                  ৳ {v.toLocaleString('en-IN')}
                </button>
              ))}
              {allowNothingNow && (
                <button
                  onClick={() => setSingleAmount(0)}
                  className={cn(
                    'px-3 rounded-md border border-border bg-card hover:border-warning text-sm font-medium inline-flex items-center gap-1.5',
                    big ? 'h-14 text-base' : 'h-10',
                  )}
                  title="Record the whole bill as owing"
                >
                  <NotebookPen className="size-4" /> Nothing now
                </button>
              )}
            </div>
          )}
        </div>

        {/* ---------- HOW IT ARRIVED ---------- */}
        {/* Always shown (disabled at 0) so the layout does not jump while typing. */}
        <div className="space-y-2">
            <div className="text-sm font-semibold">Paid by</div>
            {!isSplit ? (
              <>
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${Math.min(methods.length, 5)}, minmax(0, 1fr))` }}
                >
                  {methods.map((mt) => {
                    const Icon = mt.icon;
                    const active = first?.method === mt.id;
                    return (
                      <button
                        key={mt.id}
                        onClick={() => setPayment(first.id, { method: mt.id })}
                        disabled={totalPaid <= 0}
                        aria-pressed={active}
                        className={cn(
                          'flex flex-col items-center justify-center gap-1 rounded-md border text-sm font-medium transition',
                          'disabled:opacity-40 disabled:pointer-events-none',
                          big ? 'h-16 text-base' : 'h-14',
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
                {totalPaid > 0 && METHODS.find((m) => m.id === first?.method)?.needsRef && (
                  <input
                    value={first?.reference ?? ''}
                    onChange={(e) => setPayment(first.id, { reference: e.target.value })}
                    placeholder="Transaction number (optional)"
                    aria-label="Transaction number"
                    className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring/50"
                  />
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                  <span className="col-span-4">Method</span>
                  <span className="col-span-3 text-right">Amount</span>
                  <span className="col-span-4">Reference</span>
                </div>
                {payments.map((p) => (
                  <SplitRow
                    key={p.id}
                    line={p}
                    methods={methods}
                    onChange={(patch) => setPayment(p.id, patch)}
                    onRemove={() => removePayment(p.id)}
                    canRemove={payments.length > 1}
                  />
                ))}
                {owing > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Still to pay</span>
                    <span className="tabular font-semibold text-warning">{formatBDT(owing)}</span>
                  </div>
                )}
              </div>
            )}
            {(totalPaid > 0 || isSplit) && methods.length > 1 && (
              <Button variant="outline" size="md" onClick={addPayment}>
                <Plus className="size-4" /> Split payment
              </Button>
            )}
        </div>

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
                    <span>Who owes this money?</span>{' '}
                    <span className="tabular">{formatBDT(owing)}</span>
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
                  <Button size="md" onClick={onPickCustomer}>
                    <UserPlus className="size-4" /> Choose customer
                  </Button>
                )}
                <Button size="md" variant="outline" onClick={() => setSingleAmount(total)}>
                  Take the full amount instead
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
              <div className="text-3xl font-bold tabular text-success">{formatBDT(change)}</div>
            </div>
          ) : owing > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  {customerName ? (
                    <span className="font-semibold">
                      <span>{customerName}</span> <span>will still owe</span>
                    </span>
                  ) : (
                    <span className="font-semibold">This customer will still owe</span>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Goes on their khata. You can collect it any time.
                  </div>
                </div>
                <div className="text-3xl font-bold tabular text-warning">{formatBDT(owing)}</div>
              </div>
              {customerCurrentDue > 0 && (
                <div className="text-sm text-muted-foreground border-t border-warning/20 pt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    <span>Already owed</span> <span className="tabular">{formatBDT(customerCurrentDue)}</span>
                  </span>
                  <span>
                    <span>Khata after this sale</span>{' '}
                    <span className="tabular font-semibold text-foreground">{formatBDT(newDue)}</span>
                  </span>
                </div>
              )}
              {overLimitBy && (
                <div className="flex items-start gap-2 text-destructive text-sm border-t border-destructive/20 pt-2">
                  <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                  <span>
                    <span>That is over their credit limit of</span>{' '}
                    <span className="tabular">{formatBDT(customerCreditLimit ?? 0)}</span>.{' '}
                    {canPassLimit ? (
                      <span>You can still save it. The sale will record that the limit was passed.</span>
                    ) : (
                      <span>Take more now, or ask the owner or a manager.</span>
                    )}
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
  methods,
  onChange,
  onRemove,
  canRemove,
}: {
  line: PaymentLine;
  methods: typeof METHODS;
  onChange: (patch: Partial<PaymentLine>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const m = METHODS.find((x) => x.id === line.method) ?? METHODS[0];
  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <Select
        value={line.method}
        onChange={(e) => onChange({ method: e.target.value as PaymentMethod })}
        aria-label="Method"
        className="col-span-4"
      >
        {methods.map((mt) => (
          <option key={mt.id} value={mt.id}>
            {mt.label}
          </option>
        ))}
      </Select>
      <NumberField
        value={line.amount}
        onChangeNumber={(v) => onChange({ amount: v })}
        placeholder="0.00"
        aria-label="Amount"
        className="col-span-3 h-10 px-2 text-right"
      />
      <input
        value={line.reference ?? ''}
        onChange={(e) => onChange({ reference: e.target.value })}
        placeholder={m.needsRef ? 'Transaction number' : 'Note'}
        aria-label="Reference"
        className="col-span-4 h-10 px-2 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring/50"
      />
      <IconButton
        label="Remove this payment"
        tone="danger"
        onClick={onRemove}
        disabled={!canRemove}
        className="col-span-1 justify-self-end"
      >
        <Trash2 className="size-4" />
      </IconButton>
    </div>
  );
}
