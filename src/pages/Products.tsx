import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  Barcode,
  Edit2,
  Trash2,
  Settings2,
  LayoutGrid,
  List,
  Copy,
  Eye,
  MoreHorizontal,
  ChevronDown,
  Tags,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Popover } from '@/components/ui/Popover';
import { Drawer } from '@/components/ui/Drawer';
import { Pagination } from '@/components/ui/Pagination';
import type { Product } from '@/types/domain';
import { formatBDT, formatNumber, cn, relativeTime } from '@/lib/utils';
import {
  COLUMN_META,
  useProductsUI,
  type ProductColumn,
} from '@/stores/products';
import { ProductImage } from '@/components/products/ProductImage';
import { ColumnsCustomize } from '@/components/products/ColumnsCustomize';
import { ProductForm } from '@/components/products/ProductForm';
import { QuickUpdateModal } from '@/components/products/QuickUpdateModal';
import {
  useProductsPage,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useArchiveProduct,
  useProductUsage,
  type ProductUsage,
} from '@/hooks/useProducts';
import { useCategories, useBrands } from '@/hooks/useCatalog';
import { useCanAll } from '@/hooks/useCan';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { SkeletonTable } from '@/components/ui/Skeleton';

export default function Products() {
  const nav = useNavigate();
  const { view, setView, columns } = useProductsUI();

  const categoriesQuery = useCategories();
  const brandsQuery = useBrands();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const archiveProduct = useArchiveProduct();
  const productUsage = useProductUsage();
  // Removing a product from the catalogue for good is owner-only; archiving is a
  // reversible catalogue edit. The IPC boundary enforces both — see useCan.ts.
  const perms = useCanAll(['products.delete', 'products.edit', 'products.create'] as const);
  const canDelete = perms['products.delete'];
  const canArchive = perms['products.edit'];
  const canEdit = perms['products.edit'];
  const canCreate = perms['products.create'];

  const categories = categoriesQuery.data ?? [];
  const brands = brandsQuery.data ?? [];

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? '—';

  // Filters. Category / brand / stock state / text all go to the SERVER; only the
  // price range has no backend field (see `filtered` below).
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [cat, setCat] = useState<string | 'all'>('all');
  const [brand, setBrand] = useState<string | 'all'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [priceMin, setPriceMin] = useState<number | ''>('');
  const [priceMax, setPriceMax] = useState<number | ''>('');

  // Paging
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // The text search hits the DATABASE, so it is debounced ~300ms — a query per
  // keystroke would be its own performance problem.
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(handle);
  }, [q]);

  // ----- Data source: the SQLite backend, ONE PAGE at a time -----
  const productsQuery = useProductsPage({
    page,
    pageSize,
    q: debouncedQ || undefined,
    categoryId: cat,
    brandId: brand,
    stockState: stockFilter === 'all' ? undefined : stockFilter,
  });

  const list: Product[] = productsQuery.data?.rows ?? [];
  const total = productsQuery.data?.total ?? 0;

  // Any filter change resets to page 1 — staying on page 9 of a narrower result
  // set would show an empty table.
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) {
      firstFilterRun.current = false;
      return;
    }
    setPage(1);
  }, [debouncedQ, cat, brand, stockFilter, pageSize]);

  // UI state
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  // The everyday change (a new price, a re-count) gets its own small popup —
  // the full form is 25 fields across seven sections, which is the wrong tool
  // for "cement went up ten taka". See QuickUpdateModal.
  const [quickUpdateId, setQuickUpdateId] = useState<string | null>(null);

  /**
   * Server already narrowed by text / category / brand / stock state. The price
   * range has no server-side field, so it stays CLIENT-side over this page's rows.
   */
  const filtered = useMemo(() => {
    if (priceMin === '' && priceMax === '') return list;
    return list.filter((p) => {
      if (priceMin !== '' && p.price < Number(priceMin)) return false;
      if (priceMax !== '' && p.price > Number(priceMax)) return false;
      return true;
    });
  }, [list, priceMin, priceMax]);

  // Stock/retail value sums cover the LOADED PAGE only — the rest of the
  // catalogue was never fetched. Labelled "this page"; Reports has the full
  // figures. Only the product COUNT is a real total (it comes from the query).
  const totals = useMemo(
    () => ({
      products: total,
      stockValue: filtered.reduce((s, p) => s + p.stock * p.cost, 0),
      retailValue: filtered.reduce((s, p) => s + p.stock * p.price, 0),
      low: filtered.filter((p) => p.stock <= p.reorderLevel).length,
    }),
    [filtered, total],
  );

  const allSelectedOnPage = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleSelectAll = () => {
    setSelected((sel) => {
      const next = new Set(sel);
      if (allSelectedOnPage) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const toggleSelect = (id: string) =>
    setSelected((sel) => {
      const next = new Set(sel);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /**
   * Remove products from the catalogue.
   *
   * This used to be a bare confirm followed by a delete that frequently failed
   * with "Cannot delete: product has sales history" and left the owner stuck.
   * Now the backend is ASKED FIRST (`products.usage`) and each product is routed
   * to the only correct outcome:
   *
   *   - referenced by an invoice/purchase/transfer → ARCHIVE. Deleting it would
   *     rewrite the shop's history, and SQLite refuses it anyway (the document
   *     tables reference products(id) with no ON DELETE clause).
   *   - never traded, but still has stock → DELETE with force, after saying so.
   *   - never traded, no stock → plain DELETE.
   *
   * The two groups are confirmed separately, because they are genuinely
   * different decisions and one of them is not reversible.
   */
  const removeProducts = async (ids: string[]) => {
    if (ids.length === 0) return;

    let usages: { id: string; usage: ProductUsage }[];
    try {
      usages = await Promise.all(
        ids.map(async (id) => ({ id, usage: await productUsage.mutateAsync(id) })),
      );
    } catch (e) {
      toast.error('Could not check what these products are used for', {
        description: e instanceof Error ? e.message : undefined,
      });
      return;
    }

    const nameOf = (id: string) => list.find((p) => p.id === id)?.name ?? id;
    const deletable = usages.filter((u) => u.usage.deletable);
    const mustArchive = usages.filter((u) => !u.usage.deletable);
    const withStock = deletable.filter((u) => Math.abs(u.usage.stock) > 0.001);

    let deleted = 0;
    let archived = 0;

    if (deletable.length > 0) {
      if (!canDelete) {
        toast.error('Only an admin can delete a product', {
          description: 'Ask the owner to sign in, or mark the product “not for sale”.',
        });
      } else {
        const stockNote =
          withStock.length > 0
            ? ` ${withStock.length} of them still ${withStock.length === 1 ? 'has' : 'have'} stock on hand, which will be discarded.`
            : '';
        const ok = await confirm({
          title:
            deletable.length === 1
              ? `Delete "${nameOf(deletable[0].id)}" for good?`
              : `Delete ${deletable.length} products for good?`,
          message: `This cannot be undone.${stockNote}`,
          confirmLabel: 'Delete',
          variant: 'destructive',
        });
        if (ok) {
          for (const u of deletable) {
            try {
              // force: the stock guard is a prompt, and we have just shown it.
              await deleteProduct.mutateAsync({ id: u.id, force: true });
              deleted++;
            } catch (e) {
              toast.error(`Could not delete "${nameOf(u.id)}"`, {
                description: e instanceof Error ? e.message : undefined,
              });
            }
          }
        }
      }
    }

    if (mustArchive.length > 0) {
      const first = mustArchive[0];
      const what = mustArchive.map((u) => u.usage.documents.map((d) => d.label)).flat();
      const kinds = [...new Set(what)].join(', ');
      if (!canArchive) {
        toast.error('Only a manager or admin can retire a product', {
          description: `${mustArchive.length} product(s) have ${kinds} and cannot be deleted.`,
        });
      } else {
        const ok = await confirm({
          title:
            mustArchive.length === 1
              ? `Archive "${nameOf(first.id)}" instead?`
              : `Archive ${mustArchive.length} products instead?`,
          message: `${mustArchive.length === 1 ? 'It appears' : 'They appear'} in your ${kinds}, so deleting would rewrite past records. Archiving hides ${mustArchive.length === 1 ? 'it' : 'them'} from the catalogue and the POS, keeps every past invoice intact, and can be undone.`,
          confirmLabel: 'Archive',
        });
        if (ok) {
          for (const u of mustArchive) {
            try {
              await archiveProduct.mutateAsync({ id: u.id });
              archived++;
            } catch (e) {
              toast.error(`Could not archive "${nameOf(u.id)}"`, {
                description: e instanceof Error ? e.message : undefined,
              });
            }
          }
        }
      }
    }

    const done: string[] = [];
    if (deleted > 0) done.push(`${deleted} deleted`);
    if (archived > 0) done.push(`${archived} archived`);
    if (done.length > 0) toast.success(done.join(' · '));

    setSelected(new Set());
  };

  const duplicate = async (id: string) => {
    const src = list.find((p) => p.id === id);
    if (!src) return;
    const copy: Product = {
      ...src,
      id: 'p_' + Date.now(),
      name: src.name + ' (copy)',
      sku: src.sku + '-CP' + Math.floor(Math.random() * 1000),
      barcode: '',
    };
    try {
      await createProduct.mutateAsync(copy);
      toast.success('Product duplicated');
    } catch (e) {
      toast.error('Duplicate failed', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const upsert = async (p: Product) => {
    try {
      const exists = list.some((x) => x.id === p.id);
      if (exists) await updateProduct.mutateAsync(p);
      else await createProduct.mutateAsync(p);
      toast.success('Product saved');
    } catch (e) {
      toast.error('Save failed', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const editing = quickEditId ? list.find((p) => p.id === quickEditId) : undefined;
  const quickUpdating = quickUpdateId ? list.find((p) => p.id === quickUpdateId) : undefined;

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${formatNumber(totals.products)} products`}
        actions={
          <>
            <IconBtn title="Customize columns" onClick={() => setColumnsOpen(true)}>
              <Settings2 className="size-4" />
            </IconBtn>
            <ViewToggle />
            <Button variant="outline" size="sm">
              <Upload className="size-4" /> Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="size-4" /> Export
            </Button>
            <Button variant="outline" size="sm">
              <Barcode className="size-4" /> Barcode
            </Button>
            {/* Entering new stock is a stock-keeper's job, so this stays visible
                for them; a cashier has `products.view` only and never sees it. */}
            {canCreate && (
              <Button onClick={() => nav('/products/new')}>
                <Plus className="size-4" /> Add Product
              </Button>
            )}
          </>
        }
      />

      <div className="p-6 space-y-4">
        {/* Product count is the real filtered total; the value sums are
            PAGE-SCOPED, since only this page is in memory. */}
        <div>
          <div className="text-[11px] text-muted-foreground mb-1.5">
            Totals for this page only. Use Reports for full-range figures.
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total Products" value={formatNumber(totals.products)} />
            <Stat label="Stock Value (Cost, this page)" value={formatBDT(totals.stockValue)} />
            <Stat
              label="Retail Value (this page)"
              value={formatBDT(totals.retailValue)}
              tone="primary"
            />
            <Stat label="Low Stock (this page)" value={String(totals.low)} tone="warning" />
          </div>
        </div>

        {/* Filters */}
        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, SKU, barcode…"
              className="pl-9"
            />
          </div>
          <Select value={cat} onChange={setCat}>
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={brand} onChange={setBrand}>
            <option value="all">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
            {(['all', 'in', 'low', 'out'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStockFilter(s)}
                className={cn(
                  'px-3 py-1 rounded capitalize font-medium transition',
                  stockFilter === s
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s === 'all' ? 'All' : s === 'in' ? 'In' : s === 'low' ? 'Low' : 'Out'}
              </button>
            ))}
          </div>
          <Popover
            width="w-72"
            align="right"
            trigger={(_o, set) => (
              <Button variant="outline" size="sm" onClick={() => set(true)}>
                <Filter className="size-3.5" /> More
                <ChevronDown className="size-3" />
              </Button>
            )}
          >
            {() => (
              <div className="p-3 space-y-3">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">
                    Price range (৳)
                  </div>
                  <div className="text-[11px] text-muted-foreground mb-1.5">
                    Price filters this page
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={priceMin}
                      onChange={(e) =>
                        setPriceMin(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="Min"
                    />
                    <Input
                      type="number"
                      value={priceMax}
                      onChange={(e) =>
                        setPriceMax(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="Max"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setPriceMin('');
                    setPriceMax('');
                  }}
                >
                  Clear
                </Button>
              </div>
            )}
          </Popover>
        </Card>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 flex items-center gap-2">
            <Badge variant="info">{selected.size} selected</Badge>
            <div className="flex-1" />
            <Button variant="outline" size="sm">
              <Barcode className="size-3.5" /> Print Barcode
            </Button>
            <Button variant="outline" size="sm">
              <Download className="size-3.5" /> Export
            </Button>
            <Button variant="outline" size="sm">
              Bulk Update
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!canDelete && !canArchive}
              title={
                canDelete || canArchive
                  ? undefined
                  : 'Only an admin can remove products from the catalogue'
              }
              onClick={() => removeProducts(Array.from(selected))}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}

        {/* Body */}
        {productsQuery.isLoading ? (
          <SkeletonTable count={8} />
        ) : view === 'table' ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50 sticky top-0">
                  <tr>
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allSelectedOnPage}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    {columns.map((col) => (
                      <ColumnHeader key={col} col={col} />
                    ))}
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      className={cn(
                        'border-t border-border group hover:bg-secondary/40',
                        selected.has(p.id) && 'bg-primary/5',
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                        />
                      </td>
                      {columns.map((col) => (
                        <Cell key={col} col={col} p={p} catName={categoryName} brandNameFn={brandName} />
                      ))}
                      <td className="px-2 py-2.5">
                        <RowActions
                          onQuickUpdate={canEdit ? () => setQuickUpdateId(p.id) : undefined}
                          onEdit={canEdit ? () => setQuickEditId(p.id) : undefined}
                          onView={() => nav(`/products/${p.id}`)}
                          onDuplicate={canCreate ? () => duplicate(p.id) : undefined}
                          // Hidden rather than disabled for a cashier: a row of
                          // greyed-out buttons they can never use is just noise.
                          onDelete={
                            canDelete || canArchive ? () => removeProducts([p.id]) : undefined
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + 2} className="px-4 py-12 text-center text-muted-foreground">
                        No products match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="products"
              busy={productsQuery.isFetching}
            />
          </Card>
        ) : (
          <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((p) => {
              const oos = p.stock <= 0;
              const low = p.stock > 0 && p.stock <= p.reorderLevel;
              return (
                <button
                  key={p.id}
                  // Tapping a card opens the small price/stock popup, not the
                  // 25-field form — that is what a tap on a product means here.
                  onClick={() => setQuickUpdateId(p.id)}
                  title="Update price & stock"
                  className="group text-left rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition overflow-hidden"
                >
                  <div className="aspect-[4/3] bg-gradient-to-br from-secondary to-muted grid place-items-center relative">
                    <ProductImage url={p.image} categoryId={p.categoryId} size={64} rounded="lg" />
                    <div className="absolute top-2 right-2">
                      <Badge variant={oos ? 'destructive' : low ? 'warning' : 'success'}>
                        {p.stock} {p.unit}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="text-[10px] text-muted-foreground font-mono truncate">{p.sku}</div>
                    <div className="text-[12px] font-medium leading-tight line-clamp-2 mt-0.5 min-h-[2.2em]">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {brandName(p.brandId)} · {categoryName(p.categoryId)}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-sm font-bold font-mono tabular">
                        ৳ {formatBDT(p.price, { withSymbol: false })}
                      </div>
                      {p.cost > 0 && (
                        <div className="text-[10px] text-muted-foreground font-mono tabular">
                          cost ৳ {p.cost}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <Card className="p-12 text-center text-muted-foreground col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-5">
                No products match these filters.
              </Card>
            )}
          </div>
          <Card className="overflow-hidden">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="products"
              busy={productsQuery.isFetching}
            />
          </Card>
          </div>
        )}
      </div>

      {columnsOpen && <ColumnsCustomize onClose={() => setColumnsOpen(false)} />}

      {quickUpdating && (
        <QuickUpdateModal product={quickUpdating} onClose={() => setQuickUpdateId(null)} />
      )}

      <Drawer
        open={!!quickEditId}
        onClose={() => setQuickEditId(null)}
        width="max-w-3xl"
        title="Edit Product"
        subtitle={editing?.name}
      >
        {editing && (
          <ProductForm
            asDrawer
            initial={editing}
            onSave={(p) => {
              upsert(p);
              setQuickEditId(null);
            }}
            onCancel={() => setQuickEditId(null)}
            onDelete={() => {
              removeProducts([editing.id]);
              setQuickEditId(null);
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

function ViewToggle() {
  const { view, setView } = useProductsUI();
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
      <button
        onClick={() => setView('table')}
        title="Table view"
        className={cn(
          'h-7 px-2 rounded inline-flex items-center gap-1 transition',
          view === 'table'
            ? 'bg-card shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <List className="size-3.5" />
      </button>
      <button
        onClick={() => setView('grid')}
        title="Grid view"
        className={cn(
          'h-7 px-2 rounded inline-flex items-center gap-1 transition',
          view === 'grid'
            ? 'bg-card shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <LayoutGrid className="size-3.5" />
      </button>
    </div>
  );
}

function ColumnHeader({ col }: { col: ProductColumn }) {
  const meta = COLUMN_META[col];
  return (
    <th
      className={cn(
        'font-medium px-2 py-2.5',
        meta.align === 'right' ? 'text-right' : 'text-left',
        col === 'image' && 'w-12',
      )}
    >
      {col === 'image' ? '' : meta.label}
    </th>
  );
}

function Cell({
  col,
  p,
  catName,
  brandNameFn,
}: {
  col: ProductColumn;
  p: Product;
  catName: (id: string) => string;
  brandNameFn: (id: string) => string;
}) {
  const meta = COLUMN_META[col];
  const align = meta.align === 'right' ? 'text-right font-mono tabular' : '';

  switch (col) {
    case 'image':
      return (
        <td className="px-2 py-2.5">
          <ProductImage url={p.image} categoryId={p.categoryId} size={36} />
        </td>
      );
    case 'sku':
      return (
        <td className="px-2 py-2.5 text-[11px] text-muted-foreground font-mono">{p.sku}</td>
      );
    case 'barcode':
      return (
        <td className="px-2 py-2.5 text-[11px] text-muted-foreground font-mono">{p.barcode}</td>
      );
    case 'name':
      return (
        <td className="px-2 py-2.5">
          <div className="font-medium">{p.name}</div>
          <div className="text-[11px] text-muted-foreground font-mono">{p.sku}</div>
        </td>
      );
    case 'category':
      return <td className="px-2 py-2.5">{catName(p.categoryId)}</td>;
    case 'brand':
      return <td className="px-2 py-2.5">{brandNameFn(p.brandId)}</td>;
    case 'unit':
      return <td className="px-2 py-2.5 text-xs">{p.unit}</td>;
    case 'cost':
      return (
        <td className={`px-2 py-2.5 ${align} tabular`}>
          {formatBDT(p.cost, { withSymbol: false })}
        </td>
      );
    // Mean of every recorded buying price. '—' when nothing is on record rather
    // than a misleading 0.
    case 'avgCost':
      return (
        <td className={`px-2 py-2.5 ${align} tabular text-muted-foreground`}>
          {p.avgCost && p.avgCost > 0 ? formatBDT(p.avgCost, { withSymbol: false }) : '—'}
        </td>
      );
    case 'price':
      return (
        <td className={`px-2 py-2.5 ${align} font-semibold`}>
          {formatBDT(p.price, { withSymbol: false })}
        </td>
      );
    case 'wholesalePrice':
      return (
        <td className={`px-2 py-2.5 ${align} text-muted-foreground`}>
          {p.wholesalePrice ? formatBDT(p.wholesalePrice, { withSymbol: false }) : '—'}
        </td>
      );
    case 'contractorPrice':
      return (
        <td className={`px-2 py-2.5 ${align} text-muted-foreground`}>
          {p.contractorPrice ? formatBDT(p.contractorPrice, { withSymbol: false }) : '—'}
        </td>
      );
    case 'stock':
      return (
        <td className={`px-2 py-2.5 ${align}`}>
          {p.stock} <span className="text-muted-foreground text-xs">{p.unit}</span>
        </td>
      );
    case 'reorderLevel':
      return (
        <td className={`px-2 py-2.5 ${align} text-muted-foreground`}>{p.reorderLevel}</td>
      );
    case 'tax':
      return <td className={`px-2 py-2.5 ${align}`}>{p.tax ?? 0}%</td>;
    case 'warranty':
      return <td className="px-2 py-2.5 text-muted-foreground text-xs">—</td>;
    case 'updatedAt':
      return (
        <td className="px-2 py-2.5 text-muted-foreground text-xs">
          {p.updatedAt ? relativeTime(p.updatedAt) : '—'}
        </td>
      );
    case 'status': {
      const oos = p.stock === 0;
      const low = p.stock > 0 && p.stock <= p.reorderLevel;
      return (
        <td className="px-2 py-2.5">
          {oos ? (
            <Badge variant="destructive">Out</Badge>
          ) : low ? (
            <Badge variant="warning">Low</Badge>
          ) : (
            <Badge variant="success">In</Badge>
          )}
        </td>
      );
    }
  }
}

/**
 * Row actions, ordered by how often a shopkeeper needs them.
 *
 * The visible button is "Update price & stock" — the everyday job — with a real
 * label rather than a bare pencil icon, and always at full opacity so it is not
 * hidden until hover. Editing the other 23 fields is a rarer, deliberate act, so
 * it moves into the overflow menu.
 */
function RowActions({
  onQuickUpdate,
  onEdit,
  onView,
  onDuplicate,
  onDelete,
}: {
  // Each action is omitted rather than disabled when the signed-in user may not
  // perform it: a row of permanently greyed-out buttons teaches a cashier to
  // ignore the whole column.
  onQuickUpdate?: () => void;
  onEdit?: () => void;
  onView: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {onQuickUpdate && (
        <button
          onClick={onQuickUpdate}
          className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-xs font-medium hover:bg-secondary hover:border-primary/50 transition"
          title="Update price & stock"
        >
          <Tags className="size-3.5" />
          <span className="hidden xl:inline">Update</span>
        </button>
      )}
      <Popover
        align="right"
        width="w-52"
        trigger={(_o, set) => (
          <button
            onClick={() => set(true)}
            className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="More"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        )}
      >
        {(close) => (
          <div className="py-1">
            {onEdit && (
              <MenuItem
                icon={Edit2}
                label="Edit all details"
                onClick={() => {
                  close();
                  onEdit();
                }}
              />
            )}
            <MenuItem
              icon={Eye}
              label="Open full page"
              onClick={() => {
                close();
                onView();
              }}
            />
            {onDuplicate && (
              <MenuItem
                icon={Copy}
                label="Duplicate"
                onClick={() => {
                  close();
                  onDuplicate();
                }}
              />
            )}
            {onDelete && (
              <>
                <div className="border-t border-border my-1" />
                <MenuItem
                  icon={Trash2}
                  label="Delete"
                  danger
                  onClick={() => {
                    close();
                    onDelete();
                  }}
                />
              </>
            )}
          </div>
        )}
      </Popover>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary',
        danger && 'text-destructive hover:bg-destructive/10',
      )}
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'warning';
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          'text-xl font-bold mt-0.5',
          tone === 'primary' && 'text-primary',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </div>
    </Card>
  );
}

function Select<T extends string>({
  value,
  onChange,
  children,
}: {
  value: T;
  onChange: (v: T) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-9 px-3 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
    >
      {children}
    </select>
  );
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-9 w-9 grid place-items-center rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition"
    >
      {children}
    </button>
  );
}

// suppress unused
void Link;
