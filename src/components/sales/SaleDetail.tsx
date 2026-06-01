import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Printer,
  Banknote,
  Edit2,
  Ban,
  Undo2,
  Truck,
  ExternalLink,
  Receipt as ReceiptIcon,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  History,
} from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useSales, type SaleRecord } from '@/stores/sales';
import { customers } from '@/mocks/data';
import { cn, formatBDT } from '@/lib/utils';
import { AddPaymentModal } from './AddPaymentModal';

interface Props {
  open: boolean;
  onClose: () => void;
  saleId: string | null;
  onCreateReturn?: (saleId: string) => void;
  onCreateShipment?: (saleId: string) => void;
}

export function SaleDetail({ open, onClose, saleId, onCreateReturn, onCreateShipment }: Props) {
  const sales = useSales((s) => s.sales);
  const voidSale = useSales((s) => s.voidSale);
  const deleteSale = useSales((s) => s.deleteSale);
  const sale = sales.find((s) => s.id === saleId) ?? null;
  const [payOpen, setPayOpen] = useState(false);

  if (!sale) {
    return <Drawer open={open} onClose={onClose} title="Sale" width="max-w-3xl">{null}</Drawer>;
  }

  const customer = customers.find((c) => c.id === sale.customerId);

  const StatusPill = () => {
    if (sale.status === 'void') return <Badge variant="destructive">Voided</Badge>;
    if (sale.status === 'draft') return <Badge variant="info">Draft</Badge>;
    if (sale.status === 'quotation') return <Badge variant="warning">Quotation</Badge>;
    if (sale.due === 0) return <Badge variant="success">Paid</Badge>;
    if (sale.paid > 0) return <Badge variant="warning">Partial</Badge>;
    return <Badge variant="destructive">Due</Badge>;
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width="max-w-3xl"
        title={sale.invoiceNo}
        subtitle={`${sale.customerName} · ${new Date(sale.date).toLocaleString('en-GB')}`}
      >
        <div className="flex-1 overflow-auto">
          <div className="p-5 space-y-5">
            {/* Header band */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill />
              <Badge variant="default">{sale.branch}</Badge>
              <Badge variant="default">By {sale.user}</Badge>
              {sale.status === 'quotation' && sale.validUntil && (
                <Badge variant="info">Valid till {new Date(sale.validUntil).toLocaleDateString('en-GB')}</Badge>
              )}
              {sale.returnIds && sale.returnIds.length > 0 && (
                <Badge variant="warning">{sale.returnIds.length} return(s)</Badge>
              )}
              <div className="flex-1" />
              <Link
                to={`/sales/${sale.id}`}
                className="text-[11px] inline-flex items-center gap-1 text-primary hover:underline"
              >
                Open full page <ExternalLink className="size-3" />
              </Link>
            </div>

            {/* Customer */}
            {customer && (
              <div className="rounded-lg border border-border p-3 bg-card flex items-center gap-3">
                <div className="size-10 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-white font-bold text-xs">
                  {customer.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{customer.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {customer.phone} · {customer.group}
                  </div>
                </div>
                {customer.due > 0 && (
                  <Badge variant="destructive">Total Due {formatBDT(customer.due)}</Badge>
                )}
              </div>
            )}

            {/* Lines */}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase text-muted-foreground bg-secondary/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-10">#</th>
                    <th className="text-left px-2 py-2 font-medium">Item</th>
                    <th className="text-right px-2 py-2 font-medium">Qty</th>
                    <th className="text-right px-2 py-2 font-medium">Unit Price</th>
                    <th className="text-right px-3 py-2 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.lines.map((l, i) => {
                    const sub = l.unitPrice * l.qty - l.discountFlat - l.unitPrice * l.qty * (l.discountPct / 100);
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-2">
                          <div className="font-medium">{l.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{l.sku}</div>
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular">
                          {l.qty} {l.unit}
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular">
                          {formatBDT(l.unitPrice, { withSymbol: false })}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular font-semibold">
                          {formatBDT(sub, { withSymbol: false })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-4 space-y-1.5 text-sm bg-card">
                <Row label="Subtotal" value={formatBDT(sale.subtotal)} />
                {sale.totalLineDiscount > 0 && (
                  <Row label="Line Discounts" value={`− ${formatBDT(sale.totalLineDiscount)}`} tone="success" />
                )}
                {sale.orderDiscount > 0 && (
                  <Row label="Order Discount" value={`− ${formatBDT(sale.orderDiscount)}`} tone="success" />
                )}
                {sale.tax > 0 && <Row label={`VAT (${sale.taxPct}%)`} value={formatBDT(sale.tax)} />}
                {sale.shipping > 0 && <Row label="Shipping" value={formatBDT(sale.shipping)} />}
                {sale.other > 0 && <Row label="Other" value={formatBDT(sale.other)} />}
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-lg font-bold font-mono tabular">{formatBDT(sale.total)}</span>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-1.5 text-sm bg-card">
                <Row label="Paid" value={formatBDT(sale.paid)} tone={sale.due === 0 ? 'success' : undefined} />
                <Row
                  label="Due"
                  value={formatBDT(sale.due)}
                  tone={sale.due > 0 ? 'destructive' : undefined}
                />
                {sale.profit !== undefined && (
                  <Row label="Profit" value={formatBDT(sale.profit)} tone="success" />
                )}
                <div className="border-t border-border pt-2">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">
                    Payments
                  </div>
                  {sale.payments.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground">No payments yet</div>
                  ) : (
                    sale.payments.map((p) => (
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

            {/* Audit log */}
            <div className="rounded-lg border border-border bg-card">
              <div className="px-3 py-2 border-b border-border bg-secondary/40 flex items-center gap-2 text-[11px] uppercase font-semibold text-muted-foreground">
                <History className="size-3" /> Audit log
              </div>
              <div className="divide-y divide-border">
                {sale.audit.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
                    <Dot action={a.action} />
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
          {sale.status === 'final' && sale.due > 0 && (
            <Button size="sm" onClick={() => setPayOpen(true)}>
              <Banknote className="size-3.5" /> Add Payment
            </Button>
          )}
          {sale.status === 'final' && (
            <Button variant="outline" size="sm" onClick={() => onCreateReturn?.(sale.id)}>
              <Undo2 className="size-3.5" /> Create Return
            </Button>
          )}
          {sale.status === 'final' && !sale.shipmentId && (
            <Button variant="outline" size="sm" onClick={() => onCreateShipment?.(sale.id)}>
              <Truck className="size-3.5" /> Create Shipment
            </Button>
          )}
          <Link to={`/sales/${sale.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit2 className="size-3.5" /> Edit
            </Button>
          </Link>
          <div className="flex-1" />
          {(sale.status === 'draft' || sale.status === 'quotation') && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm(`Delete ${sale.status} ${sale.invoiceNo}?`)) {
                  deleteSale(sale.id);
                  onClose();
                }
              }}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          )}
          {sale.status === 'final' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                const reason = prompt('Reason for voiding?');
                if (reason !== null) {
                  voidSale(sale.id, 'Seam', reason);
                }
              }}
            >
              <Ban className="size-3.5" /> Void
            </Button>
          )}
        </div>
      </Drawer>

      <AddPaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        sale={sale}
      />
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

function Dot({ action }: { action: string }) {
  const cls =
    action === 'created'
      ? 'bg-primary'
      : action === 'paid'
        ? 'bg-success'
        : action === 'voided'
          ? 'bg-destructive'
          : action === 'returned'
            ? 'bg-warning'
            : action === 'shipped'
              ? 'bg-accent'
              : 'bg-muted-foreground';
  return <span className={`size-1.5 rounded-full ${cls}`} />;
}

// silence unused
void CheckCircle2;
void AlertTriangle;
