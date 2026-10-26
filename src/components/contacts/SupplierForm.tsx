import { useState } from 'react';
import { ChevronRight, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import type { Supplier } from '@/types/domain';
import { cn } from '@/lib/utils';
import { useCan } from '@/hooks/useCan';

interface Props {
  initial?: Supplier;
  asDrawer?: boolean;
  onSave: (s: Supplier) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

const TERMS: NonNullable<Supplier['paymentTerms']>[] = ['Cash', 'Net7', 'Net15', 'Net30', 'Net60'];
/** Stored codes stay as they are; the owner reads days. */
const TERM_LABEL: Record<(typeof TERMS)[number], string> = {
  Cash: 'Cash',
  Net7: '7 days',
  Net15: '15 days',
  Net30: '30 days',
  Net60: '60 days',
};

const EMPTY: Supplier = {
  id: '',
  name: '',
  phone: '',
  due: 0,
  totalPurchase: 0,
};

export function SupplierForm({ initial, asDrawer, onSave, onDelete, onCancel }: Props) {
  const [s, setS] = useState<Supplier>(initial ?? EMPTY);
  // The opening balance changes what the shop owes: owner or manager only.
  const canEditMoney = useCan('sales.void');

  const set = <K extends keyof Supplier>(k: K, v: Supplier[K]) => setS((x) => ({ ...x, [k]: v }));

  const isValid = s.name.trim() && s.phone.trim();
  const submit = () => {
    if (!isValid) return;
    onSave({
      ...s,
      id: s.id || 'sp_' + Date.now(),
      due: s.due || s.openingBalance || 0,
    });
  };

  const [tried, setTried] = useState(false);
  const nameErr = tried && !s.name.trim() ? 'Name is required' : undefined;
  const phoneErr = tried && !s.phone.trim() ? 'Phone is required' : undefined;
  const hasMore = !!(s.contactPerson || s.altPhone || s.email || s.taxId || s.bankAccount || s.leadTimeDays || s.notes);
  const area =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y';

  return (
    // One scroll container, chosen by mode — see the note in CustomerForm.
    <form
      className={cn('flex flex-col', asDrawer ? 'flex-1 min-h-0' : 'min-h-full')}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        submit();
      }}
    >
      <div className={cn(asDrawer && 'flex-1 min-h-0 overflow-auto')}>
        <div className={cn('mx-auto max-w-xl', asDrawer ? 'p-5 space-y-5' : 'p-6 space-y-5')}>
          {/* Name and phone first (both required), then where they are. */}
          <div className="space-y-4">
            <FormField label="Supplier name" required error={nameErr}>
              {(f) => <Input {...f} autoFocus value={s.name} onChange={(e) => set('name', e.target.value)} />}
            </FormField>
            <FormField label="Phone" required error={phoneErr}>
              {(f) => <Input {...f} value={s.phone} onChange={(e) => set('phone', e.target.value)} />}
            </FormField>
            <FormField label="Company">
              {(f) => <Input {...f} value={s.company ?? ''} onChange={(e) => set('company', e.target.value)} />}
            </FormField>
            <FormField label="Address">
              {(f) => (
                <textarea {...f} value={s.address ?? ''} onChange={(e) => set('address', e.target.value)} rows={2} className={area} />
              )}
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
            <FormField
              label="Opening balance (৳)"
              hint={canEditMoney ? 'Migration balance owed to this supplier' : 'Only the owner or a manager can change this'}
            >
              {(f) => (
                <NumberField
                  {...f}
                  value={s.openingBalance ?? 0}
                  onChangeNumber={(v) => set('openingBalance', v || undefined)}
                  disabled={!canEditMoney}
                />
              )}
            </FormField>
            <FormField label="Payment terms">
              {(f) => (
                <Select
                  {...f}
                  value={s.paymentTerms ?? 'Cash'}
                  onChange={(e) => set('paymentTerms', e.target.value as Supplier['paymentTerms'])}
                >
                  {TERMS.map((t) => (
                    <option key={t} value={t}>
                      {TERM_LABEL[t]}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>

          <details open={hasMore} className="group border-t border-border pt-4">
            <summary className="cursor-pointer select-none text-sm font-semibold inline-flex items-center gap-1.5 h-9">
              <ChevronRight className="size-4 transition group-open:rotate-90" />
              More details
            </summary>
            <div className="space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Contact person">
                  {(f) => (
                    <Input {...f} value={s.contactPerson ?? ''} onChange={(e) => set('contactPerson', e.target.value)} />
                  )}
                </FormField>
                <FormField label="Alternate phone">
                  {(f) => <Input {...f} value={s.altPhone ?? ''} onChange={(e) => set('altPhone', e.target.value)} />}
                </FormField>
                <FormField label="Email">
                  {(f) => <Input {...f} value={s.email ?? ''} onChange={(e) => set('email', e.target.value)} />}
                </FormField>
                <FormField label="Lead time (days)">
                  {(f) => (
                    <NumberField
                      {...f}
                      value={s.leadTimeDays ?? 0}
                      onChangeNumber={(v) => set('leadTimeDays', v || undefined)}
                    />
                  )}
                </FormField>
                <FormField label="Tax ID (BIN/TIN)">
                  {(f) => <Input {...f} value={s.taxId ?? ''} onChange={(e) => set('taxId', e.target.value)} />}
                </FormField>
                <FormField label="Bank account">
                  {(f) => <Input {...f} value={s.bankAccount ?? ''} onChange={(e) => set('bankAccount', e.target.value)} />}
                </FormField>
              </div>
              <FormField label="Notes">
                {(f) => (
                  <textarea
                    {...f}
                    value={s.notes ?? ''}
                    onChange={(e) => set('notes', e.target.value)}
                    rows={3}
                    placeholder="Internal notes…"
                    className={area}
                  />
                )}
              </FormField>
            </div>
          </details>
        </div>
      </div>

      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-between">
        {onDelete && initial ? (
          <Button type="button" variant="outline" className="text-destructive" onClick={onDelete}>
            <Trash2 className="size-4" /> Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit">
            <Save className="size-4" /> {initial ? 'Save Changes' : 'Save Supplier'}
          </Button>
        </div>
      </div>
    </form>
  );
}
