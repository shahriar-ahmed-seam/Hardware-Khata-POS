import { useEffect, useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Banknote, Smartphone, CreditCard, Building2, FileText, Save, Plus, Paperclip, Repeat, Trash2 } from 'lucide-react';
import {
  useExpenses,
  type ExpensePaymentMethod,
  type ExpenseRecord,
  type RecurringFrequency,
} from '@/stores/expenses';
import { cn } from '@/lib/utils';
import { NewExpenseCategoryModal } from './NewExpenseCategoryModal';

const METHODS: { id: ExpensePaymentMethod; icon: any; label: string; needsRef?: boolean }[] = [
  { id: 'Cash', icon: Banknote, label: 'Cash' },
  { id: 'bKash', icon: Smartphone, label: 'bKash', needsRef: true },
  { id: 'Nagad', icon: Smartphone, label: 'Nagad', needsRef: true },
  { id: 'Card', icon: CreditCard, label: 'Card', needsRef: true },
  { id: 'Bank', icon: Building2, label: 'Bank', needsRef: true },
  { id: 'Cheque', icon: FileText, label: 'Cheque', needsRef: true },
];

const FREQS: { id: RecurringFrequency; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

const BRANCHES = ['Mirpur Branch', 'Uttara Branch', 'Dhanmondi Branch'];

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: ExpenseRecord;
}

export function AddExpenseDrawer({ open, onClose, initial }: Props) {
  const addExpense = useExpenses((s) => s.addExpense);
  const updateExpense = useExpenses((s) => s.updateExpense);
  const removeExpense = useExpenses((s) => s.deleteExpense);
  const categories = useExpenses((s) => s.categories);

  const [date, setDate] = useState((initial?.date ?? new Date().toISOString()).slice(0, 16));
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [amount, setAmount] = useState(initial?.amount ?? 0);
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>(initial?.paymentMethod ?? 'Cash');
  const [reference, setReference] = useState(initial?.reference ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [branch, setBranch] = useState(initial?.branch ?? 'Mirpur Branch');
  const [attachmentName, setAttachmentName] = useState(initial?.attachmentName);
  const [recurring, setRecurring] = useState(!!initial?.recurring);
  const [frequency, setFrequency] = useState<RecurringFrequency>(initial?.frequency ?? 'monthly');
  const [recurringEnd, setRecurringEnd] = useState(initial?.recurringEnd ?? '');

  const [newCatOpen, setNewCatOpen] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open && !initial) {
      setDate(new Date().toISOString().slice(0, 16));
      setCategoryId('');
      setAmount(0);
      setPaymentMethod('Cash');
      setReference('');
      setNote('');
      setBranch('Mirpur Branch');
      setAttachmentName(undefined);
      setRecurring(false);
      setFrequency('monthly');
      setRecurringEnd('');
    }
  }, [open, initial]);

  const m = METHODS.find((x) => x.id === paymentMethod)!;
  const isValid = categoryId && amount > 0 && paymentMethod;

  const submit = () => {
    if (!isValid) return;
    const data: Omit<ExpenseRecord, 'id'> = {
      date,
      categoryId,
      amount,
      paymentMethod,
      reference: reference || undefined,
      note: note || undefined,
      branch,
      user: 'Seam',
      attachmentName,
      recurring,
      frequency: recurring ? frequency : undefined,
      recurringEnd: recurring && recurringEnd ? recurringEnd : undefined,
    };
    if (initial) updateExpense(initial.id, data);
    else addExpense(data);
    onClose();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAttachmentName(f.name);
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width="max-w-xl"
        title={initial ? 'Edit Expense' : 'Add Expense'}
        subtitle="Log a payment out"
      >
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (৳)" required>
              <NumberField value={amount} onChangeNumber={setAmount} className="text-right text-lg" />
            </Field>
            <Field label="Date" required>
              <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

          {/* Category */}
          <Field label="Category" required>
            <div className="flex items-center gap-1.5">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">Choose category…</option>
                {/* Top level categories */}
                {categories
                  .filter((c) => !c.parentId)
                  .map((parent) => {
                    const children = categories.filter((c) => c.parentId === parent.id);
                    return (
                      <optgroup key={parent.id} label={`${parent.emoji ?? ''} ${parent.name}`}>
                        <option value={parent.id}>
                          {parent.name} (top-level)
                        </option>
                        {children.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.emoji ? c.emoji + ' ' : ''}
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
              </select>
              <button
                type="button"
                onClick={() => setNewCatOpen(true)}
                title="Add new category"
                className="size-9 grid place-items-center rounded-md border border-border hover:border-primary hover:bg-primary/10 hover:text-primary text-muted-foreground transition shrink-0"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </Field>

          {/* Payment method */}
          <Field label="Payment method" required>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-1">
              {METHODS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethod(opt.id)}
                    className={cn(
                      'h-12 rounded-md border text-xs font-medium transition inline-flex flex-col items-center justify-center gap-1',
                      paymentMethod === opt.id
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
          </Field>

          {m.needsRef && (
            <Field label="Reference / TxID">
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="TX1234567"
              />
            </Field>
          )}

          {/* Note */}
          <Field label="Description / Note">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="What was this for?"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
            />
          </Field>

          {/* Branch + attachment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Branch">
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Attach receipt">
              <label className="cursor-pointer flex items-center gap-2 px-3 h-9 rounded-md border border-input bg-background hover:bg-secondary/50 transition text-xs">
                <Paperclip className="size-3.5" />
                <span className="flex-1 truncate">{attachmentName ?? 'Browse…'}</span>
                <input type="file" className="hidden" onChange={handleFile} />
              </label>
            </Field>
          </div>

          {/* Recurring */}
          <div className="rounded-lg border border-border p-3 bg-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium inline-flex items-center gap-1.5">
                  <Repeat className="size-3.5 text-primary" /> Recurring expense
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Automatically create future copies (rent, salary…)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRecurring(!recurring)}
                className={cn(
                  'relative w-9 h-5 rounded-full transition',
                  recurring ? 'bg-primary' : 'bg-muted',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-4 rounded-full bg-white transition',
                    recurring ? 'left-[18px]' : 'left-0.5',
                  )}
                />
              </button>
            </div>
            {recurring && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                  >
                    {FREQS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                    End date (optional)
                  </label>
                  <Input
                    type="date"
                    value={recurringEnd}
                    onChange={(e) => setRecurringEnd(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-between">
          {initial ? (
            <Button
              variant="outline"
              onClick={() => {
                if (confirm('Delete this expense?')) {
                  removeExpense(initial.id);
                  onClose();
                }
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!isValid}>
              <Save className="size-4" /> {initial ? 'Save Changes' : 'Save Expense'}
            </Button>
          </div>
        </div>
      </Drawer>

      <NewExpenseCategoryModal
        open={newCatOpen}
        onClose={() => setNewCatOpen(false)}
        onCreated={(id) => setCategoryId(id)}
      />
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
