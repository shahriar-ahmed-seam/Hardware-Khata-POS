import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  HandCoins,
  Phone,
  Mail,
  MapPin,
  Building2,
  Trash2,
  Printer,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { useSuppliers } from '@/stores/contacts';
import { usePurchases, type PurchaseRecord } from '@/stores/purchases';
import { api } from '@/lib/api';
import { toSupplier, type BackendSupplier } from '@/hooks/contactAdapter';
import { toPurchaseRecord, type BackendPurchase } from '@/hooks/purchaseAdapter';
import type { Supplier } from '@/types/domain';
import { Avatar } from '@/components/contacts/Avatar';
import { SupplierForm } from '@/components/contacts/SupplierForm';
import { confirm } from '@/stores/confirm';
import { PaySupplierModal } from '@/components/contacts/PaySupplierModal';
import { formatBDT, cn } from '@/lib/utils';

type Tab = 'overview' | 'ledger' | 'purchases' | 'notes';

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const storeSupplier = useSuppliers((s) => s.items.find((x) => x.id === id)) ?? null;
  const update = useSuppliers((s) => s.update);
  const remove = useSuppliers((s) => s.remove);
  // Purchase RETURNS come from the purchases store (that list is NOT paged), so
  // hydrate it on mount. `purchases` there IS one page, which is why this
  // supplier's bills are fetched separately below.
  const purchaseReturns = usePurchases((s) => s.returns);
  useEffect(() => {
    void usePurchases.getState().hydrate();
  }, []);

  // The contacts store holds ONE PAGE of suppliers, so a deep-linked supplier is
  // usually NOT in `items` — hydrating and doing items.find() would render
  // "not found" for anyone past page 1. Prefer the store row when it IS there
  // (Edit / Pay Supplier rehydrate the store, so the page reflects them
  // instantly) and fall back to a single-record read.
  const hasStoreSupplier = !!storeSupplier;
  const [fetched, setFetched] = useState<Supplier | null>(null);
  const [fetching, setFetching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  // Bumped after a payment: store rows refresh via the store's rehydrate, but a
  // row read directly has to be re-read to pick up the new payable. IPC calls are
  // FIFO on one channel, so this lands after the payment writes.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id || hasStoreSupplier) {
      setFetched(null);
      setFetching(false);
      setNotFound(false);
      return;
    }
    let alive = true;
    setFetching(true);
    setNotFound(false);
    void api<BackendSupplier | null>('suppliers.get', { id })
      .then((row) => {
        if (!alive) return;
        if (row) setFetched(toSupplier(row));
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
  }, [id, hasStoreSupplier, reloadKey]);

  const supplier = storeSupplier ?? fetched;

  /**
   * Persist a patch and keep the on-screen copy in step. Store rows refresh via
   * `update()`'s rehydrate; a row that came from the single-record fetch is not
   * on the store's page, so the same patch is merged locally (the Notes textarea
   * is a controlled input and needs this to stay editable).
   */
  const savePatch = (patch: Partial<Supplier>) => {
    if (!supplier) return;
    update(supplier.id, patch);
    setFetched((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const [tab, setTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  /**
   * This supplier's bills. `usePurchases().purchases` is ONE PAGE of the GLOBAL
   * purchases list, so the payable ledger and the Purchases tab would only show
   * the bills that happen to sit on that page. Instead every page of
   * `purchases.listPage` FILTERED TO THIS SUPPLIER is pulled — that channel is
   * also the one that attaches each bill's payments, which the ledger needs for
   * its credit rows. The ledger arithmetic below is untouched.
   */
  const [supplierBills, setSupplierBills] = useState<PurchaseRecord[]>([]);

  useEffect(() => {
    if (!id) {
      setSupplierBills([]);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const rows: BackendPurchase[] = [];
        // The backend caps pageSize at 200, so walk the pages for this supplier.
        for (let page = 1; page <= 50; page += 1) {
          const res = await api<{ rows: BackendPurchase[]; total: number }>('purchases.listPage', {
            page,
            pageSize: 200,
            supplierId: id,
          });
          rows.push(...res.rows);
          if (res.rows.length === 0 || rows.length >= res.total) break;
        }
        if (alive) setSupplierBills(rows.map(toPurchaseRecord));
      } catch {
        // Channel error or running outside Electron — leave the tabs empty
        // rather than showing a partial payable.
        if (alive) setSupplierBills([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  // Newest first for the Purchases tab.
  const supplierPurchases = useMemo(
    () =>
      supplier
        ? supplierBills
            .filter((p) => p.supplierId === supplier.id)
            .slice()
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        : [],
    [supplierBills, supplier],
  );

  const supplierReturns = useMemo(
    () => (supplier ? purchaseReturns.filter((r) => r.supplierId === supplier.id) : []),
    [purchaseReturns, supplier],
  );

  /**
   * Supplier ledger built from the available purchase data — mirrors the
   * CustomerDetail ledger structure (debit/credit/running balance) but from the
   * supplier's side of the books:
   *   - opening balance      → debit (we owe the supplier)
   *   - purchase (received)  → debit (increases payable)
   *   - payment              → credit (reduces payable)
   *   - credit purchase return (CreditAdjust) → credit (reduces payable)
   *
   * LIMITATION: there is no dedicated supplier-ledger backend channel, so this
   * is reconstructed from `purchases.list`/`purchases.get` (+ their nested
   * payments) and `purchaseReturns.list`. Non-credit refund methods (e.g. a
   * cash refund) do NOT reduce the payable, so only `CreditAdjust` returns post
   * to the ledger here. Opening balance is taken from the supplier record.
   */
  const ledger = useMemo(() => {
    if (!supplier) return [];
    const entries: {
      id: string;
      date: string;
      type: 'opening' | 'purchase' | 'return' | 'payment';
      reference: string;
      debit: number;
      credit: number;
    }[] = [];

    if (supplier.openingBalance && supplier.openingBalance > 0) {
      entries.push({
        id: 'open',
        date: supplierPurchases[supplierPurchases.length - 1]?.date ?? new Date().toISOString(),
        type: 'opening',
        reference: 'Opening balance',
        debit: supplier.openingBalance,
        credit: 0,
      });
    }

    supplierPurchases
      .filter((p) => p.status !== 'cancelled')
      .forEach((p) => {
        entries.push({
          id: p.id + '-po',
          date: p.date,
          type: 'purchase',
          reference: p.refNo,
          debit: p.total,
          credit: 0,
        });
        p.payments.forEach((pay) => {
          entries.push({
            id: p.id + '-pay-' + pay.id,
            date: pay.paidAt,
            type: 'payment',
            reference: `${p.refNo} · ${pay.method}`,
            debit: 0,
            credit: pay.amount,
          });
        });
      });

    supplierReturns
      .filter((r) => r.refundMethod === 'CreditAdjust')
      .forEach((r) => {
        entries.push({
          id: r.id,
          date: r.date,
          type: 'return',
          reference: `${r.refNo} · against ${r.purchaseRefNo}`,
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
  }, [supplier, supplierPurchases, supplierReturns]);

  if (!supplier) {
    // Loading and "not found" are DISTINCT states — the single-record fetch
    // above resolves asynchronously.
    if (id && (fetching || !notFound)) {
      return <div className="p-8 text-sm text-muted-foreground">Loading supplier…</div>;
    }
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Supplier not found.{' '}
        <Link className="text-primary underline" to="/contacts/suppliers">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={supplier.name}
        subtitle={supplier.company ?? 'Supplier'}
        actions={
          <>
            <Button variant="ghost" onClick={() => nav('/contacts/suppliers')}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="size-4" /> Print Statement
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit2 className="size-4" /> Edit
            </Button>
            <Button onClick={() => setPayOpen(true)} disabled={supplier.due === 0}>
              <HandCoins className="size-4" /> Pay Supplier
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={supplier.name} size={64} variant="muted" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-lg font-semibold">{supplier.name}</div>
                {supplier.paymentTerms && <Badge variant="info">{supplier.paymentTerms}</Badge>}
                {supplier.leadTimeDays && (
                  <span className="text-xs text-muted-foreground">
                    Lead time: {supplier.leadTimeDays}d
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                {supplier.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="size-3" /> {supplier.company}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Phone className="size-3" /> {supplier.phone}
                </span>
                {supplier.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="size-3" /> {supplier.email}
                  </span>
                )}
                {supplier.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" /> {supplier.address}
                  </span>
                )}
              </div>
              {supplier.taxId && (
                <div className="text-[11px] text-muted-foreground mt-1">
                  Tax ID: <span className="font-mono">{supplier.taxId}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total Purchase" value={formatBDT(supplier.totalPurchase)} />
              <Stat
                label="Total Paid"
                value={formatBDT(supplier.totalPaid ?? 0)}
                tone="success"
              />
              <Stat
                label="Outstanding Payable"
                value={formatBDT(supplier.due)}
                tone={supplier.due > 0 ? 'destructive' : undefined}
              />
              <Stat
                label="Bank Account"
                value={supplier.bankAccount ? supplier.bankAccount : '—'}
              />
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-1 border-b border-border">
          {(['overview', 'ledger', 'purchases', 'notes'] as Tab[]).map((t) => (
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
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <Card className="p-4 text-sm space-y-2">
            <div className="text-sm font-semibold">Notes</div>
            <div className="text-muted-foreground whitespace-pre-wrap">{supplier.notes || '—'}</div>
          </Card>
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
                  <th className="text-right px-4 py-2.5 font-medium">Payable</th>
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
                  <tr key={e.id} className="border-t border-border">
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

        {tab === 'purchases' && (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Date</th>
                  <th className="text-left px-2 py-2.5 font-medium">Reference</th>
                  <th className="text-right px-2 py-2.5 font-medium">Items</th>
                  <th className="text-right px-2 py-2.5 font-medium">Total</th>
                  <th className="text-right px-2 py-2.5 font-medium">Paid</th>
                  <th className="text-right px-2 py-2.5 font-medium">Due</th>
                  <th className="text-left px-2 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {supplierPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No purchases from this supplier yet.
                    </td>
                  </tr>
                ) : (
                  supplierPurchases.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => nav(`/purchases?ref=${encodeURIComponent(p.refNo)}`)}
                      className={cn(
                        'border-t border-border cursor-pointer hover:bg-secondary/40',
                        p.status === 'cancelled' && 'opacity-60',
                      )}
                    >
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(p.date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{p.refNo}</td>
                      <td className="px-2 py-2 text-right font-mono tabular">
                        {p.lines.reduce((n, l) => n + l.qty, 0)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular font-semibold">
                        {formatBDT(p.total, { withSymbol: false })}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular text-success">
                        {formatBDT(p.paid, { withSymbol: false })}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular">
                        {p.due > 0 ? (
                          <span className="text-destructive">
                            {formatBDT(p.due, { withSymbol: false })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Badge
                          variant={
                            p.status === 'received'
                              ? 'success'
                              : p.status === 'cancelled'
                                ? 'destructive'
                                : 'info'
                          }
                        >
                          {p.status.replace('-', ' ')}
                        </Badge>
                      </td>
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
              value={supplier.notes ?? ''}
              onChange={(e) => savePatch({ notes: e.target.value })}
              rows={6}
              placeholder="Internal notes (saved automatically)…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
            />
          </Card>
        )}
      </div>

      <Drawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        width="max-w-3xl"
        title="Edit Supplier"
        subtitle={supplier.name}
      >
        <SupplierForm
          asDrawer
          initial={supplier}
          onSave={(s) => {
            savePatch(s);
            setEditOpen(false);
          }}
          onCancel={() => setEditOpen(false)}
          onDelete={async () => {
            if (await confirm({ title: `Delete "${supplier.name}"?`, variant: 'destructive' })) {
              remove(supplier.id);
              nav('/contacts/suppliers');
            }
          }}
        />
      </Drawer>

      <PaySupplierModal
        open={payOpen}
        onClose={() => {
          setPayOpen(false);
          setReloadKey((k) => k + 1);
        }}
        supplierId={supplier.id}
      />
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
    type === 'purchase'
      ? 'bg-destructive'
      : type === 'payment'
        ? 'bg-success'
        : type === 'return'
          ? 'bg-warning'
          : 'bg-primary';
  return <span className={`size-2 rounded-full inline-block ${cls}`} />;
}

void Trash2;
