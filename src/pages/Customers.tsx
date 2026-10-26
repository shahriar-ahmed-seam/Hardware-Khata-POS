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
  AlertTriangle,
  Phone,
  Mail,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { ColumnsPanel } from '@/components/ui/ColumnsPanel';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useCustomers } from '@/stores/contacts';
import { confirm } from '@/stores/confirm';
import {
  ALL_CUSTOMER_COLUMNS,
  CUSTOMER_COLUMN_META,
  useContactsUI,
  type CustomerColumn,
} from '@/stores/contactsUI';
import type { Customer } from '@/types/domain';
import { formatBDT, cn, relativeTime } from '@/lib/utils';
import { formatDate } from '@/lib/formatDate';
import { Avatar } from '@/components/contacts/Avatar';
import { CustomerForm } from '@/components/contacts/CustomerForm';
import { ReceivePaymentModal } from '@/components/contacts/ReceivePaymentModal';
import { groupLabel, groupVariant, MoneyStat, PageScopeNote, TH, ViewToggle } from '@/components/contacts/shared';

/** Columns kept out of the table: the avatar repeats the name, "Last sale" is never filled. */
const HIDDEN_COLS = new Set<CustomerColumn>(['avatar', 'lastSale']);
const PICKABLE_COLS = ALL_CUSTOMER_COLUMNS.filter((c) => !HIDDEN_COLS.has(c));

export default function Customers() {
  const nav = useNavigate();
  const exportCsv = useBackup((s) => s.exportCsv);
  const exportBusy = useBackup((s) => s.busy);
  const { items, add, update, remove } = useCustomers();
  const loading = useCustomers((s) => s.loading);
  const total = useCustomers((s) => s.total);
  const query = useCustomers((s) => s.query);
  const loadPage = useCustomers((s) => s.loadPage);
  const {
    customerView,
    setCustomerView,
    customerCols: savedCols,
    toggleCustomerCol,
    moveCustomerCol,
    resetCustomerCols,
  } = useContactsUI();
  const customerCols = savedCols.filter((c) => !HIDDEN_COLS.has(c));

  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [group, setGroup] = useState<string | 'all'>('all');
  const [dueFilter, setDueFilter] = useState<'all' | 'has' | 'none' | 'over'>('all');
  const [tag, setTag] = useState<string | 'all'>('all');
  const [colsOpen, setColsOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string | 'new' | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);

  // Load ONE page on mount (replaces the old full-table hydrate). Every filter
  // this screen owns is stated explicitly so a query left behind by an earlier
  // visit can't silently narrow the list while the controls all read "all".
  const initialQ = useRef(q);
  useEffect(() => {
    void loadPage({ page: 1, q: initialQ.current.trim() || undefined, group: undefined });
  }, [loadPage]);

  // Free-text search hits the DATABASE (name + phone + email), so it is debounced
  // ~300ms. The first run is skipped because the mount effect already loaded.
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

  // Tags are a JSON column with no server-side filter, so the option list is
  // built from THIS PAGE's rows (and the filter below applies to it too).
  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((c) => c.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  /**
   * Server already narrowed by text + group. Due state and tags are DERIVED
   * (due/creditLimit are computed, tags are JSON), so they cannot be pushed into
   * SQL — they stay CLIENT-side over the rows of the current page.
   */
  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (dueFilter === 'has' && c.due === 0) return false;
      if (dueFilter === 'none' && c.due > 0) return false;
      if (dueFilter === 'over' && (!c.creditLimit || c.due < c.creditLimit)) return false;
      if (tag !== 'all' && !c.tags?.includes(tag)) return false;
      return true;
    });
  }, [items, dueFilter, tag]);

  // These sums cover the LOADED PAGE only — the rest of the range was never
  // fetched. PageScopeNote says so when the page is not the whole list.
  const totals = useMemo(
    () => ({
      revenue: filtered.reduce((s, c) => s + c.totalPurchase, 0),
      paid: filtered.reduce((s, c) => s + (c.totalPaid ?? 0), 0),
      due: filtered.reduce((s, c) => s + c.due, 0),
    }),
    [filtered],
  );

  const editing =
    drawerId === 'new'
      ? undefined
      : drawerId
        ? items.find((c) => c.id === drawerId)
        : undefined;

  return (
    <div>
      <PageHeader
        title="Customers"
        actions={
          <>
            <IconButton variant="outline" label="Customize columns" onClick={() => setColsOpen(true)}>
              <Settings2 className="size-4" />
            </IconButton>
            <ViewToggle value={customerView} onChange={setCustomerView} />
            {/* Import is switched off until real importers exist (see /import). */}
            <Button
              variant="outline"
              disabled={exportBusy}
              onClick={() => void exportCsv('customers')}
              title="Write every customer to a CSV file in your backup folder"
            >
              <Download className="size-4" /> Export all
            </Button>
            <Button onClick={() => setDrawerId('new')}>
              <Plus className="size-4" /> Add Customer
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
              label="Outstanding"
              value={formatBDT(totals.due)}
              tone={totals.due > 0 ? 'destructive' : undefined}
            />
            <MoneyStat label="Total Sales" value={formatBDT(totals.revenue)} />
            <MoneyStat label="Total Paid" value={formatBDT(totals.paid)} tone="success" />
          </div>
        </div>

        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, email…"
              className="pl-9"
              aria-label="Search customers"
            />
          </div>
          <Select
            value={group}
            onChange={(e) => {
              setGroup(e.target.value);
              void loadPage({ group: e.target.value });
            }}
            className="w-auto"
            aria-label="Group"
          >
            <option value="all">All groups</option>
            {(['Retail', 'Wholesale', 'Contractor'] as const).map((g) => (
              <option key={g} value={g}>
                {groupLabel(g)}
              </option>
            ))}
          </Select>
          {allTags.length > 0 && (
            <Select value={tag} onChange={(e) => setTag(e.target.value)} className="w-auto" aria-label="Tags">
              <option value="all">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
          <Segmented
            ariaLabel="Due"
            value={dueFilter}
            onChange={setDueFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'has', label: 'Has Due' },
              { value: 'none', label: 'No Due' },
              { value: 'over', label: 'Over Limit' },
            ]}
          />
        </Card>

        {/* Skeleton while the backend list loads; empty state handles no rows. */}
        {loading && items.length === 0 ? (
          <SkeletonTable count={8} />
        ) : customerView === 'table' ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 sticky top-0">
                  <tr>
                    {customerCols.map((c) => (
                      <th
                        key={c}
                        className={cn(
                          TH,
                          CUSTOMER_COLUMN_META[c].align === 'right' ? 'text-right' : 'text-left',
                        )}
                      >
                        {CUSTOMER_COLUMN_META[c].label}
                      </th>
                    ))}
                    <th className={cn(TH, 'w-32')}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      // The whole row opens the khata.
                      onClick={() => nav(`/contacts/customers/${c.id}`)}
                      className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                    >
                      {customerCols.map((col) => (
                        <CustomerCell key={col} col={col} c={c} />
                      ))}
                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        {/* Rendered (invisible) at zero due so the column keeps its place. */}
                        <Button
                          variant="outline"
                          onClick={() => setPayFor(c.id)}
                          className={cn(c.due > 0 ? '' : 'invisible')}
                          tabIndex={c.due > 0 ? 0 : -1}
                        >
                          <HandCoins className="size-4 text-success" /> Receive
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={customerCols.length + 1}>
                        <EmptyState
                          compact
                          title="No customers match these filters."
                          message="Clear the search or the filters, or add a new customer."
                        />
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
              label="customers"
              busy={loading}
            />
          </Card>
        ) : (
          <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((c) => (
              <Card
                key={c.id}
                className="p-4 hover:shadow-md transition cursor-pointer"
                onClick={() => nav(`/contacts/customers/${c.id}`)}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={c.name} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">{c.name}</div>
                      <Badge variant={groupVariant(c.group)}>{groupLabel(c.group)}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Phone className="size-3.5" /> {c.phone}
                      </span>
                      {c.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="size-3.5" /> {c.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border">
                  <div>
                    <div className="text-xs text-muted-foreground">Total Purchase</div>
                    <div className="text-sm font-semibold tabular">
                      {formatBDT(c.totalPurchase)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Due</div>
                    <div
                      className={cn(
                        'text-sm font-semibold tabular',
                        c.due > 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {formatBDT(c.due)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" onClick={() => setDrawerId(c.id)}>
                    <Edit2 className="size-4" /> Edit
                  </Button>
                  <Button disabled={c.due === 0} onClick={() => setPayFor(c.id)}>
                    <HandCoins className="size-4" /> Receive
                  </Button>
                </div>
              </Card>
            ))}
            {filtered.length === 0 && (
              <Card className="md:col-span-2 xl:col-span-3">
                <EmptyState
                  compact
                  title="No customers match these filters."
                  message="Clear the search or the filters, or add a new customer."
                />
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
              label="customers"
              busy={loading}
            />
          </Card>
          </div>
        )}
      </div>

      {colsOpen && (
        <ColumnsPanel
          all={PICKABLE_COLS}
          visible={customerCols}
          meta={CUSTOMER_COLUMN_META}
          onToggle={toggleCustomerCol}
          onMove={moveCustomerCol}
          onReset={resetCustomerCols}
          onClose={() => setColsOpen(false)}
        />
      )}

      <Drawer
        open={drawerId !== null}
        onClose={() => setDrawerId(null)}
        width="max-w-xl"
        title={drawerId === 'new' ? 'Add Customer' : 'Edit Customer'}
        subtitle={drawerId === 'new' ? undefined : editing?.name}
      >
        <CustomerForm
          asDrawer
          initial={editing}
          onSave={async (c) => {
            // Closes only once saved; a refusal keeps the form open as typed.
            const ok = drawerId === 'new' ? !!(await add(c)) : await update(c.id, c);
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

      <ReceivePaymentModal
        open={!!payFor}
        onClose={() => setPayFor(null)}
        customerId={payFor}
      />
    </div>
  );
}

function CustomerCell({ col, c }: { col: CustomerColumn; c: Customer }) {
  const align = CUSTOMER_COLUMN_META[col].align === 'right' ? 'text-right tabular' : '';
  switch (col) {
    case 'avatar':
      return (
        <td className="px-3 py-3">
          <Avatar name={c.name} size={32} />
        </td>
      );
    case 'name':
      return (
        <td className="px-3 py-3">
          <div className="font-semibold">{c.name}</div>
          {c.tags && c.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {c.tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="text-xs px-1 py-0 rounded bg-primary/10 text-primary font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </td>
      );
    case 'phone':
      return <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{c.phone}</td>;
    case 'email':
      return <td className="px-3 py-3 text-muted-foreground text-xs truncate max-w-[180px]">{c.email ?? '—'}</td>;
    case 'group':
      return (
        <td className="px-3 py-3">
          <Badge variant={groupVariant(c.group)}>{groupLabel(c.group)}</Badge>
        </td>
      );
    case 'address':
      return <td className="px-3 py-3 text-muted-foreground text-xs truncate max-w-[180px]">{c.address ?? '—'}</td>;
    case 'totalPurchase':
      return (
        <td className={cn('px-3 py-3', align)}>{formatBDT(c.totalPurchase, { withSymbol: false })}</td>
      );
    case 'totalPaid':
      return (
        <td className={cn('px-3 py-3 text-success', align)}>{formatBDT(c.totalPaid ?? 0, { withSymbol: false })}</td>
      );
    case 'due':
      return (
        <td className={cn('px-3 py-3', align)}>
          {c.due > 0 ? (
            <span className="text-destructive">{formatBDT(c.due, { withSymbol: false })}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      );
    case 'creditLimit': {
      if (!c.creditLimit) {
        return <td className={cn('px-3 py-3 text-muted-foreground', align)}>—</td>;
      }
      const usagePct = Math.min(100, Math.round((c.due / c.creditLimit) * 100));
      const over = c.due >= c.creditLimit;
      return (
        <td className={cn('px-3 py-3', align)}>
          <div className="flex items-center justify-end gap-1.5">
            {over && <AlertTriangle className="size-3 text-destructive" />}
            <span className={over ? 'text-destructive font-semibold' : ''}>
              {formatBDT(c.creditLimit, { withSymbol: false })}
            </span>
          </div>
          <div className="h-1 mt-1 bg-secondary rounded">
            <div
              className={cn(
                'h-full rounded',
                over ? 'bg-destructive' : usagePct > 70 ? 'bg-warning' : 'bg-primary',
              )}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </td>
      );
    }
    case 'lastSale':
      return (
        <td className="px-3 py-3 text-xs text-muted-foreground">
          {c.lastSaleAt ? relativeTime(c.lastSaleAt) : '—'}
        </td>
      );
    case 'joined':
      return <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{formatDate(c.joined)}</td>;
    case 'dob':
      return <td className="px-3 py-3 text-xs text-muted-foreground">{c.dob ?? '—'}</td>;
    case 'tags':
      return (
        <td className="px-3 py-3">
          <div className="flex flex-wrap gap-1">
            {(c.tags ?? []).map((t) => (
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
