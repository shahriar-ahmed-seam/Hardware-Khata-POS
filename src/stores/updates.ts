import { create } from 'zustand';
import { api, hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';

/**
 * IN-APP UPDATES (renderer store)
 *
 * Thin client over the `update.*` channels. It holds NO opinion of its own: the
 * phase always comes from the main process, either as the reply to a command or
 * as a push on `window.api.updates.onState`. A store that guessed the phase would
 * eventually tell the owner a download had finished when it had not.
 *
 * See electron/updater.ts for why the download is never automatic.
 */

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error'
  /** Running from `npm run dev`, or otherwise not an installed build. */
  | 'unsupported';

export interface UpdateState {
  phase: UpdatePhase;
  currentVersion: string;
  newVersion?: string;
  releaseNotes?: string;
  releaseDate?: string;
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  error?: string;
  lastCheckedAt?: string;
  autoCheck: boolean;
}

const EMPTY: UpdateState = {
  phase: 'unsupported',
  currentVersion: '—',
  autoCheck: true,
};

interface Store {
  state: UpdateState;
  /** True while a command is in flight (check / download / install). */
  busy: boolean;
  hydrate: () => Promise<void>;
  /** Subscribe to main-process pushes. Returns an unsubscribe function. */
  subscribe: () => () => void;
  check: () => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
  setAutoCheck: (autoCheck: boolean) => Promise<void>;
  openReleases: () => Promise<void>;
}

function msg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export const useUpdates = create<Store>((set, get) => ({
  state: { ...EMPTY },
  busy: false,

  hydrate: async () => {
    if (!hasBackend()) return;
    try {
      set({ state: await api<UpdateState>('update.state', {}) });
    } catch {
      // A denied read (no session yet) is not worth a toast on every page load.
    }
  },

  subscribe: () => {
    const bridge = typeof window !== 'undefined' ? window.api?.updates : undefined;
    if (!bridge) return () => {};
    return bridge.onState((next) => set({ state: next as UpdateState }));
  },

  check: async () => {
    set({ busy: true });
    try {
      const next = await api<UpdateState>('update.check', {});
      set({ state: next });
      if (next.phase === 'up-to-date') toast.success('You are on the latest version');
      else if (next.phase === 'available') toast.info(`Version ${next.newVersion} is available`);
      else if (next.phase === 'error') toast.error('Could not check for updates', { description: next.error });
    } catch (e) {
      toast.error(msg(e, 'Could not check for updates'));
    } finally {
      set({ busy: false });
    }
  },

  download: async () => {
    set({ busy: true });
    try {
      const next = await api<UpdateState>('update.download', {});
      set({ state: next });
      if (next.phase === 'error') {
        toast.error('Download failed', { description: next.error });
      }
    } catch (e) {
      toast.error(msg(e, 'Download failed'));
    } finally {
      set({ busy: false });
    }
  },

  install: async () => {
    set({ busy: true });
    try {
      const res = await api<{ ok: boolean; error?: string }>('update.install', {});
      // On success the app is already closing, so there is nothing to render.
      if (!res.ok) toast.error(res.error ?? 'Could not start the installer');
    } catch (e) {
      toast.error(msg(e, 'Could not start the installer'));
    } finally {
      set({ busy: false });
    }
  },

  setAutoCheck: async (autoCheck) => {
    try {
      set({ state: await api<UpdateState>('update.setPrefs', { autoCheck }) });
      toast.success(autoCheck ? 'Automatic update checks on' : 'Automatic update checks off');
    } catch (e) {
      toast.error(msg(e, 'Could not save the setting'));
      await get().hydrate();
    }
  },

  openReleases: async () => {
    try {
      await api('update.openReleases', {});
    } catch (e) {
      toast.error(msg(e, 'Could not open the downloads page'));
    }
  },
}));
