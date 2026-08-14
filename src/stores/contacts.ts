import { create } from 'zustand';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast';
import {
  toCustomer,
  toSupplier,
  type BackendCustomer,
  type BackendSupplier,
} from '@/hooks/contactAdapter';
import { usePurchases } from './purchases';
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

const CURRENT_USER = 'u_admin';

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
  add: (data: Omit<Customer, 'id'>) => Customer;
  update: (id: string, patch: Partial<Customer>) => void;
  remove: (id: string) => void;
  receivePayment: (
    customerId: string,
    amount: number,
    method: 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank',
    reference?: string,
  ) => void;
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

  add: (data) => {
    // Optimistic local object — also used as the synchronous return value so
    // existing callers (CustomerPicker inline add) keep working.
    const item: Customer = {
      id: 'cu_' + Date.now(),
      ...data,
      due: data.due ?? data.openingBalance ?? 0,
      totalPurchase: data.totalPurchase ?? 0,
      totalPaid: data.totalPaid ?? 0,
      joined: data.joined ?? new Date().toISOString().slice(0, 10),
    };
    // NOTE: the real backend id only arrives after rehydrate, so we cannot
    // return it synchronously. Consumers needing the real id should re-select
    // the customer (by phone/name) after hydrate completes.
    void api('customers.create', {
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
      joined: data.joined,
      userId: CURRENT_USER,
    })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to save customer');
        void get().hydrate();
      });
    return item;
  },

  update: (id, patch) => {
    void api('customers.update', { id, patch })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to update customer');
        void get().hydrate();
      });
  },

  remove: (id) => {
    void api('customers.delete', { id })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to delete customer');
        void get().hydrate();
      });
  },

  receivePayment: () => {
    // CRITICAL: this is REHYDRATE-ONLY. ReceivePaymentModal already calls
    // useSales().addPayment per invoice, which persists the real payment via
    // sales.addPayment; the customer due is then DERIVED in ledger.ts. Calling any
    // payment API here would double-count. So we only refresh the derived dues.
    void get().hydrate();
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
  add: (data: Omit<Supplier, 'id'>) => Supplier;
  update: (id: string, patch: Partial<Supplier>) => void;
  remove: (id: string) => void;
  paySupplier: (
    supplierId: string,
    amount: number,
    method?: 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank',
    reference?: string,
  ) => void;
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

  add: (data) => {
    const item: Supplier = {
      id: 'sp_' + Date.now(),
      ...data,
      due: data.due ?? data.openingBalance ?? 0,
      totalPurchase: data.totalPurchase ?? 0,
      totalPaid: data.totalPaid ?? 0,
    };
    // NOTE: the real backend id only arrives after rehydrate. NewSupplierModal's
    // onCreated(id) currently gets this optimistic id; threading the real id
    // back into the AddPurchase create-form is a follow-up (see deferrals).
    void api('suppliers.create', {
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
      userId: CURRENT_USER,
    })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to save supplier');
        void get().hydrate();
      });
    return item;
  },

  update: (id, patch) => {
    void api('suppliers.update', { id, patch })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to update supplier');
        void get().hydrate();
      });
  },

  remove: (id) => {
    void api('suppliers.delete', { id })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to delete supplier');
        void get().hydrate();
      });
  },

  paySupplier: (supplierId, amount, method = 'Cash', reference) => {
    // PaySupplierModal does NOT allocate itself, so this is the real persistence
    // path (unlike the customer side). Auto-allocate oldest-first on the backend,
    // then rehydrate BOTH suppliers (derived due) and purchases (so the Purchases
    // list reflects the new per-bill payments).
    void api('suppliers.pay', {
      supplierId,
      amount,
      method,
      reference,
      userId: CURRENT_USER,
      branchId: 'br_mp',
    })
      .then(() => {
        void get().hydrate();
        void usePurchases.getState().hydrate();
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to pay supplier');
        void get().hydrate();
        void usePurchases.getState().hydrate();
      });
  },
}));
