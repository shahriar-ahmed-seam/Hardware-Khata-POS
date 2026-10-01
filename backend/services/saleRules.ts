import type { DB } from '../db/connection.ts';
import { round2 } from '../core/money.ts';
import { isWalkIn } from '../core/validate.ts';
import { customerDue } from './ledger.ts';
import { previewSaleTotals, type SaleLineInput } from './sales.ts';

/**
 * THE COUNTER RULES A SALE MUST KEEP (R16, R29), checked in the main process
 * before `sales.create`, `sales.update` or `sales.convert` runs.
 *
 *  - A price below the catalogue needs the right to change prices
 *    (`pos.priceOverride`). "Below the catalogue" means under the cheapest of
 *    the product's retail, wholesale and contractor prices — the prices the
 *    counter offers by itself. A higher price (a markup) is not a loss.
 *  - A discount, on a line or on the bill, needs `pos.discount`.
 *  - A final sale that takes a customer's khata past their credit limit needs
 *    the owner or a manager.
 *
 * Until now all three were screen-only: the rights were never checked and the
 * credit limit was a warning, so a cashier could sell at any price, give any
 * discount and run up any balance.
 *
 * A correction or a conversion may keep what the document already had: a line
 * at the price (or discount) it was saved with is not a new override. That
 * keeps old sales editable after the catalogue price moved, and lets a
 * quotation made by the owner be converted by a cashier at the owner's price.
 *
 * What the sale did anyway (a price below the list, a limit passed by someone
 * allowed to) comes back as `notes`, which the caller writes into the sale's
 * audit and activity (see `withRuleNotes`).
 *
 * Enforcement stays out of the services themselves, like every other rule of
 * the IPC boundary: the verify harness and the seed call createSale directly.
 */

export const PRICE_BELOW_LIST_BLOCKED =
  'Selling below the list price needs the right to change prices. Ask the owner or a manager.';
export const DISCOUNT_BLOCKED =
  'Giving a discount needs the discount right. Ask the owner or a manager.';
export const CREDIT_LIMIT_BLOCKED =
  "This sale takes the customer's due past their credit limit. Take more now, or ask the owner or a manager.";

export interface SaleRights {
  /** pos.discount */
  discount: boolean;
  /** pos.priceOverride */
  priceOverride: boolean;
  /** Owner or manager (electron/guard.ts MANAGER_PERMISSION). */
  creditOverride: boolean;
}

export interface SaleRulesResult {
  error: string | null;
  notes: string[];
}

type Doc = {
  status?: string;
  customerId?: string | null;
  lines?: SaleLineInput[];
  orderDiscountPct?: number;
  orderDiscountFlat?: number;
  payments?: { amount: number }[];
};

interface PriorSale {
  status: string;
  customer_id: string | null;
  total: number;
  paid: number;
  order_discount_pct: number;
  order_discount_flat: number;
}

interface PriorLine {
  product_id: string;
  unit_price: number;
  unit_factor: number;
  discount_pct: number;
  discount_flat: number;
}

const SALE_CHANNELS = new Set(['sales.create', 'sales.update', 'sales.convert']);

export function isSaleRuleChannel(channel: string): boolean {
  return SALE_CHANNELS.has(channel);
}

/** The sale document a channel's payload carries, and the sale it replaces. */
function docOf(channel: string, payload: unknown): { doc: Doc; priorId?: string } | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  if (channel === 'sales.create') return { doc: p as Doc };
  const input = p.input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  return { doc: input as Doc, priorId: typeof p.saleId === 'string' ? p.saleId : undefined };
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const taka = (n: number) => `৳${round2(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export function saleRulesCheck(
  db: DB,
  channel: string,
  payload: unknown,
  rights: SaleRights,
): SaleRulesResult {
  const notes: string[] = [];
  if (!isSaleRuleChannel(channel)) return { error: null, notes };
  const found = docOf(channel, payload);
  // A malformed request is the handler's to refuse, with its own message.
  if (!found || !Array.isArray(found.doc.lines)) return { error: null, notes };
  const { doc, priorId } = found;

  const prior = priorId
    ? (db
        .prepare(
          `SELECT status, customer_id, total, paid, order_discount_pct, order_discount_flat
             FROM sales WHERE id = ?`,
        )
        .get(priorId) as PriorSale | undefined)
    : undefined;
  const priorLines = prior
    ? (db
        .prepare(
          'SELECT product_id, unit_price, unit_factor, discount_pct, discount_flat FROM sale_lines WHERE sale_id = ?',
        )
        .all(priorId) as PriorLine[])
    : [];
  const priorFor = (productId: string) => priorLines.filter((l) => l.product_id === productId);

  // ---------------------------------------------------------------- prices
  const product = db.prepare(
    'SELECT name, price, wholesale_price, contractor_price FROM products WHERE id = ?',
  );
  const below: string[] = [];
  let newDiscount = false;
  for (const l of doc.lines as SaleLineInput[]) {
    if (!l || typeof l !== 'object') continue;
    const p = product.get(l.productId) as
      | { name: string; price: number | null; wholesale_price: number | null; contractor_price: number | null }
      | undefined;
    if (!p) continue; // the handler says the product does not exist
    const earlier = priorFor(l.productId);
    const earlierFactor = earlier[0]?.unit_factor ?? 0;
    const factor = num(l.unitFactor) > 0 ? num(l.unitFactor) : earlierFactor > 0 ? earlierFactor : 1;
    const tiers = [p.price, p.wholesale_price, p.contractor_price].filter(
      (v): v is number => typeof v === 'number' && v > 0,
    );
    const floor = tiers.length ? round2(Math.min(...tiers) * factor) : 0;
    // The price the line is sold at before its discount, as computeSaleLine does.
    const sold = round2(num(l.spr) * (1 + num(l.markupPct) / 100));
    const keptPrice = earlier.some((e) => sold >= e.unit_price - 0.005);
    if (floor > 0 && sold < floor - 0.005 && !keptPrice) {
      below.push(`${p.name} ${taka(sold)} (list ${taka(floor)})`);
    }

    const dpct = num(l.discountPct);
    const dflat = num(l.discountFlat);
    if (dpct > 0 || dflat > 0) {
      const keptDiscount = earlier.some(
        (e) => dpct <= e.discount_pct + 1e-9 && dflat <= e.discount_flat + 0.005,
      );
      if (!keptDiscount) newDiscount = true;
    }
  }
  const odpct = num(doc.orderDiscountPct);
  const odflat = num(doc.orderDiscountFlat);
  if (odpct > 0 || odflat > 0) {
    const kept =
      !!prior && odpct <= prior.order_discount_pct + 1e-9 && odflat <= prior.order_discount_flat + 0.005;
    if (!kept) newDiscount = true;
  }

  if (newDiscount && !rights.discount) return { error: DISCOUNT_BLOCKED, notes: [] };
  if (below.length) {
    if (!rights.priceOverride) return { error: PRICE_BELOW_LIST_BLOCKED, notes: [] };
    notes.push(`below the list price: ${below.join(', ')}`);
  }

  // ---------------------------------------------------------- credit limit
  const status =
    channel === 'sales.convert' ? 'final' : (doc.status ?? (prior ? prior.status : 'final'));
  const customerId = doc.customerId ?? null;
  if (status !== 'final' || isWalkIn(customerId)) return { error: null, notes };
  const customer = db.prepare('SELECT name, credit_limit FROM customers WHERE id = ?').get(customerId) as
    | { name: string; credit_limit: number | null }
    | undefined;
  // No limit set (the form saves an empty or zero limit as none).
  const limit = customer?.credit_limit ?? 0;
  if (!customer || !(limit > 0)) return { error: null, notes };

  let preview: { total: number; paid: number };
  try {
    preview = previewSaleTotals(db, doc as Parameters<typeof previewSaleTotals>[1], {
      priorProducts: new Set(priorLines.map((l) => l.product_id)),
    });
  } catch {
    // The handler refuses the same input with its own message.
    return { error: null, notes };
  }
  // A correction that sends no payments keeps the ones on the sale.
  const paid =
    doc.payments === undefined && prior && prior.status === 'final' ? prior.paid : preview.paid;
  const adds = round2(preview.total - paid);
  const before = customerDue(db, customerId as string);
  const replaces =
    prior && prior.status === 'final' && prior.customer_id === customerId
      ? round2(prior.total - prior.paid)
      : 0;
  const after = round2(before - replaces + adds);
  // Only a sale that RAISES the balance past the limit is stopped: a
  // correction that lowers an already-high balance goes through.
  if (after > limit + 0.005 && after > before + 0.005) {
    if (!rights.creditOverride) return { error: CREDIT_LIMIT_BLOCKED, notes: [] };
    notes.push(`over the credit limit: due becomes ${taka(after)}, limit ${taka(limit)}`);
  }
  return { error: null, notes };
}

/**
 * The payload with the rule notes in place. Always written — an empty list
 * clears whatever the screen sent, so the audit only ever carries what the
 * main process found.
 */
export function withRuleNotes(channel: string, payload: unknown, notes: string[]): unknown {
  if (!isSaleRuleChannel(channel)) return payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const p = payload as Record<string, unknown>;
  const value = notes.length ? [...notes] : undefined;
  if (channel === 'sales.create') return { ...p, ruleNotes: value };
  const input = p.input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return payload;
  return { ...p, input: { ...(input as Record<string, unknown>), ruleNotes: value } };
}
