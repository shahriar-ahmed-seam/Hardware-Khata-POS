import { useMemo, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Save,
  Users,
  ArrowLeft,
  Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Drawer } from '@/components/ui/Drawer';
import { useSms, type SmsGroup } from '@/stores/sms';
import { useCustomers } from '@/stores/contacts';
import { confirm } from '@/stores/confirm';
import { cn } from '@/lib/utils';

export default function GroupsPage() {
  const groups = useSms((s) => s.groups);
  const add = useSms((s) => s.addGroup);
  const update = useSms((s) => s.updateGroup);
  const remove = useSms((s) => s.removeGroup);
  const [editing, setEditing] = useState<SmsGroup | 'new' | null>(null);

  return (
    <div>
      <PageHeader
        title="SMS Groups"
        subtitle={`${groups.length} groups`}
        actions={
          <>
            <Link
              to="/sms"
              className="inline-flex items-center gap-1 px-2 h-9 rounded-md hover:bg-secondary text-sm text-muted-foreground"
            >
              <ArrowLeft className="size-4" /> SMS
            </Link>
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Add Group
            </Button>
          </>
        }
      />

      <div className="p-6 max-w-4xl space-y-3">
        {groups.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            <Users className="size-6 mx-auto mb-2 opacity-50" />
            No groups yet.
          </Card>
        )}
        {groups.map((g) => {
          const total = g.memberIds.length + (g.manualNumbers?.length ?? 0);
          return (
            <Card key={g.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-md bg-accent/10 text-accent grid place-items-center">
                  <Users className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{g.name}</div>
                  {g.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">{g.description}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {total} member{total === 1 ? '' : 's'}
                    {g.manualNumbers && g.manualNumbers.length > 0 && (
                      <span> · {g.manualNumbers.length} manual</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Link to="/sms/send">
                    <Button variant="outline" size="sm">
                      <Send className="size-3" /> Send
                    </Button>
                  </Link>
                  <button
                    onClick={() => setEditing(g)}
                    className="size-8 grid place-items-center rounded hover:bg-secondary"
                  >
                    <Edit2 className="size-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        await confirm({
                          title: `Delete group "${g.name}"?`,
                          message: 'This removes the group but keeps the customers.',
                          variant: 'destructive',
                        })
                      )
                        remove(g.id);
                    }}
                    className="size-8 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        width="max-w-2xl"
        title={editing === 'new' ? 'Add Group' : 'Edit Group'}
      >
        {editing && (
          <GroupForm
            initial={editing === 'new' ? undefined : editing}
            onSave={(d) => {
              if (editing === 'new') add(d);
              else update(editing.id, d);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

function GroupForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: SmsGroup;
  onSave: (data: Omit<SmsGroup, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}) {
  const customers = useCustomers((s) => s.items);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(initial?.memberIds ?? []);
  const [manual, setManual] = useState((initial?.manualNumbers ?? []).join('\n'));
  const [search, setSearch] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!search) return customers;
    const t = search.toLowerCase();
    return customers.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(t));
  }, [customers, search]);

  const toggle = (id: string) => {
    setMemberIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const submit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      memberIds,
      manualNumbers: manual
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
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
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Name <span className="text-destructive">*</span>
            </label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Description
            </label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Pick customers · {memberIds.length} selected
            </label>
            {memberIds.length > 0 && (
              <button
                type="button"
                onClick={() => setMemberIds([])}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers…"
              className="pl-9"
            />
          </div>
          <div className="rounded-md border border-border max-h-64 overflow-auto">
            {filteredCustomers.map((c) => {
              const checked = memberIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0 cursor-pointer hover:bg-secondary',
                    checked && 'bg-primary/5',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(c.id)}
                    className="accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">{c.phone}</div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{c.group}</span>
                </label>
              );
            })}
            {filteredCustomers.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No customers match.
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            Manual numbers (optional)
          </label>
          <textarea
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            rows={3}
            placeholder="One per line or comma-separated"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y font-mono"
          />
          <div className="text-[11px] text-muted-foreground mt-0.5">
            For numbers not in your customer list (e.g. a one-time promo blast).
          </div>
        </div>
      </div>
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          <Save className="size-4" /> {initial ? 'Save Changes' : 'Add Group'}
        </Button>
      </div>
    </form>
  );
}
