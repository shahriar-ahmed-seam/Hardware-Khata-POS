import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const ALL_PURCHASE_COLUMNS = [
  'date',
  'ref',
  'supplier',
  'branch',
  'items',
  'subtotal',
  'discount',
  'tax',
  'shipping',
  'total',
  'paid',
  'due',
  'paymentStatus',
  'status',
  'user',
] as const;

export type PurchaseColumn = (typeof ALL_PURCHASE_COLUMNS)[number];

export const PURCHASE_COLUMN_META: Record<PurchaseColumn, { label: string; align?: 'right' | 'left' }> = {
  date:          { label: 'Date' },
  ref:           { label: 'Reference' },
  supplier:      { label: 'Supplier' },
  branch:        { label: 'Branch' },
  items:         { label: 'Items', align: 'right' },
  subtotal:      { label: 'Subtotal', align: 'right' },
  discount:      { label: 'Discount', align: 'right' },
  tax:           { label: 'Tax', align: 'right' },
  shipping:      { label: 'Shipping', align: 'right' },
  total:         { label: 'Total', align: 'right' },
  paid:          { label: 'Paid', align: 'right' },
  due:           { label: 'Due', align: 'right' },
  paymentStatus: { label: 'Payment' },
  status:        { label: 'Status' },
  user:          { label: 'By' },
};

const DEFAULT: PurchaseColumn[] = ['date', 'ref', 'supplier', 'items', 'total', 'paid', 'due', 'paymentStatus', 'status', 'user'];

interface State {
  columns: PurchaseColumn[];
  toggle: (c: PurchaseColumn) => void;
  move: (c: PurchaseColumn, dir: -1 | 1) => void;
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

export const usePurchasesUI = create<State>()(
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
    { name: 'pos-purchases-ui' },
  ),
);
