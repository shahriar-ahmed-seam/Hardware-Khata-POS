import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Filter, Save, RotateCcw, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  brands as mockBrands,
  categories as mockCategories,
  products as seed,
  type Product,
} from '@/mocks/data';
import { brandName, categoryName } from '@/mocks/data';
import { useProducts } from '@/hooks/useProducts';
import { useCategories, useBrands } from '@/hooks/useCatalog';
import { api, hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';
import { formatBDT, cn } from '@/lib/utils';
import { ProductImage } from '@/components/products/ProductImage';
import { NumberField } from '@/components/ui/NumberField';

type Field = 'price' | 'cost' | 'wholesalePrice' | 'contractorPrice';
type Mode = 'flat' | 'percent' | 'set';

const FIELD_LABEL: Record<Field, string> = {
  price: 'Sell Price (SPR)',
  cost: 'Cost',
  wholesalePrice: 'Wholesale',
  contractorPrice: 'Contractor',
};

export default function BulkPriceUpdate() {
  const backend = hasBackend();
  const qc = useQueryClient();

  // Product + filter sources: real catalogue under backend, mock otherwise.
  const productsQuery = useProducts();
  const categoriesQuery = useCategories();
  const brandsQuery = useBrands();

  // Mock mode mutates a local copy; backend mode is read from the query cache
  // and persisted via products.update (then invalidated to refetch).
  const [mockList, setMockList] = useState<Product[]>(seed);
  const list = backend ? (productsQuery.data ?? []) : mockList;
  const categories = backend ? (categoriesQuery.data ?? []) : mockCategories;
  const brands = backend ? (brandsQuery.data ?? []) : mockBrands;

  const [applying, setApplying] = useState(false);

  // Filters
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | 'all'>('all');
  const [brand, setBrand] = useState<string | 'all'>('all');

  const filtered = useMemo(() => {
    return list.filter((p) => {
      if (cat !== 'all' && p.categoryId !== cat) return false;
      if (brand !== 'all' && p.brandId !== brand) return false;
      if (q && !`${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [list, q, cat, brand]);

  // Resolve category/brand labels from the active lists (real ids under backend,
  // mock ids otherwise) so the row subtitle is correct in both modes.
  const catLabel = (id: string) =>
    backend ? (categories.find((c) => c.id === id)?.name ?? '—') : categoryName(id);
  const brandLabel = (id: string) =>
    backend ? (brands.find((b) => b.id === id)?.name ?? '—') : brandName(id);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allOnPage = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allOnPage) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Update controls
  const [field, setField] = useState<Field>('price');
  const [mode, setMode] = useState<Mode>('percent');
  const [amount, setAmount] = useState<number>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [round, setRound] = useState<'none' | 'nearest' | 'up' | 'down'>('nearest');

  const compute = (current: number) => {
    let next = current;
    if (mode === 'flat') next = current + direction * amount;
    else if (mode === 'percent') next = current * (1 + (direction * amount) / 100);
    else if (mode === 'set') next = amount;
    if (round === 'nearest') next = Math.round(next);
    else if (round === 'up') next = Math.ceil(next);
    else if (round === 'down') next = Math.floor(next);
    return Math.max(0, next);
  };

  const previewSelected = useMemo(() => {
    return list
      .filter((p) => selected.has(p.id))
      .map((p) => {
        const current = (p[field] as number | undefined) ?? 0;
        return { p, current, next: compute(current) };
      });
  }, [list, selected, field, mode, amount, direction, round]);

  const totalDelta = previewSelected.reduce((s, x) => s + (x.next - x.current), 0);

  const apply = async () => {
    if (selected.size === 0) return;
    if (
      !confirm(
        `Update ${FIELD_LABEL[field]} on ${selected.size} product(s)?\nThis cannot be undone.`,
      )
    )
      return;

    if (backend) {
      // Persist each affected product via products.update (no bulk channel),
      // then invalidate ['products'] so the table refetches the real values.
      setApplying(true);
      const affected = list.filter((p) => selected.has(p.id));
      let ok = 0;
      let failed = 0;
      for (const p of affected) {
        const current = (p[field] as number | undefined) ?? 0;
        const next = compute(current);
        try {
          await api('products.update', { id: p.id, patch: { [field]: next } });
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      await qc.invalidateQueries({ queryKey: ['products'] });
      setApplying(false);
      if (failed === 0) {
        toast.success(`Updated ${FIELD_LABEL[field]} on ${ok} product${ok === 1 ? '' : 's'}`);
      } else {
        toast.error(`Updated ${ok}, failed ${failed}. Check and retry.`);
      }
      setSelected(new Set());
      setAmount(0);
      return;
    }

    // Mock mode: mutate the local copy only.
    setMockList((cs) =>
      cs.map((p) => {
        if (!selected.has(p.id)) return p;
        const current = (p[field] as number | undefined) ?? 0;
        const next = compute(current);
        return { ...p, [field]: next };
      }),
    );
    setSelected(new Set());
    setAmount(0);
  };

  return (
    <div>
      <PageHeader
        title="Bulk Price Update"
        subtitle="Filter → select → apply"
        actions={
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
            <RotateCcw className="size-4" /> Clear selection
          </Button>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT — filters + list */}
        <div className="xl:col-span-2 space-y-4">
          <Card className="p-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or SKU…"
                className="pl-9"
              />
            </div>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" disabled>
              <Filter className="size-3.5" /> {filtered.length} match
            </Button>
          </Card>

          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50 sticky top-0">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" checked={allOnPage} onChange={toggleAll} />
                  </th>
                  <th className="text-left font-medium px-2 py-2.5">Product</th>
                  <th className="text-right font-medium px-2 py-2.5">{FIELD_LABEL[field]}</th>
                  <th className="text-right font-medium px-3 py-2.5">After</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const isSel = selected.has(p.id);
                  const current = (p[field] as number | undefined) ?? 0;
                  const next = compute(current);
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
                          <div className="min-w-0">
                            <div className="font-medium truncate">{p.name}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {p.sku} · {brandLabel(p.brandId)} · {catLabel(p.categoryId)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono tabular">
                        {formatBDT(current, { withSymbol: false })}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular">
                        {isSel ? (
                          <span
                            className={cn(
                              'font-semibold',
                              next > current ? 'text-success' : next < current ? 'text-destructive' : '',
                            )}
                          >
                            {formatBDT(next, { withSymbol: false })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>

        {/* RIGHT — controls + summary */}
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Update settings</div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">Field</label>
              <select
                value={field}
                onChange={(e) => setField(e.target.value as Field)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              >
                {(Object.keys(FIELD_LABEL) as Field[]).map((f) => (
                  <option key={f} value={f}>
                    {FIELD_LABEL[f]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">Mode</label>
              <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs mt-1">
                {(['flat', 'percent', 'set'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      'flex-1 h-8 rounded font-medium capitalize transition',
                      mode === m
                        ? 'bg-card shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m === 'flat' ? '± ৳' : m === 'percent' ? '± %' : 'Set ='}
                  </button>
                ))}
              </div>
            </div>

            {mode !== 'set' && (
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Direction
                </label>
                <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs mt-1">
                  {[1, -1].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDirection(d as 1 | -1)}
                      className={cn(
                        'flex-1 h-8 rounded font-medium transition',
                        direction === d
                          ? 'bg-card shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {d === 1 ? 'Increase ↑' : 'Decrease ↓'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                {mode === 'set' ? 'New value' : mode === 'percent' ? 'Percent' : 'Amount'}
              </label>
              <NumberField
                value={amount}
                onChangeNumber={setAmount}
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">Rounding</label>
              <select
                value={round}
                onChange={(e) => setRound(e.target.value as any)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="none">No rounding</option>
                <option value="nearest">Nearest taka</option>
                <option value="up">Round up</option>
                <option value="down">Round down</option>
              </select>
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="text-sm font-semibold">Summary</div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Selected</span>
              <Badge variant="info">{selected.size}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total change</span>
              <span
                className={cn(
                  'font-mono tabular font-semibold',
                  totalDelta > 0 ? 'text-success' : totalDelta < 0 ? 'text-destructive' : '',
                )}
              >
                {totalDelta > 0 ? '+' : ''}
                {formatBDT(totalDelta)}
              </span>
            </div>
            <Button onClick={apply} disabled={selected.size === 0 || amount === 0 || applying} className="w-full mt-2">
              <Save className="size-4" /> {applying ? 'Applying…' : `Apply to ${selected.size} product${selected.size === 1 ? '' : 's'}`}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
