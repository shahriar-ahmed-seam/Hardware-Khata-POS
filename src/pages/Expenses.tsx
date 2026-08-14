import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Settings2,
  Upload,
  Download,
  Trash2,
  Repeat,
  Paperclip,
  Edit2,
  ListTree,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ColumnsPanel } from '@/components/ui/ColumnsPanel';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { useExpenses, categoryPath, type ExpenseRecord } from '@/stores/expenses';
import {
  ALL_EXPENSE_COLUMNS,
  EXPENSE_COLUMN_META,
  useExpensesUI,
  type ExpenseColumn,
} from '@/stores/expensesUI';
import { confirm } from '@/stores/confirm';
import { formatBDT, formatNumber, cn } from '@/lib/utils';
import { hasBackend } from '@/lib/api';
import { AddExpenseDrawer } from '@/components/expenses/AddExpenseDrawer';
import { NumberField } from '@/components/ui/NumberField';

type DateFilter = 'all' | 'today' | 'week' | 'month';

/** `YYYY-MM-DD` for a local date. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Turn a date preset into inclusive bounds for the server query.
 *
 * Expense dates are stored either as full ISO (seeds) or as the drawer's
 * `YYYY-MM-DDTHH:MM` (datetime-local), so the bounds are deliberately built at
 * day granularity — a date-only lower bound sorts before any time-of-day on that
 * day, and `T23:59:59.999` sorts after it. This makes the chips calendar-based
 * (today / last 7 days / last 30 days) rather than the old rolling-millisecond
 * windows, which is what the labels always implied.
 */
function presetToRange(preset: DateFilter): { from?: string; to?: string } {
  if (preset === 'all') return { from: undefined, to: undefined };
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'week') start.setDate(start.getDate() - 6);
  if (preset === 'month') start.setDate(start.getDate() - 29);
  return { from: ymd(start), to: `${ymd(now)}T23:59:59.999` };
}

export default function Expenses() {
  const nav = useNavigate();
  const expenses = useExpenses((s) => s.expenses);
  const cats = useExpenses((s) => s.categories);
  const removeExpense = useExpenses((s) => s.deleteExpense);
  const loading = useExpenses((s) => s.loading);
  const total = useExpenses((s) => s.total);
  const query = useExpenses((s) => s.query);
  const loadPage = useExpenses((s) => s.loadPage);
  const loadCategories = useExpenses((s) => s.loadCategories);
  const { columns, toggle, move, reset } = useExpensesUI();
  const backend = hasBackend();

  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');
  const [method, setMethod] = useState<string | 'all'>('all');
  const [minAmt, setMinAmt] = useState(0);
  const [maxAmt, setMaxAmt] = useState(0);
  const [dateRange, setDateRange] = useState<DateFilter>('all');
  const [colsOpen, setColsOpen] = useState(false);
  const [drawerInitial, setDrawerInitial] = useState<ExpenseRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Load ONE page + the (small) category reference list on mount. Replaces the
  // old full-table hydrate. No-op without a backend.
  useEffect(() => {
    void loadPage({ page: 1, categoryId: undefined, method: undefined, from: undefined, to: undefined });
    void loadCategories();
  }, [loadPage, loadCategories]);

  // Free-text search hits the DATABASE (ref, note, category name), so it is
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

  /**
   * Server already narrowed by text / category / method / date range and ordered
   * by date DESC, and voided rows never come back. Only the amount range has no
   * server-side field, so it stays CLIENT-side over the rows of this page.
   */
  const filtered = useMemo(() => {
    if (minAmt <= 0 && maxAmt <= 0) return expenses;
    return expenses.filter((e) => {
      if (minAmt > 0 && e.amount < minAmt) return false;
      if (maxAmt > 0 && e.amount > maxAmt) return false;
      return true;
    });
  }, [expenses, minAmt, maxAmt]);

  // These sums cover the LOADED PAGE only — the rest of the range was never
  // fetched. Labelled "this page" in the UI; Reports has the full figures.
  const totals = useMemo(
    () => ({
      count: filtered.length,
      total: filtered.reduce((s, e) => s + e.amount, 0),
      cash: filtered.filter((e) => e.paymentMethod === 'Cash').reduce((s, e) => s + e.amount, 0),
      nonCash: filtered
        .filter((e) => e.paymentMethod !== 'Cash')
        .reduce((s, e) => s + e.amount, 0),
    }),
    [filtered],
  );

  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const toggleAll = () =>
    setSelected((sel) => {
      const next = new Set(sel);
      if (allSelected) filtered.forEach((e) => next.delete(e.id));
      else filtered.forEach((e) => next.add(e.id));
      return next;
    });
  const toggleOne = (id: string) =>
    setSelected((sel) => {
      const next = new Set(sel);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={`${formatNumber(total)} expenses`}
        actions={
          <>
            <IconBtn title="Customize columns" onClick={() => setColsOpen(true)}>
              <Settings2 className="size-4" />
            </IconBtn>
            <Button variant="outline" size="sm" onClick={() => nav('/expenses/categories')}>
              <ListTree className="size-4" /> Categories
            </Button>
            <Button variant="outline" size="sm" onClick={() => nav('/expenses/import')}>
              <Upload className="size-4" /> Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="size-4" /> Export
            </Button>
            <Button
              onClick={() => {
                setDrawerInitial(null);
                setDrawerOpen(true);
              }}
            >
              <Plus className="size-4" /> Add Expense
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        {/* KPI strip — PAGE-SCOPED. The old "This month" / "This year" stats were
            dropped: they summed whatever rows happened to be loaded, which is no
            longer the whole table, and a page-scoped year total is just wrong.
            Reports owns full-range figures. */}
        <div>
          <div className="text-[11px] text-muted-foreground mb-1.5">
            Totals for this page only. Use Reports for full-range figures.
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Count (this page)" value={String(totals.count)} />
            <Stat label="Total (this page)" value={formatBDT(totals.total)} tone="primary" />
            <Stat label="Cash (this page)" value={formatBDT(totals.cash)} />
            <Stat label="Non-cash (this page)" value={formatBDT(totals.nonCash)} />
          </div>
        </div>

        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Note, reference…"
              className="pl-9"
            />
          </div>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              void loadPage({ categoryId: e.target.value });
            }}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All categories</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji ? c.emoji + ' ' : ''}
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              void loadPage({ method: e.target.value });
            }}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All methods</option>
            {['Cash', 'bKash', 'Nagad', 'Card', 'Bank', 'Cheque'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
            {(['all', 'today', 'week', 'month'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setDateRange(s);
                  void loadPage(presetToRange(s));
                }}
                className={cn(
                  'px-3 py-1 rounded font-medium capitalize transition',
                  dateRange === s
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <NumberField
              value={minAmt}
              onChangeNumber={setMinAmt}
              placeholder="Min"
              className="h-9 w-24 text-right"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <NumberField
              value={maxAmt}
              onChangeNumber={setMaxAmt}
              placeholder="Max"
              className="h-9 w-24 text-right"
            />
            <span className="text-[11px] text-muted-foreground">Amount filters this page</span>
          </div>
        </Card>

        {selected.size > 0 && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 flex items-center gap-2">
            <Badge variant="info">{selected.size} selected</Badge>
            <div className="flex-1" />
            <Button variant="outline" size="sm">
              <Download className="size-3.5" /> Export
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (
                  await confirm({
                    title: `Delete ${selected.size} expense(s)?`,
                    variant: 'destructive',
                  })
                ) {
                  Array.from(selected).forEach(removeExpense);
                  setSelected(new Set());
                }
              }}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            {backend && loading && expenses.length === 0 ? (
              <div className="p-4">
                <SkeletonTable count={8} />
              </div>
            ) : (
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50 sticky top-0">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  {columns.map((c) => (
                    <th
                      key={c}
                      className={cn(
                        'font-medium px-3 py-2.5 whitespace-nowrap',
                        EXPENSE_COLUMN_META[c].align === 'right' ? 'text-right' : 'text-left',
                      )}
                    >
                      {EXPENSE_COLUMN_META[c].label}
                    </th>
                  ))}
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className={cn(
                      'border-t border-border hover:bg-secondary/40 group',
                      selected.has(e.id) && 'bg-primary/5',
                    )}
                  >
                    <td className="px-3 py-2.5" onClick={(ev) => ev.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggleOne(e.id)}
                      />
                    </td>
                    {columns.map((c) => (
                      <Cell key={c} c={c} e={e} cats={cats} />
                    ))}
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                        <button
                          onClick={() => {
                            setDrawerInitial(e);
                            setDrawerOpen(true);
                          }}
                          className="size-7 grid place-items-center rounded hover:bg-secondary"
                          title="Edit"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length + 2}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No expenses match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            )}
          </div>
          <Pagination
            page={query.page}
            pageSize={query.pageSize}
            total={total}
            onPageChange={(page) => void loadPage({ page })}
            onPageSizeChange={(pageSize) => void loadPage({ pageSize })}
            label="expenses"
            busy={loading}
          />
        </Card>
      </div>

      <AddExpenseDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerInitial(null);
        }}
        initial={drawerInitial ?? undefined}
      />

      {colsOpen && (
        <ColumnsPanel
          all={ALL_EXPENSE_COLUMNS}
          visible={columns}
          meta={EXPENSE_COLUMN_META}
          onToggle={toggle}
          onMove={move}
          onReset={reset}
          onClose={() => setColsOpen(false)}
        />
      )}
    </div>
  );
}

function Cell({
  c,
  e,
  cats,
}: {
  c: ExpenseColumn;
  e: ExpenseRecord;
  cats: { id: string; name: string; parentId?: string; emoji?: string }[];
}) {
  const align = EXPENSE_COLUMN_META[c].align === 'right' ? 'text-right font-mono tabular' : '';
  switch (c) {
    case 'date':
      return (
        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
          {new Date(e.date).toLocaleDateString('en-GB')}
        </td>
      );
    case 'ref':
      return <td className="px-3 py-2.5 font-mono text-xs">{e.refNo ?? '—'}</td>;
    case 'category': {
      const cat = cats.find((x) => x.id === e.categoryId);
      return (
        <td className="px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-sm">
            {cat?.emoji && <span>{cat.emoji}</span>}
            <span>{categoryPath(cats as any, e.categoryId)}</span>
          </span>
        </td>
      );
    }
    case 'note':
      return (
        <td className="px-3 py-2.5 max-w-[280px] truncate" title={e.note}>
          {e.note ?? '—'}
        </td>
      );
    case 'amount':
      return (
        <td className={cn('px-3 py-2.5 font-semibold', align)}>
          {formatBDT(e.amount, { withSymbol: false })}
        </td>
      );
    case 'method':
      return (
        <td className="px-3 py-2.5">
          <Badge variant={e.paymentMethod === 'Cash' ? 'default' : 'info'}>{e.paymentMethod}</Badge>
        </td>
      );
    case 'reference':
      return (
        <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
          {e.reference ?? '—'}
        </td>
      );
    case 'branch':
      return <td className="px-3 py-2.5 text-xs text-muted-foreground">{e.branch}</td>;
    case 'user':
      return <td className="px-3 py-2.5 text-xs text-muted-foreground">{e.user}</td>;
    case 'attachment':
      return (
        <td className="px-3 py-2.5">
          {e.attachmentName ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={e.attachmentName}>
              <Paperclip className="size-3" /> attached
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      );
    case 'recurring':
      return (
        <td className="px-3 py-2.5">
          {e.recurring ? (
            <Badge variant="info">
              <Repeat className="size-3" /> {e.frequency}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      );
  }
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'primary';
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn('text-lg font-bold mt-0.5 tabular', tone === 'primary' && 'text-primary')}>
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
