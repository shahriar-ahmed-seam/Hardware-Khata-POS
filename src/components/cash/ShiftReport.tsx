import { useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Printer } from 'lucide-react';
import {
  MOVEMENT_DIRECTION,
  MOVEMENT_LABEL,
  type Shift,
  useCashRegister,
  shiftDuration,
} from '@/stores/cashRegister';
import { formatBDT, cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  shift: Shift;
  /** 'X' = interim (kept open), 'Z' = closing (locked). Same content, different label. */
  variant?: 'X' | 'Z';
}

export function ShiftReport({ open, onClose, shift, variant = 'X' }: Props) {
  const movements = useCashRegister((s) => s.movements.filter((m) => m.shiftId === shift.id));

  // Mirror Purchases.tsx: load this (often closed) shift's movements on demand
  // so the X/Z report shows real cash-in/out. No-op without a backend.
  useEffect(() => {
    if (open) void useCashRegister.getState().ensureShiftMovements(shift.id);
  }, [open, shift.id]);

  const cashIn = movements
    .filter((m) => MOVEMENT_DIRECTION[m.type] === 'in')
    .reduce((s, m) => s + m.amount, 0);
  const cashOut = movements
    .filter((m) => MOVEMENT_DIRECTION[m.type] === 'out')
    .reduce((s, m) => s + m.amount, 0);
  const expected = shift.openingCash + cashIn - cashOut;

  const byType: Record<string, number> = {};
  movements.forEach((m) => {
    byType[m.type] = (byType[m.type] ?? 0) + m.amount;
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={`${variant}-Report — Shift #${shift.shiftNo}`}
      subtitle={shift.status === 'open' ? 'Interim snapshot · shift remains open' : 'Final report · locked'}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Print
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        {/* Header strip */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Row label="Branch" value={shift.branch} />
          <Row label="Status" value={shift.status === 'open' ? 'Open' : 'Closed'} />
          <Row label="Opened" value={`${new Date(shift.openedAt).toLocaleString('en-GB')} · ${shift.openedBy}`} />
          {shift.closedAt && (
            <Row
              label="Closed"
              value={`${new Date(shift.closedAt).toLocaleString('en-GB')} · ${shift.closedBy}`}
            />
          )}
          <Row label="Duration" value={shiftDuration(shift)} />
        </div>

        {/* Money summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Opening" value={formatBDT(shift.openingCash)} />
          <Stat label="Cash In" value={formatBDT(cashIn)} tone="success" />
          <Stat label="Cash Out" value={formatBDT(cashOut)} tone="warning" />
          <Stat
            label={shift.status === 'closed' ? 'Counted' : 'Expected'}
            value={formatBDT(shift.countedTotal ?? expected)}
            tone="primary"
            big
          />
        </div>

        {shift.status === 'closed' && shift.variance !== undefined && (
          <div className="rounded-lg border border-border p-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Variance</span>
            <span
              className={cn(
                'font-mono tabular text-lg font-bold',
                shift.variance === 0
                  ? 'text-success'
                  : Math.abs(shift.variance) >= 100
                    ? 'text-destructive'
                    : 'text-warning',
              )}
            >
              {shift.variance >= 0 ? '+' : ''}
              {formatBDT(shift.variance)}
            </span>
          </div>
        )}

        {/* Breakdown */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-secondary/40 text-[11px] uppercase font-semibold text-muted-foreground">
            Movement breakdown
          </div>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(byType).map(([type, amt]) => (
                <tr key={type} className="border-t border-border first:border-t-0">
                  <td className="px-3 py-1.5">{MOVEMENT_LABEL[type as keyof typeof MOVEMENT_LABEL]}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular">
                    {MOVEMENT_DIRECTION[type as keyof typeof MOVEMENT_DIRECTION] === 'in'
                      ? '+'
                      : '−'}
                    {formatBDT(amt, { withSymbol: false })}
                  </td>
                </tr>
              ))}
              {Object.keys(byType).length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No movements yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {shift.status === 'closed' && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {shift.carriedFloat !== undefined && (
              <Row label="Carried as next float" value={formatBDT(shift.carriedFloat)} />
            )}
            {shift.carriedFloat !== undefined && shift.countedTotal !== undefined && (
              <Row
                label="To bank deposit"
                value={formatBDT(Math.max(0, shift.countedTotal - shift.carriedFloat))}
              />
            )}
            {shift.closingNote && (
              <div className="col-span-2 border-t border-border pt-3">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">Note</div>
                <div className="whitespace-pre-wrap text-sm">{shift.closingNote}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular">{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'success' | 'warning';
  big?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div
        className={cn(
          'font-mono tabular font-bold mt-0.5',
          big ? 'text-xl' : 'text-base',
          tone === 'primary' && 'text-primary',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </div>
    </div>
  );
}
