import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';
import { toBranch, type BackendBranch } from '@/hooks/settingsAdapter';

export interface Branch {
  id: string;
  name: string;
  code?: string; // BL0001 style code
  address?: string;
  phonePrimary?: string;
  phoneAlt?: string;
  manager?: string;
  isDefault?: boolean;
  active?: boolean;
}

const CURRENT_USER = 'u_admin';

const SEED: Branch[] = [
  {
    id: 'br_mp',
    name: 'Mirpur Branch',
    code: 'BL0001',
    address: 'Mirpur 10, Dhaka',
    phonePrimary: '01711-000001',
    manager: 'Seam',
    isDefault: true,
    active: true,
  },
  {
    id: 'br_ut',
    name: 'Uttara Branch',
    code: 'BL0002',
    address: 'Uttara Sector 7, Dhaka',
    phonePrimary: '01711-000002',
    manager: 'Faruq',
    active: true,
  },
  {
    id: 'br_dh',
    name: 'Dhanmondi Branch',
    code: 'BL0003',
    address: 'Dhanmondi 27, Dhaka',
    phonePrimary: '01711-000003',
    active: false,
  },
];

interface State {
  items: Branch[];
  loading: boolean;
  hydrate: () => Promise<void>;
  add: (data: Omit<Branch, 'id'>) => Branch;
  update: (id: string, patch: Partial<Branch>) => void;
  remove: (id: string) => void;
  setDefault: (id: string) => void;
}

export const useBranches = create<State>()(
  persist(
    (set, get) => ({
      items: hasBackend() ? [] : [...SEED],
      loading: false,

      /** Load branches from the backend. No-op without backend (keeps persisted/seed). */
      hydrate: async () => {
        if (!hasBackend()) return;
        set({ loading: true });
        try {
          const list = await api<BackendBranch[]>('branches.list', {});
          set({ items: list.map(toBranch), loading: false });
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Failed to load branches');
          set({ loading: false });
        }
      },

      add: (data) => {
        // Optimistic local object + synchronous return so inline callers keep working.
        const item: Branch = {
          id: 'br_' + Date.now(),
          active: true,
          ...data,
        };
        if (hasBackend()) {
          // NOTE: the real backend id only arrives after rehydrate (optimistic id here).
          void api('branches.create', {
            name: data.name,
            code: data.code,
            address: data.address,
            phonePrimary: data.phonePrimary,
            phoneAlt: data.phoneAlt,
            manager: data.manager,
            isDefault: data.isDefault,
            active: data.active,
            userId: CURRENT_USER,
          })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to save branch');
              void get().hydrate();
            });
          return item;
        }
        set((s) => ({ items: [...s.items, item] }));
        return item;
      },

      update: (id, patch) => {
        if (hasBackend()) {
          void api('branches.update', { id, patch })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to update branch');
              void get().hydrate();
            });
          return;
        }
        set((s) => ({ items: s.items.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
      },

      remove: (id) => {
        if (hasBackend()) {
          void api('branches.delete', { id })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to delete branch');
              void get().hydrate();
            });
          return;
        }
        set((s) => ({ items: s.items.filter((b) => b.id !== id) }));
      },

      setDefault: (id) => {
        if (hasBackend()) {
          void api('branches.setDefault', { id })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to set default branch');
              void get().hydrate();
            });
          return;
        }
        set((s) => ({
          items: s.items.map((b) => ({ ...b, isDefault: b.id === id })),
        }));
      },
    }),
    { name: 'pos-branches' },
  ),
);
