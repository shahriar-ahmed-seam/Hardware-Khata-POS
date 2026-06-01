import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { useSales, type SaleRecord, type SalePayment } from '@/stores/sales';
import { formatBDT, cn } from '@/lib/utils';

const METHODS: SalePayment['method'][] = ['Cash', 'bKash', 'Nagad', 'Card', 'Bank'];

export function AddPaymentModal({
  open,
  onClose,
  sale,
}: {
  open: boolean;
  onClose: () => void;
  sale: SaleRecord;
}) {
  const addPayment = useSales((s) => s.addPayment);
  const [method, setMethod] = useState<SalePayment['method']>('Cash');
  const [amount, setAmount] = useState<number>(sale.due);
  const [reference, setReference] = useState('');

  const submit = () => {
    if (amount <= 0) return;
    addPayment(sale.id, {
      method,
      amount,
      reference: reference || undefined,
      paidAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-lg"
      title={`Add Payment · ${sale.invoiceNo}`}
      subtitle={`Outstanding due: ৳ ${formatBDT(sale.due, { withSymbol: false })}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={amount <= 0}>
            Save Payment
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Method</label>
          <div className="grid grid-cols-5 gap-1.5 mt-1">
            {METHODS.map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={cn(
                  'h-9 rounded-md border text-xs font-medium transition',
                  method === m ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary',
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Amount</label>
            <NumberField
              autoFocus
              value={amount}
              onChangeNumber={setAmount}
              className="text-right"
            />
            <div className="flex items-center gap-1 mt-1">
              <button
                onClick={() => setAmount(sale.due)}
                className="text-[10px] px-2 h-6 rounded border border-border hover:bg-secondary"
              >
                Full due
              </button>
              <button
                onClick={() => setAmount(Math.round(sale.due / 2))}
                className="text-[10px] px-2 h-6 rounded border border-border hover:bg-secondary"
              >
                Half
              </button>
            </div>
          </div>
          {method !== 'Cash' && (
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
