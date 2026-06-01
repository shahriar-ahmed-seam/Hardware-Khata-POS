import { useMemo, useState } from 'react';
import { AlertTriangle, ShoppingBag, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ReportToolbar,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  products as ALL_PRODUCTS,
  categories as ALL_CATEGORIES,
} from '@/mocks/data';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

/** A product row normalized for the alert tabs. */
interface AlertItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  reorderLevel: number;
  cost: number;
  unit: string;
  categoryId: string;
  categoryName?: string;
  categoryEmoji?: string;
}

/** A `dashboard.lowStock` row (low + out items). */
interface BackendLowStock {
  id: string;
  name: string;
  sku: string;
  reorder_level: number;
  cost: number;
  stock: number;
}
/** A `products.list` row — used to join category/unit client-side. */
interface BackendProductRow {
  id: string;
  unit?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  category_emoji?: string | null;
}

export default function StockAlertReportPage() {
  const [range, setRange] = useState<DateRange>({ preset: 'today' });
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'low' | 'out'>('low');

  // Backend wiring: `dashboard.lowStock` returns both low + out items (stock <=
  // reorder_level). We split them into the low/out tabs and join category/unit
  // client-side via products.list.
  const branchId = useBranchId(branch);
  const { data: beLowStock, loading, backend, error } = useReport<BackendLowStock[]>(
    'dashboard.lowStock',
    hasBackend() ? { limit: 200, branchId } : null,
    [branchId],
  );
  const { data: beProducts } = useReport<BackendProductRow[]>(
    'products.list',
    hasBackend() ? {} : null,
    [],
  );

  const mockItems: AlertItem[] = useMemo(
    () =>
      ALL_PRODUCTS.map((p) => {
        const cat = ALL_CATEGORIES.find((c) => c.id === p.categoryId);
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: p.stock,
          reorderLevel: p.reorderLevel,
          cost: p.cost,
          unit: p.unit,
          categoryId: p.categoryId ?? '',
          categoryName: cat?.name,
          categoryEmoji: cat?.emoji,
        };
      }),
    [],
  );

  const backendItems: AlertItem[] | null = useMemo(() => {
    if (!backend || !beLowStock) return null;
    const meta = new Map<string, BackendProductRow>();
    for (const p of beProducts ?? []) meta.set(p.id, p);
    return beLowStock.map((p) => {
      const m = meta.get(p.id);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        reorderLevel: p.reorder_level,
        cost: p.cost,
        unit: m?.unit ?? 'pc',
        categoryId: m?.category_id ?? '',
        categoryName: m?.category_name ?? undefined,
        categoryEmoji: m?.category_emoji ?? undefined,
      };
    });
  }, [backend, beLowStock, beProducts]);

  const allItems: AlertItem[] = backend && error ? [] : (backendItems ?? mockItems);

  const lowItems = useMemo(
    () => allItems.filter((p) => p.stock > 0 && p.stock <= p.reorderLevel),
    [allItems],
  );
  const outItems = useMemo(() => allItems.filter((p) => p.stock <= 0), [allItems]);

  const list = tab === 'low' ? lowItems : outItems;
  const filtered = useMemo(() => {
    if (!q) return list;
    const t = q.toLowerCase();
    return list.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(t));
  }, [list, q]);

  const totalSuggestedSpend = filtered.reduce(
    (acc, p) => acc + (p.reorderLevel * 2 - p.stock) * p.cost,
    0,
  );

  return (
    <div>
      <ReportToolbar
        title="Stock Alert Report"
        subtitle={`${formatNumber(lowItems.length)} low · ${formatNumber(outItems.length)} out of stock`}
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
      />

      <div className="p-6 space-y-4 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="p-4 border-l-4 border-warning">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Low stock
            </div>
            <div className="tabular font-bold text-2xl mt-1 text-warning">
              {formatNumber(lowItems.length)}
            </div>
            <div className="text-[11px] text-muted-foreground">items at or below reorder level</div>
          </Card>
          <Card className="p-4 border-l-4 border-destructive">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Out of stock
            </div>
            <div className="tabular font-bold text-2xl mt-1 text-destructive">
              {formatNumber(outItems.length)}
            </div>
            <div className="text-[11px] text-muted-foreground">need restock immediately</div>
          </Card>
          <Card className="p-4 border-l-4 border-primary">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Estimated reorder spend
            </div>
            <div className="tabular font-bold text-2xl mt-1 text-primary">
              {formatBDT(totalSuggestedSpend)}
            </div>
            <div className="text-[11px] text-muted-foreground">to bring all to 2× reorder level</div>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-md">
            <button
              onClick={() => setTab('low')}
              className={cn(
                'h-8 px-3 rounded text-sm font-medium transition',
                tab === 'low'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Low ({lowItems.length})
            </button>
            <button
              onClick={() => setTab('out')}
              className={cn(
                'h-8 px-3 rounded text-sm font-medium transition',
                tab === 'out'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Out ({outItems.length})
            </button>
          </div>
          <Link to="/stock/alerts">
            <Button variant="outline" size="sm">
              <ShoppingBag className="size-4" /> Open in Stock Module
            </Button>
          </Link>
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
          <div className="grid grid-cols-[2fr_1fr_0.7fr_0.7fr_0.9fr_0.9fr_1fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            <div>Product</div>
            <div>Category</div>
            <div className="text-right">Stock</div>
            <div className="text-right">Reorder</div>
            <div className="text-right">Suggest</div>
            <div className="text-right">Est. cost</div>
            <div className="text-right">Status</div>
          </div>
          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <AlertTriangle className="size-6 mx-auto mb-2 opacity-50" />
              {backend && loading ? 'Loading…' : backend && error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No items in this list.'}
            </div>
          )}
          {filtered.map((p) => {
            const suggest = Math.max(1, p.reorderLevel * 2 - p.stock);
            const estCost = suggest * p.cost;
            return (
              <div
                key={p.id}
                className="grid grid-cols-[2fr_1fr_0.7fr_0.7fr_0.9fr_0.9fr_1fr] gap-2 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">{p.sku}</div>
                </div>
                <div className="text-muted-foreground">
                  {p.categoryEmoji} {p.categoryName}
                </div>
                <div
                  className={cn(
                    'tabular text-right font-medium',
                    p.stock <= 0 ? 'text-destructive' : 'text-warning',
                  )}
                >
                  {formatNumber(p.stock)} {p.unit}
                </div>
                <div className="tabular text-right text-muted-foreground">
                  {formatNumber(p.reorderLevel)}
                </div>
                <div className="tabular text-right font-medium">{formatNumber(suggest)}</div>
                <div className="tabular text-right">{formatBDT(estCost)}</div>
                <div className="text-right">
                  {p.stock <= 0 ? (
                    <Badge variant="destructive">Out</Badge>
                  ) : (
                    <Badge variant="warning">Low</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
