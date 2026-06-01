import { useMemo, useState } from 'react';
import { Search, Package } from 'lucide-react';
import {
  ReportToolbar,
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
import { useReport } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ItemRow {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  cat: string;
  catEmoji?: string;
  brand: string;
  unit: string;
  cost: number;
  price: number;
  wholesale?: number;
  contractor?: number;
  margin: number;
  tax: number;
  notForSale: boolean;
  showInPOS: boolean;
  categoryId: string;
  brandId: string;
}

/** A `products.list` row (snake_case, with derived stock/margin attached). */
interface BackendProductRow {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  category_id?: string | null;
  category_name?: string | null;
  category_emoji?: string | null;
  brand_id?: string | null;
  brand_name?: string | null;
  unit?: string | null;
  cost: number;
  price: number;
  wholesale_price?: number | null;
  contractor_price?: number | null;
  tax_pct?: number | null;
  margin?: number;
  show_in_pos?: number;
  not_for_sale?: number;
}

export default function ItemsReportPage() {
  const [range, setRange] = useState<DateRange>({ preset: 'today' });
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');

  // Backend wiring: catalog snapshot is range-independent → `products.list {}`.
  // Client search/category/brand filters stay on top of the fetched rows.
  const { data: beProducts, loading, backend, error } = useReport<BackendProductRow[]>(
    'products.list',
    hasBackend() ? {} : null,
    [],
  );

  const mockRows: ItemRow[] = useMemo(() => {
    let list = ALL_PRODUCTS.map((p) => {
      const cat = ALL_CATEGORIES.find((c) => c.id === p.categoryId);
      const brand = ALL_BRANDS.find((b) => b.id === p.brandId);
      const margin = p.cost > 0 ? ((p.price - p.cost) / p.cost) * 100 : 0;
      return {
        id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        cat: cat?.name ?? '—',
        catEmoji: cat?.emoji,
        brand: brand?.name ?? '—',
        unit: p.unit,
        cost: p.cost,
        price: p.price,
        wholesale: p.wholesalePrice,
        contractor: p.contractorPrice,
        margin,
        tax: p.tax ?? 0,
        notForSale: !!p.notForSale,
        showInPOS: p.showInPOS !== false,
        categoryId: p.categoryId ?? '',
        brandId: p.brandId ?? '',
      };
    });
    if (categoryId)
      list = list.filter((r) => r.categoryId === categoryId);
    if (brandId)
      list = list.filter((r) => r.brandId === brandId);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => `${r.name} ${r.sku} ${r.barcode}`.toLowerCase().includes(t));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [q, categoryId, brandId]);

  // Map backend product rows into the page's row shape.
  const backendRows: ItemRow[] | null = useMemo(() => {
    if (!backend || !beProducts) return null;
    let list = beProducts.map((p) => ({
      id: p.id,
      sku: p.sku,
      barcode: p.barcode ?? '',
      name: p.name,
      cat: p.category_name ?? '—',
      catEmoji: p.category_emoji ?? undefined,
      brand: p.brand_name ?? '—',
      unit: p.unit ?? 'pc',
      cost: p.cost,
      price: p.price,
      wholesale: p.wholesale_price ?? undefined,
      contractor: p.contractor_price ?? undefined,
      margin: p.margin ?? (p.cost > 0 ? ((p.price - p.cost) / p.cost) * 100 : 0),
      tax: p.tax_pct ?? 0,
      notForSale: p.not_for_sale === 1,
      showInPOS: p.show_in_pos !== 0,
      categoryId: p.category_id ?? '',
      brandId: p.brand_id ?? '',
    }));
    if (categoryId) list = list.filter((r) => r.categoryId === categoryId);
    if (brandId) list = list.filter((r) => r.brandId === brandId);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => `${r.name} ${r.sku} ${r.barcode}`.toLowerCase().includes(t));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [backend, beProducts, q, categoryId, brandId]);

  const rows: ItemRow[] = backend && error ? [] : (backendRows ?? mockRows);

  const totals = useMemo(() => {
    const cats = new Set<string>();
    const brands = new Set<string>();
    rows.forEach((r) => {
      cats.add(r.cat);
      brands.add(r.brand);
    });
    return {
      products: rows.length,
      categories: cats.size,
      brands: brands.size,
      avgMargin:
        rows.length > 0 ? rows.reduce((a, r) => a + r.margin, 0) / rows.length : 0,
    };
  }, [rows]);

  return (
    <div>
      <ReportToolbar
        title="Items Report"
        subtitle={`${formatNumber(totals.products)} products in catalog`}
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
          </>
        }
      />

      <div className="p-6 space-y-4 max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Products" value={formatNumber(totals.products)} />
          <Kpi label="Categories" value={formatNumber(totals.categories)} />
          <Kpi label="Brands" value={formatNumber(totals.brands)} />
          <Kpi label="Avg margin" value={`${totals.avgMargin.toFixed(1)}%`} tone="success" />
        </div>

        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, SKU, or barcode…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_0.8fr_0.5fr_0.9fr_0.9fr_0.7fr_0.5fr_0.6fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            <div>Product</div>
            <div>Category</div>
            <div>Brand</div>
            <div>Unit</div>
            <div className="text-right">Cost</div>
            <div className="text-right">Price</div>
            <div className="text-right">Margin</div>
            <div className="text-right">Tax</div>
            <div className="text-right">POS</div>
          </div>
          {rows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <Package className="size-6 mx-auto mb-2 opacity-50" />
              {backend && loading ? 'Loading…' : backend && error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No products match.'}
            </div>
          )}
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[2fr_1fr_0.8fr_0.5fr_0.9fr_0.9fr_0.7fr_0.5fr_0.6fr] gap-2 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{r.name}</div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  {r.sku} · {r.barcode}
                </div>
              </div>
              <div className="text-muted-foreground truncate">
                {r.catEmoji} {r.cat}
              </div>
              <div className="text-muted-foreground truncate">{r.brand}</div>
              <div className="text-muted-foreground">{r.unit}</div>
              <div className="tabular text-right">{formatBDT(r.cost)}</div>
              <div className="tabular text-right font-medium">{formatBDT(r.price)}</div>
              <div
                className={cn(
                  'tabular text-right font-semibold',
                  r.margin >= 30
                    ? 'text-success'
                    : r.margin >= 15
                      ? 'text-warning'
                      : 'text-destructive',
                )}
              >
                {r.margin.toFixed(0)}%
              </div>
              <div className="tabular text-right text-muted-foreground">{r.tax}%</div>
              <div className="text-right">
                {r.notForSale ? (
                  <Badge variant="destructive">No sale</Badge>
                ) : r.showInPOS ? (
                  <Badge variant="success">Yes</Badge>
                ) : (
                  <Badge variant="default">Hidden</Badge>
                )}
              </div>
            </div>
          ))}
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
