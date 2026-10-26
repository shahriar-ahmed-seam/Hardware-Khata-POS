import { AlertTriangle } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { AutoSaveNote } from '@/components/settings/AutoSaveNote';
import { Card } from '@/components/ui/Card';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { Switch } from '@/components/ui/Switch';
import { NumberField } from '@/components/ui/NumberField';
import { FormField } from '@/components/ui/FormField';
import { Segmented } from '@/components/ui/Segmented';
import { useSettings, type POSPrefs } from '@/stores/settings';
import { usePOS, type Orientation } from '@/stores/pos';
import { labelFor } from '@/lib/labels';
import { cn } from '@/lib/utils';

const ALL_METHODS: POSPrefs['defaultPaymentMethod'][] = [
  'Cash',
  'bKash',
  'Nagad',
  'Card',
  'Bank',
  'Credit',
];

export default function POSPrefsPage() {
  const p = useSettings((s) => s.pos);
  const set = useSettings((s) => s.setPOS);
  // Layout lives in the POS layout store (this computer only).
  const orientation = usePOS((s) => s.orientation);
  const setOrientation = usePOS((s) => s.setOrientation);

  const setVisible = (m: string, on: boolean) => {
    const visible = new Set(p.visiblePaymentMethods);
    if (on) visible.add(m);
    else visible.delete(m);
    // Always keep the default method visible
    visible.add(p.defaultPaymentMethod);
    set({ visiblePaymentMethods: Array.from(visible) });
  };

  const makeDefault = (m: POSPrefs['defaultPaymentMethod']) => {
    set({
      defaultPaymentMethod: m,
      ...(p.visiblePaymentMethods.includes(m) ? {} : { visiblePaymentMethods: [...p.visiblePaymentMethods, m] }),
    });
  };

  return (
    <div>
      <SettingsHeader title="POS Preferences" actions={<AutoSaveNote />} />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
        <div className="space-y-4">
          <Card className="p-4 space-y-1">
            <div className="text-sm font-semibold mb-2">Selling screen</div>
            <ToggleRow
              label="Big-button mode"
              desc="Larger product tiles and on-screen number pad. Good for touch screens."
              checked={p.bigButtonMode}
              onChange={(v) => set({ bigButtonMode: v })}
            />
            <ToggleRow
              label="Auto-print receipt on save"
              desc="Print as soon as payment completes, no extra click."
              checked={p.autoPrintOnSave}
              onChange={(v) => set({ autoPrintOnSave: v })}
            />
            <ToggleRow
              label="Reset customer on new cart"
              desc="Each new cart starts with Walk-in customer. Turn off to keep last customer."
              checked={p.resetCustomerPerCart}
              onChange={(v) => set({ resetCustomerPerCart: v })}
            />
            <div className="p-3">
              <FormField label="Cart side" hint="Swap panel side. On this computer only.">
                <Segmented<Orientation>
                  ariaLabel="Cart side"
                  value={orientation}
                  onChange={setOrientation}
                  options={[
                    { value: 'cart-left', label: 'Left' },
                    { value: 'cart-right', label: 'Right' },
                  ]}
                />
              </FormField>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Pricing defaults</div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Default markup %">
                {(f) => (
                  <NumberField
                    {...f}
                    value={p.defaultPriceMarkupPct}
                    onChangeNumber={(v) => set({ defaultPriceMarkupPct: v })}
                  />
                )}
              </FormField>
              <FormField label="Default order tax %">
                {(f) => (
                  <NumberField
                    {...f}
                    value={p.defaultOrderTaxPct}
                    onChangeNumber={(v) => set({ defaultOrderTaxPct: v })}
                  />
                )}
              </FormField>
            </div>
            <div className="text-xs text-muted-foreground">
              These pre-fill new cart lines and the order tax dropdown.
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {/* One list: show/hide each method, and pick the default. */}
          <Card className="p-4 space-y-2">
            <div className="text-sm font-semibold">Payment methods</div>
            <div className="text-xs text-muted-foreground">
              Only methods turned on appear in the Payment window. The default method is always shown.
            </div>
            <div className="divide-y divide-border rounded-md border border-border">
              {ALL_METHODS.map((m) => {
                const isDefault = p.defaultPaymentMethod === m;
                const shown = isDefault || p.visiblePaymentMethods.includes(m);
                return (
                  <div key={m} className="flex items-center gap-3 px-3 min-h-12">
                    <span className="flex-1 text-sm font-medium">{labelFor('paymentMethod', m)}</span>
                    <label
                      className={cn(
                        'inline-flex items-center gap-2 h-9 px-2 rounded-md text-sm cursor-pointer hover:bg-secondary',
                        isDefault && 'text-primary font-medium',
                      )}
                    >
                      <input
                        type="radio"
                        name="default-payment"
                        className="size-4 accent-[hsl(var(--primary))]"
                        checked={isDefault}
                        onChange={() => makeDefault(m)}
                      />
                      <span>Default</span>
                    </label>
                    <Switch
                      checked={shown}
                      disabled={isDefault}
                      label={labelFor('paymentMethod', m)}
                      onChange={(v) => setVisible(m, v)}
                    />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-4 space-y-1">
            <div className="text-sm font-semibold mb-1">Advanced</div>
            <div className="flex items-start gap-2 px-3 text-xs text-warning">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <span>Selling below zero stock makes stock counts wrong until you fix them.</span>
            </div>
            <ToggleRow
              label="Allow negative stock by default"
              desc="Sell items even when stock is zero. Can be overridden per cart."
              checked={p.allowNegativeStockDefault}
              onChange={(v) => set({ allowNegativeStockDefault: v })}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
