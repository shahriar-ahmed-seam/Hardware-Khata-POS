import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Save } from 'lucide-react';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { PAY_TERMS } from './labels';
import { useSuppliers } from '@/stores/contacts';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast';
import type { Supplier } from '@/types/domain';

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
        toast.info('This phone number is already saved — that supplier was selected', { description: same.name });
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

  const [more, setMore] = useState(false);
  const close = () => {
    reset();
    setMore(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      width="max-w-lg"
      title="Add New Supplier"
      subtitle="Create and select for this purchase"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!isValid || saving}>
            <Save className="size-4" /> Save & Select
          </Button>
        </div>
      }
    >
      <form
        className="p-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormField label="Supplier name" required>
          {(f) => (
            <Input {...f} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. RFL Plastics" />
          )}
        </FormField>
        <FormField
          label="Phone"
          required
          hint="If this number is already saved, that supplier is picked instead."
        >
          {(f) => <Input {...f} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXX-XXXXXX" />}
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Opening balance (৳)" hint="What you already owe them">
            {(f) => <NumberField {...f} value={openingBalance} onChangeNumber={setOpeningBalance} />}
          </FormField>
          <FormField label="Payment terms">
            {(f) => (
              <Select
                {...f}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value as Supplier['paymentTerms'])}
              >
                {PAY_TERMS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>

        {more ? (
          <div className="space-y-3 pt-1">
            <FormField label="Company">
              {(f) => <Input {...f} value={company} onChange={(e) => setCompany(e.target.value)} />}
            </FormField>
            <FormField label="Contact person">
              {(f) => <Input {...f} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />}
            </FormField>
            <FormField label="Email">
              {(f) => <Input {...f} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </FormField>
            <FormField label="Address">
              {(f) => (
                <textarea
                  {...f}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                />
              )}
            </FormField>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMore(true)}
            className="text-sm text-primary hover:underline focus-ring rounded"
          >
            More details
          </button>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
