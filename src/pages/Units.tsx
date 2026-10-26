import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { FormField } from '@/components/ui/FormField';
import { NumberField } from '@/components/ui/NumberField';
import { type UnitRecord, type UnitType } from '@/stores/masterData';
import {
  useUnits as useUnitsQuery,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
} from '@/hooks/useCatalog';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { labelFor } from '@/lib/labels';
import { MasterFormModal, MasterListPage, MasterRow } from '@/components/products/MasterList';

const TYPES: UnitType[] = ['count', 'weight', 'length', 'volume', 'pack'];

export default function Units() {
  // ----- Data source: the SQLite backend -----
  const unitsQuery = useUnitsQuery();
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const deleteUnit = useDeleteUnit();

  const items: UnitRecord[] = unitsQuery.data ?? [];

  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<UnitRecord | 'new' | null>(null);

  // One flat list, sorted by type then name; the type is a small badge.
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const hit = t ? items.filter((u) => `${u.name} ${u.short}`.toLowerCase().includes(t)) : items;
    return [...hit].sort(
      (a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || a.name.localeCompare(b.name),
    );
  }, [items, q]);

  const save = async (data: Omit<UnitRecord, 'id'>) => {
    if (!editing) return;
    try {
      if (editing === 'new') await createUnit.mutateAsync(data);
      else await updateUnit.mutateAsync({ id: editing.id, patch: data });
      toast.success(editing === 'new' ? 'Unit added' : 'Unit updated');
      setEditing(null);
    } catch (e) {
      toast.error('Save failed', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const onDelete = async (u: UnitRecord) => {
    const ok = await confirm({
      title: 'Delete this unit?',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteUnit.mutateAsync(u.id);
      toast.success('Unit deleted');
    } catch (e) {
      toast.error('Delete failed', { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <>
      <MasterListPage
        title="Units"
        addLabel="Add unit"
        onAdd={() => setEditing('new')}
        total={items.length}
        noun="units"
        q={q}
        onQ={setQ}
        searchPlaceholder="Search units…"
        emptyTitle="No units yet"
        emptyMessage="Add one, e.g. Pieces (pc) or Dozen (dz)."
        shown={list.length}
      >
        {list.map((u) => (
          <MasterRow
            key={u.id}
            name={
              <>
                {u.name} <span className="text-xs text-muted-foreground">({u.short})</span>
              </>
            }
            // Only when it is not 1: "1 dz = 12".
            sub={
              u.toBaseFactor !== 1 ? (
                <span className="tabular" data-no-i18n>
                  1 {u.short} = {u.toBaseFactor}
                </span>
              ) : undefined
            }
            aside={<Badge>{labelFor('unitType', u.type)}</Badge>}
            onEdit={() => setEditing(u)}
            onDelete={() => void onDelete(u)}
            deleteLabel="Delete unit"
          />
        ))}
      </MasterListPage>

      {editing && (
        <UnitForm
          initial={editing === 'new' ? undefined : editing}
          busy={createUnit.isPending || updateUnit.isPending}
          onClose={() => setEditing(null)}
          onSave={(data) => void save(data)}
        />
      )}
    </>
  );
}

function UnitForm({
  initial,
  busy,
  onSave,
  onClose,
}: {
  initial?: UnitRecord;
  busy: boolean;
  onSave: (data: Omit<UnitRecord, 'id'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [short, setShort] = useState(initial?.short ?? '');
  const [type, setType] = useState<UnitType>(initial?.type ?? 'count');
  const [toBase, setToBase] = useState<number>(initial?.toBaseFactor ?? 1);

  return (
    <MasterFormModal
      open
      onClose={onClose}
      title={initial ? 'Edit unit' : 'Add unit'}
      saveLabel={initial ? 'Save changes' : 'Add unit'}
      canSave={!!name.trim() && !!short.trim()}
      busy={busy}
      onSubmit={() =>
        onSave({ name: name.trim(), short: short.trim(), type, toBaseFactor: toBase || 1 })
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Name" required>
          {(f) => (
            <Input
              {...f}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pieces"
            />
          )}
        </FormField>
        <FormField label="Short name" required>
          {(f) => (
            <Input {...f} value={short} onChange={(e) => setShort(e.target.value)} placeholder="pc" />
          )}
        </FormField>
      </div>
      <FormField label="Type">
        {(f) => (
          <Select {...f} value={type} onChange={(e) => setType(e.target.value as UnitType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {labelFor('unitType', t)}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField
        label="How many of the main unit"
        hint="1 dozen = 12, 1 hali = 4. Use 1 for a main unit."
      >
        {(f) => (
          <NumberField
            {...f}
            value={toBase}
            onChangeNumber={setToBase}
            placeholder="1"
            className="text-right tabular"
          />
        )}
      </FormField>
    </MasterFormModal>
  );
}
