import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const ALL_SALES_COLUMNS = [
  'date',
  'invoice',
  'customer',
  'items',
  'subtotal',
  'discount',
  'tax',
  'total',
  'paid',
  'due',
  'paymentStatus',
  'paymentMethod',
  'cashier',
  'branch',
  'profit',
  'type',
] as const;

export type SalesColumn = (typeof ALL_SALES_COLUMNS)[number];

export const SALES_COLUMN_META: Record<SalesColumn, { label: string; align?: 'right' | 'left' }> = {
  date:          { label: 'Date' },
  invoice:       { label: 'Invoice' },
  customer:      { label: 'Customer' },
  items:         { label: 'Items', align: 'right' },
  subtotal:      { label: 'Subtotal', align: 'right' },
  discount:      { label: 'Discount', align: 'right' },
  tax:           { label: 'Tax', align: 'right' },
  total:         { label: 'Total', align: 'right' },
  paid:          { label: 'Paid', align: 'right' },
  due:           { label: 'Due', align: 'right' },
  paymentStatus: { label: 'Status' },
  paymentMethod: { label: 'Method' },
  cashier:       { label: 'By' },
  branch:        { label: 'Branch' },
  profit:        { label: 'Profit', align: 'right' },
  type:          { label: 'Type' },
};

const DEFAULT: SalesColumn[] = ['date', 'invoice', 'customer', 'items', 'total', 'paid', 'due', 'paymentStatus', 'paymentMethod', 'cashier'];

interface State {
  columns: SalesColumn[];
  toggle: (c: SalesColumn) => void;
  move: (c: SalesColumn, dir: -1 | 1) => void;
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

export const useSalesUI = create<State>()(
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
    { name: 'pos-sales-ui' },
  ),
);
