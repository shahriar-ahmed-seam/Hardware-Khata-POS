import { useMemo, useState } from 'react';
import { Search, Package } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  isInRange,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePurchases } from '@/stores/purchases';
import { products as ALL_PRODUCTS, categories as ALL_CATEGORIES } from '@/mocks/data';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Row {
  productId: string;
  name: string;
  sku: string;
  category: string;
  qty: number;
  spend: number;
  avgCost: number;
  bills: number;
  suppliers: Set<string>;
}

/** One `reports.productPurchase` row. */
interface BackendPurchaseRow {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  spend: number;
  avgCost: number;
  bills: number;
}

/** A `products.list` row — used only to join category names client-side. */
interface BackendProductRow {
  id: string;
  sku: string;
  category_id?: string | null;
  category_name?: string | null;
}

export default function ProductPurchasePage() {
  const purchases = usePurchases((s) => s.purchases);
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // Backend wiring: aggregated rows + product catalog (once) for category join.
  const branchId = useBranchId(branch);
  const { data: beRows, loading, backend, error } = useReport<BackendPurchaseRow[]>(
    'reports.productPurchase',
    hasBackend() ? { range, branchId } : null,
    [range, branchId],
  );
  const { data: beProducts } = useReport<BackendProductRow[]>(
    'products.list',
    hasBackend() ? {} : null,
    [],
  );

  const mockRows = useMemo(() => {
    const fPurchases = purchases.filter(
      (p) => p.status !== 'cancelled' && isInRange(p.date, range) && (!branch || p.branch === branch),
    );

    const map = new Map<string, Row>();
    for (const purchase of fPurchases) {
      for (const line of purchase.lines) {
        const product = ALL_PRODUCTS.find((p) => p.sku === line.sku || p.id === line.productId);
        const productId = product?.id ?? line.productId;
        const cat = product ? ALL_CATEGORIES.find((c) => c.id === product.categoryId) : undefined;
        if (categoryId && cat?.id !== categoryId) continue;
        const spend = line.lineTotal;
        const existing = map.get(productId);
        if (existing) {
          existing.qty += line.qty;
          existing.spend += spend;
          existing.bills += 1;
          existing.suppliers.add(purchase.supplierName);
        } else {
          map.set(productId, {
            productId,
            name: product?.name ?? line.name,
            sku: line.sku,
            category: cat?.name ?? '—',
            qty: line.qty,
            spend,
            avgCost: 0,
            bills: 1,
            suppliers: new Set([purchase.supplierName]),
          });
        }
      }
    }
    const list = Array.from(map.values());
    list.forEach((r) => {
      r.avgCost = r.qty > 0 ? r.spend / r.qty : 0;
    });
    if (q) {
      const t = q.toLowerCase();
      return list.filter((r) => `${r.name} ${r.sku}`.toLowerCase().includes(t));
    }
    return list.sort((a, b) => b.spend - a.spend);
  }, [purchases, range, branch, q, categoryId]);

  // Map backend rows; join category client-side. The backend aggregation does
  // not break spend down by supplier, so the Suppliers column is empty when
  // backed (per-supplier rollup is a later enhancement).
  const backendRows: Row[] | null = useMemo(() => {
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
        qty: r.qty,
        spend: r.spend,
        avgCost: r.avgCost,
        bills: r.bills,
        suppliers: new Set<string>(),
      };
    });
    if (categoryId) list = list.filter((r) => r.categoryId === categoryId);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => `${r.name} ${r.sku}`.toLowerCase().includes(t));
    }
    return list
      .sort((a, b) => b.spend - a.spend)
      .map(({ categoryId: _omit, ...rest }) => rest);
  }, [backend, beRows, beProducts, categoryId, q]);

  const rows: Row[] = backend && error ? [] : (backendRows ?? mockRows);

  const totals = useMemo(
    () => ({
      qty: rows.reduce((a, r) => a + r.qty, 0),
      spend: rows.reduce((a, r) => a + r.spend, 0),
      bills: rows.reduce((a, r) => a + r.bills, 0),
      products: rows.length,
    }),
    [rows],
  );

  return (
    <div>
      <ReportToolbar
        title="Product Purchase Report"
        subtitle={`${formatNumber(totals.products)} products · ${formatNumber(totals.qty)} units purchased`}
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
            {ALL_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="p-6 space-y-4 max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Products purchased" value={formatNumber(totals.products)} />
          <Kpi label="Units purchased" value={formatNumber(totals.qty)} />
          <Kpi label="Total spend" value={formatBDT(totals.spend)} tone="warning" />
          <Kpi label="Bills" value={formatNumber(totals.bills)} />
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
          <div className="grid grid-cols-[2fr_1fr_0.7fr_0.8fr_1fr_1.5fr_0.7fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            <div>Product</div>
            <div>Category</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Avg cost</div>
            <div className="text-right">Spend</div>
            <div>Suppliers</div>
            <div className="text-right">Bills</div>
          </div>
          {rows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <Package className="size-6 mx-auto mb-2 opacity-50" />
              {backend && loading ? 'Loading…' : backend && error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No purchases in this range.'}
            </div>
          )}
          {rows.map((r) => (
            <div
              key={r.productId}
              className="grid grid-cols-[2fr_1fr_0.7fr_0.8fr_1fr_1.5fr_0.7fr] gap-2 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer"
              onClick={() => alert(`Drill: open Product ${r.sku}`)}
            >
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{r.name}</div>
                <div className="text-[11px] font-mono text-muted-foreground">{r.sku}</div>
              </div>
              <div className="text-sm text-muted-foreground">{r.category}</div>
              <div className="text-sm tabular text-right">{formatNumber(r.qty)}</div>
              <div className="text-sm tabular text-right">{formatBDT(r.avgCost)}</div>
              <div className="text-sm tabular text-right font-medium">{formatBDT(r.spend)}</div>
              <div className="text-xs text-muted-foreground truncate">
                {Array.from(r.suppliers).join(', ')}
              </div>
              <div className="text-sm tabular text-right">{formatNumber(r.bills)}</div>
            </div>
          ))}
          {rows.length > 0 && (
            <div className="grid grid-cols-[2fr_1fr_0.7fr_0.8fr_1fr_1.5fr_0.7fr] gap-2 px-4 py-2.5 border-t-2 border-border bg-secondary/40 text-sm font-semibold">
              <div>Total</div>
              <div />
              <div className="tabular text-right">{formatNumber(totals.qty)}</div>
              <div />
              <div className="tabular text-right">{formatBDT(totals.spend)}</div>
              <div />
              <div className="tabular text-right">{formatNumber(totals.bills)}</div>
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
  tone?: 'primary' | 'success' | 'warning';
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
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </div>
    </Card>
  );
}
