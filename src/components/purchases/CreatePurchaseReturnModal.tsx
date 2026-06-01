import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/NumberField';
import { Banknote, Smartphone, Building2, HandCoins, Undo2 } from 'lucide-react';
import {
  usePurchases,
  type PurchaseReturn,
  type ReturnRefundMethod,
  type ReturnReason,
  nextPurchaseReturnRef,
} from '@/stores/purchases';
import { cn, formatBDT } from '@/lib/utils';

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
  const purchase = purchases.find((p) => p.id === purchaseId);

  const [picked, setPicked] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason>('damaged');
  const [refundMethod, setRefundMethod] = useState<ReturnRefundMethod>('CreditAdjust');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setPicked({});
      setReason('damaged');
      setRefundMethod('CreditAdjust');
      setNotes('');
    }
  }, [open, purchase]);

  const lines = useMemo(() => {
    if (!purchase) return [];
    return Object.entries(picked)
      .filter(([_, qty]) => qty > 0)
      .map(([key, qty]) => {
        const line = purchase.lines.find((l) => l.productId === key)!;
        return {
          productId: key,
          name: line.name,
          sku: line.sku,
          qty,
          unit: line.unit,
          unitCost: line.unitCostBeforeTax,
          refundAmount: qty * line.unitCostBeforeTax,
        };
      });
  }, [picked, purchase]);

  const total = lines.reduce((s, l) => s + l.refundAmount, 0);

  const submit = () => {
    if (!purchase || lines.length === 0) return;
    const ret: PurchaseReturn = {
      id: 'pret_' + Date.now(),
      refNo: nextPurchaseReturnRef(),
      purchaseId: purchase.id,
      purchaseRefNo: purchase.refNo,
      date: new Date().toISOString(),
      supplierId: purchase.supplierId,
      supplierName: purchase.supplierName,
      user: 'Seam',
      reason,
      refundMethod,
      lines,
      total,
      notes: notes || undefined,
    };
    addReturn(ret);
    onClose();
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
            <span className="font-mono tabular font-semibold text-warning">{formatBDT(total)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={lines.length === 0}>
              <Undo2 className="size-4" /> Save Return
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-secondary/40 text-[11px] uppercase font-semibold text-muted-foreground">
            Pick items to return
          </div>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-right px-2 py-2 font-medium">Bought qty</th>
                <th className="text-right px-2 py-2 font-medium">Unit cost</th>
                <th className="text-right px-2 py-2 font-medium">Return qty</th>
                <th className="text-right px-3 py-2 font-medium">Refund</th>
              </tr>
            </thead>
            <tbody>
              {purchase.lines.map((l) => {
                const cur = picked[l.productId] ?? 0;
                return (
                  <tr key={l.productId} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{l.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{l.sku}</div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular">
                      {l.qty} {l.unit}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular">
                      {formatBDT(l.unitCostBeforeTax, { withSymbol: false })}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <NumberField
                        value={cur}
                        onChangeNumber={(v) => {
                          const clamped = Math.max(0, Math.min(l.qty, v));
                          setPicked((p) => ({ ...p, [l.productId]: clamped }));
                        }}
                        placeholder="0"
                        className="h-8 w-20 px-2 text-right text-xs ml-auto"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular font-semibold">
                      {formatBDT(cur * l.unitCostBeforeTax, { withSymbol: false })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReturnReason)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              {REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">
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
                      'h-9 px-2 rounded-md border text-[11px] font-medium transition inline-flex items-center justify-center gap-1',
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
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Notes</label>
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
