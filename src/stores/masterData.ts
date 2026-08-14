import { create } from 'zustand';
import type { Brand, Category, Unit } from '@/types/domain';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast';

/**
 * Master-data stores. All of them (Categories, Brands, Units, Warranties and
 * Selling Price Groups) are backend-only: reads go through `hydrate` and every
 * write persists via the IPC api, then rehydrates. Mirrors the branches store.
 *
 * The Categories/Brands/Units stores talk to the SAME channels as the
 * react-query catalog hooks in `@/hooks/useCatalog` (categories.* / brands.* /
 * units.*), so both views of the catalog stay consistent.
 */

// ---- Categories (with optional parentId for subcategories) ----
export type CategoryNode = Category & { parentId?: string };

interface BackendCategory {
  id: string;
  name: string;
  emoji: string | null;
  parent_id: string | null;
}

function toCategoryNode(c: BackendCategory): CategoryNode {
  return {
    id: c.id,
    name: c.name,
    emoji: c.emoji ?? undefined,
    parentId: c.parent_id ?? undefined,
  };
}

interface CategoriesState {
  items: CategoryNode[];
  loading: boolean;
  hydrate: () => Promise<void>;
  add: (data: Omit<CategoryNode, 'id'>) => CategoryNode;
  update: (id: string, patch: Partial<CategoryNode>) => void;
  remove: (id: string) => void;
}

export const useCategories = create<CategoriesState>((set, get) => ({
  items: [],
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const list = await api<BackendCategory[]>('categories.list', {});
      set({ items: list.map(toCategoryNode), loading: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load categories');
      set({ loading: false });
    }
  },

  add: (data) => {
    // Optimistic local object + synchronous return so inline callers keep working.
    const item: CategoryNode = { id: 'cat_' + Date.now(), ...data };
    void api('categories.create', {
      name: data.name,
      emoji: data.emoji,
      parentId: data.parentId,
    })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to save category');
        void get().hydrate();
      });
    return item;
  },

  update: (id, patch) => {
    void api('categories.update', { id, patch })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to update category');
        void get().hydrate();
      });
  },

  remove: (id) => {
    // The backend also detaches children (sets their parent_id to NULL) instead
    // of cascade-deleting them, matching the old in-memory behaviour.
    void api('categories.delete', { id })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to delete category');
        void get().hydrate();
      });
  },
}));

// ---- Brands ----
interface BackendBrand {
  id: string;
  name: string;
}

interface BrandsState {
  items: Brand[];
  loading: boolean;
  hydrate: () => Promise<void>;
  add: (name: string) => Brand;
  update: (id: string, name: string) => void;
  remove: (id: string) => void;
}

export const useBrands = create<BrandsState>((set, get) => ({
  items: [],
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const list = await api<BackendBrand[]>('brands.list', {});
      set({ items: list.map((b): Brand => ({ id: b.id, name: b.name })), loading: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load brands');
      set({ loading: false });
    }
  },

  add: (name) => {
    // Optimistic local object + synchronous return so inline callers keep working.
    const item: Brand = { id: 'br_' + Date.now(), name };
    void api('brands.create', { name })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to save brand');
        void get().hydrate();
      });
    return item;
  },

  update: (id, name) => {
    void api('brands.update', { id, patch: { name } })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to update brand');
        void get().hydrate();
      });
  },

  remove: (id) => {
    void api('brands.delete', { id })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to delete brand');
        void get().hydrate();
      });
  },
}));

// ---- Units (with type + conversion to base) ----
export type UnitType = 'count' | 'weight' | 'length' | 'volume' | 'pack';

export type UnitRecord = Unit & {
  type: UnitType;
  toBaseFactor: number; // factor against the base unit of its TYPE (1 = base unit)
};

interface UnitsState {
  items: UnitRecord[];
  loading: boolean;
  hydrate: () => Promise<void>;
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

interface BackendUnit {
  id: string;
  name: string;
  short: string;
  type: string | null;
  to_base_factor: number | null;
}

/**
 * Units stored without an explicit type/conversion fall back to the well-known
 * defaults for their short code (dz = 12 pieces, ft = 0.3048 m, …), then to
 * `count` / factor 1.
 */
function toUnitRecord(u: BackendUnit): UnitRecord {
  return {
    id: u.id,
    name: u.name,
    short: u.short,
    type: (u.type as UnitType | null) ?? DEFAULT_TYPE_FOR[u.short] ?? 'count',
    toBaseFactor: u.to_base_factor ?? DEFAULT_FACTOR_FOR[u.short] ?? 1,
  };
}

export const useUnits = create<UnitsState>((set, get) => ({
  items: [],
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      const list = await api<BackendUnit[]>('units.list', {});
      set({ items: list.map(toUnitRecord), loading: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load units');
      set({ loading: false });
    }
  },

  add: (data) => {
    // Optimistic local object + synchronous return so inline callers keep working.
    const item: UnitRecord = { id: 'u_' + Date.now(), ...data };
    void api('units.create', {
      name: data.name,
      short: data.short,
      // Same default mapping as hydrate, so a unit added without an explicit
      // type/factor still lands on the right base conversion.
      type: data.type ?? DEFAULT_TYPE_FOR[data.short] ?? 'count',
      toBaseFactor: data.toBaseFactor ?? DEFAULT_FACTOR_FOR[data.short] ?? 1,
    })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to save unit');
        void get().hydrate();
      });
    return item;
  },

  update: (id, patch) => {
    void api('units.update', { id, patch })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to update unit');
        void get().hydrate();
      });
  },

  remove: (id) => {
    void api('units.delete', { id })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to delete unit');
        void get().hydrate();
      });
  },
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
  items: [],
  loading: false,

  hydrate: async () => {
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
  },

  update: (id, patch) => {
    void api('warranties.update', { id, patch })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to update warranty');
        void get().hydrate();
      });
  },

  remove: (id) => {
    void api('warranties.delete', { id })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to delete warranty');
        void get().hydrate();
      });
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
  items: [],
  loading: false,

  hydrate: async () => {
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
  },

  update: (id, patch) => {
    void api('priceGroups.update', { id, patch })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to update price group');
        void get().hydrate();
      });
  },

  remove: (id) => {
    void api('priceGroups.delete', { id })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to delete price group');
        void get().hydrate();
      });
  },
}));
