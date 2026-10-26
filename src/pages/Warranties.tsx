import { useMemo, useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { NumberField } from '@/components/ui/NumberField';
import { useWarranties, type Warranty } from '@/stores/masterData';
import { confirm } from '@/stores/confirm';
import { MasterFormModal, MasterListPage, MasterRow } from '@/components/products/MasterList';

/**
 * Warranty terms. Products cannot carry a warranty yet (owner decision 4: keep
 * it simple), so the page says so plainly instead of implying it does more.
 */
export default function Warranties() {
  const { items, add, update, remove } = useWarranties();
  const hydrate = useWarranties((s) => s.hydrate);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Warranty | 'new' | null>(null);

  // Hydrate from the backend on mount so the store is populated under Electron.
  useEffect(() => void hydrate(), [hydrate]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((w) => w.name.toLowerCase().includes(t)) : items;
  }, [items, q]);

  return (
    <>
      <MasterListPage
        title="Warranties"
        addLabel="Add warranty"
        onAdd={() => setEditing('new')}
        total={items.length}
        noun="warranties"
        q={q}
        onQ={setQ}
        searchPlaceholder="Search warranties…"
        emptyTitle="No warranties yet"
        emptyMessage="Add one, e.g. 1 year."
        shown={list.length}
        note="A list of warranty terms for your reference. They are not attached to products or printed on receipts yet."
      >
        {list.map((w) => (
          <MasterRow
            key={w.id}
            name={w.name}
            sub={w.description || undefined}
            aside={
              <>
                {w.durationMonths} <span>{w.durationMonths === 1 ? 'month' : 'months'}</span>
              </>
            }
            onEdit={() => setEditing(w)}
            onDelete={async () => {
              const ok = await confirm({
                title: 'Delete this warranty?',
                confirmLabel: 'Delete',
                variant: 'destructive',
              });
              if (ok) remove(w.id);
            }}
            deleteLabel="Delete warranty"
          />
        ))}
      </MasterListPage>

      {editing && (
        <WarrantyForm
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            if (editing === 'new') add(data);
            else update(editing.id, data);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function WarrantyForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Warranty;
  onSave: (data: Omit<Warranty, 'id'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [duration, setDuration] = useState<number>(initial?.durationMonths ?? 12);
  const [desc, setDesc] = useState(initial?.description ?? '');

  return (
    <MasterFormModal
      open
      onClose={onClose}
      title={initial ? 'Edit warranty' : 'Add warranty'}
      saveLabel={initial ? 'Save changes' : 'Add warranty'}
      canSave={!!name.trim()}
      onSubmit={() =>
        onSave({ name: name.trim(), durationMonths: duration || 0, description: desc || undefined })
      }
    >
      <FormField label="Name" required>
        {(f) => (
          <Input
            {...f}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="1 year"
          />
        )}
      </FormField>
      <FormField label="How many months">
        {(f) => (
          <NumberField
            {...f}
            value={duration}
            onChangeNumber={setDuration}
            placeholder="12"
            className="text-right tabular"
          />
        )}
      </FormField>
      <FormField label="Description">
        {(f) => (
          <textarea
            {...f}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="What is covered"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
          />
        )}
      </FormField>
    </MasterFormModal>
  );
}
