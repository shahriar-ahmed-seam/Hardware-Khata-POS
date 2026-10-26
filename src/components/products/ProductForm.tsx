import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Image as ImageIcon, Plus, X, Wand2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { IconButton } from '@/components/ui/IconButton';
import { NumberField } from '@/components/ui/NumberField';
import { ProductImage } from './ProductImage';
import type { Product } from '@/types/domain';
import { useCategories, useBrands, useUnits } from '@/hooks/useCatalog';
import { fileToStoredImage, usableImage } from '@/lib/imageFile';
import { ean13CheckDigit } from '@/lib/barcode';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';
import { NewCategoryModal, NewBrandModal } from './QuickCatalogModal';

interface Props {
  initial?: Product;
  /** May return a promise; the page/drawer decides when to close. */
  onSave: (p: Product) => void | Promise<void>;
  onDelete?: () => void;
  /** When true, render in drawer mode (no page header, footer with the buttons). */
  asDrawer?: boolean;
  onCancel?: () => void;
  /**
   * Force opening stock to 0 and make it read-only. Used from a purchase: the
   * quantity arrives on the purchase line, so an opening stock here would count
   * the same goods twice.
   */
  lockStock?: boolean;
  /** Label for the primary button — the caller knows what happens next. */
  saveLabel?: string;
}

const EMPTY: Product = {
  id: '',
  sku: '',
  barcode: '',
  name: '',
  categoryId: '',
  brandId: '',
  unit: 'pc',
  availableUnits: ['pc'],
  unitConversions: [],
  cost: 0,
  price: 0,
  stock: 0,
  reorderLevel: 0,
  tax: 0,
  manageStock: true,
  allowNegativeSale: false,
  allowDiscount: true,
  showInPOS: true,
  notForSale: false,
  description: '',
};

/**
 * THE PRODUCT FORM — one column, in the order the owner thinks:
 * name · category · unit · buying / selling price · stock · low-stock alert,
 * plus three everyday switches. Everything expert (brand, codes, extra price
 * tiers, tax, alternate units, description, photo) sits under "More options".
 *
 * Save is never greyed out: pressing it shows what is missing next to the
 * field. An empty SKU is generated on save.
 */
export function ProductForm({
  initial,
  onSave,
  onDelete,
  asDrawer,
  onCancel,
  lockStock,
  saveLabel,
}: Props) {
  const nav = useNavigate();
  const [p, setP] = useState<Product>(initial ?? (lockStock ? { ...EMPTY, stock: 0 } : EMPTY));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newBrandOpen, setNewBrandOpen] = useState(false);
  // `usableImage` drops dead `blob:` values from old builds.
  const [imgPreview, setImgPreview] = useState<string | undefined>(usableImage(initial?.image));
  const [imgBusy, setImgBusy] = useState(false);

  // Options from the backend, so the product always writes real ids.
  const categories = useCategories().data ?? [];
  const brands = useBrands().data ?? [];
  const units = useUnits().data ?? [];

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));

  const margin = p.cost > 0 ? ((p.price - p.cost) / p.cost) * 100 : 0;

  const makeSku = (src: Product) => {
    const cat = categories.find((c) => c.id === src.categoryId)?.name?.slice(0, 2).toUpperCase() ?? 'SK';
    const br = brands.find((b) => b.id === src.brandId)?.name?.slice(0, 3).toUpperCase() ?? 'GEN';
    return `${cat}-${br}-${Math.floor(Math.random() * 900) + 100}`;
  };
  const generateBarcode = () => {
    // A real EAN-13 in the in-store range (prefix 2), so it never clashes with
    // a code printed on goods from the market.
    const first12 = '2' + String(Math.floor(Math.random() * 1e11)).padStart(11, '0');
    set('barcode', first12 + ean13CheckDigit(first12));
  };

  /** Store the picture itself (a small data URL), so it survives restarts and backups. */
  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // picking the same file again still fires
    if (!f) return;
    setImgBusy(true);
    try {
      // 256 px: the biggest a product photo is drawn is the POS tile (~170 px).
      const stored = await fileToStoredImage(f, { maxEdge: 256, quality: 0.78, maxBytes: 150_000 });
      setImgPreview(stored);
      set('image', stored);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not use that picture');
    } finally {
      setImgBusy(false);
    }
  };

  const nameError = tried && !p.name.trim() ? 'Enter the product name' : undefined;
  const priceError = tried && !(p.price > 0) ? 'Enter a selling price' : undefined;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (saving) return;
    setTried(true);
    if (!p.name.trim() || !(p.price > 0)) return;
    const finalProduct: Product = {
      ...p,
      name: p.name.trim(),
      sku: p.sku.trim() || makeSku(p),
      // Belt and braces: never send an opening stock from the purchase flow.
      stock: lockStock ? 0 : p.stock,
      id: p.id || `p_${Date.now()}`,
      createdAt: p.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSaving(true);
    try {
      await onSave(finalProduct);
    } finally {
      setSaving(false);
    }
  };

  // "Sell at the counter" = shown in the POS and not purchase-only.
  const sellable = p.showInPOS !== false && !p.notForSale;

  const primaryLabel = saveLabel ?? (initial ? 'Save changes' : 'Save product');

  return (
    // Exactly ONE scroll container: the drawer body in drawer mode, the page's
    // <main> in page mode.
    <div className={cn('flex flex-col', asDrawer ? 'flex-1 min-h-0' : 'min-h-full')}>
      <form
        onSubmit={submit}
        noValidate
        className={cn('flex flex-col', asDrawer ? 'flex-1 min-h-0' : 'min-h-full')}
      >
        {!asDrawer && (
          // Sticky so Save stays reachable on a long form.
          <div className="sticky top-0 z-20 bg-background">
            <PageHeader
              title={initial ? 'Edit product' : 'Add product'}
              subtitle={initial ? p.name : undefined}
              actions={
                <>
                  <Button type="button" variant="ghost" onClick={() => nav(-1)}>
                    <ArrowLeft className="size-4" /> Back
                  </Button>
                  <Button type="submit" disabled={saving}>
                    <Save className="size-4" /> {primaryLabel}
                  </Button>
                </>
              }
            />
          </div>
        )}

        <div className={cn(asDrawer && 'flex-1 min-h-0 overflow-auto')}>
          <div className={cn('mx-auto max-w-3xl space-y-4', asDrawer ? 'p-5' : 'p-6')}>
            {/* ---------------- What the owner needs ---------------- */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <FormField label="Product name" required error={nameError}>
                {(f) => (
                  <Input
                    {...f}
                    autoFocus={!initial}
                    value={p.name}
                    onChange={(e) => set('name', e.target.value)}
                  />
                )}
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* The + saves a real category and selects it, without leaving the form. */}
                <FormField label="Category">
                  {(f) => (
                    <div className="flex items-center gap-2">
                      <Select
                        {...f}
                        value={p.categoryId}
                        onChange={(e) => set('categoryId', e.target.value)}
                      >
                        <option value="">Select category…</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                      <IconButton
                        variant="outline"
                        label="Add new category"
                        onClick={() => setNewCategoryOpen(true)}
                      >
                        <Plus className="size-4" />
                      </IconButton>
                    </div>
                  )}
                </FormField>
                <FormField label="Unit" required>
                  {(f) => (
                    <Select
                      {...f}
                      value={p.unit}
                      onChange={(e) => {
                        const v = e.target.value;
                        setP((x) => ({
                          ...x,
                          unit: v,
                          // the main unit is always one of the available units
                          availableUnits: x.availableUnits?.includes(v)
                            ? x.availableUnits
                            : [v, ...(x.availableUnits ?? [])],
                        }));
                      }}
                    >
                      {units.map((u) => (
                        <option key={u.short} value={u.short}>
                          {u.name} ({u.short})
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>

                <FormField label="Buying price">
                  {(f) => (
                    <NumberField
                      {...f}
                      value={p.cost}
                      onChangeNumber={(v) => set('cost', v)}
                      placeholder="0.00"
                      className="text-right tabular"
                    />
                  )}
                </FormField>
                <FormField label="Selling price" required error={priceError}>
                  {(f) => (
                    <NumberField
                      {...f}
                      value={p.price}
                      onChangeNumber={(v) => set('price', v)}
                      placeholder="0.00"
                      className="text-right tabular"
                    />
                  )}
                </FormField>
              </div>

              {p.cost > 0 && p.price > 0 && (
                <div className="px-3 py-2 rounded-md bg-secondary/50 border border-border text-sm flex items-center justify-between">
                  <span className="text-muted-foreground">Profit margin</span>
                  <span
                    className={cn(
                      'tabular font-semibold',
                      margin > 0 ? 'text-success' : margin < 0 ? 'text-destructive' : '',
                    )}
                  >
                    {margin.toFixed(1)}% · ৳ {(p.price - p.cost).toFixed(2)}
                  </span>
                </div>
              )}

              {/* Opening stock is writable only while creating: on-hand is a sum of
                  stock movements, so an existing product shows it read-only. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lockStock ? (
                  <FormField label="Opening stock" hint="Comes in on the purchase line.">
                    <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 tabular text-sm text-muted-foreground">
                      0 {p.unit}
                    </div>
                  </FormField>
                ) : initial ? (
                  <FormField
                    label="In stock now"
                    hint="To change it, use Update price & stock on the Products or Stock screen."
                  >
                    <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 tabular text-sm">
                      {p.stock} {p.unit}
                    </div>
                  </FormField>
                ) : (
                  <FormField label="Opening stock" hint="How many you have right now">
                    {(f) => (
                      <NumberField
                        {...f}
                        value={p.stock}
                        onChangeNumber={(v) => set('stock', v)}
                        className="text-right tabular"
                      />
                    )}
                  </FormField>
                )}
                <FormField label="Low-stock alert at" hint="Warn me when stock falls to this">
                  {(f) => (
                    <NumberField
                      {...f}
                      value={p.reorderLevel}
                      onChangeNumber={(v) => set('reorderLevel', v)}
                      className="text-right tabular"
                    />
                  )}
                </FormField>
              </div>

              <div className="-mx-3 divide-y divide-border">
                <ToggleRow
                  label="Sell at the counter"
                  desc="Off for items you only buy or use in the shop"
                  checked={sellable}
                  onChange={(v) => setP((x) => ({ ...x, showInPOS: v, notForSale: !v }))}
                />
                <ToggleRow
                  label="Track stock"
                  desc="Take it off the stock when sold"
                  checked={p.manageStock !== false}
                  onChange={(v) => set('manageStock', v)}
                />
                <ToggleRow
                  label="Allow discount"
                  desc="The cashier can give a discount on this item"
                  checked={p.allowDiscount !== false}
                  onChange={(v) => set('allowDiscount', v)}
                />
              </div>
            </div>

            {/* ---------------- More options (expert) ---------------- */}
            <div className="rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                aria-expanded={moreOpen}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left rounded-xl hover:bg-secondary/40 focus-ring"
              >
                <span>
                  <span className="block text-sm font-semibold">More options</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Brand, SKU, barcode, other prices, tax, units, photo
                  </span>
                </span>
                <ChevronDown
                  className={cn('size-5 text-muted-foreground transition', moreOpen && 'rotate-180')}
                />
              </button>

              {moreOpen && (
                <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Brand">
                      {(f) => (
                        <div className="flex items-center gap-2">
                          <Select
                            {...f}
                            value={p.brandId}
                            onChange={(e) => set('brandId', e.target.value)}
                          >
                            <option value="">Select brand…</option>
                            {brands.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </Select>
                          <IconButton
                            variant="outline"
                            label="Add new brand"
                            onClick={() => setNewBrandOpen(true)}
                          >
                            <Plus className="size-4" />
                          </IconButton>
                        </div>
                      )}
                    </FormField>
                    <FormField label="Tax %">
                      {(f) => (
                        <NumberField
                          {...f}
                          value={p.tax ?? 0}
                          onChangeNumber={(v) => set('tax', v)}
                          className="text-right tabular"
                        />
                      )}
                    </FormField>

                    <FormField
                      label="SKU"
                      action={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => set('sku', makeSku(p))}
                        >
                          <Wand2 className="size-4" /> Generate
                        </Button>
                      }
                    >
                      {(f) => (
                        <Input
                          {...f}
                          value={p.sku}
                          onChange={(e) => set('sku', e.target.value)}
                          placeholder="Leave empty to create one"
                          className="font-mono"
                        />
                      )}
                    </FormField>
                    <FormField
                      label="Barcode"
                      action={
                        <Button type="button" variant="ghost" size="sm" onClick={generateBarcode}>
                          <Wand2 className="size-4" /> Generate
                        </Button>
                      }
                    >
                      {(f) => (
                        <Input
                          {...f}
                          value={p.barcode}
                          onChange={(e) => set('barcode', e.target.value)}
                          placeholder="Scan or type the code on the pack"
                          className="font-mono"
                        />
                      )}
                    </FormField>

                    <FormField label="Wholesale price" hint="For wholesale customers">
                      {(f) => (
                        <NumberField
                          {...f}
                          value={p.wholesalePrice ?? 0}
                          onChangeNumber={(v) => set('wholesalePrice', v || undefined)}
                          placeholder="0.00"
                          className="text-right tabular"
                        />
                      )}
                    </FormField>
                    <FormField label="Contractor price" hint="For contractor customers">
                      {(f) => (
                        <NumberField
                          {...f}
                          value={p.contractorPrice ?? 0}
                          onChangeNumber={(v) => set('contractorPrice', v || undefined)}
                          placeholder="0.00"
                          className="text-right tabular"
                        />
                      )}
                    </FormField>
                  </div>

                  <div className="-mx-3">
                    <ToggleRow
                      label="Allow negative sale"
                      desc="Sell more than the stock shows"
                      checked={!!p.allowNegativeSale}
                      onChange={(v) => set('allowNegativeSale', v)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-sm font-medium">Other units</div>
                    <UnitsEditor
                      base={p.unit}
                      available={p.availableUnits ?? [p.unit]}
                      conversions={p.unitConversions ?? []}
                      units={units}
                      onChange={(available, conversions) =>
                        setP((x) => ({ ...x, availableUnits: available, unitConversions: conversions }))
                      }
                    />
                  </div>

                  <FormField label="Description">
                    {(f) => (
                      <textarea
                        {...f}
                        value={p.description ?? ''}
                        onChange={(e) => set('description', e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                      />
                    )}
                  </FormField>

                  {/* Photo: a small thumbnail picker, stored with the shop data. */}
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium">Photo</div>
                    <div className="flex items-center gap-4">
                      <label className="relative size-24 shrink-0 cursor-pointer rounded-lg border-2 border-dashed border-border hover:border-primary/60 bg-secondary/30 grid place-items-center overflow-hidden focus-within:ring-2 focus-within:ring-ring/50">
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => void handleImage(e)}
                        />
                        {imgPreview ? (
                          <img src={imgPreview} alt="" className="absolute inset-0 size-full object-cover" />
                        ) : p.categoryId ? (
                          <ProductImage categoryId={p.categoryId} size={48} />
                        ) : (
                          <ImageIcon className="size-8 text-muted-foreground opacity-60" />
                        )}
                        {imgBusy && (
                          <span className="absolute inset-0 grid place-items-center bg-background/70 text-xs font-medium">
                            Saving…
                          </span>
                        )}
                      </label>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          Click the box to choose a PNG or JPG.
                        </div>
                        {imgPreview && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setImgPreview(undefined);
                              set('image', undefined);
                            }}
                          >
                            <X className="size-4" /> Remove photo
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Page mode: Delete lives at the end, apart from Save. */}
            {!asDrawer && onDelete && initial && (
              <div className="rounded-xl border border-destructive/30 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Remove this product from the catalogue.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={onDelete}
                >
                  <Trash2 className="size-4" /> Delete product
                </Button>
              </div>
            )}
          </div>
        </div>

        {asDrawer && (
          <div className="border-t border-border bg-card px-5 py-3 flex items-center justify-between gap-2">
            {onDelete && initial ? (
              <Button
                type="button"
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={saving}>
                <Save className="size-4" /> {saving ? 'Saving…' : saveLabel ?? 'Save'}
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* Outside the <form>: these popups have forms of their own. */}
      <NewCategoryModal
        open={newCategoryOpen}
        onClose={() => setNewCategoryOpen(false)}
        onCreated={(id) => set('categoryId', id)}
      />
      <NewBrandModal
        open={newBrandOpen}
        onClose={() => setNewBrandOpen(false)}
        onCreated={(id) => set('brandId', id)}
      />
    </div>
  );
}

function UnitsEditor({
  base,
  available,
  conversions,
  units,
  onChange,
}: {
  base: string;
  available: string[];
  conversions: { unit: string; factor: number }[];
  units: { name: string; short: string }[];
  onChange: (available: string[], conversions: { unit: string; factor: number }[]) => void;
}) {
  const factor = (u: string) => conversions.find((c) => c.unit === u)?.factor ?? 1;
  const setFactor = (u: string, f: number) => {
    const next = conversions.filter((c) => c.unit !== u);
    next.push({ unit: u, factor: f });
    onChange(available, next);
  };
  const remove = (u: string) => {
    if (u === base) return;
    onChange(available.filter((x) => x !== u), conversions.filter((c) => c.unit !== u));
  };
  const add = (u: string) => {
    if (available.includes(u)) return;
    onChange([...available, u], [...conversions, { unit: u, factor: 1 }]);
  };
  const candidates = useMemo(
    () => units.filter((u) => !available.includes(u.short)),
    [units, available],
  );

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border divide-y divide-border">
        {available.map((u) => {
          const isBase = u === base;
          return (
            <div key={u} className="flex items-center gap-2 px-3 py-2 min-h-12">
              <div className="text-sm font-medium w-16" data-no-i18n>
                {u}
              </div>
              {isBase ? (
                <span className="flex-1 text-xs text-muted-foreground">Main unit</span>
              ) : (
                <div className="flex-1 flex items-center justify-end gap-2">
                  <span className="text-sm text-muted-foreground">
                    1 <span data-no-i18n>{u}</span> =
                  </span>
                  <NumberField
                    value={factor(u)}
                    onChangeNumber={(v) => setFactor(u, v)}
                    aria-label="Conversion factor"
                    className="h-9 w-24 px-2 text-right tabular"
                  />
                  <span className="text-sm text-muted-foreground" data-no-i18n>
                    {base}
                  </span>
                  <IconButton size="sm" tone="danger" label="Remove unit" onClick={() => remove(u)}>
                    <X className="size-4" />
                  </IconButton>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {candidates.length > 0 && (
        <Select
          className="w-auto"
          aria-label="Add a unit"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              add(e.target.value);
              e.currentTarget.value = '';
            }
          }}
        >
          <option value="">+ Add unit…</option>
          {candidates.map((u) => (
            <option key={u.short} value={u.short}>
              {u.name} ({u.short})
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
