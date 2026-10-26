import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/NumberField';
import { Banknote, Smartphone, Building2, HandCoins, Undo2 } from 'lucide-react';
import {
  usePurchases,
  type PurchaseRecord,
  type PurchaseReturn,
  type ReturnRefundMethod,
  type ReturnReason,
  nextPurchaseReturnRef,
} from '@/stores/purchases';
import { cn, formatBDT, formatNumber } from '@/lib/utils';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { RETURN_REASONS, REFUND_LABEL } from './labels';
import { currentUserName } from '@/lib/actor';
import { purchaseReturnRefund, round2, sum2 } from '@/lib/money';
import { api } from '@/lib/api';
import { toPurchaseRecord, type BackendPurchase } from '@/hooks/purchaseAdapter';

// Words + hints live in ./labels (shared with the Purchase Returns list).
const REFUND: { id: ReturnRefundMethod; icon: typeof Banknote }[] = [
  { id: 'CreditAdjust', icon: HandCoins },
  { id: 'CashRefund', icon: Banknote },
  { id: 'Bank', icon: Building2 },
  { id: 'bKash', icon: Smartphone },
  { id: 'Nagad', icon: Smartphone },
];

interface Props {
  open: boolean;
  onClose: () => void;
  purchaseId: string | null;
}

export function CreatePurchaseReturnModal({ open, onClose, purchaseId }: Props) {
  const purchases = usePurchases((s) => s.purchases);
  const addReturn = usePurchases((s) => s.addReturn);
  // One page of purchases in the store; read the bill directly when it is not on
  // it, or the modal renders nothing.
  const storePurchase = purchases.find((p) => p.id === purchaseId) ?? null;
  const [fetched, setFetched] = useState<PurchaseRecord | null>(null);
  const purchase = storePurchase ?? (fetched?.id === purchaseId ? fetched : null);

  // Keyed by LINE INDEX — the same product on two lines used to share one row.
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [returned, setReturned] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason>('damaged');
  const [refundMethod, setRefundMethod] = useState<ReturnRefundMethod>('CreditAdjust');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const hasStorePurchase = !!storePurchase;
  useEffect(() => {
    if (!open || !purchaseId) return;
    let alive = true;
    if (!hasStorePurchase) {
      void api<BackendPurchase | null>('purchases.get', { id: purchaseId })
        .then((row) => {
          if (alive && row) setFetched(toPurchaseRecord(row));
        })
        .catch(() => {});
    }
    void api<Record<string, number>>('purchaseReturns.getReturnedQty', { purchaseId })
      .then((r) => {
        if (alive) setReturned(r ?? {});
      })
      .catch(() => {
        if (alive) setReturned({});
      });
    return () => {
      alive = false;
    };
  }, [open, purchaseId, hasStorePurchase]);

  useEffect(() => {
    if (open) {
      setPicked({});
      setReason('damaged');
      setRefundMethod('CreditAdjust');
      setNotes('');
    }
  }, [open, purchase]);

  // Still returnable per line, in the bill's own unit (dozens stay dozens).
  const remaining = useMemo(() => {
    if (!purchase) return [] as number[];
    const left: Record<string, number> = { ...returned };
    return purchase.lines.map((l) => {
      const already = Math.min(l.qty, left[l.productId] ?? 0);
      left[l.productId] = (left[l.productId] ?? 0) - already;
      return round2(l.qty - already);
    });
  }, [purchase, returned]);

  /**
   * What the shop paid for those items: the line's total per unit (its discount
   * and tax included) less its share of any whole-bill discount — via
   * `purchaseReturnRefund` in lib/money.ts. It used to be `qty × unit cost
   * before tax`, which left the line tax out.
   */
  const refundFor = (idx: number, qty: number) => {
    if (!purchase) return 0;
    const l = purchase.lines[idx];
    return purchaseReturnRefund({
      lineTotal: l.lineTotal,
      lineQty: l.qty,
      returnQty: qty,
      afterLine: round2(purchase.subtotal - purchase.totalLineDiscount),
      orderDiscount: purchase.orderDiscount,
    });
  };

  const lines = useMemo(() => {
    if (!purchase) return [];
    return Object.entries(picked)
      .map(([k, qty]) => [Number(k), qty] as const)
      .filter(([idx, qty]) => qty > 0 && !!purchase.lines[idx])
      .map(([idx, qty]) => {
        const line = purchase.lines[idx];
        return {
          productId: line.productId,
          name: line.name,
          sku: line.sku,
          qty,
          unit: line.unit,
          unitCost: line.unitCostBeforeTax,
          refundAmount: refundFor(idx, qty),
        };
      });
    // refundFor reads only `purchase`, which is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, purchase]);

  const total = sum2(lines.map((l) => l.refundAmount));
  const nothingLeft = remaining.length > 0 && remaining.every((r) => r <= 0);

  const submit = async () => {
    if (!purchase || lines.length === 0 || saving) return;
    const ret: PurchaseReturn = {
      id: 'pret_' + Date.now(),
      refNo: nextPurchaseReturnRef(),
      purchaseId: purchase.id,
      purchaseRefNo: purchase.refNo,
      date: new Date().toISOString(),
      supplierId: purchase.supplierId,
      supplierName: purchase.supplierName,
      user: currentUserName(),
      reason,
      refundMethod,
      lines,
      total,
      notes: notes || undefined,
    };
    setSaving(true);
    const ok = await addReturn(ret);
    setSaving(false);
    if (ok) onClose();
  };

  if (!purchase) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title="Send goods back to the supplier"
      subtitle={`${purchase.supplierName} · ${purchase.refNo}`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Refund total</span>{' '}
            <span className="tabular font-semibold">{formatBDT(total)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={lines.length === 0 || saving}>
              <Undo2 className="size-4" /> Save Return
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-secondary/40 text-sm font-medium">
            Pick items to return
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-right px-2 py-2 font-medium">Unit cost</th>
                <th className="text-right px-2 py-2 font-medium">Can return</th>
                <th className="text-right px-2 py-2 font-medium">Return qty</th>
                <th className="text-right px-3 py-2 font-medium">Refund</th>
              </tr>
            </thead>
            <tbody>
              {purchase.lines.map((l, idx) => {
                const cur = picked[idx] ?? 0;
                const left = remaining[idx] ?? l.qty;
                return (
                  <tr key={idx} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{l.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{l.sku}</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular">
                      {formatBDT(l.unitCostBeforeTax, { withSymbol: false })}
                    </td>
                    {/* "10 of 12 pc" — bought and returnable in one cell. */}
                    <td className={cn('px-2 py-2 text-right tabular whitespace-nowrap', left <= 0 && 'text-muted-foreground')}>
                      {formatNumber(left)} <span className="text-muted-foreground">of</span> {formatNumber(l.qty)}{' '}
                      <span className="text-xs text-muted-foreground">{l.unit}</span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <NumberField
                          value={cur}
                          disabled={left <= 0}
                          aria-label="Return qty"
                          onChangeNumber={(v) => {
                            const clamped = Math.max(0, Math.min(left, v));
                            setPicked((p) => ({ ...p, [idx]: clamped }));
                          }}
                          placeholder="0"
                          className="h-9 w-24 px-2 text-right text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9"
                          disabled={left <= 0}
                          onClick={() => setPicked((p) => ({ ...p, [idx]: left }))}
                        >
                          All
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular font-semibold">
                      {formatBDT(refundFor(idx, cur), { withSymbol: false })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {nothingLeft && (
            <div className="px-3 py-2 border-t border-border text-sm text-muted-foreground">
              Everything on this bill has already been returned.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">How the money comes back</div>
          <div className="grid grid-cols-5 gap-1.5">
            {REFUND.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={refundMethod === m.id}
                  onClick={() => setRefundMethod(m.id)}
                  className={cn(
                    'h-10 px-2 rounded-md border text-sm font-medium transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
                    refundMethod === m.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  <Icon className="size-4 shrink-0" /> <span className="truncate">{REFUND_LABEL[m.id].label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{REFUND_LABEL[refundMethod].hint}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4">
          <FormField label="Reason">
            {(f) => (
              <Select {...f} value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)}>
                {RETURN_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Notes">
            {(f) => (
              <textarea
                {...f}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={1}
                placeholder="Internal notes…"
                className="w-full min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
              />
            )}
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
