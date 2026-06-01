import { useEffect, useMemo, useRef } from 'react';
import { Search, ScanBarcode, LayoutGrid, List, Eye, EyeOff, Tag } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn, formatBDT } from '@/lib/utils';
import {
  brands as mockBrands,
  categories as mockCategories,
  products as mockProducts,
} from '@/mocks/data';
import { usePOS } from '@/stores/pos';
import { hasBackend } from '@/lib/api';
import { useProducts } from '@/hooks/useProducts';
import { useCategories, useBrands } from '@/hooks/useCatalog';

interface Props {
  search: string;
  setSearch: (v: string) => void;
  activeCat: string | 'all';
  setActiveCat: (id: string | 'all') => void;
  activeBrand: string | 'all';
  setActiveBrand: (id: string | 'all') => void;
  onAdd: (productId: string, opts?: { focusFirst?: boolean }) => void;
  /** Called when user presses Enter while focused in search and there's a single best match. */
  onSubmitSearch: () => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
}

export function ProductPanel({
  search,
  setSearch,
  activeCat,
  setActiveCat,
  activeBrand,
  setActiveBrand,
  onAdd,
  onSubmitSearch,
  searchInputRef,
}: Props) {
  const {
    productView,
    setProductView,
    showOutOfStock,
    setShowOutOfStock,
    allowNegativeStock,
    setAllowNegativeStock,
  } = usePOS();

  // ----- Data source: live backend when available, else mock seed -----
  const backend = hasBackend();
  const productsQuery = useProducts('br_mp');
  const categoriesQuery = useCategories();
  const brandsQuery = useBrands();

  const products = backend ? (productsQuery.data ?? []) : mockProducts;
  const categories = backend ? (categoriesQuery.data ?? []) : mockCategories;
  const brands = backend ? (brandsQuery.data ?? []) : mockBrands;
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? '—';

  // Auto-focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, [searchInputRef]);

  // Global keystroke listener — barcode scanners type fast then press Enter.
  // We forward keystrokes to the search input if no other input/textarea is focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      const isEditable = ['input', 'textarea', 'select'].includes(tag);
      // F2 always focuses search
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      // If user types a printable char and nothing else is focused, focus search.
      if (!isEditable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchInputRef]);

  const list = useMemo(() => {
    return products.filter((p) => {
      if (activeCat !== 'all' && p.categoryId !== activeCat) return false;
      if (activeBrand !== 'all' && p.brandId !== activeBrand) return false;
      if (!showOutOfStock && p.stock <= 0 && !allowNegativeStock) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q)
      );
    });
  }, [search, activeCat, activeBrand, showOutOfStock, allowNegativeStock, products]);

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-background">
      {/* Search row — Scan button on the left, smaller search on the right */}
      <div className="p-2.5 flex items-center gap-2">
        <Button
          variant="outline"
          size="md"
          title="Focus and clear for next scan"
          onClick={() => {
            setSearch('');
            searchInputRef.current?.focus();
          }}
        >
          <ScanBarcode className="size-4" /> Scan
        </Button>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            ref={searchInputRef as any}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSubmitSearch();
              }
            }}
            placeholder="Name / SKU / barcode  (F2)"
            className="pl-8 pr-2 h-9 text-xs"
          />
        </div>
      </div>

      {/* View / filters row */}
      <div className="px-2.5 pb-2 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
          <button
            onClick={() => setProductView('grid')}
            className={cn(
              'px-2 py-1 rounded inline-flex items-center gap-1 transition',
              productView === 'grid' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
            title="Grid view"
          >
            <LayoutGrid className="size-3.5" /> Grid
          </button>
          <button
            onClick={() => setProductView('list')}
            className={cn(
              'px-2 py-1 rounded inline-flex items-center gap-1 transition',
              productView === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
            title="List view"
          >
            <List className="size-3.5" /> List
          </button>
        </div>

        <select
          value={activeBrand}
          onChange={(e) => setActiveBrand(e.target.value)}
          className="h-8 px-2 text-xs rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
        >
          <option value="all">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowOutOfStock(!showOutOfStock)}
          className={cn(
            'h-8 px-2.5 rounded-md text-xs inline-flex items-center gap-1 border transition',
            showOutOfStock
              ? 'border-border hover:bg-secondary text-muted-foreground'
              : 'border-warning/40 bg-warning/10 text-warning',
          )}
          title="Show out-of-stock products"
        >
          {showOutOfStock ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {showOutOfStock ? 'OOS shown' : 'OOS hidden'}
        </button>

        <button
          onClick={() => setAllowNegativeStock(!allowNegativeStock)}
          className={cn(
            'h-8 px-2.5 rounded-md text-xs inline-flex items-center gap-1 border transition',
            allowNegativeStock
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-border hover:bg-secondary text-muted-foreground',
          )}
          title="Allow selling beyond stock"
        >
          {allowNegativeStock ? 'Negative ✓' : 'Negative ✗'}
        </button>

        <div className="ml-auto text-[11px] text-muted-foreground">
          {list.length} of {products.length}
        </div>
      </div>

      {/* Categories with mini thumbnails */}
      <div className="px-2.5 pb-2 flex items-center gap-1.5 overflow-x-auto scroll-hide">
        <CatChip active={activeCat === 'all'} onClick={() => setActiveCat('all')} emoji="🛒">
          All
        </CatChip>
        {categories.map((c) => (
          <CatChip
            key={c.id}
            active={activeCat === c.id}
            onClick={() => setActiveCat(c.id)}
            emoji={c.emoji}
          >
            {c.name}
          </CatChip>
        ))}
      </div>

      {/* Product list/grid */}
      <div className="flex-1 overflow-auto scroll-hide p-2.5 pt-0 min-h-0">
        {productView === 'grid' ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5">
            {list.map((p) => {
              const oos = p.stock <= 0;
              const low = p.stock > 0 && p.stock <= p.reorderLevel;
              return (
                <button
                  key={p.id}
                  onClick={() => onAdd(p.id)}
                  disabled={oos && !allowNegativeStock}
                  className={cn(
                    'group relative text-left rounded-xl border bg-card hover:border-primary hover:shadow-md transition overflow-hidden',
                    oos && 'opacity-50 grayscale',
                    !oos && 'border-border',
                  )}
                >
                  <div className="aspect-[4/3] bg-gradient-to-br from-secondary to-muted grid place-items-center text-muted-foreground/50">
                    <Tag className="size-7" />
                  </div>
                  <div className="p-2">
                    <div className="text-[10px] text-muted-foreground font-mono truncate">{p.sku}</div>
                    <div className="text-[12px] font-medium leading-tight line-clamp-2 mt-0.5 min-h-[2.2em]">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {brandName(p.brandId)}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="text-sm font-bold font-mono">
                        {formatBDT(p.price, { withSymbol: false })}
                      </div>
                      <Badge variant={oos ? 'destructive' : low ? 'warning' : 'success'}>
                        {p.stock} {p.unit}
                      </Badge>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase text-muted-foreground bg-secondary/50">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Product</th>
                  <th className="text-right font-medium px-2 py-2">Price</th>
                  <th className="text-right font-medium px-3 py-2">Stock</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const oos = p.stock <= 0;
                  const low = p.stock > 0 && p.stock <= p.reorderLevel;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => {
                        if (!oos || allowNegativeStock) onAdd(p.id);
                      }}
                      className={cn(
                        'border-t border-border cursor-pointer transition',
                        oos && !allowNegativeStock
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-secondary/40',
                      )}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium leading-tight">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {p.sku} · {brandName(p.brandId)}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-mono">
                        {formatBDT(p.price, { withSymbol: false })}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant={oos ? 'destructive' : low ? 'warning' : 'success'}>
                          {p.stock} {p.unit}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CatChip({
  active,
  onClick,
  emoji,
  children,
}: {
  active: boolean;
  onClick: () => void;
  emoji?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition border',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/70',
      )}
    >
      {emoji && <span className="text-sm leading-none">{emoji}</span>}
      {children}
    </button>
  );
}
