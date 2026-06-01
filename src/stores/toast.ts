import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  description?: string;
  duration: number; // ms; 0 = sticky
  action?: ToastAction;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id' | 'createdAt'>) => string;
  dismiss: (id: string) => void;
  update: (id: string, patch: Partial<Toast>) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = 'tst_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    set((s) => ({ toasts: [...s.toasts, { ...t, id, createdAt: Date.now() }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  update: (id, patch) =>
    set((s) => ({ toasts: s.toasts.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
  clear: () => set({ toasts: [] }),
}));

const DEFAULT_DURATION = 4000;

interface PushOpts {
  description?: string;
  duration?: number;
  action?: ToastAction;
}

/**
 * Imperative toast API usable anywhere (including outside React components).
 *
 *   toast.success('Saved');
 *   toast.error('Failed to save', { description: err.message });
 *   await toast.promise(saveFn(), { loading: 'Saving…', success: 'Saved', error: 'Failed' });
 */
export const toast = {
  success: (message: string, opts?: PushOpts) =>
    useToastStore.getState().push({
      variant: 'success',
      message,
      duration: opts?.duration ?? DEFAULT_DURATION,
      description: opts?.description,
      action: opts?.action,
    }),
  error: (message: string, opts?: PushOpts) =>
    useToastStore.getState().push({
      variant: 'error',
      message,
      duration: opts?.duration ?? 6000,
      description: opts?.description,
      action: opts?.action,
    }),
  info: (message: string, opts?: PushOpts) =>
    useToastStore.getState().push({
      variant: 'info',
      message,
      duration: opts?.duration ?? DEFAULT_DURATION,
      description: opts?.description,
      action: opts?.action,
    }),
  warning: (message: string, opts?: PushOpts) =>
    useToastStore.getState().push({
      variant: 'warning',
      message,
      duration: opts?.duration ?? 5000,
      description: opts?.description,
      action: opts?.action,
    }),
  loading: (message: string, opts?: PushOpts) =>
    useToastStore.getState().push({
      variant: 'loading',
      message,
      duration: 0,
      description: opts?.description,
    }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
  async promise<T>(
    p: Promise<T>,
    msgs: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string) },
  ): Promise<T> {
    const store = useToastStore.getState();
    const id = store.push({ variant: 'loading', message: msgs.loading, duration: 0 });
    try {
      const v = await p;
      store.update(id, {
        variant: 'success',
        message: typeof msgs.success === 'function' ? msgs.success(v) : msgs.success,
        duration: DEFAULT_DURATION,
      });
      scheduleAutoDismiss(id, DEFAULT_DURATION);
      return v;
    } catch (e) {
      store.update(id, {
        variant: 'error',
        message: typeof msgs.error === 'function' ? msgs.error(e) : msgs.error,
        duration: 6000,
      });
      scheduleAutoDismiss(id, 6000);
      throw e;
    }
  },
};

function scheduleAutoDismiss(id: string, duration: number) {
  if (duration > 0) {
    setTimeout(() => useToastStore.getState().dismiss(id), duration);
  }
}
