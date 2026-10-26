import { useEffect, useMemo } from 'react';
import { Search, LayoutGrid, List, SlidersHorizontal, CornerDownLeft } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { useSettings } from '@/stores/settings';
import { keyLabel, matchesKey, usePosKeys } from './shortcuts';
import { Popover } from '@/components/ui/Popover';
import { ProductImage } from '@/components/products/ProductImage';
import { cn, formatBDT } from '@/lib/utils';
import { usableImage } from '@/lib/imageFile';
import { usePOS } from '@/stores/pos';
import { useProducts } from '@/hooks/useProducts';
import { useDefaultBranchId } from '@/lib/branch';
import { useCategories, useBrands } from '@/hooks/useCatalog';

/**
 * Hard cap on rendered cards/rows. A hardware shop catalogue can run to a few
 * thousand rows; painting them all is thousands of DOM nodes and the panel
 * janks while typing. Barcode/SKU scanning is unaffected — the exact-match
 * lookup lives in POS.tsx, not here.
 */
const RENDER_CAP = 200;

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
  /** What Enter in the search box will add, shown under it. */
  enterAdds?: { id: string; name: string; price: number } | null;
  /** Settings → POS big-button mode: larger product tiles. */
  big?: boolean;
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
  enterAdds = null,
  big = false,
}: Props) {
  const { productView, setProductView, showOutOfStock, setShowOutOfStock } = usePOS();
  // Shop policy from Settings → POS (R81), no longer a per-device switch in the
  // filter popover. It lets a finished item into the cart (drafts, quotations);
  // a SALE is still checked against stock when Pay is pressed.
  const allowNegativeStock = useSettings((s) => !!s.pos.allowNegativeStockDefault);
  const keys = usePosKeys();
  const searchKey = keys.search;
  const helpKey = keys.showHelp;

  // ----- Data source: backend catalog only (seed fallbacks removed) -----
  const productsQuery = useProducts(useDefaultBranchId());
  const categoriesQuery = useCategories();
  const brandsQuery = useBrands();

  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const brands = brandsQuery.data ?? [];
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? '—';
  const loading = productsQuery.isLoading;

  // Auto-focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, [searchInputRef]);

  // Global keystroke listener — barcode scanners type fast then press Enter.
  // We forward keystrokes to the search input if no other input/textarea is focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tag = (active?.tagName ?? '').toLowerCase();
      const isEditable =
        ['input', 'textarea', 'select'].includes(tag) || active?.isContentEditable === true;
      // The search key (F2 by default) always focuses search.
      if (matchesKey(e, searchKey)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      // A modal (Payment / Customer / Receipt / confirm) sits on a full-screen
      // overlay. Stealing focus into this search box would yank the caret behind
      // the modal and silently type into the product search, so bail out.
      if (isOverlayOpen(active)) return;
      // The help key ("?") belongs to POS, not to the search box.
      if (!isEditable && matchesKey(e, helpKey)) return;
      // If user types a printable char and nothing else is focused, focus search.
      if (!isEditable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchInputRef, searchKey, helpKey]);

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

  // Only the first RENDER_CAP rows are painted; the rest are announced below.
  const visible = list.length > RENDER_CAP ? list.slice(0, RENDER_CAP) : list;
  const capped = list.length > RENDER_CAP;

  // Anything that is not the default state counts as an active filter, so the
  // Filters button can advertise that results are being narrowed.
  const filtersActive = activeBrand !== 'all' || !showOutOfStock;
  const narrowed = list.length !== products.length;

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-background">
      {/* Search — the scanner's target, so it is the biggest field here. */}
      <div className="p-2.5 pb-2">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
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
            placeholder={`Scan, or type a name or code (${keyLabel(searchKey)})`}
            aria-label="Search products"
            className="h-11 pl-10 pr-2 text-sm"
          />
        </div>
        {/* What Enter will add, so a partial match is never a surprise. */}
        {search.trim() && enterAdds && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <CornerDownLeft className="size-3.5 shrink-0" />
            <span className="shrink-0">Enter adds:</span>
            <span className="font-medium text-foreground truncate">{enterAdds.name}</span>
            <span className="tabular shrink-0">{formatBDT(enterAdds.price, { withSymbol: false })}</span>
          </div>
        )}
      </div>

      {/* View / filters row. Brand + stock switches live in the Filters popover
          so this stays short; it may wrap (the count drops to a second line) at
          the largest text sizes rather than push the page sideways. */}
      <div className="px-2.5 pb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-sm" role="group" aria-label="View">
          <button
            onClick={() => setProductView('grid')}
            className={cn(
              'h-9 px-2.5 rounded inline-flex items-center gap-1.5 transition',
              productView === 'grid' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
            title="Grid view"
            aria-pressed={productView === 'grid'}
          >
            <LayoutGrid className="size-4" /> Grid
          </button>
          <button
            onClick={() => setProductView('list')}
            className={cn(
              'h-9 px-2.5 rounded inline-flex items-center gap-1.5 transition',
              productView === 'list' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
            title="List view"
            aria-pressed={productView === 'list'}
          >
            <List className="size-4" /> List
          </button>
        </div>

        <FiltersPopover
          brands={brands}
          activeBrand={activeBrand}
          setActiveBrand={setActiveBrand}
          showOutOfStock={showOutOfStock}
          setShowOutOfStock={setShowOutOfStock}
          active={filtersActive}
        />

        {/* The count only when something narrows the list. */}
        {narrowed && !loading && (
          <div className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
            <span className="tabular">{list.length}</span> <span>shown</span>
          </div>
        )}
      </div>

      {/* Categories — they wrap, up to two rows, then scroll. They used to be
          one sideways-scrolling strip with a hidden scrollbar, so with a plain
          mouse wheel every category past the second chip was out of reach. */}
      <div className="px-2.5 pb-2">
        <div className="flex flex-wrap items-center gap-1.5 max-h-[4.5rem] overflow-y-auto">
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
      </div>

      {/* Product list/grid */}
      <div className="flex-1 overflow-auto p-2.5 pt-0 min-h-0">
        {loading && (
          <div className="h-full grid place-items-center text-center text-sm text-muted-foreground">
            Loading products…
          </div>
        )}
        {!loading && list.length === 0 && (
          <div className="h-full grid place-items-center text-center text-sm text-muted-foreground">
            {products.length === 0
              ? 'No products in the catalog yet.'
              : 'No products match this search or filter.'}
          </div>
        )}
        {!loading && list.length > 0 && (productView === 'grid' ? (
          <>
          {/* WHY an inline grid-template instead of grid-cols-2 lg:3 2xl:4 —
              Tailwind breakpoints measure the WINDOW, but this panel is only a
              drag-resizable slice of it (~35%). On a wide screen `2xl:` fired and
              crammed 4 columns into ~600px, giving ~90px cards. auto-fill +
              minmax keys off THIS container's width, so cards never shrink below
              a readable size and the count adapts as the splitter moves. */}
          {/* PRODUCT CARD — picture strip, name, code · brand, then price and
              stock on one line. The old card was a 4:3 box (≈135px) with a
              64px picture floating in it, so most of every card was empty dark
              space and only four fitted on screen. A photo now fills its strip;
              without one, the category emoji sits on a soft tile. */}
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${big ? '12rem' : '9.5rem'}, 1fr))` }}
          >
            {visible.map((p) => {
              const oos = p.stock <= 0;
              const low = p.stock > 0 && p.stock <= p.reorderLevel;
              // Grey it out only when the card genuinely cannot be tapped.
              const blocked = oos && !allowNegativeStock;
              const photo = usableImage(p.image);
              // No brand → nothing after the code (brandName's '—' is for tables).
              const brand = brands.find((b) => b.id === p.brandId)?.name;
              return (
                <button
                  key={p.id}
                  onClick={() => onAdd(p.id)}
                  disabled={blocked}
                  title={p.name}
                  className={cn(
                    'group flex flex-col items-stretch text-left rounded-lg border border-border bg-card transition overflow-hidden focus-ring',
                    !!search.trim() && enterAdds?.id === p.id && 'ring-2 ring-primary border-primary',
                    blocked
                      ? 'opacity-50 grayscale cursor-not-allowed'
                      : 'hover:border-primary hover:ring-1 hover:ring-primary/40',
                  )}
                >
                  <div
                    className={cn(
                      'relative shrink-0 bg-secondary/60 grid place-items-center overflow-hidden',
                      big ? 'h-24' : 'h-[4.5rem]',
                    )}
                  >
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        className="absolute inset-0 size-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <ProductImage categoryId={p.categoryId} size={big ? 56 : 44} rounded="lg" />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col p-2 gap-0.5 min-w-0">
                    {/* No fixed min-height: Bangla lines are taller than Latin
                        (see the [lang='bn'] leading rule) and overflowed the box. */}
                    <div className="text-sm font-semibold leading-snug line-clamp-2">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      <span className="font-mono">{p.sku}</span>
                      {brand && (
                        <>
                          {' · '}
                          <span>{brand}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-auto pt-1 flex items-center justify-between gap-1.5 min-w-0">
                      <span className={cn('font-bold tabular leading-tight truncate', big ? 'text-lg' : 'text-base')}>
                        {formatBDT(p.price, { withSymbol: false })}
                      </span>
                      {oos ? (
                        <Badge variant="destructive">No stock</Badge>
                      ) : (
                        <Badge variant={low ? 'warning' : 'success'}>
                          {p.stock} {p.unit}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {capped && <CapNotice total={list.length} />}
          </>
        ) : (
          <>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full table-fixed text-sm">
              {/* Price and Stock get FIXED widths and the product column takes
                  the rest. They used to be `text-right` in an auto-layout table,
                  so as the splitter narrowed the panel the browser stole width
                  from them first and the two numbers the cashier actually needs
                  were the first thing to disappear. `table-fixed` + explicit
                  widths pin them; only the name/code/brand column compresses. */}
              <colgroup>
                <col />
                <col className="w-[5.5rem]" />
                <col className="w-[5.5rem]" />
              </colgroup>
              <thead className="text-xs text-muted-foreground bg-secondary/50">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Product</th>
                  <th className="text-right font-medium px-1.5 py-2">Price</th>
                  <th className="text-right font-medium px-1.5 py-2">Stock</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const oos = p.stock <= 0;
                  const low = p.stock > 0 && p.stock <= p.reorderLevel;
                  const blocked = oos && !allowNegativeStock;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => {
                        if (!blocked) onAdd(p.id);
                      }}
                      className={cn(
                        'border-t border-border transition',
                        !!search.trim() && enterAdds?.id === p.id && 'bg-primary/10',
                        blocked
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer hover:bg-secondary/40',
                      )}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ProductImage url={p.image} categoryId={p.categoryId} size={36} />
                          <div className="min-w-0">
                            <div className="font-medium leading-snug line-clamp-2">{p.name}</div>
                            {/* Code and brand on their OWN lines. Joined with a
                                '·' they shared one truncating line, so on a
                                narrow panel the brand was the first thing cut —
                                and in a hardware shop the brand is half the
                                identity of the item ("2 inch — but whose?"). */}
                            <div className="text-xs text-muted-foreground font-mono truncate">
                              {p.sku}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {brandName(p.brandId)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-1.5 py-2 text-right tabular font-semibold">
                        {formatBDT(p.price, { withSymbol: false })}
                      </td>
                      <td className="px-1.5 py-2 text-right">
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
          {capped && <CapNotice total={list.length} />}
          </>
        ))}
      </div>
    </div>
  );
}

/**
 * True when a full-screen overlay (Modal, Drawer, print frame, confirm dialog)
 * is on screen or owns focus. Modals here render as `.fixed.inset-0` layers, so
 * we look for those as well as the standard dialog roles.
 */
function isOverlayOpen(active: HTMLElement | null): boolean {
  if (active?.closest('[data-overlay], .fixed.inset-0')) return true;
  // `[data-overlay]` is set by Modal, Drawer, ConfirmDialog and PromptDialog.
  // The class selectors that used to be here matched hard-coded z-indexes, so
  // any modal on a different layer (QuickUpdateModal is `z-[60]`) went
  // undetected and this panel yanked the caret out of it mid-typing.
  return !!document.querySelector('[data-overlay], [role="dialog"], [aria-modal="true"]');
}

/** Shown at the end of the results when the list was truncated for speed. */
function CapNotice({ total }: { total: number }) {
  return (
    <div className="mt-2.5 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2.5 text-center">
      <div className="text-xs font-medium">Showing the first 200 products only.</div>
      <div className="text-xs text-muted-foreground mt-0.5">
        <span className="tabular">{total}</span> <span>products match right now.</span>
      </div>
      <div className="text-xs text-muted-foreground">Keep typing to narrow the search.</div>
    </div>
  );
}

function FiltersPopover({
  brands,
  activeBrand,
  setActiveBrand,
  showOutOfStock,
  setShowOutOfStock,
  active,
}: {
  brands: { id: string; name: string }[];
  activeBrand: string | 'all';
  setActiveBrand: (id: string | 'all') => void;
  showOutOfStock: boolean;
  setShowOutOfStock: (v: boolean) => void;
  active: boolean;
}) {
  return (
    <Popover
      width="w-72"
      align="left"
      trigger={(_o, set) => (
        <button
          onClick={() => set(true)}
          className={cn(
            'relative h-9 px-3 rounded-md text-sm inline-flex items-center gap-1.5 border transition whitespace-nowrap',
            active
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-secondary',
          )}
        >
          <SlidersHorizontal className="size-4" /> Filters
          {/* Dot so a narrowed list is never a silent surprise. */}
          {active && (
            <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary border border-background" />
          )}
        </button>
      )}
    >
      {() => (
        <div className="p-3 space-y-3">
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium">Brand</span>
            <Select value={activeBrand} onChange={(e) => setActiveBrand(e.target.value)}>
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </label>

          <ToggleRow
            checked={showOutOfStock}
            onChange={setShowOutOfStock}
            label="Show finished items"
            desc="Keeps products with no stock left in the list."
          />
        </div>
      )}
    </Popover>
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
        'inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium whitespace-nowrap transition border',
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
