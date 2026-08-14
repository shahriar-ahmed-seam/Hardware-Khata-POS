import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Flame, Package } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useCategories } from '@/hooks/useCatalog';
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
  const nav = useNavigate();
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [metric, setMetric] = useState<Metric>('qty');
  const [categoryId, setCategoryId] = useState('');

  // Backend wiring: pass the metric toggle through to the channel; join category
  // names client-side via products.list (fetched once).
  const branchId = useBranchId(branch);
  const { data: beRows, loading, error } = useReport<BackendTrendRow[]>(
    'reports.trending',
    hasBackend() ? { range, branchId, metric } : null,
    [range, branchId, metric],
  );
  const { data: beProducts } = useReport<BackendProductRow[]>(
    'products.list',
    hasBackend() ? {} : null,
    [],
  );

  // Real catalog for the category filter dropdown (backend-backed).
  const categoriesQuery = useCategories();
  const categories = categoriesQuery.data ?? [];

  // Map backend rows; join category client-side and apply the category filter.
  // The backend doesn't return a per-bucket sparkline, so trend14 stays all
  // zeros and the Sparkline renders nothing — DEFERRED until the channel emits
  // buckets. NOTE: no mock/sample fallback — empty backend result = empty page.
  const backendRows: TrendRow[] | null = useMemo(() => {
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
        current: r.current,
        previous: r.previous,
        deltaPct: r.deltaPct,
        trend14: new Array(14).fill(0) as number[],
      };
    });
    if (categoryId) list = list.filter((r) => r.categoryId === categoryId);
    return list.map(({ categoryId: _omit, ...rest }) => rest);
  }, [beRows, beProducts, categories, categoryId]);

  const rows: TrendRow[] = backendRows ?? [];

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
              {categories.map((c) => (
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
            {loading ? 'Loading…' : error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No data in this range.'}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((r, i) => (
              <Card
                key={r.productId}
                className="p-4 hover:shadow-md hover:border-primary transition cursor-pointer"
                onClick={() => nav(`/products/${r.productId}`)}
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
  // Business rule: never draw a shape that isn't backed by data. The trending
  // channel doesn't return per-bucket values yet, so an all-zero series renders
  // nothing instead of a flat baseline that could read as "no movement".
  if (!values.some((v) => v > 0)) return null;
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
