import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Printer,
  Banknote,
  Edit2,
  Ban,
  Undo2,
  Truck,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  History,
} from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SettlementBadge } from '@/components/ui/SettlementBadge';
import { useSales, type SaleRecord } from '@/stores/sales';
import { useCustomers } from '@/stores/contacts';
import { confirm } from '@/stores/confirm';
import { promptText } from '@/stores/prompt';
import { useCan } from '@/hooks/useCan';
import { api } from '@/lib/api';
import { toSaleRecord, type BackendSale } from '@/hooks/saleAdapter';
import { toCustomer, type BackendCustomer } from '@/hooks/contactAdapter';
import type { Customer } from '@/types/domain';
import { cn, formatBDT } from '@/lib/utils';
import { PhoneAction, isCallable } from '@/components/ui/PhoneAction';
import { AddPaymentModal } from './AddPaymentModal';
import { InvoicePrintModal } from './InvoicePrintModal';

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
  const customers = useCustomers((s) => s.items);
  const [payOpen, setPayOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  // UI-only gating; the IPC boundary is the real gate (see hooks/useCan.ts).
  const canEdit = useCan('sales.edit');
  const canVoid = useCan('sales.void');

  // The store now holds ONE PAGE of sales, so the requested row may simply not
  // be loaded (opened from a search result, a deep link, or another page of the
  // list). Prefer the store row when it IS there — writes like Add Payment or
  // Void rehydrate the store, so the drawer reflects them instantly — and fall
  // back to a single-record read otherwise.
  const storeSale = sales.find((s) => s.id === saleId) ?? null;
  const hasStoreSale = !!storeSale;
  const [fetched, setFetched] = useState<SaleRecord | null>(null);
  const [fetching, setFetching] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!open || !saleId || hasStoreSale) {
      setFetched(null);
      setFetching(false);
      setNotFound(false);
      return;
    }
    let alive = true;
    setFetching(true);
    setNotFound(false);
    void api<BackendSale | null>('sales.get', { id: saleId })
      .then((row) => {
        if (!alive) return;
        if (row) setFetched(toSaleRecord(row));
        else setNotFound(true);
        setFetching(false);
      })
      .catch(() => {
        if (!alive) return;
        // Channel error or running outside Electron — treat as unavailable.
        setNotFound(true);
        setFetching(false);
      });
    return () => {
      alive = false;
    };
  }, [open, saleId, hasStoreSale]);

  const sale = storeSale ?? fetched;

  /**
   * THE CUSTOMER'S PHONE NUMBER, RELIABLY.
   *
   * The contacts store holds ONE PAGE of customers, so `customers.find(...)`
   * missed anyone past the first page — and when it missed, the whole customer
   * block (with the phone number) simply did not render. For a due or partial
   * invoice that number is the point of opening this screen: the employee needs
   * to ring them. So when the store does not have the row, it is read directly.
   */
  const storeCustomer = customers.find((c) => c.id === sale?.customerId);
  const [fetchedCustomer, setFetchedCustomer] = useState<Customer | null>(null);
  const customerId = sale?.customerId ?? '';
  const hasStoreCustomer = !!storeCustomer;

  useEffect(() => {
    if (!open || !customerId || hasStoreCustomer) {
      setFetchedCustomer(null);
      return;
    }
    let alive = true;
    void api<BackendCustomer | null>('customers.get', { id: customerId })
      .then((row) => {
        if (alive && row) setFetchedCustomer(toCustomer(row));
      })
      .catch(() => {
        // No channel / outside Electron — the block below falls back to the name
        // stored on the sale rather than showing an invented number.
      });
    return () => {
      alive = false;
    };
  }, [open, customerId, hasStoreCustomer]);

  if (!sale) {
    return (
      <Drawer open={open} onClose={onClose} title="Sale" width="max-w-3xl">
        <div className="p-8 text-center text-sm text-muted-foreground">
          {fetching ? 'Loading sale…' : notFound ? 'Sale not found.' : null}
        </div>
      </Drawer>
    );
  }

  const customer = storeCustomer ?? (fetchedCustomer?.id === sale.customerId ? fetchedCustomer : undefined);
  // `sales.get` returns the header without the joined customer name, so prefer
  // the contacts store when this row came from the fallback fetch.
  const customerLabel = customer?.name ?? sale.customerName;
  // A real number only — '-' is what the quick-add form stores when the walk-in
  // gave none, and offering to dial it would be a lie. See ui/PhoneAction.tsx.
  const callablePhone = isCallable(customer?.phone) ? customer.phone : null;

  const StatusPill = () => {
    if (sale.status === 'void') return <Badge variant="destructive">Voided</Badge>;
    if (sale.status === 'draft') return <Badge variant="info">Draft</Badge>;
    return (
      <SettlementBadge
        paid={sale.paid}
        due={sale.due}
        credited={sale.credited}
        status={sale.status}
      />
    );
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width="max-w-3xl"
        title={sale.invoiceNo}
        subtitle={`${customerLabel} · ${new Date(sale.date).toLocaleString('en-GB')}`}
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
              {/* An "Open full page" link used to sit here pointing at
                  /sales/:id. That route does not exist — App.tsx only routes
                  /sales/:id/edit — so it landed the user on "Not Found". This
                  drawer IS the full sale view; the link is gone rather than
                  left as a trap. */}
            </div>

            {/* CUSTOMER — including the phone number, big enough to dial from.
                On a due or partial invoice this is the reason the employee opened
                the screen, so the number is shown as a proper contact line with a
                Call button rather than buried in 11px grey text. */}
            {(customer || sale.customerName) && (
              <div className="rounded-lg border border-border p-3 bg-card flex flex-wrap items-center gap-3">
                <div className="size-10 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-white font-bold text-xs shrink-0">
                  {(customer?.name ?? sale.customerName)
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{customer?.name ?? sale.customerName}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {callablePhone ? (
                      <span className="text-sm font-mono tabular font-semibold">
                        {callablePhone}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No phone on file</span>
                    )}
                    {customer?.group && (
                      <Badge variant="default">{customer.group}</Badge>
                    )}
                  </div>
                </div>
                {callablePhone && (
                  <PhoneAction phone={callablePhone} label={customer?.name} />
                )}
                {customer && customer.due > 0 && (
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
          {/* Both of these had NO onClick — they looked live and did nothing.
              One button now, doing the one thing there is to do: show the stored
              invoice, ready to print or save as PDF. */}
          <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
            <Printer className="size-3.5" /> Print invoice
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
          {/* Editing an invoice rewrites money that has already been taken, so
              the button only appears for a user who holds `sales.edit` (Admin by
              default). A voided sale is settled and can never be edited. */}
          {canEdit && sale.status !== 'void' && (
            <Link to={`/sales/${sale.id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit2 className="size-3.5" /> Edit
              </Button>
            </Link>
          )}
          <div className="flex-1" />
          {canVoid && (sale.status === 'draft' || sale.status === 'quotation') && (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (
                  await confirm({
                    title: `Delete ${sale.status} ${sale.invoiceNo}?`,
                    variant: 'destructive',
                  })
                ) {
                  deleteSale(sale.id);
                  onClose();
                }
              }}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          )}
          {canVoid && sale.status === 'final' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                const reason = await promptText({
                  title: `Void ${sale.invoiceNo}?`,
                  message: 'Voiding returns the items to stock and reverses any cash taken.',
                  label: 'Reason',
                  placeholder: 'e.g. customer cancelled',
                  confirmLabel: 'Void sale',
                  cancelLabel: 'Keep it',
                  variant: 'destructive',
                  required: true,
                });
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

      <InvoicePrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        sale={sale}
        customer={customer}
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
