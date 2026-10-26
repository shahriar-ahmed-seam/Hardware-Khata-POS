import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/NumberField';
import { Save } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';
import { AmountInput, MethodPicker, PaySummary, type PayMethod } from './PaymentInputs';
import { cn, formatBDT } from '@/lib/utils';
import { useCustomers } from '@/stores/contacts';
import { useSales, type SaleRecord } from '@/stores/sales';
import { toast } from '@/stores/toast';
import { round2, sum2 } from '@/lib/money';
import { api } from '@/lib/api';
import { toCustomer, type BackendCustomer } from '@/hooks/contactAdapter';
import { toSaleRecord, type BackendSale } from '@/hooks/saleAdapter';
import type { Customer } from '@/types/domain';

type Mode = 'auto' | 'pick';

interface Props {
  open: boolean;
  onClose: () => void;
  customerId: string | null;
}

export function ReceivePaymentModal({ open, onClose, customerId }: Props) {
  const storeCustomer = useCustomers((s) => s.items.find((c) => c.id === customerId)) ?? null;
  const receivePayment = useCustomers((s) => s.receivePayment);
  const sales = useSales((s) => s.sales);
  const [saving, setSaving] = useState(false);

  // The contacts store holds ONE PAGE of customers. This modal usually opens
  // from a row on that page, but not always (Customer Dues rows, a deep-linked
  // CustomerDetail), so fall back to a single-record read instead of silently
  // rendering nothing. Store row wins when present — payments rehydrate it, so
  // the due shown here stays live.
  const hasStoreCustomer = !!storeCustomer;
  const [fetched, setFetched] = useState<Customer | null>(null);

  useEffect(() => {
    if (!open || !customerId || hasStoreCustomer) {
      setFetched(null);
      return;
    }
    let alive = true;
    void api<BackendCustomer | null>('customers.get', { id: customerId })
      .then((row) => {
        if (alive && row) setFetched(toCustomer(row));
      })
      .catch(() => {
        // Channel error or running outside Electron — leave the modal empty.
      });
    return () => {
      alive = false;
    };
  }, [open, customerId, hasStoreCustomer]);

  const customer = storeCustomer ?? fetched;

  const [mode, setMode] = useState<Mode>('auto');
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PayMethod>('Cash');
  const [reference, setReference] = useState('');
  const [picked, setPicked] = useState<Record<string, number>>({});

  /**
   * The sales store is ONE PAGE too, and this modal opens from screens that do
   * not load it at all (Customer Dues) — an invoice missing from that page would
   * silently drop out of the allocation, so the customer's outstanding invoices
   * are read from the UNPAGED `sales.list` (headers carry total/paid/due). Falls
   * back to the store page if the read fails.
   */
  const [allSales, setAllSales] = useState<SaleRecord[] | null>(null);

  useEffect(() => {
    if (!open || !customerId) {
      setAllSales(null);
      return;
    }
    let alive = true;
    void api<BackendSale[]>('sales.list', {})
      .then((rows) => {
        if (alive) setAllSales(rows.map(toSaleRecord));
      })
      .catch(() => {
        // Fall back to the store page below.
      });
    return () => {
      alive = false;
    };
  }, [open, customerId]);

  const dueInvoices = useMemo(() => {
    if (!customer) return [];
    return (allSales ?? sales)
      .filter((s) => s.status === 'final' && s.customerId === customer.id && s.due > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allSales, sales, customer]);

  useEffect(() => {
    if (open) {
      setMode('auto');
      setAmount(customer?.due ?? 0);
      setMethod('Cash');
      setReference('');
      setPicked({});
    }
  }, [open, customer]);

  const pickedTotal = Object.values(picked).reduce((s, v) => s + v, 0);
  const effectiveAmount = mode === 'auto' ? amount : pickedTotal;

  /**
   * Preview of the auto allocation, oldest invoice first.
   *
   * THIS HOOK MUST STAY ABOVE THE `!customer` EARLY RETURN.
   *
   * It used to sit below it, which crashed the app with React error #310
   * ("rendered fewer hooks than expected") every time this modal was opened from
   * the Customer Dues page. The reason it only broke there: on the Customers page
   * the row is already in the paged contacts store, so `customer` is non-null on
   * the very first render and the early return never fires. Customer Dues does not
   * load that store, so the first render bailed out early — skipping this
   * `useMemo` — and then the async `customers.get` above resolved, `customer`
   * became non-null, the render continued past the return, and the hook count
   * changed between two renders of the same component. React cannot match hooks up
   * across that and throws.
   *
   * Every hook in this component therefore runs unconditionally, and the
   * "nothing to show" case is handled in the RETURNED MARKUP instead.
   */
  /**
   * The part of the balance that is NOT on an open invoice — the opening
   * balance still owed. The backend pays this FIRST (services/accounts.ts); the
   * preview mirrors that so the screen and the books agree.
   */
  const openingPart = useMemo(() => {
    if (!customer) return 0;
    const onInvoices = sum2(dueInvoices.map((i) => i.due));
    return Math.max(0, round2(customer.due - onInvoices));
  }, [customer, dueInvoices]);

  const allocation = useMemo(() => {
    if (mode !== 'auto' || !customer) return { opening: 0, invoices: [], advance: 0 };
    const opening = Math.min(amount, openingPart);
    let remaining = round2(amount - opening);
    const invoices: { saleId: string; invoiceNo: string; apply: number }[] = [];
    for (const inv of dueInvoices) {
      if (remaining <= 0) break;
      const apply = Math.min(inv.due, remaining);
      invoices.push({ saleId: inv.id, invoiceNo: inv.invoiceNo, apply });
      remaining = round2(remaining - apply);
    }
    return { opening, invoices, advance: Math.max(0, remaining) };
  }, [mode, amount, dueInvoices, customer, openingPart]);

  // ONE backend call places the whole payment in one transaction. This used to
  // loop one un-awaited sales.addPayment per invoice and save NOTHING for money
  // that did not fit an invoice, while promising "applied as advance".
  const submit = async () => {
    if (!customer || effectiveAmount <= 0 || saving) return;
    setSaving(true);
    const allocations =
      mode === 'pick'
        ? Object.entries(picked)
            .filter(([, v]) => v > 0)
            .map(([docId, v]) => ({ docId, amount: v }))
        : undefined;
    const res = await receivePayment(customer.id, effectiveAmount, method, reference || undefined, allocations);
    setSaving(false);
    if (!res) return;
    const parts: string[] = [];
    if (res.toOpening > 0) parts.push(`Opening balance ${formatBDT(res.toOpening)}`);
    if (res.allocated > 0) parts.push(`Invoices ${formatBDT(res.allocated)}`);
    if (res.advance > 0) parts.push(`Advance ${formatBDT(res.advance)}`);
    toast.success('Payment recorded', { description: parts.join(' · ') });
    onClose();
  };

  /**
   * The customer is still being fetched (or could not be found). Rendered as a
   * MODAL STATE rather than `return null`, so that the hook list above runs on
   * every render — see the note on `allocation`.
   */
  if (!customer) {
    return (
      <Modal open={open} onClose={onClose} width="max-w-md" title="Receive payment">
        <div className="p-8 text-center text-sm text-muted-foreground">
          {customerId ? 'Loading the customer…' : 'No customer selected.'}
        </div>
      </Modal>
    );
  }

  // Auto mode lists the first few bills the money reaches; the rest are counted.
  const PREVIEW = 3;
  const reached = allocation.invoices;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={mode === 'pick' ? 'max-w-2xl' : 'max-w-lg'}
      title="Receive Payment"
      subtitle={customer.name}
      footer={
        <div className="flex items-center justify-between gap-3">
          <PaySummary amount={effectiveAmount} owed={customer.due} afterLabel="Due after" />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="receive-payment-form" disabled={effectiveAmount <= 0 || saving}>
              <Save className="size-4" /> Save Payment
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="receive-payment-form"
        className="p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Outstanding due</span>
          <span className={cn('tabular text-lg font-bold', customer.due > 0 && 'text-destructive')}>
            {formatBDT(customer.due)}
          </span>
        </div>

        {/* Amount first: it is what the customer hands over. In pick mode the total comes from the bills. */}
        {mode === 'auto' ? (
          <AmountInput amount={amount} onAmount={setAmount} full={customer.due} fullLabel="Full due" />
        ) : (
          <div className="flex items-baseline justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm font-medium">Total</span>
            <span className="tabular text-2xl font-semibold">{formatBDT(pickedTotal)}</span>
          </div>
        )}

        <MethodPicker method={method} onMethod={setMethod} reference={reference} onReference={setReference} />

        {/* Where the money goes besides invoices (the backend does the same). */}
        {mode === 'auto' && (allocation.opening > 0 || allocation.advance > 0) && (
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm space-y-1">
            {allocation.opening > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opening balance</span>
                <span className="tabular text-success">{formatBDT(allocation.opening)}</span>
              </div>
            )}
            {allocation.advance > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kept as an advance on the account</span>
                <span className="tabular text-success">{formatBDT(allocation.advance)}</span>
              </div>
            )}
          </div>
        )}

        {dueInvoices.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No open invoices. The payment goes to the opening balance first; anything more is kept as an
            advance on the account.
          </div>
        ) : mode === 'auto' ? (
          // Auto is the quiet default: the oldest bills first, with a way out.
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
              <span className="text-sm font-medium">Goes to the oldest bills first</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode('pick')}>
                Choose bills myself
              </Button>
            </div>
            {reached.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">Type an amount to see which bills it pays.</div>
            ) : (
              <ul className="text-sm">
                {reached.slice(0, PREVIEW).map((a) => (
                  <li key={a.saleId} className="flex justify-between px-3 py-2 border-t border-border first:border-t-0">
                    <span className="whitespace-nowrap">{a.invoiceNo}</span>
                    <span className="tabular text-success">{formatBDT(a.apply)}</span>
                  </li>
                ))}
                {reached.length > PREVIEW && (
                  <li className="px-3 py-2 border-t border-border text-muted-foreground">
                    <span>+</span> <span className="tabular">{reached.length - PREVIEW}</span> <span>more</span>
                  </li>
                )}
              </ul>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-secondary/40">
              <span className="text-sm font-medium">Choose how much to apply per invoice</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode('auto')}>
                Use auto (oldest first)
              </Button>
            </div>
            <div className="max-h-[40vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Invoice</th>
                    <th className="text-left px-2 py-2 font-medium">Date</th>
                    <th className="text-right px-2 py-2 font-medium">Due</th>
                    <th className="text-right px-3 py-2 font-medium">Apply</th>
                  </tr>
                </thead>
                <tbody>
                  {dueInvoices.map((s) => {
                    const cur = picked[s.id] ?? 0;
                    const setPick = (v: number) =>
                      setPicked((p) => ({ ...p, [s.id]: Math.max(0, Math.min(s.due, v)) }));
                    return (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-3 py-2 whitespace-nowrap">{s.invoiceNo}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{formatDate(s.date)}</td>
                        <td className="px-2 py-2 text-right tabular text-destructive">
                          {formatBDT(s.due, { withSymbol: false })}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <NumberField
                              value={cur}
                              onChangeNumber={setPick}
                              placeholder="0"
                              aria-label="Apply"
                              className="h-10 w-32 px-2 text-right text-sm"
                            />
                            <Button type="button" variant="outline" size="sm" onClick={() => setPick(s.due)}>
                              Full
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
