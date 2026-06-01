import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { round2 } from '../core/money.ts';
import { addPurchasePayment } from './purchases.ts';
import { logActivity } from './activity.ts';

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
      openingBalance: round2(input.openingBalance ?? 0),
      creditLimit: input.creditLimit ?? null,
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

export function updateCustomer(db: DB, id: string, patch: Partial<CustomerInput>) {
  return tx(db, () => {
    const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
    if (!existing) throw new Error('Customer not found');
    const now = new Date().toISOString();

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
      message: `Updated customer`,
      at: now,
    });
    return { id };
  });
}

export function deleteCustomer(db: DB, id: string) {
  return tx(db, () => {
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
    db.prepare('DELETE FROM fts_customers WHERE customer_id = ?').run(id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
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
      openingBalance: round2(input.openingBalance ?? 0),
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

export function updateSupplier(db: DB, id: string, patch: Partial<SupplierInput>) {
  return tx(db, () => {
    const existing = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(id);
    if (!existing) throw new Error('Supplier not found');
    const now = new Date().toISOString();

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
      message: `Updated supplier`,
      at: now,
    });
    return { id };
  });
}

export function deleteSupplier(db: DB, id: string) {
  return tx(db, () => {
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
    db.prepare('DELETE FROM fts_suppliers WHERE supplier_id = ?').run(id);
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    return { id };
  });
}

// ---------- Supplier payment (auto-allocate oldest-first) ----------
export interface PaySupplierInput {
  supplierId: string;
  amount: number;
  method: string;
  reference?: string;
  userId: string;
  branchId: string;
  paidAt?: string;
}

/**
 * Pay a supplier by auto-allocating the amount oldest-first across that
 * supplier's OPEN bills (status != 'cancelled' AND due > 0). Each allocation is
 * persisted as a real purchase_payments row by reusing addPurchasePayment, so
 * the derived supplierDue recomputes correctly (and Cash payments post to the
 * open shift via addPurchasePayment's cash handling).
 *
 * DEFERRAL: any remainder beyond the open bills is NOT persisted — supplier
 * advance payments are not modeled yet (no advance/credit table). The remainder
 * is returned so callers can surface it, but it does not reduce any balance.
 */
export function paySupplier(db: DB, input: PaySupplierInput) {
  return tx(db, () => {
    const paidAt = input.paidAt ?? new Date().toISOString();
    // oldest-first across open bills of this supplier
    const bills = db
      .prepare(
        `SELECT id, total, paid FROM purchases
          WHERE supplier_id = ? AND status != 'cancelled' AND (total - paid) > 0
          ORDER BY date ASC, ref_no ASC`,
      )
      .all(input.supplierId) as { id: string; total: number; paid: number }[];

    let remaining = round2(input.amount);
    let allocated = 0;
    for (const bill of bills) {
      if (remaining <= 0) break;
      const billDue = round2(bill.total - bill.paid);
      if (billDue <= 0) continue;
      const apply = round2(Math.min(billDue, remaining));
      addPurchasePayment(
        db,
        bill.id,
        { method: input.method, amount: apply, reference: input.reference, paidAt },
        input.userId,
      );
      allocated = round2(allocated + apply);
      remaining = round2(remaining - apply);
    }

    logActivity(db, {
      by: input.userId,
      branchId: input.branchId,
      action: 'paid',
      entity: 'supplier',
      entityId: input.supplierId,
      message: `Supplier payment ${input.method} ${allocated}`,
      amount: allocated,
      at: paidAt,
    });

    return { allocated, remainder: round2(Math.max(0, remaining)) };
  });
}
