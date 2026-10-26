import { ReactNode } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { formatBDT, formatNumber, cn } from '@/lib/utils';

/** One line of a stock document (adjustment or transfer). qty may be signed. */
export interface DocLine {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unit: string;
  unitCost: number;
}

/**
 * Read-only view of a stock adjustment or transfer: who/when facts, then the
 * lines with their value. Opened by a row click on the list pages.
 */
export function StockDocDrawer({
  open,
  onClose,
  title,
  subtitle,
  facts,
  lines,
  signed,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Label → value rows (date, branch, by, reason…). Empty values are skipped. */
  facts: { label: string; value: ReactNode }[];
  lines: DocLine[];
  /** Show +/− and colour (adjustments). */
  signed?: boolean;
}) {
  const total = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const sign = (v: number) => (!signed ? '' : v > 0 ? '+' : v < 0 ? '−' : '');
  const tone = (v: number) => (!signed ? '' : v < 0 ? 'text-destructive' : v > 0 ? 'text-success' : '');
  return (
    <Drawer open={open} onClose={onClose} title={title} subtitle={subtitle} width="max-w-lg">
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {facts
            .filter((f) => f.value !== undefined && f.value !== null && f.value !== '')
            .map((f) => (
              <div key={f.label} className="contents">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="min-w-0 break-words">{f.value}</dd>
              </div>
            ))}
        </dl>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-right px-2 py-2 font-medium">Qty</th>
                <th className="text-right px-3 py-2 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.productId} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{l.sku}</div>
                  </td>
                  <td className={cn('px-2 py-2 text-right tabular whitespace-nowrap', tone(l.qty))}>
                    {sign(l.qty)}
                    {formatNumber(Math.abs(l.qty))} <span className="text-xs text-muted-foreground">{l.unit}</span>
                  </td>
                  <td className={cn('px-3 py-2 text-right tabular whitespace-nowrap', tone(l.qty))}>
                    {sign(l.qty)}
                    {formatBDT(Math.abs(l.qty * l.unitCost), { withSymbol: false })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  Total value
                </td>
                <td className={cn('px-3 py-2 text-right tabular whitespace-nowrap', tone(total))}>
                  {sign(total)}
                  {formatBDT(Math.abs(total))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <div className="border-t border-border px-5 py-3 flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </Drawer>
  );
}
