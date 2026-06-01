import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, PackageX, ShoppingBag, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { ProductImage } from '@/components/products/ProductImage';
import { products as mockProducts, brandName as mockBrandName, categoryName as mockCategoryName } from '@/mocks/data';
import { useReport } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { setPurchasePrefill } from '@/lib/purchasePrefill';
import { formatBDT, formatNumber, cn } from '@/lib/utils';

type Tab = 'low' | 'out';

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
  brandId: string;
  image?: string;
  categoryLabel: string;
  brandLabel: string;
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
/** A `products.list` row — used to join category/brand/unit/image client-side. */
interface BackendProductRow {
  id: string;
  unit?: string | null;
  image_url?: string | null;
  category_id?: string | null;
  brand_id?: string | null;
  category_name?: string | null;
  brand_name?: string | null;
}

export default function StockAlerts() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('low');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Backend wiring: `dashboard.lowStock` returns both low + out items (stock <=
  // reorder_level). We join category/brand/unit/image client-side via
  // products.list. Mirrors StockAlertReportPage.tsx. Falls back to mock data
  // outside Electron.
  const { data: beLowStock, loading, backend, error } = useReport<BackendLowStock[]>(
    'dashboard.lowStock',
    hasBackend() ? { branchId: 'br_mp', limit: 500 } : null,
    [],
  );
  const { data: beProducts } = useReport<BackendProductRow[]>(
    'products.list',
    hasBackend() ? { branchId: 'br_mp' } : null,
    [],
  );

  const mockItems: AlertItem[] = useMemo(
    () =>
      mockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        reorderLevel: p.reorderLevel,
        cost: p.cost,
        unit: p.unit,
        categoryId: p.categoryId ?? '',
        brandId: p.brandId ?? '',
        image: p.image,
        categoryLabel: mockCategoryName(p.categoryId),
        brandLabel: mockBrandName(p.brandId),
      })),
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
        brandId: m?.brand_id ?? '',
        image: m?.image_url ?? undefined,
        categoryLabel: m?.category_name ?? '—',
        brandLabel: m?.brand_name ?? '—',
      };
    });
  }, [backend, beLowStock, beProducts]);

  const allItems: AlertItem[] = backend && error ? [] : (backendItems ?? mockItems);

  const list = useMemo(() => {
    let arr = allItems.filter((p) =>
      tab === 'low' ? p.stock > 0 && p.stock <= p.reorderLevel : p.stock <= 0,
    );
    if (q) {
      const t = q.toLowerCase();
      arr = arr.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(t));
    }
    return arr;
  }, [allItems, tab, q]);

  const lowCount = allItems.filter((p) => p.stock > 0 && p.stock <= p.reorderLevel).length;
  const outCount = allItems.filter((p) => p.stock <= 0).length;

  const allSelected = list.length > 0 && list.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected((sel) => {
      const next = new Set(sel);
      if (allSelected) list.forEach((p) => next.delete(p.id));
      else list.forEach((p) => next.add(p.id));
      return next;
    });
  const toggle = (id: string) =>
    setSelected((sel) => {
      const next = new Set(sel);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const suggestedQty = (p: AlertItem) =>
    Math.max(p.reorderLevel * 2 - p.stock, p.reorderLevel);

  const totalSelectedValue = list
    .filter((p) => selected.has(p.id))
    .reduce((s, p) => s + suggestedQty(p) * p.cost, 0);

  // Hand off the selected alert items (product id + suggested qty) to the Add
  // Purchase form via sessionStorage, then navigate. AddPurchase consumes +
  // clears the prefill on mount. Works in both mock and backend modes.
  const createPurchaseFromSelected = () => {
    const lines = allItems
      .filter((p) => selected.has(p.id))
      .map((p) => ({ productId: p.id, qty: suggestedQty(p) }));
    if (lines.length === 0) return;
    setPurchasePrefill(lines);
    nav('/purchases/new?prefill=alerts');
  };

  return (
    <div>
      <PageHeader
        title="Stock Alerts"
        subtitle={`${lowCount} low · ${outCount} out`}
        actions={
          <>
            {selected.size > 0 && (
              <span className="text-xs text-muted-foreground">
                Estimated cost: <span className="font-mono tabular">{formatBDT(totalSelectedValue)}</span>
              </span>
            )}
            <Button
              disabled={selected.size === 0}
              onClick={createPurchaseFromSelected}
              title="Create Purchase from selected"
            >
              <ShoppingBag className="size-4" /> Create Purchase ({selected.size})
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-1 border-b border-border">
          <TabBtn active={tab === 'low'} onClick={() => setTab('low')} icon={AlertTriangle} label="Low Stock" count={lowCount} tone="warning" />
          <TabBtn active={tab === 'out'} onClick={() => setTab('out')} icon={PackageX} label="Out of Stock" count={outCount} tone="destructive" />
        </div>

        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or SKU…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="text-left px-2 py-2.5 font-medium">Product</th>
                <th className="text-left px-2 py-2.5 font-medium">Category</th>
                <th className="text-left px-2 py-2.5 font-medium">Brand</th>
                <th className="text-right px-2 py-2.5 font-medium">Stock</th>
                <th className="text-right px-2 py-2.5 font-medium">Reorder</th>
                <th className="text-right px-2 py-2.5 font-medium">Suggest Qty</th>
                <th className="text-right px-4 py-2.5 font-medium">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const isSel = selected.has(p.id);
                const sug = suggestedQty(p);
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      'border-t border-border hover:bg-secondary/40 cursor-pointer',
                      isSel && 'bg-primary/5',
                    )}
                    onClick={() => toggle(p.id)}
                  >
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={isSel} onChange={() => toggle(p.id)} />
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <ProductImage url={p.image} categoryId={p.categoryId} size={32} />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{p.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-xs">{p.categoryLabel}</td>
                    <td className="px-2 py-2.5 text-xs">{p.brandLabel}</td>
                    <td className="px-2 py-2.5 text-right">
                      <Badge variant={p.stock <= 0 ? 'destructive' : 'warning'}>
                        {p.stock} {p.unit}
                      </Badge>
                    </td>
                    <td className="px-2 py-2.5 text-right text-muted-foreground tabular">
                      {p.reorderLevel}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular font-semibold text-primary">
                      {formatNumber(sug)} {p.unit}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular">
                      {formatBDT(sug * p.cost)}
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    {backend && loading
                      ? 'Loading…'
                      : backend && error
                        ? 'Couldn’t load — backend error. Check connection and retry.'
                        : tab === 'low'
                          ? 'No low-stock items.'
                          : 'No out-of-stock items.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  count: number;
  tone?: 'warning' | 'destructive';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 h-10 text-sm font-medium border-b-2 -mb-px transition inline-flex items-center gap-2',
        active
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className={cn('size-3.5', tone === 'warning' && 'text-warning', tone === 'destructive' && 'text-destructive')} />
      {label}
      <Badge variant={tone === 'destructive' ? 'destructive' : 'warning'} className="ml-1">
        {count}
      </Badge>
    </button>
  );
}

void Plus;
