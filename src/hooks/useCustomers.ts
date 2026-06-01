import { useQuery } from '@tanstack/react-query';
import { api, hasBackend } from '@/lib/api';
import { toCustomer, type BackendCustomer } from '@/hooks/contactAdapter';
import type { Customer } from '@/mocks/data';

/**
 * Customers data hook (backend-backed) for the POS hero screen.
 *
 * Mirrors useProducts: the backend returns snake_case rows (with derived
 * due/totalPurchase/totalPaid attached by queries.ts), `toCustomer` adapts them
 * into the UI's camelCase `Customer` shape. Gated by `hasBackend()` so browser
 * dev falls back to mock data at the call site.
 */

export const CUSTOMERS_KEY = 'customers';

export function useCustomersQuery() {
  return useQuery({
    queryKey: [CUSTOMERS_KEY],
    enabled: hasBackend(),
    queryFn: async (): Promise<Customer[]> => {
      const rows = await api<BackendCustomer[]>('customers.list', {});
      return rows.map(toCustomer);
    },
  });
}
