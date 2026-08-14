/**
 * Domain types for the renderer.
 *
 * These used to live in `src/mocks/data.ts`, which is why the mock module ended
 * up imported in ~80 files that only ever wanted a type. They are real
 * application types describing what the SQLite backend returns, so they belong
 * here. There is no sample data in this file and never should be.
 */

export type Category = { id: string; name: string; icon?: string; emoji?: string };
export type Brand = { id: string; name: string };
export type Unit = { id: string; name: string; short: string };

export type Product = {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  categoryId: string;
  brandId: string;
  unit: string; // base/default unit short code
  availableUnits?: string[]; // alternates: pc, box, dozen, hali, kg, m, ft, L, bag
  unitConversions?: { unit: string; factor: number }[]; // e.g. { unit:'dz', factor:12 } means 1 dz = 12 base units
  /** CURRENT buying price. Its full history lives in product_cost_history. */
  cost: number;
  /** Mean of every recorded buying price. Derived — never edited directly. */
  avgCost?: number;
  /** ISO timestamp of when the current buying price was recorded. */
  costUpdatedAt?: string;
  price: number; // SPR — base selling price reference
  wholesalePrice?: number;
  contractorPrice?: number;
  stock: number;
  reorderLevel: number;
  image?: string;
  variations?: { name: string; price: number; stock: number }[];
  tax?: number; // % (default 0)
  description?: string;
  warrantyId?: string | null;
  // Settings
  manageStock?: boolean; // default true
  allowNegativeSale?: boolean; // default false
  allowDiscount?: boolean; // default true
  showInPOS?: boolean; // default true
  notForSale?: boolean; // purchase-only items
  // Audit
  createdAt?: string;
  updatedAt?: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  altPhone?: string;
  email?: string;
  address?: string;
  group: 'Retail' | 'Wholesale' | 'Contractor';
  due: number;
  totalPurchase: number;
  totalPaid?: number;
  joined: string;
  creditLimit?: number; // 0 / undefined => no credit allowed
  dob?: string; // ISO date for birthday widget later
  openingBalance?: number;
  tags?: string[];
  notes?: string;
  lastSaleAt?: string;
};

export type Supplier = {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  address?: string;
  company?: string;
  taxId?: string;
  bankAccount?: string;
  leadTimeDays?: number;
  paymentTerms?: 'Cash' | 'Net7' | 'Net15' | 'Net30' | 'Net60';
  due: number;
  totalPurchase: number;
  totalPaid?: number;
  openingBalance?: number;
  tags?: string[];
  notes?: string;
  lastPurchaseAt?: string;
};

export type Sale = {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  customerName: string;
  items: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
  status: 'paid' | 'partial' | 'due';
  paymentMethod: 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank' | 'Credit' | 'Mixed';
  user: string;
};
