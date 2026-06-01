import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { round2, sum2 } from '../core/money.ts';
import { computePurchaseLine, computePurchaseTotals } from '../core/calc.ts';
import { recordMovement } from './stock.ts';
import { postCashToOpenShift } from './cash.ts';
import { logActivity } from './activity.ts';
import { nextRef } from './sequences.ts';

export type PurchaseStatus = 'received' | 'ordered' | 'in-transit' | 'cancelled';

export interface PurchaseLineInput {
  productId: string;
  qty: number;
  unit?: string;
  imei?: string;
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
      `INSERT INTO purchase_lines (id, purchase_id, product_id, name, sku, qty, unit, imei,
         unit_cost_before_disc, discount_pct, discount_flat, tax_pct, unit_cost_before_tax, line_total, new_sell_price, line_no)
       VALUES (@id, @purchaseId, @productId, @name, @sku, @qty, @unit, @imei,
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
        recordMovement(db, {
          productId: l.input.productId,
          branchId: input.branchId,
          reason: 'purchase',
          qty: +l.input.qty,
          unit: l.input.unit ?? 'pc',
          unitCost: l.unitCostBeforeTax,
          refType: 'purchase',
          refId: id,
          refNo,
          userId: input.userId,
          at: date,
        });
        // optionally update product sell price + cost
        if (l.input.newSellPrice) {
          db.prepare('UPDATE products SET price = ?, cost = ?, updated_at = ? WHERE id = ?').run(
            l.input.newSellPrice,
            l.unitCostBeforeTax,
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
        recordMovement(db, {
          productId: l.product_id as string,
          branchId: pur.branch_id as string,
          reason: 'purchase_return',
          qty: -(l.qty as number), // remove what was added
          unit: l.unit as string,
          unitCost: l.unit_cost_before_tax as number,
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

    db.prepare(
      `UPDATE purchases SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?`,
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
