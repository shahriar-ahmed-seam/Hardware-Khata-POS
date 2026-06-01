import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, Shield, Lock, Check, Edit2 } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  useUsers,
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  type Role,
} from '@/stores/users';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

export default function RolesPage() {
  const roles = useUsers((s) => s.roles);
  const users = useUsers((s) => s.users);
  const addRole = useUsers((s) => s.addRole);
  const updateRole = useUsers((s) => s.updateRole);
  const removeRole = useUsers((s) => s.removeRole);
  const togglePerm = useUsers((s) => s.toggleRolePermission);
  const setRolePerms = useUsers((s) => s.setRolePermissions);
  const hydrate = useUsers((s) => s.hydrate);

  const [activeRoleId, setActiveRoleId] = useState<string>(roles[0]?.id ?? '');
  const [creating, setCreating] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Role | null>(null);

  useEffect(() => void hydrate(), [hydrate]);

  // Once roles load (or change), keep a valid active selection.
  useEffect(() => {
    if (!roles.find((r) => r.id === activeRoleId)) {
      setActiveRoleId(roles[0]?.id ?? '');
    }
  }, [roles, activeRoleId]);

  const activeRole = roles.find((r) => r.id === activeRoleId);

  const userCountByRole = useMemo(() => {
    const m: Record<string, number> = {};
    users.forEach((u) => {
      m[u.roleId] = (m[u.roleId] ?? 0) + 1;
    });
    return m;
  }, [users]);

  const toggleGroup = (groupId: string) => {
    if (!activeRole) return;
    const group = PERMISSION_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    const ids = group.actions.map((a) => a.id);
    const allOn = ids.every((id) => activeRole.permissions.includes(id));
    const next = allOn
      ? activeRole.permissions.filter((p) => !ids.includes(p))
      : Array.from(new Set([...activeRole.permissions, ...ids]));
    setRolePerms(activeRole.id, next);
  };

  return (
    <div>
      <SettingsHeader
        title="Roles & Permissions"
        subtitle="What each role can do"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add Role
          </Button>
        }
      />

      <div className="p-6 max-w-6xl">
        <div className="grid grid-cols-[260px_1fr] gap-4">
          {/* Roles list */}
          <Card className="overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              Roles ({roles.length})
            </div>
            {roles.map((r) => {
              const isActive = r.id === activeRoleId;
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveRoleId(r.id)}
                  className={cn(
                    'w-full text-left px-3 py-3 border-b border-border last:border-b-0 transition',
                    isActive ? 'bg-primary/10' : 'hover:bg-secondary/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Shield
                      className={cn(
                        'size-4 shrink-0',
                        isActive ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                    <span className={cn('text-sm font-semibold truncate', isActive && 'text-primary')}>
                      {r.name}
                    </span>
                    {r.isSystem && <Lock className="size-3 text-muted-foreground" />}
                  </div>
                  {r.description && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {r.description}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant="default">
                      {r.permissions.length}/{ALL_PERMISSIONS.length} perms
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {userCountByRole[r.id] ?? 0} users
                    </span>
                  </div>
                </button>
              );
            })}
          </Card>

          {/* Permissions matrix */}
          {activeRole ? (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-primary" />
                    <span className="font-semibold">{activeRole.name}</span>
                    {activeRole.isSystem && (
                      <Badge variant="info">
                        <Lock className="size-3" /> System
                      </Badge>
                    )}
                  </div>
                  {activeRole.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {activeRole.description}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingMeta(activeRole)}
                    className="size-8 grid place-items-center rounded hover:bg-secondary text-muted-foreground"
                    title="Edit name / description"
                  >
                    <Edit2 className="size-3.5" />
                  </button>
                  {!activeRole.isSystem && (
                    <button
                      onClick={async () => {
                        if ((userCountByRole[activeRole.id] ?? 0) > 0) {
                          toast.error(
                            `Cannot delete: ${userCountByRole[activeRole.id]} users are assigned to this role`,
                          );
                          return;
                        }
                        if (await confirm({ title: `Delete role "${activeRole.name}"?`, variant: 'destructive' })) {
                          removeRole(activeRole.id);
                          setActiveRoleId(roles[0]?.id ?? '');
                        }
                      }}
                      className="size-8 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive"
                      title="Delete role"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="px-4 py-2 border-b border-border bg-secondary/30 flex items-center gap-2 flex-wrap text-[12px]">
                <span className="text-muted-foreground">Quick:</span>
                <button
                  onClick={() => setRolePerms(activeRole.id, ALL_PERMISSIONS)}
                  className="px-2 h-6 rounded border border-border hover:bg-secondary"
                >
                  Grant all
                </button>
                <button
                  onClick={() => setRolePerms(activeRole.id, [])}
                  className="px-2 h-6 rounded border border-border hover:bg-secondary"
                >
                  Revoke all
                </button>
                <span className="ml-auto text-muted-foreground">
                  {activeRole.permissions.length} of {ALL_PERMISSIONS.length} permissions enabled
                </span>
              </div>

              <div className="divide-y divide-border max-h-[60vh] overflow-auto">
                {PERMISSION_GROUPS.map((group) => {
                  const ids = group.actions.map((a) => a.id);
                  const onCount = ids.filter((id) => activeRole.permissions.includes(id)).length;
                  const allOn = onCount === ids.length;
                  const someOn = onCount > 0 && !allOn;
                  return (
                    <div key={group.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleGroup(group.id)}
                            className={cn(
                              'size-4 rounded border-2 grid place-items-center transition',
                              allOn
                                ? 'bg-primary border-primary text-primary-foreground'
                                : someOn
                                  ? 'bg-primary/40 border-primary'
                                  : 'border-muted-foreground/40',
                            )}
                          >
                            {allOn && <Check className="size-3" />}
                            {someOn && <span className="size-1.5 bg-primary-foreground rounded" />}
                          </button>
                          <span className="text-sm font-semibold">{group.label}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {onCount}/{ids.length}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 pl-6">
                        {group.actions.map((a) => {
                          const checked = activeRole.permissions.includes(a.id);
                          return (
                            <label
                              key={a.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-secondary/50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePerm(activeRole.id, a.id)}
                                className="accent-primary"
                              />
                              <span className={cn('truncate', checked ? '' : 'text-muted-foreground')}>
                                {a.label}
                              </span>
                              <span className="ml-auto text-[10px] font-mono text-muted-foreground/60">
                                {a.id}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center text-sm text-muted-foreground">Select a role.</Card>
          )}
        </div>
      </div>

      {/* Create role modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Add Role" width="max-w-md">
        <RoleMetaForm
          onSave={(d) => {
            const r = addRole({
              name: d.name,
              description: d.description,
              permissions: [],
            });
            setActiveRoleId(r.id);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      {/* Edit role meta modal */}
      <Modal
        open={!!editingMeta}
        onClose={() => setEditingMeta(null)}
        title="Edit Role"
        width="max-w-md"
      >
        {editingMeta && (
          <RoleMetaForm
            initial={editingMeta}
            onSave={(d) => {
              updateRole(editingMeta.id, { name: d.name, description: d.description });
              setEditingMeta(null);
            }}
            onCancel={() => setEditingMeta(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function RoleMetaForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Role;
  onSave: (d: { name: string; description?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), description: description.trim() || undefined });
      }}
      className="flex flex-col gap-3 p-4"
    >
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
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          <Save className="size-4" /> Save
        </Button>
      </div>
    </form>
  );
}
