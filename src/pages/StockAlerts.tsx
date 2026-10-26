import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, PackageX, ShoppingBag, Search, PackageCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductImage } from '@/components/products/ProductImage';
import { useReport } from '@/hooks/useReport';
import { setPurchasePrefill } from '@/lib/purchasePrefill';
import { formatBDT, formatNumber, cn } from '@/lib/utils';

/** A product row normalized for the alert list. */
interface AlertItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  reorderLevel: number;
  cost: number;
  unit: string;
  categoryId: string;
  image?: string;
  categoryLabel: string;
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
/** A `products.list` row — used to join category/unit/image client-side. */
interface BackendProductRow {
  id: string;
  unit?: string | null;
  image_url?: string | null;
  category_id?: string | null;
  category_name?: string | null;
}

const checkboxCls = 'size-5 cursor-pointer accent-[hsl(var(--primary))]';

export default function StockAlerts() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // `dashboard.lowStock` returns both low + out items (stock <= reorder_level),
  // whole shop (no branchId). Category/unit/image are joined via products.list.
  const { data: beLowStock, loading, error } = useReport<BackendLowStock[]>(
    'dashboard.lowStock',
    { limit: 500 },
    [],
  );
  const { data: beProducts } = useReport<BackendProductRow[]>('products.list', {}, []);

  const allItems: AlertItem[] = useMemo(() => {
    if (!beLowStock) return [];
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
        image: m?.image_url ?? undefined,
        categoryLabel: m?.category_name ?? '—',
      };
    });
  }, [beLowStock, beProducts]);

  // One list (the Low / Out tabs split a short list): out of stock first.
  const list = useMemo(() => {
    let arr = [...allItems].sort((a, b) => Number(a.stock > 0) - Number(b.stock > 0));
    if (q) {
      const t = q.toLowerCase();
      arr = arr.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(t));
    }
    return arr;
  }, [allItems, q]);

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

  const totalSelectedValue = allItems
    .filter((p) => selected.has(p.id))
    .reduce((s, p) => s + suggestedQty(p) * p.cost, 0);

  // Hand off the selected alert items (product id + suggested qty) to the Add
  // Purchase form via sessionStorage, then navigate. AddPurchase consumes +
  // clears the prefill on mount.
  const createPurchaseFromSelected = () => {
    const lines = allItems
      .filter((p) => selected.has(p.id))
      .map((p) => ({ productId: p.id, qty: suggestedQty(p) }));
    if (lines.length === 0) return;
    setPurchasePrefill(lines);
    nav('/purchases/new?prefill=alerts');
  };

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title="Stock Alerts"
        actions={
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or SKU…"
              className="pl-9"
              aria-label="Search alerts"
            />
          </div>
        }
      />

      <div className="p-6 space-y-3 flex-1">
        {list.length > 0 && selected.size === 0 && (
          <p className="text-sm text-muted-foreground">Tick the items you want to reorder.</p>
        )}
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-secondary/50">
              <tr>
                <th className="w-12 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className={checkboxCls}
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="text-left px-2 py-2.5 font-medium">Product</th>
                <th className="text-left px-2 py-2.5 font-medium">Category</th>
                <th className="text-right px-2 py-2.5 font-medium">Stock</th>
                <th className="text-right px-2 py-2.5 font-medium">Reorder at</th>
                <th className="text-right px-2 py-2.5 font-medium">Suggested qty</th>
                <th className="text-right px-4 py-2.5 font-medium">Est. cost (৳)</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const isSel = selected.has(p.id);
                const sug = suggestedQty(p);
                const out = p.stock <= 0;
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      'border-t border-border hover:bg-secondary/40 cursor-pointer',
                      isSel && 'bg-primary/5',
                    )}
                    onClick={() => toggle(p.id)}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className={checkboxCls}
                        checked={isSel}
                        onChange={() => toggle(p.id)}
                        aria-label="Select"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <ProductImage url={p.image} categoryId={p.categoryId} size={32} />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap">{p.categoryLabel}</td>
                    <td
                      className={cn(
                        'px-2 py-2.5 text-right tabular whitespace-nowrap font-medium',
                        out ? 'text-destructive' : 'text-warning',
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {out ? <PackageX className="size-4" /> : <AlertTriangle className="size-4" />}
                        <span>{out ? 'Out' : 'Low'}</span>
                      </span>{' '}
                      · {formatNumber(p.stock)} {p.unit}
                    </td>
                    <td className="px-2 py-2.5 text-right text-muted-foreground tabular">
                      {formatNumber(p.reorderLevel)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular font-semibold whitespace-nowrap">
                      {formatNumber(sug)} {p.unit}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">
                      {formatBDT(sug * p.cost, { withSymbol: false })}
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    {loading ? (
                      <div className="px-4 py-12 text-center text-muted-foreground">Loading…</div>
                    ) : error ? (
                      <div className="px-4 py-12 text-center text-destructive">
                        Couldn’t load — backend error. Check connection and retry.
                      </div>
                    ) : allItems.length > 0 ? (
                      <div className="px-4 py-12 text-center text-muted-foreground">No items match.</div>
                    ) : (
                      <EmptyState
                        compact
                        icon={PackageCheck}
                        title="Nothing is running low."
                        message="Products show here when their stock falls to the reorder level."
                      />
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* The only action lives with the selection, not far away in the header. */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 z-10 border-t border-border bg-card px-6 py-3 flex items-center justify-end gap-4">
          <span className="text-sm">
            <span className="tabular font-semibold">{formatNumber(selected.size)}</span>{' '}
            <span>items</span> · <span className="text-muted-foreground">Estimated cost</span>{' '}
            <span className="tabular font-semibold">{formatBDT(totalSelectedValue)}</span>
          </span>
          <Button size="lg" onClick={createPurchaseFromSelected}>
            <ShoppingBag className="size-4" /> Create purchase
          </Button>
        </div>
      )}
    </div>
  );
}
