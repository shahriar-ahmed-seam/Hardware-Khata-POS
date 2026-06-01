import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Settings2,
  Upload,
  Download,
  LayoutGrid,
  List,
  Edit2,
  Trash2,
  HandCoins,
  MessageSquare,
  Eye,
  AlertTriangle,
  Phone,
  Mail,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { ColumnsPanel } from '@/components/ui/ColumnsPanel';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useCustomers } from '@/stores/contacts';
import {
  ALL_CUSTOMER_COLUMNS,
  CUSTOMER_COLUMN_META,
  useContactsUI,
  type CustomerColumn,
} from '@/stores/contactsUI';
import type { Customer } from '@/mocks/data';
import { formatBDT, cn, relativeTime } from '@/lib/utils';
import { hasBackend } from '@/lib/api';
import { Avatar } from '@/components/contacts/Avatar';
import { CustomerForm } from '@/components/contacts/CustomerForm';
import { ReceivePaymentModal } from '@/components/contacts/ReceivePaymentModal';

export default function Customers() {
  const nav = useNavigate();
  const { items, add, update, remove } = useCustomers();
  const loading = useCustomers((s) => s.loading);
  const hydrate = useCustomers((s) => s.hydrate);
  const backend = hasBackend();
  // Mirror Purchases.tsx: hydrate from the backend on mount so the store is
  // populated when this page is the entry point.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  const {
    customerView,
    setCustomerView,
    customerCols,
    toggleCustomerCol,
    moveCustomerCol,
    resetCustomerCols,
  } = useContactsUI();

  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [group, setGroup] = useState<string | 'all'>('all');
  const [dueFilter, setDueFilter] = useState<'all' | 'has' | 'none' | 'over'>('all');
  const [tag, setTag] = useState<string | 'all'>('all');
  const [colsOpen, setColsOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string | 'new' | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((c) => c.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (q && !`${c.name} ${c.phone} ${c.email ?? ''}`.toLowerCase().includes(q.toLowerCase()))
        return false;
      if (group !== 'all' && c.group !== group) return false;
      if (dueFilter === 'has' && c.due === 0) return false;
      if (dueFilter === 'none' && c.due > 0) return false;
      if (dueFilter === 'over' && (!c.creditLimit || c.due < c.creditLimit)) return false;
      if (tag !== 'all' && !c.tags?.includes(tag)) return false;
      return true;
    });
  }, [items, q, group, dueFilter, tag]);

  const totals = {
    customers: items.length,
    revenue: items.reduce((s, c) => s + c.totalPurchase, 0),
    paid: items.reduce((s, c) => s + (c.totalPaid ?? 0), 0),
    due: items.reduce((s, c) => s + c.due, 0),
  };

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleAll = () =>
    setSelected((sel) => {
      const next = new Set(sel);
      if (allSelected) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
      return next;
    });
  const toggle = (id: string) =>
    setSelected((sel) => {
      const next = new Set(sel);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

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
        subtitle={`${totals.customers} customers · ${formatBDT(totals.due)} outstanding`}
        actions={
          <>
            <IconBtn title="Customize columns" onClick={() => setColsOpen(true)}>
              <Settings2 className="size-4" />
            </IconBtn>
            <ViewToggle value={customerView} onChange={setCustomerView} />
            <Button variant="outline" size="sm" onClick={() => nav('/contacts/customers/import')}>
              <Upload className="size-4" /> Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={() => setDrawerId('new')}>
              <Plus className="size-4" /> Add Customer
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Customers" value={String(totals.customers)} />
          <Stat label="Total Sales" value={formatBDT(totals.revenue)} />
          <Stat label="Total Paid" value={formatBDT(totals.paid)} tone="success" />
          <Stat label="Outstanding" value={formatBDT(totals.due)} tone="destructive" />
        </div>

        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, email…"
              className="pl-9"
            />
          </div>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All groups</option>
            <option value="Retail">Retail</option>
            <option value="Wholesale">Wholesale</option>
            <option value="Contractor">Contractor</option>
          </select>
          {allTags.length > 0 && (
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="all">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
            {(['all', 'has', 'none', 'over'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setDueFilter(s)}
                className={cn(
                  'px-3 py-1 rounded font-medium transition',
                  dueFilter === s
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s === 'all'
                  ? 'All'
                  : s === 'has'
                    ? 'Has Due'
                    : s === 'none'
                      ? 'No Due'
                      : 'Over Limit'}
              </button>
            ))}
          </div>
        </Card>

        {selected.size > 0 && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 flex items-center gap-2">
            <Badge variant="info">{selected.size} selected</Badge>
            <div className="flex-1" />
            <Button variant="outline" size="sm">
              <MessageSquare className="size-3.5" /> Send SMS
            </Button>
            <Button variant="outline" size="sm">
              <Download className="size-3.5" /> Export
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (!confirm(`Delete ${selected.size} customer(s)?`)) return;
                Array.from(selected).forEach(remove);
                setSelected(new Set());
              }}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}

        {backend && loading && items.length === 0 ? (
          <SkeletonTable count={8} />
        ) : customerView === 'table' ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50 sticky top-0">
                  <tr>
                    <th className="w-10 px-3 py-2.5">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                    </th>
                    {customerCols.map((c) => (
                      <th
                        key={c}
                        className={cn(
                          'font-medium px-3 py-2.5 whitespace-nowrap',
                          CUSTOMER_COLUMN_META[c].align === 'right' ? 'text-right' : 'text-left',
                        )}
                      >
                        {CUSTOMER_COLUMN_META[c].label}
                      </th>
                    ))}
                    <th className="w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className={cn(
                        'border-t border-border hover:bg-secondary/40 group',
                        selected.has(c.id) && 'bg-primary/5',
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggle(c.id)}
                        />
                      </td>
                      {customerCols.map((col) => (
                        <CustomerCell key={col} col={col} c={c} />
                      ))}
                      <td className="px-2 py-2.5">
                        <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                          <Link
                            to={`/contacts/customers/${c.id}`}
                            className="size-7 grid place-items-center rounded hover:bg-secondary"
                            title="Open profile"
                          >
                            <Eye className="size-3.5" />
                          </Link>
                          <button
                            onClick={() => setDrawerId(c.id)}
                            className="size-7 grid place-items-center rounded hover:bg-secondary"
                            title="Quick edit"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          {c.due > 0 && (
                            <button
                              onClick={() => setPayFor(c.id)}
                              className="size-7 grid place-items-center rounded hover:bg-success/10 text-success"
                              title="Receive payment"
                            >
                              <HandCoins className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={customerCols.length + 2}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        No customers match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
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
                      <Badge
                        variant={
                          c.group === 'Wholesale'
                            ? 'info'
                            : c.group === 'Contractor'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {c.group}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" /> {c.phone}
                      </span>
                      {c.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="size-3" /> {c.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Total Purchase</div>
                    <div className="text-sm font-semibold font-mono tabular">
                      {formatBDT(c.totalPurchase)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Due</div>
                    <div
                      className={cn(
                        'text-sm font-semibold font-mono tabular',
                        c.due > 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {formatBDT(c.due)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" size="sm" onClick={() => setDrawerId(c.id)}>
                    <Edit2 className="size-3.5" /> Edit
                  </Button>
                  <Button size="sm" disabled={c.due === 0} onClick={() => setPayFor(c.id)}>
                    <HandCoins className="size-3.5" /> Receive
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {colsOpen && (
        <ColumnsPanel
          all={ALL_CUSTOMER_COLUMNS}
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
        width="max-w-3xl"
        title={drawerId === 'new' ? 'Add Customer' : 'Edit Customer'}
        subtitle={drawerId === 'new' ? 'Add a new contact' : editing?.name}
      >
        <CustomerForm
          asDrawer
          initial={editing}
          onSave={(c) => {
            if (drawerId === 'new') add(c);
            else update(c.id, c);
            setDrawerId(null);
          }}
          onCancel={() => setDrawerId(null)}
          onDelete={
            editing
              ? () => {
                  if (confirm(`Delete "${editing.name}"?`)) {
                    remove(editing.id);
                    setDrawerId(null);
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
  const align = CUSTOMER_COLUMN_META[col].align === 'right' ? 'text-right font-mono tabular' : '';
  switch (col) {
    case 'avatar':
      return (
        <td className="px-3 py-2.5">
          <Avatar name={c.name} size={32} />
        </td>
      );
    case 'name':
      return (
        <td className="px-3 py-2.5">
          <div className="font-semibold">{c.name}</div>
          {c.tags && c.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {c.tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="text-[9px] px-1 py-0 rounded bg-primary/10 text-primary font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </td>
      );
    case 'phone':
      return <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{c.phone}</td>;
    case 'email':
      return <td className="px-3 py-2.5 text-muted-foreground text-xs truncate max-w-[180px]">{c.email ?? '—'}</td>;
    case 'group':
      return (
        <td className="px-3 py-2.5">
          <Badge
            variant={
              c.group === 'Wholesale' ? 'info' : c.group === 'Contractor' ? 'warning' : 'default'
            }
          >
            {c.group}
          </Badge>
        </td>
      );
    case 'address':
      return <td className="px-3 py-2.5 text-muted-foreground text-xs truncate max-w-[180px]">{c.address ?? '—'}</td>;
    case 'totalPurchase':
      return (
        <td className={cn('px-3 py-2.5', align)}>{formatBDT(c.totalPurchase, { withSymbol: false })}</td>
      );
    case 'totalPaid':
      return (
        <td className={cn('px-3 py-2.5 text-success', align)}>{formatBDT(c.totalPaid ?? 0, { withSymbol: false })}</td>
      );
    case 'due':
      return (
        <td className={cn('px-3 py-2.5', align)}>
          {c.due > 0 ? (
            <span className="text-destructive">{formatBDT(c.due, { withSymbol: false })}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      );
    case 'creditLimit': {
      if (!c.creditLimit) {
        return <td className={cn('px-3 py-2.5 text-muted-foreground', align)}>—</td>;
      }
      const usagePct = Math.min(100, Math.round((c.due / c.creditLimit) * 100));
      const over = c.due >= c.creditLimit;
      return (
        <td className={cn('px-3 py-2.5', align)}>
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
        <td className="px-3 py-2.5 text-xs text-muted-foreground">
          {c.lastSaleAt ? relativeTime(c.lastSaleAt) : '—'}
        </td>
      );
    case 'joined':
      return <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.joined}</td>;
    case 'dob':
      return <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.dob ?? '—'}</td>;
    case 'tags':
      return (
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap gap-1">
            {(c.tags ?? []).map((t) => (
              <span
                key={t}
                className="text-[10px] px-1.5 py-0 rounded bg-primary/10 text-primary font-medium"
              >
                {t}
              </span>
            ))}
          </div>
        </td>
      );
  }
}

function ViewToggle({
  value,
  onChange,
}: {
  value: 'table' | 'grid';
  onChange: (v: 'table' | 'grid') => void;
}) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
      <button
        onClick={() => onChange('table')}
        title="Table view"
        className={cn(
          'h-7 px-2 rounded inline-flex items-center gap-1 transition',
          value === 'table' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <List className="size-3.5" />
      </button>
      <button
        onClick={() => onChange('grid')}
        title="Grid view"
        className={cn(
          'h-7 px-2 rounded inline-flex items-center gap-1 transition',
          value === 'grid' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <LayoutGrid className="size-3.5" />
      </button>
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
    <Card className="p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          'text-xl font-bold mt-0.5 tabular',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </div>
    </Card>
  );
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-9 w-9 grid place-items-center rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition"
    >
      {children}
    </button>
  );
}
