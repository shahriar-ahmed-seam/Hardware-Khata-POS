import { useQuery } from '@tanstack/react-query';
import { api, hasBackend } from '@/lib/api';
import { toCustomer, type BackendCustomer } from '@/hooks/contactAdapter';
import type { Customer } from '@/types/domain';
import { BROWSER_MOCK_CUSTOMERS } from '@/lib/browserMock';

/**
 * Customers data hook (backend-backed) for the POS hero screen.
 *
 * Mirrors useProducts: the backend returns snake_case rows (with derived
 * due/totalPurchase/totalPaid attached by queries.ts), `toCustomer` adapts them
 * into the UI's camelCase `Customer` shape. Data comes exclusively from the
 * SQLite backend — there is no fallback list.
 */

export const CUSTOMERS_KEY = 'customers';

export function useCustomersQuery() {
  return useQuery({
    queryKey: [CUSTOMERS_KEY],
    queryFn: async (): Promise<Customer[]> => {
      if (!hasBackend()) {
        return BROWSER_MOCK_CUSTOMERS;
      }
      const rows = await api<BackendCustomer[]>('customers.list', {});
      return rows.map(toCustomer);
    },
  });
}
