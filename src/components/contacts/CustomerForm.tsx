import { useState } from 'react';
import { Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Avatar } from './Avatar';
import { type Customer } from '@/mocks/data';
import { cn } from '@/lib/utils';

interface Props {
  initial?: Customer;
  asDrawer?: boolean;
  onSave: (c: Customer) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

const GROUPS: Customer['group'][] = ['Retail', 'Wholesale', 'Contractor'];

const EMPTY: Customer = {
  id: '',
  name: '',
  phone: '',
  group: 'Retail',
  due: 0,
  totalPurchase: 0,
  totalPaid: 0,
  joined: new Date().toISOString().slice(0, 10),
  tags: [],
};

export function CustomerForm({ initial, asDrawer, onSave, onDelete, onCancel }: Props) {
  const [c, setC] = useState<Customer>(initial ?? EMPTY);
  const [tagInput, setTagInput] = useState('');

  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setC((x) => ({ ...x, [k]: v }));

  const isValid = c.name.trim() && c.phone.trim();

  const submit = () => {
    if (!isValid) return;
    const final: Customer = {
      ...c,
      id: c.id || 'cu_' + Date.now(),
      due: c.due || c.openingBalance || 0,
      joined: c.joined || new Date().toISOString().slice(0, 10),
    };
    onSave(final);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    const tags = Array.from(new Set([...(c.tags ?? []), t]));
    set('tags', tags);
    setTagInput('');
  };
  const removeTag = (t: string) => set('tags', (c.tags ?? []).filter((x) => x !== t));

  return (
    <div className={cn('flex flex-col flex-1 min-h-0', !asDrawer && 'min-h-full')}>
      <div className="flex-1 overflow-auto">
        <div className={cn('mx-auto max-w-3xl', asDrawer ? 'p-4 space-y-4' : 'p-6 space-y-4')}>
          {/* Header preview */}
          <div className="flex items-center gap-3 rounded-xl border border-border p-4 bg-card">
            <Avatar name={c.name || '?'} size={56} />
            <div>
              <div className="text-base font-semibold">{c.name || 'New customer'}</div>
              <div className="text-xs text-muted-foreground">
                {c.phone || 'No phone yet'} · {c.group}
              </div>
            </div>
          </div>

          {/* Basic */}
          <Section title="Basic" required>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Name" required>
                <Input value={c.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" />
              </Field>
              <Field label="Phone" required>
                <Input value={c.phone} onChange={(e) => set('phone', e.target.value)} placeholder="01XXX-XXXXXX" />
              </Field>
              <Field label="Alternate phone">
                <Input value={c.altPhone ?? ''} onChange={(e) => set('altPhone', e.target.value)} />
              </Field>
              <Field label="Email">
                <Input value={c.email ?? ''} onChange={(e) => set('email', e.target.value)} />
              </Field>
              <Field label="Group" className="md:col-span-2">
                <div className="flex items-center gap-1 p-0.5 bg-secondary rounded-md text-xs">
                  {GROUPS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => set('group', g)}
                      className={cn(
                        'flex-1 h-9 rounded font-medium transition',
                        c.group === g
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Address" className="md:col-span-2">
                <textarea
                  value={c.address ?? ''}
                  onChange={(e) => set('address', e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                />
              </Field>
            </div>
          </Section>

          {/* Credit */}
          <Section title="Credit & Balances" subtitle="Optional">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Credit limit (৳)" hint="Cap on outstanding due">
                <NumberField value={c.creditLimit ?? 0} onChangeNumber={(v) => set('creditLimit', v || undefined)} />
              </Field>
              <Field
                label="Opening balance (৳)"
                hint="Use when migrating from another system"
              >
                <NumberField
                  value={c.openingBalance ?? 0}
                  onChangeNumber={(v) => set('openingBalance', v || undefined)}
                />
              </Field>
              <Field label="Date of birth">
                <Input
                  type="date"
                  value={c.dob ?? ''}
                  onChange={(e) => set('dob', e.target.value || undefined)}
                />
              </Field>
            </div>
          </Section>

          {/* Tags + Notes */}
          <Section title="Tags & notes">
            <Field label="Tags">
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {(c.tags ?? []).map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium"
                  >
                    {t}
                    <button type="button" onClick={() => removeTag(t)} className="hover:text-destructive">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Type and Enter (e.g. VIP, Regular)"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag} disabled={!tagInput.trim()}>
                  Add
                </Button>
              </div>
            </Field>
            <Field label="Notes" className="mt-3">
              <textarea
                value={c.notes ?? ''}
                onChange={(e) => set('notes', e.target.value)}
                rows={3}
                placeholder="Internal notes…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
              />
            </Field>
          </Section>
        </div>
      </div>

      {/* Footer */}
      <div className={cn('border-t border-border bg-card px-4 py-3 flex items-center justify-between', !asDrawer && 'sticky bottom-0')}>
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
            <Save className="size-4" /> {initial ? 'Save Changes' : 'Save Customer'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  required,
  children,
}: {
  title: string;
  subtitle?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card edge-top p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold">
          {title} {required && <span className="text-destructive">*</span>}
        </div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
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
