import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/NumberField';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { formatDate } from '@/lib/formatDate';
import { Banknote, Smartphone, CreditCard, Building2, FileText, Save } from 'lucide-react';
import { usePurchases, type PaymentMethod, type PurchaseRecord } from '@/stores/purchases';
import { useSuppliers } from '@/stores/contacts';
import { api } from '@/lib/api';
import { round2, sum2 } from '@/lib/money';
import { toast } from '@/stores/toast';
import { toSupplier, type BackendSupplier } from '@/hooks/contactAdapter';
import { toPurchaseRecord, type BackendPurchase } from '@/hooks/purchaseAdapter';
import type { Supplier } from '@/types/domain';
import { cn, formatBDT } from '@/lib/utils';

const METHODS: { id: PaymentMethod; icon: any; label: string; needsRef?: boolean }[] = [
  { id: 'Cash', icon: Banknote, label: 'Cash' },
  { id: 'bKash', icon: Smartphone, label: 'bKash', needsRef: true },
  { id: 'Nagad', icon: Smartphone, label: 'Nagad', needsRef: true },
  { id: 'Card', icon: CreditCard, label: 'Card', needsRef: true },
  { id: 'Bank', icon: Building2, label: 'Bank', needsRef: true },
  { id: 'Cheque', icon: FileText, label: 'Cheque', needsRef: true },
];

type Mode = 'auto' | 'pick';

interface Props {
  open: boolean;
  onClose: () => void;
  initialSupplierId?: string;
}

export function PayBillModal({ open, onClose, initialSupplierId }: Props) {
  const storePurchases = usePurchases((s) => s.purchases);
  const storeSuppliers = useSuppliers((s) => s.items);
  const paySupplier = useSuppliers((s) => s.paySupplier);

  /**
   * PAGINATION — both stores hold ONE PAGE, which is not enough for this modal:
   *   - the supplier select must offer EVERY supplier with a payable, and it
   *     needs the derived `due` per row (so `options`, which is id+name only,
   *     cannot serve it) → unpaged `suppliers.list`;
   *   - the allocation runs over the supplier's outstanding bills, and a bill
   *     missing from the current purchases page would silently drop out of it
   *     → unpaged `purchases.list` (headers carry `total`/`paid`/`due`).
   * Both fall back to the store page if the read fails (e.g. outside Electron).
   */
  const [allSuppliers, setAllSuppliers] = useState<Supplier[] | null>(null);
  const [fetchedSupplier, setFetchedSupplier] = useState<Supplier | null>(null);
  const [allBills, setAllBills] = useState<PurchaseRecord[] | null>(null);

  const [supplierId, setSupplierId] = useState(initialSupplierId ?? '');
  const [mode, setMode] = useState<Mode>('auto');
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [reference, setReference] = useState('');
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSupplierId(initialSupplierId ?? '');
      setMode('auto');
      setAmount(0);
      setMethod('Cash');
      setReference('');
      setPicked({});
    }
  }, [open, initialSupplierId]);

  // Full supplier list (with derived dues) for the select, loaded on open.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void api<BackendSupplier[]>('suppliers.list', {})
      .then((rows) => {
        if (alive) setAllSuppliers(rows.map(toSupplier));
      })
      .catch(() => {
        // Fall back to the store page below.
      });
    return () => {
      alive = false;
    };
  }, [open]);

  // Full bill list for the chosen supplier, so the allocation can see EVERY
  // outstanding bill and not just the ones on the current purchases page.
  useEffect(() => {
    if (!open || !supplierId) {
      setAllBills(null);
      return;
    }
    let alive = true;
    // Every bill that is not cancelled: the backend allocates over the same set
    // (an ordered bill can take an advance), so the preview has to match it.
    void api<BackendPurchase[]>('purchases.list', {})
      .then((rows) => {
        if (alive) setAllBills(rows.map(toPurchaseRecord));
      })
      .catch(() => {
        // Fall back to the store page below.
      });
    return () => {
      alive = false;
    };
  }, [open, supplierId]);

  const suppliers = allSuppliers ?? storeSuppliers;

  // Single-row fallback: an `initialSupplierId` handed in from another screen is
  // not guaranteed to be on the store page (and `suppliers.list` may be
  // unavailable), so read that one record directly when it is missing.
  const supplierInList = suppliers.find((s) => s.id === supplierId);
  useEffect(() => {
    if (!open || !supplierId || supplierInList) {
      setFetchedSupplier(null);
      return;
    }
    let alive = true;
    void api<BackendSupplier | null>('suppliers.get', { id: supplierId })
      .then((row) => {
        if (alive && row) setFetchedSupplier(toSupplier(row));
      })
      .catch(() => {
        // Channel error or running outside Electron — leave the picker empty.
      });
    return () => {
      alive = false;
    };
  }, [open, supplierId, supplierInList]);

  const supplier =
    supplierInList ?? (fetchedSupplier?.id === supplierId ? fetchedSupplier : undefined);

  // Suppliers with a payable, plus the pre-selected one when it only came from
  // the single-row fallback (otherwise the select would show a blank label).
  const supplierOptions = useMemo(() => {
    const withDue = suppliers.filter((s) => s.due > 0);
    if (supplier && !withDue.some((s) => s.id === supplier.id)) return [supplier, ...withDue];
    return withDue;
  }, [suppliers, supplier]);

  const dueBills = useMemo(() => {
    if (!supplierId) return [];
    return (allBills ?? storePurchases)
      .filter((p) => p.status !== 'cancelled' && p.supplierId === supplierId && p.due > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allBills, storePurchases, supplierId]);

  // The part of the payable that is NOT on an open bill: the opening balance
  // still owed. The backend pays it FIRST (services/accounts.ts).
  const openingPart = useMemo(() => {
    if (!supplier) return 0;
    return Math.max(0, round2(supplier.due - sum2(dueBills.map((b) => b.due))));
  }, [supplier, dueBills]);

  // Auto-allocate preview — the same order the backend uses.
  const allocation = useMemo(() => {
    if (mode !== 'auto') return { opening: 0, bills: [], advance: 0 };
    const opening = Math.min(amount, openingPart);
    let remaining = round2(amount - opening);
    const bills: { purchaseId: string; refNo: string; apply: number }[] = [];
    for (const inv of dueBills) {
      if (remaining <= 0) break;
      const apply = Math.min(inv.due, remaining);
      bills.push({ purchaseId: inv.id, refNo: inv.refNo, apply });
      remaining = round2(remaining - apply);
    }
    return { opening, bills, advance: Math.max(0, remaining) };
  }, [mode, amount, dueBills, openingPart]);

  const pickedTotal = Object.values(picked).reduce((s, v) => s + v, 0);
  const effective = mode === 'auto' ? amount : pickedTotal;
  const m = METHODS.find((x) => x.id === method)!;

  // ONE backend call, one transaction (services/accounts.ts). This used to loop
  // one un-awaited purchases.addPayment per bill, and money beyond the bills was
  // saved nowhere.
  const submit = async () => {
    if (!supplier || effective <= 0 || saving) return;
    setSaving(true);
    const allocations =
      mode === 'pick'
        ? Object.entries(picked)
            .filter(([, v]) => v > 0)
            .map(([docId, v]) => ({ docId, amount: v }))
        : undefined;
    const res = await paySupplier(supplier.id, effective, method, reference || undefined, allocations);
    setSaving(false);
    if (!res) return;
    const parts: string[] = [];
    if (res.toOpening > 0) parts.push(`Opening balance ${formatBDT(res.toOpening)}`);
    if (res.allocated > 0) parts.push(`Bills ${formatBDT(res.allocated)}`);
    if (res.advance > 0) parts.push(`Advance ${formatBDT(res.advance)}`);
    toast.success('Payment recorded', { description: parts.join(' · ') });
    onClose();
  };

  const stillOwed = Math.max(0, round2((supplier?.due ?? 0) - effective));
  const oldest = dueBills[0];
  const noneOwed = allSuppliers !== null && supplierOptions.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title="Pay a supplier"
      subtitle={supplier?.name}
      footer={
        noneOwed ? (
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Paying</span>{' '}
              <span className="tabular font-semibold text-success">{formatBDT(effective)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => void submit()} disabled={!supplier || effective <= 0 || saving}>
                <Save className="size-4" /> Save Payment
              </Button>
            </div>
          </div>
        )
      }
    >
      {noneOwed ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          You don’t owe any supplier right now.
        </div>
      ) : (
      <form
        className="p-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {/* 1. Supplier */}
        <FormField label="Supplier" required>
          {(f) => (
            <Select
              {...f}
              autoFocus={!initialSupplierId}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">Select supplier…</option>
              {supplierOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatBDT(s.due)}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        {supplier && (
          <>
            {/* 2. Amount first — it is what the buyer came to type. */}
            {mode === 'auto' && (
              <FormField label="Amount" required hint="Recorded as paid now.">
                {(f) => (
                  <div className="space-y-2">
                    <NumberField
                      {...f}
                      key={supplier.id}
                      autoFocus
                      value={amount}
                      onChangeNumber={setAmount}
                      className="h-11 text-right text-lg font-semibold"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAmount(supplier.due)}
                        className="h-8 px-3 text-xs rounded-md border border-border hover:bg-secondary"
                      >
                        <span>All</span> <span className="tabular">{formatBDT(supplier.due)}</span>
                      </button>
                      {oldest && oldest.due !== supplier.due && openingPart === 0 && (
                        <button
                          type="button"
                          onClick={() => setAmount(oldest.due)}
                          className="h-8 px-3 text-xs rounded-md border border-border hover:bg-secondary"
                        >
                          <span>Oldest bill</span> <span className="tabular">{formatBDT(oldest.due)}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </FormField>
            )}

            {/* 3. Method (+ reference) */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Paid by</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {METHODS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={method === opt.id}
                      onClick={() => setMethod(opt.id)}
                      className={cn(
                        'h-12 rounded-md border text-sm font-medium transition inline-flex flex-col items-center justify-center gap-0.5',
                        method === opt.id
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border hover:bg-secondary',
                      )}
                    >
                      <Icon className="size-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {m.needsRef && (
                <FormField label="Reference / TxID">
                  {(f) => (
                    <Input {...f} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TX1234567" />
                  )}
                </FormField>
              )}
            </div>

            {/* 4. Where it goes — opening balance, bills, advance, still owed. */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">Where it goes</div>
                <Segmented
                  size="sm"
                  ariaLabel="How to apply the payment"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'auto', label: 'Oldest bills first' },
                    { value: 'pick', label: 'I’ll choose the bills' },
                  ]}
                />
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground bg-secondary/40">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Bill</th>
                      <th className="text-right px-2 py-2 font-medium">Owed</th>
                      <th className="text-right px-3 py-2 font-medium">This payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openingPart > 0 && (
                      <tr className="border-t border-border">
                        <td className="px-3 py-2">
                          <div>Opening balance</div>
                          {mode === 'pick' && (
                            <div className="text-xs text-muted-foreground">Paid only with Oldest bills first</div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular text-destructive">
                          {formatBDT(openingPart, { withSymbol: false })}
                        </td>
                        <td className="px-3 py-2 text-right tabular text-success">
                          {mode === 'auto' && allocation.opening > 0
                            ? formatBDT(allocation.opening, { withSymbol: false })
                            : '—'}
                        </td>
                      </tr>
                    )}
                    {dueBills.map((p) => {
                      const auto = allocation.bills.find((a) => a.purchaseId === p.id)?.apply ?? 0;
                      const cur = mode === 'auto' ? auto : picked[p.id] ?? 0;
                      return (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-3 py-2">
                            <div className="font-mono whitespace-nowrap">{p.refNo}</div>
                            <div className="text-xs text-muted-foreground">{formatDate(p.date)}</div>
                          </td>
                          <td className="px-2 py-2 text-right tabular text-destructive">
                            {formatBDT(p.due, { withSymbol: false })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {mode === 'auto' ? (
                              <span className="tabular text-success">
                                {cur > 0 ? formatBDT(cur, { withSymbol: false }) : '—'}
                              </span>
                            ) : (
                              <NumberField
                                value={cur}
                                aria-label="Amount for this bill"
                                onChangeNumber={(v) =>
                                  setPicked((pp) => ({ ...pp, [p.id]: Math.max(0, Math.min(p.due, v)) }))
                                }
                                placeholder="0"
                                className="h-9 w-28 px-2 text-right text-sm ml-auto"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {mode === 'auto' && allocation.advance > 0 && (
                      <tr className="border-t border-border">
                        <td className="px-3 py-2" colSpan={2}>
                          Advance kept with supplier
                        </td>
                        <td className="px-3 py-2 text-right tabular text-success">
                          {formatBDT(allocation.advance, { withSymbol: false })}
                        </td>
                      </tr>
                    )}
                    {dueBills.length === 0 && openingPart === 0 && (
                      <tr className="border-t border-border">
                        <td colSpan={3} className="px-3 py-3 text-muted-foreground">
                          No open bills. The payment is kept as an advance with the supplier.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-secondary/30 font-semibold">
                      <td className="px-3 py-2.5" colSpan={2}>
                        Still owed after this
                      </td>
                      <td className={cn('px-3 py-2.5 text-right tabular', stillOwed > 0 ? 'text-destructive' : 'text-success')}>
                        {formatBDT(stillOwed)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
      )}
    </Modal>
  );
}
