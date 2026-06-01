import { Save } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { NumberField } from '@/components/ui/NumberField';
import { useSettings, type POSPrefs } from '@/stores/settings';
import { toast } from '@/stores/toast';
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

  const toggleVisible = (m: string) => {
    const visible = new Set(p.visiblePaymentMethods);
    if (visible.has(m)) visible.delete(m);
    else visible.add(m);
    // Always keep the default method visible
    visible.add(p.defaultPaymentMethod);
    set({ visiblePaymentMethods: Array.from(visible) });
  };

  return (
    <div>
      <SettingsHeader
        title="POS Preferences"
        subtitle="Defaults applied at the checkout screen"
        actions={
          <Button onClick={() => toast.success('POS preferences saved')}>
            <Save className="size-4" /> Saved
          </Button>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Pricing defaults</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Default markup %
                </label>
                <NumberField
                  value={p.defaultPriceMarkupPct}
                  onChangeNumber={(v) => set({ defaultPriceMarkupPct: v })}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Default order tax %
                </label>
                <NumberField
                  value={p.defaultOrderTaxPct}
                  onChangeNumber={(v) => set({ defaultOrderTaxPct: v })}
                />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              These pre-fill new cart lines and the order tax dropdown.
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Default payment method</div>
            <div className="grid grid-cols-3 gap-2">
              {ALL_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    set({ defaultPaymentMethod: m });
                    if (!p.visiblePaymentMethods.includes(m)) {
                      set({
                        visiblePaymentMethods: [...p.visiblePaymentMethods, m],
                      });
                    }
                  }}
                  className={cn(
                    'h-10 rounded-md border text-sm font-medium transition',
                    p.defaultPaymentMethod === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="text-sm font-semibold">Visible payment methods</div>
            <div className="text-[11px] text-muted-foreground -mt-1">
              Only methods toggled on appear in the Payment modal. The default method is always
              shown.
            </div>
            <div className="grid grid-cols-2 gap-1">
              {ALL_METHODS.map((m) => (
                <ToggleRow
                  key={m}
                  label={m}
                  checked={p.visiblePaymentMethods.includes(m)}
                  onChange={() => toggleVisible(m)}
                />
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4 space-y-1">
            <div className="text-sm font-semibold mb-2">Behavior</div>
            <ToggleRow
              label="Auto-print receipt on save"
              desc="Print as soon as payment completes, no extra click."
              checked={p.autoPrintOnSave}
              onChange={(v) => set({ autoPrintOnSave: v })}
            />
            <ToggleRow
              label="Big-button mode"
              desc="Larger product tiles and on-screen number pad. Good for touch screens."
              checked={p.bigButtonMode}
              onChange={(v) => set({ bigButtonMode: v })}
            />
            <ToggleRow
              label="Allow negative stock by default"
              desc="Sell items even when stock is zero. Can be overridden per cart."
              checked={p.allowNegativeStockDefault}
              onChange={(v) => set({ allowNegativeStockDefault: v })}
            />
            <ToggleRow
              label="Reset customer on new cart"
              desc="Each new cart starts with Walk-in customer. Turn off to keep last customer."
              checked={p.resetCustomerPerCart}
              onChange={(v) => set({ resetCustomerPerCart: v })}
            />
          </Card>

          <Card className="p-4 space-y-2 border-dashed">
            <div className="text-sm font-semibold">What this affects</div>
            <ul className="text-[12px] text-muted-foreground list-disc pl-5 space-y-0.5">
              <li>Markup / tax pre-fill on the POS hero screen</li>
              <li>Payment modal pre-selected method and shown buttons</li>
              <li>Negative stock guard at cart line level</li>
              <li>Customer reset behavior between transactions</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
