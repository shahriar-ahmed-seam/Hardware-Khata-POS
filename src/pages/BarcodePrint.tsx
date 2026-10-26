import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Minus, Printer, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PrintSheet } from '@/components/ui/PrintSheet';
import { useProducts } from '@/hooks/useProducts';
import { useBrands } from '@/hooks/useCatalog';
import { useSettings, type BarcodeSettings } from '@/stores/settings';
import { printSheet, printerProfiles } from '@/lib/printing';
import { formatBDT } from '@/lib/utils';
import { ProductImage } from '@/components/products/ProductImage';
import { BarcodeSvg } from '@/components/products/BarcodeSvg';
import type { Product } from '@/types/domain';

type LabelSize = BarcodeSettings['defaultLabel'];

interface QueueItem {
  productId: string;
  copies: number;
}

const LABEL_PRESETS: { id: LabelSize; label: string; cols: number; w: string; h: string }[] = [
  { id: '50x30', label: '50 × 30 mm (single roll)', cols: 1, w: '50mm', h: '30mm' },
  { id: 'A4-grid', label: 'A4 sheet (3 cols × 10 rows)', cols: 3, w: '63mm', h: '29.7mm' },
];

/** The product list shows this many until the owner searches. */
const LIST_LIMIT = 50;
/** Labels drawn in the on-screen preview. */
const PREVIEW_COUNT = 3;

interface Fields {
  showName: boolean;
  showBrand: boolean;
  showBarcode: boolean;
  showSKU: boolean;
  showPrice: boolean;
}

/**
 * BARCODE LABELS. Defaults come from Settings → Barcode (size, fields, copies,
 * code type); changes here apply to this print only. The bars are real
 * EAN-13 / Code 128 (src/lib/barcode.ts).
 */
export default function BarcodePrint() {
  const settings = useSettings((s) => s.barcode);
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [size, setSize] = useState<LabelSize>(settings.defaultLabel);
  const [fields, setFields] = useState<Fields>({
    showName: settings.showName,
    showBrand: settings.showBrand,
    showBarcode: settings.showBarcode,
    showSKU: settings.showSKU,
    showPrice: settings.showPrice,
  });
  const setField = (k: keyof Fields) => (v: boolean) => setFields((f) => ({ ...f, [k]: v }));
  const copiesDefault = Math.max(1, Math.round(settings.defaultCopies || 1));
  const sheetRef = useRef<HTMLDivElement>(null);

  // Product source: the real catalogue (display/print only).
  const products = useProducts().data ?? [];
  const brands = useBrands().data ?? [];
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? '';

  // Rows picked on the Products screen arrive as ?ids=a,b,c — queue them once.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || products.length === 0) return;
    seeded.current = true;
    const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
    const known = ids.filter((id) => products.some((p) => p.id === id));
    if (known.length) setQueue(known.map((productId) => ({ productId, copies: copiesDefault })));
  }, [params, products, copiesDefault]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products.slice(0, LIST_LIMIT);
    return products.filter((p) => `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(t));
  }, [q, products]);
  const truncated = !q.trim() && products.length > LIST_LIMIT;

  const addToQueue = (id: string) =>
    setQueue((qq) =>
      qq.some((x) => x.productId === id) ? qq : [...qq, { productId: id, copies: copiesDefault }],
    );
  const updateCopies = (id: string, copies: number) => {
    if (copies <= 0) return setQueue((qq) => qq.filter((x) => x.productId !== id));
    setQueue((qq) => qq.map((x) => (x.productId === id ? { ...x, copies } : x)));
  };

  const totalLabels = queue.reduce((s, x) => s + x.copies, 0);
  const preset = LABEL_PRESETS.find((p) => p.id === size)!;

  const expanded = useMemo(() => {
    const rows: Product[] = [];
    queue.forEach((it) => {
      const p = products.find((x) => x.id === it.productId);
      if (p) for (let i = 0; i < it.copies; i++) rows.push(p);
    });
    return rows;
  }, [queue, products]);

  /**
   * A4 sheets go to the A4 printer from Settings → Printers when there is one.
   * Roll labels (and A4 with no A4 printer) open the print dialog, so the
   * owner picks the label printer: no printer profile is a label printer, and
   * the default one is the receipt roll.
   */
  const print = async () => {
    const a4 =
      size === 'A4-grid'
        ? printerProfiles().find((p) => p.paperWidth === 210 && p.connection !== 'network')
        : undefined;
    if (a4) await printSheet(sheetRef.current, { kind: 'document', profile: a4 });
    else window.print();
  };

  const labelProps = {
    w: preset.w,
    h: preset.h,
    fields,
    codeType: settings.codeType,
    brandName,
  };

  return (
    <div>
      <PageHeader
        title="Barcode labels"
        actions={
          <Button onClick={() => void print()} disabled={totalLabels === 0}>
            <Printer className="size-4" /> Print labels
            {totalLabels > 0 && <span className="tabular">({totalLabels})</span>}
          </Button>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
        {/* LEFT — product search */}
        <Card className="overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search product…"
                aria-label="Search product"
                className="pl-9"
                data-no-dirty
              />
            </div>
            {truncated && (
              <div className="text-xs text-muted-foreground mt-2">
                Showing the first 50 products. Search to find more.
              </div>
            )}
          </div>
          <div className="max-h-[calc(100vh-15rem)] overflow-auto">
            {list.map((p) => {
              const inQueue = queue.find((x) => x.productId === p.id);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 min-h-14 border-b border-border last:border-b-0 hover:bg-secondary/30"
                >
                  <ProductImage url={p.image} categoryId={p.categoryId} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate" data-no-i18n>
                      {p.sku}
                      {p.barcode ? ` · ${p.barcode}` : ''}
                    </div>
                  </div>
                  {inQueue ? (
                    <Stepper
                      value={inQueue.copies}
                      onChange={(n) => updateCopies(p.id, n)}
                    />
                  ) : (
                    <Button variant="outline" onClick={() => addToQueue(p.id)}>
                      <Plus className="size-4" /> Add
                    </Button>
                  )}
                </div>
              );
            })}
            {list.length === 0 && (
              <EmptyState
                compact
                icon={Search}
                title="No products found"
                message="Try another name, SKU or barcode."
              />
            )}
          </div>
        </Card>

        {/* RIGHT — settings, then preview & queue, kept in view */}
        <div className="space-y-4 lg:sticky lg:top-4">
          <Card className="p-4 space-y-3">
            <FormField label="Label size">
              {(f) => (
                <Select {...f} value={size} onChange={(e) => setSize(e.target.value as LabelSize)}>
                  {LABEL_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <div className="-mx-3 grid grid-cols-2">
              <ToggleRow label="Name" checked={fields.showName} onChange={setField('showName')} />
              <ToggleRow label="Price" checked={fields.showPrice} onChange={setField('showPrice')} />
              <ToggleRow label="Barcode" checked={fields.showBarcode} onChange={setField('showBarcode')} />
              <ToggleRow label="SKU" checked={fields.showSKU} onChange={setField('showSKU')} />
              <ToggleRow label="Brand" checked={fields.showBrand} onChange={setField('showBrand')} />
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Preview & queue</div>
              {queue.length > 0 && (
                <Button variant="ghost" onClick={() => setQueue([])}>
                  <Trash2 className="size-4" /> Clear all
                </Button>
              )}
            </div>
            {queue.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                Add products on the left to print their labels.
              </div>
            ) : (
              <>
                {/* Real size, first few labels only. */}
                <div className="rounded-md bg-white p-2 flex flex-wrap gap-2 justify-center overflow-hidden">
                  {expanded.slice(0, PREVIEW_COUNT).map((p, i) => (
                    <Label key={i} p={p} {...labelProps} />
                  ))}
                </div>
                <div className="divide-y divide-border max-h-48 overflow-auto">
                  {queue.map((it) => {
                    const p = products.find((x) => x.id === it.productId);
                    if (!p) return null;
                    return (
                      <div key={it.productId} className="flex items-center gap-2 py-1.5 text-sm">
                        <div className="flex-1 min-w-0 truncate font-medium">{p.name}</div>
                        <Stepper value={it.copies} onChange={(n) => updateCopies(it.productId, n)} />
                        <IconButton
                          size="sm"
                          tone="danger"
                          label="Remove from queue"
                          onClick={() => updateCopies(it.productId, 0)}
                        >
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    );
                  })}
                </div>
                <div className="text-sm text-muted-foreground">
                  <span>Labels to print</span>{' '}
                  <span className="font-semibold tabular text-foreground">{totalLabels}</span>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* What reaches the printer: a white sheet outside the app. */}
      {expanded.length > 0 && (
        <PrintSheet paper={size === 'A4-grid' ? 'A4' : '50mm'} sheetRef={sheetRef}>
          <div
            className="print-doc"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${preset.cols}, ${preset.w})`,
              gap: 0,
            }}
          >
            {expanded.map((p, i) => (
              <Label key={i} p={p} {...labelProps} pageBreak={size === '50x30'} />
            ))}
          </div>
        </PrintSheet>
      )}

      {/* Roll labels: one 50 × 30 mm page per label in the print dialog. */}
      {size === '50x30' && (
        <style>{`@media print { @page { size: 50mm 30mm; margin: 0; } }`}</style>
      )}
    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center rounded-md border border-border bg-secondary/40 shrink-0">
      <IconButton size="sm" label="One less" onClick={() => onChange(value - 1)}>
        <Minus className="size-4" />
      </IconButton>
      <input
        value={value}
        inputMode="numeric"
        aria-label="Copies"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(Math.min(999, Number(e.target.value.replace(/\D/g, '')) || 0))}
        className="w-14 h-9 bg-transparent text-center text-sm tabular outline-none"
      />
      <IconButton size="sm" label="One more" onClick={() => onChange(value + 1)}>
        <Plus className="size-4" />
      </IconButton>
    </div>
  );
}

/** One label. pt / mm sizes on purpose: this is the printed object. */
function Label({
  p,
  w,
  h,
  fields,
  codeType,
  brandName,
  pageBreak,
}: {
  p: Product;
  w: string;
  h: string;
  fields: Fields;
  codeType: BarcodeSettings['codeType'];
  brandName: (id: string) => string;
  pageBreak?: boolean;
}) {
  const code = p.barcode || p.sku;
  const brand = fields.showBrand ? brandName(p.brandId) : '';
  return (
    <div
      style={{
        width: w,
        height: h,
        padding: '1.5mm 2mm',
        boxSizing: 'border-box',
        breakAfter: pageBreak ? 'page' : undefined,
        breakInside: 'avoid',
      }}
      className="bg-white text-black text-center flex flex-col items-center justify-center overflow-hidden border border-black/20 print:border-0"
      data-no-i18n
    >
      {fields.showName && (
        <div style={{ fontSize: '8pt' }} className="font-semibold leading-tight line-clamp-1 w-full">
          {p.name}
        </div>
      )}
      {brand && (
        <div style={{ fontSize: '6.5pt' }} className="leading-tight truncate w-full">
          {brand}
        </div>
      )}
      {fields.showBarcode && code && (
        <div className="w-full my-[0.5mm]">
          <BarcodeSvg code={code} prefer={codeType} height="10mm" />
          {/* The number is always under the bars, so a person can type it in. */}
          <div style={{ fontSize: '7pt', letterSpacing: '0.05em' }} className="leading-none mt-[0.5mm]">
            {code}
          </div>
        </div>
      )}
      {(fields.showSKU || fields.showPrice) && (
        <div className="flex items-baseline justify-between gap-1 w-full mt-[0.5mm]">
          {fields.showSKU && p.sku && p.sku !== code ? (
            <div style={{ fontSize: '7pt' }} className="truncate">
              {p.sku}
            </div>
          ) : (
            <span />
          )}
          {fields.showPrice && (
            <div style={{ fontSize: '9pt' }} className="font-bold tabular">
              ৳ {formatBDT(p.price, { withSymbol: false })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
