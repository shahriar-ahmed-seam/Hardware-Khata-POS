import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Category, Brand } from '@/types/domain';
import type { UnitRecord, UnitType } from '@/stores/masterData';
import {
  BROWSER_MOCK_CATEGORIES,
  BROWSER_MOCK_BRANDS,
  BROWSER_MOCK_UNITS,
  browserPreview,
} from '@/lib/browserMock';

/** Categories + brands hooks (backend-backed), adapted to the UI's flat types. */

interface BackendCategory {
  id: string;
  name: string;
  emoji: string | null;
  parent_id: string | null;
}
interface BackendBrand {
  id: string;
  name: string;
}
interface BackendUnit {
  id: string;
  name: string;
  short: string;
  type: string;
  to_base_factor: number;
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      // DEV-ONLY browser preview — see src/lib/browserMock.ts.
      if (browserPreview()) {
        return BROWSER_MOCK_CATEGORIES;
      }
      const rows = await api<BackendCategory[]>('categories.list');
      return rows.map(
        (c): Category & { parentId?: string } => ({
          id: c.id,
          name: c.name,
          emoji: c.emoji ?? undefined,
          parentId: c.parent_id ?? undefined,
        }),
      );
    },
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      if (browserPreview()) {
        return BROWSER_MOCK_BRANDS;
      }
      const rows = await api<BackendBrand[]>('brands.list');
      return rows.map((b): Brand => ({ id: b.id, name: b.name }));
    },
  });
}

export function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      if (browserPreview()) {
        return BROWSER_MOCK_UNITS;
      }
      const rows = await api<BackendUnit[]>('units.list');
      return rows.map(
        (u): UnitRecord => ({
          id: u.id,
          name: u.name,
          short: u.short,
          type: (u.type as UnitType) ?? 'count',
          toBaseFactor: u.to_base_factor,
        }),
      );
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; emoji?: string; parentId?: string }) =>
      api('categories.create', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}
export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: { name?: string; emoji?: string; parentId?: string | null } }) =>
      api('categories.update', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api('categories.delete', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => api('brands.create', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}
export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: { name?: string } }) => api('brands.update', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}
export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api('brands.delete', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}

export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; short: string; type?: UnitType; toBaseFactor?: number }) =>
      api('units.create', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['units'] }),
  });
}
export function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      patch: { name?: string; short?: string; type?: UnitType; toBaseFactor?: number };
    }) => api('units.update', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['units'] }),
  });
}
export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api('units.delete', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['units'] }),
  });
}
