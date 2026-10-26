import { useEffect, useState } from 'react';
import { toast } from '@/stores/toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { FormField } from '@/components/ui/FormField';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { nowLocalInput, fromLocalInput } from '@/lib/datetime';
import { Banknote, Smartphone, CreditCard, Building2, FileText, Save } from 'lucide-react';
import { usePurchases, type PurchaseRecord, type PaymentMethod } from '@/stores/purchases';
import { cn, formatBDT } from '@/lib/utils';

const METHODS: { id: PaymentMethod; icon: any; label: string; needsRef?: boolean }[] = [
  { id: 'Cash', icon: Banknote, label: 'Cash' },
  { id: 'bKash', icon: Smartphone, label: 'bKash', needsRef: true },
  { id: 'Nagad', icon: Smartphone, label: 'Nagad', needsRef: true },
  { id: 'Card', icon: CreditCard, label: 'Card', needsRef: true },
  { id: 'Bank', icon: Building2, label: 'Bank', needsRef: true },
  { id: 'Cheque', icon: FileText, label: 'Cheque', needsRef: true },
];

interface Props {
  open: boolean;
  onClose: () => void;
  purchase: PurchaseRecord;
  /** "Pay later" when opened right after saving a bill. */
  cancelLabel?: string;
}

export function AddPurchasePaymentModal({ open, onClose, purchase, cancelLabel }: Props) {
  const addPayment = usePurchases((s) => s.addPayment);
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [amount, setAmount] = useState(purchase.due);
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(nowLocalInput());

  /**
   * RE-SEED EVERY TIME IT OPENS. The purchase drawer mounts this permanently, so
   * `useState(purchase.due)` ran once: after a part payment, reopening still
   * offered the ORIGINAL amount instead of the remainder. Same bug as the sale
   * payment modal, and it broke the same flow — settling a bill in instalments.
   */
  useEffect(() => {
    if (!open) return;
    setMethod('Cash');
    setAmount(purchase.due);
    setReference('');
    setPaidAt(nowLocalInput());
  }, [open, purchase.id, purchase.due]);

  const overpaying = amount > purchase.due + 0.005;

  const [saving, setSaving] = useState(false);
  // Closes only once the backend has taken the payment; a refusal keeps it open.
  const submit = async () => {
    if (amount <= 0 || saving) return;
    setSaving(true);
    const ok = await addPayment(purchase.id, {
      method,
      amount,
      reference: reference || undefined,
      // Local wall-clock box → UTC instant. A cash payment posts out of the open
      // cash shift, so the timestamp decides which shift it comes from.
      paidAt: fromLocalInput(paidAt),
    });
    setSaving(false);
    if (!ok) return;
    toast.success('Payment recorded');
    onClose();
  };

  const m = METHODS.find((x) => x.id === method)!;
  const [whenOpen, setWhenOpen] = useState(false);
  useEffect(() => {
    if (open) setWhenOpen(false);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-xl"
      title="Pay the supplier"
      subtitle={`${purchase.supplierName} · ${purchase.refNo}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {cancelLabel ?? 'Cancel'}
          </Button>
          <Button onClick={() => void submit()} disabled={amount <= 0 || saving}>
            <Save className="size-4" /> Save Payment
          </Button>
        </div>
      }
    >
      <form
        className="p-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormField label="Amount" required>
          {(f) => (
            <div className="space-y-2">
              <NumberField
                {...f}
                autoFocus
                value={amount}
                onChangeNumber={setAmount}
                className="h-11 text-right text-lg font-semibold"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAmount(purchase.due)}
                  className="h-8 px-3 text-xs rounded-md border border-border hover:bg-secondary"
                >
                  Full due
                </button>
                <button
                  type="button"
                  onClick={() => setAmount(Math.round(purchase.due / 2))}
                  className="h-8 px-3 text-xs rounded-md border border-border hover:bg-secondary"
                >
                  Half
                </button>
              </div>
            </div>
          )}
        </FormField>

        <div className="space-y-2">
          <div className="text-sm font-medium">Paid by</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {METHODS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={method === opt.id}
                  onClick={() => setMethod(opt.id)}
                  className={cn(
                    'h-12 rounded-md border text-sm font-medium transition inline-flex flex-col items-center justify-center gap-0.5',
                    method === opt.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  <Icon className="size-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {m.needsRef && (
          <FormField label="Reference / TxID">
            {(f) => (
              <Input {...f} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TX1234567" />
            )}
          </FormField>
        )}

        {overpaying && (
          <div className="rounded-md bg-warning/10 text-warning px-3 py-2 text-sm">
            <div>That is more than is still owed on this bill. The extra lowers your overall balance with this supplier.</div>
          </div>
        )}

        {/* One summary: what the bill looks like once this is saved. */}
        <div className="rounded-lg border border-border p-3 space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Bill total</span>
            <span className="tabular">{formatBDT(purchase.total)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Already paid</span>
            <span className="tabular">{formatBDT(purchase.paid)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">This payment</span>
            <span className="tabular">{formatBDT(amount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1">
            <span className="font-semibold">Still owing after this</span>
            <span
              className={cn(
                'tabular font-bold',
                Math.max(0, purchase.due - amount) <= 0.005 ? 'text-success' : 'text-destructive',
              )}
            >
              {formatBDT(Math.max(0, purchase.due - amount))}
            </span>
          </div>
        </div>

        {/* Rarely changed, so it comes last and folded. */}
        {whenOpen ? (
          <FormField label="Paid on" required>
            <DateTimeField value={paidAt} onChange={setPaidAt} />
          </FormField>
        ) : (
          <div className="text-sm text-muted-foreground">
            <span>Paid on: now</span> ·{' '}
            <button
              type="button"
              onClick={() => setWhenOpen(true)}
              className="text-primary hover:underline focus-ring rounded"
            >
              change
            </button>
          </div>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
