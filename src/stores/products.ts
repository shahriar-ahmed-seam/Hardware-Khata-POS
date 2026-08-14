import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const ALL_PRODUCT_COLUMNS = [
  'image',
  'sku',
  'barcode',
  'name',
  'category',
  'brand',
  'unit',
  'cost',
  'avgCost',
  'price',
  'wholesalePrice',
  'contractorPrice',
  'stock',
  'reorderLevel',
  'tax',
  'warranty',
  'status',
  'updatedAt',
] as const;

export type ProductColumn = (typeof ALL_PRODUCT_COLUMNS)[number];

export type ProductView = 'table' | 'grid';

interface ProductsUI {
  view: ProductView;
  columns: ProductColumn[];
  setView: (v: ProductView) => void;
  toggleColumn: (c: ProductColumn) => void;
  moveColumn: (c: ProductColumn, dir: -1 | 1) => void;
  resetColumns: () => void;
}

const DEFAULT_COLUMNS: ProductColumn[] = [
  'image',
  'name',
  'sku',
  'category',
  'cost',
  'avgCost',
  'price',
  'stock',
  'status',
];

function move<T>(arr: T[], item: T, dir: -1 | 1): T[] {
  const i = arr.indexOf(item);
  if (i === -1) return arr;
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const useProductsUI = create<ProductsUI>()(
  persist(
    (set) => ({
      view: 'table',
      columns: DEFAULT_COLUMNS,
      setView: (view) => set({ view }),
      toggleColumn: (c) =>
        set((s) => ({
          columns: s.columns.includes(c) ? s.columns.filter((x) => x !== c) : [...s.columns, c],
        })),
      moveColumn: (c, dir) => set((s) => ({ columns: move(s.columns, c, dir) })),
      resetColumns: () => set({ columns: DEFAULT_COLUMNS }),
    }),
    // v1: the column set gained 'avgCost' and 'cost' joined the defaults.
    // Without a bump, an existing install keeps its stored column list and the
    // new Avg. Buying Price column would never appear.
    { name: 'pos-products-ui', version: 1 },
  ),
);

export const COLUMN_META: Record<ProductColumn, { label: string; align?: 'right' | 'left' }> = {
  image:           { label: 'Image' },
  sku:             { label: 'SKU' },
  barcode:         { label: 'Barcode' },
  name:            { label: 'Product' },
  category:        { label: 'Category' },
  brand:           { label: 'Brand' },
  unit:            { label: 'Unit' },
  cost:            { label: 'Buying Price', align: 'right' },
  // The mean of every recorded buying price — see backend/services/costing.ts.
  avgCost:         { label: 'Avg. Buying Price', align: 'right' },
  price:           { label: 'Sell Price', align: 'right' },
  wholesalePrice:  { label: 'Wholesale', align: 'right' },
  contractorPrice: { label: 'Contractor', align: 'right' },
  stock:           { label: 'Stock', align: 'right' },
  reorderLevel:    { label: 'Reorder', align: 'right' },
  tax:             { label: 'Tax %', align: 'right' },
  warranty:        { label: 'Warranty' },
  status:          { label: 'Status' },
  updatedAt:       { label: 'Updated' },
};
