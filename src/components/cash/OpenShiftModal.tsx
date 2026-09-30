import { useEffect, useState } from 'react';
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

/**
 * Start the drawer with a count — OPTIONAL.
 *
 * The drawer opens by itself with the first cash event, starting from what the
 * last shift left in it, so nobody has to remember this. It is here for the
 * owner who wants to count the drawer first thing. The amount is pre-filled
 * with that same carried-forward figure (it used to be a made-up ৳5,000).
 */
export function OpenShiftModal({ open, onClose, branch = '', cashier = '' }: Props) {
  const openShift = useCashRegister((s) => s.openShift);
  const carriedForward = useCashRegister((s) => s.carriedForward);
  const [opening, setOpening] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNote('');
    let live = true;
    void carriedForward(branch).then((amount) => {
      if (live && amount !== null) setOpening(amount);
    });
    return () => {
      live = false;
    };
  }, [open, branch, carriedForward]);

  const submit = async () => {
    if (saving || opening < 0) return;
    setSaving(true);
    const ok = await openShift({ openingCash: opening, note: note || undefined, cashier, branch });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-md"
      title="Count the drawer"
      subtitle={branch}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={opening < 0 || saving}>
            <Banknote className="size-4" /> Start the drawer
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Cash in the drawer now (৳) *
          </label>
          <NumberField
            autoFocus
            value={opening}
            onChangeNumber={setOpening}
            className="text-right text-lg"
          />
          <div className="text-xs text-muted-foreground mt-1">
            Filled in with what the last shift left. Change it if your count is different.
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Note</label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
    </Modal>
  );
}
