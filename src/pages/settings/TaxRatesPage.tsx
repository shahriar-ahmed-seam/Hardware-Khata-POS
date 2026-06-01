import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Star, Save, Percent } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { useSettings, type TaxRate } from '@/stores/settings';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';

export default function TaxRatesPage() {
  const taxRates = useSettings((s) => s.taxRates);
  const add = useSettings((s) => s.addTaxRate);
  const update = useSettings((s) => s.updateTaxRate);
  const remove = useSettings((s) => s.removeTaxRate);
  const hydrate = useSettings((s) => s.hydrate);
  const [editing, setEditing] = useState<TaxRate | 'new' | null>(null);

  useEffect(() => void hydrate(), [hydrate]);

  const setDefault = (id: string) => {
    taxRates.forEach((t) => update(t.id, { isDefault: t.id === id }));
  };

  return (
    <div>
      <SettingsHeader
        title="Tax Rates"
        subtitle="VAT and other rates · used in Products / Sales / Purchases"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add Rate
          </Button>
        }
      />

      <div className="p-6 max-w-3xl space-y-4">
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-right px-4 py-2.5 font-medium">Rate</th>
                <th className="text-left px-4 py-2.5 font-medium">Scope</th>
                <th className="text-left px-4 py-2.5 font-medium">Default</th>
                <th className="px-4 py-2.5 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {taxRates.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-secondary/40 group">
                  <td className="px-4 py-2.5 font-medium inline-flex items-center gap-2">
                    <Percent className="size-3.5 text-muted-foreground" />
                    {t.name}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular font-semibold">
                    {t.percentage}%
                  </td>
                  <td className="px-4 py-2.5 text-xs capitalize">
                    <Badge variant="default">{t.scope ?? 'all'}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {t.isDefault ? (
                      <Badge variant="info">
                        <Star className="size-3" /> Default
                      </Badge>
                    ) : (
                      <button
                        onClick={() => setDefault(t.id)}
                        className="text-[11px] px-2 h-7 rounded border border-border hover:bg-secondary"
                      >
                        Set default
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                      <button
                        onClick={() => setEditing(t)}
                        className="size-7 grid place-items-center rounded hover:bg-secondary"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          if (t.isDefault) {
                            toast.error('Cannot delete the default tax rate');
                            return;
                          }
                          if (await confirm({ title: `Delete "${t.name}"?`, variant: 'destructive' }))
                            remove(t.id);
                        }}
                        disabled={t.isDefault}
                        className="size-7 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {taxRates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No tax rates.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        width="max-w-md"
        title={editing === 'new' ? 'Add Tax Rate' : 'Edit Tax Rate'}
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
  initial?: TaxRate;
  onSave: (data: Omit<TaxRate, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [pct, setPct] = useState(initial?.percentage ?? 0);
  const [scope, setScope] = useState<TaxRate['scope']>(initial?.scope ?? 'all');
  const [isDefault, setIsDefault] = useState(!!initial?.isDefault);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({
          name: name.trim(),
          percentage: pct,
          scope,
          isDefault,
        });
      }}
      className="flex flex-col flex-1 min-h-0"
    >
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Name *</label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="VAT 15%" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Percentage *</label>
          <NumberField value={pct} onChangeNumber={setPct} className="text-right" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Scope</label>
          <select
            value={scope ?? 'all'}
            onChange={(e) => setScope(e.target.value as TaxRate['scope'])}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All</option>
            <option value="product">Products only</option>
            <option value="sale">Sales only</option>
            <option value="purchase">Purchases only</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          Mark as default
        </label>
      </div>
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          <Save className="size-4" /> {initial ? 'Save' : 'Add Rate'}
        </Button>
      </div>
    </form>
  );
}
