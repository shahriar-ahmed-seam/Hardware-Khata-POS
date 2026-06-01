import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Flame, Package } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  resolveRange,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useSales } from '@/stores/sales';
import { products as ALL_PRODUCTS, categories as ALL_CATEGORIES } from '@/mocks/data';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

type Metric = 'qty' | 'revenue';

interface TrendRow {
  productId: string;
  name: string;
  sku: string;
  category: string;
  current: number;
  previous: number;
  deltaPct: number;
  trend14: number[]; // 14-point sparkline
}

/** One `reports.trending` row. */
interface BackendTrendRow {
  productId: string;
  name: string;
  sku: string;
  current: number;
  previous: number;
  deltaPct: number;
}

/** A `products.list` row — used only to join category names client-side. */
interface BackendProductRow {
  id: string;
  sku: string;
  category_id?: string | null;
  category_name?: string | null;
}

export default function TrendingPage() {
  const sales = useSales((s) => s.sales);
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [metric, setMetric] = useState<Metric>('qty');
  const [categoryId, setCategoryId] = useState('');

  // Backend wiring: pass the metric toggle through to the channel; join category
  // names client-side via products.list (fetched once).
  const branchId = useBranchId(branch);
  const { data: beRows, loading, backend, error } = useReport<BackendTrendRow[]>(
    'reports.trending',
    hasBackend() ? { range, branchId, metric } : null,
    [range, branchId, metric],
  );
  const { data: beProducts } = useReport<BackendProductRow[]>(
    'products.list',
    hasBackend() ? {} : null,
    [],
  );

  const mockRows = useMemo(() => {
    const { from, to } = resolveRange(range);
    const periodMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodMs);
    const prevTo = new Date(from.getTime() - 1);

    const acc = new Map<string, TrendRow>();

    const accumulate = (start: Date, end: Date, target: 'current' | 'previous') => {
      for (const sale of sales) {
        if (sale.status !== 'final') continue;
        if (branch && sale.branch !== branch) continue;
        const t = new Date(sale.date).getTime();
        if (t < start.getTime() || t > end.getTime()) continue;
        for (const line of sale.lines) {
          const product = ALL_PRODUCTS.find((p) => p.sku === line.sku || p.id === line.productId);
          const productId = product?.id ?? line.productId;
          const cat = product
            ? ALL_CATEGORIES.find((c) => c.id === product.categoryId)
            : undefined;
          if (categoryId && cat?.id !== categoryId) continue;
          const value =
            metric === 'qty'
              ? line.qty
              : line.unitPrice * line.qty * (1 - line.discountPct / 100) - line.discountFlat;
          let row = acc.get(productId);
          if (!row) {
            row = {
              productId,
              name: product?.name ?? line.name,
              sku: line.sku,
              category: cat?.name ?? '—',
              current: 0,
              previous: 0,
              deltaPct: 0,
              trend14: new Array(14).fill(0),
            };
            acc.set(productId, row);
          }
          row[target] += value;
          // sparkline based on the current period: bucket into 14 even slices
          if (target === 'current') {
            const periodTotal = to.getTime() - from.getTime();
            if (periodTotal > 0) {
              const idx = Math.min(13, Math.floor(((t - from.getTime()) / periodTotal) * 14));
              row.trend14[idx] += value;
            }
          }
        }
      }
    };

    accumulate(from, to, 'current');
    accumulate(prevFrom, prevTo, 'previous');

    const list = Array.from(acc.values()).filter((r) => r.current > 0);
    list.forEach((r) => {
      r.deltaPct = r.previous > 0 ? ((r.current - r.previous) / r.previous) * 100 : r.current > 0 ? 100 : 0;
    });
    list.sort((a, b) => b.current - a.current);
    return list.slice(0, 50);
  }, [sales, range, branch, metric, categoryId]);

  // Map backend rows; join category client-side and apply the category filter.
  // The backend doesn't return a per-bucket sparkline, so trend14 stays empty
  // (the Sparkline renders a flat baseline) when backed — DEFERRED.
  const backendRows: TrendRow[] | null = useMemo(() => {
    if (!backend || !beRows) return null;
    const catNameById = new Map(ALL_CATEGORIES.map((c) => [c.id, c.name]));
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
        current: r.current,
        previous: r.previous,
        deltaPct: r.deltaPct,
        trend14: new Array(14).fill(0) as number[],
      };
    });
    if (categoryId) list = list.filter((r) => r.categoryId === categoryId);
    return list.map(({ categoryId: _omit, ...rest }) => rest);
  }, [backend, beRows, beProducts, categoryId]);

  const rows: TrendRow[] = backend && error ? [] : (backendRows ?? mockRows);

  return (
    <div>
      <ReportToolbar
        title="Trending Products"
        subtitle={`Top 50 by ${metric === 'qty' ? 'units sold' : 'revenue'} vs prior period`}
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
            <div className="flex items-center gap-1 bg-secondary/40 p-0.5 rounded-md">
              {(['qty', 'revenue'] as Metric[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={cn(
                    'h-6 px-2 rounded text-xs font-medium transition',
                    metric === m
                      ? 'bg-card shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m === 'qty' ? 'Units' : 'Revenue'}
                </button>
              ))}
            </div>
          </>
        }
      />

      <div className="p-6 space-y-4 max-w-6xl">
        {rows.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            <Package className="size-6 mx-auto mb-2 opacity-50" />
            {backend && loading ? 'Loading…' : backend && error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No sales in this range.'}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((r, i) => (
              <Card
                key={r.productId}
                className="p-4 hover:shadow-md hover:border-primary transition cursor-pointer"
                onClick={() => alert(`Drill: open ${r.sku}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-md bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {i < 3 && <Flame className="size-3 text-amber-500" />}
                      <span className="font-semibold text-sm truncate">{r.name}</span>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground truncate">
                      {r.sku} · {r.category}
                    </div>
                  </div>
                </div>
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                      {metric === 'qty' ? 'Units' : 'Revenue'}
                    </div>
                    <div className="tabular font-bold text-base">
                      {metric === 'qty' ? formatNumber(r.current) : formatBDT(r.current)}
                    </div>
                  </div>
                  <Sparkline values={r.trend14} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    Prior: {metric === 'qty' ? formatNumber(r.previous) : formatBDT(r.previous)}
                  </span>
                  <DeltaBadge pct={r.deltaPct} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-primary/70"
          style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function DeltaBadge({ pct }: { pct: number }) {
  if (Math.abs(pct) < 0.1) {
    return (
      <Badge variant="default" className="text-[10px]">
        flat
      </Badge>
    );
  }
  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-success font-semibold text-[11px] tabular">
        <TrendingUp className="size-3" /> {pct.toFixed(0)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-destructive font-semibold text-[11px] tabular">
      <TrendingDown className="size-3" /> {pct.toFixed(0)}%
    </span>
  );
}
