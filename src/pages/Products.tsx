import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Download,
  Barcode,
  Edit2,
  Trash2,
  Settings2,
  LayoutGrid,
  List,
  Copy,
  Eye,
  MoreHorizontal,
  Tags,
  Archive,
  ArchiveRestore,
  Package,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Popover } from '@/components/ui/Popover';
import { Drawer } from '@/components/ui/Drawer';
import { Pagination } from '@/components/ui/Pagination';
import { Select as UISelect } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { IconButton } from '@/components/ui/IconButton';
import { Switch } from '@/components/ui/Switch';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Product } from '@/types/domain';
import { formatBDT, cn, relativeTime } from '@/lib/utils';
import {
  COLUMN_META,
  useProductsUI,
  type ProductColumn,
} from '@/stores/products';
import { useBackup } from '@/stores/backup';
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
  useUnarchiveProduct,
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
  const exportCsv = useBackup((s) => s.exportCsv);
  const exportBusy = useBackup((s) => s.busy);
  const { view, setView, columns } = useProductsUI();

  const categoriesQuery = useCategories();
  const brandsQuery = useBrands();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const archiveProduct = useArchiveProduct();
  const unarchiveProduct = useUnarchiveProduct();
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

  // Filters. Category / brand / stock state / text all go to the SERVER.
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [cat, setCat] = useState<string | 'all'>('all');
  const [brand, setBrand] = useState<string | 'all'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  /**
   * ARCHIVED VIEW.
   *
   * Archiving was reachable (it is what the Delete flow falls back to for a
   * product that has been traded) but archived products were then invisible and
   * had no route back, so a retired product was only recoverable by someone who
   * knew `products.unarchive` existed. This switches the same table over to the
   * retired rows, where the only offered action is Restore.
   */
  const [showArchived, setShowArchived] = useState(false);

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
    archivedOnly: showArchived,
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
  }, [debouncedQ, cat, brand, stockFilter, pageSize, showArchived]);

  // UI state
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  // The everyday change (a new price, a re-count) gets its own small popup —
  // the full form is 25 fields across seven sections, which is the wrong tool
  // for "cement went up ten taka". See QuickUpdateModal.
  const [quickUpdateId, setQuickUpdateId] = useState<string | null>(null);

  // Switching between the catalogue and the archive drops the selection: the two
  // lists are disjoint, so carrying ids across would aim a bulk action at rows
  // that are no longer on screen.
  useEffect(() => {
    setSelected(new Set());
  }, [showArchived]);

  // The server already narrowed by text / category / brand / stock state.
  const filtered = list;
  const hasFilters = !!debouncedQ || cat !== 'all' || brand !== 'all' || stockFilter !== 'all';
  const clearFilters = () => {
    setQ('');
    setCat('all');
    setBrand('all');
    setStockFilter('all');
  };

  // Value sums cover the LOADED PAGE only. When the page holds every match,
  // they are the real totals and the "this page" note is dropped.
  const pageScoped = total > pageSize;
  const totals = useMemo(
    () => ({
      stockValue: filtered.reduce((s, p) => s + p.stock * p.cost, 0),
      retailValue: filtered.reduce((s, p) => s + p.stock * p.price, 0),
      low: filtered.filter((p) => p.stock <= p.reorderLevel).length,
    }),
    [filtered],
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
        // Static sentences (no names or counts inside) so Bangla can translate them.
        const one = deletable.length === 1;
        const ok = await confirm({
          title: one ? 'Delete this product for good?' : 'Delete the selected products for good?',
          message:
            withStock.length === 0
              ? 'This cannot be undone.'
              : one
                ? 'This cannot be undone. It still has stock on hand, which will be discarded.'
                : 'This cannot be undone. Some of them still have stock on hand, which will be discarded.',
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
              toast.error('Could not delete a product', {
                description: `${nameOf(u.id)}${e instanceof Error ? ': ' + e.message : ''}`,
              });
            }
          }
        }
      }
    }

    if (mustArchive.length > 0) {
      const one = mustArchive.length === 1;
      if (!canArchive) {
        toast.error('Only a manager or admin can retire a product', {
          description: 'It appears in past sales or purchases, so it cannot be deleted.',
        });
      } else {
        const ok = await confirm({
          title: one ? 'Archive this product instead?' : 'Archive the selected products instead?',
          message: one
            ? 'It appears in past sales or purchases, so deleting would rewrite past records. Archiving hides it from the catalogue and the POS, keeps every past invoice intact, and can be undone.'
            : 'They appear in past sales or purchases, so deleting would rewrite past records. Archiving hides them from the catalogue and the POS, keeps every past invoice intact, and can be undone.',
          confirmLabel: 'Archive',
        });
        if (ok) {
          for (const u of mustArchive) {
            try {
              await archiveProduct.mutateAsync({ id: u.id });
              archived++;
            } catch (e) {
              toast.error('Could not archive a product', {
                description: `${nameOf(u.id)}${e instanceof Error ? ': ' + e.message : ''}`,
              });
            }
          }
        }
      }
    }

    if (deleted > 0) toast.success(deleted === 1 ? 'Product deleted' : 'Products deleted');
    if (archived > 0) toast.success(archived === 1 ? 'Product archived' : 'Products archived');

    setSelected(new Set());
  };

  /**
   * Bring retired products back into the catalogue.
   *
   * Deliberately confirmed even though it is the harmless direction: restoring
   * puts the product back in the POS grid, where the next person at the counter
   * can sell it. `products.unarchive` is gated behind `products.edit`, the same
   * permission as archiving, so the check here only mirrors what the IPC boundary
   * will do anyway.
   */
  const restoreProducts = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!canArchive) {
      toast.error('Only a manager or admin can restore a product');
      return;
    }
    const nameOf = (id: string) => list.find((p) => p.id === id)?.name ?? id;
    const ok = await confirm({
      title:
        ids.length === 1
          ? 'Restore this product to the catalogue?'
          : 'Restore the selected products to the catalogue?',
      message:
        ids.length === 1
          ? 'It goes back into the product list, the POS and search. Its past invoices are unchanged.'
          : 'They go back into the product list, the POS and search. Their past invoices are unchanged.',
      confirmLabel: 'Restore',
    });
    if (!ok) return;

    let restored = 0;
    for (const id of ids) {
      try {
        await unarchiveProduct.mutateAsync({ id });
        restored++;
      } catch (e) {
        toast.error('Could not restore a product', {
          description: `${nameOf(id)}${e instanceof Error ? ': ' + e.message : ''}`,
        });
      }
    }
    if (restored > 0) toast.success(restored === 1 ? 'Product restored' : 'Products restored');
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

  /** Resolves true on success, so the drawer closes only after a real save. */
  const upsert = async (p: Product): Promise<boolean> => {
    try {
      const exists = list.some((x) => x.id === p.id);
      if (exists) await updateProduct.mutateAsync(p);
      else await createProduct.mutateAsync(p);
      toast.success('Product saved');
      return true;
    } catch (e) {
      toast.error('Save failed', { description: e instanceof Error ? e.message : undefined });
      return false;
    }
  };
  const selectedIds = () => Array.from(selected).join(',');

  const editing = quickEditId ? list.find((p) => p.id === quickEditId) : undefined;
  const quickUpdating = quickUpdateId ? list.find((p) => p.id === quickUpdateId) : undefined;

  // Drop any stored column this build no longer knows (e.g. the old 'warranty').
  const shownColumns = columns.filter((c) => c in COLUMN_META);

  const emptyBody = showArchived ? (
    <EmptyState
      compact
      icon={Archive}
      title="No archived products"
      message="Nothing has been retired from the catalogue."
    />
  ) : hasFilters ? (
    <EmptyState
      compact
      icon={Search}
      title="No products match these filters"
      action={
        <Button variant="outline" onClick={clearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      compact
      icon={Package}
      title="No products yet"
      message="Add your first product to start selling."
      action={
        canCreate ? (
          <Button onClick={() => nav('/products/new')}>
            <Plus className="size-4" /> Add product
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div>
      <PageHeader
        title={showArchived ? 'Archived products' : 'Products'}
        actions={
          <>
            <IconBtn title="Customize columns" onClick={() => setColumnsOpen(true)}>
              <Settings2 className="size-4" />
            </IconBtn>
            <ViewToggle />
            {/* Import is switched off until real importers exist (see /import). */}
            <Button
              variant="outline"
              disabled={exportBusy}
              onClick={() => void exportCsv('products')}
              title="Write every product to a CSV file in your backup folder"
            >
              <Download className="size-4" /> Export all
            </Button>
            <Button variant="outline" onClick={() => nav('/products/barcodes')}>
              <Barcode className="size-4" /> Barcode
            </Button>
            {/* Entering new stock is a stock-keeper's job; a cashier never sees it. */}
            {canCreate && (
              <Button onClick={() => nav('/products/new')}>
                <Plus className="size-4" /> Add product
              </Button>
            )}
          </>
        }
      />

      <div className="p-6 space-y-4">
        {showArchived && (
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm text-muted-foreground flex items-start gap-2">
            <Archive className="size-4 mt-0.5 shrink-0" />
            <span>
              These products are retired: they are out of the product list, out of the POS and out
              of search. Every past invoice, purchase and report that names them is unchanged.
              Restore one to bring it back.
            </span>
          </div>
        )}

        {/* Value sums are PAGE-SCOPED (only this page is in memory); the note
            shows only when the page does not hold every match. */}
        {!showArchived && (
          <div>
            {pageScoped && (
              <div className="text-xs text-muted-foreground mb-1.5">
                Totals for this page only. Use Reports for full-range figures.
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Stock value (buying price)" value={formatBDT(totals.stockValue)} />
              <Stat label="Retail value" value={formatBDT(totals.retailValue)} tone="primary" />
              <button
                type="button"
                onClick={() => setStockFilter('low')}
                title="Show low-stock products"
                className="text-left rounded-xl focus-ring"
              >
                <Stat
                  label="Low stock"
                  value={String(totals.low)}
                  tone="warning"
                  interactive
                />
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, SKU, barcode…"
              className="pl-9"
              aria-label="Search products"
            />
          </div>
          <UISelect
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="w-auto max-w-[12rem]"
            aria-label="Category"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </UISelect>
          <UISelect
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-auto max-w-[12rem]"
            aria-label="Brand"
          >
            <option value="all">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </UISelect>
          <Segmented
            ariaLabel="Stock"
            value={stockFilter}
            onChange={setStockFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'in', label: 'In stock' },
              { value: 'low', label: 'Low' },
              { value: 'out', label: 'Out of stock' },
            ]}
          />
          {/* Catalogue vs archive: it changes WHICH products the screen is about,
              so it is a toggle at the end, not another filter. */}
          <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <span>Show archived</span>
            <Switch
              checked={showArchived}
              onChange={setShowArchived}
              label="Show archived"
              showState={false}
            />
          </label>
        </Card>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tabular">{selected.size}</span>
            <span className="text-sm">selected</span>
            <div className="flex-1" />
            <Button
              variant="outline"
              onClick={() => nav(`/products/barcodes?ids=${encodeURIComponent(selectedIds())}`)}
            >
              <Barcode className="size-4" /> Print barcodes
            </Button>
            <Button
              variant="outline"
              onClick={() => nav(`/products/price-update?ids=${encodeURIComponent(selectedIds())}`)}
            >
              <Tags className="size-4" /> Bulk price update
            </Button>
            {/* In the archive the only bulk action is putting them back: an
                archived product is referenced by a document, so delete would fail. */}
            {showArchived ? (
              <Button
                disabled={!canArchive}
                title={canArchive ? undefined : 'Only a manager or admin can restore a product'}
                onClick={() => restoreProducts(Array.from(selected))}
              >
                <ArchiveRestore className="size-4" /> Restore
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={!canDelete && !canArchive}
                title={
                  canDelete || canArchive
                    ? undefined
                    : 'Only an admin can remove products from the catalogue'
                }
                onClick={() => removeProducts(Array.from(selected))}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
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
                <thead className="text-xs text-muted-foreground bg-secondary/50 sticky top-0">
                  <tr>
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={allSelectedOnPage}
                        onChange={toggleSelectAll}
                        aria-label="Select all on this page"
                      />
                    </th>
                    {shownColumns.map((col) => (
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
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          aria-label="Select"
                        />
                      </td>
                      {shownColumns.map((col) => (
                        <Cell
                          key={col}
                          col={col}
                          p={p}
                          catName={categoryName}
                          brandNameFn={brandName}
                          skuUnderName={!shownColumns.includes('sku')}
                        />
                      ))}
                      <td className="px-2 py-2">
                        <RowActions
                          // In the archive, Restore is the primary row action.
                          onRestore={
                            showArchived && canArchive ? () => restoreProducts([p.id]) : undefined
                          }
                          onQuickUpdate={
                            canEdit && !showArchived ? () => setQuickUpdateId(p.id) : undefined
                          }
                          onEdit={canEdit ? () => setQuickEditId(p.id) : undefined}
                          onView={() => nav(`/products/${p.id}`)}
                          onDuplicate={canCreate ? () => duplicate(p.id) : undefined}
                          // Hidden rather than disabled for a cashier.
                          onDelete={
                            !showArchived && (canDelete || canArchive)
                              ? () => removeProducts([p.id])
                              : undefined
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={shownColumns.length + 2}>{emptyBody}</td>
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
                    // A tap opens the small price/stock popup; in the archive it restores.
                    onClick={() =>
                      showArchived ? void restoreProducts([p.id]) : setQuickUpdateId(p.id)
                    }
                    title={showArchived ? 'Restore to the catalogue' : 'Update price & stock'}
                    className="group text-left rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition overflow-hidden"
                  >
                    <div className="aspect-[4/3] bg-gradient-to-br from-secondary to-muted grid place-items-center relative">
                      <ProductImage url={p.image} categoryId={p.categoryId} size={64} rounded="lg" />
                      <div className="absolute top-2 right-2">
                        {showArchived ? (
                          <Badge>Archived</Badge>
                        ) : (
                          <Badge variant={oos ? 'destructive' : low ? 'warning' : 'success'}>
                            {p.stock} {p.unit}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="text-xs text-muted-foreground font-mono truncate" data-no-i18n>
                        {p.sku}
                      </div>
                      <div className="text-sm font-medium leading-tight line-clamp-2 mt-0.5 min-h-[2.2em]">
                        {p.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {brandName(p.brandId)} · {categoryName(p.categoryId)}
                      </div>
                      <div className="text-sm font-bold tabular mt-2">
                        ৳ {formatBDT(p.price, { withSymbol: false })}
                      </div>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <Card className="col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-5">
                  {emptyBody}
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
        width="max-w-2xl"
        title="Edit product"
        subtitle={editing?.name}
      >
        {editing && (
          <ProductForm
            asDrawer
            initial={editing}
            onSave={async (p) => {
              // Close only after the save lands, so typed changes survive a failure.
              if (await upsert(p)) setQuickEditId(null);
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
    <Segmented
      ariaLabel="View"
      value={view}
      onChange={setView}
      options={[
        { value: 'table', label: <List className="size-4" />, title: 'Table view' },
        { value: 'grid', label: <LayoutGrid className="size-4" />, title: 'Grid view' },
      ]}
    />
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
  skuUnderName,
}: {
  col: ProductColumn;
  p: Product;
  catName: (id: string) => string;
  brandNameFn: (id: string) => string;
  /** SKU under the name, unless the SKU column is also showing. */
  skuUnderName: boolean;
}) {
  const meta = COLUMN_META[col];
  const align = meta.align === 'right' ? 'text-right tabular' : '';

  switch (col) {
    case 'image':
      return (
        <td className="px-2 py-2.5">
          <ProductImage url={p.image} categoryId={p.categoryId} size={36} />
        </td>
      );
    case 'sku':
      return (
        <td className="px-2 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap" data-no-i18n>
          {p.sku}
        </td>
      );
    case 'barcode':
      return (
        <td className="px-2 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap" data-no-i18n>
          {p.barcode}
        </td>
      );
    case 'name':
      return (
        <td className="px-2 py-2.5">
          <div className="font-medium">{p.name}</div>
          {skuUnderName && p.sku && (
            <div className="text-xs text-muted-foreground font-mono" data-no-i18n>
              {p.sku}
            </div>
          )}
        </td>
      );
    case 'category':
      return <td className="px-2 py-2.5 whitespace-nowrap">{catName(p.categoryId)}</td>;
    case 'brand':
      return <td className="px-2 py-2.5 whitespace-nowrap">{brandNameFn(p.brandId)}</td>;
    case 'unit':
      return <td className="px-2 py-2.5">{p.unit}</td>;
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
    // Plain number when stock is fine; a Low / Out of stock badge only on the
    // rows that need attention (replaces the old always-green Status column).
    case 'stock': {
      const tracked = p.manageStock !== false && !p.archivedAt;
      const oos = tracked && p.stock <= 0;
      const low = tracked && !oos && p.stock <= p.reorderLevel;
      return (
        <td className={`px-2 py-2.5 ${align} whitespace-nowrap`}>
          {oos && (
            <Badge variant="destructive" className="mr-2">
              Out of stock
            </Badge>
          )}
          {low && (
            <Badge variant="warning" className="mr-2">
              Low
            </Badge>
          )}
          {p.stock} <span className="text-muted-foreground text-xs">{p.unit}</span>
        </td>
      );
    }
    case 'reorderLevel':
      return (
        <td className={`px-2 py-2.5 ${align} text-muted-foreground`}>{p.reorderLevel}</td>
      );
    case 'tax':
      return <td className={`px-2 py-2.5 ${align}`}>{p.tax ?? 0}%</td>;
    case 'updatedAt':
      return (
        <td className="px-2 py-2.5 text-muted-foreground whitespace-nowrap">
          {p.updatedAt ? relativeTime(p.updatedAt) : '—'}
        </td>
      );
    case 'status': {
      const oos = p.stock === 0;
      const low = p.stock > 0 && p.stock <= p.reorderLevel;
      // Read off the row itself rather than the view flag: a retired product is
      // retired wherever it is rendered, and In/Low/Out would be misleading for
      // something that is no longer on sale at all.
      if (p.archivedAt) {
        return (
          <td className="px-2 py-2.5">
            <Badge>Archived</Badge>
          </td>
        );
      }
      return (
        <td className="px-2 py-2.5">
          {oos ? (
            <Badge variant="destructive">Out of stock</Badge>
          ) : low ? (
            <Badge variant="warning">Low</Badge>
          ) : (
            <Badge variant="success">In stock</Badge>
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
  onRestore,
  onEdit,
  onView,
  onDuplicate,
  onDelete,
}: {
  // Each action is omitted rather than disabled when the signed-in user may not
  // perform it: a row of permanently greyed-out buttons teaches a cashier to
  // ignore the whole column.
  onQuickUpdate?: () => void;
  /** Only in the Archived view — puts the product back in the catalogue. */
  onRestore?: () => void;
  onEdit?: () => void;
  onView: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {onRestore && (
        <button
          onClick={onRestore}
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary hover:border-primary/50 transition focus-ring"
          title="Restore to the catalogue"
        >
          <ArchiveRestore className="size-4" />
          <span className="hidden lg:inline">Restore</span>
        </button>
      )}
      {onQuickUpdate && (
        <button
          onClick={onQuickUpdate}
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium hover:bg-secondary hover:border-primary/50 transition focus-ring"
          title="Update price & stock"
        >
          <Tags className="size-4" />
          <span className="hidden lg:inline">Update</span>
        </button>
      )}
      <Popover
        align="right"
        width="w-52"
        trigger={(_o, set) => (
          <IconButton size="sm" label="More actions" onClick={() => set(true)}>
            <MoreHorizontal className="size-4" />
          </IconButton>
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
        'w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-secondary',
        danger && 'text-destructive hover:bg-destructive/10',
      )}
    >
      <Icon className="size-4" /> {label}
    </button>
  );
}

function Stat({
  label,
  value,
  tone,
  interactive,
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'warning';
  interactive?: boolean;
}) {
  return (
    <Card className={cn('p-3', interactive && 'hover:border-warning/60 transition')}>
      <div className="text-xs text-muted-foreground">{label}</div>
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
      className="h-10 w-10 grid place-items-center rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition"
    >
      {children}
    </button>
  );
}

