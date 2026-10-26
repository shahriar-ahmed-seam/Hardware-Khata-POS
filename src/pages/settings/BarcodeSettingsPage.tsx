import { Check } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { AutoSaveNote } from '@/components/settings/AutoSaveNote';
import { Card } from '@/components/ui/Card';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { NumberField } from '@/components/ui/NumberField';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { useSettings } from '@/stores/settings';
import { cn, formatBDT } from '@/lib/utils';

export default function BarcodeSettingsPage() {
  const b = useSettings((s) => s.barcode);
  const set = useSettings((s) => s.setBarcode);

  return (
    <div>
      <SettingsHeader title="Barcode labels" actions={<AutoSaveNote />} />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Default label size</div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Default label size">
              {(['50x30', 'A4-grid'] as const).map((s) => {
                const on = b.defaultLabel === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ defaultLabel: s })}
                    className={cn(
                      'h-12 px-2 rounded-md border text-sm font-medium transition inline-flex items-center justify-center gap-1.5 focus-ring',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-secondary',
                    )}
                  >
                    {on && <Check className="size-4 shrink-0" />}
                    {s === '50x30' ? '50 × 30 mm (single roll)' : 'A4 sheet (3 × 10 grid)'}
                  </button>
                );
              })}
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
            <FormField label="Default copies per product">
              {(f) => (
                <NumberField
                  {...f}
                  value={b.defaultCopies}
                  onChangeNumber={(v) => set({ defaultCopies: Math.max(1, v) })}
                />
              )}
            </FormField>
            <FormField label="Code type">
              {(f) => (
                <Select
                  {...f}
                  value={b.codeType}
                  onChange={(e) => set({ codeType: e.target.value as 'Code128' | 'EAN-13' })}
                >
                  <option value="Code128">Code 128 (recommended)</option>
                  <option value="EAN-13">EAN-13</option>
                </Select>
              )}
            </FormField>
          </Card>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Sample label</div>
          {/* Printed-size sample: pt sizes on purpose (it is a picture of the label). */}
          <div className="rounded-xl border border-border bg-muted p-8 grid place-items-center" data-no-i18n>
            <div
              style={{ width: '50mm', height: '30mm' }}
              className="bg-white text-black border border-black/30 rounded-sm p-1 text-center flex flex-col items-center justify-center"
            >
              {b.showName && <div className="text-[8pt] font-semibold">Cement OPC 50kg</div>}
              {b.showBarcode && (
                <>
                  <div
                    className="my-1 w-full h-3"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(90deg,#000 0,#000 1px,#fff 1px,#fff 2px,#000 2px,#000 3px,#fff 3px,#fff 5px,#000 5px,#000 6px,#fff 6px,#fff 8px,#000 8px,#000 10px,#fff 10px,#fff 11px)',
                    }}
                  />
                  <div className="text-[7pt] font-mono">8801001000086</div>
                </>
              )}
              <div className="flex items-center justify-between gap-1 w-full mt-0.5">
                {b.showSKU && <div className="text-[6pt] font-mono opacity-70">BM-CMNT-OPC</div>}
                {b.showMRP && <div className="text-[6pt] line-through opacity-70 ml-auto">MRP {formatBDT(560)}</div>}
                {b.showPrice && <div className={cn('text-[8pt] font-bold tabular', !b.showMRP && 'ml-auto')}>{formatBDT(540)}</div>}
              </div>
              {b.showBrand && <div className="text-[6pt] mt-0.5 opacity-70">Generic</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
