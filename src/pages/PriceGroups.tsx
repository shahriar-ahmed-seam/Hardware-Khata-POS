import { useMemo, useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Tag, Star } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';
import { usePriceGroups, type PriceGroup } from '@/stores/masterData';

export default function PriceGroups() {
  const { items, add, update, remove } = usePriceGroups();
  const hydrate = usePriceGroups((s) => s.hydrate);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<PriceGroup | 'new' | null>(null);

  // Hydrate from the backend on mount so the store is populated under Electron.
  useEffect(() => void hydrate(), [hydrate]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((p) => p.name.toLowerCase().includes(t));
  }, [items, q]);

  return (
    <div>
      <PageHeader
        title="Selling Price Groups"
        subtitle={`${items.length} groups · used in POS price-group switcher`}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add Group
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
              placeholder="Search groups…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          {list.map((g) => (
            <div key={g.id} className="group flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30">
              <div className="size-8 rounded-md bg-secondary grid place-items-center text-muted-foreground">
                <Tag className="size-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{g.name}</span>
                  {g.isDefault && (
                    <Badge variant="info">
                      <Star className="size-3" /> Default
                    </Badge>
                  )}
                </div>
                {g.notes && <div className="text-[11px] text-muted-foreground">{g.notes}</div>}
              </div>
              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
                <button
                  onClick={() => setEditing(g)}
                  className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                  title="Edit"
                >
                  <Edit2 className="size-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (g.isDefault) {
                      alert('Cannot delete the default price group.');
                      return;
                    }
                    if (confirm(`Delete "${g.name}"? Products with this group will revert to Retail.`))
                      remove(g.id);
                  }}
                  className="size-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30"
                  disabled={g.isDefault}
                  title={g.isDefault ? 'Cannot delete default' : 'Delete'}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">No groups.</div>
          )}
        </Card>
      </div>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        width="max-w-md"
        title={editing === 'new' ? 'Add Price Group' : 'Edit Price Group'}
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), notes: notes || undefined, isDefault });
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
