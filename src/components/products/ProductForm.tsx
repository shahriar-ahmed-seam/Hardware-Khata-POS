import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Trash2,
  RotateCcw,
  Image as ImageIcon,
  Plus,
  X,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProductImage } from './ProductImage';
import {
  brands as mockBrands,
  categories as mockCategories,
  units as mockUnits,
  type Product,
} from '@/mocks/data';
import { useCategories, useBrands, useUnits } from '@/hooks/useCatalog';
import { hasBackend } from '@/lib/api';
import { cn } from '@/lib/utils';
import { NumberField } from '@/components/ui/NumberField';

interface Props {
  initial?: Product;
  onSave: (p: Product) => void;
  onDelete?: () => void;
  /** When true, render in drawer mode (no top back button, slimmer headers). */
  asDrawer?: boolean;
  onCancel?: () => void;
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

export function ProductForm({ initial, onSave, onDelete, asDrawer, onCancel }: Props) {
  const nav = useNavigate();
  const [p, setP] = useState<Product>(initial ?? EMPTY);
  const [imgPreview, setImgPreview] = useState<string | undefined>(initial?.image);

  // Source dropdown options from the backend when available so editing a product
  // writes REAL category/brand/unit ids (not mock ids like `c1`). Falls back to
  // the mock master data outside Electron.
  const backend = hasBackend();
  const categoriesQuery = useCategories();
  const brandsQuery = useBrands();
  const unitsQuery = useUnits();
  const categories = backend ? (categoriesQuery.data ?? []) : mockCategories;
  const brands = backend ? (brandsQuery.data ?? []) : mockBrands;
  const units = backend ? (unitsQuery.data ?? []) : mockUnits;

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));

  const margin = p.cost > 0 ? ((p.price - p.cost) / p.cost) * 100 : 0;

  const generateSku = () => {
    const cat = categories.find((c) => c.id === p.categoryId)?.name?.slice(0, 2).toUpperCase() ?? 'SK';
    const br = brands.find((b) => b.id === p.brandId)?.name?.slice(0, 3).toUpperCase() ?? 'GEN';
    const num = String(Math.floor(Math.random() * 900) + 100);
    set('sku', `${cat}-${br}-${num}`);
  };
  const generateBarcode = () => {
    // 13-digit pseudo EAN
    const base = '880' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
    const digits = base.slice(0, 12);
    // simple checksum (not strictly EAN-13 but plausible)
    const sum = digits
      .split('')
      .map((d, i) => Number(d) * (i % 2 === 0 ? 1 : 3))
      .reduce((s, x) => s + x, 0);
    const check = (10 - (sum % 10)) % 10;
    set('barcode', digits + check);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setImgPreview(url);
    set('image', url);
  };

  const submit = () => {
    if (!p.name.trim() || !p.sku.trim() || p.price <= 0) return;
    const finalProduct: Product = {
      ...p,
      id: p.id || `p_${Date.now()}`,
      createdAt: p.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(finalProduct);
  };

  const isValid = p.name.trim() && p.sku.trim() && p.price > 0 && p.categoryId && p.brandId;

  return (
    <div className={cn('flex flex-col', asDrawer ? '' : 'min-h-full')}>
      {!asDrawer && (
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border bg-card/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => nav(-1)} title="Back">
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {initial ? 'Edit Product' : 'Add Product'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {initial ? p.name : 'Create a new product in your catalogue'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onDelete && initial && (
              <Button variant="outline" onClick={onDelete}>
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setP(initial ?? EMPTY)}>
              <RotateCcw className="size-4" /> Reset
            </Button>
            <Button onClick={submit} disabled={!isValid}>
              <Save className="size-4" /> {initial ? 'Save Changes' : 'Save Product'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className={cn('mx-auto max-w-5xl', asDrawer ? 'p-4' : 'p-6')}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT (image + basic) */}
            <div className="lg:col-span-1 space-y-4">
              <Section title="Image" subtitle="Optional · 1 photo">
                <label className="block cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
                  <div className="aspect-square w-full rounded-xl border-2 border-dashed border-border hover:border-primary/60 grid place-items-center bg-secondary/30 transition relative overflow-hidden">
                    {imgPreview ? (
                      <img src={imgPreview} alt="" className="absolute inset-0 size-full object-cover" />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="size-10 mx-auto mb-2 opacity-50" />
                        <div className="text-sm">Click to upload</div>
                        <div className="text-[11px] mt-0.5">PNG, JPG up to 1MB</div>
                      </div>
                    )}
                  </div>
                </label>
                {imgPreview && (
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-[11px] text-muted-foreground">Preview</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setImgPreview(undefined);
                        set('image', undefined);
                      }}
                    >
                      <X className="size-3.5" /> Remove
                    </Button>
                  </div>
                )}
                {!imgPreview && p.categoryId && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <ProductImage categoryId={p.categoryId} size={28} />
                    <span>This category placeholder will appear in lists when no image.</span>
                  </div>
                )}
              </Section>

              <Section title="Status" subtitle="Behaviour in catalogue & POS">
                <div className="space-y-2">
                  <Toggle
                    label="Track stock"
                    desc="Subtract from stock when sold"
                    checked={!!p.manageStock}
                    onChange={(v) => set('manageStock', v)}
                  />
                  <Toggle
                    label="Allow negative sale"
                    desc="Sell beyond available stock"
                    checked={!!p.allowNegativeSale}
                    onChange={(v) => set('allowNegativeSale', v)}
                  />
                  <Toggle
                    label="Allow discount"
                    desc="Cashier can discount this item"
                    checked={!!p.allowDiscount}
                    onChange={(v) => set('allowDiscount', v)}
                  />
                  <Toggle
                    label="Show in POS"
                    desc="Visible in product picker"
                    checked={!!p.showInPOS}
                    onChange={(v) => set('showInPOS', v)}
                  />
                  <Toggle
                    label="Not for sale"
                    desc="Purchase-only item (no POS sales)"
                    checked={!!p.notForSale}
                    onChange={(v) => set('notForSale', v)}
                  />
                </div>
              </Section>
            </div>

            {/* RIGHT (most fields) */}
            <div className="lg:col-span-2 space-y-4">
              <Section title="Basic Information" subtitle="Required" required>
                <Field label="Product name" required>
                  <Input value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Claw Hammer 16oz" />
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field
                    label="SKU"
                    required
                    rightAction={
                      <button
                        type="button"
                        onClick={generateSku}
                        className="text-[11px] inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Wand2 className="size-3" /> auto
                      </button>
                    }
                  >
                    <Input value={p.sku} onChange={(e) => set('sku', e.target.value)} placeholder="HT-STN-01" />
                  </Field>
                  <Field
                    label="Barcode"
                    rightAction={
                      <button
                        type="button"
                        onClick={generateBarcode}
                        className="text-[11px] inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Wand2 className="size-3" /> auto
                      </button>
                    }
                  >
                    <Input value={p.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="8801XXXXXXXXX" />
                  </Field>
                  <Field label="Category" required>
                    <Select value={p.categoryId} onChange={(v) => set('categoryId', v)}>
                      <option value="">Select category…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Brand" required>
                    <Select value={p.brandId} onChange={(v) => set('brandId', v)}>
                      <option value="">Select brand…</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </Section>

              <Section title="Pricing" subtitle="All values in BDT">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Cost price">
                    <NumberInput
                      value={p.cost}
                      onChange={(v) => set('cost', v)}
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label="Sell price (SPR)" required hint="Base selling price reference">
                    <NumberInput value={p.price} onChange={(v) => set('price', v)} placeholder="0.00" />
                  </Field>
                  <Field label="Wholesale price" hint="Optional — used when cart price group is Wholesale">
                    <NumberInput
                      value={p.wholesalePrice ?? 0}
                      onChange={(v) => set('wholesalePrice', v || undefined)}
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label="Contractor price" hint="Optional — used when cart price group is Contractor">
                    <NumberInput
                      value={p.contractorPrice ?? 0}
                      onChange={(v) => set('contractorPrice', v || undefined)}
                      placeholder="0.00"
                    />
                  </Field>
                </div>
                {p.cost > 0 && p.price > 0 && (
                  <div className="mt-3 px-3 py-2 rounded-md bg-secondary/50 border border-border text-[12px] flex items-center justify-between">
                    <span className="text-muted-foreground">Profit margin</span>
                    <span
                      className={cn(
                        'font-mono tabular font-semibold',
                        margin > 0 ? 'text-success' : margin < 0 ? 'text-destructive' : '',
                      )}
                    >
                      {margin.toFixed(1)}% · ৳ {(p.price - p.cost).toFixed(2)} per unit
                    </span>
                  </div>
                )}
              </Section>

              <Section title="Units" subtitle="Base unit + alternates with conversions">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Base unit" required>
                    <Select
                      value={p.unit}
                      onChange={(v) => {
                        set('unit', v);
                        // make sure base unit is in availableUnits
                        if (!p.availableUnits?.includes(v)) {
                          set('availableUnits', [v, ...(p.availableUnits ?? [])]);
                        }
                      }}
                    >
                      {units.map((u) => (
                        <option key={u.short} value={u.short}>
                          {u.name} ({u.short})
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Tax %" hint="Default 0; VAT applied at order level">
                    <NumberInput value={p.tax ?? 0} onChange={(v) => set('tax', v)} placeholder="0" />
                  </Field>
                </div>

                <div className="mt-3">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-1.5">
                    Alternate units & conversions
                  </div>
                  <UnitsEditor
                    base={p.unit}
                    available={p.availableUnits ?? [p.unit]}
                    conversions={p.unitConversions ?? []}
                    units={units}
                    onChange={(available, conversions) => {
                      setP((x) => ({ ...x, availableUnits: available, unitConversions: conversions }));
                    }}
                  />
                </div>
              </Section>

              <Section title="Stock" subtitle="Per branch · for first-time setup, use Opening Stock import">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Opening stock">
                    <NumberInput value={p.stock} onChange={(v) => set('stock', v)} placeholder="0" />
                  </Field>
                  <Field label="Reorder level" hint="Trigger Low Stock alert when stock ≤ this">
                    <NumberInput
                      value={p.reorderLevel}
                      onChange={(v) => set('reorderLevel', v)}
                      placeholder="0"
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Description" subtitle="Optional · printed on detail view">
                <textarea
                  value={p.description ?? ''}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Notes about this product (specs, source, anything useful)…"
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                />
              </Section>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer mode footer */}
      {asDrawer && (
        <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-between">
          {onDelete && initial ? (
            <Button variant="outline" onClick={onDelete}>
              <Trash2 className="size-4" /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button onClick={submit} disabled={!isValid}>
              <Save className="size-4" /> Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Reusable bits ---------- */

function Section({
  title,
  subtitle,
  required,
  children,
}: {
  title: string;
  subtitle?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card edge-top p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold tracking-tight">
            {title} {required && <span className="text-destructive">*</span>}
          </div>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  rightAction,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        {rightAction}
      </div>
      {children}
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
    >
      {children}
    </select>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  return (
    <NumberField
      value={value}
      onChangeNumber={onChange}
      placeholder={placeholder}
      className="text-right"
    />
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between p-2.5 rounded-md hover:bg-secondary/40 text-left transition"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground">{desc}</div>}
      </div>
      <span
        className={cn(
          'relative inline-block w-9 h-5 rounded-full transition shrink-0',
          checked ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white transition',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
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
            <div key={u} className="flex items-center gap-2 px-3 py-2">
              <div className="text-sm font-medium w-20">{u}</div>
              <div className="flex-1 text-[11px] text-muted-foreground">
                {isBase ? 'Base unit' : `Conversion to ${base}`}
              </div>
              {!isBase ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">1 {u} =</span>
                  <NumberField
                    value={factor(u)}
                    onChangeNumber={(v) => setFactor(u, v)}
                    placeholder="0"
                    className="h-7 w-20 px-2 text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">{base}</span>
                  <button
                    type="button"
                    onClick={() => remove(u)}
                    className="ml-1 size-7 grid place-items-center rounded-md hover:bg-destructive/10 hover:text-destructive"
                    title="Remove"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground italic">factor 1</span>
              )}
            </div>
          );
        })}
      </div>

      {candidates.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            id="add-unit"
            className="h-8 px-2 rounded-md border border-input bg-background text-xs outline-none focus:ring-2 focus:ring-ring/50"
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
          </select>
        </div>
      )}
    </div>
  );
}
