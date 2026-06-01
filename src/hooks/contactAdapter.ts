import type { Customer, Supplier } from '@/mocks/data';

/**
 * Maps backend contact rows (snake_case, with derived totals attached by
 * queries.ts via customerTotals/supplierTotals) into the frontend Customer /
 * Supplier mock shapes that all the contacts components already consume.
 *
 * Mirrors purchaseAdapter.ts. Derived fields (due/totalPurchase/totalPaid) come
 * straight off the list/detail row — they are NEVER stored columns.
 */

export interface BackendCustomer {
  id: string;
  name: string;
  phone: string | null;
  alt_phone: string | null;
  email: string | null;
  address: string | null;
  price_group: string;
  opening_balance: number;
  credit_limit: number | null;
  dob: string | null;
  tags: string | null;
  notes: string | null;
  store_credit: number;
  joined: string | null;
  created_at: string;
  // derived (attached by customerTotals)
  due?: number;
  totalPurchase?: number;
  totalPaid?: number;
}

export interface BackendSupplier {
  id: string;
  name: string;
  company: string | null;
  contact_person: string | null;
  phone: string | null;
  alt_phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  bank_account: string | null;
  lead_time_days: number | null;
  payment_terms: string | null;
  opening_balance: number;
  tags: string | null;
  notes: string | null;
  created_at: string;
  // derived (attached by supplierTotals)
  due?: number;
  totalPurchase?: number;
  totalPaid?: number;
}

/** Parse a JSON tags column into a string[] (tolerant of bad/legacy data). */
function parseTags(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : undefined;
  } catch {
    return undefined;
  }
}

export function toCustomer(b: BackendCustomer): Customer {
  return {
    id: b.id,
    name: b.name,
    phone: b.phone ?? '',
    altPhone: b.alt_phone ?? undefined,
    email: b.email ?? undefined,
    address: b.address ?? undefined,
    group: (b.price_group as Customer['group']) ?? 'Retail',
    due: b.due ?? 0,
    totalPurchase: b.totalPurchase ?? 0,
    totalPaid: b.totalPaid ?? 0,
    joined: b.joined ?? '',
    creditLimit: b.credit_limit ?? undefined,
    dob: b.dob ?? undefined,
    openingBalance: b.opening_balance,
    tags: parseTags(b.tags),
    notes: b.notes ?? undefined,
  };
}

export function toSupplier(b: BackendSupplier): Supplier {
  return {
    id: b.id,
    name: b.name,
    contactPerson: b.contact_person ?? undefined,
    phone: b.phone ?? '',
    altPhone: b.alt_phone ?? undefined,
    email: b.email ?? undefined,
    address: b.address ?? undefined,
    company: b.company ?? undefined,
    taxId: b.tax_id ?? undefined,
    bankAccount: b.bank_account ?? undefined,
    leadTimeDays: b.lead_time_days ?? undefined,
    paymentTerms: (b.payment_terms as Supplier['paymentTerms']) ?? undefined,
    due: b.due ?? 0,
    totalPurchase: b.totalPurchase ?? 0,
    totalPaid: b.totalPaid ?? 0,
    openingBalance: b.opening_balance,
    tags: parseTags(b.tags),
    notes: b.notes ?? undefined,
  };
}
