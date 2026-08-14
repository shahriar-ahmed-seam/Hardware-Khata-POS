import { useEffect, useMemo } from 'react';
import { Search, ScanBarcode, LayoutGrid, List, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Popover } from '@/components/ui/Popover';
import { ProductImage } from '@/components/products/ProductImage';
import { cn, formatBDT } from '@/lib/utils';
import { usePOS } from '@/stores/pos';
import { useProducts } from '@/hooks/useProducts';
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

  // ----- Data source: backend catalog only (seed fallbacks removed) -----
  const productsQuery = useProducts('br_mp');
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
      // F2 always focuses search
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      // A modal (Payment / Customer / Receipt / confirm) sits on a full-screen
      // overlay. Stealing focus into this search box would yank the caret behind
      // the modal and silently type into the product search, so bail out.
      if (isOverlayOpen(active)) return;
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

  // Only the first RENDER_CAP rows are painted; the rest are announced below.
  const visible = list.length > RENDER_CAP ? list.slice(0, RENDER_CAP) : list;
  const capped = list.length > RENDER_CAP;

  // Anything that is not the default state counts as an active filter, so the
  // Filters button can advertise that results are being narrowed.
  const filtersActive = activeBrand !== 'all' || !showOutOfStock || allowNegativeStock;

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

      {/* View / filters row — kept to ONE line. The panel is drag-resizable and
          narrow, so brand + stock switches live in the Filters popover instead
          of wrapping onto extra rows and pushing products off screen. */}
      <div className="px-2.5 pb-2 flex items-center gap-2 flex-nowrap">
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

        <FiltersPopover
          brands={brands}
          activeBrand={activeBrand}
          setActiveBrand={setActiveBrand}
          showOutOfStock={showOutOfStock}
          setShowOutOfStock={setShowOutOfStock}
          allowNegativeStock={allowNegativeStock}
          setAllowNegativeStock={setAllowNegativeStock}
          active={filtersActive}
        />

        <div className="ml-auto text-2xs text-muted-foreground font-mono tabular whitespace-nowrap">
          {list.length} of {products.length}
        </div>
      </div>

      {/* Categories with mini thumbnails — one row, with a right-edge fade so it
          is obvious the strip keeps scrolling past the visible edge. */}
      <div className="relative px-2.5 pb-2">
        <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto scroll-hide">
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
        <div className="pointer-events-none absolute top-0 right-0 bottom-2 w-10 bg-gradient-to-l from-background via-background/80 to-transparent" />
      </div>

      {/* Product list/grid */}
      <div className="flex-1 overflow-auto scroll-hide p-2.5 pt-0 min-h-0">
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
          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}
          >
            {visible.map((p) => {
              const oos = p.stock <= 0;
              const low = p.stock > 0 && p.stock <= p.reorderLevel;
              // Grey it out only when the card genuinely cannot be tapped.
              const blocked = oos && !allowNegativeStock;
              return (
                <button
                  key={p.id}
                  onClick={() => onAdd(p.id)}
                  disabled={blocked}
                  className={cn(
                    'group relative text-left rounded-xl border border-border bg-card transition overflow-hidden',
                    blocked
                      ? 'opacity-50 grayscale cursor-not-allowed'
                      : 'hover:border-primary hover:shadow-md',
                  )}
                >
                  <div className="aspect-[4/3] bg-gradient-to-br from-secondary to-muted grid place-items-center relative">
                    <ProductImage url={p.image} categoryId={p.categoryId} size={64} rounded="lg" />
                    {/* Stock badge lives over the image corner so it can never
                        collide with a long price in the footer. */}
                    <div className="absolute top-1.5 right-1.5">
                      <Badge variant={oos ? 'destructive' : low ? 'warning' : 'success'}>
                        {p.stock} {p.unit}
                      </Badge>
                    </div>
                    {oos && (
                      <div className="absolute bottom-1.5 left-1.5">
                        <Badge variant="destructive">No stock</Badge>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="text-2xs text-muted-foreground font-mono truncate">{p.sku}</div>
                    {/* No fixed min-height: Bangla lines are taller than Latin
                        (see the [lang='bn'] leading rule) and overflowed the box. */}
                    <div className="text-xs font-medium leading-snug line-clamp-2 mt-0.5">
                      {p.name}
                    </div>
                    <div className="text-2xs text-muted-foreground mt-0.5 truncate">
                      {brandName(p.brandId)}
                    </div>
                    {/* Price owns the whole footer width and is the biggest text. */}
                    <div className="mt-1.5 text-lg font-bold font-mono tabular leading-tight truncate">
                      {formatBDT(p.price, { withSymbol: false })}
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
              <thead className="text-2xs uppercase text-muted-foreground bg-secondary/50">
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
                            <div className="text-2xs text-muted-foreground font-mono truncate">
                              {p.sku}
                            </div>
                            <div className="text-2xs text-muted-foreground truncate">
                              {brandName(p.brandId)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-1.5 py-2 text-right font-mono tabular font-semibold">
                        {formatBDT(p.price, { withSymbol: false })}
                      </td>
                      <td className="px-1.5 py-2 text-right">
                        <Badge variant={oos ? 'destructive' : low ? 'warning' : 'success'}>
                          {p.stock} {p.unit}
                        </Badge>
                        {oos && (
                          <div className="mt-1 text-2xs text-destructive whitespace-nowrap">
                            No stock
                          </div>
                        )}
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
      <div className="text-2xs text-muted-foreground mt-0.5">
        <span className="font-mono tabular">{total}</span> <span>products match right now.</span>
      </div>
      <div className="text-2xs text-muted-foreground">Keep typing to narrow the search.</div>
    </div>
  );
}

function FiltersPopover({
  brands,
  activeBrand,
  setActiveBrand,
  showOutOfStock,
  setShowOutOfStock,
  allowNegativeStock,
  setAllowNegativeStock,
  active,
}: {
  brands: { id: string; name: string }[];
  activeBrand: string | 'all';
  setActiveBrand: (id: string | 'all') => void;
  showOutOfStock: boolean;
  setShowOutOfStock: (v: boolean) => void;
  allowNegativeStock: boolean;
  setAllowNegativeStock: (v: boolean) => void;
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
            'relative h-8 px-2.5 rounded-md text-xs inline-flex items-center gap-1.5 border transition whitespace-nowrap',
            active
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-secondary',
          )}
        >
          <SlidersHorizontal className="size-3.5" /> Filters
          {/* Dot so a narrowed list is never a silent surprise. */}
          {active && (
            <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary border border-background" />
          )}
        </button>
      )}
    >
      {() => (
        <div className="p-3 space-y-3">
          <div>
            <div className="text-2xs font-medium text-muted-foreground mb-1">Brand</div>
            <select
              value={activeBrand}
              onChange={(e) => setActiveBrand(e.target.value)}
              className="w-full h-9 px-2 text-xs rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <ToggleRow
            checked={showOutOfStock}
            onChange={() => setShowOutOfStock(!showOutOfStock)}
            label="Show finished items"
            hint="Keeps products with no stock left in the list."
          />

          <ToggleRow
            checked={allowNegativeStock}
            onChange={() => setAllowNegativeStock(!allowNegativeStock)}
            label="Allow selling without stock"
            hint="Lets you sell items the system shows as finished."
            danger
          />
        </div>
      )}
    </Popover>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  hint,
  danger,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      className={cn(
        'w-full text-left flex items-start gap-2.5 rounded-lg border p-2.5 transition',
        checked && danger
          ? 'border-destructive/40 bg-destructive/10'
          : checked
            ? 'border-primary/40 bg-primary/5'
            : 'border-border hover:bg-secondary',
      )}
    >
      <span
        className={cn(
          'mt-0.5 shrink-0 w-9 h-5 rounded-full transition relative',
          checked ? (danger ? 'bg-destructive' : 'bg-primary') : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-background shadow transition-all',
            checked ? 'left-[1.125rem]' : 'left-0.5',
          )}
        />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block text-xs font-medium',
            checked && danger ? 'text-destructive' : 'text-foreground',
          )}
        >
          {label}
        </span>
        <span className="block text-2xs text-muted-foreground leading-snug mt-0.5">{hint}</span>
      </span>
    </button>
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
