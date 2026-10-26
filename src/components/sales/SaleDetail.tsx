import { useEffect, useMemo, useState } from 'react';
import { saleLineSubtotal } from '@/lib/money';
import { Link } from 'react-router-dom';
import {
  Printer,
  Banknote,
  Edit2,
  Ban,
  Undo2,
  Truck,
  Trash2,
  History,
  ChevronDown,
} from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SettlementBadge } from '@/components/ui/SettlementBadge';
import { useSales, type SaleRecord } from '@/stores/sales';
import { useCustomers } from '@/stores/contacts';
import { confirm } from '@/stores/confirm';
import { promptText } from '@/stores/prompt';
import { toast } from '@/stores/toast';
import { useCan } from '@/hooks/useCan';
import { api } from '@/lib/api';
import { toSaleRecord, type BackendSale } from '@/hooks/saleAdapter';
import { toCustomer, type BackendCustomer } from '@/hooks/contactAdapter';
import type { Customer } from '@/types/domain';
import { cn, formatBDT } from '@/lib/utils';
import { currentUserId } from '@/lib/actor';
import { PhoneAction, isCallable } from '@/components/ui/PhoneAction';
import { labelFor } from '@/lib/labels';
import { useDateFormat } from '@/lib/formatDate';
import { parseRangeBound } from '@/lib/datetime';
import { AddPaymentModal } from './AddPaymentModal';
import { InvoicePrintModal } from './InvoicePrintModal';
import { CreateReturnModal } from './CreateReturnModal';
import { CreateShipmentModal } from './CreateShipmentModal';

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
  // Used only when the opening page passes no Return / Ship handler.
  const [returnOpen, setReturnOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const fmt = useDateFormat();
  // UI-only gating; the IPC boundary is the real gate (see hooks/useCan.ts).
  const canEdit = useCan('sales.edit');
  const canVoid = useCan('sales.void');
  /**
   * Returns and shipments against this sale, from the store's full lists
   * (both load unpaged). The drawer used to read `sale.returnIds` and
   * `sale.shipmentId`, which nothing ever filled in: the "N return(s)" badge
   * never showed, and "Create Shipment" stayed on a sale already shipped.
   */
  const allReturns = useSales((s) => s.returns);
  const allShipments = useSales((s) => s.shipments);
  const saleReturns = useMemo(
    () => allReturns.filter((r) => r.saleId === saleId),
    [allReturns, saleId],
  );
  const saleShipment = useMemo(
    () => allShipments.find((x) => x.saleId === saleId),
    [allShipments, saleId],
  );

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

  // B11 / UI audit: Return and Ship work wherever the drawer is opened. A page
  // that handles them itself passes a handler; otherwise the drawer opens its own.
  const startReturn = () => (onCreateReturn ? onCreateReturn(sale.id) : setReturnOpen(true));
  const startShipment = () => (onCreateShipment ? onCreateShipment(sale.id) : setShipOpen(true));

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width="max-w-3xl"
        // The customer is the title (data); code and time underneath.
        title={customerLabel}
        subtitle={`${sale.invoiceNo} · ${fmt.dateTime(sale.date)}`}
      >
        <div className="flex-1 overflow-auto">
          <div className="p-5 space-y-5">
            {/* Header band — status and links to what followed the sale. */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill />
              {sale.status === 'quotation' && sale.validUntil && (
                <Badge variant="info">
                  <span>Valid until</span> <span>{fmt.date(parseRangeBound(sale.validUntil, 'from'))}</span>
                </Badge>
              )}
              {saleReturns.length > 0 && (
                <Badge variant="warning">
                  <span>Returns</span> <span className="tabular">{saleReturns.length}</span>
                </Badge>
              )}
              {saleShipment && (
                <Badge variant="info">
                  <span>Shipment</span> <span>{saleShipment.refNo}</span>
                </Badge>
              )}
            </div>

            {/* CUSTOMER — the phone number big enough to dial from: on a due
                invoice it is why the screen was opened. */}
            {(customer || sale.customerName) && (
              <div className="rounded-lg border border-border p-3 bg-card flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{customerLabel}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {callablePhone ? (
                      <span className="text-sm tabular font-semibold">{callablePhone}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">No phone on file</span>
                    )}
                    {customer?.group && (
                      <Badge variant="default">{labelFor('priceGroup', customer.group)}</Badge>
                    )}
                  </div>
                </div>
                {callablePhone && <PhoneAction phone={callablePhone} label={customer?.name} />}
                {/* Customer-wide, not this invoice's own Due (that is below). */}
                {customer && customer.due > 0 && (
                  <Badge variant="warning">
                    <span>Owes in total</span> <span className="tabular">{formatBDT(customer.due)}</span>
                  </Badge>
                )}
              </div>
            )}

            {/* Lines */}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-secondary/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Item</th>
                    <th className="text-right px-2 py-2 font-medium">Qty</th>
                    <th className="text-right px-2 py-2 font-medium">Unit Price</th>
                    <th className="text-right px-3 py-2 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.lines.map((l, i) => {
                    // Same arithmetic the invoice was stored with (clamped, rounded).
                    const sub = saleLineSubtotal(l);
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2">
                          <div className="font-medium">{l.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{l.sku}</div>
                        </td>
                        <td className="px-2 py-2 text-right tabular whitespace-nowrap">
                          {l.qty} {l.unit}
                        </td>
                        <td className="px-2 py-2 text-right tabular">
                          {formatBDT(l.unitPrice, { withSymbol: false })}
                        </td>
                        <td className="px-3 py-2 text-right tabular font-semibold">
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
                {sale.tax > 0 && (
                  <Row
                    label={
                      <>
                        <span>VAT</span> <span className="tabular">({sale.taxPct}%)</span>
                      </>
                    }
                    value={formatBDT(sale.tax)}
                  />
                )}
                {sale.shipping > 0 && <Row label="Shipping" value={formatBDT(sale.shipping)} />}
                {sale.other > 0 && <Row label="Other" value={formatBDT(sale.other)} />}
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-xl font-bold tabular">{formatBDT(sale.total)}</span>
                </div>
                <div className="pt-1 text-xs text-muted-foreground">
                  <span>By</span> <span>{sale.user}</span> · <span>{sale.branch}</span>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-1.5 text-sm bg-card">
                <Row label="Paid" value={formatBDT(sale.paid)} tone={sale.due === 0 ? 'success' : undefined} />
                {sale.due > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-destructive">Due</span>
                    <span className="text-xl font-bold tabular text-destructive">{formatBDT(sale.due)}</span>
                  </div>
                ) : (
                  <Row label="Due" value={formatBDT(sale.due)} />
                )}
                {/* Visible to everyone (owner decision 1). */}
                {sale.profit !== undefined && (
                  <Row label="Profit" value={formatBDT(sale.profit)} tone="success" />
                )}
                <div className="border-t border-border pt-2">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Payments</div>
                  {sale.payments.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No payments yet</div>
                  ) : (
                    sale.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          <span className="text-muted-foreground tabular">{fmt.dateTime(p.paidAt)}</span>
                          {' · '}
                          <span>{labelFor('paymentMethod', p.method)}</span>
                          {p.reference ? <span className="text-muted-foreground"> · {p.reference}</span> : null}
                        </span>
                        <span className="tabular shrink-0">{formatBDT(p.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* History — folded away; it is looked at when something is disputed. */}
            {sale.audit.length > 0 && (
              <details className="rounded-lg border border-border bg-card group">
                <summary className="px-3 py-2 flex items-center gap-2 text-sm font-medium cursor-pointer select-none list-none">
                  <History className="size-4 text-muted-foreground" />
                  <span>History</span>
                  <span className="text-muted-foreground tabular">({sale.audit.length})</span>
                  <ChevronDown className="size-4 ml-auto text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <div className="divide-y divide-border border-t border-border">
                  {sale.audit.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                      <Dot action={a.action} />
                      <span>{ACTION_LABEL[a.action] ?? a.action}</span>
                      {a.note && <span className="text-muted-foreground">— {a.note}</span>}
                      <span className="ml-auto text-xs text-muted-foreground tabular whitespace-nowrap">
                        {fmt.dateTime(a.at)} · {a.by}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>

        {/* Footer: everyday actions left, Void apart, Receive payment last on the right. */}
        <div className="border-t border-border bg-card px-4 py-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setPrintOpen(true)}>
            <Printer className="size-4" /> Print invoice
          </Button>
          {sale.status === 'final' && (
            <Button variant="outline" onClick={startReturn}>
              <Undo2 className="size-4" /> Return goods
            </Button>
          )}
          {sale.status === 'final' && !saleShipment && (
            <Button variant="outline" onClick={startShipment}>
              <Truck className="size-4" /> Ship
            </Button>
          )}
          {/* Editing rewrites money already taken: `sales.edit` only (Admin). */}
          {canEdit && sale.status !== 'void' && (
            <Link to={`/sales/${sale.id}/edit`}>
              <Button variant="outline">
                <Edit2 className="size-4" /> Edit
              </Button>
            </Link>
          )}
          <div className="flex-1" />
          {canVoid && (sale.status === 'draft' || sale.status === 'quotation') && (
            <Button
              variant="destructive"
              onClick={async () => {
                if (
                  await confirm({
                    title: sale.status === 'draft' ? 'Delete this draft?' : 'Delete this quotation?',
                    message: sale.invoiceNo,
                    variant: 'destructive',
                  })
                ) {
                  // Close only once it is really gone; a refusal keeps it open.
                  if (await deleteSale(sale.id)) {
                    toast.success('Deleted', { description: sale.invoiceNo });
                    onClose();
                  }
                }
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
          {/* A sale with a return cannot be voided (goods would go back twice). */}
          {canVoid && sale.status === 'final' && saleReturns.length > 0 && (
            <span className="text-sm text-muted-foreground">
              Has a return — return the rest instead of voiding.
            </span>
          )}
          {canVoid && sale.status === 'final' && saleReturns.length === 0 && (
            <Button
              variant="destructive"
              onClick={async () => {
                const reason = await promptText({
                  title: 'Void this sale?',
                  message: 'Voiding returns the items to stock and reverses any cash taken.',
                  label: 'Reason',
                  placeholder: 'e.g. customer cancelled',
                  confirmLabel: 'Void sale',
                  cancelLabel: 'Keep it',
                  variant: 'destructive',
                  required: true,
                });
                if (reason !== null && (await voidSale(sale.id, currentUserId(), reason))) {
                  toast.success('Sale voided', { description: sale.invoiceNo });
                }
              }}
            >
              <Ban className="size-4" /> Void
            </Button>
          )}
          {sale.status === 'final' && sale.due > 0 && (
            <Button size="lg" className="ml-2" onClick={() => setPayOpen(true)}>
              <Banknote className="size-5" /> Receive payment
            </Button>
          )}
        </div>
      </Drawer>

      <AddPaymentModal open={payOpen} onClose={() => setPayOpen(false)} sale={sale} />

      <InvoicePrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        sale={sale}
        customer={customer}
      />
      {!onCreateReturn && (
        <CreateReturnModal open={returnOpen} onClose={() => setReturnOpen(false)} saleId={sale.id} />
      )}
      {!onCreateShipment && (
        <CreateShipmentModal open={shipOpen} onClose={() => setShipOpen(false)} saleId={sale.id} />
      )}
    </>
  );
}

/** Audit actions in plain words (were raw keys with CSS `capitalize`). */
const ACTION_LABEL: Record<string, string> = {
  created: 'Created',
  edited: 'Corrected',
  voided: 'Voided',
  paid: 'Payment received',
  returned: 'Goods returned',
  shipped: 'Shipped',
};

function Row({
  label,
  value,
  tone,
}: {
  label: React.ReactNode;
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
  return <span className={`size-2 rounded-full shrink-0 ${cls}`} />;
}
