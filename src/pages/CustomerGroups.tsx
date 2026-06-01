import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Tag, Star, Users, Percent } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';
import { usePriceGroups, type PriceGroup } from '@/stores/masterData';
import { useCustomers } from '@/stores/contacts';
import { formatBDT } from '@/lib/utils';

export default function CustomerGroups() {
  const { items, add, update, remove } = usePriceGroups();
  const hydrate = usePriceGroups((s) => s.hydrate);
  const customers = useCustomers((s) => s.items);
  const hydrateCustomers = useCustomers((s) => s.hydrate);
  const [editing, setEditing] = useState<PriceGroup | 'new' | null>(null);

  // Customer counts per group are read from the (backend-aware) customers store;
  // hydrate both stores on mount so the groups + counts populate when this is the
  // entry point.
  useEffect(() => {
    void hydrate();
    void hydrateCustomers();
  }, [hydrate, hydrateCustomers]);

  const customerCount = (groupName: string) =>
    customers.filter((c) => c.group === (groupName as any)).length;

  return (
    <div>
      <PageHeader
        title="Customer Groups"
        subtitle="Same as Selling Price Groups · used for default pricing, credit, discount"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add Group
          </Button>
        }
      />

      <div className="p-6 max-w-3xl space-y-3">
        {items.map((g) => (
          <Card key={g.id} className="p-4">
            <div className="flex items-start gap-4">
              <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
                <Tag className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-semibold">{g.name}</span>
                  {g.isDefault && (
                    <Badge variant="info">
                      <Star className="size-3" /> Default
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <Users className="size-3" /> {customerCount(g.name)} customers
                  </span>
                </div>
                {g.notes && <div className="text-xs text-muted-foreground mt-0.5">{g.notes}</div>}
                <div className="flex items-center gap-3 mt-2 text-xs">
                  {g.defaultCreditLimit ? (
                    <span className="text-muted-foreground">
                      Default credit: <span className="text-foreground font-mono tabular">{formatBDT(g.defaultCreditLimit)}</span>
                    </span>
                  ) : null}
                  {g.defaultDiscountPct ? (
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <Percent className="size-3" />
                      <span className="text-foreground font-mono tabular">{g.defaultDiscountPct}%</span>
                      default discount
                    </span>
                  ) : null}
                  {g.taxExempt && <Badge variant="warning">Tax exempt</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(g)}
                  className="size-8 grid place-items-center rounded hover:bg-secondary text-muted-foreground"
                  title="Edit"
                >
                  <Edit2 className="size-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (g.isDefault) {
                      alert('Cannot delete the default group.');
                      return;
                    }
                    if (confirm(`Delete "${g.name}"?`)) remove(g.id);
                  }}
                  disabled={g.isDefault}
                  className="size-8 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                  title={g.isDefault ? 'Cannot delete default' : 'Delete'}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        width="max-w-md"
        title={editing === 'new' ? 'Add Customer Group' : 'Edit Customer Group'}
      >
        {editing && (
          <Form
            initial={editing === 'new' ? undefined : editing}
            onSave={(data) => {
              if (editing === 'new') add(data);
              else update(editing.id, data);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

function Form({
  initial,
  onSave,
  onCancel,
}: {
  initial?: PriceGroup;
  onSave: (data: Omit<PriceGroup, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [isDefault, setIsDefault] = useState(!!initial?.isDefault);
  const [defaultCreditLimit, setDefaultCreditLimit] = useState(initial?.defaultCreditLimit ?? 0);
  const [defaultDiscountPct, setDefaultDiscountPct] = useState(initial?.defaultDiscountPct ?? 0);
  const [taxExempt, setTaxExempt] = useState(!!initial?.taxExempt);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({
          name: name.trim(),
          notes: notes || undefined,
          isDefault,
          defaultCreditLimit: defaultCreditLimit || undefined,
          defaultDiscountPct: defaultDiscountPct || undefined,
          taxExempt,
        });
      }}
      className="flex flex-col flex-1 min-h-0"
    >
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Name *</label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="VIP / Member / etc." />
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Notes</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">
              Default credit limit (৳)
            </label>
            <NumberField value={defaultCreditLimit} onChangeNumber={setDefaultCreditLimit} />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">
              Default discount %
            </label>
            <NumberField value={defaultDiscountPct} onChangeNumber={setDefaultDiscountPct} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={taxExempt}
            onChange={(e) => setTaxExempt(e.target.checked)}
          />
          Tax exempt (no VAT applied automatically)
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          Mark as default group for new customers
        </label>
      </div>
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {initial ? 'Save Changes' : 'Add Group'}
        </Button>
      </div>
    </form>
  );
}
