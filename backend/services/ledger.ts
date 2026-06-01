import type { DB } from '../db/connection.ts';
import { round2 } from '../core/money.ts';

/**
 * Customer & supplier balances are DERIVED, never stored as a running column.
 *
 * Customer due = opening_balance
 *   + sum(final sale totals)          (what they owe us)
 *   - sum(sale payments)              (what they've paid)
 *   - sum(sell returns where refund = CreditAdjust)  (credited back against due)
 *
 * Note: cash/bKash/etc refunds give money back directly and do NOT reduce due;
 * only CreditAdjust returns reduce the customer's outstanding balance.
 */
export function customerDue(db: DB, customerId: string): number {
  const c = db.prepare('SELECT opening_balance FROM customers WHERE id = ?').get(customerId) as
    | { opening_balance: number }
    | undefined;
  if (!c) return 0;
  const sales = db
    .prepare("SELECT COALESCE(SUM(total),0) AS s FROM sales WHERE customer_id = ? AND status = 'final'")
    .get(customerId) as { s: number };
  const paid = db
    .prepare(
      `SELECT COALESCE(SUM(p.amount),0) AS s
         FROM sale_payments p JOIN sales sa ON sa.id = p.sale_id
        WHERE sa.customer_id = ? AND sa.status = 'final'`,
    )
    .get(customerId) as { s: number };
  const creditReturns = db
    .prepare(
      "SELECT COALESCE(SUM(total),0) AS s FROM sell_returns WHERE customer_id = ? AND refund_method = 'CreditAdjust'",
    )
    .get(customerId) as { s: number };

  return round2(c.opening_balance + sales.s - paid.s - creditReturns.s);
}

export function customerTotals(db: DB, customerId: string) {
  const sales = db
    .prepare("SELECT COALESCE(SUM(total),0) AS s, COUNT(*) AS c FROM sales WHERE customer_id = ? AND status = 'final'")
    .get(customerId) as { s: number; c: number };
  const paid = db
    .prepare(
      `SELECT COALESCE(SUM(p.amount),0) AS s FROM sale_payments p JOIN sales sa ON sa.id = p.sale_id WHERE sa.customer_id = ? AND sa.status = 'final'`,
    )
    .get(customerId) as { s: number };
  return {
    totalPurchase: round2(sales.s),
    saleCount: sales.c,
    totalPaid: round2(paid.s),
    due: customerDue(db, customerId),
  };
}

/**
 * Supplier due = opening_balance
 *   + sum(non-cancelled purchase totals)   (what we owe them)
 *   - sum(purchase payments)               (what we've paid)
 *   - sum(purchase returns CreditAdjust)   (credited against payable)
 */
export function supplierDue(db: DB, supplierId: string): number {
  const s = db.prepare('SELECT opening_balance FROM suppliers WHERE id = ?').get(supplierId) as
    | { opening_balance: number }
    | undefined;
  if (!s) return 0;
  const purchases = db
    .prepare("SELECT COALESCE(SUM(total),0) AS s FROM purchases WHERE supplier_id = ? AND status != 'cancelled'")
    .get(supplierId) as { s: number };
  const paid = db
    .prepare(
      `SELECT COALESCE(SUM(p.amount),0) AS s FROM purchase_payments p JOIN purchases pu ON pu.id = p.purchase_id WHERE pu.supplier_id = ? AND pu.status != 'cancelled'`,
    )
    .get(supplierId) as { s: number };
  const creditReturns = db
    .prepare(
      "SELECT COALESCE(SUM(total),0) AS s FROM purchase_returns WHERE supplier_id = ? AND refund_method = 'CreditAdjust'",
    )
    .get(supplierId) as { s: number };
  return round2(s.opening_balance + purchases.s - paid.s - creditReturns.s);
}

export function supplierTotals(db: DB, supplierId: string) {
  const purchases = db
    .prepare("SELECT COALESCE(SUM(total),0) AS s, COUNT(*) AS c FROM purchases WHERE supplier_id = ? AND status != 'cancelled'")
    .get(supplierId) as { s: number; c: number };
  const paid = db
    .prepare(
      `SELECT COALESCE(SUM(p.amount),0) AS s FROM purchase_payments p JOIN purchases pu ON pu.id = p.purchase_id WHERE pu.supplier_id = ? AND pu.status != 'cancelled'`,
    )
    .get(supplierId) as { s: number };
  return {
    totalPurchase: round2(purchases.s),
    purchaseCount: purchases.c,
    totalPaid: round2(paid.s),
    due: supplierDue(db, supplierId),
  };
}

/** Build a chronological running-balance ledger for a customer. */
export interface LedgerEntry {
  date: string;
  type: 'opening' | 'sale' | 'payment' | 'return';
  reference: string;
  debit: number;  // increases due
  credit: number; // decreases due
  balance: number;
}

export function customerLedger(db: DB, customerId: string): LedgerEntry[] {
  const c = db.prepare('SELECT opening_balance, joined FROM customers WHERE id = ?').get(customerId) as
    | { opening_balance: number; joined: string }
    | undefined;
  if (!c) return [];
  const events: Omit<LedgerEntry, 'balance'>[] = [];
  events.push({
    date: c.joined ?? '2000-01-01',
    type: 'opening',
    reference: 'Opening balance',
    debit: round2(c.opening_balance),
    credit: 0,
  });
  const sales = db
    .prepare("SELECT invoice_no, date, total FROM sales WHERE customer_id = ? AND status = 'final'")
    .all(customerId) as { invoice_no: string; date: string; total: number }[];
  for (const s of sales)
    events.push({ date: s.date, type: 'sale', reference: s.invoice_no, debit: round2(s.total), credit: 0 });
  const pays = db
    .prepare(
      `SELECT p.paid_at AS date, p.amount, sa.invoice_no FROM sale_payments p JOIN sales sa ON sa.id = p.sale_id WHERE sa.customer_id = ? AND sa.status = 'final'`,
    )
    .all(customerId) as { date: string; amount: number; invoice_no: string }[];
  for (const p of pays)
    events.push({ date: p.date, type: 'payment', reference: p.invoice_no, debit: 0, credit: round2(p.amount) });
  const rets = db
    .prepare("SELECT ref_no, date, total FROM sell_returns WHERE customer_id = ? AND refund_method = 'CreditAdjust'")
    .all(customerId) as { ref_no: string; date: string; total: number }[];
  for (const r of rets)
    events.push({ date: r.date, type: 'return', reference: r.ref_no, debit: 0, credit: round2(r.total) });

  events.sort((a, b) => a.date.localeCompare(b.date));
  let bal = 0;
  return events.map((e) => {
    bal = round2(bal + e.debit - e.credit);
    return { ...e, balance: bal };
  });
}
