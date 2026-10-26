import { useEffect, useRef, useState } from 'react';
import { Search, Settings2, AlertTriangle, PackageX, Tags, PackageSearch } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ColumnsPanel } from '@/components/ui/ColumnsPanel';
import { Pagination } from '@/components/ui/Pagination';
import { ProductImage } from '@/components/products/ProductImage';
import { QuickUpdateModal } from '@/components/products/QuickUpdateModal';
import type { Product } from '@/types/domain';
import { formatNumber, cn } from '@/lib/utils';
import {
  ALL_STOCK_COLUMNS,
  STOCK_COLUMN_META,
  useStockUI,
  type StockColumn,
} from '@/stores/stockUI';
import { useProductsPage } from '@/hooks/useProducts';
import { useCategories, useBrands } from '@/hooks/useCatalog';
import { SkeletonTable } from '@/components/ui/Skeleton';

type StockFilter = 'all' | 'in' | 'low' | 'out';
const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'in', label: 'In stock' },
  { value: 'low', label: 'Low' },
  { value: 'out', label: 'Out of stock' },
] as const;

/** Whole taka for valuations — paisa on every row is noise. */
const taka = (v: number) => formatNumber(Math.round(v));

export default function Stock() {
  const { columns: savedColumns, toggle, move, reset } = useStockUI();
  // Ignore any column a saved layout still names but the table no longer has.
  const columns = savedColumns.filter((c) => (ALL_STOCK_COLUMNS as readonly string[]).includes(c));
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | 'all'>('all');
  const [brand, setBrand] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StockFilter>('all');
  const [colsOpen, setColsOpen] = useState(false);
  /** Row whose price/stock is being corrected in the popup. */
  const [quickUpdateId, setQuickUpdateId] = useState<string | null>(null);

  // Paging
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // The text search hits the DATABASE, so it is debounced ~300ms.
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(handle);
  }, [q]);

  // ONE PAGE of products. Category / brand / stock state / text are all pushed
  // down into SQL — a 5,000-row catalogue no longer lands in the renderer.
  const productsQuery = useProductsPage({
    page,
    pageSize,
    q: debouncedQ || undefined,
    categoryId: cat,
    brandId: brand,
    stockState: statusFilter === 'all' ? undefined : statusFilter,
  });
  const categoriesQuery = useCategories();
  const brandsQuery = useBrands();

  const products: Product[] = productsQuery.data?.rows ?? [];
  const total = productsQuery.data?.total ?? 0;
  const categories = categoriesQuery.data ?? [];
  const brands = brandsQuery.data ?? [];
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? '—';

  // Any filter change resets to page 1 — staying on page 9 of a narrower result
  // set would show an empty table.
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) {
      firstFilterRun.current = false;
      return;
    }
    setPage(1);
  }, [debouncedQ, cat, brand, statusFilter, pageSize]);

  const filtersOn = q !== '' || cat !== 'all' || brand !== 'all' || statusFilter !== 'all';
  const clearFilters = () => {
    setQ('');
    setCat('all');
    setBrand('all');
    setStatusFilter('all');
  };

  /** The row open in the price/stock popup, resolved from the loaded page. */
  const quickUpdating = quickUpdateId ? products.find((p) => p.id === quickUpdateId) : undefined;

  // The page-only stat cards and the Alerts / Transfers / Adjustments / Export
  // header buttons were removed: the cards summed one page (and mixed pc + bag
  // + kg), the buttons repeated the sidebar, and Export did nothing.
  return (
    <div>
      <PageHeader
        title="Stock"
        actions={
          <IconButton variant="outline" label="Customize columns" onClick={() => setColsOpen(true)}>
            <Settings2 className="size-4" />
          </IconButton>
        }
      />

      <div className="p-6 space-y-4">
        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, SKU, barcode…"
              className="pl-9"
              aria-label="Search products"
            />
          </div>
          <Select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="w-auto max-w-[14rem]"
            aria-label="Category"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-auto max-w-[14rem]"
            aria-label="Brand"
          >
            <option value="all">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Segmented
            ariaLabel="Stock status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />
        </Card>

        {productsQuery.isLoading ? (
          <SkeletonTable count={8} />
        ) : (
          // overflow-clip (not hidden/auto) so the sticky header sticks to the page scroll.
          <Card className="overflow-clip">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-secondary sticky top-0 z-10">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c}
                      className={cn(
                        'font-medium px-3 py-2.5 whitespace-nowrap',
                        STOCK_COLUMN_META[c].align === 'right' ? 'text-right' : 'text-left',
                        c === 'image' && 'w-12',
                      )}
                    >
                      {c === 'image' ? '' : STOCK_COLUMN_META[c].label}
                    </th>
                  ))}
                  <th className="w-28"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-secondary/40">
                    {columns.map((col) => (
                      <Cell key={col} col={col} p={p} catName={categoryName} brandNameFn={brandName} />
                    ))}
                    {/* Counting a shelf and typing the number is the most common stock task. */}
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setQuickUpdateId(p.id)}
                        className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-sm font-medium whitespace-nowrap hover:bg-secondary hover:border-primary/50 transition focus-ring"
                        title="Update price & stock"
                      >
                        <Tags className="size-4" />
                        <span>Update</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1}>
                      <EmptyState
                        compact
                        icon={PackageSearch}
                        title="No products match."
                        action={
                          filtersOn ? (
                            <Button variant="outline" onClick={clearFilters}>
                              Clear filters
                            </Button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
        )}
      </div>

      {colsOpen && (
        <ColumnsPanel
          all={ALL_STOCK_COLUMNS}
          visible={columns}
          meta={STOCK_COLUMN_META}
          onToggle={toggle}
          onMove={move}
          onReset={reset}
          onClose={() => setColsOpen(false)}
        />
      )}

      {quickUpdating && (
        <QuickUpdateModal product={quickUpdating} onClose={() => setQuickUpdateId(null)} />
      )}
    </div>
  );
}

function Cell({
  col,
  p,
  catName,
  brandNameFn,
}: {
  col: StockColumn;
  p: Product;
  catName: (id: string) => string;
  brandNameFn: (id: string) => string;
}) {
  const align = STOCK_COLUMN_META[col].align === 'right' ? 'text-right tabular whitespace-nowrap' : '';
  switch (col) {
    case 'image':
      return (
        <td className="px-3 py-2">
          <ProductImage url={p.image} categoryId={p.categoryId} size={36} />
        </td>
      );
    case 'sku':
      return <td className="px-3 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{p.sku}</td>;
    case 'barcode':
      return <td className="px-3 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{p.barcode}</td>;
    case 'name':
      return (
        <td className="px-3 py-2">
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
        </td>
      );
    case 'category':
      return <td className="px-3 py-3 whitespace-nowrap">{catName(p.categoryId)}</td>;
    case 'brand':
      return <td className="px-3 py-3 whitespace-nowrap">{brandNameFn(p.brandId)}</td>;
    case 'unit':
      return <td className="px-3 py-3">{p.unit}</td>;
    case 'stock':
      return (
        <td className={cn('px-3 py-3 font-medium', align)}>
          {formatNumber(p.stock)} <span className="text-xs font-normal text-muted-foreground">{p.unit}</span>
        </td>
      );
    case 'reorder':
      return <td className={cn('px-3 py-3 text-muted-foreground', align)}>{formatNumber(p.reorderLevel)}</td>;
    case 'valueCost':
      return <td className={cn('px-3 py-3', align)}>{taka(p.stock * p.cost)}</td>;
    case 'valueRetail':
      return <td className={cn('px-3 py-3', align)}>{taka(p.stock * p.price)}</td>;
    case 'status': {
      const oos = p.stock <= 0;
      const low = p.stock > 0 && p.stock <= p.reorderLevel;
      return (
        <td className="px-3 py-3">
          {oos ? (
            <Badge variant="destructive">
              <PackageX className="size-3.5" /> Out of stock
            </Badge>
          ) : low ? (
            <Badge variant="warning">
              <AlertTriangle className="size-3.5" /> Low
            </Badge>
          ) : (
            <Badge variant="success">In stock</Badge>
          )}
        </td>
      );
    }
  }
}
