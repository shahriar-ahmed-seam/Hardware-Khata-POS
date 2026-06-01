import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/NumberField';
import { Input } from '@/components/ui/Input';
import { ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import {
  DENOMINATIONS,
  denominationsTotal,
  useCashRegister,
  type DenominationCount,
  type Shift,
  MOVEMENT_DIRECTION,
} from '@/stores/cashRegister';
import { cn, formatBDT } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  shift: Shift;
  cashier?: string;
}

const STEPS = ['Count', 'Variance', 'Notes', 'Confirm'] as const;
type Step = (typeof STEPS)[number];

export function CloseShiftModal({ open, onClose, shift, cashier = 'Seam' }: Props) {
  const movements = useCashRegister((s) => s.movements.filter((m) => m.shiftId === shift.id));
  const closeShift = useCashRegister((s) => s.closeShift);
  const warnTh = useCashRegister((s) => s.varianceWarnThreshold);
  const blockTh = useCashRegister((s) => s.varianceBlockThreshold);

  const cashIn = movements
    .filter((m) => MOVEMENT_DIRECTION[m.type] === 'in')
    .reduce((s, m) => s + m.amount, 0);
  const cashOut = movements
    .filter((m) => MOVEMENT_DIRECTION[m.type] === 'out')
    .reduce((s, m) => s + m.amount, 0);
  const expected = shift.openingCash + cashIn - cashOut;

  const [step, setStep] = useState<Step>('Count');
  const [d, setD] = useState<DenominationCount>({});
  const [carriedFloat, setCarriedFloat] = useState(5000);
  const [note, setNote] = useState('');

  const counted = useMemo(() => denominationsTotal(d), [d]);
  const variance = counted - expected;
  const overWarn = Math.abs(variance) >= warnTh;
  const overBlock = Math.abs(variance) >= blockTh;

  // Mirror Purchases.tsx: load this (possibly closed/historical) shift's
  // movements on demand so the variance math has the real cash-in/out. No-op
  // without a backend.
  useEffect(() => {
    if (open) void useCashRegister.getState().ensureShiftMovements(shift.id);
  }, [open, shift.id]);

  useEffect(() => {
    if (open) {
      setStep('Count');
      setD({});
      setCarriedFloat(Math.min(5000, Math.max(0, expected)));
      setNote('');
    }
  }, [open, expected]);

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };
  const prev = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const canConfirm =
    !overBlock || // Block-threshold breached requires manager override (not implemented yet)
    confirm; // simplified for mock

  const submit = () => {
    if (overBlock) {
      if (!window.confirm(
        `Variance of ${formatBDT(variance)} exceeds the hard block threshold of ${formatBDT(blockTh)}. Manager override required. Continue?`,
      ))
        return;
    } else if (overWarn) {
      if (!window.confirm(
        `Variance of ${formatBDT(variance)} exceeds the warn threshold of ${formatBDT(warnTh)}. Continue?`,
      ))
        return;
    }
    closeShift(shift.id, {
      countedDenominations: d,
      carriedFloat,
      note: note || undefined,
      closedBy: cashier,
    });
    onClose();
  };

  const StepBadge = ({ label, idx }: { label: string; idx: number }) => {
    const cur = STEPS.indexOf(step);
    const done = cur > idx;
    const active = cur === idx;
    return (
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            'size-5 rounded-full grid place-items-center text-[10px] font-bold',
            done
              ? 'bg-success text-success-foreground'
              : active
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground',
          )}
        >
          {done ? '✓' : idx + 1}
        </div>
        <span
          className={cn(
            'text-[11px] font-medium',
            active ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title={`Close Shift #${shift.shiftNo}`}
      subtitle={`${shift.branch} · opened by ${shift.openedBy}`}
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {STEPS.map((s, i) => (
              <StepBadge key={s} label={s} idx={i} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step !== 'Count' && (
              <Button variant="outline" onClick={prev}>
                <ArrowLeft className="size-4" /> Back
              </Button>
            )}
            {step !== 'Confirm' ? (
              <Button onClick={next}>
                Next <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={!canConfirm}>
                <Lock className="size-4" /> Close & Lock
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="p-4">
        {step === 'Count' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold mb-1">Count physical cash</div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase text-muted-foreground bg-secondary/40">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium">Note</th>
                      <th className="text-right px-2 py-1.5 font-medium">Count</th>
                      <th className="text-right px-3 py-1.5 font-medium">Sub</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DENOMINATIONS.map((v) => {
                      const key = ('d' + v) as keyof DenominationCount;
                      const cur = (d[key] ?? 0) as number;
                      return (
                        <tr key={v} className="border-t border-border">
                          <td className="px-3 py-1.5 font-mono">৳ {v}</td>
                          <td className="px-2 py-1.5 text-right">
                            <NumberField
                              value={cur}
                              onChangeNumber={(n) => setD((p) => ({ ...p, [key]: n }))}
                              placeholder="0"
                              className="h-7 w-20 px-2 text-right text-xs ml-auto"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono tabular text-muted-foreground">
                            {cur > 0 ? formatBDT(cur * v, { withSymbol: false }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="space-y-3">
              <SummaryStat label="Opening" value={formatBDT(shift.openingCash)} />
              <SummaryStat label="Cash In" value={formatBDT(cashIn)} tone="success" />
              <SummaryStat label="Cash Out" value={formatBDT(cashOut)} tone="warning" />
              <SummaryStat label="Expected in drawer" value={formatBDT(expected)} tone="primary" />
              <div className="border-t border-border pt-3">
                <SummaryStat
                  label="Counted"
                  value={formatBDT(counted)}
                  tone={counted >= expected ? 'success' : 'destructive'}
                  big
                />
                <SummaryStat
                  label="Variance"
                  value={`${variance >= 0 ? '+' : ''}${formatBDT(variance)}`}
                  tone={variance === 0 ? 'success' : Math.abs(variance) >= warnTh ? 'destructive' : 'warning'}
                  big
                />
              </div>
            </div>
          </div>
        )}

        {step === 'Variance' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">
                Variance check
              </div>
              <div className="flex items-baseline gap-3">
                <div
                  className={cn(
                    'text-4xl font-bold font-mono tabular',
                    variance === 0
                      ? 'text-success'
                      : overBlock
                        ? 'text-destructive'
                        : overWarn
                          ? 'text-warning'
                          : 'text-foreground',
                  )}
                >
                  {variance >= 0 ? '+' : ''}
                  {formatBDT(variance)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {expected > 0
                    ? `${((variance / expected) * 100).toFixed(2)}% of expected`
                    : ''}
                </div>
              </div>
              {overBlock && (
                <div className="mt-3 rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm flex items-start gap-2">
                  <AlertTriangle className="size-4 mt-0.5" />
                  <div>
                    Variance exceeds hard block threshold of {formatBDT(blockTh)}. Manager override
                    required.
                  </div>
                </div>
              )}
              {!overBlock && overWarn && (
                <div className="mt-3 rounded-md bg-warning/10 text-warning px-3 py-2 text-sm flex items-start gap-2">
                  <AlertTriangle className="size-4 mt-0.5" />
                  <div>Variance over the soft warn threshold of {formatBDT(warnTh)}. Add a note to explain.</div>
                </div>
              )}
              {!overWarn && variance !== 0 && (
                <div className="mt-3 rounded-md bg-secondary/60 text-foreground px-3 py-2 text-sm">
                  Within tolerance. Note is optional.
                </div>
              )}
              {variance === 0 && (
                <div className="mt-3 rounded-md bg-success/10 text-success px-3 py-2 text-sm flex items-start gap-2">
                  <CheckCircle2 className="size-4 mt-0.5" /> Perfectly balanced.
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <SummaryStat label="Opening" value={formatBDT(shift.openingCash)} />
              <SummaryStat label="Expected" value={formatBDT(expected)} />
              <SummaryStat label="Counted" value={formatBDT(counted)} />
            </div>
          </div>
        )}

        {step === 'Notes' && (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                Closing note {variance !== 0 && <span className="text-destructive">*</span>}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder={
                  variance !== 0
                    ? 'Required: explain the variance (e.g. found ৳500 short, will recheck pickup)'
                    : 'Optional: any handover notes for next shift'
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                Carry over as next shift's opening (৳)
              </label>
              <NumberField
                value={carriedFloat}
                onChangeNumber={setCarriedFloat}
                className="text-right"
              />
              <div className="text-[11px] text-muted-foreground mt-1">
                Remainder ({formatBDT(Math.max(0, counted - carriedFloat))}) will be marked for bank
                deposit.
              </div>
            </div>
          </div>
        )}

        {step === 'Confirm' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
              <Row label="Shift" value={`#${shift.shiftNo} · ${shift.branch}`} />
              <Row
                label="Opened"
                value={`${new Date(shift.openedAt).toLocaleString('en-GB')} by ${shift.openedBy}`}
              />
              <Row label="Closing now" value={`${new Date().toLocaleString('en-GB')} by ${cashier}`} />
              <div className="border-t border-border pt-2" />
              <Row label="Opening cash" value={formatBDT(shift.openingCash)} />
              <Row label="Cash In" value={formatBDT(cashIn)} tone="success" />
              <Row label="Cash Out" value={`− ${formatBDT(cashOut)}`} tone="warning" />
              <Row label="Expected" value={formatBDT(expected)} />
              <Row label="Counted" value={formatBDT(counted)} bold />
              <Row
                label="Variance"
                value={`${variance >= 0 ? '+' : ''}${formatBDT(variance)}`}
                tone={variance === 0 ? 'success' : Math.abs(variance) >= warnTh ? 'destructive' : 'warning'}
                bold
              />
              <div className="border-t border-border pt-2" />
              <Row label="Carried as next float" value={formatBDT(carriedFloat)} />
              <Row label="To bank deposit" value={formatBDT(Math.max(0, counted - carriedFloat))} />
              {note && (
                <div className="border-t border-border pt-2">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground">Note</div>
                  <div className="whitespace-pre-wrap">{note}</div>
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Closing the shift is final. A Z-Report will be generated and the drawer will be
              ready for a new shift.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function SummaryStat({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'success' | 'warning' | 'destructive';
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
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'destructive';
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-mono tabular',
          bold && 'font-semibold',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </span>
    </div>
  );
}
