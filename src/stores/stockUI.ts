import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// "Last sold" / "Last received" were dropped: one showed the product's edit
// time and the other was always "—".
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
  'status',
] as const;

export type StockColumn = (typeof ALL_STOCK_COLUMNS)[number];

export const STOCK_COLUMN_META: Record<StockColumn, { label: string; align?: 'right' | 'left' }> = {
  // Header cell stays empty for the picture; the column picker shows this label.
  image:        { label: 'Picture' },
  sku:          { label: 'SKU' },
  barcode:      { label: 'Barcode' },
  name:         { label: 'Product' },
  category:     { label: 'Category' },
  brand:        { label: 'Brand' },
  unit:         { label: 'Unit' },
  stock:        { label: 'Stock', align: 'right' },
  reorder:      { label: 'Reorder at', align: 'right' },
  valueCost:    { label: 'Value at cost', align: 'right' },
  valueRetail:  { label: 'Value at sell price', align: 'right' },
  status:       { label: 'Status' },
};

// 6 data columns + Update = 7 at 1366px. SKU stays as a line under the name.
const DEFAULT: StockColumn[] = ['name', 'category', 'stock', 'reorder', 'valueCost', 'status'];

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
    {
      name: 'pos-stock-ui',
      // v2: new default set (redesign) — older saved layouts reset once.
      version: 2,
      migrate: () => ({ columns: DEFAULT }) as Partial<State> as State,
    },
  ),
);
