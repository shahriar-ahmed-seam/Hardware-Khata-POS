import { useState } from 'react';
import { ChevronRight, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { DateField } from '@/components/ui/DateTimeField';
import { todayLocalDateInput } from '@/lib/datetime';
import { FormField } from '@/components/ui/FormField';
import { Segmented } from '@/components/ui/Segmented';
import { labelFor } from '@/lib/labels';
import type { Customer } from '@/types/domain';
import { cn } from '@/lib/utils';
import { useCan } from '@/hooks/useCan';

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
  // The shop's calendar day, not the UTC one.
  joined: todayLocalDateInput(),
  tags: [],
};

export function CustomerForm({ initial, asDrawer, onSave, onDelete, onCancel }: Props) {
  const [c, setC] = useState<Customer>(initial ?? EMPTY);
  // Opening balance and credit limit change what is owed: owner or manager only
  // (the backend refuses it too — electron/guard.ts contactBalanceGateError).
  const canEditMoney = useCan('sales.void');
  const [tagInput, setTagInput] = useState('');

  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setC((x) => ({ ...x, [k]: v }));

  const isValid = c.name.trim() && c.phone.trim();

  const submit = () => {
    if (!isValid) return;
    const final: Customer = {
      ...c,
      id: c.id || 'cu_' + Date.now(),
      due: c.due || c.openingBalance || 0,
      joined: c.joined || todayLocalDateInput(),
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

  const [tried, setTried] = useState(false);
  const nameErr = tried && !c.name.trim() ? 'Name is required' : undefined;
  const phoneErr = tried && !c.phone.trim() ? 'Phone is required' : undefined;
  // Open "More details" by itself when it already holds something.
  const hasMore = !!(c.altPhone || c.email || c.dob || c.notes || (c.tags ?? []).length);
  const noMoneyHint = 'Only the owner or a manager can change this';

  return (
    // Exactly one scroll container, and the mode decides which. In a Drawer the
    // body is `flex-1 min-h-0 flex flex-col`, so this root must claim
    // `flex-1 min-h-0` or the inner scroller gets no bounded height.
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
          {/* Basic */}
          <div className="space-y-4">
            <FormField label="Name" required error={nameErr}>
              {(f) => (
                <Input {...f} autoFocus value={c.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" />
              )}
            </FormField>
            <FormField label="Phone" required error={phoneErr}>
              {(f) => (
                <Input {...f} value={c.phone} onChange={(e) => set('phone', e.target.value)} placeholder="01XXX-XXXXXX" />
              )}
            </FormField>
            <FormField label="Group">
              <Segmented
                ariaLabel="Group"
                fullWidth
                value={c.group}
                onChange={(g) => set('group', g)}
                options={GROUPS.map((g) => ({ value: g, label: labelFor('priceGroup', g) }))}
              />
            </FormField>
            <FormField label="Address">
              {(f) => (
                <textarea
                  {...f}
                  value={c.address ?? ''}
                  onChange={(e) => set('address', e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                />
              )}
            </FormField>
          </div>

          {/* Money */}
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
            <FormField label="Opening balance (৳)" hint={canEditMoney ? 'Use when migrating from another system' : noMoneyHint}>
              {(f) => (
                <NumberField
                  {...f}
                  value={c.openingBalance ?? 0}
                  onChangeNumber={(v) => set('openingBalance', v || undefined)}
                  disabled={!canEditMoney}
                />
              )}
            </FormField>
            <FormField label="Credit limit (৳)" hint={canEditMoney ? 'Cap on outstanding due' : noMoneyHint}>
              {(f) => (
                <NumberField
                  {...f}
                  value={c.creditLimit ?? 0}
                  onChangeNumber={(v) => set('creditLimit', v || undefined)}
                  disabled={!canEditMoney}
                />
              )}
            </FormField>
          </div>

          {/* Everything else, folded away */}
          <details open={hasMore} className="group border-t border-border pt-4">
            <summary className="cursor-pointer select-none text-sm font-semibold inline-flex items-center gap-1.5 h-9">
              <ChevronRight className="size-4 transition group-open:rotate-90" />
              More details
            </summary>
            <div className="space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Alternate phone">
                  {(f) => <Input {...f} value={c.altPhone ?? ''} onChange={(e) => set('altPhone', e.target.value)} />}
                </FormField>
                <FormField label="Email">
                  {(f) => <Input {...f} value={c.email ?? ''} onChange={(e) => set('email', e.target.value)} />}
                </FormField>
              </div>
              <FormField label="Date of birth">
                <DateField value={c.dob ?? ''} onChange={(v) => set('dob', v || undefined)} />
              </FormField>
              <FormField label="Tags">
                {(f) => (
                  <div>
                    {(c.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {(c.tags ?? []).map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                          >
                            {t}
                            <button
                              type="button"
                              onClick={() => removeTag(t)}
                              className="hover:text-destructive"
                              aria-label="Remove tag"
                            >
                              <X className="size-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Input
                        {...f}
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
                      <Button type="button" variant="outline" onClick={addTag} disabled={!tagInput.trim()}>
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </FormField>
              <FormField label="Notes">
                {(f) => (
                  <textarea
                    {...f}
                    value={c.notes ?? ''}
                    onChange={(e) => set('notes', e.target.value)}
                    rows={3}
                    placeholder="Internal notes…"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                  />
                )}
              </FormField>
            </div>
          </details>
        </div>
      </div>

      {/* Footer */}
      <div className={cn('border-t border-border bg-card px-4 py-3 flex items-center justify-between', !asDrawer && 'sticky bottom-0')}>
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
            <Save className="size-4" /> {initial ? 'Save Changes' : 'Save Customer'}
          </Button>
        </div>
      </div>
    </form>
  );
}
