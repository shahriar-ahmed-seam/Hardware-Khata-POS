import { useAuth } from '@/stores/auth';

/**
 * WHO IS DOING THIS — the signed-in user.
 *
 * The stores used to send the constant `'u_admin'` and several screens the demo
 * owner's name, `'Seam'`, so every void, return and adjustment was recorded as the
 * owner's. The main process now stamps the real session user onto every write
 * (ACTOR_FIELDS in electron/guard.ts), so what the renderer sends is ignored —
 * these helpers exist so the renderer's own copy (optimistic rows, receipts)
 * names the same person the database will.
 *
 * Read at CALL time, never captured at module load: the user changes on every
 * sign-in.
 */
export function currentUserId(): string {
  return useAuth.getState().currentUserId ?? '';
}

/** The signed-in user's display name, or '' when nobody is signed in. */
export function currentUserName(): string {
  return useAuth.getState().currentUser()?.name ?? '';
}
