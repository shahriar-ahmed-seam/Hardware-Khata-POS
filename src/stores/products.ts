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

// SKU shows under the name; Low/Out shows in the Stock cell; the average
// buying price is in the Update popup (UI audit, Products 2/4/5).
const DEFAULT_COLUMNS: ProductColumn[] = ['image', 'name', 'category', 'cost', 'price', 'stock'];

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
    // v2: slimmer defaults (above) and no 'warranty' column (products cannot
    // carry one). Older stored lists are reset to the new defaults.
    {
      name: 'pos-products-ui',
      version: 2,
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<ProductsUI>;
        return version < 2 ? { ...s, columns: DEFAULT_COLUMNS } : (s as ProductsUI);
      },
    },
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
  cost:            { label: 'Buying price', align: 'right' },
  // The mean of every recorded buying price — see backend/services/costing.ts.
  avgCost:         { label: 'Average buying price', align: 'right' },
  price:           { label: 'Selling price', align: 'right' },
  wholesalePrice:  { label: 'Wholesale price', align: 'right' },
  contractorPrice: { label: 'Contractor price', align: 'right' },
  stock:           { label: 'Stock', align: 'right' },
  reorderLevel:    { label: 'Low-stock alert at', align: 'right' },
  tax:             { label: 'Tax %', align: 'right' },
  status:          { label: 'Status' },
  updatedAt:       { label: 'Updated' },
};
