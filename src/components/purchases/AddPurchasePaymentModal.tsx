import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
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
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 16));

  const submit = () => {
    if (amount <= 0) return;
    addPayment(purchase.id, {
      method,
      amount,
      reference: reference || undefined,
      paidAt,
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
        {/* Top row: balance & paid on date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3 bg-secondary/40">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              Advance Balance
            </div>
            <div className="font-mono tabular text-lg font-bold mt-0.5">৳ 0.00</div>
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">
              Paid on *
            </label>
            <Input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
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
      </div>
    </Modal>
  );
}
