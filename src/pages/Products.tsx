import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Popover } from '@/components/ui/Popover';
import { Drawer } from '@/components/ui/Drawer';
import {
  products as seedProducts,
  categories as seedCategories,
  brands as seedBrands,
  type Product,
} from '@/mocks/data';
import { formatBDT, formatNumber, cn, relativeTime } from '@/lib/utils';
import {
  COLUMN_META,
  useProductsUI,
  type ProductColumn,
} from '@/stores/products';
import { ProductImage } from '@/components/products/ProductImage';
import { ColumnsCustomize } from '@/components/products/ColumnsCustomize';
import { ProductForm } from '@/components/products/ProductForm';
import { hasBackend } from '@/lib/api';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '@/hooks/useProducts';
import { useCategories, useBrands } from '@/hooks/useCatalog';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { SkeletonTable } from '@/components/ui/Skeleton';

export default function Products() {
  const nav = useNavigate();
  const { view, setView, columns } = useProductsUI();
  const backend = hasBackend();

  // ----- Data source: backend when available, else mock seed -----
  const productsQuery = useProducts();
  const categoriesQuery = useCategories();
  const brandsQuery = useBrands();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [mockList, setMockList] = useState<Product[]>(seedProducts);

  const list: Product[] = backend ? (productsQuery.data ?? []) : mockList;
  const categories = backend
    ? (categoriesQuery.data ?? [])
    : seedCategories;
  const brands = backend ? (brandsQuery.data ?? []) : seedBrands;

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? '—';

  // Filters
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [cat, setCat] = useState<string | 'all'>('all');
  const [brand, setBrand] = useState<string | 'all'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [priceMin, setPriceMin] = useState<number | ''>('');
  const [priceMax, setPriceMax] = useState<number | ''>('');

  // UI state
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickEditId, setQuickEditId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return list.filter((p) => {
      if (cat !== 'all' && p.categoryId !== cat) return false;
      if (brand !== 'all' && p.brandId !== brand) return false;
      if (stockFilter === 'in' && p.stock <= 0) return false;
      if (stockFilter === 'low' && (p.stock <= 0 || p.stock > p.reorderLevel)) return false;
      if (stockFilter === 'out' && p.stock > 0) return false;
      if (priceMin !== '' && p.price < Number(priceMin)) return false;
      if (priceMax !== '' && p.price > Number(priceMax)) return false;
      if (q && !`${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(q.toLowerCase()))
        return false;
      return true;
    });
  }, [list, q, cat, brand, stockFilter, priceMin, priceMax]);

  const totals = {
    products: list.length,
    stockValue: list.reduce((s, p) => s + p.stock * p.cost, 0),
    retailValue: list.reduce((s, p) => s + p.stock * p.price, 0),
    low: list.filter((p) => p.stock <= p.reorderLevel).length,
  };

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

  const removeProducts = async (ids: string[]) => {
    const ok = await confirm({
      title: `Delete ${ids.length} product(s)?`,
      variant: 'destructive',
    });
    if (!ok) return;
    if (backend) {
      try {
        for (const id of ids) await deleteProduct.mutateAsync(id);
        toast.success(`Deleted ${ids.length} product(s)`);
      } catch (e) {
        toast.error('Delete failed', { description: e instanceof Error ? e.message : undefined });
      }
    } else {
      setMockList((cs) => cs.filter((p) => !ids.includes(p.id)));
    }
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
    if (backend) {
      try {
        await createProduct.mutateAsync(copy);
        toast.success('Product duplicated');
      } catch (e) {
        toast.error('Duplicate failed', { description: e instanceof Error ? e.message : undefined });
      }
    } else {
      setMockList((cs) => [copy, ...cs]);
    }
  };

  const upsert = async (p: Product) => {
    if (backend) {
      try {
        const exists = list.some((x) => x.id === p.id);
        if (exists) await updateProduct.mutateAsync(p);
        else await createProduct.mutateAsync(p);
        toast.success('Product saved');
      } catch (e) {
        toast.error('Save failed', { description: e instanceof Error ? e.message : undefined });
      }
    } else {
      setMockList((cs) => {
        const idx = cs.findIndex((x) => x.id === p.id);
        if (idx >= 0) {
          const next = [...cs];
          next[idx] = p;
          return next;
        }
        return [p, ...cs];
      });
    }
  };

  const editing = quickEditId ? list.find((p) => p.id === quickEditId) : undefined;

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${formatNumber(totals.products)} products · ${formatBDT(totals.stockValue)} stock value`}
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
            <Button onClick={() => nav('/products/new')}>
              <Plus className="size-4" /> Add Product
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Total Products" value={formatNumber(totals.products)} />
          <Stat label="Stock Value (Cost)" value={formatBDT(totals.stockValue)} />
          <Stat label="Retail Value" value={formatBDT(totals.retailValue)} tone="primary" />
          <Stat label="Low Stock" value={String(totals.low)} tone="warning" />
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
        {backend && productsQuery.isLoading ? (
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
                          onEdit={() => setQuickEditId(p.id)}
                          onView={() => nav(`/products/${p.id}`)}
                          onDuplicate={() => duplicate(p.id)}
                          onDelete={() => removeProducts([p.id])}
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
              <div>
                Showing {filtered.length} of {list.length} products
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" disabled>
                  Prev
                </Button>
                <Button variant="outline" size="sm">
                  1
                </Button>
                <Button variant="ghost" size="sm" disabled>
                  Next
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((p) => {
              const oos = p.stock <= 0;
              const low = p.stock > 0 && p.stock <= p.reorderLevel;
              return (
                <button
                  key={p.id}
                  onClick={() => setQuickEditId(p.id)}
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
          </div>
        )}
      </div>

      {columnsOpen && <ColumnsCustomize onClose={() => setColumnsOpen(false)} />}

      <Drawer
        open={!!quickEditId}
        onClose={() => setQuickEditId(null)}
        width="max-w-3xl"
        title={editing ? 'Quick Edit' : 'Quick Edit'}
        subtitle="Use 'Open full editor' for more sections"
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
        <td className={`px-2 py-2.5 ${align} text-muted-foreground`}>
          {formatBDT(p.cost, { withSymbol: false })}
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

function RowActions({
  onEdit,
  onView,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void;
  onView: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition">
      <button
        onClick={onEdit}
        className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
        title="Quick edit"
      >
        <Edit2 className="size-3.5" />
      </button>
      <Popover
        align="right"
        width="w-44"
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
            <MenuItem
              icon={Eye}
              label="Open full editor"
              onClick={() => {
                close();
                onView();
              }}
            />
            <MenuItem
              icon={Copy}
              label="Duplicate"
              onClick={() => {
                close();
                onDuplicate();
              }}
            />
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
