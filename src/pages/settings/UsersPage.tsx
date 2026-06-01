import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Save,
  Shield,
  KeyRound,
  Power,
  PowerOff,
  Clock,
  Lock,
} from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { useUsers, type User, type UserStatus } from '@/stores/users';
import { useBranches } from '@/stores/branches';
import { useAuth } from '@/stores/auth';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

function timeAgo(iso?: string): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function UsersPage() {
  const users = useUsers((s) => s.users);
  const roles = useUsers((s) => s.roles);
  const addUser = useUsers((s) => s.addUser);
  const updateUser = useUsers((s) => s.updateUser);
  const removeUser = useUsers((s) => s.removeUser);
  const hydrate = useUsers((s) => s.hydrate);
  const hydrateBranches = useBranches((s) => s.hydrate);

  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [editing, setEditing] = useState<User | 'new' | null>(null);

  // Load users + roles + agents, and branches for the branch-assignment UI.
  useEffect(() => {
    void hydrate();
    void hydrateBranches();
  }, [hydrate, hydrateBranches]);

  const list = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter && u.roleId !== roleFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      if (q) {
        const t = q.toLowerCase();
        if (!`${u.name} ${u.username} ${u.phone ?? ''} ${u.email ?? ''}`.toLowerCase().includes(t))
          return false;
      }
      return true;
    });
  }, [users, q, roleFilter, statusFilter]);

  const counts = useMemo(() => {
    const c = { total: users.length, active: 0, inactive: 0, suspended: 0 };
    users.forEach((u) => {
      c[u.status]++;
    });
    return c;
  }, [users]);

  return (
    <div>
      <SettingsHeader
        title="Users"
        subtitle={`${counts.total} users · ${counts.active} active`}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add User
          </Button>
        }
      />

      <div className="p-6 max-w-6xl space-y-4">
        <SecurityCard />
        <Card className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, username, phone, email…"
                className="pl-9"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatus | '')}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1.2fr_1fr_auto] gap-3 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            <div>User</div>
            <div>Role</div>
            <div>Branches</div>
            <div>Last login</div>
            <div className="w-[140px]" />
          </div>
          {list.map((u) => {
            const role = roles.find((r) => r.id === u.roleId);
            return (
              <div
                key={u.id}
                className="group grid grid-cols-[2fr_1fr_1.2fr_1fr_auto] gap-3 items-center px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-bold">
                    {initials(u.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{u.name}</span>
                      {u.status === 'active' && <Badge variant="success">Active</Badge>}
                      {u.status === 'inactive' && <Badge variant="default">Inactive</Badge>}
                      {u.status === 'suspended' && <Badge variant="destructive">Suspended</Badge>}
                      {u.pin && (
                        <span title="PIN set" className="text-muted-foreground">
                          <KeyRound className="size-3" />
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      @{u.username}
                      {u.phone && <span className="ml-2 font-mono">{u.phone}</span>}
                      {u.email && <span className="ml-2">· {u.email}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-sm">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs">
                    <Shield className="size-3" /> {role?.name ?? '—'}
                  </div>
                </div>
                <BranchList ids={u.branchIds} />
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="size-3" /> {timeAgo(u.lastLoginAt)}
                </div>
                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                  <button
                    onClick={() =>
                      updateUser(u.id, {
                        status: u.status === 'active' ? 'inactive' : 'active',
                      })
                    }
                    className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground"
                    title={u.status === 'active' ? 'Deactivate' : 'Activate'}
                  >
                    {u.status === 'active' ? (
                      <PowerOff className="size-3.5" />
                    ) : (
                      <Power className="size-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => setEditing(u)}
                    className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground"
                    title="Edit"
                  >
                    <Edit2 className="size-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (u.id === 'u_admin') {
                        toast.error('Cannot delete the owner account');
                        return;
                      }
                      if (await confirm({ title: `Delete user "${u.name}"?`, variant: 'destructive' }))
                        removeUser(u.id);
                    }}
                    className="size-7 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          {list.length === 0 && (
            <div className="px-4 py-10 text-center text-muted-foreground text-sm">
              No users match your filters.
            </div>
          )}
        </Card>
      </div>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        width="max-w-xl"
        title={editing === 'new' ? 'Add User' : 'Edit User'}
      >
        {editing && (
          <UserForm
            initial={editing === 'new' ? undefined : editing}
            onSave={(data) => {
              if (editing === 'new') addUser(data);
              else updateUser(editing.id, data);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

function SecurityCard() {
  const autoLockMinutes = useAuth((s) => s.autoLockMinutes);
  const setAutoLockMinutes = useAuth((s) => s.setAutoLockMinutes);
  const lock = useAuth((s) => s.lock);

  const options = [0, 5, 15, 30, 60];

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground shrink-0">
          <Lock className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Auto-lock</div>
          <div className="text-xs text-muted-foreground mb-2">
            Lock the screen after a period of inactivity. Unlock with your PIN.
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {options.map((m) => (
              <button
                key={m}
                onClick={() => setAutoLockMinutes(m)}
                className={cn(
                  'h-8 px-3 rounded-md border text-xs font-medium transition',
                  autoLockMinutes === m
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-secondary',
                )}
              >
                {m === 0 ? 'Never' : `${m} min`}
              </button>
            ))}
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={lock}>
              <Lock className="size-3.5" /> Lock now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function BranchList({ ids }: { ids: string[] }) {
  const branches = useBranches((s) => s.items);
  if (ids.length === 0) {
    return <div className="text-xs text-muted-foreground italic">All branches</div>;
  }
  const names = ids.map((id) => branches.find((b) => b.id === id)?.name ?? id);
  return (
    <div className="text-xs flex flex-wrap gap-1">
      {names.slice(0, 2).map((n, i) => (
        <span key={i} className="inline-flex items-center px-1.5 h-5 rounded bg-secondary text-secondary-foreground">
          {n}
        </span>
      ))}
      {names.length > 2 && (
        <span className="text-muted-foreground">+{names.length - 2}</span>
      )}
    </div>
  );
}

function UserForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: User;
  onSave: (data: Omit<User, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}) {
  const roles = useUsers((s) => s.roles);
  const branches = useBranches((s) => s.items);
  const [name, setName] = useState(initial?.name ?? '');
  const [username, setUsername] = useState(initial?.username ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [pin, setPin] = useState(initial?.pin ?? '');
  const [roleId, setRoleId] = useState(initial?.roleId ?? roles[0]?.id ?? '');
  const [branchIds, setBranchIds] = useState<string[]>(initial?.branchIds ?? []);
  const [status, setStatus] = useState<UserStatus>(initial?.status ?? 'active');
  const [allBranches, setAllBranches] = useState((initial?.branchIds.length ?? 0) === 0);

  const isValid = name.trim() && username.trim() && roleId;

  const toggleBranch = (id: string) => {
    setBranchIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  };

  const submit = () => {
    if (!isValid) return;
    onSave({
      name: name.trim(),
      username: username.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      pin: pin.trim() || undefined,
      passwordSet: initial?.passwordSet ?? false,
      roleId,
      branchIds: allBranches ? [] : branchIds,
      status,
      lastLoginAt: initial?.lastLoginAt,
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
          <Field label="Full name" required>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Username" required>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rana"
            />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="PIN (4-6 digits)">
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="e.g. 1234"
              className="font-mono"
            />
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as UserStatus)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </Field>
          <Field label="Role" required className="md:col-span-2">
            <div className="grid grid-cols-2 gap-2">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoleId(r.id)}
                  className={cn(
                    'rounded-md border p-2 text-left transition',
                    roleId === r.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  <div className="text-sm font-semibold inline-flex items-center gap-1">
                    <Shield className="size-3" /> {r.name}
                  </div>
                  {r.description && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">{r.description}</div>
                  )}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            Branches assigned
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={allBranches}
              onChange={(e) => setAllBranches(e.target.checked)}
            />
            All branches
          </label>
          {!allBranches && (
            <div className="grid grid-cols-2 gap-1">
              {branches.map((b) => (
                <label
                  key={b.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={branchIds.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                  />
                  <span className="truncate">{b.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid}>
          <Save className="size-4" /> {initial ? 'Save Changes' : 'Add User'}
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
