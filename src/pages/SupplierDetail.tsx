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
  Landmark,
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
import { useKhata } from '@/hooks/useKhata';
import { useDateFormat } from '@/lib/formatDate';
import { humanizeKey } from '@/lib/labels';
import { KhataTable, type KhataPeriod } from '@/components/contacts/KhataTable';
import { StatementPrintModal } from '@/components/contacts/StatementPrintModal';
import { MoneyStat, NotesBox, TermsText, TH } from '@/components/contacts/shared';

type Tab = 'khata' | 'purchases' | 'notes';
const TAB_LABEL: Record<Tab, string> = { khata: 'Khata', purchases: 'Purchases', notes: 'Notes' };


export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const storeSupplier = useSuppliers((s) => s.items.find((x) => x.id === id)) ?? null;
  const update = useSuppliers((s) => s.update);
  const remove = useSuppliers((s) => s.remove);
  // Purchase RETURNS come from the purchases store (that list is NOT paged), so
  // hydrate it on mount. `purchases` there IS one page, which is why this
  // supplier's bills are fetched separately below.
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
  // Resolves true once saved; the local copy is only changed when it was.
  const savePatch = async (patch: Partial<Supplier>) => {
    if (!supplier) return false;
    const ok = await update(supplier.id, patch);
    if (ok) setFetched((prev) => (prev ? { ...prev, ...patch } : prev));
    return ok;
  };

  // The khata is the first and default tab (the old Overview held only notes).
  const [tab, setTab] = useState<Tab>('khata');
  const [period, setPeriod] = useState<KhataPeriod>('3m');
  const [statementOpen, setStatementOpen] = useState(false);
  const fmt = useDateFormat();
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

  // The supplier's khata, as the backend keeps it (supplierLedger) — its last
  // balance IS the payable above. It used to be rebuilt here from the loaded
  // bills and returns, which left out held credits and money paid on account.
  const khata = useKhata('supplier', id, `${reloadKey}:${supplier?.due ?? ''}:${supplier?.totalPaid ?? ''}`);
  const ledger = khata.rows;

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
            <Button variant="outline" onClick={() => setStatementOpen(true)}>
              <Printer className="size-4" /> Print Statement
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
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
                {supplier.paymentTerms && <Badge variant="info"><TermsText terms={supplier.paymentTerms} /></Badge>}
                {supplier.leadTimeDays && (
                  <span className="text-sm text-muted-foreground">
                    <span>Lead time</span> <span className="tabular">{supplier.leadTimeDays}</span>{' '}
                    <span>days</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1.5 text-sm text-muted-foreground">
                {supplier.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="size-3.5" /> {supplier.company}
                  </span>
                )}
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Phone className="size-3.5" /> {supplier.phone}
                </span>
                {supplier.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" /> {supplier.email}
                  </span>
                )}
                {supplier.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" /> {supplier.address}
                  </span>
                )}
              </div>
              {(supplier.taxId || supplier.bankAccount) && (
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-1">
                  {supplier.bankAccount && (
                    <span className="flex items-center gap-1">
                      <Landmark className="size-3.5" /> <span className="font-mono">{supplier.bankAccount}</span>
                    </span>
                  )}
                  {supplier.taxId && (
                    <span>
                      <span>Tax ID</span>: <span className="font-mono">{supplier.taxId}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-end gap-6 flex-wrap">
              <MoneyStat
                card={false}
                hero
                label="Outstanding Payable"
                value={formatBDT(supplier.due)}
                tone={supplier.due > 0 ? 'destructive' : undefined}
              />
              <div className="grid grid-cols-2 gap-4">
                <MoneyStat card={false} label="Total Purchase" value={formatBDT(supplier.totalPurchase)} />
                <MoneyStat card={false} label="Total Paid" value={formatBDT(supplier.totalPaid ?? 0)} tone="success" />
              </div>
            </div>
          </div>
        </Card>

        <div role="tablist" className="flex items-center gap-1 border-b border-border">
          {(['khata', 'purchases', 'notes'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 h-10 text-sm font-medium border-b-2 -mb-px transition',
                tab === t
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {tab === 'khata' && (
          <KhataTable kind="supplier" rows={ledger} loading={khata.loading} period={period} onPeriodChange={setPeriod} />
        )}

        {tab === 'purchases' && (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <th className={cn(TH, 'text-left pl-4')}>Date</th>
                  <th className={cn(TH, 'text-left')}>Reference</th>
                  <th className={cn(TH, 'text-right')}>Items</th>
                  <th className={cn(TH, 'text-right')}>Total</th>
                  <th className={cn(TH, 'text-right')}>Paid</th>
                  <th className={cn(TH, 'text-right')}>Due</th>
                  <th className={cn(TH, 'text-left')}>Status</th>
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        {fmt.date(p.date)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{p.refNo}</td>
                      <td className="px-3 py-3 text-right tabular">
                        {p.lines.reduce((n, l) => n + l.qty, 0)}
                      </td>
                      <td className="px-3 py-3 text-right tabular font-semibold">
                        {formatBDT(p.total, { withSymbol: false })}
                      </td>
                      <td className="px-3 py-3 text-right tabular text-success">
                        {formatBDT(p.paid, { withSymbol: false })}
                      </td>
                      <td className="px-3 py-3 text-right tabular">
                        {p.due > 0 ? (
                          <span className="text-destructive">
                            {formatBDT(p.due, { withSymbol: false })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant={
                            p.status === 'received'
                              ? 'success'
                              : p.status === 'cancelled'
                                ? 'destructive'
                                : 'info'
                          }
                        >
                          {humanizeKey(p.status)}
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
            <NotesBox
              key={supplier.id}
              value={supplier.notes ?? ''}
              placeholder="Internal notes…"
              onSave={(notes) => savePatch({ notes })}
            />
          </Card>
        )}
      </div>

      <Drawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        width="max-w-xl"
        title="Edit Supplier"
        subtitle={supplier.name}
      >
        <SupplierForm
          asDrawer
          initial={supplier}
          onSave={async (s) => {
            if (await savePatch(s)) setEditOpen(false);
          }}
          onCancel={() => setEditOpen(false)}
          onDelete={async () => {
            if (await confirm({ title: `Delete "${supplier.name}"?`, variant: 'destructive' })) {
              if (await remove(supplier.id)) nav('/contacts/suppliers');
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

      {statementOpen && (
        <StatementPrintModal
          open
          onClose={() => setStatementOpen(false)}
          kind="supplier"
          contact={{ name: supplier.name, phone: supplier.phone, address: supplier.address }}
          rows={ledger}
          initialPeriod={period}
        />
      )}
    </div>
  );
}
