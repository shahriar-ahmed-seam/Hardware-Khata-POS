import { Save, Barcode } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { NumberField } from '@/components/ui/NumberField';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

export default function BarcodeSettingsPage() {
  const b = useSettings((s) => s.barcode);
  const set = useSettings((s) => s.setBarcode);

  return (
    <div>
      <SettingsHeader
        title="Barcode Settings"
        subtitle="Defaults for the Barcode Print page"
        actions={
          <Button onClick={() => toast.success('Barcode settings saved')}>
            <Save className="size-4" /> Saved
          </Button>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Default label size</div>
            <div className="grid grid-cols-2 gap-2">
              {(['50x30', 'A4-grid'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => set({ defaultLabel: s })}
                  className={cn(
                    'h-12 rounded-md border text-sm font-medium transition',
                    b.defaultLabel === s
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  {s === '50x30' ? '50 × 30 mm (single roll)' : 'A4 sheet (3 × 10 grid)'}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-1">
            <div className="text-sm font-semibold mb-2">Show on label</div>
            <ToggleRow label="Product name" checked={b.showName} onChange={(v) => set({ showName: v })} />
            <ToggleRow label="SKU" checked={b.showSKU} onChange={(v) => set({ showSKU: v })} />
            <ToggleRow label="Barcode" checked={b.showBarcode} onChange={(v) => set({ showBarcode: v })} />
            <ToggleRow label="Sell price" checked={b.showPrice} onChange={(v) => set({ showPrice: v })} />
            <ToggleRow label="Brand" checked={b.showBrand} onChange={(v) => set({ showBrand: v })} />
            <ToggleRow label="MRP (printed price)" checked={b.showMRP} onChange={(v) => set({ showMRP: v })} />
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Defaults</div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                Default copies per product
              </label>
              <NumberField value={b.defaultCopies} onChangeNumber={(v) => set({ defaultCopies: Math.max(1, v) })} />
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                Code type
              </label>
              <select
                value={b.codeType}
                onChange={(e) => set({ codeType: e.target.value as 'Code128' | 'EAN-13' })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="Code128">Code 128 (recommended)</option>
                <option value="EAN-13">EAN-13</option>
              </select>
            </div>
          </Card>
        </div>

        <div>
          <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-2">
            Sample label
          </div>
          <div className="rounded-xl border border-border bg-muted p-8 grid place-items-center">
            <div
              style={{ width: '50mm', height: '30mm' }}
              className="bg-white text-black border border-black/30 rounded-sm p-1 text-center flex flex-col items-center justify-center"
            >
              {b.showName && <div className="text-[8pt] font-semibold">Cement OPC 50kg</div>}
              <div
                className="my-1 w-full h-3"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg,#000 0,#000 1px,#fff 1px,#fff 2px,#000 2px,#000 3px,#fff 3px,#fff 5px,#000 5px,#000 6px,#fff 6px,#fff 8px,#000 8px,#000 10px,#fff 10px,#fff 11px)',
                }}
              />
              {b.showBarcode && <div className="text-[7pt] font-mono">8801001000086</div>}
              <div className="flex items-center justify-between w-full mt-0.5">
                {b.showSKU && <div className="text-[6pt] font-mono opacity-70">BM-CMNT-OPC</div>}
                {b.showPrice && <div className="text-[8pt] font-bold tabular ml-auto">৳ 540.00</div>}
              </div>
              {b.showBrand && <div className="text-[6pt] mt-0.5 opacity-70">Generic</div>}
            </div>
            <div className="text-[10px] text-muted-foreground mt-3">
              Real preview uses the codeType setting. <Barcode className="size-3 inline" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
