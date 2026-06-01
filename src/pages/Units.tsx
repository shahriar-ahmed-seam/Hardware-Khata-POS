import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Search, Ruler } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { useUnits as useUnitsStore, type UnitRecord, type UnitType } from '@/stores/masterData';
import {
  useUnits as useUnitsQuery,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
} from '@/hooks/useCatalog';
import { hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';
import { NumberField } from '@/components/ui/NumberField';

const TYPES: UnitType[] = ['count', 'weight', 'length', 'volume', 'pack'];

export default function Units() {
  const backend = hasBackend();

  // ----- Data source: backend when available, else mock store -----
  const store = useUnitsStore();
  const unitsQuery = useUnitsQuery();
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const deleteUnit = useDeleteUnit();

  const items: UnitRecord[] = backend ? (unitsQuery.data ?? []) : store.items;

  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<UnitRecord | 'new' | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((u) => `${u.name} ${u.short}`.toLowerCase().includes(t));
  }, [items, q]);

  // Group by type for nicer display
  const grouped = useMemo(() => {
    const map: Record<UnitType, UnitRecord[]> = {
      count: [],
      weight: [],
      length: [],
      volume: [],
      pack: [],
    };
    list.forEach((u) => map[u.type].push(u));
    return map;
  }, [list]);

  const save = async (data: Omit<UnitRecord, 'id'>, current: UnitRecord | 'new') => {
    if (backend) {
      try {
        if (current === 'new') {
          await createUnit.mutateAsync({
            name: data.name,
            short: data.short,
            type: data.type,
            toBaseFactor: data.toBaseFactor,
          });
        } else {
          await updateUnit.mutateAsync({
            id: current.id,
            patch: {
              name: data.name,
              short: data.short,
              type: data.type,
              toBaseFactor: data.toBaseFactor,
            },
          });
        }
        toast.success(current === 'new' ? 'Unit added' : 'Unit updated');
        setEditing(null);
      } catch (e) {
        toast.error('Save failed', { description: e instanceof Error ? e.message : undefined });
      }
    } else {
      if (current === 'new') store.add(data);
      else store.update(current.id, data);
      setEditing(null);
    }
  };

  const onDelete = async (u: UnitRecord) => {
    if (!confirm(`Delete unit "${u.name}"?`)) return;
    if (backend) {
      try {
        await deleteUnit.mutateAsync(u.id);
        toast.success('Unit deleted');
      } catch (e) {
        toast.error('Delete failed', { description: e instanceof Error ? e.message : undefined });
      }
    } else {
      store.remove(u.id);
    }
  };

  return (
    <div>
      <PageHeader
        title="Units"
        subtitle={`${items.length} units · grouped by type`}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add Unit
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
              placeholder="Search units…"
              className="pl-9"
            />
          </div>
        </Card>

        <div className="space-y-3">
          {TYPES.map((type) => {
            const arr = grouped[type];
            if (arr.length === 0) return null;
            return (
              <Card key={type} className="overflow-hidden">
                <div className="px-4 py-2 border-b border-border bg-secondary/40 text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">
                  {type}
                </div>
                {arr.map((u) => (
                  <div
                    key={u.id}
                    className="group flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30"
                  >
                    <div className="size-8 rounded-md bg-secondary grid place-items-center text-muted-foreground">
                      <Ruler className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {u.name}{' '}
                        <span className="text-[11px] text-muted-foreground font-mono">({u.short})</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular">
                        1 {u.short} = {u.toBaseFactor} base unit
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
                      <button
                        onClick={() => setEditing(u)}
                        className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          void onDelete(u);
                        }}
                        className="size-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            );
          })}
          {list.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">No units match.</div>
          )}
        </div>
      </div>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        width="max-w-md"
        title={editing === 'new' ? 'Add Unit' : 'Edit Unit'}
      >
        {editing && (
          <UnitForm
            initial={editing === 'new' ? undefined : editing}
            onSave={(data) => {
              void save(data, editing);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

function UnitForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: UnitRecord;
  onSave: (data: Omit<UnitRecord, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [short, setShort] = useState(initial?.short ?? '');
  const [type, setType] = useState<UnitType>(initial?.type ?? 'count');
  const [toBase, setToBase] = useState<number>(initial?.toBaseFactor ?? 1);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !short.trim()) return;
        onSave({ name: name.trim(), short: short.trim(), type, toBaseFactor: toBase || 1 });
      }}
      className="flex flex-col flex-1 min-h-0"
    >
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Name *</label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Pieces" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Short *</label>
            <Input value={short} onChange={(e) => setShort(e.target.value)} placeholder="pc" />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as UnitType)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
            Conversion to base
          </label>
          <NumberField
            value={toBase}
            onChangeNumber={setToBase}
            placeholder="1"
          />
          <div className="text-[10px] text-muted-foreground mt-1">
            For BD: 1 dozen = 12, 1 hali = 4, 1 ft = 0.3048 m. Set 1 if this is the base.
          </div>
        </div>
      </div>
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || !short.trim()}>
          {initial ? 'Save Changes' : 'Add Unit'}
        </Button>
      </div>
    </form>
  );
}
