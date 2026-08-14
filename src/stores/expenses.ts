import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
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

let counter = 100;
export function nextExpenseRef() {
  counter += 1;
  return `EXP-${String(counter).padStart(4, '0')}`;
}

/**
 * Server-side query for the expenses list. Mirrors `PageQuery` (+ categoryId) in
 * backend/services/paged.ts. Voided rows are excluded by the query itself.
 */
export interface ExpensesQuery {
  page: number;
  pageSize: number;
  q?: string;
  categoryId?: string;
  /** Inclusive ISO date bounds. */
  from?: string;
  to?: string;
  method?: string;
}

export const DEFAULT_EXPENSES_QUERY: ExpensesQuery = { page: 1, pageSize: 50 };

/** Envelope returned by `expenses.listPage`. */
interface ExpensesPageResponse {
  rows: BackendExpense[];
  total: number;
  page: number;
  pageSize: number;
}

/** Guards against out-of-order responses when the user types or pages quickly. */
let expensesRequestToken = 0;

interface State {
  categories: ExpenseCategory[];
  /** ONE PAGE of expenses (see `loadPage`). */
  expenses: ExpenseRecord[];
  loading: boolean;
  /** Total rows matching the CURRENT query (not the number loaded). */
  total: number;
  /** The query that produced `expenses` — re-run by `hydrate()` after any write. */
  query: ExpensesQuery;

  /** Load ONE page of expenses; all filtering happens in SQL. */
  loadPage: (patch?: Partial<ExpensesQuery>) => Promise<void>;
  /** Load the (small) category reference list. Never paged. */
  loadCategories: () => Promise<void>;
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
      // We start empty and let hydrate() REPLACE the arrays from the DB (so any
      // stale persisted data is reconciled).
      categories: [],
      expenses: [],
      loading: false,
      total: 0,
      query: { ...DEFAULT_EXPENSES_QUERY },

      /**
       * Load ONE page of expenses. Category / date range / method / free text are
       * all pushed down into SQL, so the renderer never holds more than
       * `pageSize` rows. `listExpensesPage` already excludes voided rows.
       */
      loadPage: async (patch) => {
        const query: ExpensesQuery = { ...get().query, ...patch };
        // Any filter change resets to page 1 — staying on page 9 of a narrower
        // result set would show an empty table.
        if (patch && Object.keys(patch).some((k) => k !== 'page')) query.page = patch.page ?? 1;

        set({ loading: true, query });
        const token = ++expensesRequestToken;
        try {
          const res = await api<ExpensesPageResponse>('expenses.listPage', {
            page: query.page,
            pageSize: query.pageSize,
            q: query.q?.trim() || undefined,
            categoryId: query.categoryId === 'all' ? undefined : query.categoryId,
            from: query.from,
            to: query.to,
            method: query.method === 'all' ? undefined : query.method,
          });
          // Drop a stale response so fast typing/paging can't overwrite newer rows.
          if (token !== expensesRequestToken) return;
          set({ expenses: res.rows.map(toExpense), total: res.total, loading: false });
        } catch (e: unknown) {
          if (token !== expensesRequestToken) return;
          toast.error(e instanceof Error ? e.message : 'Failed to load expenses');
          set({ loading: false });
        }
      },

      /** Categories are a small reference list — loaded whole, never paged. */
      loadCategories: async () => {
        try {
          const catRows = await api<BackendExpenseCategory[]>('expenseCategories.list', {});
          set({ categories: catRows.map(toCategory) });
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Failed to load expense categories');
        }
      },

      /**
       * Re-run the current page query and refresh the category list. Called after
       * every write.
       */
      hydrate: async () => {
        await Promise.all([get().loadPage(), get().loadCategories()]);
      },

      addCategory: (data) => {
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
      },
      updateCategory: (id, patch) => {
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
      },
      removeCategory: (id) => {
        void api('expenseCategories.delete', { id })
          .then(() => get().hydrate())
          .catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Failed to delete category');
            void get().hydrate();
          });
      },

      addExpense: (data) => {
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
        // Optimistic shape only — NOT pushed to state; the row arrives via hydrate().
        return {
          id: 'e_pending',
          refNo: data.refNo ?? nextExpenseRef(),
          ...data,
          createdAt: new Date().toISOString(),
        };
      },
      updateExpense: (id, patch) => {
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
      },
      voidExpense: (id, reason) => {
        void api('expenses.void', { id, reason, userId: CURRENT_USER }).then(() => {
          void get().hydrate();
          // Voiding a cash expense reverses the drawer hit — refresh cash too.
          void useCashRegister.getState().hydrate();
        }).catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to void expense');
          void get().hydrate();
          void useCashRegister.getState().hydrate();
        });
      },
      deleteExpense: (id) => {
        void api('expenses.delete', { id }).then(() => {
          void get().hydrate();
          // Deleting a cash expense reverses the drawer hit — refresh cash too.
          void useCashRegister.getState().hydrate();
        }).catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to delete expense');
          void get().hydrate();
          void useCashRegister.getState().hydrate();
        });
      },
    }),
    {
      name: 'pos-expenses',
      // v2: drops the cached demo expenses/categories from before the mock removal.
      // v3: stops caching `expenses` — it is now ONE PAGE, and a persisted page
      //     would paint alongside total=0 (the pager would read "No expenses"
      //     under visible rows). Only the small category list is cached now.
      version: 3,
      // Cached copy for instant paint on reload; hydrate() REPLACES it from the DB.
      partialize: (s) => ({ categories: s.categories }),
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
