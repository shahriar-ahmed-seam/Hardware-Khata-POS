import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useSales, type ReturnLine, type SellReturn, nextReturnNo } from '@/stores/sales';
import { cn, formatBDT } from '@/lib/utils';
import { Undo2, Banknote, Smartphone, CreditCard, Building2, HandCoins, Wallet } from 'lucide-react';
import { NumberField } from '@/components/ui/NumberField';

const REASONS: { id: SellReturn['reason']; label: string }[] = [
  { id: 'damaged', label: 'Damaged' },
  { id: 'wrong-item', label: 'Wrong item' },
  { id: 'changed-mind', label: 'Customer changed mind' },
  { id: 'defective', label: 'Defective' },
  { id: 'warranty', label: 'Warranty replacement' },
  { id: 'other', label: 'Other' },
];

const REFUND: {
  id: SellReturn['refundMethod'];
  label: string;
  icon: any;
  hint: string;
}[] = [
  { id: 'Cash', label: 'Cash', icon: Banknote, hint: 'Refund from drawer' },
  { id: 'CreditAdjust', label: 'Credit Adjust', icon: HandCoins, hint: 'Reduce customer due' },
  { id: 'StoreCredit', label: 'Store Credit', icon: Wallet, hint: 'Future-use balance' },
  { id: 'bKash', label: 'bKash', icon: Smartphone, hint: 'Reverse to bKash' },
  { id: 'Nagad', label: 'Nagad', icon: Smartphone, hint: 'Reverse to Nagad' },
  { id: 'Card', label: 'Card', icon: CreditCard, hint: 'Reverse to card' },
  { id: 'Bank', label: 'Bank', icon: Building2, hint: 'Bank transfer' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  saleId: string | null;
}

export function CreateReturnModal({ open, onClose, saleId }: Props) {
  const sales = useSales((s) => s.sales);
  const addReturn = useSales((s) => s.addReturn);
  const sale = sales.find((s) => s.id === saleId);

  const [picked, setPicked] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<SellReturn['reason']>('damaged');
  const [refundMethod, setRefundMethod] = useState<SellReturn['refundMethod']>('Cash');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setPicked({});
      setReason('damaged');
      setNotes('');
      // Default refund based on original payment method
      if (sale) {
        const m = sale.payments[0]?.method;
        if (m === 'Credit') setRefundMethod('CreditAdjust');
        else if (m && m !== 'Cash') setRefundMethod(m as SellReturn['refundMethod']);
        else setRefundMethod('Cash');
      }
    }
  }, [open, sale]);

  const lines = useMemo<ReturnLine[]>(() => {
    if (!sale) return [];
    return Object.entries(picked)
      .filter(([_, qty]) => qty > 0)
      .map(([key, qty]) => {
        const line = sale.lines.find((l) => l.productId === key)!;
        return {
          productId: key,
          name: line.name,
          sku: line.sku,
          qty,
          unit: line.unit,
          unitPrice: line.unitPrice,
          refundAmount: qty * line.unitPrice,
        };
      });
  }, [picked, sale]);

  const total = lines.reduce((s, l) => s + l.refundAmount, 0);

  const submit = () => {
    if (!sale || lines.length === 0) return;
    const ret: SellReturn = {
      id: 'ret_' + Date.now(),
      refNo: nextReturnNo(),
      saleId: sale.id,
      saleInvoiceNo: sale.invoiceNo,
      date: new Date().toISOString(),
      customerId: sale.customerId,
      customerName: sale.customerName,
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

  if (!sale) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title={`Create Return — ${sale.invoiceNo}`}
      subtitle={`Customer: ${sale.customerName}`}
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
        {/* Lines picker */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-secondary/40 text-[11px] uppercase font-semibold text-muted-foreground">
            Pick items to return
          </div>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-right px-2 py-2 font-medium">Sold qty</th>
                <th className="text-right px-2 py-2 font-medium">Unit price</th>
                <th className="text-right px-2 py-2 font-medium">Return qty</th>
                <th className="text-right px-3 py-2 font-medium">Refund</th>
              </tr>
            </thead>
            <tbody>
              {sale.lines.map((l) => {
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
                      {formatBDT(l.unitPrice, { withSymbol: false })}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <NumberField
                        value={cur}
                        onChangeNumber={(v) => {
                          const clamped = Math.max(0, Math.min(l.qty, v));
                          setPicked((p) => ({ ...p, [l.productId]: clamped }));
                        }}
                        placeholder="0"
                        className="h-8 w-20 px-2 text-right text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular font-semibold">
                      {formatBDT(cur * l.unitPrice, { withSymbol: false })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Reason + refund method */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as SellReturn['reason'])}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              {REASONS.map((r) => (
                <option key={r.id} value={r.id ?? ''}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">
              Refund method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
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
