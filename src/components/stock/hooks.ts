import { useEffect } from 'react';
import { useUsers } from '@/stores/users';
import { useBranches } from '@/stores/branches';
import { humanizeKey } from '@/lib/labels';

/** User id → display name (falls back to a readable id, never `u_admin`). */
export function useUserNameOf() {
  const users = useUsers((s) => s.users);
  const hydrate = useUsers((s) => s.hydrate);
  useEffect(() => {
    if (users.length === 0) void hydrate();
  }, [users.length, hydrate]);
  return (id: string | undefined) =>
    !id ? '—' : (users.find((u) => u.id === id)?.name ?? humanizeKey(id.replace(/^u_/, '')));
}

/** Owner decision #5: branch-only UI (transfers, Branch fields) shows with ≥ 2 active branches. */
export function useIsMultiBranch() {
  const branches = useBranches((s) => s.items);
  const hydrate = useBranches((s) => s.hydrate);
  useEffect(() => {
    if (branches.length === 0) void hydrate();
  }, [branches.length, hydrate]);
  return branches.filter((b) => b.active !== false).length > 1;
}
