import { useMemo, useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { useWarranties, type Warranty } from '@/stores/masterData';
import { NumberField } from '@/components/ui/NumberField';

export default function Warranties() {
  const { items, add, update, remove } = useWarranties();
  const hydrate = useWarranties((s) => s.hydrate);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Warranty | 'new' | null>(null);

  // Hydrate from the backend on mount so the store is populated under Electron.
  useEffect(() => void hydrate(), [hydrate]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((w) => w.name.toLowerCase().includes(t));
  }, [items, q]);

  return (
    <div>
      <PageHeader
        title="Warranties"
        subtitle={`${items.length} warranty templates`}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add Warranty
          </Button>
        }
      />

      <div className="p-6 max-w-3xl">
        <Card className="p-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search warranties…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Name</th>
                <th className="text-right font-medium px-4 py-2.5">Duration</th>
                <th className="text-left font-medium px-4 py-2.5">Description</th>
                <th className="px-4 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id} className="border-t border-border group hover:bg-secondary/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-success" />
                      <span className="font-medium">{w.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {w.durationMonths} {w.durationMonths === 1 ? 'month' : 'months'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs truncate max-w-[300px]">
                    {w.description ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                      <button
                        onClick={() => setEditing(w)}
                        className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete warranty "${w.name}"?`)) remove(w.id);
                        }}
                        className="size-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No warranties.
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
        title={editing === 'new' ? 'Add Warranty' : 'Edit Warranty'}
      >
        {editing && (
          <WarrantyForm
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

function WarrantyForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Warranty;
  onSave: (data: Omit<Warranty, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [duration, setDuration] = useState<number>(initial?.durationMonths ?? 12);
  const [desc, setDesc] = useState(initial?.description ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), durationMonths: duration || 0, description: desc || undefined });
      }}
      className="flex flex-col flex-1 min-h-0"
    >
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Name *</label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="1 Year Manufacturer" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
            Duration (months)
          </label>
              <NumberField
                value={duration}
                onChangeNumber={setDuration}
                placeholder="12"
              />
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="What's covered, exclusions, etc."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
          />
        </div>
      </div>
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {initial ? 'Save Changes' : 'Add Warranty'}
        </Button>
      </div>
    </form>
  );
}
