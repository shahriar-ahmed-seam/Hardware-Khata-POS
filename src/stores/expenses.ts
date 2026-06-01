import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';
import {
  resolveBranchId,
  toCategory,
  toExpense,
  type BackendExpense,
  type BackendExpenseCategory,
} from '@/hooks/expenseAdapter';
import { useCashRegister } from '@/stores/cashRegister';

export type ExpensePaymentMethod = 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank' | 'Cheque';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ExpenseCategory {
  id: string;
  name: string;
  parentId?: string;
  emoji?: string;
  monthlyBudget?: number;
}

export interface ExpenseRecord {
  id: string;
  refNo?: string;
  date: string;
  categoryId: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  reference?: string;
  note?: string;
  branch: string;
  user: string;
  attachmentName?: string;
  // Recurring
  recurring?: boolean;
  frequency?: RecurringFrequency;
  recurringEnd?: string;
  // Status
  voided?: boolean;
  voidReason?: string;
  createdAt?: string;
}

// Single-branch assumption for now (br_mp <-> 'Mirpur Branch'). See expenseAdapter.
const CURRENT_USER = 'u_admin';

const SEED_CATEGORIES: ExpenseCategory[] = [
  { id: 'ec_ops', name: 'Operations', emoji: '🏢' },
  { id: 'ec_rent', name: 'Rent', parentId: 'ec_ops', emoji: '🏠', monthlyBudget: 50000 },
  { id: 'ec_utilities', name: 'Utilities', parentId: 'ec_ops', emoji: '💡', monthlyBudget: 12000 },
  { id: 'ec_salary', name: 'Salary', parentId: 'ec_ops', emoji: '💼', monthlyBudget: 100000 },
  { id: 'ec_inventory', name: 'Inventory', emoji: '📦' },
  { id: 'ec_damage', name: 'Damage / Wastage', parentId: 'ec_inventory', emoji: '⚠️' },
  { id: 'ec_transport', name: 'Transport', emoji: '🚚', monthlyBudget: 8000 },
  { id: 'ec_marketing', name: 'Marketing', emoji: '📣' },
  { id: 'ec_misc', name: 'Misc', emoji: '🪙' },
];

const SEED_EXPENSES: ExpenseRecord[] = [
  {
    id: 'e_seed1',
    refNo: 'EXP-0042',
    date: '2026-05-26T11:00:00',
    categoryId: 'ec_rent',
    amount: 45000,
    paymentMethod: 'Bank',
    reference: 'BR-25/5',
    note: 'May 2026 Shop Rent',
    branch: 'Mirpur Branch',
    user: 'Seam',
    recurring: true,
    frequency: 'monthly',
  },
  {
    id: 'e_seed2',
    refNo: 'EXP-0041',
    date: '2026-05-25T10:00:00',
    categoryId: 'ec_salary',
    amount: 22000,
    paymentMethod: 'bKash',
    reference: 'BKS441223',
    note: 'Faruq - May Salary',
    branch: 'Mirpur Branch',
    user: 'Seam',
    recurring: true,
    frequency: 'monthly',
  },
  {
    id: 'e_seed3',
    refNo: 'EXP-0040',
    date: '2026-05-24T16:30:00',
    categoryId: 'ec_transport',
    amount: 3200,
    paymentMethod: 'Cash',
    note: 'Cement delivery van',
    branch: 'Mirpur Branch',
    user: 'Seam',
  },
  {
    id: 'e_seed4',
    refNo: 'EXP-0039',
    date: '2026-05-22T17:00:00',
    categoryId: 'ec_utilities',
    amount: 8400,
    paymentMethod: 'Bank',
    reference: 'TX UT-2205',
    note: 'Electricity bill',
    branch: 'Mirpur Branch',
    user: 'Seam',
  },
];

let counter = 100;
export function nextExpenseRef() {
  counter += 1;
  return `EXP-${String(counter).padStart(4, '0')}`;
}

interface State {
  categories: ExpenseCategory[];
  expenses: ExpenseRecord[];
  loading: boolean;

  hydrate: () => Promise<void>;

  // Categories CRUD
  addCategory: (data: Omit<ExpenseCategory, 'id'>) => ExpenseCategory;
  updateCategory: (id: string, patch: Partial<ExpenseCategory>) => void;
  removeCategory: (id: string) => void;

  // Expenses CRUD
  addExpense: (data: Omit<ExpenseRecord, 'id'>) => ExpenseRecord;
  updateExpense: (id: string, patch: Partial<ExpenseRecord>) => void;
  voidExpense: (id: string, reason?: string) => void;
  deleteExpense: (id: string) => void;
}

export const useExpenses = create<State>()(
  persist(
    (set, get) => ({
      // When the backend is present we start empty and let hydrate() REPLACE the
      // arrays from the DB (so stale persisted data is reconciled). Without a
      // backend we keep the mock seed data.
      categories: hasBackend() ? [] : [...SEED_CATEGORIES],
      expenses: hasBackend() ? [] : [...SEED_EXPENSES],
      loading: false,

      /**
       * Load categories + expenses from the backend. REPLACES the arrays so any
       * stale persisted data is reconciled. listExpenses filters voided=0 already.
       * No-op without backend.
       */
      hydrate: async () => {
        if (!hasBackend()) return;
        set({ loading: true });
        try {
          const [catRows, expRows] = await Promise.all([
            api<BackendExpenseCategory[]>('expenseCategories.list', {}),
            api<BackendExpense[]>('expenses.list', {}),
          ]);
          set({
            categories: catRows.map(toCategory),
            expenses: expRows.map(toExpense),
            loading: false,
          });
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Failed to load expenses');
          set({ loading: false });
        }
      },

      addCategory: (data) => {
        if (hasBackend()) {
          void api('expenseCategories.create', {
            name: data.name,
            parentId: data.parentId,
            emoji: data.emoji,
            monthlyBudget: data.monthlyBudget,
          })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to save category');
              void get().hydrate();
            });
          // Optimistic shape only — the real id arrives after hydrate(). The
          // modal uses this return purely to preselect the new category.
          return { id: 'ec_pending', ...data };
        }
        const item: ExpenseCategory = { id: 'ec_' + Date.now(), ...data };
        set((s) => ({ categories: [item, ...s.categories] }));
        return item;
      },
      updateCategory: (id, patch) => {
        if (hasBackend()) {
          void api('expenseCategories.update', {
            id,
            patch: {
              name: patch.name,
              parentId: patch.parentId,
              emoji: patch.emoji,
              monthlyBudget: patch.monthlyBudget,
            },
          })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to update category');
              void get().hydrate();
            });
          return;
        }
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
      },
      removeCategory: (id) => {
        if (hasBackend()) {
          void api('expenseCategories.delete', { id })
            .then(() => get().hydrate())
            .catch((e: unknown) => {
              toast.error(e instanceof Error ? e.message : 'Failed to delete category');
              void get().hydrate();
            });
          return;
        }
        set((s) => ({
          categories: s.categories
            .filter((c) => c.id !== id)
            .map((c) => (c.parentId === id ? { ...c, parentId: undefined } : c)),
        }));
      },

      addExpense: (data) => {
        if (hasBackend()) {
          void api('expenses.create', {
            date: data.date,
            categoryId: data.categoryId || undefined,
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            reference: data.reference,
            note: data.note,
            branchId: resolveBranchId(data.branch),
            userId: CURRENT_USER,
            attachmentName: data.attachmentName,
            recurring: data.recurring,
            frequency: data.recurring ? data.frequency : undefined,
            recurringEnd: data.recurring ? data.recurringEnd : undefined,
          }).then(() => {
            void get().hydrate();
            // A cash expense posts a cash-out to the open shift; refresh the
            // drawer so it reflects the new movement.
            if (data.paymentMethod === 'Cash') void useCashRegister.getState().hydrate();
          }).catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Failed to save expense');
            void get().hydrate();
            if (data.paymentMethod === 'Cash') void useCashRegister.getState().hydrate();
          });
          // Optimistic shape only — NOT pushed to state under backend.
          return {
            id: 'e_pending',
            refNo: data.refNo ?? nextExpenseRef(),
            ...data,
            createdAt: new Date().toISOString(),
          };
        }
        const item: ExpenseRecord = {
          id: 'e_' + Date.now(),
          refNo: data.refNo ?? nextExpenseRef(),
          ...data,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ expenses: [item, ...s.expenses] }));
        return item;
      },
      updateExpense: (id, patch) => {
        if (hasBackend()) {
          // Only send provided keys to the backend partial update.
          const p: Record<string, unknown> = {};
          if ('date' in patch) p.date = patch.date;
          if ('categoryId' in patch) p.categoryId = patch.categoryId;
          if ('amount' in patch) p.amount = patch.amount;
          if ('paymentMethod' in patch) p.paymentMethod = patch.paymentMethod;
          if ('reference' in patch) p.reference = patch.reference;
          if ('note' in patch) p.note = patch.note;
          if ('attachmentName' in patch) p.attachmentName = patch.attachmentName;
          if ('recurring' in patch) p.recurring = patch.recurring;
          if ('frequency' in patch) p.frequency = patch.frequency;
          if ('recurringEnd' in patch) p.recurringEnd = patch.recurringEnd;
          void api('expenses.update', { id, patch: p }).then(() => {
            void get().hydrate();
            // amount/method edits may reverse-and-reapply a cash movement.
            void useCashRegister.getState().hydrate();
          }).catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Failed to update expense');
            void get().hydrate();
            void useCashRegister.getState().hydrate();
          });
          return;
        }
        set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
      },
      voidExpense: (id, reason) => {
        if (hasBackend()) {
          void api('expenses.void', { id, reason, userId: CURRENT_USER }).then(() => {
            void get().hydrate();
            // Voiding a cash expense reverses the drawer hit — refresh cash too.
            void useCashRegister.getState().hydrate();
          }).catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Failed to void expense');
            void get().hydrate();
            void useCashRegister.getState().hydrate();
          });
          return;
        }
        set((s) => ({
          expenses: s.expenses.map((e) =>
            e.id === id ? { ...e, voided: true, voidReason: reason } : e,
          ),
        }));
      },
      deleteExpense: (id) => {
        if (hasBackend()) {
          void api('expenses.delete', { id }).then(() => {
            void get().hydrate();
            // Deleting a cash expense reverses the drawer hit — refresh cash too.
            void useCashRegister.getState().hydrate();
          }).catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Failed to delete expense');
            void get().hydrate();
            void useCashRegister.getState().hydrate();
          });
          return;
        }
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
      },
    }),
    {
      name: 'pos-expenses',
      // Only persist non-seed data; reload restores seeds plus user additions. Skip persistence
      // entirely for simplicity; mock store is fine.
      partialize: (s) => ({ categories: s.categories, expenses: s.expenses }),
    },
  ),
);

// Helpers
export function categoryPath(cats: ExpenseCategory[], id?: string): string {
  if (!id) return '—';
  const c = cats.find((x) => x.id === id);
  if (!c) return '—';
  if (!c.parentId) return c.name;
  const parent = cats.find((x) => x.id === c.parentId);
  return parent ? `${parent.name} › ${c.name}` : c.name;
}
