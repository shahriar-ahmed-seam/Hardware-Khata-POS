import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/NumberField';
import { Input } from '@/components/ui/Input';
import { Banknote, Smartphone, CreditCard, Building2, HandCoins, Save } from 'lucide-react';
import { cn, formatBDT } from '@/lib/utils';
import { useCustomers } from '@/stores/contacts';
import { useSales, type SaleRecord } from '@/stores/sales';
import { api } from '@/lib/api';
import { toCustomer, type BackendCustomer } from '@/hooks/contactAdapter';
import { toSaleRecord, type BackendSale } from '@/hooks/saleAdapter';
import type { Customer } from '@/types/domain';

const METHODS: { id: 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank'; icon: any; label: string; needsRef?: boolean }[] = [
  { id: 'Cash', icon: Banknote, label: 'Cash' },
  { id: 'bKash', icon: Smartphone, label: 'bKash', needsRef: true },
  { id: 'Nagad', icon: Smartphone, label: 'Nagad', needsRef: true },
  { id: 'Card', icon: CreditCard, label: 'Card', needsRef: true },
  { id: 'Bank', icon: Building2, label: 'Bank', needsRef: true },
];

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
  const addSalePayment = useSales((s) => s.addPayment);

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
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('Cash');
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
  const allocation = useMemo(() => {
    if (mode !== 'auto' || !customer) return [];
    let remaining = amount;
    const out: { saleId: string; invoiceNo: string; apply: number }[] = [];
    for (const inv of dueInvoices) {
      if (remaining <= 0) break;
      const apply = Math.min(inv.due, remaining);
      out.push({ saleId: inv.id, invoiceNo: inv.invoiceNo, apply });
      remaining -= apply;
    }
    return out;
  }, [mode, amount, dueInvoices, customer]);

  const submit = () => {
    if (!customer || effectiveAmount <= 0) return;
    receivePayment(customer.id, effectiveAmount, method, reference || undefined);
    if (mode === 'auto') {
      allocation.forEach((a) => {
        addSalePayment(a.saleId, {
          method,
          amount: a.apply,
          reference: reference || undefined,
          paidAt: new Date().toISOString(),
        });
      });
    } else {
      Object.entries(picked).forEach(([saleId, applyAmt]) => {
        if (applyAmt > 0) {
          addSalePayment(saleId, {
            method,
            amount: applyAmt,
            reference: reference || undefined,
            paidAt: new Date().toISOString(),
          });
        }
      });
    }
    onClose();
  };

  const needsRef = METHODS.find((m) => m.id === method)?.needsRef;

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

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title={`Receive Payment — ${customer.name}`}
      subtitle={`Outstanding due: ৳ ${formatBDT(customer.due, { withSymbol: false })}`}
      footer={
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Receiving </span>
            <span className="font-mono tabular font-semibold text-success">
              {formatBDT(effectiveAmount)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={effectiveAmount <= 0}>
              <Save className="size-4" /> Save Payment
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 p-0.5 bg-secondary rounded-md text-xs w-max">
          {(['auto', 'pick'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'px-3 h-8 rounded font-medium transition',
                mode === m ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'auto' ? 'Auto-allocate (oldest first)' : 'Pick invoices manually'}
            </button>
          ))}
        </div>

        {/* Method tiles */}
        <div className="grid grid-cols-5 gap-1.5">
          {METHODS.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  'h-12 rounded-md border text-xs font-medium transition inline-flex flex-col items-center justify-center gap-1',
                  method === m.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-secondary',
                )}
              >
                <Icon className="size-4" />
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {mode === 'auto' && (
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">Amount</label>
              <NumberField value={amount} onChangeNumber={setAmount} className="text-right text-base" />
              <div className="flex items-center gap-1 mt-1">
                <button
                  onClick={() => setAmount(customer.due)}
                  className="text-[10px] px-2 h-6 rounded border border-border hover:bg-secondary"
                >
                  Full due
                </button>
                <button
                  onClick={() => setAmount(Math.round(customer.due / 2))}
                  className="text-[10px] px-2 h-6 rounded border border-border hover:bg-secondary"
                >
                  Half
                </button>
              </div>
            </div>
          )}
          {needsRef && (
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                Reference / TxID
              </label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TX1234567" />
            </div>
          )}
        </div>

        {/* Allocation preview / picker */}
        {dueInvoices.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No outstanding invoices. Payment will be applied as advance.
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-secondary/40 text-[11px] uppercase font-semibold text-muted-foreground">
              {mode === 'auto' ? 'Will apply to' : 'Choose how much to apply per invoice'}
            </div>
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Invoice</th>
                  <th className="text-left px-2 py-2 font-medium">Date</th>
                  <th className="text-right px-2 py-2 font-medium">Total</th>
                  <th className="text-right px-2 py-2 font-medium">Due</th>
                  <th className="text-right px-3 py-2 font-medium">Apply</th>
                </tr>
              </thead>
              <tbody>
                {dueInvoices.map((s) => {
                  const auto = allocation.find((a) => a.saleId === s.id)?.apply ?? 0;
                  const cur = mode === 'auto' ? auto : picked[s.id] ?? 0;
                  return (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{s.invoiceNo}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {new Date(s.date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular">
                        {formatBDT(s.total, { withSymbol: false })}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular text-destructive">
                        {formatBDT(s.due, { withSymbol: false })}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {mode === 'auto' ? (
                          <span className="font-mono tabular text-success">
                            {cur > 0 ? formatBDT(cur, { withSymbol: false }) : '—'}
                          </span>
                        ) : (
                          <NumberField
                            value={cur}
                            onChangeNumber={(v) =>
                              setPicked((p) => ({ ...p, [s.id]: Math.max(0, Math.min(s.due, v)) }))
                            }
                            placeholder="0"
                            className="h-8 w-24 px-2 text-right text-xs"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
