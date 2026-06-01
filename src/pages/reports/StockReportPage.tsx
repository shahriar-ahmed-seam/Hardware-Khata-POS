import { useMemo, useState } from 'react';
import { Search, Boxes } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  products as ALL_PRODUCTS,
  categories as ALL_CATEGORIES,
  brands as ALL_BRANDS,
} from '@/mocks/data';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

type StockState = '' | 'in' | 'low' | 'out';

interface StockRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  categoryEmoji?: string;
  brand: string;
  unit: string;
  stock: number;
  reorder: number;
  cost: number;
  price: number;
  valueAtCost: number;
  valueAtRetail: number;
  state: string;
  categoryId: string;
  brandId: string;
}

/** One `reports.stock` row. */
interface BackendStockRow {
  id: string;
  name: string;
  sku: string;
  cost: number;
  price: number;
  reorder_level: number;
  stock: number;
  valueAtCost: number;
  valueAtRetail: number;
  state: string;
}
interface BackendStock {
  rows: BackendStockRow[];
  totalValueAtCost: number;
  totalValueAtRetail: number;
}

/** A `products.list` row — used to join category/brand/unit client-side. */
interface BackendProductRow {
  id: string;
  category_id?: string | null;
  category_name?: string | null;
  category_emoji?: string | null;
  brand_id?: string | null;
  brand_name?: string | null;
  unit?: string | null;
}

export default function StockReportPage() {
  // Stock report is a snapshot — date range controls "as of" (mostly UI for now)
  const [range, setRange] = useState<DateRange>({ preset: 'today' });
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [stockState, setStockState] = useState<StockState>('');

  // Backend wiring: `reports.stock` takes ONLY { branchId } (no range — it's a
  // live snapshot). Join category/brand/unit client-side via products.list.
  const branchId = useBranchId(branch);
  const { data: beStock, loading, backend, error } = useReport<BackendStock>(
    'reports.stock',
    hasBackend() ? { branchId } : null,
    [branchId],
  );
  const { data: beProducts } = useReport<BackendProductRow[]>(
    'products.list',
    hasBackend() ? {} : null,
    [],
  );

  const mockRows: StockRow[] = useMemo(() => {
    let list = ALL_PRODUCTS.map((p) => {
      const cat = ALL_CATEGORIES.find((c) => c.id === p.categoryId);
      const brand = ALL_BRANDS.find((b) => b.id === p.brandId);
      const state =
        p.stock <= 0 ? 'out' : p.stock <= p.reorderLevel ? 'low' : 'in';
      const valueAtCost = p.cost * p.stock;
      const valueAtRetail = p.price * p.stock;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: cat?.name ?? '—',
        categoryEmoji: cat?.emoji,
        brand: brand?.name ?? '—',
        unit: p.unit,
        stock: p.stock,
        reorder: p.reorderLevel,
        cost: p.cost,
        price: p.price,
        valueAtCost,
        valueAtRetail,
        state,
        categoryId: p.categoryId ?? '',
        brandId: p.brandId ?? '',
      };
    });
    if (categoryId) list = list.filter((r) => r.categoryId === categoryId);
    if (brandId) list = list.filter((r) => r.brandId === brandId);
    if (stockState) list = list.filter((r) => r.state === stockState);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => `${r.name} ${r.sku}`.toLowerCase().includes(t));
    }
    return list;
  }, [q, categoryId, brandId, stockState]);

  // Map backend snapshot rows; join category/brand/unit client-side, derive the
  // same display fields, then apply the page's client filters.
  const backendRows: StockRow[] | null = useMemo(() => {
    if (!backend || !beStock) return null;
    const prodMeta = new Map<string, BackendProductRow>();
    for (const p of beProducts ?? []) prodMeta.set(p.id, p);
    let list = beStock.rows.map((r) => {
      const meta = prodMeta.get(r.id);
      return {
        id: r.id,
        sku: r.sku,
        name: r.name,
        category: meta?.category_name ?? '—',
        categoryEmoji: meta?.category_emoji ?? undefined,
        brand: meta?.brand_name ?? '—',
        unit: meta?.unit ?? 'pc',
        stock: r.stock,
        reorder: r.reorder_level,
        cost: r.cost,
        price: r.price,
        valueAtCost: r.valueAtCost,
        valueAtRetail: r.valueAtRetail,
        state: r.state,
        categoryId: meta?.category_id ?? '',
        brandId: meta?.brand_id ?? '',
      };
    });
    if (categoryId) list = list.filter((r) => r.categoryId === categoryId);
    if (brandId) list = list.filter((r) => r.brandId === brandId);
    if (stockState) list = list.filter((r) => r.state === stockState);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => `${r.name} ${r.sku}`.toLowerCase().includes(t));
    }
    return list;
  }, [backend, beStock, beProducts, q, categoryId, brandId, stockState]);

  const rows: StockRow[] = backend && error ? [] : (backendRows ?? mockRows);

  const totals = useMemo(
    () => ({
      products: rows.length,
      units: rows.reduce((a, r) => a + r.stock, 0),
      valueAtCost: rows.reduce((a, r) => a + r.valueAtCost, 0),
      valueAtRetail: rows.reduce((a, r) => a + r.valueAtRetail, 0),
      low: rows.filter((r) => r.state === 'low').length,
      out: rows.filter((r) => r.state === 'out').length,
    }),
    [rows],
  );

  return (
    <div>
      <ReportToolbar
        title="Stock Report"
        subtitle={`${formatNumber(totals.products)} products · ${formatBDT(totals.valueAtCost)} at cost`}
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
        filters={
          <>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="">All categories</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="">All brands</option>
              {ALL_BRANDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              value={stockState}
              onChange={(e) => setStockState(e.target.value as StockState)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="">All stock</option>
              <option value="in">In stock</option>
              <option value="low">Low</option>
              <option value="out">Out</option>
            </select>
          </>
        }
      />

      <div className="p-6 space-y-4 max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Kpi label="Products" value={formatNumber(totals.products)} />
          <Kpi label="Units" value={formatNumber(totals.units)} />
          <Kpi label="Value @ cost" value={formatBDT(totals.valueAtCost)} tone="warning" />
          <Kpi label="Value @ retail" value={formatBDT(totals.valueAtRetail)} tone="primary" />
          <Kpi label="Low" value={formatNumber(totals.low)} />
          <Kpi label="Out" value={formatNumber(totals.out)} tone="destructive" />
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
          <div className="grid grid-cols-[2fr_1fr_0.8fr_0.7fr_0.7fr_0.9fr_0.9fr_0.7fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            <div>Product</div>
            <div>Category</div>
            <div>Brand</div>
            <div className="text-right">Stock</div>
            <div className="text-right">Reorder</div>
            <div className="text-right">Cost</div>
            <div className="text-right">Retail</div>
            <div className="text-right">Status</div>
          </div>
          {rows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <Boxes className="size-6 mx-auto mb-2 opacity-50" />
              {backend && loading ? 'Loading…' : backend && error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No products match.'}
            </div>
          )}
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[2fr_1fr_0.8fr_0.7fr_0.7fr_0.9fr_0.9fr_0.7fr] gap-2 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{r.name}</div>
                <div className="text-[11px] font-mono text-muted-foreground">{r.sku}</div>
              </div>
              <div className="text-muted-foreground">
                {r.categoryEmoji} {r.category}
              </div>
              <div className="text-muted-foreground">{r.brand}</div>
              <div
                className={cn(
                  'tabular text-right font-medium',
                  r.state === 'out' && 'text-destructive',
                  r.state === 'low' && 'text-warning',
                )}
              >
                {formatNumber(r.stock)} {r.unit}
              </div>
              <div className="tabular text-right text-muted-foreground">
                {formatNumber(r.reorder)}
              </div>
              <div className="tabular text-right">{formatBDT(r.cost)}</div>
              <div className="tabular text-right">{formatBDT(r.price)}</div>
              <div className="text-right">
                {r.state === 'out' && <Badge variant="destructive">Out</Badge>}
                {r.state === 'low' && <Badge variant="warning">Low</Badge>}
                {r.state === 'in' && <Badge variant="success">In</Badge>}
              </div>
            </div>
          ))}
          {rows.length > 0 && (
            <div className="grid grid-cols-[2fr_1fr_0.8fr_0.7fr_0.7fr_0.9fr_0.9fr_0.7fr] gap-2 px-4 py-2.5 border-t-2 border-border bg-secondary/40 text-sm font-semibold">
              <div>Total</div>
              <div />
              <div />
              <div className="tabular text-right">{formatNumber(totals.units)}</div>
              <div />
              <div className="tabular text-right">{formatBDT(totals.valueAtCost)}</div>
              <div className="tabular text-right">{formatBDT(totals.valueAtRetail)}</div>
              <div />
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
  tone?: 'primary' | 'success' | 'warning' | 'destructive';
}) {
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label}
      </div>
      <div
        className={cn(
          'tabular font-bold text-base mt-1',
          tone === 'primary' && 'text-primary',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </div>
    </Card>
  );
}
