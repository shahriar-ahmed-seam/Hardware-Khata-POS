import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, ChevronDown, ChevronUp } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useCategories } from '@/hooks/useCatalog';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

type SortKey = 'name' | 'qty' | 'revenue' | 'profit' | 'invoices';
type SortDir = 'asc' | 'desc';

interface Row {
  productId: string;
  name: string;
  sku: string;
  category: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  invoices: number;
}

/** Shape of one `reports.productSell` row. */
interface BackendSellRow {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  invoices: number;
}

/** A `products.list` row — used only to join category names client-side. */
interface BackendProductRow {
  id: string;
  sku: string;
  category_id?: string | null;
  category_name?: string | null;
}

export default function ProductSellPage() {
  const nav = useNavigate();
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Backend wiring: fetch aggregated rows for the range/branch, plus the product
  // catalog once (range-independent) to join category names client-side.
  const branchId = useBranchId(branch);
  const { data: beRows, loading, error } = useReport<BackendSellRow[]>(
    'reports.productSell',
    hasBackend() ? { range, branchId } : null,
    [range, branchId],
  );
  const { data: beProducts } = useReport<BackendProductRow[]>(
    'products.list',
    hasBackend() ? {} : null,
    [],
  );

  // Real catalog for the category filter dropdown (backend-backed).
  const categoriesQuery = useCategories();
  const categories = categoriesQuery.data ?? [];

  // Map backend rows into the page's Row shape, joining category client-side via
  // products.list, then applying the same client search + category filter.
  // NOTE: no mock/sample fallback — an empty backend result renders as empty.
  const backendRows: Row[] | null = useMemo(() => {
    if (!beRows) return null;
    const catNameById = new Map(categories.map((c) => [c.id, c.name]));
    const prodCat = new Map<string, { id?: string; name: string }>();
    for (const p of beProducts ?? []) {
      prodCat.set(p.sku, {
        id: p.category_id ?? undefined,
        name: p.category_name ?? '—',
      });
    }
    let list = beRows.map((r) => {
      const cat = prodCat.get(r.sku);
      return {
        productId: r.productId,
        name: r.name,
        sku: r.sku,
        category: cat?.name ?? catNameById.get(cat?.id ?? '') ?? '—',
        categoryId: cat?.id ?? '',
        qty: r.qty,
        revenue: r.revenue,
        cost: r.cost,
        profit: r.profit,
        marginPct: r.marginPct,
        invoices: r.invoices,
      };
    });
    if (categoryId) list = list.filter((r) => r.categoryId === categoryId);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => `${r.name} ${r.sku}`.toLowerCase().includes(t));
    }
    return list.map(({ categoryId: _omit, ...rest }) => rest);
  }, [beRows, beProducts, categories, categoryId, q]);

  const rows: Row[] = backendRows ?? [];

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc'
        ? (va as number) - (vb as number)
        : (vb as number) - (va as number);
    });
    return list;
  }, [rows, sortKey, sortDir]);

  const totals = useMemo(() => {
    return {
      qty: rows.reduce((a, r) => a + r.qty, 0),
      revenue: rows.reduce((a, r) => a + r.revenue, 0),
      profit: rows.reduce((a, r) => a + r.profit, 0),
      invoices: rows.reduce((a, r) => a + r.invoices, 0),
      products: rows.length,
    };
  }, [rows]);

  const onSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('desc');
    }
  };

  return (
    <div>
      <ReportToolbar
        title="Product Sell Report"
        subtitle={`${formatNumber(totals.products)} products · ${formatNumber(totals.qty)} units sold`}
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
        filters={
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="p-6 space-y-4 max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Products sold" value={formatNumber(totals.products)} />
          <Kpi label="Units sold" value={formatNumber(totals.qty)} />
          <Kpi label="Revenue" value={formatBDT(totals.revenue)} tone="primary" />
          <Kpi label="Profit" value={formatBDT(totals.profit)} tone="success" />
        </div>

        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search product or SKU…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_0.7fr_0.7fr_1fr_1fr_0.7fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            <SortHeader label="Product" k="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <div>Category</div>
            <SortHeader label="Qty" k="qty" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
            <SortHeader label="Invoices" k="invoices" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
            <SortHeader label="Revenue" k="revenue" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
            <SortHeader label="Profit" k="profit" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
            {/* Profit over REVENUE. The Items report's "Markup on cost" is the
                other way round (profit over cost) and reads higher for the same
                item, so the two are labelled differently on purpose. */}
            <div className="text-right">Margin on sales</div>
          </div>
          {sorted.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <Package className="size-6 mx-auto mb-2 opacity-50" />
              {loading ? 'Loading…' : error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No data in this range.'}
            </div>
          )}
          {sorted.map((r) => (
            <div
              key={r.productId}
              className="grid grid-cols-[2fr_1fr_0.7fr_0.7fr_1fr_1fr_0.7fr] gap-2 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer"
              // Real drill-down: open the product. It used to pop a native
              // "Drill: open Product …" alert, which cost the window its
              // keyboard focus and told the owner nothing.
              onClick={() => nav(`/products/${r.productId}`)}
            >
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{r.name}</div>
                <div className="text-[11px] font-mono text-muted-foreground">{r.sku}</div>
              </div>
              <div className="text-sm text-muted-foreground">{r.category}</div>
              <div className="text-sm tabular text-right">{formatNumber(r.qty)}</div>
              <div className="text-sm tabular text-right">{formatNumber(r.invoices)}</div>
              <div className="text-sm tabular text-right font-medium">{formatBDT(r.revenue)}</div>
              <div
                className={cn(
                  'text-sm tabular text-right font-medium',
                  r.profit >= 0 ? 'text-success' : 'text-destructive',
                )}
              >
                {formatBDT(r.profit)}
              </div>
              <div
                className={cn(
                  'text-sm tabular text-right font-semibold',
                  r.marginPct >= 20
                    ? 'text-success'
                    : r.marginPct >= 10
                      ? 'text-warning'
                      : 'text-destructive',
                )}
              >
                {r.marginPct.toFixed(1)}%
              </div>
            </div>
          ))}
          {sorted.length > 0 && (
            <div className="grid grid-cols-[2fr_1fr_0.7fr_0.7fr_1fr_1fr_0.7fr] gap-2 px-4 py-2.5 border-t-2 border-border bg-secondary/40 text-sm font-semibold">
              <div>Total</div>
              <div />
              <div className="tabular text-right">{formatNumber(totals.qty)}</div>
              <div className="tabular text-right">{formatNumber(totals.invoices)}</div>
              <div className="tabular text-right">{formatBDT(totals.revenue)}</div>
              <div className="tabular text-right text-success">{formatBDT(totals.profit)}</div>
              <div className="tabular text-right">
                {totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : '0.0'}%
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'success';
}) {
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label}
      </div>
      <div
        className={cn(
          'tabular font-bold text-lg mt-1',
          tone === 'primary' && 'text-primary',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </div>
    </Card>
  );
}

function SortHeader({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  align,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  align?: 'right';
}) {
  const active = sortKey === k;
  return (
    <button
      onClick={() => onSort(k)}
      className={cn(
        'inline-flex items-center gap-1 text-[10px] uppercase font-semibold tracking-[0.06em] hover:text-foreground transition',
        active ? 'text-foreground' : '',
        align === 'right' && 'justify-end',
      )}
    >
      {label}
      {active && (sortDir === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
    </button>
  );
}
