import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Product } from '@/mocks/data';

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

export function useProducts(branchId?: string) {
  return useQuery({
    queryKey: [KEY, branchId ?? 'all'],
    queryFn: async () => {
      const rows = await api<BackendProduct[]>('products.list', { branchId });
      return rows.map(toProduct);
    },
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

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api('products.delete', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
