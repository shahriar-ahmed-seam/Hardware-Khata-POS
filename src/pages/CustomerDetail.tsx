import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  HandCoins,
  ScanBarcode,
  MessageSquare,
  Printer,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { useCustomers } from '@/stores/contacts';
import { useSales } from '@/stores/sales';
import { Avatar } from '@/components/contacts/Avatar';
import { CustomerForm } from '@/components/contacts/CustomerForm';
import { ReceivePaymentModal } from '@/components/contacts/ReceivePaymentModal';
import { SaleDetail } from '@/components/sales/SaleDetail';
import { formatBDT, cn } from '@/lib/utils';

type Tab = 'overview' | 'ledger' | 'sales' | 'returns' | 'notes';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const customer = useCustomers((s) => s.items.find((c) => c.id === id));
  const update = useCustomers((s) => s.update);
  const remove = useCustomers((s) => s.remove);
  const hydrate = useCustomers((s) => s.hydrate);
  // Hydrate from the backend on mount so deep-link entry populates the store.
  // Sales/returns are read below for the ledger + history tabs, so hydrate that
  // store too (cheap no-op without a backend).
  useEffect(() => {
    void hydrate();
    void useSales.getState().hydrate();
  }, [hydrate]);
  const sales = useSales((s) => s.sales);
  const returns = useSales((s) => s.returns);

  const [tab, setTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [saleId, setSaleId] = useState<string | null>(null);

  const customerSales = useMemo(
    () => (customer ? sales.filter((s) => s.customerId === customer.id) : []),
    [sales, customer],
  );
  const customerReturns = useMemo(
    () => (customer ? returns.filter((r) => r.customerId === customer.id) : []),
    [returns, customer],
  );

  // Build ledger
  const ledger = useMemo(() => {
    if (!customer) return [];
    const entries: {
      id: string;
      date: string;
      type: 'opening' | 'sale' | 'return' | 'payment';
      reference: string;
      debit: number;
      credit: number;
      saleId?: string;
    }[] = [];

    if (customer.openingBalance && customer.openingBalance > 0) {
      entries.push({
        id: 'open',
        date: customer.joined,
        type: 'opening',
        reference: 'Opening balance',
        debit: customer.openingBalance,
        credit: 0,
      });
    }
    customerSales
      .filter((s) => s.status === 'final')
      .forEach((s) => {
        entries.push({
          id: s.id + '-sale',
          date: s.date,
          type: 'sale',
          reference: s.invoiceNo,
          debit: s.total,
          credit: 0,
          saleId: s.id,
        });
        s.payments.forEach((p) => {
          entries.push({
            id: s.id + '-pay-' + p.id,
            date: p.paidAt,
            type: 'payment',
            reference: `${s.invoiceNo} · ${p.method}`,
            debit: 0,
            credit: p.amount,
            saleId: s.id,
          });
        });
      });
    customerReturns.forEach((r) => {
      entries.push({
        id: r.id,
        date: r.date,
        type: 'return',
        reference: `${r.refNo} · against ${r.saleInvoiceNo}`,
        debit: 0,
        credit: r.total,
      });
    });

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let running = 0;
    return entries.map((e) => {
      running += e.debit - e.credit;
      return { ...e, balance: running };
    });
  }, [customer, customerSales, customerReturns]);

  if (!customer) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Customer not found.{' '}
        <Link className="text-primary underline" to="/contacts/customers">
          Back to list
        </Link>
      </div>
    );
  }

  const usagePct =
    customer.creditLimit && customer.creditLimit > 0
      ? Math.min(100, Math.round((customer.due / customer.creditLimit) * 100))
      : 0;
  const overLimit = !!customer.creditLimit && customer.due >= customer.creditLimit;

  return (
    <div>
      <PageHeader
        title={customer.name}
        subtitle={`${customer.group} · joined ${customer.joined}`}
        actions={
          <>
            <Button variant="ghost" onClick={() => nav('/contacts/customers')}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button variant="outline" size="sm">
              <MessageSquare className="size-4" /> Send SMS
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="size-4" /> Print Statement
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit2 className="size-4" /> Edit
            </Button>
            <Link to="/pos">
              <Button variant="outline" size="sm">
                <ScanBarcode className="size-4" /> New Sale
              </Button>
            </Link>
            <Button onClick={() => setPayOpen(true)} disabled={customer.due === 0}>
              <HandCoins className="size-4" /> Receive Payment
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        {/* Header card */}
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={customer.name} size={64} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-lg font-semibold">{customer.name}</div>
                <Badge
                  variant={
                    customer.group === 'Wholesale'
                      ? 'info'
                      : customer.group === 'Contractor'
                        ? 'warning'
                        : 'default'
                  }
                >
                  {customer.group}
                </Badge>
                {(customer.tags ?? []).map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-1.5 py-0 rounded bg-primary/10 text-primary font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="size-3" /> {customer.phone}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="size-3" /> {customer.email}
                  </span>
                )}
                {customer.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" /> {customer.address}
                  </span>
                )}
                {customer.dob && (
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" /> DOB {customer.dob}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total Purchase" value={formatBDT(customer.totalPurchase)} />
              <Stat label="Total Paid" value={formatBDT(customer.totalPaid ?? 0)} tone="success" />
              <Stat label="Outstanding Due" value={formatBDT(customer.due)} tone={customer.due > 0 ? 'destructive' : undefined} />
              <Stat
                label="Credit Limit"
                value={customer.creditLimit ? formatBDT(customer.creditLimit) : '—'}
              />
            </div>
          </div>

          {customer.creditLimit && customer.creditLimit > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>
                  Credit usage{overLimit && <span className="text-destructive font-medium ml-2">over limit!</span>}
                </span>
                <span className="font-mono tabular">
                  {formatBDT(customer.due, { withSymbol: false })} / {formatBDT(customer.creditLimit, { withSymbol: false })} ({usagePct}%)
                </span>
              </div>
              <div className="h-2 bg-secondary rounded">
                <div
                  className={cn(
                    'h-full rounded',
                    overLimit ? 'bg-destructive' : usagePct > 70 ? 'bg-warning' : 'bg-primary',
                  )}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {(['overview', 'ledger', 'sales', 'returns', 'notes'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 h-10 text-sm font-medium border-b-2 -mb-px transition capitalize',
                tab === t
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'sales' ? 'Sales History' : t}
              {t === 'sales' && customerSales.length > 0 && (
                <span className="ml-1.5 text-[10px] tabular text-muted-foreground">
                  ({customerSales.length})
                </span>
              )}
              {t === 'returns' && customerReturns.length > 0 && (
                <span className="ml-1.5 text-[10px] tabular text-muted-foreground">
                  ({customerReturns.length})
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="p-4 xl:col-span-2">
              <div className="text-sm font-semibold mb-3">Recent activity</div>
              {ledger.slice(-8).reverse().length === 0 ? (
                <div className="text-sm text-muted-foreground">No activity yet.</div>
              ) : (
                <div className="space-y-2">
                  {ledger.slice(-8).reverse().map((e) => (
                    <div key={e.id} className="flex items-center gap-3 text-sm">
                      <Dot type={e.type} />
                      <div className="flex-1 min-w-0 truncate">
                        <span className="capitalize">{e.type}</span>
                        <span className="text-muted-foreground"> — {e.reference}</span>
                      </div>
                      <span
                        className={cn(
                          'font-mono tabular',
                          e.debit > 0 ? 'text-destructive' : 'text-success',
                        )}
                      >
                        {e.debit > 0
                          ? '+' + formatBDT(e.debit, { withSymbol: false })
                          : '−' + formatBDT(e.credit, { withSymbol: false })}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(e.date).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card className="p-4 space-y-2 text-sm">
              <div className="text-sm font-semibold">Notes</div>
              <div className="text-muted-foreground whitespace-pre-wrap">
                {customer.notes || '—'}
              </div>
            </Card>
          </div>
        )}

        {tab === 'ledger' && (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Date</th>
                  <th className="text-left px-2 py-2.5 font-medium">Type</th>
                  <th className="text-left px-2 py-2.5 font-medium">Reference</th>
                  <th className="text-right px-2 py-2.5 font-medium">Debit</th>
                  <th className="text-right px-2 py-2.5 font-medium">Credit</th>
                  <th className="text-right px-4 py-2.5 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No ledger entries yet.
                    </td>
                  </tr>
                )}
                {ledger.map((e) => (
                  <tr
                    key={e.id}
                    className={cn(
                      'border-t border-border',
                      e.saleId && 'cursor-pointer hover:bg-secondary/40',
                    )}
                    onClick={() => e.saleId && setSaleId(e.saleId)}
                  >
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(e.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1.5 capitalize">
                        <Dot type={e.type} />
                        {e.type}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs">{e.reference}</td>
                    <td className="px-2 py-2 text-right font-mono tabular text-destructive">
                      {e.debit > 0 ? formatBDT(e.debit, { withSymbol: false }) : '—'}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular text-success">
                      {e.credit > 0 ? formatBDT(e.credit, { withSymbol: false }) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular font-semibold">
                      {formatBDT(e.balance, { withSymbol: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === 'sales' && (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Date</th>
                  <th className="text-left px-2 py-2.5 font-medium">Invoice</th>
                  <th className="text-right px-2 py-2.5 font-medium">Total</th>
                  <th className="text-right px-2 py-2.5 font-medium">Paid</th>
                  <th className="text-right px-2 py-2.5 font-medium">Due</th>
                  <th className="text-left px-2 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {customerSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No sales for this customer yet.
                    </td>
                  </tr>
                ) : (
                  customerSales
                    .slice()
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => setSaleId(s.id)}
                        className="border-t border-border cursor-pointer hover:bg-secondary/40"
                      >
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {new Date(s.date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-2 py-2 font-mono text-xs">{s.invoiceNo}</td>
                        <td className="px-2 py-2 text-right font-mono tabular font-semibold">
                          {formatBDT(s.total, { withSymbol: false })}
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular text-success">
                          {formatBDT(s.paid, { withSymbol: false })}
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular">
                          {s.due > 0 ? (
                            <span className="text-destructive">
                              {formatBDT(s.due, { withSymbol: false })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <Badge
                            variant={
                              s.status === 'void'
                                ? 'destructive'
                                : s.due === 0
                                  ? 'success'
                                  : s.paid > 0
                                    ? 'warning'
                                    : 'destructive'
                            }
                          >
                            {s.status === 'void'
                              ? 'voided'
                              : s.due === 0
                                ? 'paid'
                                : s.paid > 0
                                  ? 'partial'
                                  : 'due'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </Card>
        )}

        {tab === 'returns' && (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Date</th>
                  <th className="text-left px-2 py-2.5 font-medium">Return #</th>
                  <th className="text-left px-2 py-2.5 font-medium">Original</th>
                  <th className="text-right px-2 py-2.5 font-medium">Refund</th>
                  <th className="text-left px-2 py-2.5 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {customerReturns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No returns for this customer.
                    </td>
                  </tr>
                ) : (
                  customerReturns.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(r.date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{r.refNo}</td>
                      <td className="px-2 py-2 font-mono text-xs">{r.saleInvoiceNo}</td>
                      <td className="px-2 py-2 text-right font-mono tabular text-warning">
                        {formatBDT(r.total)}
                      </td>
                      <td className="px-2 py-2 text-xs capitalize">{r.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        )}

        {tab === 'notes' && (
          <Card className="p-4">
            <textarea
              value={customer.notes ?? ''}
              onChange={(e) => update(customer.id, { notes: e.target.value })}
              rows={6}
              placeholder="Internal notes about this customer (saved automatically)…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
            />
          </Card>
        )}
      </div>

      <Drawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        width="max-w-3xl"
        title="Edit Customer"
        subtitle={customer.name}
      >
        <CustomerForm
          asDrawer
          initial={customer}
          onSave={(c) => {
            update(c.id, c);
            setEditOpen(false);
          }}
          onCancel={() => setEditOpen(false)}
          onDelete={() => {
            if (confirm(`Delete "${customer.name}"?`)) {
              remove(customer.id);
              nav('/contacts/customers');
            }
          }}
        />
      </Drawer>

      <ReceivePaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        customerId={customer.id}
      />

      <SaleDetail open={!!saleId} onClose={() => setSaleId(null)} saleId={saleId} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'destructive';
}) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground font-medium">{label}</div>
      <div
        className={cn(
          'text-base font-bold mt-0.5 font-mono tabular',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Dot({ type }: { type: string }) {
  const cls =
    type === 'sale'
      ? 'bg-destructive'
      : type === 'payment'
        ? 'bg-success'
        : type === 'return'
          ? 'bg-warning'
          : 'bg-primary';
  return <span className={`size-2 rounded-full inline-block ${cls}`} />;
}

void AlertTriangle;
void Trash2;
