import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ContactsView = 'table' | 'grid';

// ---- Customer columns ----
export const ALL_CUSTOMER_COLUMNS = [
  'avatar',
  'name',
  'phone',
  'email',
  'group',
  'address',
  'totalPurchase',
  'totalPaid',
  'due',
  'creditLimit',
  'lastSale',
  'joined',
  'dob',
  'tags',
] as const;

export type CustomerColumn = (typeof ALL_CUSTOMER_COLUMNS)[number];

export const CUSTOMER_COLUMN_META: Record<CustomerColumn, { label: string; align?: 'right' | 'left' }> = {
  avatar:        { label: '' },
  name:          { label: 'Name' },
  phone:         { label: 'Phone' },
  email:         { label: 'Email' },
  group:         { label: 'Group' },
  address:       { label: 'Address' },
  totalPurchase: { label: 'Total Purchase', align: 'right' },
  totalPaid:     { label: 'Total Paid', align: 'right' },
  due:           { label: 'Due', align: 'right' },
  creditLimit:   { label: 'Credit Limit', align: 'right' },
  lastSale:      { label: 'Last Sale' },
  joined:        { label: 'Joined' },
  dob:           { label: 'DOB' },
  tags:          { label: 'Tags' },
};

// ---- Supplier columns ----
export const ALL_SUPPLIER_COLUMNS = [
  'avatar',
  'name',
  'company',
  'contactPerson',
  'phone',
  'email',
  'paymentTerms',
  'leadTime',
  'totalPurchase',
  'totalPaid',
  'due',
  'lastPurchase',
  'tags',
] as const;

export type SupplierColumn = (typeof ALL_SUPPLIER_COLUMNS)[number];

export const SUPPLIER_COLUMN_META: Record<SupplierColumn, { label: string; align?: 'right' | 'left' }> = {
  avatar:        { label: '' },
  name:          { label: 'Name' },
  company:       { label: 'Company' },
  contactPerson: { label: 'Contact' },
  phone:         { label: 'Phone' },
  email:         { label: 'Email' },
  paymentTerms:  { label: 'Terms' },
  leadTime:      { label: 'Lead time', align: 'right' },
  totalPurchase: { label: 'Total Purchase', align: 'right' },
  totalPaid:     { label: 'Total Paid', align: 'right' },
  due:           { label: 'Payable', align: 'right' },
  lastPurchase:  { label: 'Last Purchase' },
  tags:          { label: 'Tags' },
};

const DEFAULT_CUSTOMER_COLS: CustomerColumn[] = ['avatar', 'name', 'phone', 'group', 'totalPurchase', 'due', 'creditLimit', 'lastSale'];
const DEFAULT_SUPPLIER_COLS: SupplierColumn[] = ['avatar', 'name', 'company', 'phone', 'paymentTerms', 'totalPurchase', 'due'];

interface UIState {
  customerView: ContactsView;
  supplierView: ContactsView;
  customerCols: CustomerColumn[];
  supplierCols: SupplierColumn[];
  setCustomerView: (v: ContactsView) => void;
  setSupplierView: (v: ContactsView) => void;
  toggleCustomerCol: (c: CustomerColumn) => void;
  moveCustomerCol: (c: CustomerColumn, dir: -1 | 1) => void;
  resetCustomerCols: () => void;
  toggleSupplierCol: (c: SupplierColumn) => void;
  moveSupplierCol: (c: SupplierColumn, dir: -1 | 1) => void;
  resetSupplierCols: () => void;
}

function move<T>(arr: T[], item: T, dir: -1 | 1): T[] {
  const i = arr.indexOf(item);
  if (i === -1) return arr;
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const useContactsUI = create<UIState>()(
  persist(
    (set) => ({
      customerView: 'table',
      supplierView: 'table',
      customerCols: DEFAULT_CUSTOMER_COLS,
      supplierCols: DEFAULT_SUPPLIER_COLS,
      setCustomerView: (customerView) => set({ customerView }),
      setSupplierView: (supplierView) => set({ supplierView }),
      toggleCustomerCol: (c) =>
        set((s) => ({
          customerCols: s.customerCols.includes(c)
            ? s.customerCols.filter((x) => x !== c)
            : [...s.customerCols, c],
        })),
      moveCustomerCol: (c, dir) => set((s) => ({ customerCols: move(s.customerCols, c, dir) })),
      resetCustomerCols: () => set({ customerCols: DEFAULT_CUSTOMER_COLS }),
      toggleSupplierCol: (c) =>
        set((s) => ({
          supplierCols: s.supplierCols.includes(c)
            ? s.supplierCols.filter((x) => x !== c)
            : [...s.supplierCols, c],
        })),
      moveSupplierCol: (c, dir) => set((s) => ({ supplierCols: move(s.supplierCols, c, dir) })),
      resetSupplierCols: () => set({ supplierCols: DEFAULT_SUPPLIER_COLS }),
    }),
    { name: 'pos-contacts-ui' },
  ),
);
