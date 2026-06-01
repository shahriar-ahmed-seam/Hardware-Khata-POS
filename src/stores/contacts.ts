import { create } from 'zustand';
import { api, hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';
import {
  toCustomer,
  toSupplier,
  type BackendCustomer,
  type BackendSupplier,
} from '@/hooks/contactAdapter';
import { usePurchases } from './purchases';
import {
  customers as seedCustomers,
  suppliers as seedSuppliers,
  type Customer,
  type Supplier,
} from '@/mocks/data';

const CURRENT_USER = 'u_admin';

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

interface CustomersState {
  items: Customer[];
  loading: boolean;
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
  items: hasBackend() ? [] : seedCustomers.map((c) => ({ ...c })),
  loading: false,

  /** Load customers (with derived totals already attached by queries.ts). No-op without backend. */
  hydrate: async () => {
    if (!hasBackend()) return;
    set({ loading: true });
    try {
      // list rows already carry due/totalPurchase/totalPaid — no per-id detail needed.
      const list = await api<BackendCustomer[]>('customers.list', {});
      set({ items: list.map(toCustomer), loading: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load customers');
      set({ loading: false });
    }
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
    if (hasBackend()) {
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
    }
    set((s) => ({ items: [item, ...s.items] }));
    return item;
  },

  update: (id, patch) => {
    if (hasBackend()) {
      void api('customers.update', { id, patch })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to update customer');
          void get().hydrate();
        });
      return;
    }
    set((s) => ({ items: s.items.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  },

  remove: (id) => {
    if (hasBackend()) {
      void api('customers.delete', { id })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to delete customer');
          void get().hydrate();
        });
      return;
    }
    set((s) => ({ items: s.items.filter((c) => c.id !== id) }));
  },

  receivePayment: (customerId, amount) => {
    // CRITICAL: under backend this is REHYDRATE-ONLY. ReceivePaymentModal already
    // calls useSales().addPayment per invoice, which persists the real payment via
    // sales.addPayment; the customer due is then DERIVED in ledger.ts. Calling any
    // payment API here would double-count. So we only refresh the derived dues.
    if (hasBackend()) {
      void get().hydrate();
      return;
    }
    set((s) => ({
      items: s.items.map((c) =>
        c.id === customerId
          ? {
              ...c,
              due: Math.max(0, c.due - amount),
              totalPaid: (c.totalPaid ?? 0) + amount,
            }
          : c,
      ),
    }));
  },
}));

interface SuppliersState {
  items: Supplier[];
  loading: boolean;
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
  items: hasBackend() ? [] : seedSuppliers.map((s) => ({ ...s })),
  loading: false,

  /** Load suppliers (with derived totals already attached by queries.ts). No-op without backend. */
  hydrate: async () => {
    if (!hasBackend()) return;
    set({ loading: true });
    try {
      const list = await api<BackendSupplier[]>('suppliers.list', {});
      set({ items: list.map(toSupplier), loading: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load suppliers');
      set({ loading: false });
    }
  },

  add: (data) => {
    const item: Supplier = {
      id: 'sp_' + Date.now(),
      ...data,
      due: data.due ?? data.openingBalance ?? 0,
      totalPurchase: data.totalPurchase ?? 0,
      totalPaid: data.totalPaid ?? 0,
    };
    if (hasBackend()) {
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
    }
    set((st) => ({ items: [item, ...st.items] }));
    return item;
  },

  update: (id, patch) => {
    if (hasBackend()) {
      void api('suppliers.update', { id, patch })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to update supplier');
          void get().hydrate();
        });
      return;
    }
    set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  },

  remove: (id) => {
    if (hasBackend()) {
      void api('suppliers.delete', { id })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to delete supplier');
          void get().hydrate();
        });
      return;
    }
    set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
  },

  paySupplier: (supplierId, amount, method = 'Cash', reference) => {
    // PaySupplierModal does NOT allocate itself, so this is the real persistence
    // path (unlike the customer side). Auto-allocate oldest-first on the backend,
    // then rehydrate BOTH suppliers (derived due) and purchases (so the Purchases
    // list reflects the new per-bill payments).
    if (hasBackend()) {
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
      return;
    }
    set((s) => ({
      items: s.items.map((x) =>
        x.id === supplierId
          ? {
              ...x,
              due: Math.max(0, x.due - amount),
              totalPaid: (x.totalPaid ?? 0) + amount,
            }
          : x,
      ),
    }));
  },
}));
