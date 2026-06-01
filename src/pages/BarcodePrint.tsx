import { useMemo, useState } from 'react';
import { Plus, Minus, Printer, Search, Trash2, Barcode as BarcodeIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { products as mockProducts } from '@/mocks/data';
import { useProducts } from '@/hooks/useProducts';
import { hasBackend } from '@/lib/api';
import { formatBDT, cn } from '@/lib/utils';
import { ProductImage } from '@/components/products/ProductImage';
import type { Product } from '@/mocks/data';

type LabelSize = '50x30' | 'A4-grid';

interface QueueItem {
  productId: string;
  copies: number;
}

const LABEL_PRESETS: { id: LabelSize; label: string; cols: number; w: string; h: string }[] = [
  { id: '50x30', label: '50 × 30 mm (single roll)', cols: 1, w: '50mm', h: '30mm' },
  { id: 'A4-grid', label: 'A4 sheet (3 cols × 10 rows)', cols: 3, w: '63mm', h: '29.7mm' },
];

export default function BarcodePrint() {
  const [q, setQ] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [size, setSize] = useState<LabelSize>('50x30');
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showSKU, setShowSKU] = useState(true);

  // Product source: real catalogue under backend (display/print only), mock otherwise.
  const productsQuery = useProducts();
  const products = hasBackend() ? (productsQuery.data ?? []) : mockProducts;

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products.slice(0, 50);
    return products.filter((p) =>
      `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(t),
    );
  }, [q, products]);

  const addToQueue = (id: string) => {
    setQueue((qq) => {
      const idx = qq.findIndex((x) => x.productId === id);
      if (idx >= 0) {
        const next = [...qq];
        next[idx] = { ...next[idx], copies: next[idx].copies + 1 };
        return next;
      }
      return [...qq, { productId: id, copies: 1 }];
    });
  };

  const updateCopies = (id: string, copies: number) => {
    if (copies <= 0) return setQueue((qq) => qq.filter((x) => x.productId !== id));
    setQueue((qq) => qq.map((x) => (x.productId === id ? { ...x, copies } : x)));
  };

  const totalLabels = queue.reduce((s, x) => s + x.copies, 0);
  const preset = LABEL_PRESETS.find((p) => p.id === size)!;

  const expanded = useMemo(() => {
    const rows: { p: Product; n: number }[] = [];
    queue.forEach((q) => {
      const p = products.find((x) => x.id === q.productId);
      if (!p) return;
      for (let i = 0; i < q.copies; i++) rows.push({ p, n: i });
    });
    return rows;
  }, [queue, products]);

  return (
    <div>
      <PageHeader
        title="Barcode Print"
        subtitle="Pick products → set copies → print labels"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQueue([])}
              disabled={queue.length === 0}
            >
              <Trash2 className="size-4" /> Clear
            </Button>
            <Button onClick={() => window.print()} disabled={totalLabels === 0}>
              <Printer className="size-4" /> Print {totalLabels} label{totalLabels === 1 ? '' : 's'}
            </Button>
          </>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-4 print:hidden">
        {/* LEFT — product search */}
        <div className="xl:col-span-2 space-y-3">
          <Card className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search product…"
                className="pl-9"
              />
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="max-h-[60vh] overflow-auto scroll-hide">
              {list.map((p) => {
                const inQueue = queue.find((x) => x.productId === p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0 hover:bg-secondary/30"
                  >
                    <ProductImage url={p.image} categoryId={p.categoryId} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {p.sku} · {p.barcode}
                      </div>
                    </div>
                    {inQueue ? (
                      <div className="flex items-center bg-secondary rounded-md">
                        <button
                          onClick={() => updateCopies(p.id, inQueue.copies - 1)}
                          className="size-7 grid place-items-center hover:bg-background rounded-l-md"
                        >
                          <Minus className="size-3" />
                        </button>
                        <input
                          value={inQueue.copies}
                          onChange={(e) => updateCopies(p.id, Number(e.target.value) || 0)}
                          className="w-10 bg-transparent text-center text-xs font-mono tabular outline-none"
                        />
                        <button
                          onClick={() => updateCopies(p.id, inQueue.copies + 1)}
                          className="size-7 grid place-items-center hover:bg-background rounded-r-md"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => addToQueue(p.id)}>
                        <Plus className="size-3.5" /> Add
                      </Button>
                    )}
                  </div>
                );
              })}
              {list.length === 0 && (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">No products.</div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT — settings + queue */}
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Label settings</div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">Size</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as LabelSize)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              >
                {LABEL_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 text-sm">
              <Toggle label="Show name" checked={showName} onChange={setShowName} />
              <Toggle label="Show SKU" checked={showSKU} onChange={setShowSKU} />
              <Toggle label="Show price" checked={showPrice} onChange={setShowPrice} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Queue</div>
              <Badge variant="info">{totalLabels} labels</Badge>
            </div>
            {queue.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                No products selected.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-auto scroll-hide">
                {queue.map((q) => {
                  const p = products.find((x) => x.id === q.productId);
                  if (!p) return null;
                  return (
                    <div key={q.productId} className="flex items-center gap-2 text-xs">
                      <div className="flex-1 truncate font-medium">{p.name}</div>
                      <span className="font-mono tabular">×{q.copies}</span>
                      <button
                        onClick={() => updateCopies(q.productId, 0)}
                        className="size-6 grid place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Preview */}
      <div className="p-6 print:p-0">
        <div className="text-[11px] text-muted-foreground uppercase font-semibold mb-2 print:hidden">
          Preview
        </div>
        <div
          className="bg-white text-black rounded-md p-4 print:p-0"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${preset.cols}, 1fr)`,
            gap: '4mm',
          }}
        >
          {expanded.map((row, i) => (
            <Label
              key={i}
              p={row.p}
              w={preset.w}
              h={preset.h}
              showName={showName}
              showPrice={showPrice}
              showSKU={showSKU}
            />
          ))}
          {expanded.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground text-sm py-12 print:hidden">
              Preview shows here once you add items.
            </div>
          )}
        </div>
      </div>

      {/* Print stylesheet */}
      <style>{`
        @media print {
          body, html, #root, .app-shell { background: white !important; }
          .scroll-hide, header, aside, nav, .titlebar-drag { display: none !important; }
          @page { margin: 8mm; }
        }
      `}</style>
    </div>
  );
}

function Label({
  p,
  w,
  h,
  showName,
  showPrice,
  showSKU,
}: {
  p: Product;
  w: string;
  h: string;
  showName: boolean;
  showPrice: boolean;
  showSKU: boolean;
}) {
  return (
    <div
      style={{ width: w, height: h }}
      className="bg-white text-black border border-black/30 rounded-sm p-1 text-center flex flex-col items-center justify-center overflow-hidden"
    >
      {showName && (
        <div className="text-[8pt] font-semibold leading-tight line-clamp-1">
          {p.name}
        </div>
      )}
      <div
        className="my-0.5 w-full h-3"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg,#000 0,#000 1px,#fff 1px,#fff 2px,#000 2px,#000 3px,#fff 3px,#fff 5px,#000 5px,#000 6px,#fff 6px,#fff 8px,#000 8px,#000 10px,#fff 10px,#fff 11px)',
        }}
      />
      {showSKU && (
        <div className="text-[7pt] font-mono leading-none">{p.barcode || p.sku}</div>
      )}
      <div className="flex items-center justify-between w-full mt-0.5">
        {showSKU && <div className="text-[6pt] font-mono opacity-70 truncate">{p.sku}</div>}
        {showPrice && (
          <div className="text-[8pt] font-bold tabular ml-auto">
            ৳ {formatBDT(p.price, { withSymbol: false })}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between p-2 rounded-md hover:bg-secondary/40 text-left transition"
    >
      <span className="text-sm">{label}</span>
      <span
        className={cn(
          'relative inline-block w-9 h-5 rounded-full transition',
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

// Suppress unused
void BarcodeIcon;
