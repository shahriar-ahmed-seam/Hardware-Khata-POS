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
import { FormField } from '@/components/ui/FormField';
import { Segmented } from '@/components/ui/Segmented';

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
  { id: 'Cash', label: 'Cash back', icon: Banknote, hint: 'Refund from drawer' },
  { id: 'CreditAdjust', label: 'Take off their due', icon: HandCoins, hint: 'Reduce customer due' },
  { id: 'StoreCredit', label: 'Keep as credit', icon: Wallet, hint: 'Kept on their account for next time' },
  { id: 'bKash', label: 'bKash', icon: Smartphone, hint: 'Reverse to bKash' },
  { id: 'Nagad', label: 'Nagad', icon: Smartphone, hint: 'Reverse to Nagad' },
  { id: 'Card', label: 'Card', icon: CreditCard, hint: 'Reverse to card' },
  { id: 'Bank', label: 'Bank', icon: Building2, hint: 'Bank transfer' },
];

/** Folded under "Other method" unless the sale was paid that way. */
const OTHER_METHODS = new Set<string>(['bKash', 'Nagad', 'Card', 'Bank']);

/** Save button verb per refund way (the amount follows in its own span). */
const SAVE_LABEL: Partial<Record<SellReturn['refundMethod'], string>> = {
  Cash: 'Give cash back',
  CreditAdjust: 'Take off due',
  StoreCredit: 'Keep as credit',
};

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
  // No default reason: an untouched form used to record "Damaged".
  const [reason, setReason] = useState<SellReturn['reason']>(undefined);
  const [showOther, setShowOther] = useState(false);
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
      setReason(undefined);
      setShowOther(false);
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
    if (!sale || lines.length === 0 || !reason || saving) return;
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

  // The less common refund ways stay folded unless the sale was paid that way.
  const paidWith = new Set(sale.payments.map((p) => p.method as string));
  const mainRefunds = refundOptions.filter(
    (m) => !OTHER_METHODS.has(m.id) || paidWith.has(m.id) || m.id === refundMethod,
  );
  const otherRefunds = refundOptions.filter((m) => !mainRefunds.includes(m));
  const firstOpen = remaining.findIndex((r) => r > 0);
  const returnAll = () =>
    setPicked(Object.fromEntries(remaining.map((r, i) => [i, Math.max(0, r)])));
  const verb = SAVE_LABEL[refundMethod] ?? 'Refund';

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title="Return goods"
      subtitle={`${sale.customerName} · ${sale.invoiceNo}`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">Refund total</span>
            <span className="text-xl font-bold tabular">{formatBDT(total)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {/* The button says what happens to the money. */}
            <Button
              size="lg"
              onClick={() => void submit()}
              disabled={lines.length === 0 || !reason || saving}
              title={!reason ? 'Choose a reason' : undefined}
            >
              <Undo2 className="size-5" /> <span>{verb}</span>{' '}
              <span className="tabular">{formatBDT(total)}</span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        {/* Lines picker */}
        <div className="rounded-lg border border-border overflow-hidden">
          {!nothingLeft && (
            <div className="px-3 py-2 border-b border-border bg-secondary/40 flex justify-end">
              <Button variant="outline" onClick={returnAll}>
                Return everything
              </Button>
            </div>
          )}
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
                    <td className="px-2 py-2 text-right tabular whitespace-nowrap">
                      {l.qty} {l.unit}
                    </td>
                    <td className="px-2 py-2 text-right tabular">
                      {left > 0 ? (
                        // One click fills the line with all that is left.
                        <button
                          type="button"
                          title="Return all of this line"
                          onClick={() => setPicked((p) => ({ ...p, [idx]: left }))}
                          className="px-2 py-1 rounded text-primary hover:bg-primary/10 tabular"
                        >
                          {left}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">{left}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <NumberField
                        aria-label="Return qty"
                        value={cur}
                        disabled={left <= 0}
                        autoFocus={idx === firstOpen}
                        onChangeNumber={(v) => {
                          const clamped = Math.max(0, Math.min(left, v));
                          setPicked((p) => ({ ...p, [idx]: clamped }));
                        }}
                        placeholder="0"
                        className="h-10 w-24 px-2 text-right text-sm"
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

        {/* Reason: no default, so an untouched form cannot record a wrong one. */}
        <FormField label="Reason" required>
          <Segmented
            ariaLabel="Reason"
            value={reason ?? ''}
            onChange={(v) => setReason(v as SellReturn['reason'])}
            options={REASONS.map((r) => ({ value: r.id as string, label: r.label }))}
          />
        </FormField>

        {/* Refund method: what each one means is on the tile, not in a tooltip. */}
        <FormField label="How does the money go back?" required>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {mainRefunds.map((m) => (
                <RefundTile key={m.id} m={m} on={refundMethod === m.id} onPick={setRefundMethod} />
              ))}
            </div>
            {otherRefunds.length > 0 &&
              (showOther ? (
                <div className="grid grid-cols-4 gap-2">
                  {otherRefunds.map((m) => (
                    <RefundTile key={m.id} m={m} on={refundMethod === m.id} onPick={setRefundMethod} />
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowOther(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Other method
                </button>
              ))}
          </div>
        </FormField>

        <FormField label="Notes">
          {(f) => (
            <textarea
              {...f}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Internal notes…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
            />
          )}
        </FormField>
      </div>
    </Modal>
  );
}

function RefundTile({
  m,
  on,
  onPick,
}: {
  m: (typeof REFUND)[number];
  on: boolean;
  onPick: (id: SellReturn['refundMethod']) => void;
}) {
  const Icon = m.icon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => onPick(m.id)}
      className={cn(
        'min-h-11 px-3 py-2 rounded-md border text-left transition',
        on ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary',
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className="size-4 shrink-0" /> {m.label}
      </span>
      <span className="block text-xs text-muted-foreground mt-0.5">{m.hint}</span>
    </button>
  );
}
