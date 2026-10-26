import { useEffect, useState } from 'react';
import {
  Printer,
  Banknote,
  Ban,
  Undo2,
  Trash2,
  History,
  Pencil,
  PackageCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SettlementBadge } from '@/components/ui/SettlementBadge';
import { usePurchases } from '@/stores/purchases';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { promptText } from '@/stores/prompt';
import { useCan } from '@/hooks/useCan';
import { api } from '@/lib/api';
import { toSupplier, type BackendSupplier } from '@/hooks/contactAdapter';
import type { Supplier } from '@/types/domain';
import { cn, formatBDT, formatNumber } from '@/lib/utils';
import { labelFor } from '@/lib/labels';
import { useDateFormat } from '@/lib/formatDate';
import { useIsMultiBranch } from '@/components/stock/hooks';
import { PURCHASE_STATUS_LABEL, PURCHASE_STATUS_VARIANT, payTermLabel } from './labels';
import { PayBillModal } from './PayBillModal';
import { currentUserName } from '@/lib/actor';
import { PhoneAction, isCallable } from '@/components/ui/PhoneAction';
import { AddPurchasePaymentModal } from './AddPurchasePaymentModal';
import { CreatePurchaseReturnModal } from './CreatePurchaseReturnModal';
import { PurchasePrintModal } from './PurchasePrintModal';

const AUDIT_LABEL: Record<string, string> = {
  created: 'Created',
  edited: 'Corrected',
  cancelled: 'Cancelled',
  paid: 'Payment added',
  returned: 'Goods returned',
};

interface Props {
  open: boolean;
  onClose: () => void;
  purchaseId: string | null;
}

export function PurchaseDetail({ open, onClose, purchaseId }: Props) {
  const purchases = usePurchases((s) => s.purchases);
  const cancelPurchase = usePurchases((s) => s.cancelPurchase);
  const deletePurchase = usePurchases((s) => s.deletePurchase);
  const receivePurchase = usePurchases((s) => s.receivePurchase);
  // UI-only gating; the IPC boundary is the real gate (see hooks/useCan.ts).
  const canEdit = useCan('purchases.edit');
  const purchase = purchases.find((p) => p.id === purchaseId) ?? null;
  const [payOpen, setPayOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [paySupplierOpen, setPaySupplierOpen] = useState(false);
  const fmt = useDateFormat();
  const multiBranch = useIsMultiBranch();

  /**
   * SUPPLIER PHONE NUMBER.
   *
   * The purchase row itself only carries the supplier's name and address, and
   * `suppliers` in the contacts store is ONE PAGE, so the number was simply not
   * on screen. When you are querying a delivery you need to ring them, so the
   * supplier is read directly by id when the store does not have them.
   */
  const supplierId = purchase?.supplierId ?? '';
  const [supplier, setSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    if (!open || !supplierId) {
      setSupplier(null);
      return;
    }
    let alive = true;
    void api<BackendSupplier | null>('suppliers.get', { id: supplierId })
      .then((row) => {
        if (alive && row) setSupplier(toSupplier(row));
      })
      .catch(() => {
        // No backend / unknown id: the block below shows what the purchase row
        // holds rather than inventing a number.
      });
    return () => {
      alive = false;
    };
  }, [open, supplierId]);

  if (!purchase) {
    return (
      <Drawer open={open} onClose={onClose} title="Purchase" width="max-w-3xl">
        <div className="p-8 text-center text-sm text-muted-foreground">
          This purchase is not on the page that is loaded. Open it from the Purchases list.
        </div>
      </Drawer>
    );
  }

  const supplierPhone = isCallable(supplier?.phone) ? supplier.phone : null;
  const returns = purchase.returnIds?.length ?? 0;
  const isOpen = purchase.status === 'ordered' || purchase.status === 'in-transit';

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width="max-w-3xl"
        title={purchase.supplierName || 'Purchase'}
        subtitle={`${purchase.refNo} · ${fmt.dateTime(purchase.date)}`}
      >
        <div className="flex-1 overflow-auto">
          <div className="p-5 space-y-5">
            {/* Two badges; the rest is one plain line. */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={PURCHASE_STATUS_VARIANT[purchase.status]}>
                  {PURCHASE_STATUS_LABEL[purchase.status]}
                </Badge>
                {purchase.status !== 'cancelled' && (
                  <SettlementBadge paid={purchase.paid} due={purchase.due} credited={purchase.credited} />
                )}
                {returns > 0 && (
                  <Badge variant="warning">
                    <span>Returns</span> <span className="tabular">{returns}</span>
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground flex flex-wrap gap-x-1.5">
                {multiBranch && (
                  <>
                    <span>{purchase.branch}</span>
                    <span aria-hidden>·</span>
                  </>
                )}
                <span>Entered by</span> <span>{purchase.user}</span>
                {purchase.payTerms && (
                  <>
                    <span aria-hidden>·</span>
                    <span>Pay term</span> <span>{payTermLabel(purchase.payTerms)}</span>
                  </>
                )}
              </div>
            </div>

            {/* SUPPLIER — with a phone number you can ring. */}
            <div className="rounded-lg border border-border p-3 bg-card flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                {purchase.supplierAddress && (
                  <div className="text-sm text-muted-foreground">{purchase.supplierAddress}</div>
                )}
                <div className="mt-0.5">
                  {supplierPhone ? (
                    <span className="text-sm tabular font-semibold">{supplierPhone}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">No phone on file</span>
                  )}
                </div>
                {supplier && supplier.due > 0 && (
                  <div className="text-sm mt-1">
                    <span className="text-muted-foreground">Owed on all bills:</span>{' '}
                    <span className="tabular font-medium">{formatBDT(supplier.due)}</span>{' '}
                    <button
                      type="button"
                      onClick={() => setPaySupplierOpen(true)}
                      className="text-primary hover:underline focus-ring rounded ml-1"
                    >
                      Pay supplier
                    </button>
                  </div>
                )}
              </div>
              {supplierPhone && <PhoneAction phone={supplierPhone} label={purchase.supplierName} />}
            </div>

            {/* Lines */}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-secondary/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Item</th>
                    <th className="text-right px-2 py-2 font-medium">Qty</th>
                    <th className="text-right px-2 py-2 font-medium">Cost</th>
                    <th className="text-right px-3 py-2 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.lines.map((l, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{l.sku}</div>
                        {l.imei && (
                          <div className="text-xs text-muted-foreground">
                            <span>Serial</span>: <span className="font-mono">{l.imei}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular whitespace-nowrap">
                        {formatNumber(l.qty)} {l.unit}
                      </td>
                      <td className="px-2 py-2 text-right tabular">
                        {formatBDT(l.unitCostBeforeTax, { withSymbol: false })}
                      </td>
                      <td className="px-3 py-2 text-right tabular font-semibold">
                        {formatBDT(l.lineTotal, { withSymbol: false })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-4 space-y-1.5 text-sm bg-card">
                <Row label="Subtotal" value={formatBDT(purchase.subtotal)} />
                {purchase.totalLineDiscount > 0 && (
                  <Row label="Line discounts" value={`− ${formatBDT(purchase.totalLineDiscount)}`} tone="success" />
                )}
                {purchase.orderDiscount > 0 && (
                  <Row label="Order discount" value={`− ${formatBDT(purchase.orderDiscount)}`} tone="success" />
                )}
                {purchase.tax > 0 && <Row label="Purchase tax" value={formatBDT(purchase.tax)} />}
                {purchase.shipping > 0 && <Row label="Shipping" value={formatBDT(purchase.shipping)} />}
                {purchase.other > 0 && <Row label="Other" value={formatBDT(purchase.other)} />}
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-lg font-bold tabular">{formatBDT(purchase.total)}</span>
                </div>
              </div>
              <div className="rounded-lg border border-border p-4 space-y-1.5 text-sm bg-card">
                <Row label="Paid" value={formatBDT(purchase.paid)} tone={purchase.due === 0 ? 'success' : undefined} />
                <Row label="Due" value={formatBDT(purchase.due)} tone={purchase.due > 0 ? 'destructive' : undefined} />
                <div className="border-t border-border pt-2">
                  <div className="text-sm font-medium mb-1">Payments</div>
                  {purchase.payments.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No payments yet</div>
                  ) : (
                    purchase.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-sm py-0.5">
                        <span className="min-w-0">
                          <span className="text-muted-foreground">{fmt.date(p.paidAt)}</span> ·{' '}
                          <span>{labelFor('paymentMethod', p.method)}</span>
                          {p.reference ? <span className="text-muted-foreground"> · {p.reference}</span> : null}
                        </span>
                        <span className="tabular">{formatBDT(p.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {purchase.notes && (
              <div className="rounded-lg border border-border p-3 bg-card text-sm">
                <div className="text-sm font-medium mb-1">Notes</div>
                <div className="whitespace-pre-wrap">{purchase.notes}</div>
              </div>
            )}

            {/* History, folded away. */}
            {purchase.audit.length > 0 && (
              <details className="rounded-lg border border-border bg-card group">
                <summary className="px-3 py-2.5 cursor-pointer flex items-center gap-2 text-sm font-medium select-none">
                  <History className="size-4 text-muted-foreground" />
                  <span>History</span>{' '}
                  <span className="tabular text-muted-foreground">({purchase.audit.length})</span>
                </summary>
                <div className="divide-y divide-border border-t border-border">
                  {purchase.audit.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span
                        className={cn(
                          'size-2 rounded-full inline-block',
                          a.action === 'created' && 'bg-primary',
                          a.action === 'paid' && 'bg-success',
                          a.action === 'cancelled' && 'bg-destructive',
                          a.action === 'returned' && 'bg-warning',
                          a.action === 'edited' && 'bg-muted-foreground',
                        )}
                      />
                      <span>{AUDIT_LABEL[a.action] ?? a.action}</span>
                      {a.note && <span className="text-muted-foreground">— {a.note}</span>}
                      <span className="ml-auto text-muted-foreground tabular">
                        {fmt.dateTime(a.at)} · {a.by}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>

        {/* Footer: destructive far left behind a divider, everyday actions, Pay on the right. */}
        <div className="border-t border-border bg-card px-4 py-3 flex flex-wrap items-center gap-2">
          {canEdit && (purchase.status === 'ordered' || purchase.status === 'cancelled') && (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={async () => {
                if (
                  (await confirm({
                    title: 'Delete this purchase?',
                    message: purchase.refNo,
                    confirmLabel: 'Delete',
                    variant: 'destructive',
                  })) &&
                  (await deletePurchase(purchase.id))
                ) {
                  toast.success('Purchase deleted');
                  onClose();
                }
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
          {canEdit && purchase.status !== 'cancelled' && purchase.status !== 'ordered' && (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={async () => {
                const reason = await promptText({
                  title: 'Cancel this purchase?',
                  message: 'Cancelling reverses the stock it brought in and the cash it paid out.',
                  label: 'Reason',
                  placeholder: 'e.g. wrong supplier',
                  confirmLabel: 'Cancel purchase',
                  cancelLabel: 'Keep it',
                  variant: 'destructive',
                  required: true,
                });
                if (reason !== null && (await cancelPurchase(purchase.id, currentUserName(), reason))) {
                  toast.success('Purchase cancelled');
                }
              }}
            >
              <Ban className="size-4" /> Cancel purchase
            </Button>
          )}
          {canEdit && purchase.status !== 'cancelled' && <div className="w-px h-8 bg-border mx-1" aria-hidden />}
          <Button variant="outline" onClick={() => setPrintOpen(true)}>
            <Printer className="size-4" /> Print
          </Button>
          {canEdit && purchase.status !== 'cancelled' && (
            <Link to={`/purchases/${purchase.id}/edit`} onClick={onClose}>
              <Button variant="outline">
                <Pencil className="size-4" /> Edit
              </Button>
            </Link>
          )}
          {purchase.status === 'received' && (
            <Button variant="outline" onClick={() => setReturnOpen(true)}>
              <Undo2 className="size-4" /> Create return
            </Button>
          )}
          {/* An ordered bill's goods arriving: they go into stock, as entered. */}
          {isOpen && (
            <Button
              variant="outline"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Mark this purchase as received?',
                  message: 'Its items go into stock now, as entered on the bill.',
                  confirmLabel: 'Goods received',
                });
                if (ok) await receivePurchase(purchase.id);
              }}
            >
              <PackageCheck className="size-4" /> Mark received
            </Button>
          )}
          <div className="flex-1" />
          {purchase.status !== 'cancelled' && purchase.due > 0 && (
            <Button onClick={() => setPayOpen(true)}>
              <Banknote className="size-4" /> <span>Pay</span>{' '}
              <span className="tabular">{formatBDT(purchase.due)}</span>
            </Button>
          )}
        </div>
      </Drawer>

      <AddPurchasePaymentModal open={payOpen} onClose={() => setPayOpen(false)} purchase={purchase} />
      <PayBillModal
        open={paySupplierOpen}
        onClose={() => setPaySupplierOpen(false)}
        initialSupplierId={purchase.supplierId}
      />
      <CreatePurchaseReturnModal open={returnOpen} onClose={() => setReturnOpen(false)} purchaseId={purchase.id} />
      <PurchasePrintModal open={printOpen} onClose={() => setPrintOpen(false)} purchase={purchase} />
    </>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'destructive' | 'warning';
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'tabular',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </span>
    </div>
  );
}
