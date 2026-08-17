import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { round2, sum2 } from '../core/money.ts';
import { computePurchaseLine, computePurchaseTotals } from '../core/calc.ts';
import { recordMovement } from './stock.ts';
import { postCashToOpenShift } from './cash.ts';
import { logActivity } from './activity.ts';
import { nextRef } from './sequences.ts';
import { retractCostEntries, setProductCost } from './costing.ts';

export type PurchaseStatus = 'received' | 'ordered' | 'in-transit' | 'cancelled';

export interface PurchaseLineInput {
  productId: string;
  /**
   * IN THE UNIT THE SUPPLIER QUOTED. For "5 dozen at 620" this is 5, `unit` is
   * 'dozen', `unitFactor` is 12 and `unitCostBeforeDisc` is 620.
   */
  qty: number;
  /** The purchase unit's name, for the bill and the audit trail. */
  unit?: string;
  /**
   * How many BASE units one purchase unit holds. 12 for a dozen, 1 (the default)
   * when buying in the same unit the shop sells in.
   *
   * Stock moves in base units and the money stays at pack level, so the bill
   * matches the supplier to the paisa even when the per-piece cost does not divide
   * evenly — see the note in `createPurchase`.
   */
  unitFactor?: number;
  /** The shop's own selling unit, used on the stock movement. Defaults to 'pc'. */
  baseUnit?: string;
  imei?: string;
  /** Cost of ONE PURCHASE UNIT (one dozen), before discounts. */
  unitCostBeforeDisc: number;
  discountPct?: number;
  discountFlat?: number;
  taxPct?: number;
  newSellPrice?: number;
}

export interface PurchasePaymentInput {
  method: string;
  amount: number;
  reference?: string;
  paidAt?: string;
}

export interface CreatePurchaseInput {
  status?: PurchaseStatus;
  date?: string;
  supplierId?: string;
  branchId: string;
  userId: string;
  payTerms?: string;
  lines: PurchaseLineInput[];
  orderDiscountType?: 'flat' | 'percent';
  orderDiscountValue?: number;
  taxPct?: number;
  shipping?: number;
  other?: number;
  payments?: PurchasePaymentInput[];
  notes?: string;
}

export function createPurchase(db: DB, input: CreatePurchaseInput) {
  return tx(db, () => {
    const status = input.status ?? 'received';
    const date = input.date ?? new Date().toISOString();
    const id = newId('pur');
    const refNo = nextRef(db, 'purchase');

    const supplier = input.supplierId
      ? (db.prepare('SELECT name FROM suppliers WHERE id = ?').get(input.supplierId) as
          | { name: string }
          | undefined)
      : undefined;

    const computedLines = input.lines.map((l, idx) => {
      const c = computePurchaseLine({
        qty: l.qty,
        unitCostBeforeDisc: l.unitCostBeforeDisc,
        discountPct: l.discountPct ?? 0,
        discountFlat: l.discountFlat ?? 0,
        taxPct: l.taxPct ?? 0,
      });
      const prod = db.prepare('SELECT name, sku FROM products WHERE id = ?').get(l.productId) as
        | { name: string; sku: string }
        | undefined;
      return { idx, input: l, ...c, name: prod?.name ?? '(unknown)', sku: prod?.sku ?? '—' };
    });

    const totals = computePurchaseTotals({
      lines: input.lines.map((l) => ({
        qty: l.qty,
        unitCostBeforeDisc: l.unitCostBeforeDisc,
        discountPct: l.discountPct ?? 0,
        discountFlat: l.discountFlat ?? 0,
        taxPct: l.taxPct ?? 0,
      })),
      orderDiscountType: input.orderDiscountType ?? 'flat',
      orderDiscountValue: input.orderDiscountValue ?? 0,
      taxPct: input.taxPct ?? 0,
      shipping: input.shipping ?? 0,
      other: input.other ?? 0,
    });

    const payments = input.payments ?? [];
    const paid = sum2(payments.map((p) => p.amount));
    const due = round2(Math.max(0, totals.total - paid));

    db.prepare(
      `INSERT INTO purchases (id, ref_no, status, date, supplier_id, supplier_name, branch_id, user_id, pay_terms,
         subtotal, total_line_discount, order_discount_type, order_discount_value, order_discount,
         tax_pct, tax, shipping, other, total, paid, due, notes)
       VALUES (@id, @refNo, @status, @date, @supplierId, @supplierName, @branchId, @userId, @payTerms,
         @subtotal, @totalLineDiscount, @odType, @odValue, @orderDiscount,
         @taxPct, @tax, @shipping, @other, @total, @paid, @due, @notes)`,
    ).run({
      id,
      refNo,
      status,
      date,
      supplierId: input.supplierId ?? null,
      supplierName: supplier?.name ?? null,
      branchId: input.branchId,
      userId: input.userId,
      payTerms: input.payTerms ?? null,
      subtotal: totals.subtotal,
      totalLineDiscount: totals.totalLineDiscount,
      odType: input.orderDiscountType ?? 'flat',
      odValue: input.orderDiscountValue ?? 0,
      orderDiscount: totals.orderDiscount,
      taxPct: input.taxPct ?? 0,
      tax: totals.tax,
      shipping: totals.shipping,
      other: totals.other,
      total: totals.total,
      paid,
      due,
      notes: input.notes ?? null,
    });

    const lineStmt = db.prepare(
      `INSERT INTO purchase_lines (id, purchase_id, product_id, name, sku, qty, unit, unit_factor, imei,
         unit_cost_before_disc, discount_pct, discount_flat, tax_pct, unit_cost_before_tax, line_total, new_sell_price, line_no)
       VALUES (@id, @purchaseId, @productId, @name, @sku, @qty, @unit, @unitFactor, @imei,
         @ucbd, @dpct, @dflat, @taxPct, @ucbt, @lineTotal, @newSell, @lineNo)`,
    );
    for (const l of computedLines) {
      lineStmt.run({
        id: newId('pl'),
        purchaseId: id,
        productId: l.input.productId,
        name: l.name,
        sku: l.sku,
        qty: l.input.qty,
        unit: l.input.unit ?? 'pc',
        unitFactor: l.input.unitFactor && l.input.unitFactor > 0 ? l.input.unitFactor : 1,
        imei: l.input.imei ?? null,
        ucbd: l.input.unitCostBeforeDisc,
        dpct: l.input.discountPct ?? 0,
        dflat: l.input.discountFlat ?? 0,
        taxPct: l.input.taxPct ?? 0,
        ucbt: l.unitCostBeforeTax,
        lineTotal: l.lineTotal,
        newSell: l.input.newSellPrice ?? null,
        lineNo: l.idx + 1,
      });
    }

    const payStmt = db.prepare(
      `INSERT INTO purchase_payments (id, purchase_id, method, amount, reference, paid_at, by_user)
       VALUES (?,?,?,?,?,?,?)`,
    );
    for (const p of payments) {
      payStmt.run(
        newId('pp'),
        id,
        p.method,
        round2(p.amount),
        p.reference ?? null,
        p.paidAt ?? date,
        input.userId,
      );
      if (p.method === 'Cash') {
        postCashToOpenShift(db, input.branchId, {
          direction: 'out',
          reason: 'supplier_paid',
          amount: p.amount,
          refType: 'purchase',
          refId: id,
          userId: input.userId,
          at: p.paidAt ?? date,
        });
      }
    }

    // stock in (received only)
    if (status === 'received') {
      for (const l of computedLines) {
        /**
         * BUY BY THE DOZEN, SELL BY THE PIECE.
         *
         * The line's `qty` and cost are in the unit the SUPPLIER quoted — "5 dozen
         * at 620" — because that is what the bill says and the money must match it
         * to the paisa. Stock, though, has to move in the unit the shop SELLS in,
         * so the quantity is converted here and the cost is divided by the same
         * factor.
         *
         * WHY THE PER-PIECE COST IS NOT ROUNDED
         * 620 / 12 is 51.666… — it does not divide evenly, and that is the whole
         * difficulty the owner described. Rounding it to 51.67 and then storing 60
         * of them would value the delivery at ৳3,100.20 against a bill of ৳3,100:
         * twenty paisa invented out of nowhere, on every pack, for ever.
         *
         * So `unit_cost` on the movement keeps full precision (the column is REAL).
         * `weightedAvgCost` is `SUM(qty × unit_cost) / SUM(qty)`, so 60 × 51.666…
         * comes back to exactly 3,100 and both stock valuation and COGS stay
         * correct. Only the DISPLAYED buying price is rounded, to ৳51.67, which is
         * an honest way to show a price that genuinely has no exact 2-decimal form.
         */
        const factor = l.input.unitFactor && l.input.unitFactor > 0 ? l.input.unitFactor : 1;
        const baseQty = l.input.qty * factor;
        const baseUnitCost = l.unitCostBeforeTax / factor;
        recordMovement(db, {
          productId: l.input.productId,
          branchId: input.branchId,
          reason: 'purchase',
          qty: +baseQty,
          unit: l.input.baseUnit ?? 'pc',
          unitCost: baseUnitCost,
          refType: 'purchase',
          refId: id,
          refNo,
          userId: input.userId,
          at: date,
        });
        /**
         * RECORD WHAT WE JUST PAID — through the cost history, not a raw UPDATE.
         *
         * This used to be `UPDATE products SET price = ?, cost = ?` and it was
         * wrong in two ways the owner could see:
         *
         *  1. It only ran when the line carried a NEW SELL PRICE. Buy the same
         *     product at a higher price without retyping its sell price and the
         *     shop's recorded buying price never moved at all.
         *  2. Even when it did run, it wrote `products.cost` directly, bypassing
         *     `product_cost_history`. `avg_cost` is recomputed FROM that history
         *     (services/costing.ts), so the "average purchase price" simply never
         *     changed on a purchase — which is exactly the reported bug — and the
         *     cache was left disagreeing with its own source of truth.
         *
         * `setProductCost` appends the line's unit cost and recomputes `cost`,
         * `avg_cost` and `cost_updated_at` from the whole history, so both the
         * current and the average buying price move on every goods-received
         * note. It is a nested `tx()`, which better-sqlite3 implements with a
         * SAVEPOINT, so it joins this transaction rather than committing early.
         *
         * Cost before TAX is deliberate: it is what the goods cost, matching the
         * `unitCost` on the stock movement above (which drives COGS/valuation).
         */
        setProductCost(db, {
          productId: l.input.productId,
          // PER BASE UNIT, so the recorded buying price is comparable with the
          // shop's selling price. Buying "5 dozen at 620" records ৳51.67 a piece,
          // not ৳620 — recording the pack price would make the average buying
          // price of a piece look twelve times too high and wreck every margin
          // figure on the product. `setProductCost` rounds for display; the
          // unrounded figure is on the stock movement, where valuation reads it.
          cost: baseUnitCost,
          userId: input.userId,
          source: 'purchase',
          note:
            factor > 1
              ? `Purchase ${refNo} · ${l.input.qty} ${l.input.unit ?? 'pack'} of ${factor}`
              : `Purchase ${refNo}`,
          // Tagged with the purchase so cancelling it can retract exactly the
          // prices it recorded — see `retractCostEntries` in services/costing.ts.
          refType: 'purchase',
          refId: id,
          at: date,
        });

        // The SELL price is a separate decision and stays opt-in: it only moves
        // when the buyer typed a new one on the line.
        if (l.input.newSellPrice) {
          db.prepare('UPDATE products SET price = ?, updated_at = ? WHERE id = ?').run(
            l.input.newSellPrice,
            date,
            l.input.productId,
          );
        }
      }
    }

    db.prepare(`INSERT INTO purchase_audit (id, purchase_id, at, by_user, action, note) VALUES (?,?,?,?,?,?)`).run(
      newId('pa'),
      id,
      date,
      input.userId,
      'created',
      null,
    );
    logActivity(db, {
      by: input.userId,
      branchId: input.branchId,
      action: 'created',
      entity: 'purchase',
      entityId: id,
      entityRef: refNo,
      message: `New purchase from ${supplier?.name ?? 'supplier'}`,
      amount: totals.total,
      at: date,
    });

    return { id, refNo, totals, paid, due };
  });
}

export function addPurchasePayment(
  db: DB,
  purchaseId: string,
  p: PurchasePaymentInput,
  userId: string,
) {
  return tx(db, () => {
    const pur = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as
      | Record<string, unknown>
      | undefined;
    if (!pur) throw new Error('Purchase not found');
    const at = p.paidAt ?? new Date().toISOString();
    db.prepare(
      `INSERT INTO purchase_payments (id, purchase_id, method, amount, reference, paid_at, by_user) VALUES (?,?,?,?,?,?,?)`,
    ).run(newId('pp'), purchaseId, p.method, round2(p.amount), p.reference ?? null, at, userId);
    const paid = round2((pur.paid as number) + p.amount);
    const due = round2(Math.max(0, (pur.total as number) - paid));
    db.prepare('UPDATE purchases SET paid = ?, due = ?, updated_at = ? WHERE id = ?').run(
      paid,
      due,
      at,
      purchaseId,
    );
    if (p.method === 'Cash') {
      postCashToOpenShift(db, pur.branch_id as string, {
        direction: 'out',
        reason: 'supplier_paid',
        amount: p.amount,
        refType: 'purchase',
        refId: purchaseId,
        userId,
        at,
      });
    }
    db.prepare(`INSERT INTO purchase_audit (id, purchase_id, at, by_user, action, note) VALUES (?,?,?,?,?,?)`).run(
      newId('pa'),
      purchaseId,
      at,
      userId,
      'paid',
      `${p.method} ${round2(p.amount)}`,
    );
    return { paid, due };
  });
}

/** Cancel a received/ordered purchase — reverses stock-in, reverses cash paid in cash. */
export function cancelPurchase(db: DB, purchaseId: string, userId: string, reason?: string) {
  return tx(db, () => {
    const pur = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as
      | Record<string, unknown>
      | undefined;
    if (!pur) throw new Error('Purchase not found');
    if (pur.status === 'cancelled') return { id: purchaseId };
    const at = new Date().toISOString();

    // reverse stock-in for received purchases
    if (pur.status === 'received') {
      const lines = db.prepare('SELECT * FROM purchase_lines WHERE purchase_id = ?').all(purchaseId) as Record<
        string,
        unknown
      >[];
      for (const l of lines) {
        /**
         * Reverse in BASE UNITS, converting by the same factor the receipt used.
         *
         * `purchase_lines.qty` is in the supplier's unit — 5, for five dozen — but
         * the movement that put the goods in was 60 pieces. Reversing `-qty` would
         * take out five and leave 55 pieces of phantom stock behind on every
         * cancelled pack purchase.
         */
        const factor = (l.unit_factor as number) > 0 ? (l.unit_factor as number) : 1;
        recordMovement(db, {
          productId: l.product_id as string,
          branchId: pur.branch_id as string,
          reason: 'purchase_return',
          qty: -((l.qty as number) * factor), // remove exactly what was added
          // The movement records base units, so it must not carry the pack's name.
          unit: factor > 1 ? 'pc' : (l.unit as string),
          unitCost: (l.unit_cost_before_tax as number) / factor,
          refType: 'purchase',
          refId: purchaseId,
          refNo: pur.ref_no as string,
          note: 'cancel reversal',
          userId,
          at,
        });
      }
      // reverse cash paid in cash
      const cashPaid = db
        .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM purchase_payments WHERE purchase_id = ? AND method = 'Cash'")
        .get(purchaseId) as { s: number };
      if (cashPaid.s > 0) {
        postCashToOpenShift(db, pur.branch_id as string, {
          direction: 'in',
          reason: 'manual_in',
          amount: cashPaid.s,
          refType: 'purchase',
          refId: purchaseId,
          note: 'cancel cash reversal',
          userId,
          at,
        });
      }
    }

    /**
     * The buying prices this purchase put on record are retracted too.
     *
     * This used to be left alone, and it was the one part of a cancellation that
     * did not actually come back: the stock went off the shelf again and the cash
     * returned to the drawer, but the price stayed in `product_cost_history` — and
     * `avg_cost` is the mean of those entries. So a purchase keyed at the wrong
     * price and cancelled a minute later moved the shop's average buying price
     * permanently, with no way to undo it.
     *
     * If the delivery never arrived, the shop never paid that price. The rows are
     * MARKED, not deleted (the table is the audit record of what was entered and
     * when), and `cost` / `avg_cost` are recomputed from what is left standing.
     * Runs for 'ordered' cancellations too — harmless, since an ordered purchase
     * recorded no prices, so there is nothing to find.
     */
    retractCostEntries(db, 'purchase', purchaseId, `Purchase ${pur.ref_no as string} cancelled`);

    /**
     * `paid` and `due` are ZEROED — the same reasoning as `voidSale`. A cancelled
     * bill is not payable, and `supplierDue` already excludes it
     * (`status != 'cancelled'`), so leaving a stale `due` on the row only made the
     * Purchases list contradict the supplier's payable. The `purchase_payments`
     * rows stay: they record money that really moved, and the cash reversal above
     * is what brings it back.
     */
    db.prepare(
      `UPDATE purchases
          SET status = 'cancelled', paid = 0, due = 0, cancelled_at = ?, updated_at = ?
        WHERE id = ?`,
    ).run(at, at, purchaseId);
    db.prepare(`INSERT INTO purchase_audit (id, purchase_id, at, by_user, action, note) VALUES (?,?,?,?,?,?)`).run(
      newId('pa'),
      purchaseId,
      at,
      userId,
      'cancelled',
      reason ?? null,
    );
    logActivity(db, {
      by: userId,
      branchId: pur.branch_id as string,
      action: 'voided',
      entity: 'purchase',
      entityId: purchaseId,
      entityRef: pur.ref_no as string,
      message: `Cancelled — ${reason ?? 'no reason'}`,
      amount: pur.total as number,
      at,
    });
    return { id: purchaseId };
  });
}

/** Delete an ordered/cancelled purchase (no stock impact to reverse). */
export function deletePurchase(db: DB, purchaseId: string) {
  return tx(db, () => {
    const pur = db.prepare('SELECT status FROM purchases WHERE id = ?').get(purchaseId) as
      | { status: string }
      | undefined;
    if (!pur) throw new Error('Purchase not found');
    if (pur.status === 'received') {
      throw new Error('Cannot delete a received purchase. Cancel it instead (reverses stock).');
    }
    // ordered/in-transit/cancelled never affected stock, safe to remove
    db.prepare('DELETE FROM purchases WHERE id = ?').run(purchaseId); // cascades to lines/payments/audit
    return { id: purchaseId };
  });
}
