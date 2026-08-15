import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { nowLocalInput, fromLocalInput } from '@/lib/datetime';
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
  const [paidAt, setPaidAt] = useState(nowLocalInput());

  /**
   * RE-SEED EVERY TIME IT OPENS.
   *
   * This modal is mounted permanently by the sale drawer, so `useState(sale.due)`
   * ran ONCE. Take a part payment, close, reopen — and the Amount box still showed
   * the ORIGINAL due, so pressing Save again recorded a second payment for the
   * full original amount instead of the remainder. That is the exact flow an
   * employee uses to settle a due, so it had to be wrong on the second visit.
   *
   * Keyed on the sale id AND the outstanding due, so it also re-seeds when the
   * drawer is pointed at a different invoice.
   */
  useEffect(() => {
    if (!open) return;
    setMethod('Cash');
    setAmount(sale.due);
    setReference('');
    setPaidAt(nowLocalInput());
  }, [open, sale.id, sale.due]);

  // Paying more than is owed is almost always a typo. It is not blocked (a
  // customer really can hand over a round number), but it is called out, because
  // the extra lands on their account rather than this invoice.
  const overpaying = amount > sale.due + 0.005;

  const submit = () => {
    if (amount <= 0) return;
    addPayment(sale.id, {
      method,
      amount,
      reference: reference || undefined,
      // Local wall-clock box → UTC instant. A cash payment posts to the open cash
      // shift, so the timestamp decides which shift it lands in.
      paidAt: fromLocalInput(paidAt),
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

        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
            Paid on
          </label>
          <DateTimeField value={paidAt} onChange={setPaidAt} />
        </div>

        {overpaying && (
          <div className="rounded-md bg-warning/10 text-warning px-3 py-2 text-xs">
            That is more than the {formatBDT(sale.due)} still owed on this invoice. The extra
            will sit on the customer's account as credit.
          </div>
        )}

        {/* What the sale will look like once this is saved. An employee taking a
            part payment needs to see the remainder before committing, not after. */}
        <div className="rounded-lg border border-border p-3 space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Already paid</span>
            <span className="font-mono tabular">{formatBDT(sale.paid)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">This payment</span>
            <span className="font-mono tabular">{formatBDT(amount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1">
            <span className="font-semibold">Still owing after this</span>
            <span
              className={cn(
                'font-mono tabular font-bold',
                Math.max(0, sale.due - amount) <= 0.005 ? 'text-success' : 'text-destructive',
              )}
            >
              {formatBDT(Math.max(0, sale.due - amount))}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
