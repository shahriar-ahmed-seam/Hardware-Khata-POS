import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { nowLocalInput, fromLocalInput } from '@/lib/datetime';
import { useSales, type SaleRecord, type SalePayment } from '@/stores/sales';
import { formatBDT, cn } from '@/lib/utils';
import { toast } from '@/stores/toast';
import { FormField } from '@/components/ui/FormField';
import { Segmented } from '@/components/ui/Segmented';
import { labelFor } from '@/lib/labels';

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
  const [dateOpen, setDateOpen] = useState(false);

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
    setDateOpen(false);
  }, [open, sale.id, sale.due]);

  // Paying more than is owed is almost always a typo. It is not blocked (a
  // customer really can hand over a round number), but it is called out, because
  // the extra lands on their account rather than this invoice.
  const overpaying = amount > sale.due + 0.005;

  const [saving, setSaving] = useState(false);
  // Closes only once the backend has taken the payment. A refusal (a walk-in
  // paying more than is owed, say) keeps the modal open with the amount typed.
  const submit = async () => {
    if (amount <= 0 || saving) return;
    setSaving(true);
    const ok = await addPayment(sale.id, {
      method,
      amount,
      reference: reference || undefined,
      // Local wall-clock box → UTC instant. A cash payment posts to the open cash
      // shift, so the timestamp decides which shift it lands in.
      paidAt: fromLocalInput(paidAt),
    });
    setSaving(false);
    if (!ok) return;
    toast.success('Payment recorded');
    onClose();
  };

  const formId = `pay-${sale.id}`;
  const after = Math.max(0, sale.due - amount);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-lg"
      title="Receive payment"
      subtitle={`${sale.customerName} · ${sale.invoiceNo}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {/* Submits the form below, so Enter in the amount saves too. */}
          <Button type="submit" form={formId} size="lg" disabled={amount <= 0 || saving}>
            Save Payment
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        className="p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {/* Amount first and biggest: it is the one thing that must be right. */}
        <FormField
          label="Amount received"
          action={
            <span className="text-sm text-muted-foreground">
              <span>Due</span>{' '}
              <span className="tabular font-semibold text-foreground">{formatBDT(sale.due)}</span>
            </span>
          }
        >
          {(f) => (
            <NumberField
              {...f}
              autoFocus
              value={amount}
              onChangeNumber={setAmount}
              className="h-12 text-2xl text-right font-semibold"
            />
          )}
        </FormField>
        <div className="flex items-center gap-2 -mt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setAmount(sale.due)}>
            <span>Full due</span> <span className="tabular">{formatBDT(sale.due)}</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAmount(Math.round(sale.due / 2))}>
            Half
          </Button>
        </div>

        <FormField label="Method">
          <Segmented
            ariaLabel="Method"
            fullWidth
            value={method}
            onChange={setMethod}
            options={METHODS.map((m) => ({ value: m, label: labelFor('paymentMethod', m) }))}
          />
        </FormField>

        {method !== 'Cash' && (
          <FormField label="Reference / TxID">
            {(f) => (
              <Input {...f} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TX1234567" />
            )}
          </FormField>
        )}

        {/* Nearly always "now"; opens only to record a late entry. */}
        {dateOpen ? (
          <FormField label="Paid on">
            {(f) => <DateTimeField {...f} value={paidAt} onChange={setPaidAt} />}
          </FormField>
        ) : (
          <button
            type="button"
            onClick={() => setDateOpen(true)}
            className="text-sm text-primary hover:underline"
          >
            Change date
          </button>
        )}

        {overpaying && (
          <div className="rounded-md bg-warning/10 text-warning px-3 py-2 text-sm">
            That is more than is still owed on this invoice. The extra will sit on the customer's
            account as credit.
          </div>
        )}

        {/* The remainder, seen before committing. */}
        <div className="rounded-lg border border-border p-3 space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Already paid</span>
            <span className="tabular">{formatBDT(sale.paid)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">This payment</span>
            <span className="tabular">{formatBDT(amount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1">
            <span className="font-semibold">Still owing after this</span>
            <span className={cn('tabular font-bold', after <= 0.005 ? 'text-success' : 'text-destructive')}>
              {formatBDT(after)}
            </span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
