import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const ALL_STOCK_COLUMNS = [
  'image',
  'sku',
  'barcode',
  'name',
  'category',
  'brand',
  'unit',
  'stock',
  'reorder',
  'valueCost',
  'valueRetail',
  'lastSold',
  'lastReceived',
  'status',
] as const;

export type StockColumn = (typeof ALL_STOCK_COLUMNS)[number];

export const STOCK_COLUMN_META: Record<StockColumn, { label: string; align?: 'right' | 'left' }> = {
  image:        { label: '' },
  sku:          { label: 'SKU' },
  barcode:      { label: 'Barcode' },
  name:         { label: 'Product' },
  category:     { label: 'Category' },
  brand:        { label: 'Brand' },
  unit:         { label: 'Unit' },
  stock:        { label: 'Stock', align: 'right' },
  reorder:      { label: 'Reorder', align: 'right' },
  valueCost:    { label: 'Value @ Cost', align: 'right' },
  valueRetail:  { label: 'Value @ Retail', align: 'right' },
  lastSold:     { label: 'Last Sold' },
  lastReceived: { label: 'Last Received' },
  status:       { label: 'Status' },
};

const DEFAULT: StockColumn[] = ['image', 'name', 'sku', 'category', 'stock', 'reorder', 'valueCost', 'status'];

interface State {
  columns: StockColumn[];
  toggle: (c: StockColumn) => void;
  move: (c: StockColumn, dir: -1 | 1) => void;
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

export const useStockUI = create<State>()(
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
    { name: 'pos-stock-ui' },
  ),
);
