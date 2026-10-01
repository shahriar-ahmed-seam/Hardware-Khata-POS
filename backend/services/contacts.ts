import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { round2 } from '../core/money.ts';
import { payToSupplier, type AccountAllocation } from './accounts.ts';
import { logActivity } from './activity.ts';
import { shopBranchId } from './branch.ts';
import { customerDue, supplierDue } from './ledger.ts';

/**
 * A money figure typed on a contact form. Finite and rounded, or refused — a
 * NaN or a string used to go straight into the column. The credit limit may be
 * left empty (no limit) but not negative.
 */
function balanceAmount(v: unknown, label: string): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number.`);
  return round2(n);
}
function creditLimitAmount(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error('The credit limit cannot be negative.');
  return round2(n);
}
const money = (n: number | null) => (n === null ? 'none' : round2(n).toFixed(2));

/**
 * What changed on a contact's MONEY fields, for the activity log. An opening
 * balance edit rewrites what the person owes (or is owed), so it is recorded
 * old → new with the difference and the reason; before, the log said only
 * "Updated customer".
 */
function balanceChange(
  cur: { opening_balance: number; credit_limit?: number | null },
  patch: { openingBalance?: unknown; creditLimit?: unknown },
): { message: string; amount?: number; openingChanged: boolean } | null {
  const parts: string[] = [];
  let amount: number | undefined;
  let openingChanged = false;
  if ('openingBalance' in patch) {
    const next = balanceAmount(patch.openingBalance, 'The opening balance');
    if (Math.abs(next - cur.opening_balance) > 0.004) {
      openingChanged = true;
      amount = round2(next - cur.opening_balance);
      parts.push(`opening balance ${money(cur.opening_balance)} → ${money(next)}`);
    }
  }
  if ('creditLimit' in patch && cur.credit_limit !== undefined) {
    const next = creditLimitAmount(patch.creditLimit);
    const old = cur.credit_limit ?? null;
    if ((old ?? -1) !== (next ?? -1)) parts.push(`credit limit ${money(old)} → ${money(next)}`);
  }
  return parts.length ? { message: parts.join('; '), amount, openingChanged } : null;
}

/**
 * Contacts CRUD: customers + suppliers. Mirrors catalog.ts — keeps the FTS index
 * in sync, uses the colMap partial-update technique, and guards deletes against
 * any historical document references.
 *
 * Balances are NEVER stored: customer due / supplier due are DERIVED in
 * ledger.ts from sales/purchases/payments/returns. Nothing here writes a running
 * balance column. `paySupplier` persists real purchase_payments rows (reusing
 * addPurchasePayment) so supplierDue recomputes correctly.
 */

// ---------- Customers ----------
export interface CustomerInput {
  id?: string;
  name: string;
  phone?: string;
  altPhone?: string;
  email?: string;
  address?: string;
  // accept either priceGroup or the frontend's `group` alias
  priceGroup?: string;
  group?: string;
  openingBalance?: number;
  creditLimit?: number;
  dob?: string;
  tags?: string[];
  notes?: string;
  joined?: string;
  userId?: string;
}

function syncCustomerFts(db: DB, customerId: string) {
  db.prepare('DELETE FROM fts_customers WHERE customer_id = ?').run(customerId);
  const c = db.prepare('SELECT name, phone FROM customers WHERE id = ?').get(customerId) as
    | { name: string; phone: string | null }
    | undefined;
  if (c) {
    db.prepare('INSERT INTO fts_customers (customer_id, name, phone) VALUES (?,?,?)').run(
      customerId,
      c.name,
      c.phone ?? '',
    );
  }
}

export function createCustomer(db: DB, input: CustomerInput) {
  return tx(db, () => {
    const id = input.id ?? newId('cu');
    const now = new Date().toISOString();
    // default joined to today (date only) when not supplied
    const joined = input.joined ?? now.slice(0, 10);
    db.prepare(
      `INSERT INTO customers (id, name, phone, alt_phone, email, address, price_group,
         opening_balance, credit_limit, dob, tags, notes, store_credit, joined, created_at)
       VALUES (@id, @name, @phone, @altPhone, @email, @address, @priceGroup,
         @openingBalance, @creditLimit, @dob, @tags, @notes, 0, @joined, @now)`,
    ).run({
      id,
      name: input.name,
      phone: input.phone ?? null,
      altPhone: input.altPhone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      priceGroup: input.priceGroup ?? input.group ?? 'Retail',
      openingBalance: balanceAmount(input.openingBalance ?? 0, 'The opening balance'),
      creditLimit: creditLimitAmount(input.creditLimit),
      dob: input.dob ?? null,
      tags: input.tags ? JSON.stringify(input.tags) : null,
      notes: input.notes ?? null,
      joined,
      now,
    });
    syncCustomerFts(db, id);

    logActivity(db, {
      by: input.userId,
      action: 'created',
      entity: 'customer',
      entityId: id,
      entityRef: input.phone ?? undefined,
      message: `New customer: ${input.name}`,
      at: now,
    });
    return { id };
  });
}

export function updateCustomer(
  db: DB,
  id: string,
  patch: Partial<CustomerInput> & { balanceReason?: string },
) {
  return tx(db, () => {
    const existing = db
      .prepare('SELECT id, name, opening_balance, credit_limit FROM customers WHERE id = ?')
      .get(id) as { id: string; name: string; opening_balance: number; credit_limit: number | null } | undefined;
    if (!existing) throw new Error('Customer not found');
    const now = new Date().toISOString();
    const change = balanceChange(existing, patch);
    if (change?.openingChanged && !patch.balanceReason?.trim()) {
      throw new Error('Say why the opening balance is changing — it changes what the customer owes.');
    }
    if ('openingBalance' in patch) {
      patch = { ...patch, openingBalance: balanceAmount(patch.openingBalance, 'The opening balance') };
    }
    if ('creditLimit' in patch) {
      patch = { ...patch, creditLimit: creditLimitAmount(patch.creditLimit) ?? undefined };
    }

    // Map camelCase patch keys to columns; only set provided keys.
    const colMap: Record<string, string> = {
      name: 'name',
      phone: 'phone',
      altPhone: 'alt_phone',
      email: 'email',
      address: 'address',
      openingBalance: 'opening_balance',
      creditLimit: 'credit_limit',
      dob: 'dob',
      notes: 'notes',
      joined: 'joined',
    };
    const sets: string[] = [];
    const params: Record<string, unknown> = { id };
    for (const [k, col] of Object.entries(colMap)) {
      if (k in patch) {
        sets.push(`${col} = @${k}`);
        params[k] = (patch as Record<string, unknown>)[k] ?? null;
      }
    }
    // price group accepts either `priceGroup` or the frontend `group` alias
    if ('priceGroup' in patch || 'group' in patch) {
      sets.push('price_group = @priceGroup');
      params.priceGroup = patch.priceGroup ?? patch.group ?? 'Retail';
    }
    // tags stored as JSON string
    if ('tags' in patch) {
      sets.push('tags = @tags');
      params.tags = patch.tags ? JSON.stringify(patch.tags) : null;
    }
    if (sets.length > 0) {
      db.prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = @id`).run(params);
    }

    if ('name' in patch || 'phone' in patch) syncCustomerFts(db, id);

    logActivity(db, {
      by: patch.userId,
      action: 'edited',
      entity: 'customer',
      entityId: id,
      entityRef: existing.name,
      message: change
        ? `Updated customer: ${change.message}${patch.balanceReason?.trim() ? ` — ${patch.balanceReason.trim()}` : ''}`
        : 'Updated customer',
      amount: change?.amount,
      at: now,
    });
    return { id };
  });
}

/**
 * Nothing owed either way, no credit held, no money paid on account. Deleting a
 * contact used to be checked against documents only, so an opening balance or
 * store credit vanished with the row — money nobody could see any more.
 */
function assertNoBalance(db: DB, kind: 'customer' | 'supplier', id: string) {
  const due = kind === 'customer' ? customerDue(db, id) : supplierDue(db, id);
  if (Math.abs(due) > 0.004) {
    throw new Error(
      due > 0
        ? `Cannot delete: ${kind === 'customer' ? 'they owe' : 'the shop owes them'} ৳${due.toFixed(2)}. Settle it first.`
        : `Cannot delete: ${kind === 'customer' ? 'they have' : 'the shop has'} ৳${(-due).toFixed(2)} in advance. Settle it first.`,
    );
  }
  // Store credit is part of the due now (ledger.ts), so the check above covers it.
  const paid = db
    .prepare('SELECT COUNT(*) c FROM account_payments WHERE party_type = ? AND party_id = ?')
    .get(kind, id) as { c: number };
  if (paid.c > 0) {
    throw new Error('Cannot delete: there are payments on this account. Keep the record for the history.');
  }
}

export function deleteCustomer(db: DB, id: string, userId?: string) {
  return tx(db, () => {
    const row = db.prepare('SELECT name, phone FROM customers WHERE id = ?').get(id) as
      | { name: string; phone: string | null }
      | undefined;
    if (!row) throw new Error('Customer not found');
    // Guard: don't delete a customer referenced by any sales document — keeps
    // ledger/audit history intact.
    const refs = [
      ['sales', 'sales history'],
      ['sell_returns', 'sell-return history'],
    ] as const;
    for (const [table, label] of refs) {
      const c = db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE customer_id = ?`).get(id) as { c: number };
      if (c.c > 0) {
        throw new Error(`Cannot delete: customer has ${label}. Keep the record for audit history instead.`);
      }
    }
    assertNoBalance(db, 'customer', id);
    db.prepare('DELETE FROM fts_customers WHERE customer_id = ?').run(id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    logActivity(db, {
      by: userId,
      action: 'deleted',
      entity: 'customer',
      entityId: id,
      entityRef: row.phone ?? undefined,
      message: `Deleted customer: ${row.name}`,
    });
    return { id };
  });
}

// ---------- Suppliers ----------
export interface SupplierInput {
  id?: string;
  name: string;
  company?: string;
  contactPerson?: string;
  phone?: string;
  altPhone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  bankAccount?: string;
  leadTimeDays?: number;
  paymentTerms?: string;
  openingBalance?: number;
  tags?: string[];
  notes?: string;
  userId?: string;
}

function syncSupplierFts(db: DB, supplierId: string) {
  db.prepare('DELETE FROM fts_suppliers WHERE supplier_id = ?').run(supplierId);
  const s = db.prepare('SELECT name, company, phone FROM suppliers WHERE id = ?').get(supplierId) as
    | { name: string; company: string | null; phone: string | null }
    | undefined;
  if (s) {
    db.prepare('INSERT INTO fts_suppliers (supplier_id, name, company, phone) VALUES (?,?,?,?)').run(
      supplierId,
      s.name,
      s.company ?? '',
      s.phone ?? '',
    );
  }
}

export function createSupplier(db: DB, input: SupplierInput) {
  return tx(db, () => {
    const id = input.id ?? newId('sp');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO suppliers (id, name, company, contact_person, phone, alt_phone, email, address,
         tax_id, bank_account, lead_time_days, payment_terms, opening_balance, tags, notes, created_at)
       VALUES (@id, @name, @company, @contactPerson, @phone, @altPhone, @email, @address,
         @taxId, @bankAccount, @leadTimeDays, @paymentTerms, @openingBalance, @tags, @notes, @now)`,
    ).run({
      id,
      name: input.name,
      company: input.company ?? null,
      contactPerson: input.contactPerson ?? null,
      phone: input.phone ?? null,
      altPhone: input.altPhone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      taxId: input.taxId ?? null,
      bankAccount: input.bankAccount ?? null,
      leadTimeDays: input.leadTimeDays ?? null,
      paymentTerms: input.paymentTerms ?? null,
      openingBalance: balanceAmount(input.openingBalance ?? 0, 'The opening balance'),
      tags: input.tags ? JSON.stringify(input.tags) : null,
      notes: input.notes ?? null,
      now,
    });
    syncSupplierFts(db, id);

    logActivity(db, {
      by: input.userId,
      action: 'created',
      entity: 'supplier',
      entityId: id,
      entityRef: input.phone ?? undefined,
      message: `New supplier: ${input.name}`,
      at: now,
    });
    return { id };
  });
}

export function updateSupplier(
  db: DB,
  id: string,
  patch: Partial<SupplierInput> & { balanceReason?: string },
) {
  return tx(db, () => {
    const existing = db.prepare('SELECT id, name, opening_balance FROM suppliers WHERE id = ?').get(id) as
      | { id: string; name: string; opening_balance: number }
      | undefined;
    if (!existing) throw new Error('Supplier not found');
    const now = new Date().toISOString();
    const change = balanceChange(existing, patch);
    if (change?.openingChanged && !patch.balanceReason?.trim()) {
      throw new Error('Say why the opening balance is changing — it changes what the shop owes this supplier.');
    }
    if ('openingBalance' in patch) {
      patch = { ...patch, openingBalance: balanceAmount(patch.openingBalance, 'The opening balance') };
    }

    const colMap: Record<string, string> = {
      name: 'name',
      company: 'company',
      contactPerson: 'contact_person',
      phone: 'phone',
      altPhone: 'alt_phone',
      email: 'email',
      address: 'address',
      taxId: 'tax_id',
      bankAccount: 'bank_account',
      leadTimeDays: 'lead_time_days',
      paymentTerms: 'payment_terms',
      openingBalance: 'opening_balance',
      notes: 'notes',
    };
    const sets: string[] = [];
    const params: Record<string, unknown> = { id };
    for (const [k, col] of Object.entries(colMap)) {
      if (k in patch) {
        sets.push(`${col} = @${k}`);
        params[k] = (patch as Record<string, unknown>)[k] ?? null;
      }
    }
    if ('tags' in patch) {
      sets.push('tags = @tags');
      params.tags = patch.tags ? JSON.stringify(patch.tags) : null;
    }
    if (sets.length > 0) {
      db.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = @id`).run(params);
    }

    if ('name' in patch || 'company' in patch || 'phone' in patch) syncSupplierFts(db, id);

    logActivity(db, {
      by: patch.userId,
      action: 'edited',
      entity: 'supplier',
      entityId: id,
      entityRef: existing.name,
      message: change
        ? `Updated supplier: ${change.message}${patch.balanceReason?.trim() ? ` — ${patch.balanceReason.trim()}` : ''}`
        : 'Updated supplier',
      amount: change?.amount,
      at: now,
    });
    return { id };
  });
}

export function deleteSupplier(db: DB, id: string, userId?: string) {
  return tx(db, () => {
    const row = db.prepare('SELECT name, phone FROM suppliers WHERE id = ?').get(id) as
      | { name: string; phone: string | null }
      | undefined;
    if (!row) throw new Error('Supplier not found');
    // Guard: don't delete a supplier referenced by any purchase document.
    const refs = [
      ['purchases', 'purchase history'],
      ['purchase_returns', 'purchase-return history'],
    ] as const;
    for (const [table, label] of refs) {
      const c = db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE supplier_id = ?`).get(id) as { c: number };
      if (c.c > 0) {
        throw new Error(`Cannot delete: supplier has ${label}. Keep the record for audit history instead.`);
      }
    }
    assertNoBalance(db, 'supplier', id);
    db.prepare('DELETE FROM fts_suppliers WHERE supplier_id = ?').run(id);
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    logActivity(db, {
      by: userId,
      action: 'deleted',
      entity: 'supplier',
      entityId: id,
      entityRef: row.phone ?? undefined,
      message: `Deleted supplier: ${row.name}`,
    });
    return { id };
  });
}

// ---------- Supplier payment ----------
export interface PaySupplierInput {
  supplierId: string;
  amount: number;
  method: string;
  reference?: string;
  userId: string;
  /** Omitted → the shop's default branch (services/branch.ts). */
  branchId?: string;
  paidAt?: string;
  note?: string;
  /** Picked mode: how much goes to each bill (docId = purchase id). */
  allocations?: AccountAllocation[];
}

/**
 * Pay a supplier: the opening balance first, then the oldest open bills, and
 * anything left stays with the supplier as an advance — see services/accounts.ts.
 *
 * The remainder beyond the open bills used to be returned and NOT saved, so a
 * bank transfer larger than the bills left money the books never saw.
 */
export function paySupplier(db: DB, input: PaySupplierInput) {
  return payToSupplier(db, {
    partyId: input.supplierId,
    amount: input.amount,
    method: input.method,
    reference: input.reference,
    userId: input.userId,
    branchId: input.branchId,
    paidAt: input.paidAt,
    note: input.note,
    allocations: input.allocations,
  });
}
