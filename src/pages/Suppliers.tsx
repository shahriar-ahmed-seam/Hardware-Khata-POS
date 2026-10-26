import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBackup } from '@/stores/backup';
import {
  Search,
  Plus,
  Settings2,
  Download,
  Edit2,
  HandCoins,
  Phone,
  Mail,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { ColumnsPanel } from '@/components/ui/ColumnsPanel';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { confirm } from '@/stores/confirm';
import { useSuppliers } from '@/stores/contacts';
import {
  ALL_SUPPLIER_COLUMNS,
  SUPPLIER_COLUMN_META,
  useContactsUI,
  type SupplierColumn,
} from '@/stores/contactsUI';
import type { Supplier } from '@/types/domain';
import { Avatar } from '@/components/contacts/Avatar';
import { SupplierForm } from '@/components/contacts/SupplierForm';
import { PaySupplierModal } from '@/components/contacts/PaySupplierModal';
import { formatBDT, cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatDate';
import { MoneyStat, PageScopeNote, TermsText, TH, ViewToggle } from '@/components/contacts/shared';

/** The avatar column only repeats the name. */
const PICKABLE_COLS = ALL_SUPPLIER_COLUMNS.filter((c) => c !== 'avatar');

export default function Suppliers() {
  const nav = useNavigate();
  const exportCsv = useBackup((s) => s.exportCsv);
  const exportBusy = useBackup((s) => s.busy);
  const { items, add, update, remove } = useSuppliers();
  const loading = useSuppliers((s) => s.loading);
  const total = useSuppliers((s) => s.total);
  const query = useSuppliers((s) => s.query);
  const loadPage = useSuppliers((s) => s.loadPage);
  const {
    supplierView,
    setSupplierView,
    supplierCols: savedCols,
    toggleSupplierCol,
    moveSupplierCol,
    resetSupplierCols,
  } = useContactsUI();
  const supplierCols = savedCols.filter((c) => c !== 'avatar');

  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [colsOpen, setColsOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string | 'new' | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [dueFilter, setDueFilter] = useState<'all' | 'has' | 'none'>('all');

  // Load ONE page on mount (replaces the old full-table hydrate). An initial ?q=
  // is folded into the same call so mounting costs a single round-trip.
  const initialQ = useRef(q);
  useEffect(() => {
    void loadPage({ page: 1, q: initialQ.current.trim() || undefined });
  }, [loadPage]);

  // Free-text search hits the DATABASE (name + company + phone), so it is
  // debounced ~300ms. The first run is skipped — mount already loaded.
  const searchMounted = useRef(false);
  useEffect(() => {
    if (!searchMounted.current) {
      searchMounted.current = true;
      return;
    }
    const handle = setTimeout(() => {
      void loadPage({ q: q.trim() || undefined });
    }, 300);
    return () => clearTimeout(handle);
  }, [q, loadPage]);

  // The server already applied the search; "Has payable" narrows this page.
  const filtered = useMemo(
    () =>
      items.filter((x) =>
        dueFilter === 'has' ? x.due > 0 : dueFilter === 'none' ? x.due === 0 : true,
      ),
    [items, dueFilter],
  );

  // These sums cover the LOADED PAGE only — the rest was never fetched.
  const totals = useMemo(
    () => ({
      purchase: filtered.reduce((s, x) => s + x.totalPurchase, 0),
      paid: filtered.reduce((s, x) => s + (x.totalPaid ?? 0), 0),
      payable: filtered.reduce((s, x) => s + x.due, 0),
    }),
    [filtered],
  );

  const editing = drawerId === 'new' ? undefined : drawerId ? items.find((x) => x.id === drawerId) : undefined;

  return (
    <div>
      <PageHeader
        title="Suppliers"
        actions={
          <>
            <IconButton variant="outline" label="Customize columns" onClick={() => setColsOpen(true)}>
              <Settings2 className="size-4" />
            </IconButton>
            <ViewToggle value={supplierView} onChange={setSupplierView} />
            {/* Import is switched off until real importers exist (see /import). */}
            <Button
              variant="outline"
              disabled={exportBusy}
              onClick={() => void exportCsv('suppliers')}
              title="Write every supplier to a CSV file in your backup folder"
            >
              <Download className="size-4" /> Export all
            </Button>
            <Button onClick={() => setDrawerId('new')}>
              <Plus className="size-4" /> Add Supplier
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        {/* KPI strip — page-scoped; the note says so only when it matters. */}
        <div>
          <PageScopeNote total={total} pageSize={query.pageSize} />
          <div className="grid grid-cols-3 gap-3">
            <MoneyStat
              label="Payable"
              value={formatBDT(totals.payable)}
              tone={totals.payable > 0 ? 'destructive' : undefined}
            />
            <MoneyStat label="Total Purchase" value={formatBDT(totals.purchase)} />
            <MoneyStat label="Total Paid" value={formatBDT(totals.paid)} tone="success" />
          </div>
        </div>

        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, company, phone…"
              className="pl-9"
              aria-label="Search suppliers"
            />
          </div>
          <Segmented
            ariaLabel="Payable"
            value={dueFilter}
            onChange={setDueFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'has', label: 'Has payable' },
              { value: 'none', label: 'Nothing owed' },
            ]}
          />
        </Card>

        {/* Skeleton while the backend list loads; empty state handles no rows. */}
        {loading && items.length === 0 ? (
          <SkeletonTable count={8} />
        ) : supplierView === 'table' ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 sticky top-0">
                  <tr>
                    {supplierCols.map((c) => (
                      <th
                        key={c}
                        className={cn(
                          TH,
                          SUPPLIER_COLUMN_META[c].align === 'right' ? 'text-right' : 'text-left',
                        )}
                      >
                        {SUPPLIER_COLUMN_META[c].label}
                      </th>
                    ))}
                    <th className={cn(TH, 'w-28')}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      // The whole row opens the supplier's khata.
                      onClick={() => nav(`/contacts/suppliers/${s.id}`)}
                      className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                    >
                      {supplierCols.map((col) => (
                        <SupplierCell key={col} col={col} s={s} />
                      ))}
                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        {/* Invisible at zero payable so the column keeps its place. */}
                        <Button
                          variant="outline"
                          onClick={() => setPayFor(s.id)}
                          className={cn(s.due > 0 ? '' : 'invisible')}
                          tabIndex={s.due > 0 ? 0 : -1}
                        >
                          <HandCoins className="size-4 text-success" /> Pay
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={supplierCols.length + 1}>
                        <EmptyState compact title="No suppliers match." message="Clear the search, or add a new supplier." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={query.page}
              pageSize={query.pageSize}
              total={total}
              onPageChange={(page) => void loadPage({ page })}
              onPageSizeChange={(pageSize) => void loadPage({ pageSize })}
              label="suppliers"
              busy={loading}
            />
          </Card>
        ) : (
          <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((s) => (
              <Card
                key={s.id}
                className="p-4 hover:shadow-md transition cursor-pointer"
                onClick={() => nav(`/contacts/suppliers/${s.id}`)}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={s.name} size={48} variant="muted" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">{s.name}</div>
                      {s.paymentTerms && (
                        <Badge variant="info">
                          <TermsText terms={s.paymentTerms} />
                        </Badge>
                      )}
                    </div>
                    {s.company && (
                      <div className="text-sm text-muted-foreground">{s.company}</div>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Phone className="size-3.5" /> {s.phone}
                      </span>
                      {s.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="size-3.5" /> {s.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border">
                  <div>
                    <div className="text-xs text-muted-foreground">Total Purchase</div>
                    <div className="text-sm font-semibold tabular">
                      {formatBDT(s.totalPurchase)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Payable</div>
                    <div
                      className={cn(
                        'text-sm font-semibold tabular',
                        s.due > 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {formatBDT(s.due)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" onClick={() => setDrawerId(s.id)}>
                    <Edit2 className="size-4" /> Edit
                  </Button>
                  <Button disabled={s.due === 0} onClick={() => setPayFor(s.id)}>
                    <HandCoins className="size-4" /> Pay
                  </Button>
                </div>
              </Card>
            ))}
            {filtered.length === 0 && (
              <Card className="md:col-span-2 xl:col-span-3">
                <EmptyState compact title="No suppliers match." message="Clear the search, or add a new supplier." />
              </Card>
            )}
          </div>
          <Card className="overflow-hidden">
            <Pagination
              page={query.page}
              pageSize={query.pageSize}
              total={total}
              onPageChange={(page) => void loadPage({ page })}
              onPageSizeChange={(pageSize) => void loadPage({ pageSize })}
              label="suppliers"
              busy={loading}
            />
          </Card>
          </div>
        )}
      </div>

      {colsOpen && (
        <ColumnsPanel
          all={PICKABLE_COLS}
          visible={supplierCols}
          meta={SUPPLIER_COLUMN_META}
          onToggle={toggleSupplierCol}
          onMove={moveSupplierCol}
          onReset={resetSupplierCols}
          onClose={() => setColsOpen(false)}
        />
      )}

      <Drawer
        open={drawerId !== null}
        onClose={() => setDrawerId(null)}
        width="max-w-xl"
        title={drawerId === 'new' ? 'Add Supplier' : 'Edit Supplier'}
        subtitle={drawerId === 'new' ? undefined : editing?.name}
      >
        <SupplierForm
          asDrawer
          initial={editing}
          onSave={async (s) => {
            // Closes only once saved; a refusal keeps the form open as typed.
            const ok = drawerId === 'new' ? !!(await add(s)) : await update(s.id, s);
            if (ok) setDrawerId(null);
          }}
          onCancel={() => setDrawerId(null)}
          onDelete={
            editing
              ? async () => {
                  if (await confirm({ title: `Delete "${editing.name}"?`, variant: 'destructive' })) {
                    if (await remove(editing.id)) setDrawerId(null);
                  }
                }
              : undefined
          }
        />
      </Drawer>

      <PaySupplierModal open={!!payFor} onClose={() => setPayFor(null)} supplierId={payFor} />
    </div>
  );
}

function SupplierCell({ col, s }: { col: SupplierColumn; s: Supplier }) {
  const align = SUPPLIER_COLUMN_META[col].align === 'right' ? 'text-right tabular' : '';
  switch (col) {
    case 'avatar':
      return (
        <td className="px-3 py-3">
          <Avatar name={s.name} size={32} variant="muted" />
        </td>
      );
    case 'name':
      return <td className="px-3 py-3 font-semibold">{s.name}</td>;
    case 'company':
      return <td className="px-3 py-3 text-muted-foreground text-sm">{s.company ?? '—'}</td>;
    case 'contactPerson':
      return <td className="px-3 py-3 text-muted-foreground text-sm">{s.contactPerson ?? '—'}</td>;
    case 'phone':
      return <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{s.phone}</td>;
    case 'email':
      return <td className="px-3 py-3 text-muted-foreground text-xs truncate max-w-[180px]">{s.email ?? '—'}</td>;
    case 'paymentTerms':
      return (
        <td className="px-3 py-3">
          {s.paymentTerms ? (
            <Badge variant="info">
              <TermsText terms={s.paymentTerms} />
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      );
    case 'leadTime':
      return (
        <td className={cn('px-3 py-3 text-muted-foreground', align)}>
          {s.leadTimeDays ? (
            <>
              <span>{s.leadTimeDays}</span> <span>days</span>
            </>
          ) : (
            '—'
          )}
        </td>
      );
    case 'totalPurchase':
      return <td className={cn('px-3 py-3', align)}>{formatBDT(s.totalPurchase, { withSymbol: false })}</td>;
    case 'totalPaid':
      return (
        <td className={cn('px-3 py-3 text-success', align)}>
          {formatBDT(s.totalPaid ?? 0, { withSymbol: false })}
        </td>
      );
    case 'due':
      return (
        <td className={cn('px-3 py-3', align)}>
          {s.due > 0 ? (
            <span className="text-destructive">{formatBDT(s.due, { withSymbol: false })}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      );
    case 'lastPurchase':
      return <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{formatDate(s.lastPurchaseAt)}</td>;
    case 'tags':
      return (
        <td className="px-3 py-3">
          <div className="flex flex-wrap gap-1">
            {(s.tags ?? []).map((t) => (
              <span
                key={t}
                className="text-xs px-1.5 py-0 rounded bg-primary/10 text-primary font-medium"
              >
                {t}
              </span>
            ))}
          </div>
        </td>
      );
  }
}
