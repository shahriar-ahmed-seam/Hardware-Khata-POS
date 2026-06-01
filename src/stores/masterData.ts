import { create } from 'zustand';
import {
  brands as seedBrands,
  categories as seedCategories,
  units as seedUnits,
  type Brand,
  type Category,
  type Unit,
} from '@/mocks/data';
import { api, hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';

/**
 * Master-data stores. Categories/Brands/Units remain pure in-memory mocks for
 * now; Warranties + Selling Price Groups are backend-aware (read/write SQLite
 * under Electron, mock seed in plain browser dev). Mirrors the branches store.
 */

// ---- Categories (with optional parentId for subcategories) ----
export type CategoryNode = Category & { parentId?: string };

interface CategoriesState {
  items: CategoryNode[];
  add: (data: Omit<CategoryNode, 'id'>) => CategoryNode;
  update: (id: string, patch: Partial<CategoryNode>) => void;
  remove: (id: string) => void;
}

export const useCategories = create<CategoriesState>((set) => ({
  items: seedCategories.map((c) => ({ ...c })),
  add: (data) => {
    const item: CategoryNode = { id: 'cat_' + Date.now(), ...data };
    set((s) => ({ items: [item, ...s.items] }));
    return item;
  },
  update: (id, patch) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
  remove: (id) =>
    set((s) => ({
      // Also detach children: set their parentId to undefined
      items: s.items
        .filter((i) => i.id !== id)
        .map((i) => (i.parentId === id ? { ...i, parentId: undefined } : i)),
    })),
}));

// ---- Brands ----
interface BrandsState {
  items: Brand[];
  add: (name: string) => Brand;
  update: (id: string, name: string) => void;
  remove: (id: string) => void;
}

export const useBrands = create<BrandsState>((set) => ({
  items: seedBrands.map((b) => ({ ...b })),
  add: (name) => {
    const item: Brand = { id: 'br_' + Date.now(), name };
    set((s) => ({ items: [item, ...s.items] }));
    return item;
  },
  update: (id, name) =>
    set((s) => ({ items: s.items.map((b) => (b.id === id ? { ...b, name } : b)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((b) => b.id !== id) })),
}));

// ---- Units (with type + conversion to base) ----
export type UnitType = 'count' | 'weight' | 'length' | 'volume' | 'pack';

export type UnitRecord = Unit & {
  type: UnitType;
  toBaseFactor: number; // factor against the base unit of its TYPE (1 = base unit)
};

interface UnitsState {
  items: UnitRecord[];
  add: (data: Omit<UnitRecord, 'id'>) => UnitRecord;
  update: (id: string, patch: Partial<UnitRecord>) => void;
  remove: (id: string) => void;
}

const DEFAULT_TYPE_FOR: Record<string, UnitType> = {
  pc: 'count',
  dz: 'count',
  hali: 'count',
  box: 'pack',
  bag: 'pack',
  kg: 'weight',
  m: 'length',
  ft: 'length',
  L: 'volume',
};

const DEFAULT_FACTOR_FOR: Record<string, number> = {
  pc: 1,
  dz: 12,
  hali: 4,
  box: 1,
  bag: 1,
  kg: 1,
  m: 1,
  ft: 0.3048,
  L: 1,
};

export const useUnits = create<UnitsState>((set) => ({
  items: seedUnits.map((u) => ({
    ...u,
    type: DEFAULT_TYPE_FOR[u.short] ?? 'count',
    toBaseFactor: DEFAULT_FACTOR_FOR[u.short] ?? 1,
  })),
  add: (data) => {
    const item: UnitRecord = { id: 'u_' + Date.now(), ...data };
    set((s) => ({ items: [item, ...s.items] }));
    return item;
  },
  update: (id, patch) =>
    set((s) => ({ items: s.items.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((u) => u.id !== id) })),
}));

// ---- Warranties ----
export interface Warranty {
  id: string;
  name: string;
  durationMonths: number;
  description?: string;
}

interface WarrantiesState {
  items: Warranty[];
  loading: boolean;
  hydrate: () => Promise<void>;
  add: (data: Omit<Warranty, 'id'>) => Warranty;
  update: (id: string, patch: Partial<Warranty>) => void;
  remove: (id: string) => void;
}

const SEED_WARRANTIES: Warranty[] = [
  { id: 'w1', name: '1 Year Manufacturer', durationMonths: 12, description: 'Manufacturer warranty against defects' },
  { id: 'w2', name: '6 Months', durationMonths: 6 },
  { id: 'w3', name: '2 Years Premium', durationMonths: 24 },
];

interface BackendWarranty {
  id: string;
  name: string;
  duration_months: number;
  description: string | null;
}

function toWarranty(w: BackendWarranty): Warranty {
  return {
    id: w.id,
    name: w.name,
    durationMonths: w.duration_months,
    description: w.description ?? undefined,
  };
}

export const useWarranties = create<WarrantiesState>((set, get) => ({
  items: hasBackend() ? [] : [...SEED_WARRANTIES],
  loading: false,

  hydrate: async () => {
    if (!hasBackend()) return;
    set({ loading: true });
    try {
      const list = await api<BackendWarranty[]>('warranties.list', {});
      set({ items: list.map(toWarranty), loading: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load warranties');
      set({ loading: false });
    }
  },

  add: (data) => {
    // Optimistic local object + synchronous return so inline callers keep working.
    const item: Warranty = { id: 'w_' + Date.now(), ...data };
    if (hasBackend()) {
      void api('warranties.create', {
        name: data.name,
        durationMonths: data.durationMonths,
        description: data.description,
      })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to save warranty');
          void get().hydrate();
        });
      return item;
    }
    set((s) => ({ items: [item, ...s.items] }));
    return item;
  },

  update: (id, patch) => {
    if (hasBackend()) {
      void api('warranties.update', { id, patch })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to update warranty');
          void get().hydrate();
        });
      return;
    }
    set((s) => ({ items: s.items.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
  },

  remove: (id) => {
    if (hasBackend()) {
      void api('warranties.delete', { id })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to delete warranty');
          void get().hydrate();
        });
      return;
    }
    set((s) => ({ items: s.items.filter((w) => w.id !== id) }));
  },
}));

// ---- Selling Price Groups ----
export interface PriceGroup {
  id: string;
  name: string;
  isDefault?: boolean;
  notes?: string;
  defaultCreditLimit?: number;
  defaultDiscountPct?: number;
  taxExempt?: boolean;
}

interface PriceGroupsState {
  items: PriceGroup[];
  loading: boolean;
  hydrate: () => Promise<void>;
  add: (data: Omit<PriceGroup, 'id'>) => PriceGroup;
  update: (id: string, patch: Partial<PriceGroup>) => void;
  remove: (id: string) => void;
}

const SEED_GROUPS: PriceGroup[] = [
  { id: 'pg_retail', name: 'Retail', isDefault: true, notes: 'Walk-in customer pricing' },
  { id: 'pg_wholesale', name: 'Wholesale', notes: 'Bulk buyer pricing' },
  { id: 'pg_contractor', name: 'Contractor', notes: 'Construction contractor pricing' },
];

interface BackendPriceGroup {
  id: string;
  name: string;
  is_default: number;
  notes: string | null;
  default_credit_limit: number | null;
  default_discount_pct: number | null;
  tax_exempt: number;
}

function toPriceGroup(p: BackendPriceGroup): PriceGroup {
  return {
    id: p.id,
    name: p.name,
    isDefault: !!p.is_default,
    notes: p.notes ?? undefined,
    defaultCreditLimit: p.default_credit_limit ?? undefined,
    defaultDiscountPct: p.default_discount_pct ?? undefined,
    taxExempt: !!p.tax_exempt,
  };
}

export const usePriceGroups = create<PriceGroupsState>((set, get) => ({
  items: hasBackend() ? [] : [...SEED_GROUPS],
  loading: false,

  hydrate: async () => {
    if (!hasBackend()) return;
    set({ loading: true });
    try {
      const list = await api<BackendPriceGroup[]>('priceGroups.list', {});
      set({ items: list.map(toPriceGroup), loading: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load price groups');
      set({ loading: false });
    }
  },

  add: (data) => {
    // Optimistic local object + synchronous return so inline callers keep working.
    const item: PriceGroup = { id: 'pg_' + Date.now(), ...data };
    if (hasBackend()) {
      void api('priceGroups.create', {
        name: data.name,
        isDefault: data.isDefault,
        notes: data.notes,
        defaultCreditLimit: data.defaultCreditLimit,
        defaultDiscountPct: data.defaultDiscountPct,
        taxExempt: data.taxExempt,
      })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to save price group');
          void get().hydrate();
        });
      return item;
    }
    set((s) => ({ items: [item, ...s.items] }));
    return item;
  },

  update: (id, patch) => {
    if (hasBackend()) {
      void api('priceGroups.update', { id, patch })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to update price group');
          void get().hydrate();
        });
      return;
    }
    set((s) => ({ items: s.items.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  },

  remove: (id) => {
    if (hasBackend()) {
      void api('priceGroups.delete', { id })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to delete price group');
          void get().hydrate();
        });
      return;
    }
    set((s) => ({ items: s.items.filter((p) => p.id !== id) }));
  },
}));
