import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Banknote, Smartphone, CreditCard, Building2, Save } from 'lucide-react';
import { cn, formatBDT } from '@/lib/utils';
import { useSuppliers } from '@/stores/contacts';

const METHODS: { id: 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank'; icon: any; label: string; needsRef?: boolean }[] = [
  { id: 'Cash', icon: Banknote, label: 'Cash' },
  { id: 'bKash', icon: Smartphone, label: 'bKash', needsRef: true },
  { id: 'Nagad', icon: Smartphone, label: 'Nagad', needsRef: true },
  { id: 'Card', icon: CreditCard, label: 'Card', needsRef: true },
  { id: 'Bank', icon: Building2, label: 'Bank', needsRef: true },
];

interface Props {
  open: boolean;
  onClose: () => void;
  supplierId: string | null;
}

export function PaySupplierModal({ open, onClose, supplierId }: Props) {
  const supplier = useSuppliers((s) => s.items.find((x) => x.id === supplierId));
  const paySupplier = useSuppliers((s) => s.paySupplier);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('Cash');
  const [reference, setReference] = useState('');

  useEffect(() => {
    if (open && supplier) {
      setAmount(supplier.due);
      setMethod('Cash');
      setReference('');
    }
  }, [open, supplier]);

  if (!supplier) return null;

  const submit = () => {
    if (amount <= 0) return;
    paySupplier(supplier.id, amount, method, reference || undefined);
    onClose();
  };

  const needsRef = METHODS.find((m) => m.id === method)?.needsRef;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={`Pay Supplier — ${supplier.name}`}
      subtitle={`Outstanding payable: ৳ ${formatBDT(supplier.due, { withSymbol: false })}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={amount <= 0}>
            <Save className="size-4" /> Save Payment
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-5 gap-1.5">
          {METHODS.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  'h-12 rounded-md border text-xs font-medium transition inline-flex flex-col items-center justify-center gap-1',
                  method === m.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-secondary',
                )}
              >
                <Icon className="size-4" />
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Amount</label>
            <NumberField value={amount} onChangeNumber={setAmount} className="text-right" />
            <div className="flex items-center gap-1 mt-1">
              <button
                onClick={() => setAmount(supplier.due)}
                className="text-[10px] px-2 h-6 rounded border border-border hover:bg-secondary"
              >
                Full payable
              </button>
              <button
                onClick={() => setAmount(Math.round(supplier.due / 2))}
                className="text-[10px] px-2 h-6 rounded border border-border hover:bg-secondary"
              >
                Half
              </button>
            </div>
          </div>
          {needsRef && (
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                Reference / TxID
              </label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TX1234567" />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
