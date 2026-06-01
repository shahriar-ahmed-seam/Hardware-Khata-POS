import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Search, MapPin, Star, Save } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { useBranches, type Branch } from '@/stores/branches';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

export default function BranchesPage() {
  const { items, add, update, remove, setDefault } = useBranches();
  const hydrate = useBranches((s) => s.hydrate);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);

  useEffect(() => void hydrate(), [hydrate]);

  const list = useMemo(() => {
    if (!q) return items;
    const t = q.toLowerCase();
    return items.filter((b) =>
      `${b.name} ${b.code ?? ''} ${b.address ?? ''} ${b.manager ?? ''}`.toLowerCase().includes(t),
    );
  }, [items, q]);

  return (
    <div>
      <SettingsHeader
        title="Branches"
        subtitle={`${items.length} branches`}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add Branch
          </Button>
        }
      />

      <div className="p-6 max-w-4xl space-y-4">
        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, code, manager…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          {list.map((b) => (
            <div
              key={b.id}
              className="group flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/30"
            >
              <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground">
                <MapPin className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{b.name}</span>
                  {b.code && (
                    <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 rounded">
                      {b.code}
                    </span>
                  )}
                  {b.isDefault && (
                    <Badge variant="info">
                      <Star className="size-3" /> Default
                    </Badge>
                  )}
                  {!b.active && <Badge variant="destructive">Inactive</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {b.address ?? '—'}
                  {b.phonePrimary && <span className="ml-2 font-mono">{b.phonePrimary}</span>}
                  {b.manager && <span className="ml-2">· Mgr: {b.manager}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                {!b.isDefault && (
                  <button
                    onClick={() => setDefault(b.id)}
                    className="text-[11px] px-2 h-7 rounded border border-border hover:bg-secondary"
                    title="Set as default"
                  >
                    Set default
                  </button>
                )}
                <button
                  onClick={() => setEditing(b)}
                  className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground"
                  title="Edit"
                >
                  <Edit2 className="size-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (b.isDefault) {
                      toast.error('Cannot delete the default branch');
                      return;
                    }
                    if (await confirm({ title: `Delete "${b.name}"?`, variant: 'destructive' }))
                      remove(b.id);
                  }}
                  disabled={b.isDefault}
                  className="size-7 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                  title={b.isDefault ? 'Cannot delete default' : 'Delete'}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No branches.
            </div>
          )}
        </Card>
      </div>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        width="max-w-lg"
        title={editing === 'new' ? 'Add Branch' : 'Edit Branch'}
      >
        {editing && (
          <BranchForm
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

function BranchForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Branch;
  onSave: (data: Omit<Branch, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [phone, setPhone] = useState(initial?.phonePrimary ?? '');
  const [phoneAlt, setPhoneAlt] = useState(initial?.phoneAlt ?? '');
  const [manager, setManager] = useState(initial?.manager ?? '');
  const [active, setActive] = useState(initial?.active ?? true);

  const isValid = name.trim();

  const submit = () => {
    if (!isValid) return;
    onSave({
      name: name.trim(),
      code: code.trim() || undefined,
      address: address.trim() || undefined,
      phonePrimary: phone.trim() || undefined,
      phoneAlt: phoneAlt.trim() || undefined,
      manager: manager.trim() || undefined,
      active,
      isDefault: initial?.isDefault,
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col flex-1 min-h-0"
    >
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name" required>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Branch code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="BL0001" />
          </Field>
          <Field label="Address" className="md:col-span-2">
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
            />
          </Field>
          <Field label="Primary phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Alternate phone">
            <Input value={phoneAlt} onChange={(e) => setPhoneAlt(e.target.value)} />
          </Field>
          <Field label="Branch manager" className="md:col-span-2">
            <Input value={manager} onChange={(e) => setManager(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active branch
        </label>
      </div>
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid}>
          <Save className="size-4" /> {initial ? 'Save Changes' : 'Add Branch'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(className)}>
      <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
