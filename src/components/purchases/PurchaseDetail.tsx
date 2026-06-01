import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Printer,
  Banknote,
  Edit2,
  Ban,
  Undo2,
  ExternalLink,
  Receipt as ReceiptIcon,
  Trash2,
  History,
} from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePurchases } from '@/stores/purchases';
import { cn, formatBDT } from '@/lib/utils';
import { AddPurchasePaymentModal } from './AddPurchasePaymentModal';
import { CreatePurchaseReturnModal } from './CreatePurchaseReturnModal';

interface Props {
  open: boolean;
  onClose: () => void;
  purchaseId: string | null;
}

export function PurchaseDetail({ open, onClose, purchaseId }: Props) {
  const purchases = usePurchases((s) => s.purchases);
  const cancelPurchase = usePurchases((s) => s.cancelPurchase);
  const deletePurchase = usePurchases((s) => s.deletePurchase);
  const purchase = purchases.find((p) => p.id === purchaseId) ?? null;
  const [payOpen, setPayOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  if (!purchase) {
    return <Drawer open={open} onClose={onClose} title="Purchase" width="max-w-3xl">{null}</Drawer>;
  }

  const StatusPill = () => {
    if (purchase.status === 'cancelled') return <Badge variant="destructive">Cancelled</Badge>;
    if (purchase.status === 'ordered') return <Badge variant="info">Ordered</Badge>;
    if (purchase.status === 'in-transit') return <Badge variant="info">In Transit</Badge>;
    return <Badge variant="success">Received</Badge>;
  };
  const PaymentPill = () => {
    if (purchase.due === 0) return <Badge variant="success">Paid</Badge>;
    if (purchase.paid > 0) return <Badge variant="warning">Partial</Badge>;
    return <Badge variant="destructive">Due</Badge>;
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width="max-w-3xl"
        title={purchase.refNo}
        subtitle={`${purchase.supplierName} · ${new Date(purchase.date).toLocaleString('en-GB')}`}
      >
        <div className="flex-1 overflow-auto">
          <div className="p-5 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill />
              <PaymentPill />
              <Badge variant="default">{purchase.branch}</Badge>
              <Badge variant="default">By {purchase.user}</Badge>
              {purchase.payTerms && <Badge variant="info">{purchase.payTerms}</Badge>}
              {purchase.returnIds && purchase.returnIds.length > 0 && (
                <Badge variant="warning">{purchase.returnIds.length} return(s)</Badge>
              )}
              <div className="flex-1" />
              <Link
                to={`/purchases/${purchase.id}`}
                className="text-[11px] inline-flex items-center gap-1 text-primary hover:underline"
              >
                Open full page <ExternalLink className="size-3" />
              </Link>
            </div>

            {/* Supplier info */}
            <div className="rounded-lg border border-border p-3 bg-card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{purchase.supplierName}</div>
                {purchase.supplierAddress && (
                  <div className="text-[11px] text-muted-foreground">{purchase.supplierAddress}</div>
                )}
              </div>
            </div>

            {/* Lines */}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase text-muted-foreground bg-secondary/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-10">#</th>
                    <th className="text-left px-2 py-2 font-medium">Item</th>
                    <th className="text-right px-2 py-2 font-medium">Qty</th>
                    <th className="text-right px-2 py-2 font-medium">Cost</th>
                    <th className="text-right px-3 py-2 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.lines.map((l, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-2">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{l.sku}</div>
                        {l.imei && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            S/N: {l.imei}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular">
                        {l.qty} {l.unit}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular">
                        {formatBDT(l.unitCostBeforeTax, { withSymbol: false })}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular font-semibold">
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
                {purchase.tax > 0 && (
                  <Row label={`Purchase tax (${purchase.taxPct}%)`} value={formatBDT(purchase.tax)} />
                )}
                {purchase.shipping > 0 && <Row label="Shipping" value={formatBDT(purchase.shipping)} />}
                {purchase.other > 0 && <Row label="Other" value={formatBDT(purchase.other)} />}
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-lg font-bold font-mono tabular">{formatBDT(purchase.total)}</span>
                </div>
              </div>
              <div className="rounded-lg border border-border p-4 space-y-1.5 text-sm bg-card">
                <Row label="Paid" value={formatBDT(purchase.paid)} tone={purchase.due === 0 ? 'success' : undefined} />
                <Row label="Due" value={formatBDT(purchase.due)} tone={purchase.due > 0 ? 'destructive' : undefined} />
                <div className="border-t border-border pt-2">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">
                    Payments
                  </div>
                  {purchase.payments.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground">No payments yet</div>
                  ) : (
                    purchase.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span>
                          {p.method}
                          {p.reference ? <span className="text-muted-foreground"> · {p.reference}</span> : null}
                        </span>
                        <span className="font-mono tabular">{formatBDT(p.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {purchase.notes && (
              <div className="rounded-lg border border-border p-3 bg-card text-sm">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Notes</div>
                <div className="whitespace-pre-wrap">{purchase.notes}</div>
              </div>
            )}

            {/* Audit log */}
            <div className="rounded-lg border border-border bg-card">
              <div className="px-3 py-2 border-b border-border bg-secondary/40 flex items-center gap-2 text-[11px] uppercase font-semibold text-muted-foreground">
                <History className="size-3" /> Audit log
              </div>
              <div className="divide-y divide-border">
                {purchase.audit.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
                    <span
                      className={cn(
                        'size-1.5 rounded-full inline-block',
                        a.action === 'created' && 'bg-primary',
                        a.action === 'paid' && 'bg-success',
                        a.action === 'cancelled' && 'bg-destructive',
                        a.action === 'returned' && 'bg-warning',
                        a.action === 'edited' && 'bg-muted-foreground',
                      )}
                    />
                    <span className="capitalize">{a.action}</span>
                    {a.note && <span className="text-muted-foreground">— {a.note}</span>}
                    <span className="ml-auto text-[10px] text-muted-foreground tabular">
                      {new Date(a.at).toLocaleString('en-GB')} · {a.by}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-border bg-card px-4 py-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm">
            <Printer className="size-3.5" /> Print
          </Button>
          <Button variant="outline" size="sm">
            <ReceiptIcon className="size-3.5" /> Re-print
          </Button>
          {purchase.status !== 'cancelled' && purchase.due > 0 && (
            <Button size="sm" onClick={() => setPayOpen(true)}>
              <Banknote className="size-3.5" /> Add Payment
            </Button>
          )}
          {purchase.status === 'received' && (
            <Button variant="outline" size="sm" onClick={() => setReturnOpen(true)}>
              <Undo2 className="size-3.5" /> Create Return
            </Button>
          )}
          <Link to={`/purchases/${purchase.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit2 className="size-3.5" /> Edit
            </Button>
          </Link>
          <div className="flex-1" />
          {(purchase.status === 'ordered' || purchase.status === 'cancelled') && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm(`Delete ${purchase.refNo}?`)) {
                  deletePurchase(purchase.id);
                  onClose();
                }
              }}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          )}
          {purchase.status !== 'cancelled' && purchase.status !== 'ordered' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                const reason = prompt('Reason for cancelling?');
                if (reason !== null) cancelPurchase(purchase.id, 'Seam', reason);
              }}
            >
              <Ban className="size-3.5" /> Cancel
            </Button>
          )}
        </div>
      </Drawer>

      <AddPurchasePaymentModal open={payOpen} onClose={() => setPayOpen(false)} purchase={purchase} />
      <CreatePurchaseReturnModal open={returnOpen} onClose={() => setReturnOpen(false)} purchaseId={purchase.id} />
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
          'font-mono tabular',
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
