import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Save, UserCog } from 'lucide-react';
import { useSuppliers } from '@/stores/contacts';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast';
import type { Supplier } from '@/types/domain';
import { cn } from '@/lib/utils';

const TERMS: NonNullable<Supplier['paymentTerms']>[] = ['Cash', 'Net7', 'Net15', 'Net30', 'Net60'];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the new supplier id once saved */
  onCreated: (id: string) => void;
}

export function NewSupplierModal({ open, onClose, onCreated }: Props) {
  const add = useSuppliers((s) => s.add);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState<Supplier['paymentTerms']>('Cash');
  const [openingBalance, setOpeningBalance] = useState(0);

  const reset = () => {
    setName('');
    setCompany('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setPaymentTerms('Cash');
    setOpeningBalance(0);
  };

  const isValid = name.trim() && phone.trim();

  const [saving, setSaving] = useState(false);
  // Hands the REAL backend id to the purchase form, and only once it is saved.
  // It used to pass 'sp_' + Date.now(), which purchases.create then refused.
  const submit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    // Phone is the de-dupe key (the note in this modal says so): an existing
    // supplier with the same number is selected instead of making a second one.
    const digits = (p?: string | null) => (p ?? '').replace(/\D/g, '');
    try {
      const all = await api<{ id: string; name: string; phone?: string | null }[]>('suppliers.list', {});
      const same = all.find((x) => digits(x.phone) !== '' && digits(x.phone) === digits(phone));
      if (same) {
        setSaving(false);
        toast.info(`${same.name} already has this phone number — selected them instead`);
        reset();
        onCreated(same.id);
        onClose();
        return;
      }
    } catch {
      // The look-up is a convenience; the create below still runs.
    }
    const id = await add({
      name: name.trim(),
      company: company.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
      phone: phone.trim(),
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      paymentTerms,
      openingBalance: openingBalance || undefined,
      due: openingBalance || 0,
      totalPurchase: 0,
    });
    setSaving(false);
    if (!id) return;
    reset();
    onCreated(id);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      width="max-w-2xl"
      title="Add New Supplier"
      subtitle="Create and select for this purchase"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!isValid || saving}>
            <Save className="size-4" /> Save & Select
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-secondary/40">
          <div className="size-10 rounded-full bg-muted text-muted-foreground grid place-items-center">
            <UserCog className="size-4" />
          </div>
          <div className="text-xs text-muted-foreground">
            Phone is the de-dupe key. If a supplier with this phone exists, the existing record
            will be selected instead.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Supplier name" required>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. RFL Plastics"
            />
          </Field>
          <Field label="Company">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="optional" />
          </Field>
          <Field label="Contact person">
            <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </Field>
          <Field label="Phone" required>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXX-XXXXXX" />
          </Field>
          <Field label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Payment terms">
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value as Supplier['paymentTerms'])}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Address" className="md:col-span-2">
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
            />
          </Field>
          <Field
            label="Opening balance (৳)"
            hint="Positive = you owe this supplier (e.g. existing dues)"
            className="md:col-span-2"
          >
            <NumberField value={openingBalance} onChangeNumber={setOpeningBalance} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(className)}>
      <label className="text-xs font-semibold text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
