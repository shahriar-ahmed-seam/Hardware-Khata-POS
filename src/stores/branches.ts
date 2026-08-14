import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
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
      items: [],
      loading: false,

      /** Load branches from the backend — the only source of branch rows. */
      hydrate: async () => {
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
        // NOTE: the real backend id only arrives after rehydrate (optimistic id here).
        const item: Branch = {
          id: 'br_' + Date.now(),
          active: true,
          ...data,
        };
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
      },

      update: (id, patch) => {
        void api('branches.update', { id, patch })
          .then(() => get().hydrate())
          .catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Failed to update branch');
            void get().hydrate();
          });
      },

      remove: (id) => {
        void api('branches.delete', { id })
          .then(() => get().hydrate())
          .catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Failed to delete branch');
            void get().hydrate();
          });
      },

      setDefault: (id) => {
        void api('branches.setDefault', { id })
          .then(() => get().hydrate())
          .catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Failed to set default branch');
            void get().hydrate();
          });
      },
    }),
    // v2: drops cached demo branches (Mirpur/Uttara/Dhanmondi). `hydrate()`
    // refills from `branches.list`.
    { name: 'pos-branches', version: 2 },
  ),
);
