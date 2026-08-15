import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { round2 } from '../core/money.ts';
import { logActivity } from './activity.ts';

/**
 * PURCHASE-PRICE (COST) HISTORY
 *
 * WHY THIS EXISTS
 * A hardware shop's buying price moves constantly: 10 pieces at ৳100 a few
 * months ago, 20 pieces at ৳120 today. `products.cost` only ever held ONE
 * number, there was no way to edit it from the shop floor at all (the product
 * form's cost field is buried in a 25-field editor), and the previous price was
 * simply overwritten and lost. The owner could see how the SELLING price had
 * been changed but had no record of what they had actually been paying.
 *
 * THE MODEL
 *   product_cost_history  — append-only, one row per price change. SOURCE OF TRUTH.
 *   products.cost         — the newest entry's cost, i.e. the CURRENT buying price.
 *   products.cost_updated_at — when that entry was recorded.
 *   products.avg_cost     — the mean of every entry.
 *
 * The three product columns are a CACHE. They are never incremented in place:
 * every write recomputes them from the full history, so they cannot drift, and
 * `backend/verify/costing.ts` asserts that identity directly.
 *
 * WHY A SIMPLE MEAN, AND NOT A QUANTITY-WEIGHTED ONE
 * This is the "average purchase price" the owner asked for: the average of the
 * prices they have paid, answering "what do I normally pay for this?". The entry
 * form takes a price, not a quantity, so there is nothing to weight by.
 *
 * It is deliberately NOT the same figure as `weightedAvgCost()` in stock.ts,
 * which IS quantity-weighted (Σ qty×cost ÷ Σ qty over inbound movements) and is
 * what COGS and stock valuation use. Those two must not be conflated: COGS has
 * to reflect the cost of the specific goods sold, and that is verified money
 * math. This average is a purchasing reference figure for the owner.
 */

/**
 * Where a recorded buying price came from.
 *   'manual'   — typed into Update Price & Stock
 *   'initial'  — the product's opening cost, captured when it was created
 *   'purchase' — the unit cost on a RECEIVED purchase line (see
 *                services/purchases.ts). This one is why the average moves on
 *                its own: the shop's real buying price changes when they buy,
 *                not when someone remembers to retype it.
 *
 * The column has no CHECK constraint, so adding a value here is schema-safe on
 * an existing database — no migration needed.
 */
export type CostSource = 'manual' | 'initial' | 'purchase';

export interface CostHistoryEntry {
  id: string;
  productId: string;
  cost: number;
  at: string;
  userId: string | null;
  userName: string | null;
  source: CostSource;
  note: string | null;
}

export interface CostInfo {
  /** Current buying price (products.cost). */
  cost: number;
  /** When the current buying price was recorded. Null for pre-history products. */
  costUpdatedAt: string | null;
  /** Mean of every recorded buying price. */
  avgCost: number;
  /** How many price changes are on record. */
  entryCount: number;
}

/**
 * Mean of every recorded buying price, rounded to 2dp.
 *
 * Falls back to the product's current `cost` when there is no history yet — a
 * product created before this feature has a cost but no entries, and reporting
 * an average of 0 for it would be a lie.
 */
export function computeAvgCost(db: DB, productId: string): number {
  const row = db
    .prepare(
      'SELECT COUNT(*) AS n, COALESCE(AVG(cost), 0) AS a FROM product_cost_history WHERE product_id = ?',
    )
    .get(productId) as { n: number; a: number };
  if (row.n > 0) return round2(row.a);
  const p = db.prepare('SELECT cost FROM products WHERE id = ?').get(productId) as
    | { cost: number }
    | undefined;
  return round2(p?.cost ?? 0);
}

/**
 * Refresh the cached columns on `products` from the history table.
 *
 * `cost` and `cost_updated_at` come from the NEWEST entry so the current buying
 * price always matches the latest thing recorded. Ordered by `at` then `rowid`
 * so two entries in the same millisecond still resolve deterministically.
 */
function syncProductCostCache(db: DB, productId: string): CostInfo {
  const newest = db
    .prepare(
      `SELECT cost, at FROM product_cost_history
        WHERE product_id = ?
        ORDER BY at DESC, rowid DESC
        LIMIT 1`,
    )
    .get(productId) as { cost: number; at: string } | undefined;

  const avg = computeAvgCost(db, productId);
  const count = (
    db
      .prepare('SELECT COUNT(*) AS n FROM product_cost_history WHERE product_id = ?')
      .get(productId) as { n: number }
  ).n;

  if (newest) {
    db.prepare(
      'UPDATE products SET cost = @cost, cost_updated_at = @at, avg_cost = @avg, updated_at = @now WHERE id = @id',
    ).run({ id: productId, cost: round2(newest.cost), at: newest.at, avg, now: new Date().toISOString() });
    return { cost: round2(newest.cost), costUpdatedAt: newest.at, avgCost: avg, entryCount: count };
  }

  // No history: leave `cost` alone (it is the product's own opening cost) and
  // just make the average agree with it.
  db.prepare('UPDATE products SET avg_cost = @avg WHERE id = @id').run({ id: productId, avg });
  const p = db.prepare('SELECT cost, cost_updated_at FROM products WHERE id = ?').get(productId) as
    | { cost: number; cost_updated_at: string | null }
    | undefined;
  return {
    cost: round2(p?.cost ?? 0),
    costUpdatedAt: p?.cost_updated_at ?? null,
    avgCost: avg,
    entryCount: 0,
  };
}

export interface SetCostInput {
  productId: string;
  cost: number;
  userId?: string;
  note?: string;
  source?: CostSource;
  /** Test/seed hook. Defaults to now. */
  at?: string;
}

/**
 * Record a new buying price.
 *
 * Appends to the history, then recomputes the cached columns. Wrapped in a
 * transaction so a product can never end up with an entry but a stale cache.
 */
export function setProductCost(db: DB, input: SetCostInput): CostInfo {
  const cost = round2(Number(input.cost));
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error('Buying price must be zero or more');
  }
  return tx(db, () => {
    const product = db
      .prepare('SELECT id, name, cost FROM products WHERE id = ?')
      .get(input.productId) as { id: string; name: string; cost: number } | undefined;
    if (!product) throw new Error('Product not found');

    const at = input.at ?? new Date().toISOString();

    // A product created before this feature has an opening cost but no history.
    // Capture it as the first entry so the average and the history reflect what
    // the shop was actually paying, instead of starting from the new price.
    const hasHistory =
      (
        db
          .prepare('SELECT COUNT(*) AS n FROM product_cost_history WHERE product_id = ?')
          .get(input.productId) as { n: number }
      ).n > 0;
    if (!hasHistory && product.cost > 0) {
      db.prepare(
        `INSERT INTO product_cost_history (id, product_id, cost, at, user_id, source, note)
         VALUES (@id, @productId, @cost, @at, @userId, 'initial', @note)`,
      ).run({
        id: newId('pch'),
        productId: input.productId,
        cost: round2(product.cost),
        // Dated before the new entry so ordering stays correct.
        at: new Date(new Date(at).getTime() - 1000).toISOString(),
        userId: null,
        note: 'Opening buying price',
      });
    }

    db.prepare(
      `INSERT INTO product_cost_history (id, product_id, cost, at, user_id, source, note)
       VALUES (@id, @productId, @cost, @at, @userId, @source, @note)`,
    ).run({
      id: newId('pch'),
      productId: input.productId,
      cost,
      at,
      userId: input.userId ?? null,
      source: input.source ?? 'manual',
      note: input.note ?? null,
    });

    const info = syncProductCostCache(db, input.productId);

    // A purchase already writes its own activity entry (and its own audit row),
    // so logging every line here as well would bury the shop's activity feed
    // under one "Buying price set to …" per item on every goods-received note.
    if ((input.source ?? 'manual') !== 'purchase') {
      logActivity(db, {
        by: input.userId,
        action: 'edited',
        entity: 'product',
        entityId: input.productId,
        message: `Buying price set to ${cost}`,
        at,
      });
    }

    return info;
  });
}

/** Newest-first price history for one product, with who recorded each change. */
export function listCostHistory(db: DB, productId: string, limit = 50): CostHistoryEntry[] {
  const rows = db
    .prepare(
      `SELECT h.id, h.product_id, h.cost, h.at, h.user_id, h.source, h.note, u.name AS user_name
         FROM product_cost_history h
         LEFT JOIN users u ON u.id = h.user_id
        WHERE h.product_id = ?
        ORDER BY h.at DESC, h.rowid DESC
        LIMIT ?`,
    )
    .all(productId, Math.min(Math.max(1, limit), 200)) as {
    id: string;
    product_id: string;
    cost: number;
    at: string;
    user_id: string | null;
    source: string;
    note: string | null;
    user_name: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    cost: round2(r.cost),
    at: r.at,
    userId: r.user_id,
    userName: r.user_name,
    source: (r.source === 'initial' || r.source === 'purchase' ? r.source : 'manual') as CostSource,
    note: r.note,
  }));
}

/** Current buying price + average + how many changes are on record. */
export function costInfo(db: DB, productId: string): CostInfo {
  const p = db
    .prepare('SELECT cost, avg_cost, cost_updated_at FROM products WHERE id = ?')
    .get(productId) as
    | { cost: number; avg_cost: number; cost_updated_at: string | null }
    | undefined;
  if (!p) throw new Error('Product not found');
  const count = (
    db
      .prepare('SELECT COUNT(*) AS n FROM product_cost_history WHERE product_id = ?')
      .get(productId) as { n: number }
  ).n;
  return {
    cost: round2(p.cost),
    costUpdatedAt: p.cost_updated_at,
    avgCost: round2(p.avg_cost),
    entryCount: count,
  };
}
