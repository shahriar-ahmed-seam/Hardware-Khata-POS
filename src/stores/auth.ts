import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import { useUsers, type User } from '@/stores/users';

/**
 * Auth / session store.
 *
 * BACKEND-ONLY: login/unlock/logout are verified in the MAIN process against
 * bcrypt hashes. The main process holds the real session in memory and gates
 * every write at the IPC boundary. This store mirrors the resolved permissions
 * for optional UI hiding via `can()` — but the REAL gate is the IPC layer, not
 * this store. There is NO client-side secret comparison: if the backend bridge
 * is missing, every login/unlock attempt REJECTS with the api() error.
 *
 * App boot resolves to one of four states:
 *   - first-run  : no setup completed yet → show First-Run Wizard
 *   - logged-out : setup done, no active session → show Login
 *   - locked     : session exists but screen is locked → show Lock screen
 *   - active     : fully authenticated → show the app
 *
 * SESSION PERSISTENCE: we persist ONLY setupComplete + autoLockMinutes. The
 * "logged in" state is never persisted across process restarts (main-process
 * memory resets on restart, so the user re-signs-in — that's correct/secure).
 */
export type AuthPhase = 'first-run' | 'logged-out' | 'locked' | 'active';

interface SessionLoginResult {
  user: { id: string; role_id: string } & Record<string, unknown>;
  permissions: string[];
}

interface AuthState {
  setupComplete: boolean;
  currentUserId: string | null;
  locked: boolean;
  lastActivityAt: number;
  autoLockMinutes: number; // 0 = never
  permissions: string[]; // resolved permissions for the signed-in user
  // derived
  phase: () => AuthPhase;
  currentUser: () => User | null;
  can: (permission: string) => boolean;
  // actions
  completeSetup: (adminUserId: string) => void;
  /**
   * Backend first-run path: apply the session returned by `setup.complete`
   * (the IPC layer already established the owner session in main memory).
   */
  completeSetupBackend: (result: { user: { id: string }; permissions: string[] }) => void;
  loginWithPin: (userId: string, pin: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithPassword: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string; userId?: string }>;
  logout: () => void;
  lock: () => void;
  unlockWithPin: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  /** Boot-time: under backend, restore the session main still holds (or clear). */
  restoreSession: () => Promise<void>;
  touch: () => void;
  setAutoLockMinutes: (m: number) => void;
  // dev / first-run reset
  resetAll: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      setupComplete: false,
      currentUserId: null,
      locked: false,
      lastActivityAt: Date.now(),
      autoLockMinutes: 15,
      permissions: [],

      phase: () => {
        const s = get();
        if (!s.setupComplete) return 'first-run';
        if (!s.currentUserId) return 'logged-out';
        if (s.locked) return 'locked';
        return 'active';
      },

      currentUser: () => {
        const id = get().currentUserId;
        if (!id) return null;
        return useUsers.getState().users.find((u) => u.id === id) ?? null;
      },

      /**
       * Permission membership check for OPTIONAL UI hiding. Admin (ALL_PERMISSIONS)
       * passes everything. The IPC layer is the authoritative gate — this only
       * decides what the UI shows.
       */
      can: (permission) => {
        const perms = get().permissions;
        if (perms.length > 0) return perms.includes(permission);
        // Pre-restore fallback: derive from the signed-in user's role row.
        const user = get().currentUser();
        if (!user) return false;
        const role = useUsers.getState().roles.find((r) => r.id === user.roleId);
        return !!role && role.permissions.includes(permission);
      },

      completeSetup: (adminUserId) =>
        set({ setupComplete: true, currentUserId: adminUserId, locked: false, lastActivityAt: Date.now() }),

      completeSetupBackend: (result) =>
        set({
          setupComplete: true,
          currentUserId: result.user.id,
          permissions: result.permissions ?? [],
          locked: false,
          lastActivityAt: Date.now(),
        }),

      // PIN is verified ONLY by the main process (bcrypt). No local comparison.
      loginWithPin: async (userId, pin) => {
        try {
          const res = await api<SessionLoginResult>('session.login', {
            mode: 'pin',
            userId,
            secret: pin,
          });
          set({
            currentUserId: res.user.id,
            permissions: res.permissions ?? [],
            locked: false,
            lastActivityAt: Date.now(),
          });
          void useUsers.getState().hydrate();
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Login failed' };
        }
      },

      // Password is verified ONLY by the main process (bcrypt). No local comparison.
      loginWithPassword: async (username, password) => {
        try {
          const res = await api<SessionLoginResult>('session.login', {
            mode: 'password',
            username: username.trim(),
            secret: password,
          });
          set({
            currentUserId: res.user.id,
            permissions: res.permissions ?? [],
            locked: false,
            lastActivityAt: Date.now(),
          });
          void useUsers.getState().hydrate();
          return { ok: true, userId: res.user.id };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Login failed' };
        }
      },

      logout: () => {
        void api('session.logout').catch(() => {});
        set({ currentUserId: null, locked: false, permissions: [] });
      },

      lock: () => {
        if (get().currentUserId) set({ locked: true });
      },

      // Unlock is verified ONLY by the main process against the live session.
      unlockWithPin: async (pin) => {
        try {
          await api('session.unlock', { pin });
          set({ locked: false, lastActivityAt: Date.now() });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Incorrect PIN' };
        }
      },

      restoreSession: async () => {
        // Reconcile setupComplete against the backend's run-once latch FIRST.
        // The DATABASE is the source of truth, and the reconciliation runs BOTH
        // ways:
        //   backend complete   + local not → adopt true  (returning user sees
        //                                                 Login, not the wizard)
        //   backend NOT complete + local true → adopt false (the database was
        //     reset/replaced, so the stale localStorage latch must not strand
        //     the user on a Login screen for accounts that no longer exist)
        // A failed call leaves the local value alone — we only trust a definite
        // answer, never a transport error.
        try {
          const status = await api<{ complete: boolean }>('setup.status');
          if (typeof status?.complete === 'boolean' && status.complete !== get().setupComplete) {
            set({
              setupComplete: status.complete,
              // Dropping into first-run must not keep a stale identity around.
              ...(status.complete ? {} : { currentUserId: null, locked: false, permissions: [] }),
            });
          }
        } catch {
          /* ignore — fall through to session restore */
        }
        try {
          const res = await api<SessionLoginResult | null>('session.current');
          if (res && res.user) {
            set({ currentUserId: res.user.id, permissions: res.permissions ?? [] });
          } else {
            // Main holds no session (e.g. after a real restart). Do not present a
            // "logged in" UI that the IPC layer would then deny writes for.
            set({ currentUserId: null, locked: false, permissions: [] });
          }
        } catch {
          set({ currentUserId: null, locked: false, permissions: [] });
        }
      },

      touch: () => set({ lastActivityAt: Date.now() }),
      setAutoLockMinutes: (m) => set({ autoLockMinutes: Math.max(0, m) }),

      resetAll: () =>
        set({
          setupComplete: false,
          currentUserId: null,
          locked: false,
          permissions: [],
          lastActivityAt: Date.now(),
        }),
    }),
    {
      name: 'pos-auth',
      // v2: drops the pre-mock-removal latch. `restoreSession()` reconciles
      // `setupComplete` against the database on every boot anyway, so this is
      // belt-and-braces for a wiped/replaced DB.
      version: 2,
      // NEVER persist a "logged in" state across process restarts: the main
      // process owns the session and resets it on restart. Only the first-run
      // latch and the auto-lock preference survive.
      partialize: (s) => ({
        setupComplete: s.setupComplete,
        autoLockMinutes: s.autoLockMinutes,
      }),
    },
  ),
);
