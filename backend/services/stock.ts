import type { DB } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { round2 } from '../core/money.ts';

/**
 * Stock is NEVER stored as a column. It is always SUM(qty) of stock_movements
 * for a (product, branch). This guarantees stock can always be reconstructed
 * and audited, and that every change has a traceable reason.
 */

export interface MovementInput {
  productId: string;
  branchId: string;
  reason: string;
  qty: number;       // signed
  unit?: string;
  unitCost?: number;
  refType?: string;
  refId?: string;
  refNo?: string;
  note?: string;
  userId?: string;
  at?: string;
}

export function recordMovement(db: DB, m: MovementInput): string {
  const id = newId('mov');
  db.prepare(
    `INSERT INTO stock_movements
       (id, product_id, branch_id, reason, qty, unit, unit_cost, ref_type, ref_id, ref_no, note, user_id, at)
     VALUES (@id, @productId, @branchId, @reason, @qty, @unit, @unitCost, @refType, @refId, @refNo, @note, @userId, @at)`,
  ).run({
    id,
    productId: m.productId,
    branchId: m.branchId,
    reason: m.reason,
    qty: m.qty,
    unit: m.unit ?? 'pc',
    unitCost: m.unitCost ?? 0,
    refType: m.refType ?? null,
    refId: m.refId ?? null,
    refNo: m.refNo ?? null,
    note: m.note ?? null,
    userId: m.userId ?? null,
    at: m.at ?? new Date().toISOString(),
  });
  return id;
}

/** Stock on hand for one product at one branch (or all branches if branchId omitted). */
export function stockOnHand(db: DB, productId: string, branchId?: string): number {
  const row = branchId
    ? (db
        .prepare('SELECT COALESCE(SUM(qty),0) AS s FROM stock_movements WHERE product_id = ? AND branch_id = ?')
        .get(productId, branchId) as { s: number })
    : (db
        .prepare('SELECT COALESCE(SUM(qty),0) AS s FROM stock_movements WHERE product_id = ?')
        .get(productId) as { s: number });
  return round2(row.s);
}

/** Stock on hand for every product (optionally scoped to a branch). */
export function stockLevels(db: DB, branchId?: string): Map<string, number> {
  const rows = branchId
    ? (db
        .prepare('SELECT product_id, COALESCE(SUM(qty),0) AS s FROM stock_movements WHERE branch_id = ? GROUP BY product_id')
        .all(branchId) as { product_id: string; s: number }[])
    : (db
        .prepare('SELECT product_id, COALESCE(SUM(qty),0) AS s FROM stock_movements GROUP BY product_id')
        .all() as { product_id: string; s: number }[]);
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.product_id, round2(r.s));
  return map;
}

/**
 * Weighted-average cost of a product from purchase + opening movements.
 * Used as `unit_cost_at_sale` when a sale doesn't carry an explicit cost.
 * Falls back to the product's `cost` column when there are no inbound movements.
 */
export function weightedAvgCost(db: DB, productId: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(qty),0) AS q, COALESCE(SUM(qty * unit_cost),0) AS v
         FROM stock_movements
        WHERE product_id = ? AND reason IN ('purchase','opening_stock','transfer_in','recount') AND qty > 0`,
    )
    .get(productId) as { q: number; v: number };
  if (row.q > 0) return round2(row.v / row.q);
  const p = db.prepare('SELECT cost FROM products WHERE id = ?').get(productId) as
    | { cost: number }
    | undefined;
  return round2(p?.cost ?? 0);
}

/** Total stock valuation across all products (at cost or at retail). */
export function stockValuation(db: DB, basis: 'cost' | 'retail', branchId?: string): number {
  const levels = stockLevels(db, branchId);
  let total = 0;
  const priceStmt = db.prepare('SELECT cost, price FROM products WHERE id = ?');
  for (const [productId, qty] of levels) {
    if (qty === 0) continue;
    const p = priceStmt.get(productId) as { cost: number; price: number } | undefined;
    if (!p) continue;
    total += qty * (basis === 'cost' ? p.cost : p.price);
  }
  return round2(total);
}
