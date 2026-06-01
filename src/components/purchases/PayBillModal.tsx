import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/NumberField';
import { Input } from '@/components/ui/Input';
import { Banknote, Smartphone, CreditCard, Building2, FileText, Save } from 'lucide-react';
import { usePurchases, type PaymentMethod } from '@/stores/purchases';
import { useSuppliers } from '@/stores/contacts';
import { hasBackend } from '@/lib/api';
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
  const purchases = usePurchases((s) => s.purchases);
  const addPayment = usePurchases((s) => s.addPayment);
  const suppliers = useSuppliers((s) => s.items);
  const paySupplier = useSuppliers((s) => s.paySupplier);

  const [supplierId, setSupplierId] = useState(initialSupplierId ?? '');
  const [mode, setMode] = useState<Mode>('auto');
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [reference, setReference] = useState('');
  const [picked, setPicked] = useState<Record<string, number>>({});

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

  const supplier = suppliers.find((s) => s.id === supplierId);

  const dueBills = useMemo(() => {
    if (!supplierId) return [];
    return purchases
      .filter((p) => p.status === 'received' && p.supplierId === supplierId && p.due > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [purchases, supplierId]);

  // Auto-allocate preview
  const allocation = useMemo(() => {
    if (mode !== 'auto') return [];
    let remaining = amount;
    const out: { purchaseId: string; refNo: string; apply: number }[] = [];
    for (const inv of dueBills) {
      if (remaining <= 0) break;
      const apply = Math.min(inv.due, remaining);
      out.push({ purchaseId: inv.id, refNo: inv.refNo, apply });
      remaining -= apply;
    }
    return out;
  }, [mode, amount, dueBills]);

  const pickedTotal = Object.values(picked).reduce((s, v) => s + v, 0);
  const effective = mode === 'auto' ? amount : pickedTotal;
  const m = METHODS.find((x) => x.id === method)!;

  const submit = () => {
    if (!supplier || effective <= 0) return;
    // MONEY-CORRECTNESS: avoid double-counting the payment.
    // Under the BACKEND, supplier due is DERIVED from purchases minus
    // purchase_payments. The per-bill addPayment() calls below hit
    // api('purchases.addPayment') and rehydrate, so they are the single source
    // of truth — calling suppliers.pay() here too would record the payment
    // TWICE. So we ONLY run paySupplier() in mock mode (where it adjusts the
    // mock contacts store and there is no per-bill persistence layer).
    if (!hasBackend()) {
      paySupplier(supplier.id, effective);
    }
    if (mode === 'auto') {
      allocation.forEach((a) =>
        addPayment(a.purchaseId, {
          method,
          amount: a.apply,
          reference: reference || undefined,
          paidAt: new Date().toISOString(),
        }),
      );
    } else {
      Object.entries(picked).forEach(([id, amt]) => {
        if (amt > 0)
          addPayment(id, {
            method,
            amount: amt,
            reference: reference || undefined,
            paidAt: new Date().toISOString(),
          });
      });
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title="Pay Bill"
      subtitle="Settle outstanding supplier dues"
      footer={
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Paying </span>
            <span className="font-mono tabular font-semibold text-success">
              {formatBDT(effective)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!supplier || effective <= 0}>
              <Save className="size-4" /> Save Payment
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
            Supplier *
          </label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="">Select supplier…</option>
            {suppliers
              .filter((s) => s.due > 0)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatBDT(s.due)}
                </option>
              ))}
          </select>
        </div>

        {supplier && (
          <>
            <div className="flex items-center gap-1 p-0.5 bg-secondary rounded-md text-xs w-max">
              {(['auto', 'pick'] as const).map((mm) => (
                <button
                  key={mm}
                  onClick={() => setMode(mm)}
                  className={cn(
                    'px-3 h-8 rounded font-medium transition',
                    mode === mm ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {mm === 'auto' ? 'Auto-allocate (oldest first)' : 'Pick bills manually'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {METHODS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setMethod(opt.id)}
                    className={cn(
                      'h-12 rounded-md border text-xs font-medium transition inline-flex flex-col items-center justify-center gap-1',
                      method === opt.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-secondary',
                    )}
                  >
                    <Icon className="size-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mode === 'auto' && (
                <div>
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Amount
                  </label>
                  <NumberField value={amount} onChangeNumber={setAmount} className="text-right text-base" />
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={() => setAmount(supplier.due)}
                      className="text-[10px] px-2 h-6 rounded border border-border hover:bg-secondary"
                    >
                      Full payable ({formatBDT(supplier.due, { withSymbol: false })})
                    </button>
                  </div>
                </div>
              )}
              {m.needsRef && (
                <div>
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Reference / TxID
                  </label>
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="TX1234567"
                  />
                </div>
              )}
            </div>

            {dueBills.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No outstanding bills. Payment will be recorded as advance.
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-secondary/40 text-[11px] uppercase font-semibold text-muted-foreground">
                  {mode === 'auto' ? 'Will apply to' : 'Choose how much per bill'}
                </div>
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Reference</th>
                      <th className="text-left px-2 py-2 font-medium">Date</th>
                      <th className="text-right px-2 py-2 font-medium">Total</th>
                      <th className="text-right px-2 py-2 font-medium">Due</th>
                      <th className="text-right px-3 py-2 font-medium">Apply</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueBills.map((p) => {
                      const auto = allocation.find((a) => a.purchaseId === p.id)?.apply ?? 0;
                      const cur = mode === 'auto' ? auto : picked[p.id] ?? 0;
                      return (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-xs">{p.refNo}</td>
                          <td className="px-2 py-2 text-xs text-muted-foreground">
                            {new Date(p.date).toLocaleDateString('en-GB')}
                          </td>
                          <td className="px-2 py-2 text-right font-mono tabular">
                            {formatBDT(p.total, { withSymbol: false })}
                          </td>
                          <td className="px-2 py-2 text-right font-mono tabular text-destructive">
                            {formatBDT(p.due, { withSymbol: false })}
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
                                  setPicked((pp) => ({
                                    ...pp,
                                    [p.id]: Math.max(0, Math.min(p.due, v)),
                                  }))
                                }
                                placeholder="0"
                                className="h-8 w-24 px-2 text-right text-xs ml-auto"
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
          </>
        )}
      </div>
    </Modal>
  );
}
