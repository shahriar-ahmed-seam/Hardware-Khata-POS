import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
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
}

export function AddPurchasePaymentModal({ open, onClose, purchase }: Props) {
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

  const submit = () => {
    if (amount <= 0) return;
    addPayment(purchase.id, {
      method,
      amount,
      reference: reference || undefined,
      // Local wall-clock box → UTC instant. A cash payment posts out of the open
      // cash shift, so the timestamp decides which shift it comes from.
      paidAt: fromLocalInput(paidAt),
    });
    onClose();
  };

  const m = METHODS.find((x) => x.id === method)!;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title="Supply Payment"
      subtitle={`${purchase.refNo} · ${purchase.supplierName}`}
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
        {/*
          An "Advance Balance ৳ 0.00" tile used to sit here. It was a hard-coded
          zero — there is no advance-balance concept in the backend at all, so it
          was a number the shop could have believed. Removed rather than faked.
        */}
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
            Paid on *
          </label>
          <DateTimeField value={paidAt} onChange={setPaidAt} />
        </div>

        {/* Outstanding indicator */}
        <div className="rounded-lg border border-border p-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Outstanding due</span>
          <span className="font-mono tabular text-base font-semibold text-destructive">
            {formatBDT(purchase.due)}
          </span>
        </div>

        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Amount *</label>
          <NumberField
            autoFocus
            value={amount}
            onChangeNumber={setAmount}
            className="text-right text-lg"
          />
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={() => setAmount(purchase.due)}
              className="text-[10px] px-2 h-6 rounded border border-border hover:bg-secondary"
            >
              Full due
            </button>
            <button
              onClick={() => setAmount(Math.round(purchase.due / 2))}
              className="text-[10px] px-2 h-6 rounded border border-border hover:bg-secondary"
            >
              Half
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
            Payment Method *
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-1">
            {METHODS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => setMethod(opt.id)}
                  className={cn(
                    'h-12 rounded-md border text-xs font-medium transition inline-flex flex-col items-center justify-center gap-1',
                    method === opt.id
                      ? 'border-primary bg-primary/10 text-primary'
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
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">
              {m.label} reference / TxID
            </label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TX1234567" />
          </div>
        )}

        {overpaying && (
          <div className="rounded-md bg-warning/10 text-warning px-3 py-2 text-xs">
            That is more than the {formatBDT(purchase.due)} still owed on this bill. The extra
            will reduce your overall balance with this supplier.
          </div>
        )}

        {/* What the bill looks like once this is saved — visible before
            committing, not after. */}
        <div className="rounded-lg border border-border p-3 space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Already paid</span>
            <span className="font-mono tabular">{formatBDT(purchase.paid)}</span>
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
                Math.max(0, purchase.due - amount) <= 0.005 ? 'text-success' : 'text-destructive',
              )}
            >
              {formatBDT(Math.max(0, purchase.due - amount))}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
