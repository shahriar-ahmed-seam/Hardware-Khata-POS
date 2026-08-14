import { useAuth } from '@/stores/auth';

/**
 * "May the signed-in user do this?" for hiding or disabling UI.
 *
 * THIS IS NOT SECURITY. The authoritative gate is the IPC boundary
 * (electron/ipc.ts + electron/permissions.ts), which checks the session held in
 * the main process on every single call. This hook only decides what the screen
 * shows, so a cashier is not staring at an Edit button that will refuse them.
 *
 * It subscribes to `permissions`, so the UI re-evaluates when the signed-in user
 * changes (a shift handover on a shared counter PC is the normal case). The
 * fallback to the store's role-derived `can()` covers the brief window before
 * `session.current` has been restored on boot.
 */
export function useCan(permission: string): boolean {
  const permissions = useAuth((s) => s.permissions);
  if (permissions.length > 0) return permissions.includes(permission);
  return useAuth.getState().can(permission);
}

/**
 * Several permissions at once, so a component subscribes to the store once
 * instead of calling `useCan` in a loop.
 *
 *   const can = useCanAll(['products.edit', 'products.delete']);
 *   if (can['products.delete']) { ... }
 */
export function useCanAll<T extends readonly string[]>(
  wanted: T,
): Record<T[number], boolean> {
  const permissions = useAuth((s) => s.permissions);
  const out = {} as Record<T[number], boolean>;
  for (const p of wanted) {
    out[p as T[number]] =
      permissions.length > 0 ? permissions.includes(p) : useAuth.getState().can(p);
  }
  return out;
}
