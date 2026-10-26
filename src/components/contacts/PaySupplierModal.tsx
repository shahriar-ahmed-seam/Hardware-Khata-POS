import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Save } from 'lucide-react';
import { cn, formatBDT } from '@/lib/utils';
import { AmountInput, MethodPicker, PaySummary, type PayMethod } from './PaymentInputs';
import { useSuppliers } from '@/stores/contacts';
import { api } from '@/lib/api';
import { toSupplier, type BackendSupplier } from '@/hooks/contactAdapter';
import type { Supplier } from '@/types/domain';
import { toast } from '@/stores/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  supplierId: string | null;
}

export function PaySupplierModal({ open, onClose, supplierId }: Props) {
  const storeSupplier = useSuppliers((s) => s.items.find((x) => x.id === supplierId)) ?? null;
  const paySupplier = useSuppliers((s) => s.paySupplier);

  // The contacts store holds ONE PAGE of suppliers. This modal usually opens
  // from a row on that page, but not always (a deep-linked SupplierDetail), so
  // fall back to a single-record read rather than rendering nothing. Store row
  // wins when present — `suppliers.pay` rehydrates it, so the payable shown here
  // stays live.
  const hasStoreSupplier = !!storeSupplier;
  const [fetched, setFetched] = useState<Supplier | null>(null);

  useEffect(() => {
    if (!open || !supplierId || hasStoreSupplier) {
      setFetched(null);
      return;
    }
    let alive = true;
    void api<BackendSupplier | null>('suppliers.get', { id: supplierId })
      .then((row) => {
        if (alive && row) setFetched(toSupplier(row));
      })
      .catch(() => {
        // Channel error or running outside Electron — leave the modal empty.
      });
    return () => {
      alive = false;
    };
  }, [open, supplierId, hasStoreSupplier]);

  const supplier = storeSupplier ?? fetched;

  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PayMethod>('Cash');
  const [reference, setReference] = useState('');

  useEffect(() => {
    if (open && supplier) {
      setAmount(supplier.due);
      setMethod('Cash');
      setReference('');
    }
  }, [open, supplier]);

  // Above the early return (every hook runs on every render).
  const [saving, setSaving] = useState(false);

  // A loading body instead of nothing, so a click on Pay always shows something.
  if (!supplier) {
    return (
      <Modal open={open} onClose={onClose} width="max-w-md" title="Pay Supplier">
        <div className="p-8 text-center text-sm text-muted-foreground">
          {supplierId ? 'Loading supplier…' : 'No supplier selected.'}
        </div>
      </Modal>
    );
  }

  // Closes only once the backend has taken it. The backend pays the opening
  // balance first, then the oldest bills, and keeps anything more as an advance.
  const submit = async () => {
    if (amount <= 0 || saving) return;
    setSaving(true);
    const res = await paySupplier(supplier.id, amount, method, reference || undefined);
    setSaving(false);
    if (!res) return;
    const parts: string[] = [];
    if (res.toOpening > 0) parts.push(`Opening balance ${formatBDT(res.toOpening)}`);
    if (res.allocated > 0) parts.push(`Bills ${formatBDT(res.allocated)}`);
    if (res.advance > 0) parts.push(`Advance ${formatBDT(res.advance)}`);
    toast.success('Payment recorded', { description: parts.join(' · ') });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-lg"
      title="Pay Supplier"
      subtitle={supplier.name}
      footer={
        <div className="flex items-center justify-between gap-3">
          <PaySummary amount={amount} owed={supplier.due} afterLabel="Payable after" verb="Paying" />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="pay-supplier-form" disabled={amount <= 0 || saving}>
              <Save className="size-4" /> Save Payment
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="pay-supplier-form"
        className="p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Outstanding Payable</span>
          <span className={cn('tabular text-lg font-bold', supplier.due > 0 && 'text-destructive')}>
            {formatBDT(supplier.due)}
          </span>
        </div>
        <AmountInput amount={amount} onAmount={setAmount} full={supplier.due} fullLabel="Full payable" />
        <MethodPicker method={method} onMethod={setMethod} reference={reference} onReference={setReference} />
      </form>
    </Modal>
  );
}
