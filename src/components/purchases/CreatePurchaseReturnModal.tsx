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
import { cn, formatBDT } from '@/lib/utils';
import { currentUserName } from '@/lib/actor';
import { purchaseReturnRefund, round2, sum2 } from '@/lib/money';
import { api } from '@/lib/api';
import { toPurchaseRecord, type BackendPurchase } from '@/hooks/purchaseAdapter';

const REASONS: { id: ReturnReason; label: string }[] = [
  { id: 'damaged', label: 'Damaged' },
  { id: 'wrong-item', label: 'Wrong item' },
  { id: 'expired', label: 'Expired' },
  { id: 'short-shipped', label: 'Short shipped' },
  { id: 'other', label: 'Other' },
];

const REFUND: { id: ReturnRefundMethod; icon: any; label: string; hint: string }[] = [
  { id: 'CashRefund', icon: Banknote, label: 'Cash refund', hint: 'Cashback from supplier' },
  { id: 'CreditAdjust', icon: HandCoins, label: 'Credit adjust', hint: 'Reduce supplier due' },
  { id: 'Bank', icon: Building2, label: 'Bank reversal', hint: 'Bank transfer back' },
  { id: 'bKash', icon: Smartphone, label: 'bKash', hint: 'Reverse to bKash' },
  { id: 'Nagad', icon: Smartphone, label: 'Nagad', hint: 'Reverse to Nagad' },
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
      title={`Create Purchase Return — ${purchase.refNo}`}
      subtitle={`Supplier: ${purchase.supplierName}`}
      footer={
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Refund total: </span>
            <span className="tabular font-semibold text-warning">{formatBDT(total)}</span>
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
          <div className="px-3 py-2 border-b border-border bg-secondary/40 text-xs font-semibold text-muted-foreground">
            Pick items to return
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-right px-2 py-2 font-medium">Bought qty</th>
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
                      {l.qty} {l.unit}
                    </td>
                    <td className="px-2 py-2 text-right tabular">
                      {formatBDT(l.unitCostBeforeTax, { withSymbol: false })}
                    </td>
                    <td
                      className={cn(
                        'px-2 py-2 text-right tabular',
                        left <= 0 && 'text-muted-foreground',
                      )}
                    >
                      {left}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <NumberField
                        value={cur}
                        disabled={left <= 0}
                        onChangeNumber={(v) => {
                          const clamped = Math.max(0, Math.min(left, v));
                          setPicked((p) => ({ ...p, [idx]: clamped }));
                        }}
                        placeholder="0"
                        className="h-8 w-20 px-2 text-right text-xs ml-auto"
                      />
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReturnReason)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              {REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Refund method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1">
              {REFUND.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    title={m.hint}
                    onClick={() => setRefundMethod(m.id)}
                    className={cn(
                      'h-9 px-2 rounded-md border text-xs font-medium transition inline-flex items-center justify-center gap-1',
                      refundMethod === m.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-secondary',
                    )}
                  >
                    <Icon className="size-3.5" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Internal notes…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
          />
        </div>
      </div>
    </Modal>
  );
}
