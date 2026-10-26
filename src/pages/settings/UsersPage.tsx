import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Search, Save, Shield, KeyRound, Lock } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDateFormat } from '@/lib/formatDate';
import { useUsers, type User, type UserStatus } from '@/stores/users';
import { useBranches } from '@/stores/branches';
import { useAuth } from '@/stores/auth';
import { confirm } from '@/stores/confirm';
import { cn } from '@/lib/utils';

/** Hide search and filters for a short list: they only add clutter. */
const FILTER_MIN = 8;

export default function UsersPage() {
  const users = useUsers((s) => s.users);
  const roles = useUsers((s) => s.roles);
  const addUser = useUsers((s) => s.addUser);
  const updateUser = useUsers((s) => s.updateUser);
  const removeUser = useUsers((s) => s.removeUser);
  const hydrate = useUsers((s) => s.hydrate);
  const hydrateBranches = useBranches((s) => s.hydrate);
  const me = useAuth((s) => s.currentUserId);
  const { dateTime } = useDateFormat();

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

  return (
    <div>
      <SettingsHeader
        title="Users & PINs"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add User
          </Button>
        }
      />

      <div className="p-6 max-w-6xl space-y-4">
        {users.length > FILTER_MIN && (
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
            <Select
              aria-label="Role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-auto"
            >
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatus | '')}
              className="w-auto"
            >
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>
        </Card>
        )}

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1.2fr_1fr_auto] gap-3 px-4 py-2.5 border-b border-border bg-secondary/40 text-xs font-medium text-muted-foreground">
            <div>User</div>
            <div>Role</div>
            <div>Branches</div>
            <div>Last login</div>
            <div className="w-[8.5rem]" />
          </div>
          {list.map((u) => {
            const role = roles.find((r) => r.id === u.roleId);
            // The owner account and the signed-in user cannot be deleted from here.
            const protectedUser = u.id === 'u_admin' || u.id === me;
            return (
              <div
                key={u.id}
                onClick={() => setEditing(u)}
                className="grid grid-cols-[2fr_1fr_1.2fr_1fr_auto] gap-3 items-center px-4 py-3 min-h-14 border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{u.name}</span>
                      {u.status === 'active' && <Badge variant="success">Active</Badge>}
                      {u.status === 'inactive' && <Badge variant="default">Inactive</Badge>}
                      {u.status === 'suspended' && <Badge variant="destructive">Suspended</Badge>}
                      {u.pin && (
                        <span title="PIN set" className="text-muted-foreground">
                          <KeyRound className="size-4" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      @{u.username}
                      {u.phone && <span className="ml-2 font-mono">{u.phone}</span>}
                      {u.email && <span className="ml-2">· {u.email}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-sm">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs">
                    <Shield className="size-3.5" /> {role?.name ?? '—'}
                  </div>
                </div>
                <BranchList ids={u.branchIds} />
                <div className="text-sm text-muted-foreground tabular" data-no-i18n={u.lastLoginAt ? true : undefined}>
                  {u.lastLoginAt ? dateTime(u.lastLoginAt) : 'Never'}
                </div>
                {/* Status (activate / deactivate) lives in the Edit drawer. */}
                <div className="flex items-center justify-end gap-2 w-[8.5rem]" onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" onClick={() => setEditing(u)}>
                    <Edit2 className="size-4" /> Edit
                  </Button>
                  {!protectedUser && (
                    <IconButton
                      label="Delete user"
                      tone="danger"
                      onClick={async () => {
                        if (await confirm({ title: 'Delete this user?', message: u.name, variant: 'destructive' }))
                          removeUser(u.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  )}
                </div>
              </div>
            );
          })}
          {list.length === 0 && (
            <EmptyState compact icon={Search} title="No users match your filters." />
          )}
        </Card>
        <SecurityCard />
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
            onSave={async (data) => {
              // Stays open on a refusal (a PIN that breaks the rule, the last
              // admin) so nothing typed is lost.
              const ok = editing === 'new' ? await addUser(data) : await updateUser(editing.id, data);
              if (ok) setEditing(null);
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
          <div className="flex items-center gap-3 flex-wrap">
            <Segmented
              ariaLabel="Auto-lock"
              value={String(autoLockMinutes)}
              onChange={(v) => setAutoLockMinutes(Number(v))}
              options={options.map((m) => ({
                value: String(m),
                label: m === 0 ? 'Never' : <span className="tabular">{m} min</span>,
              }))}
            />
            <div className="flex-1" />
            <Button variant="outline" onClick={lock}>
              <Lock className="size-4" /> Lock now
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
    return <div className="text-sm text-muted-foreground">All branches</div>;
  }
  const names = ids.map((id) => branches.find((b) => b.id === id)?.name ?? id);
  return (
    <div className="text-xs flex flex-wrap gap-1" data-no-i18n>
      {names.slice(0, 2).map((n, i) => (
        <span key={i} className="inline-flex items-center px-2 h-6 rounded bg-secondary text-secondary-foreground">
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
  onSave: (data: Omit<User, 'id' | 'createdAt'>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const roles = useUsers((s) => s.roles);
  const branches = useBranches((s) => s.items);
  const [name, setName] = useState(initial?.name ?? '');
  const [username, setUsername] = useState(initial?.username ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  // Never pre-filled: an empty box means "keep the PIN" on an existing user.
  const [pin, setPin] = useState('');
  const [roleId, setRoleId] = useState(initial?.roleId ?? roles[0]?.id ?? '');
  const [branchIds, setBranchIds] = useState<string[]>(initial?.branchIds ?? []);
  const [status, setStatus] = useState<UserStatus>(initial?.status ?? 'active');
  const [allBranches, setAllBranches] = useState((initial?.branchIds.length ?? 0) === 0);

  // A new user needs a PIN; an edited one keeps theirs when the box is empty.
  const pinOk = pin === '' ? !!initial : /^\d{4,6}$/.test(pin);
  const isValid = !!(name.trim() && username.trim() && roleId && pinOk);

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
          <FormField label="Full name" required>
            {(f) => <Input {...f} autoFocus value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label="Phone">
            {(f) => <Input {...f} value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </FormField>
          <FormField label="Username" required>
            {(f) => (
              <Input {...f} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. rana" />
            )}
          </FormField>
          <FormField
            label="PIN (4-6 digits)"
            required={!initial}
            hint={initial ? 'The current PIN stays if you leave this empty.' : undefined}
            error={pin !== '' && !pinOk ? 'PIN must be 4 to 6 digits' : undefined}
          >
            {/* Masked (B10): a PIN typed in plain view is a PIN the room knows. */}
            {(f) => (
              <Input
                {...f}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={initial ? 'Leave empty to keep the current PIN' : '4 to 6 digits'}
                className="font-mono tracking-widest"
              />
            )}
          </FormField>
          <FormField label="Email">
            {(f) => <Input {...f} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </FormField>
          <FormField label="Status">
            {(f) => (
              <Select {...f} value={status} onChange={(e) => setStatus(e.target.value as UserStatus)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </Select>
            )}
          </FormField>
          <FormField label="Role" required className="md:col-span-2">
            <div className="grid grid-cols-2 gap-2">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoleId(r.id)}
                  aria-pressed={roleId === r.id}
                  className={cn(
                    'rounded-md border p-2.5 text-left transition focus-ring',
                    roleId === r.id
                      ? 'border-primary ring-1 ring-primary bg-primary/10'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  <div className="text-sm font-semibold inline-flex items-center gap-1">
                    <Shield className={cn('size-4', roleId === r.id && 'text-primary')} /> {r.name}
                  </div>
                  {r.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>
                  )}
                </button>
              ))}
            </div>
          </FormField>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Branches assigned</div>
          <label className="flex items-center gap-2 py-1.5 text-sm cursor-pointer">
            <input
              className="size-5"
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
                  className="flex items-center gap-2 px-2 py-2.5 rounded hover:bg-secondary text-sm cursor-pointer"
                >
                  <input
                    className="size-5"
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
