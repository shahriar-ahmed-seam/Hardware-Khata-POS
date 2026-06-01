import { useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { useSettings } from '@/stores/settings';
import { Receipt } from '@/components/pos/Receipt';
import type { ParkedCart } from '@/components/pos/types';
import type { PaymentResult } from '@/components/pos/PaymentModal';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

const SAMPLE_CART: ParkedCart = {
  id: 'sample',
  label: 'Sample',
  customerId: 'cu2',
  priceGroup: 'retail',
  orderDiscountPct: 0,
  orderDiscountFlat: 200,
  orderTaxPct: 0,
  shippingCharge: 0,
  otherCharge: 0,
  lines: [
    {
      productId: 'p8',
      name: 'Cement OPC 50kg',
      sku: 'BM-CMNT-OPC',
      qty: 5,
      unit: 'bag',
      availableUnits: ['bag'],
      basePrice: 540,
      markupPct: 0,
      discountPct: 0,
      discountFlat: 0,
      taxPct: 0,
    },
    {
      productId: 'p1',
      name: 'Claw Hammer 16oz',
      sku: 'HT-CLW-16',
      qty: 1,
      unit: 'pc',
      availableUnits: ['pc'],
      basePrice: 520,
      markupPct: 0,
      discountPct: 0,
      discountFlat: 0,
      taxPct: 0,
    },
  ],
};

const SAMPLE_PAYMENT: PaymentResult = {
  payments: [{ id: 'p1', method: 'Cash', amount: 3020 }],
  totalPaid: 3020,
  change: 0,
  due: 0,
};

export default function ReceiptTemplatePage() {
  const r = useSettings((s) => s.receipt);
  const set = useSettings((s) => s.setReceipt);

  const [headerText, setHeaderText] = useState(r.headerLines.join('\n'));
  const [footerText, setFooterText] = useState(r.footerLines.join('\n'));

  const save = () => {
    set({
      headerLines: headerText.split('\n').filter(Boolean),
      footerLines: footerText.split('\n').filter(Boolean),
    });
    toast.success('Receipt template saved');
  };

  return (
    <div>
      <SettingsHeader
        title="Receipt Template"
        subtitle="Configure what appears on printed receipts"
        actions={
          <Button onClick={save}>
            <Save className="size-4" /> Save Changes
          </Button>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* LEFT — settings */}
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Paper</div>
            <div className="grid grid-cols-3 gap-2">
              {(['50mm', '80mm', 'A4'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => set({ paperSize: p })}
                  className={cn(
                    'h-12 rounded-md border text-sm font-medium transition',
                    r.paperSize === p
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Header</div>
            <ToggleRow
              label="Show shop logo"
              checked={r.showLogo}
              onChange={(v) => set({ showLogo: v })}
            />
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                Header text (one line per row)
              </label>
              <textarea
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                rows={3}
                placeholder="Thank you for your purchase"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
              />
            </div>
          </Card>

          <Card className="p-4 space-y-1">
            <div className="text-sm font-semibold mb-2">Show on receipt</div>
            <ToggleRow label="Cashier name" checked={r.showCashier} onChange={(v) => set({ showCashier: v })} />
            <ToggleRow label="Customer phone" checked={r.showCustomerPhone} onChange={(v) => set({ showCustomerPhone: v })} />
            <ToggleRow label="Customer address" checked={r.showCustomerAddress} onChange={(v) => set({ showCustomerAddress: v })} />
            <ToggleRow label="Line discount" checked={r.showLineDiscount} onChange={(v) => set({ showLineDiscount: v })} />
            <ToggleRow label="Line tax" checked={r.showLineTax} onChange={(v) => set({ showLineTax: v })} />
            <ToggleRow label="Payment reference / TxID" checked={r.showPaymentRef} onChange={(v) => set({ showPaymentRef: v })} />
            <ToggleRow label="Barcode of invoice no" checked={r.showBarcode} onChange={(v) => set({ showBarcode: v })} />
            <ToggleRow label="QR code (invoice link)" checked={r.showQRCode} onChange={(v) => set({ showQRCode: v })} />
            <ToggleRow label="Amount in words" checked={r.showAmountInWords} onChange={(v) => set({ showAmountInWords: v })} />
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Footer</div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                Footer text (one line per row)
              </label>
              <textarea
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                rows={3}
                placeholder="Returns within 7 days with receipt"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
              />
            </div>
          </Card>
        </div>

        {/* RIGHT — preview */}
        <div>
          <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-2">
            Live preview
          </div>
          <div className="rounded-xl border border-border bg-muted p-6 overflow-auto">
            <div className="mx-auto" style={{ width: r.paperSize === '80mm' ? 360 : r.paperSize === '50mm' ? 240 : 720 }}>
              <Receipt invoiceNo="INV-2026-0500" cart={SAMPLE_CART} payment={SAMPLE_PAYMENT} />
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">
            The preview always uses the current shop info and settings. Sample data only.
          </div>
        </div>
      </div>
    </div>
  );
}

void Plus;
void Trash2;
void Input;
