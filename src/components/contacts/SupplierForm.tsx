import { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Avatar } from './Avatar';
import { type Supplier } from '@/mocks/data';
import { cn } from '@/lib/utils';

interface Props {
  initial?: Supplier;
  asDrawer?: boolean;
  onSave: (s: Supplier) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

const TERMS: NonNullable<Supplier['paymentTerms']>[] = ['Cash', 'Net7', 'Net15', 'Net30', 'Net60'];

const EMPTY: Supplier = {
  id: '',
  name: '',
  phone: '',
  due: 0,
  totalPurchase: 0,
};

export function SupplierForm({ initial, asDrawer, onSave, onDelete, onCancel }: Props) {
  const [s, setS] = useState<Supplier>(initial ?? EMPTY);

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

  return (
    <div className={cn('flex flex-col flex-1 min-h-0', !asDrawer && 'min-h-full')}>
      <div className="flex-1 overflow-auto">
        <div className={cn('mx-auto max-w-3xl', asDrawer ? 'p-4 space-y-4' : 'p-6 space-y-4')}>
          <div className="flex items-center gap-3 rounded-xl border border-border p-4 bg-card">
            <Avatar name={s.name || '?'} size={56} variant="muted" />
            <div>
              <div className="text-base font-semibold">{s.name || 'New supplier'}</div>
              <div className="text-xs text-muted-foreground">
                {s.company ?? 'No company'} · {s.paymentTerms ?? 'Cash'}
              </div>
            </div>
          </div>

          <Section title="Basic" required>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Supplier name" required>
                <Input value={s.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <Field label="Company">
                <Input value={s.company ?? ''} onChange={(e) => set('company', e.target.value)} />
              </Field>
              <Field label="Contact person">
                <Input
                  value={s.contactPerson ?? ''}
                  onChange={(e) => set('contactPerson', e.target.value)}
                />
              </Field>
              <Field label="Phone" required>
                <Input value={s.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
              <Field label="Alternate phone">
                <Input
                  value={s.altPhone ?? ''}
                  onChange={(e) => set('altPhone', e.target.value)}
                />
              </Field>
              <Field label="Email">
                <Input value={s.email ?? ''} onChange={(e) => set('email', e.target.value)} />
              </Field>
              <Field label="Address" className="md:col-span-2">
                <textarea
                  value={s.address ?? ''}
                  onChange={(e) => set('address', e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                />
              </Field>
            </div>
          </Section>

          <Section title="Trade & finance">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Tax ID (BIN/TIN)">
                <Input value={s.taxId ?? ''} onChange={(e) => set('taxId', e.target.value)} />
              </Field>
              <Field label="Bank account">
                <Input
                  value={s.bankAccount ?? ''}
                  onChange={(e) => set('bankAccount', e.target.value)}
                />
              </Field>
              <Field label="Lead time (days)">
                <NumberField
                  value={s.leadTimeDays ?? 0}
                  onChangeNumber={(v) => set('leadTimeDays', v || undefined)}
                />
              </Field>
              <Field label="Payment terms">
                <select
                  value={s.paymentTerms ?? 'Cash'}
                  onChange={(e) => set('paymentTerms', e.target.value as Supplier['paymentTerms'])}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {TERMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Opening balance (৳)" hint="Migration balance owed to this supplier">
                <NumberField
                  value={s.openingBalance ?? 0}
                  onChangeNumber={(v) => set('openingBalance', v || undefined)}
                />
              </Field>
            </div>
          </Section>

          <Section title="Notes">
            <textarea
              value={s.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              placeholder="Internal notes…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
            />
          </Section>
        </div>
      </div>

      <div className={cn('border-t border-border bg-card px-4 py-3 flex items-center justify-between')}>
        {onDelete && initial ? (
          <Button variant="outline" onClick={onDelete}>
            <Trash2 className="size-4" /> Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={submit} disabled={!isValid}>
            <Save className="size-4" /> {initial ? 'Save Changes' : 'Save Supplier'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card edge-top p-4 space-y-3">
      <div className="text-sm font-semibold">
        {title} {required && <span className="text-destructive">*</span>}
      </div>
      {children}
    </div>
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
    <div className={className}>
      <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
