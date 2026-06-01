import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const ALL_EXPENSE_COLUMNS = [
  'date',
  'ref',
  'category',
  'note',
  'amount',
  'method',
  'reference',
  'branch',
  'user',
  'attachment',
  'recurring',
] as const;

export type ExpenseColumn = (typeof ALL_EXPENSE_COLUMNS)[number];

export const EXPENSE_COLUMN_META: Record<ExpenseColumn, { label: string; align?: 'right' | 'left' }> = {
  date:       { label: 'Date' },
  ref:        { label: 'Ref' },
  category:   { label: 'Category' },
  note:       { label: 'Note' },
  amount:     { label: 'Amount', align: 'right' },
  method:     { label: 'Method' },
  reference:  { label: 'Reference' },
  branch:     { label: 'Branch' },
  user:       { label: 'By' },
  attachment: { label: 'Attached' },
  recurring:  { label: 'Recurring' },
};

const DEFAULT: ExpenseColumn[] = ['date', 'category', 'note', 'amount', 'method', 'branch', 'user', 'attachment'];

interface State {
  columns: ExpenseColumn[];
  toggle: (c: ExpenseColumn) => void;
  move: (c: ExpenseColumn, dir: -1 | 1) => void;
  reset: () => void;
}

function move<T>(arr: T[], item: T, dir: -1 | 1): T[] {
  const i = arr.indexOf(item);
  if (i === -1) return arr;
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const useExpensesUI = create<State>()(
  persist(
    (set) => ({
      columns: DEFAULT,
      toggle: (c) =>
        set((s) => ({
          columns: s.columns.includes(c) ? s.columns.filter((x) => x !== c) : [...s.columns, c],
        })),
      move: (c, dir) => set((s) => ({ columns: move(s.columns, c, dir) })),
      reset: () => set({ columns: DEFAULT }),
    }),
    { name: 'pos-expenses-ui' },
  ),
);
