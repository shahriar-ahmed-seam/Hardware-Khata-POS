import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/NumberField';
import { Input } from '@/components/ui/Input';
import { Banknote } from 'lucide-react';
import { useCashRegister } from '@/stores/cashRegister';

interface Props {
  open: boolean;
  onClose: () => void;
  branch?: string;
  cashier?: string;
}

export function OpenShiftModal({ open, onClose, branch = 'Mirpur Branch', cashier = 'Seam' }: Props) {
  const openShift = useCashRegister((s) => s.openShift);
  const [opening, setOpening] = useState(5000);
  const [note, setNote] = useState('');

  const submit = () => {
    openShift({ openingCash: opening, note: note || undefined, cashier, branch });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-md"
      title="Open Shift"
      subtitle={`${branch} · by ${cashier}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={opening < 0}>
            <Banknote className="size-4" /> Open Shift
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
            Opening cash (৳) *
          </label>
          <NumberField
            autoFocus
            value={opening}
            onChangeNumber={setOpening}
            className="text-right text-lg"
          />
          <div className="text-[11px] text-muted-foreground mt-1">
            Count what you place in the drawer to start the shift.
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Note</label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional · context for this shift"
          />
        </div>
      </div>
    </Modal>
  );
}
