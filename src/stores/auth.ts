import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, hasBackend } from '@/lib/api';
import { useUsers, type User } from '@/stores/users';

/**
 * Auth / session store.
 *
 * TWO MODES, one interface:
 *   - BACKEND (Electron): login/unlock/logout are verified in the MAIN process
 *     against bcrypt hashes. The main process holds the real session in memory
 *     and gates every write at the IPC boundary. This store mirrors the
 *     resolved permissions for optional UI hiding via `can()` — but the REAL
 *     gate is the IPC layer, not this store.
 *   - MOCK (browser dev, no backend): PINs/passwords are compared in plaintext
 *     against the users store, exactly as before. Nothing is enforced.
 *
 * App boot resolves to one of four states:
 *   - first-run  : no setup completed yet → show First-Run Wizard
 *   - logged-out : setup done, no active session → show Login
 *   - locked     : session exists but screen is locked → show Lock screen
 *   - active     : fully authenticated → show the app
 *
 * SESSION PERSISTENCE: under backend we persist ONLY setupComplete +
 * autoLockMinutes. The "logged in" state is never persisted across process
 * restarts (main-process memory resets on restart, so the user re-signs-in —
 * that's correct/secure). Under mock we also persist currentUserId + locked so
 * browser refreshes keep you signed in for convenience.
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
  permissions: string[]; // resolved permissions for the signed-in user (backend) or [] (mock)
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
       * passes everything. Under mock we resolve from the user's role in the users
       * store so the UI behaves; the IPC layer is the authoritative gate.
       */
      can: (permission) => {
        const perms = get().permissions;
        if (perms.length > 0) return perms.includes(permission);
        // Fallback (mock / pre-restore): derive from the current user's role.
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

      loginWithPin: async (userId, pin) => {
        if (hasBackend()) {
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
        }
        // ---- mock path (plaintext) ----
        const user = useUsers.getState().users.find((u) => u.id === userId);
        if (!user) return { ok: false, error: 'User not found' };
        if (user.status !== 'active') return { ok: false, error: 'Account is not active' };
        if (!user.pin) return { ok: false, error: 'No PIN set for this user' };
        if (user.pin !== pin) return { ok: false, error: 'Incorrect PIN' };
        useUsers.getState().updateUser(user.id, { lastLoginAt: new Date().toISOString() });
        set({ currentUserId: user.id, locked: false, lastActivityAt: Date.now() });
        return { ok: true };
      },

      loginWithPassword: async (username, password) => {
        if (hasBackend()) {
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
        }
        // ---- mock path (plaintext) ----
        const user = useUsers
          .getState()
          .users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
        if (!user) return { ok: false, error: 'User not found' };
        if (user.status !== 'active') return { ok: false, error: 'Account is not active' };
        // Mock: accept the PIN as the password too, or a fixed dev password.
        const accepted = (user.pin && password === user.pin) || password === 'admin123';
        if (!accepted) return { ok: false, error: 'Incorrect password' };
        useUsers.getState().updateUser(user.id, { lastLoginAt: new Date().toISOString() });
        set({ currentUserId: user.id, locked: false, lastActivityAt: Date.now() });
        return { ok: true, userId: user.id };
      },

      logout: () => {
        if (hasBackend()) void api('session.logout').catch(() => {});
        set({ currentUserId: null, locked: false, permissions: [] });
      },

      lock: () => {
        if (get().currentUserId) set({ locked: true });
      },

      unlockWithPin: async (pin) => {
        if (hasBackend()) {
          try {
            await api('session.unlock', { pin });
            set({ locked: false, lastActivityAt: Date.now() });
            return { ok: true };
          } catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : 'Incorrect PIN' };
          }
        }
        // ---- mock path (plaintext) ----
        const user = get().currentUser();
        if (!user) return { ok: false, error: 'No session' };
        if (!user.pin) return { ok: false, error: 'No PIN set' };
        if (user.pin !== pin) return { ok: false, error: 'Incorrect PIN' };
        set({ locked: false, lastActivityAt: Date.now() });
        return { ok: true };
      },

      restoreSession: async () => {
        if (!hasBackend()) return;
        // Reconcile setupComplete from the backend's run-once latch FIRST. After
        // a real restart (or if localStorage was cleared), the backend is the
        // source of truth for whether first-run already happened. If the backend
        // says setup is complete, force setupComplete=true so a returning user
        // sees Login — NOT the wizard again. (We never flip it back to false
        // here: a backend without the flag yet shouldn't undo a local mock run.)
        try {
          const status = await api<{ complete: boolean }>('setup.status');
          if (status?.complete && !get().setupComplete) {
            set({ setupComplete: true });
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
      // Under backend, NEVER persist a "logged in" state across process restarts:
      // the main process owns the session and resets it on restart. Under mock we
      // persist currentUserId + locked so browser refreshes stay signed in.
      partialize: (s) =>
        hasBackend()
          ? {
              setupComplete: s.setupComplete,
              autoLockMinutes: s.autoLockMinutes,
            }
          : {
              setupComplete: s.setupComplete,
              currentUserId: s.currentUserId,
              locked: s.locked,
              autoLockMinutes: s.autoLockMinutes,
            },
    },
  ),
);
