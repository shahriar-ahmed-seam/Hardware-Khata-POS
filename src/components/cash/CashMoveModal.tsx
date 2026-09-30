import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/NumberField';
import { Input } from '@/components/ui/Input';
import { ArrowDown, ArrowUp, Save } from 'lucide-react';
import { useCashRegister, MANUAL_REASONS, type ManualReason } from '@/stores/cashRegister';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The open drawer, if any. With none, the backend opens one. */
  shiftId?: string;
  cashier?: string;
  defaultDirection?: 'in' | 'out';
}

export function CashMoveModal({
  open,
  onClose,
  shiftId,
  cashier = '',
  defaultDirection = 'in',
}: Props) {
  const recordMovement = useCashRegister((s) => s.recordMovement);
  const [direction, setDirection] = useState<'in' | 'out'>(defaultDirection);
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState<ManualReason>('Petty cash');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setDirection(defaultDirection);
      setAmount(0);
      setReason('Petty cash');
      setNote('');
    }
  }, [open, defaultDirection]);

  const [saving, setSaving] = useState(false);

  // Stays open (with what was typed) when the backend refuses, instead of
  // closing as if the movement had been recorded. The reason now travels with
  // the note; it used to be dropped before it reached the database.
  const submit = async () => {
    if (amount <= 0 || saving) return;
    setSaving(true);
    const ok = await recordMovement({
      shiftId,
      type: direction === 'in' ? 'manual_in' : 'manual_out',
      amount,
      reason,
      note: note || undefined,
      cashier,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-lg"
      title={direction === 'in' ? 'Cash In' : 'Cash Out'}
      subtitle="One-off drawer adjustment"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={amount <= 0 || saving}>
            <Save className="size-4" /> Save
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-1 p-0.5 bg-secondary rounded-md text-xs">
          <button
            onClick={() => setDirection('in')}
            className={cn(
              'flex-1 h-9 rounded font-medium transition inline-flex items-center justify-center gap-1.5',
              direction === 'in'
                ? 'bg-card shadow-sm text-success'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ArrowDown className="size-4" /> Cash In
          </button>
          <button
            onClick={() => setDirection('out')}
            className={cn(
              'flex-1 h-9 rounded font-medium transition inline-flex items-center justify-center gap-1.5',
              direction === 'out'
                ? 'bg-card shadow-sm text-warning'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ArrowUp className="size-4" /> Cash Out
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Amount *</label>
            <NumberField
              autoFocus
              value={amount}
              onChangeNumber={setAmount}
              className="text-right text-lg"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ManualReason)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              {MANUAL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Note</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional context" />
        </div>
      </div>
    </Modal>
  );
}
