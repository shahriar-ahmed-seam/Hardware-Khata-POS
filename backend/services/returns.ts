import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { round2, sum2, clampZero } from '../core/money.ts';
import { computeReturnRefund } from '../core/calc.ts';
import { recordMovement, weightedAvgCost } from './stock.ts';
import { postCashToOpenShift } from './cash.ts';
import { logActivity } from './activity.ts';
import { nextRef } from './sequences.ts';
import { shopBranchId } from './branch.ts';

// ---------- Sell return ----------
export interface SellReturnLineInput {
  productId: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  refundAmount: number;
}

export interface CreateSellReturnInput {
  saleId?: string;
  date?: string;
  customerId?: string;
  /** Omitted → the sale's/bill's branch, else the shop's default (services/branch.ts). */
  branchId?: string;
  userId: string;
  reason?: string;
  refundMethod: string; // Cash|Card|bKash|Nagad|Bank|CreditAdjust|StoreCredit
  lines: SellReturnLineInput[];
  notes?: string;
}

// ---------- how much has already come back ----------

/**
 * Quantity already returned against a sale, per product, in the SALE's units
 * (base units ÷ the line's factor). The return screen caps each line at what is
 * left, so it offers only what `createSellReturn` will accept.
 */
export function returnedOnSale(db: DB, saleId: string): Record<string, number> {
  const factor = new Map<string, number>();
  for (const l of db
    .prepare('SELECT product_id, unit_factor FROM sale_lines WHERE sale_id = ? ORDER BY line_no')
    .all(saleId) as { product_id: string; unit_factor: number }[]) {
    if (!factor.has(l.product_id)) factor.set(l.product_id, l.unit_factor > 0 ? l.unit_factor : 1);
  }
  const out: Record<string, number> = {};
  for (const r of db
    .prepare(
      `SELECT product_id, SUM(qty) AS base FROM stock_movements
        WHERE ref_type = 'sale' AND ref_id = ? AND reason = 'sale_return' GROUP BY product_id`,
    )
    .all(saleId) as { product_id: string; base: number }[]) {
    out[r.product_id] = round2(r.base / (factor.get(r.product_id) ?? 1));
  }
  return out;
}

/** The purchase-side twin: quantity already sent back, in the BILL's units. */
export function returnedOnPurchase(db: DB, purchaseId: string): Record<string, number> {
  const factor = new Map<string, number>();
  for (const l of db
    .prepare('SELECT product_id, unit_factor FROM purchase_lines WHERE purchase_id = ? ORDER BY line_no')
    .all(purchaseId) as { product_id: string; unit_factor: number }[]) {
    if (!factor.has(l.product_id)) factor.set(l.product_id, l.unit_factor > 0 ? l.unit_factor : 1);
  }
  const out: Record<string, number> = {};
  for (const r of db
    .prepare(
      `SELECT product_id, -SUM(qty) AS base FROM stock_movements
        WHERE ref_type = 'purchase' AND ref_id = ? AND reason = 'purchase_return' GROUP BY product_id`,
    )
    .all(purchaseId) as { product_id: string; base: number }[]) {
    out[r.product_id] = round2(r.base / (factor.get(r.product_id) ?? 1));
  }
  return out;
}

// ---------- guards shared by both kinds of return ----------

/** Every line must return something real and refund a sane amount. */
function assertReturnLines(lines: { productId: string; qty: number; refundAmount: number }[]) {
  if (!lines || lines.length === 0) throw new Error('A return needs at least one item.');
  for (const l of lines) {
    if (!Number.isFinite(l.qty) || l.qty <= 0) {
      throw new Error('Each returned item needs a quantity above zero.');
    }
    if (!Number.isFinite(l.refundAmount) || l.refundAmount < 0) {
      throw new Error('A refund cannot be negative.');
    }
  }
}

/** Sum a return's quantities per product (the same product may be on two lines). */
function qtyByProduct(lines: { productId: string; qty: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty);
  return m;
}

/** What a document holds per product: base units, the line's factor, and a price ceiling. */
interface DocLine {
  name: string;
  /** Total in BASE units across every line of the document for this product. */
  base: number;
  /** Units per document unit on the first line for this product (12 for a dozen). */
  factor: number;
  /** Highest per-document-unit value on any line — the refund ceiling per unit. */
  maxUnitValue: number;
}

/**
 * Refuse a return that takes back more than the document holds.
 *
 * Nothing used to stop the same item being returned again and again: a sale of
 * 10 could be "returned" 10 at a time forever, each time putting 10 on the shelf
 * that never came back and refunding money that was never paid. The limit is
 * what the document holds minus what earlier returns against it already took,
 * counted in BASE units from the stock ledger (the same source of truth as
 * stock itself), so pack sizes cannot confuse it.
 */
function assertReturnable(
  docLines: Map<string, DocLine>,
  alreadyBase: Map<string, number>,
  wanted: Map<string, number>,
  docRef: string,
) {
  for (const [productId, qty] of wanted) {
    const d = docLines.get(productId);
    if (!d) throw new Error(`That item is not on ${docRef}.`);
    const already = alreadyBase.get(productId) ?? 0;
    const left = Math.max(0, d.base - already);
    if (qty * d.factor > left + 1e-9) {
      const leftInDocUnits = round2(left / d.factor);
      throw new Error(
        `Only ${leftInDocUnits} of ${d.name} can still be returned on ${docRef} ` +
          `(${round2(d.base / d.factor)} on the document, ${round2(already / d.factor)} already returned).`,
      );
    }
  }
}

/** A refund may not exceed what the returned quantity was worth on the document. */
function assertRefundWithinValue(
  lines: { productId: string; qty: number; refundAmount: number }[],
  docLines: Map<string, DocLine>,
) {
  for (const l of lines) {
    const d = docLines.get(l.productId);
    if (!d) continue;
    const ceiling = round2(l.qty * d.maxUnitValue);
    // A paisa of tolerance: the per-unit figure is a proportion of rounded
    // numbers, so qty × perUnit can land a paisa either side of the screen's.
    if (round2(l.refundAmount) > ceiling + 0.011) {
      throw new Error(
        `The refund for ${d.name} (${round2(l.refundAmount)}) is more than those items were worth (${ceiling}).`,
      );
    }
  }
}

/**
 * A REFUND CAN NEVER HAND BACK MORE THAN THE DOCUMENT SETTLED.
 *
 * The value ceiling (what the goods were worth) was not enough. A cash refund
 * on an unpaid credit invoice took cash out of the drawer for goods the shop
 * was never paid for, while the invoice kept its full due. A credit note bigger
 * than what was still owed clamped the invoice at zero but came off the
 * customer's khata in full — a hidden negative balance.
 *
 *  - Money back (cash, bKash, bank, card, store credit): at most what was PAID,
 *    less what earlier money-back returns on the same document already gave.
 *  - A credit note (CreditAdjust): at most what is still OWED on it.
 *
 * Return the rest by the other method, as a second return.
 */
function assertRefundWithinSettlement(
  db: DB,
  kind: 'sale' | 'purchase',
  docId: string,
  method: string,
  total: number,
) {
  const doc = (
    kind === 'sale'
      ? db.prepare('SELECT paid, due FROM sales WHERE id = ?').get(docId)
      : db.prepare('SELECT paid, due FROM purchases WHERE id = ?').get(docId)
  ) as { paid: number; due: number } | undefined;
  if (!doc) return;
  if (method === 'CreditAdjust') {
    if (total > doc.due + 0.011) {
      throw new Error(
        doc.due <= 0.004
          ? 'Nothing is owed on this bill, so a credit note has nothing to settle. Refund it another way.'
          : `A credit note can settle at most the ${round2(doc.due)} still owed. Refund the rest another way, as a second return.`,
      );
    }
    return;
  }
  const earlier = (
    kind === 'sale'
      ? db
          .prepare(
            "SELECT COALESCE(SUM(total),0) AS s FROM sell_returns WHERE sale_id = ? AND refund_method != 'CreditAdjust'",
          )
          .get(docId)
      : db
          .prepare(
            "SELECT COALESCE(SUM(total),0) AS s FROM purchase_returns WHERE purchase_id = ? AND refund_method != 'CreditAdjust'",
          )
          .get(docId)
  ) as { s: number };
  const room = round2(doc.paid - earlier.s);
  if (total > room + 0.011) {
    throw new Error(
      room <= 0.004
        ? kind === 'sale'
          ? 'No money was paid on this invoice, so there is nothing to hand back. Use a credit note to take it off what is owed.'
          : 'Nothing was paid on this bill, so there is no money to get back. Use a credit note to take it off what is owed.'
        : `At most ${room} can be handed back — that is what was paid. Put the rest on a credit note, as a second return.`,
    );
  }
}

export function createSellReturn(db: DB, input: CreateSellReturnInput) {
  return tx(db, () => {
    assertReturnLines(input.lines);
    // A return with no invoice skipped every guard: any quantity back on the
    // shelf, any amount out of the drawer. Every return is against a sale.
    if (!input.saleId) {
      throw new Error('A return must be made against the sale it came from.');
    }
    const sale = input.saleId
      ? (db
          .prepare('SELECT invoice_no, customer_id, status, branch_id FROM sales WHERE id = ?')
          .get(input.saleId) as
          | { invoice_no: string; customer_id: string | null; status: string; branch_id: string }
          | undefined)
      : undefined;
    if (input.saleId && !sale) throw new Error('Sale not found');
    // The goods and any cash go back to the branch that SOLD them, unless the
    // caller names another. The screen used to send the literal 'br_mp'.
    const branchId = shopBranchId(db, input.branchId || sale?.branch_id);
    input = { ...input, branchId };

    /**
     * Only a FINAL sale can take goods back. A draft or quotation never took
     * anything off the shelf, so a "return" on one put stock into the shop out of
     * thin air; a voided sale has already put everything back.
     */
    if (sale && sale.status !== 'final') {
      throw new Error(`${sale.invoice_no} is a ${sale.status} — only a final sale can take a return.`);
    }

    // What the sale holds, per product, and what has already come back.
    const docLines = new Map<string, DocLine>();
    if (input.saleId && sale) {
      const rows = db
        .prepare(
          `SELECT product_id, name_at_sale AS name, qty, unit_factor, line_subtotal
             FROM sale_lines WHERE sale_id = ? ORDER BY line_no`,
        )
        .all(input.saleId) as {
        product_id: string;
        name: string;
        qty: number;
        unit_factor: number;
        line_subtotal: number;
      }[];
      const head = db
        .prepare('SELECT subtotal, order_discount, tax_pct FROM sales WHERE id = ?')
        .get(input.saleId) as { subtotal: number; order_discount: number; tax_pct: number };
      for (const r of rows) {
        const factor = r.unit_factor > 0 ? r.unit_factor : 1;
        // The ceiling per unit is what the customer PAID for one: the line's net
        // price, less its share of the order discount, plus VAT — the same figure
        // the return screen offers (computeReturnRefund / lib/money returnRefund).
        const perUnit =
          r.qty > 0
            ? computeReturnRefund({
                lineSubtotal: r.line_subtotal,
                lineQty: r.qty,
                returnQty: r.qty,
                subtotal: head.subtotal,
                orderDiscount: head.order_discount,
                taxPct: head.tax_pct,
              }) / r.qty
            : 0;
        const d = docLines.get(r.product_id);
        if (d) {
          d.base += r.qty * factor;
          d.maxUnitValue = Math.max(d.maxUnitValue, perUnit);
        } else {
          docLines.set(r.product_id, {
            name: r.name,
            base: r.qty * factor,
            factor,
            maxUnitValue: perUnit,
          });
        }
      }
      const already = db
        .prepare(
          `SELECT product_id, SUM(qty) AS base FROM stock_movements
            WHERE ref_type = 'sale' AND ref_id = ? AND reason = 'sale_return'
            GROUP BY product_id`,
        )
        .all(input.saleId) as { product_id: string; base: number }[];
      assertReturnable(
        docLines,
        new Map(already.map((a) => [a.product_id, a.base])),
        qtyByProduct(input.lines),
        sale.invoice_no,
      );
      assertRefundWithinValue(input.lines, docLines);
    }

    // Inherit the customer from the source sale when not explicitly provided.
    const customerId = input.customerId ?? sale?.customer_id ?? undefined;

    /**
     * Store credit and a credit note both belong to SOMEONE. On a walk-in sale
     * there is nobody to hold them: the store-credit branch below silently wrote
     * nothing, and a credit note on a paid walk-in invoice settled a due that did
     * not exist — either way the customer left with nothing and the books said
     * they had been refunded. Same principle as "বাকি needs a name".
     */
    if ((input.refundMethod === 'StoreCredit' || input.refundMethod === 'CreditAdjust') && !customerId) {
      throw new Error('Store credit or a credit note needs a named customer. Refund a walk-in sale in cash.');
    }

    const id = newId('ret');
    const date = input.date ?? new Date().toISOString();
    const refNo = nextRef(db, 'return');
    const total = sum2(input.lines.map((l) => l.refundAmount));
    if (input.saleId) {
      assertRefundWithinSettlement(db, 'sale', input.saleId, input.refundMethod, total);
    }
    const customerName =
      (db.prepare('SELECT name FROM customers WHERE id = ?').get(customerId ?? '') as
        | { name: string }
        | undefined)?.name ?? 'Walk-in Customer';

    db.prepare(
      `INSERT INTO sell_returns (id, ref_no, sale_id, sale_invoice_no, date, customer_id, branch_id, user_id, reason, refund_method, total, notes, manual)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      refNo,
      input.saleId ?? null,
      sale?.invoice_no ?? null,
      date,
      customerId ?? null,
      branchId,
      input.userId,
      input.reason ?? null,
      input.refundMethod,
      total,
      input.notes ?? null,
      input.saleId ? 0 : 1,
    );

    const lineStmt = db.prepare(
      `INSERT INTO sell_return_lines (id, return_id, product_id, name_at_return, sku_at_return, qty, unit, unit_price, unit_cost, refund_amount)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const l of input.lines) {
      const prod = db.prepare('SELECT name, sku FROM products WHERE id = ?').get(l.productId) as
        | { name: string; sku: string }
        | undefined;
      const cost = weightedAvgCost(db, l.productId);
      lineStmt.run(
        newId('rl'),
        id,
        l.productId,
        prod?.name ?? null,
        prod?.sku ?? null,
        l.qty,
        l.unit ?? 'pc',
        l.unitPrice,
        cost,
        round2(l.refundAmount),
      );
      // Stock comes back in BASE units: the return is counted in the unit the
      // sale line was sold in (rule 28), and a pack holds `factor` pieces.
      const factor = docLines.get(l.productId)?.factor ?? 1;
      recordMovement(db, {
        productId: l.productId,
        branchId: branchId,
        reason: 'sale_return',
        qty: +(l.qty * factor),
        unit: factor > 1 ? 'pc' : (l.unit ?? 'pc'),
        unitCost: cost,
        refType: 'sale',
        refId: input.saleId ?? id,
        refNo,
        userId: input.userId,
        at: date,
      });
    }

    // refund handling
    if (input.refundMethod === 'Cash') {
      postCashToOpenShift(db, branchId, {
        direction: 'out',
        reason: 'refund',
        amount: total,
        refType: 'return',
        refId: id,
        userId: input.userId,
        at: date,
      });
    } else if (input.refundMethod === 'StoreCredit' && customerId) {
      db.prepare('UPDATE customers SET store_credit = store_credit + ? WHERE id = ?').run(
        total,
        customerId,
      );
    }
    /**
     * A CreditAdjust return settles part of the INVOICE, not just the customer's
     * balance.
     *
     * It used to only affect `customerDue` (which subtracts CreditAdjust returns),
     * while the sale row kept its original `due`. The two then disagreed for ever:
     * a ৳20,000 credit sale with a ৳6,000 credit return showed the customer owing
     * ৳14,000 and the invoice still reading "Unpaid ৳20,000". Worse, collecting
     * that ৳14,000 left the invoice stuck at ৳6,000 permanently — the missing
     * amount existed only as a return row, so no payment could ever clear it, and
     * `ReceivePaymentModal` allocates against `sales.due`.
     *
     * `credited` is deliberately a separate column from `paid`: no money arrived,
     * so it must not appear in "money received" anywhere. `due` accounts for both.
     */
    if (input.refundMethod === 'CreditAdjust' && input.saleId) {
      db.prepare(
        `UPDATE sales
            SET credited = ROUND(credited + ?, 2),
                due = MAX(0, ROUND(total - paid - (credited + ?), 2)),
                updated_at = ?
          WHERE id = ? AND status = 'final'`,
      ).run(total, total, date, input.saleId);
    }

    // link to sale audit
    if (input.saleId) {
      db.prepare(`INSERT INTO sale_audit (id, sale_id, at, by_user, action, note) VALUES (?,?,?,?,?,?)`).run(
        newId('au'),
        input.saleId,
        date,
        input.userId,
        'returned',
        refNo,
      );
    }
    logActivity(db, {
      by: input.userId,
      branchId: branchId,
      action: 'returned',
      entity: 'return',
      entityId: id,
      entityRef: refNo,
      message: `Return processed${sale ? ' for ' + sale.invoice_no : ''}`,
      amount: total,
      at: date,
    });

    return { id, refNo, total };
  });
}

// ---------- Purchase return ----------
export interface PurchaseReturnLineInput {
  productId: string;
  qty: number;
  unit?: string;
  unitCost: number;
  refundAmount: number;
}

export interface CreatePurchaseReturnInput {
  purchaseId?: string;
  date?: string;
  supplierId?: string;
  /** Omitted → the sale's/bill's branch, else the shop's default (services/branch.ts). */
  branchId?: string;
  userId: string;
  reason?: string;
  refundMethod: string; // CashRefund|CreditAdjust|Bank|bKash|Nagad
  lines: PurchaseReturnLineInput[];
  notes?: string;
}

export function createPurchaseReturn(db: DB, input: CreatePurchaseReturnInput) {
  return tx(db, () => {
    assertReturnLines(input.lines);
    if (!input.purchaseId) {
      throw new Error('A purchase return must be made against the bill the goods came on.');
    }
    const pur = input.purchaseId
      ? (db
          .prepare('SELECT ref_no, supplier_id, supplier_name, status, branch_id FROM purchases WHERE id = ?')
          .get(input.purchaseId) as
          | { ref_no: string; supplier_id: string | null; supplier_name: string; status: string; branch_id: string }
          | undefined)
      : undefined;
    if (input.purchaseId && !pur) throw new Error('Purchase not found');
    // Goods leave from the branch that received them unless another is named.
    const branchId = shopBranchId(db, input.branchId || pur?.branch_id);
    input = { ...input, branchId };

    /**
     * Only goods that ARRIVED can go back. An ordered or in-transit bill put
     * nothing on the shelf, and a cancelled one has already taken it all off
     * again — a return on either removed stock the shop never had.
     */
    if (pur && pur.status !== 'received') {
      throw new Error(`${pur.ref_no} is ${pur.status} — only a received purchase can be returned.`);
    }

    const docLines = new Map<string, DocLine>();
    if (input.purchaseId && pur) {
      const rows = db
        .prepare(
          `SELECT product_id, name, qty, unit_factor, line_total
             FROM purchase_lines WHERE purchase_id = ? ORDER BY line_no`,
        )
        .all(input.purchaseId) as {
        product_id: string;
        name: string;
        qty: number;
        unit_factor: number;
        line_total: number;
      }[];
      for (const r of rows) {
        const factor = r.unit_factor > 0 ? r.unit_factor : 1;
        // The line's own per-unit value, tax and discount included.
        const perUnit = r.qty > 0 ? r.line_total / r.qty : 0;
        const d = docLines.get(r.product_id);
        if (d) {
          d.base += r.qty * factor;
          d.maxUnitValue = Math.max(d.maxUnitValue, perUnit);
        } else {
          docLines.set(r.product_id, { name: r.name, base: r.qty * factor, factor, maxUnitValue: perUnit });
        }
      }
      const already = db
        .prepare(
          `SELECT product_id, -SUM(qty) AS base FROM stock_movements
            WHERE ref_type = 'purchase' AND ref_id = ? AND reason = 'purchase_return'
            GROUP BY product_id`,
        )
        .all(input.purchaseId) as { product_id: string; base: number }[];
      assertReturnable(
        docLines,
        new Map(already.map((a) => [a.product_id, a.base])),
        qtyByProduct(input.lines),
        pur.ref_no,
      );
      assertRefundWithinValue(input.lines, docLines);
    }

    // The supplier comes from the bill when the caller does not say. It used to
    // be left null, and a CreditAdjust return with no supplier never reached
    // `supplierDue` — the credit note existed and reduced nothing.
    const supplierId = input.supplierId ?? pur?.supplier_id ?? undefined;
    if (input.refundMethod === 'CreditAdjust' && !supplierId) {
      throw new Error('A credit note needs the supplier it is against.');
    }

    const id = newId('pret');
    const date = input.date ?? new Date().toISOString();
    const refNo = nextRef(db, 'purchase_return');
    const total = sum2(input.lines.map((l) => l.refundAmount));
    if (input.purchaseId) {
      assertRefundWithinSettlement(db, 'purchase', input.purchaseId, input.refundMethod, total);
    }

    db.prepare(
      `INSERT INTO purchase_returns (id, ref_no, purchase_id, purchase_ref_no, date, supplier_id, supplier_name, branch_id, user_id, reason, refund_method, total, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      refNo,
      input.purchaseId ?? null,
      pur?.ref_no ?? null,
      date,
      supplierId ?? null,
      pur?.supplier_name ?? null,
      branchId,
      input.userId,
      input.reason ?? null,
      input.refundMethod,
      total,
      input.notes ?? null,
    );

    const lineStmt = db.prepare(
      `INSERT INTO purchase_return_lines (id, return_id, product_id, name, sku, qty, unit, unit_cost, refund_amount)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    for (const l of input.lines) {
      const prod = db.prepare('SELECT name, sku FROM products WHERE id = ?').get(l.productId) as
        | { name: string; sku: string }
        | undefined;
      lineStmt.run(
        newId('prl'),
        id,
        l.productId,
        prod?.name ?? null,
        prod?.sku ?? null,
        l.qty,
        l.unit ?? 'pc',
        l.unitCost,
        round2(l.refundAmount),
      );
      /**
       * Stock goes out in BASE units, converted by the bill's own factor — the
       * same conversion `cancelPurchase` uses (rule 28). Returning "1 dozen"
       * used to take ONE piece off the shelf, valued at the price of twelve.
       * The per-piece cost is passed unrounded, like the receipt.
       */
      const factor = docLines.get(l.productId)?.factor ?? 1;
      recordMovement(db, {
        productId: l.productId,
        branchId: branchId,
        reason: 'purchase_return',
        qty: -(l.qty * factor),
        unit: factor > 1 ? 'pc' : (l.unit ?? 'pc'),
        unitCost: l.unitCost / factor,
        refType: 'purchase',
        refId: input.purchaseId ?? id,
        refNo,
        userId: input.userId,
        at: date,
      });
    }

    /**
     * A supplier credit note settles part of the BILL (v10), mirroring the sale
     * side. It used to reduce only `supplierDue`, so the bill kept its full due
     * and "Pay supplier" — which allocates against bills — paid it again.
     */
    if (input.refundMethod === 'CreditAdjust' && input.purchaseId) {
      db.prepare(
        `UPDATE purchases
            SET credited = ROUND(credited + ?, 2),
                due = MAX(0, ROUND(total - paid - (credited + ?), 2)),
                updated_at = ?
          WHERE id = ? AND status != 'cancelled'`,
      ).run(total, total, date, input.purchaseId);
    }

    if (input.refundMethod === 'CashRefund') {
      // we get cash back from supplier
      postCashToOpenShift(db, branchId, {
        direction: 'in',
        reason: 'manual_in',
        amount: total,
        refType: 'purchase_return',
        refId: id,
        userId: input.userId,
        at: date,
      });
    }

    // The bill records that goods went back, as a sale records its returns.
    // Without this a purchase gave no sign anything had been returned on it.
    if (input.purchaseId) {
      db.prepare(
        `INSERT INTO purchase_audit (id, purchase_id, at, by_user, action, note) VALUES (?,?,?,?,?,?)`,
      ).run(newId('pa'), input.purchaseId, date, input.userId, 'returned', `${refNo} · ${total}`);
    }

    logActivity(db, {
      by: input.userId,
      branchId: branchId,
      action: 'returned',
      entity: 'return',
      entityId: id,
      entityRef: refNo,
      message: `Purchase return${pur ? ' for ' + pur.ref_no : ''}`,
      amount: total,
      at: date,
    });
    return { id, refNo, total };
  });
}
