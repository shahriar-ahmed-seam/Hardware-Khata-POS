import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Product } from '@/types/domain';

/**
 * Products data hooks (backend-backed).
 *
 * The backend returns snake_case rows; the UI's `Product` type is camelCase.
 * `toProduct` adapts a backend row into the exact shape the existing components
 * expect, so the UI code does not have to change.
 */

interface BackendProduct {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category_id: string | null;
  brand_id: string | null;
  unit: string;
  cost: number;
  price: number;
  wholesale_price: number | null;
  contractor_price: number | null;
  /** Mean of every recorded buying price (see backend/services/costing.ts). */
  avg_cost: number;
  /** When the current buying price was recorded. */
  cost_updated_at: string | null;
  reorder_level: number;
  tax_pct: number;
  warranty_id: string | null;
  image_url: string | null;
  description: string | null;
  manage_stock: number;
  allow_negative_sale: number;
  allow_discount: number;
  show_in_pos: number;
  not_for_sale: number;
  created_at: string;
  updated_at: string;
  stock: number;
  category_name?: string | null;
  brand_name?: string | null;
}

export function toProduct(b: BackendProduct): Product {
  return {
    id: b.id,
    sku: b.sku,
    barcode: b.barcode ?? '',
    name: b.name,
    categoryId: b.category_id ?? '',
    brandId: b.brand_id ?? '',
    unit: b.unit,
    cost: b.cost,
    avgCost: b.avg_cost ?? b.cost,
    costUpdatedAt: b.cost_updated_at ?? undefined,
    price: b.price,
    wholesalePrice: b.wholesale_price ?? undefined,
    contractorPrice: b.contractor_price ?? undefined,
    stock: b.stock,
    reorderLevel: b.reorder_level,
    image: b.image_url ?? undefined,
    tax: b.tax_pct,
    description: b.description ?? undefined,
    warrantyId: b.warranty_id ?? null,
    manageStock: b.manage_stock !== 0,
    allowNegativeSale: b.allow_negative_sale !== 0,
    allowDiscount: b.allow_discount !== 0,
    showInPOS: b.show_in_pos !== 0,
    notForSale: b.not_for_sale !== 0,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  };
}

/** Build the backend create/update payload from a UI Product. */
export function fromProduct(p: Product) {
  return {
    sku: p.sku,
    barcode: p.barcode || undefined,
    name: p.name,
    categoryId: p.categoryId || undefined,
    brandId: p.brandId || undefined,
    unit: p.unit,
    cost: p.cost,
    price: p.price,
    wholesalePrice: p.wholesalePrice,
    contractorPrice: p.contractorPrice,
    reorderLevel: p.reorderLevel,
    taxPct: p.tax ?? 0,
    warrantyId: p.warrantyId,
    imageUrl: p.image,
    description: p.description,
    manageStock: p.manageStock,
    allowNegativeSale: p.allowNegativeSale,
    allowDiscount: p.allowDiscount,
    showInPOS: p.showInPOS,
    notForSale: p.notForSale,
  };
}

const KEY = 'products';

/**
 * FULL CATALOGUE — do NOT paginate this hook.
 *
 * POS, AddSale, AddPurchase and several report pages need every sellable product
 * in memory for their pickers (barcode scan, keyboard search, line lookup). Use
 * `useProductsPage` for list screens instead of narrowing this one.
 */
export function useProducts(branchId?: string) {
  return useQuery({
    queryKey: [KEY, branchId ?? 'all'],
    queryFn: async () => {
      const rows = await api<BackendProduct[]>('products.list', { branchId });
      return rows.map(toProduct);
    },
  });
}

/** Server-side query for a page of products. Mirrors `listProductsPage`. */
export interface ProductsPageParams {
  page: number;
  pageSize: number;
  branchId?: string;
  /** Free text over name / SKU / barcode. */
  q?: string;
  categoryId?: string;
  brandId?: string;
  /** Derived from stock vs reorder level, computed server-side. */
  stockState?: 'in' | 'low' | 'out';
}

export interface ProductsPage {
  rows: Product[];
  total: number;
  page: number;
  pageSize: number;
}

interface BackendProductsPage {
  rows: BackendProduct[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * ONE PAGE of products for list screens (Products, Stock).
 *
 * The whole params object is part of the query key, so paging and every filter
 * are cached per combination and `placeholderData` keeps the previous page on
 * screen while the next one loads (no flash back to the skeleton). Filters are
 * pushed down into SQL — 'all' is normalised to `undefined` so the backend
 * ignores it.
 */
export function useProductsPage(params: ProductsPageParams) {
  const payload = {
    page: params.page,
    pageSize: params.pageSize,
    branchId: params.branchId,
    q: params.q?.trim() || undefined,
    categoryId: params.categoryId === 'all' ? undefined : params.categoryId,
    brandId: params.brandId === 'all' ? undefined : params.brandId,
    stockState: params.stockState,
  };
  return useQuery({
    queryKey: [KEY, 'page', payload],
    queryFn: async (): Promise<ProductsPage> => {
      const res = await api<BackendProductsPage>('products.listPage', payload);
      return { rows: res.rows.map(toProduct), total: res.total, page: res.page, pageSize: res.pageSize };
    },
    placeholderData: (prev) => prev,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Product & { openingStock?: number; branchId?: string; userId?: string }) =>
      api<{ id: string }>('products.create', {
        ...fromProduct(p),
        openingStock: p.openingStock,
        branchId: p.branchId,
        userId: p.userId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Product) => api('products.update', { id: p.id, patch: fromProduct(p) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// ---------------------------------------------------------- buying price (cost)

/** One recorded change to a product's buying price. */
export interface CostHistoryEntry {
  id: string;
  productId: string;
  cost: number;
  at: string;
  userId: string | null;
  userName: string | null;
  source: 'manual' | 'initial';
  note: string | null;
}

/**
 * Buying-price history for one product, newest first.
 * `enabled` so the popup only queries once it is actually opened.
 */
export function useCostHistory(productId: string | null) {
  return useQuery({
    queryKey: [KEY, 'costHistory', productId],
    enabled: !!productId,
    queryFn: () => api<CostHistoryEntry[]>('products.costHistory', { productId, limit: 50 }),
  });
}

/**
 * Record a NEW buying price.
 *
 * Not a plain column write: the backend appends to `product_cost_history` and
 * recomputes the current cost, the average and the timestamp FROM that history,
 * so the average can never drift. See backend/services/costing.ts.
 */
export function useSetProductCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; cost: number; userId?: string; note?: string }) =>
      api<{ cost: number; avgCost: number; costUpdatedAt: string; entryCount: number }>(
        'products.setCost',
        input,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/**
 * Patch ONLY the named fields of a product.
 *
 * `useUpdateProduct` rewrites every column from a whole `Product` object, which
 * is what the full form wants. For a one-field change (a price on the shop
 * floor) that would also rewrite values the user never looked at, so this sends
 * just the patch.
 */
export function usePatchProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: Record<string, unknown> }) =>
      api('products.update', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/**
 * Correct the counted stock of ONE product.
 *
 * There is no "set the stock to N" operation, and there must never be one:
 * on-hand is `SUM(stock_movements.qty)`, never a stored column. So a new counted
 * quantity is written as a signed **`recount` stock adjustment for the
 * difference** — which is also what an auditor needs, since it records who
 * changed the count, when, and by how much, instead of silently overwriting it.
 *
 * `delta` is signed: positive when more was found than the system expected,
 * negative when less.
 */
export function useCorrectStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      productId: string;
      delta: number;
      unit?: string;
      branchId: string;
      userId: string;
      reason?: string;
    }) =>
      api('adjustments.create', {
        branchId: input.branchId,
        type: 'recount',
        reason: input.reason,
        lines: [{ productId: input.productId, qty: input.delta, unit: input.unit }],
        createdBy: input.userId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** What a product is referenced by — decides whether Delete or Archive is offered. */
export interface ProductUsage {
  documents: { table: string; label: string; count: number }[];
  documentCount: number;
  /** True when nothing references it, so a hard delete is possible. */
  deletable: boolean;
  stock: number;
  archived: boolean;
}

/**
 * Ask the backend what a product is tied to, BEFORE offering to delete it.
 *
 * Without this the UI can only offer Delete and let it fail, which is how the
 * owner ends up staring at "Cannot delete: product has sales history" with no
 * idea what to do instead. It is a plain read (`products.usage` is not gated).
 */
export function useProductUsage() {
  return useMutation({
    mutationFn: (id: string) => api<ProductUsage>('products.usage', { id }),
  });
}

/**
 * Hard-delete a product.
 *
 * `force` only overrides the "still has stock" guard, and needs the
 * `products.delete` permission (Admin). It can never override the document
 * guard — a product that appears on an invoice is archived, not deleted.
 */
export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { id: string; force?: boolean }) =>
      api('products.delete', typeof input === 'string' ? { id: input } : input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/**
 * Retire a product: out of the catalogue, out of the POS, out of search — but
 * every past invoice still resolves. This is the reversible answer for a product
 * that cannot be deleted because it has been traded.
 */
export function useArchiveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; userId?: string }) => api('products.archive', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** Bring an archived product back into the catalogue and the POS. */
export function useUnarchiveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; userId?: string }) => api('products.unarchive', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
