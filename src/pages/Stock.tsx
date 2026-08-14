import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Settings2,
  Download,
  ArrowLeftRight,
  AlertTriangle,
  PackageX,
  Sliders,
  Tags,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ColumnsPanel } from '@/components/ui/ColumnsPanel';
import { Pagination } from '@/components/ui/Pagination';
import { ProductImage } from '@/components/products/ProductImage';
import { QuickUpdateModal } from '@/components/products/QuickUpdateModal';
import type { Product } from '@/types/domain';
import { formatBDT, formatNumber, cn, relativeTime } from '@/lib/utils';
import {
  ALL_STOCK_COLUMNS,
  STOCK_COLUMN_META,
  useStockUI,
  type StockColumn,
} from '@/stores/stockUI';
import { useProductsPage } from '@/hooks/useProducts';
import { useCategories, useBrands } from '@/hooks/useCatalog';
import { SkeletonTable } from '@/components/ui/Skeleton';

export default function Stock() {
  const nav = useNavigate();
  const { columns, toggle, move, reset } = useStockUI();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | 'all'>('all');
  const [brand, setBrand] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
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

  // The server already applied every filter it supports, so this page's rows ARE
  // the result set.
  const filtered = products;

  /** The row open in the price/stock popup, resolved from the loaded page. */
  const quickUpdating = quickUpdateId ? products.find((p) => p.id === quickUpdateId) : undefined;

  // Value / unit sums cover the LOADED PAGE only — the rest of the catalogue was
  // never fetched. Only the product COUNT is a real total (from the query).
  const totals = useMemo(() => {
    return {
      products: total,
      units: products.reduce((s, p) => s + p.stock, 0),
      cost: products.reduce((s, p) => s + p.stock * p.cost, 0),
      retail: products.reduce((s, p) => s + p.stock * p.price, 0),
      low: products.filter((p) => p.stock > 0 && p.stock <= p.reorderLevel).length,
      out: products.filter((p) => p.stock <= 0).length,
    };
  }, [products, total]);

  return (
    <div>
      <PageHeader
        title="Stock Report"
        subtitle={`${formatNumber(totals.products)} products`}
        actions={
          <>
            <IconBtn title="Customize columns" onClick={() => setColsOpen(true)}>
              <Settings2 className="size-4" />
            </IconBtn>
            <Link to="/stock/alerts">
              {/* The badge counts THIS PAGE's rows — the full catalogue is no
                  longer loaded here. The Alerts screen owns the real totals. */}
              <Button variant="outline" size="sm" title="Low or out of stock on this page">
                <AlertTriangle className="size-4" /> Alerts
                {totals.low + totals.out > 0 && (
                  <Badge variant="warning" className="ml-1">
                    {totals.low + totals.out}
                  </Badge>
                )}
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => nav('/stock/transfers')}>
              <ArrowLeftRight className="size-4" /> Transfers
            </Button>
            <Button variant="outline" size="sm" onClick={() => nav('/stock/adjustments')}>
              <Sliders className="size-4" /> Adjustments
            </Button>
            <Button variant="outline" size="sm">
              <Download className="size-4" /> Export
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        {/* Product count is the real filtered total; everything else is
            PAGE-SCOPED, since only this page is in memory. */}
        <div>
          <div className="text-[11px] text-muted-foreground mb-1.5">
            Totals for this page only. Use Reports for full-range figures.
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Stat label="Products" value={formatNumber(totals.products)} />
            <Stat label="Total Units (this page)" value={formatNumber(totals.units)} />
            <Stat label="Value @ Cost (this page)" value={formatBDT(totals.cost)} />
            <Stat
              label="Value @ Retail (this page)"
              value={formatBDT(totals.retail)}
              tone="primary"
            />
            <Stat label="Low Stock (this page)" value={String(totals.low)} tone="warning" />
            <Stat label="Out of Stock (this page)" value={String(totals.out)} tone="destructive" />
          </div>
        </div>

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
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All categories</option>
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
            <option value="all">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
            {(['all', 'in', 'low', 'out'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1 rounded font-medium transition capitalize',
                  statusFilter === s
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s === 'all' ? 'All' : s === 'in' ? 'In' : s === 'low' ? 'Low' : 'Out'}
              </button>
            ))}
          </div>
        </Card>

        {productsQuery.isLoading ? (
          <SkeletonTable count={8} />
        ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50 sticky top-0">
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
                      {STOCK_COLUMN_META[c].label}
                    </th>
                  ))}
                  <th className="w-28"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-secondary/40">
                    {columns.map((col) => (
                      <Cell key={col} col={col} p={p} catName={categoryName} brandNameFn={brandName} />
                    ))}
                    {/*
                      This screen had NO per-row action, so correcting one count
                      meant leaving for /stock/adjustments/new and filling in a
                      multi-line document. Counting a shelf and typing the number
                      is the single most common stock task in a hardware shop.
                    */}
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => setQuickUpdateId(p.id)}
                        className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-xs font-medium hover:bg-secondary hover:border-primary/50 transition"
                        title="Update price & stock"
                      >
                        <Tags className="size-3.5" />
                        <span className="hidden xl:inline">Update</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No products match.
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
  const align = STOCK_COLUMN_META[col].align === 'right' ? 'text-right font-mono tabular' : '';
  switch (col) {
    case 'image':
      return (
        <td className="px-3 py-2.5">
          <ProductImage url={p.image} categoryId={p.categoryId} size={36} />
        </td>
      );
    case 'sku':
      return <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{p.sku}</td>;
    case 'barcode':
      return <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{p.barcode}</td>;
    case 'name':
      return (
        <td className="px-3 py-2.5">
          <div className="font-medium">{p.name}</div>
          <div className="text-[11px] text-muted-foreground font-mono">{p.sku}</div>
        </td>
      );
    case 'category':
      return <td className="px-3 py-2.5">{catName(p.categoryId)}</td>;
    case 'brand':
      return <td className="px-3 py-2.5">{brandNameFn(p.brandId)}</td>;
    case 'unit':
      return <td className="px-3 py-2.5 text-xs">{p.unit}</td>;
    case 'stock':
      return (
        <td className={cn('px-3 py-2.5', align)}>
          {p.stock} <span className="text-xs text-muted-foreground">{p.unit}</span>
        </td>
      );
    case 'reorder':
      return <td className={cn('px-3 py-2.5 text-muted-foreground', align)}>{p.reorderLevel}</td>;
    case 'valueCost':
      return <td className={cn('px-3 py-2.5', align)}>{formatBDT(p.stock * p.cost, { withSymbol: false })}</td>;
    case 'valueRetail':
      return <td className={cn('px-3 py-2.5', align)}>{formatBDT(p.stock * p.price, { withSymbol: false })}</td>;
    case 'lastSold':
      return <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.updatedAt ? relativeTime(p.updatedAt) : '—'}</td>;
    case 'lastReceived':
      return <td className="px-3 py-2.5 text-xs text-muted-foreground">—</td>;
    case 'status': {
      const oos = p.stock <= 0;
      const low = p.stock > 0 && p.stock <= p.reorderLevel;
      return (
        <td className="px-3 py-2.5">
          {oos ? (
            <Badge variant="destructive">
              <PackageX className="size-3" /> Out
            </Badge>
          ) : low ? (
            <Badge variant="warning">
              <AlertTriangle className="size-3" /> Low
            </Badge>
          ) : (
            <Badge variant="success">In</Badge>
          )}
        </td>
      );
    }
  }
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'warning' | 'destructive';
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          'text-lg font-bold mt-0.5 tabular',
          tone === 'primary' && 'text-primary',
          tone === 'warning' && 'text-warning',
          tone === 'destructive' && 'text-destructive',
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
      className="h-9 w-9 grid place-items-center rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition"
    >
      {children}
    </button>
  );
}
