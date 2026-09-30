import { create } from 'zustand';
import { currentUserId } from '@/lib/actor';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast';
import {
  toCustomer,
  toSupplier,
  type BackendCustomer,
  type BackendSupplier,
} from '@/hooks/contactAdapter';
import { usePurchases } from './purchases';
import { useSales } from './sales';
import { useCashRegister } from './cashRegister';
import { todayLocalDateInput } from '@/lib/datetime';
import type { Customer, Supplier } from '@/types/domain';

/**
 * Contacts stores (customers + suppliers). Backend-only: every write persists via
 * the IPC api, then rehydrates.
 *
 * PAGINATION — `items` is ONE PAGE of rows (see `loadPage`), mirroring
 * src/stores/sales.ts. `listCustomers` / `listSuppliers` compute derived totals
 * (customerTotals/supplierTotals) per row, so an unbounded list is a per-row
 * query burst that grows with the contact book.
 *
 * `options` is the SEPARATE, UNPAGED id+name list used by dropdowns (customer
 * filters, supplier selects). Pointing a dropdown at `items` would silently
 * truncate it to one page, so pickers must read `options` + call `loadOptions()`.
 */


/** Minimal shape for dropdowns — id + display name only. */
export interface ContactOption {
  id: string;
  name: string;
}

/** Envelope returned by the `*.listPage` channels (see backend/services/paged.ts). */
interface PageResponse<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** What `customers.pay` / `suppliers.pay` return (backend/services/accounts.ts). */
export interface AccountPaymentResult {
  amount: number;
  toDocuments: { id: string; ref: string; amount: number }[];
  allocated: number;
  toOpening: number;
  advance: number;
  accountPaymentId: string | null;
  refNo: string | null;
}

/** Picked mode: how much of the payment goes to one invoice or bill. */
export interface AccountAllocation {
  docId: string;
  amount: number;
}

// ---- Customer ledger entry ----
export interface LedgerEntry {
  id: string;
  date: string;
  type: 'opening' | 'sale' | 'return' | 'payment' | 'adjust';
  reference: string;
  debit: number;
  credit: number;
  note?: string;
}

/** Server-side query for the customers list. Mirrors `PageQuery` in backend/services/paged.ts. */
export interface CustomersQuery {
  page: number;
  pageSize: number;
  q?: string;
  /** Price group ('Retail' | 'Wholesale' | 'Contractor'); 'all' clears it. */
  group?: string;
}

export const DEFAULT_CUSTOMERS_QUERY: CustomersQuery = { page: 1, pageSize: 50 };

/** Guards against out-of-order responses when the user types or pages quickly. */
let customersRequestToken = 0;

interface CustomersState {
  /** ONE PAGE of customers. Dropdowns must use `options` instead. */
  items: Customer[];
  /** Unpaged id+name list for pickers/filters. Filled by `loadOptions()`. */
  options: ContactOption[];
  loading: boolean;
  /** Total rows matching the CURRENT query (not the number loaded). */
  total: number;
  /** The query that produced `items` — re-run by `hydrate()` after any write. */
  query: CustomersQuery;
  /** Load ONE page; all filtering happens in SQL. */
  loadPage: (patch?: Partial<CustomersQuery>) => Promise<void>;
  /** Load the unpaged id+name list for dropdowns. */
  loadOptions: () => Promise<void>;
  hydrate: () => Promise<void>;
  /** Resolves the REAL backend id, or null when refused. */
  add: (data: Omit<Customer, 'id'>) => Promise<string | null>;
  /** Resolves true once the backend accepted it. */
  update: (id: string, patch: Partial<Customer>) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  /** Resolves where the money went, or null when refused (a toast says why). */
  receivePayment: (
    customerId: string,
    amount: number,
    method: 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank',
    reference?: string,
    allocations?: AccountAllocation[],
  ) => Promise<AccountPaymentResult | null>;
}

export const useCustomers = create<CustomersState>((set, get) => ({
  items: [],
  options: [],
  loading: false,
  total: 0,
  query: { ...DEFAULT_CUSTOMERS_QUERY },

  /**
   * Load ONE page of customers (rows already carry due/totalPurchase/totalPaid,
   * computed for the page only). Search + group are pushed down into SQL.
   */
  loadPage: async (patch) => {
    const query: CustomersQuery = { ...get().query, ...patch };
    // Any filter change resets to page 1 — staying on page 9 of a narrower
    // result set would show an empty table.
    if (patch && Object.keys(patch).some((k) => k !== 'page')) query.page = patch.page ?? 1;

    set({ loading: true, query });
    const token = ++customersRequestToken;
    try {
      const res = await api<PageResponse<BackendCustomer>>('customers.listPage', {
        page: query.page,
        pageSize: query.pageSize,
        q: query.q?.trim() || undefined,
        group: query.group === 'all' ? undefined : query.group,
      });
      // Drop a stale response so fast typing/paging can't overwrite newer rows.
      if (token !== customersRequestToken) return;
      set({ items: res.rows.map(toCustomer), total: res.total, loading: false });
    } catch (e: unknown) {
      if (token !== customersRequestToken) return;
      toast.error(e instanceof Error ? e.message : 'Failed to load customers');
      set({ loading: false });
    }
  },

  /**
   * Dropdown source. Deliberately UNPAGED: a customer picker that only offers
   * the first page is worse than a slow one. Only id+name is kept, so the rows'
   * derived totals are dropped straight away.
   */
  loadOptions: async () => {
    try {
      const list = await api<BackendCustomer[]>('customers.list', {});
      set({ options: list.map((c) => ({ id: c.id, name: c.name })) });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load customers');
    }
  },

  /** Re-run the current page query (called after every write). */
  hydrate: async () => {
    await get().loadPage();
  },

  // Every write waits for the backend. `add` used to return a made-up
  // 'cu_' + Date.now() id at once, which is not a row in the database.
  add: async (data) => {
    const res = await settleContact(
      get,
      api<{ id: string }>('customers.create', {
        name: data.name,
        phone: data.phone,
        altPhone: data.altPhone,
        email: data.email,
        address: data.address,
        group: data.group,
        openingBalance: data.openingBalance,
        creditLimit: data.creditLimit,
        dob: data.dob,
        tags: data.tags,
        notes: data.notes,
        // The shop's calendar day, not the UTC one.
        joined: data.joined ?? todayLocalDateInput(),
        userId: currentUserId(),
      }),
      'Failed to save customer',
    );
    return res?.id ?? null;
  },

  update: async (id, patch) =>
    !!(await settleContact(get, api('customers.update', { id, patch }), 'Failed to update customer')),

  remove: async (id) =>
    !!(await settleContact(get, api('customers.delete', { id }), 'Failed to delete customer')),

  // ONE backend call places the whole payment (services/accounts.ts): the
  // opening balance, then the oldest invoices (or the picked ones), and the rest
  // as an advance — in one transaction. The screen used to loop one un-awaited
  // sales.addPayment per invoice and save nothing for the rest.
  receivePayment: async (customerId, amount, method, reference, allocations) => {
    try {
      const res = await api<AccountPaymentResult>('customers.pay', {
        partyId: customerId,
        amount,
        method,
        reference,
        allocations,
        userId: currentUserId(),
      });
      void get().hydrate();
      void useSales.getState().hydrate();
      if (method === 'Cash') void useCashRegister.getState().hydrate();
      return res;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to record the payment');
      void get().hydrate();
      return null;
    }
  },
}));

/** Server-side query for the suppliers list. Mirrors `PageQuery` in backend/services/paged.ts. */
export interface SuppliersQuery {
  page: number;
  pageSize: number;
  q?: string;
}

export const DEFAULT_SUPPLIERS_QUERY: SuppliersQuery = { page: 1, pageSize: 50 };

/** Guards against out-of-order responses when the user types or pages quickly. */
let suppliersRequestToken = 0;

interface SuppliersState {
  /** ONE PAGE of suppliers. Dropdowns must use `options` instead. */
  items: Supplier[];
  /** Unpaged id+name list for pickers/selects. Filled by `loadOptions()`. */
  options: ContactOption[];
  loading: boolean;
  /** Total rows matching the CURRENT query (not the number loaded). */
  total: number;
  /** The query that produced `items` — re-run by `hydrate()` after any write. */
  query: SuppliersQuery;
  /** Load ONE page; all filtering happens in SQL. */
  loadPage: (patch?: Partial<SuppliersQuery>) => Promise<void>;
  /** Load the unpaged id+name list for dropdowns. */
  loadOptions: () => Promise<void>;
  hydrate: () => Promise<void>;
  /** Resolves the REAL backend id, or null when refused. */
  add: (data: Omit<Supplier, 'id'>) => Promise<string | null>;
  /** Resolves true once the backend accepted it. */
  update: (id: string, patch: Partial<Supplier>) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  /** Resolves where the money went, or null when refused (a toast says why). */
  paySupplier: (
    supplierId: string,
    amount: number,
    method?: 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank' | 'Cheque',
    reference?: string,
    allocations?: AccountAllocation[],
  ) => Promise<AccountPaymentResult | null>;
}

export const useSuppliers = create<SuppliersState>((set, get) => ({
  items: [],
  options: [],
  loading: false,
  total: 0,
  query: { ...DEFAULT_SUPPLIERS_QUERY },

  /**
   * Load ONE page of suppliers (rows already carry due/totalPurchase/totalPaid,
   * computed for the page only). Search is pushed down into SQL.
   */
  loadPage: async (patch) => {
    const query: SuppliersQuery = { ...get().query, ...patch };
    if (patch && Object.keys(patch).some((k) => k !== 'page')) query.page = patch.page ?? 1;

    set({ loading: true, query });
    const token = ++suppliersRequestToken;
    try {
      const res = await api<PageResponse<BackendSupplier>>('suppliers.listPage', {
        page: query.page,
        pageSize: query.pageSize,
        q: query.q?.trim() || undefined,
      });
      if (token !== suppliersRequestToken) return;
      set({ items: res.rows.map(toSupplier), total: res.total, loading: false });
    } catch (e: unknown) {
      if (token !== suppliersRequestToken) return;
      toast.error(e instanceof Error ? e.message : 'Failed to load suppliers');
      set({ loading: false });
    }
  },

  /** Dropdown source — UNPAGED id+name, so a supplier select stays complete. */
  loadOptions: async () => {
    try {
      const list = await api<BackendSupplier[]>('suppliers.list', {});
      set({ options: list.map((s) => ({ id: s.id, name: s.name })) });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load suppliers');
    }
  },

  /** Re-run the current page query (called after every write). */
  hydrate: async () => {
    await get().loadPage();
  },

  // Every write waits for the backend. `add` used to return 'sp_' + Date.now(),
  // which NewSupplierModal handed to purchases.create as the supplier id.
  add: async (data) => {
    const res = await settleContact(
      get,
      api<{ id: string }>('suppliers.create', {
        name: data.name,
        company: data.company,
        contactPerson: data.contactPerson,
        phone: data.phone,
        altPhone: data.altPhone,
        email: data.email,
        address: data.address,
        taxId: data.taxId,
        bankAccount: data.bankAccount,
        leadTimeDays: data.leadTimeDays,
        paymentTerms: data.paymentTerms,
        openingBalance: data.openingBalance,
        tags: data.tags,
        notes: data.notes,
        userId: currentUserId(),
      }),
      'Failed to save supplier',
    );
    if (res) void get().loadOptions();
    return res?.id ?? null;
  },

  update: async (id, patch) =>
    !!(await settleContact(get, api('suppliers.update', { id, patch }), 'Failed to update supplier')),

  remove: async (id) =>
    !!(await settleContact(get, api('suppliers.delete', { id }), 'Failed to delete supplier')),

  // One backend call, one transaction: the opening balance, then the oldest
  // bills (or the picked ones), and the rest kept as an advance with the supplier.
  paySupplier: async (supplierId, amount, method = 'Cash', reference, allocations) => {
    try {
      const res = await api<AccountPaymentResult>('suppliers.pay', {
        supplierId,
        amount,
        method,
        reference,
        allocations,
        userId: currentUserId(),
        // No branchId: the backend uses the shop's default branch.
      });
      void get().hydrate();
      void usePurchases.getState().hydrate();
      if (method === 'Cash') void useCashRegister.getState().hydrate();
      return res;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to pay supplier');
      void get().hydrate();
      void usePurchases.getState().hydrate();
      return null;
    }
  },
}));

/**
 * Wait for a contact write, then re-read the page either way. Resolves the
 * backend's answer (or null when it refused, after showing why).
 */
async function settleContact<T>(
  get: () => { hydrate: () => Promise<void> },
  write: Promise<T>,
  failure: string,
): Promise<T | null> {
  try {
    const res = await write;
    void get().hydrate();
    return res ?? ({} as T);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : failure);
    void get().hydrate();
    return null;
  }
}
