import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  useSales,
  type ReturnLine,
  type SaleRecord,
  type SellReturn,
  nextReturnNo,
} from '@/stores/sales';
import { cn, formatBDT } from '@/lib/utils';
import { currentUserName } from '@/lib/actor';
import { returnRefund, round2, saleLineSubtotal, sum2 } from '@/lib/money';
import { api } from '@/lib/api';
import { toSaleRecord, type BackendSale } from '@/hooks/saleAdapter';
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
  { id: 'StoreCredit', label: 'Store Credit', icon: Wallet, hint: 'Kept on their account for next time' },
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
  // The store holds ONE PAGE of sales; a sale opened from a search, a deep link
  // or another page is read directly (same fallback as SaleDetail). Without it
  // the modal rendered nothing and "Create Return" looked dead.
  const storeSale = sales.find((s) => s.id === saleId) ?? null;
  const [fetched, setFetched] = useState<SaleRecord | null>(null);
  const sale = storeSale ?? (fetched?.id === saleId ? fetched : null);

  // Keyed by LINE INDEX, not product: the same product on two lines used to
  // collapse into one row, and one row's figure was applied to both.
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [returned, setReturned] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<SellReturn['reason']>('damaged');
  const [refundMethod, setRefundMethod] = useState<SellReturn['refundMethod']>('Cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const hasStoreSale = !!storeSale;
  useEffect(() => {
    if (!open || !saleId) return;
    let alive = true;
    if (!hasStoreSale) {
      void api<BackendSale | null>('sales.get', { id: saleId })
        .then((row) => {
          if (alive && row) setFetched(toSaleRecord(row));
        })
        .catch(() => {});
    }
    // What has already come back, so each line offers only what is left.
    void api<Record<string, number>>('sellReturns.getReturnedQty', { saleId })
      .then((r) => {
        if (alive) setReturned(r ?? {});
      })
      .catch(() => {
        if (alive) setReturned({});
      });
    return () => {
      alive = false;
    };
  }, [open, saleId, hasStoreSale]);

  // A walk-in sale has nobody to hold store credit or a credit note; the
  // backend refuses both, so they are not offered.
  const hasCustomer = !!sale?.customerId && sale.customerId !== 'cu1';
  const refundOptions = REFUND.filter(
    (m) => hasCustomer || (m.id !== 'StoreCredit' && m.id !== 'CreditAdjust'),
  );

  useEffect(() => {
    if (open) {
      setPicked({});
      setReason('damaged');
      setNotes('');
      if (sale) {
        // An unpaid balance is the natural place for a credit note; otherwise
        // refund the way the customer paid.
        const m = sale.payments[0]?.method;
        if (hasCustomer && sale.due > 0) setRefundMethod('CreditAdjust');
        else if (m && m !== 'Cash' && REFUND.some((r) => r.id === m)) {
          setRefundMethod(m as SellReturn['refundMethod']);
        } else setRefundMethod('Cash');
      }
    }
  }, [open, sale, hasCustomer]);

  // What is still returnable on each line: the sale's quantity less what earlier
  // returns took, allocated across lines of the same product in order.
  const remaining = useMemo(() => {
    if (!sale) return [] as number[];
    const left: Record<string, number> = { ...returned };
    return sale.lines.map((l) => {
      const already = Math.min(l.qty, left[l.productId] ?? 0);
      left[l.productId] = (left[l.productId] ?? 0) - already;
      return round2(l.qty - already);
    });
  }, [sale, returned]);

  /**
   * The refund is what the customer PAID for those items — the line's own
   * discounted price, less its share of any order discount, plus VAT — via
   * `returnRefund` in lib/money.ts (mirrors computeReturnRefund in the core,
   * which the backend uses as its ceiling). It used to be `qty × unit price`,
   * the price before every discount, so a discounted sale refunded more than was
   * ever taken.
   */
  const refundFor = (idx: number, qty: number) => {
    if (!sale) return 0;
    const l = sale.lines[idx];
    return returnRefund({
      lineSubtotal: saleLineSubtotal(l),
      lineQty: l.qty,
      returnQty: qty,
      subtotal: sale.subtotal,
      orderDiscount: sale.orderDiscount,
      taxPct: sale.taxPct,
    });
  };

  const lines = useMemo<ReturnLine[]>(() => {
    if (!sale) return [];
    return Object.entries(picked)
      .map(([k, qty]) => [Number(k), qty] as const)
      .filter(([idx, qty]) => qty > 0 && !!sale.lines[idx])
      .map(([idx, qty]) => {
        const line = sale.lines[idx];
        return {
          productId: line.productId,
          name: line.name,
          sku: line.sku,
          qty,
          unit: line.unit,
          unitPrice: line.unitPrice,
          refundAmount: refundFor(idx, qty),
        };
      });
    // refundFor reads only `sale`, which is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, sale]);

  const total = sum2(lines.map((l) => l.refundAmount));
  const nothingLeft = remaining.length > 0 && remaining.every((r) => r <= 0);

  const submit = async () => {
    if (!sale || lines.length === 0 || saving) return;
    const ret: SellReturn = {
      id: 'ret_' + Date.now(),
      refNo: nextReturnNo(),
      saleId: sale.id,
      saleInvoiceNo: sale.invoiceNo,
      date: new Date().toISOString(),
      customerId: sale.customerId,
      customerName: sale.customerName,
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
    // Stays open on a refusal, so what was picked is not lost.
    if (ok) onClose();
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
        {/* Lines picker */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-secondary/40 text-xs font-semibold text-muted-foreground">
            Pick items to return
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-right px-2 py-2 font-medium">Sold qty</th>
                <th className="text-right px-2 py-2 font-medium">Can return</th>
                <th className="text-right px-2 py-2 font-medium">Return qty</th>
                <th className="text-right px-3 py-2 font-medium">Refund</th>
              </tr>
            </thead>
            <tbody>
              {sale.lines.map((l, idx) => {
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
                        className="h-8 w-20 px-2 text-right text-xs"
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
              Everything on this invoice has already been returned.
            </div>
          )}
        </div>

        {/* Reason + refund method */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as SellReturn['reason'])}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              {REASONS.map((r) => (
                <option key={r.id} value={r.id ?? ''}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Refund method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
              {refundOptions.map((m) => {
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
