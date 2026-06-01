import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { round2, sum2 } from '../core/money.ts';
import {
  computeSaleLine,
  computeSaleTotals,
  computeCogs,
  computeSaleProfit,
} from '../core/calc.ts';
import { recordMovement, weightedAvgCost } from './stock.ts';
import { postCashToOpenShift } from './cash.ts';
import { logActivity } from './activity.ts';
import { nextRef } from './sequences.ts';

export type SaleStatus = 'final' | 'draft' | 'quotation' | 'void';

export interface SaleLineInput {
  productId: string;
  qty: number;
  unitUsed?: string;
  unitFactor?: number;
  spr: number;
  markupPct?: number;
  discountPct?: number;
  discountFlat?: number;
  taxPct?: number;
  unitCostAtSale?: number; // if omitted, weighted-avg cost is used
}

export interface SalePaymentInput {
  method: string;
  amount: number;
  reference?: string;
  paidAt?: string;
}

export interface CreateSaleInput {
  status?: SaleStatus;
  date?: string;
  customerId?: string;
  branchId: string;
  userId: string;
  agentId?: string;
  lines: SaleLineInput[];
  orderDiscountPct?: number;
  orderDiscountFlat?: number;
  taxPct?: number;
  shipping?: number;
  other?: number;
  roundOff?: number;
  payments?: SalePaymentInput[];
  validUntil?: string;
  notes?: string;
}

/**
 * Create a sale with all side-effects:
 *  - compute line + order totals via the pure core
 *  - resolve COGS per line (explicit or weighted-avg cost)
 *  - for 'final' sales: reduce stock, route cash payments to the open shift,
 *    update customer due is implicit (computed from sales/payments later)
 *  - write audit + activity + FTS already exists for invoices
 * Drafts/quotations do NOT touch stock or cash.
 */
export function createSale(db: DB, input: CreateSaleInput) {
  return tx(db, () => {
    const status: SaleStatus = input.status ?? 'final';
    const date = input.date ?? new Date().toISOString();
    const saleId = newId('sale');

    // ----- compute lines -----
    const computedLines = input.lines.map((l, idx) => {
      const c = computeSaleLine({
        qty: l.qty,
        spr: l.spr,
        markupPct: l.markupPct ?? 0,
        discountPct: l.discountPct ?? 0,
        discountFlat: l.discountFlat ?? 0,
      });
      const unitCost =
        l.unitCostAtSale !== undefined ? l.unitCostAtSale : weightedAvgCost(db, l.productId);
      const prod = db.prepare('SELECT name, sku FROM products WHERE id = ?').get(l.productId) as
        | { name: string; sku: string }
        | undefined;
      return {
        idx,
        input: l,
        unitPrice: c.unitPrice,
        lineSubtotal: c.lineSubtotal,
        lineGross: round2(c.unitPrice * l.qty),
        unitCost,
        name: prod?.name ?? '(unknown)',
        sku: prod?.sku ?? '—',
      };
    });

    const totals = computeSaleTotals({
      lineSubtotals: computedLines.map((l) => l.lineSubtotal),
      lineGrosses: computedLines.map((l) => l.lineGross),
      orderDiscountPct: input.orderDiscountPct ?? 0,
      orderDiscountFlat: input.orderDiscountFlat ?? 0,
      taxPct: input.taxPct ?? 0,
      shipping: input.shipping ?? 0,
      other: input.other ?? 0,
      roundOff: input.roundOff,
    });

    const cogs = computeCogs(
      computedLines.map((l) => ({ qty: l.input.qty, unitCostAtSale: l.unitCost })),
    );
    const profit = computeSaleProfit(totals.subtotal, totals.orderDiscount, cogs);

    const payments = input.payments ?? [];
    const paid = status === 'final' ? sum2(payments.map((p) => p.amount)) : 0;
    const due = status === 'final' ? round2(Math.max(0, totals.total - paid)) : 0;

    const invoiceNo = nextRef(db, status === 'final' ? 'sale' : status === 'draft' ? 'draft' : status === 'quotation' ? 'quotation' : 'sale');

    // ----- insert sale header -----
    db.prepare(
      `INSERT INTO sales (id, invoice_no, status, date, customer_id, branch_id, user_id, agent_id,
         subtotal, total_line_discount, order_discount_pct, order_discount_flat, order_discount,
         tax_pct, tax, shipping, other, round_off, total, paid, due, cogs, profit, valid_until, notes)
       VALUES (@id, @invoiceNo, @status, @date, @customerId, @branchId, @userId, @agentId,
         @subtotal, @totalLineDiscount, @odpct, @odflat, @orderDiscount,
         @taxPct, @tax, @shipping, @other, @roundOff, @total, @paid, @due, @cogs, @profit, @validUntil, @notes)`,
    ).run({
      id: saleId,
      invoiceNo,
      status,
      date,
      customerId: input.customerId ?? null,
      branchId: input.branchId,
      userId: input.userId,
      agentId: input.agentId ?? null,
      subtotal: totals.subtotal,
      totalLineDiscount: totals.totalLineDiscount,
      odpct: input.orderDiscountPct ?? 0,
      odflat: input.orderDiscountFlat ?? 0,
      orderDiscount: totals.orderDiscount,
      taxPct: input.taxPct ?? 0,
      tax: totals.tax,
      shipping: totals.shipping,
      other: totals.other,
      roundOff: totals.roundOff,
      total: totals.total,
      paid,
      due,
      cogs,
      profit,
      validUntil: input.validUntil ?? null,
      notes: input.notes ?? null,
    });

    // ----- insert lines -----
    const lineStmt = db.prepare(
      `INSERT INTO sale_lines (id, sale_id, product_id, name_at_sale, sku_at_sale, qty, unit_used, unit_factor,
         spr_at_sale, markup_pct, unit_price, discount_pct, discount_flat, tax_pct, unit_cost_at_sale, line_subtotal, line_no)
       VALUES (@id, @saleId, @productId, @name, @sku, @qty, @unit, @factor,
         @spr, @markup, @unitPrice, @dpct, @dflat, @taxPct, @cost, @subtotal, @lineNo)`,
    );
    for (const l of computedLines) {
      lineStmt.run({
        id: newId('sl'),
        saleId,
        productId: l.input.productId,
        name: l.name,
        sku: l.sku,
        qty: l.input.qty,
        unit: l.input.unitUsed ?? 'pc',
        factor: l.input.unitFactor ?? 1,
        spr: l.input.spr,
        markup: l.input.markupPct ?? 0,
        unitPrice: l.unitPrice,
        dpct: l.input.discountPct ?? 0,
        dflat: l.input.discountFlat ?? 0,
        taxPct: l.input.taxPct ?? 0,
        cost: l.unitCost,
        subtotal: l.lineSubtotal,
        lineNo: l.idx + 1,
      });
    }

    // ----- payments -----
    const payStmt = db.prepare(
      `INSERT INTO sale_payments (id, sale_id, method, amount, reference, paid_at, by_user)
       VALUES (@id, @saleId, @method, @amount, @reference, @paidAt, @byUser)`,
    );
    if (status === 'final') {
      for (const p of payments) {
        payStmt.run({
          id: newId('pay'),
          saleId,
          method: p.method,
          amount: round2(p.amount),
          reference: p.reference ?? null,
          paidAt: p.paidAt ?? date,
          byUser: input.userId,
        });
        // Cash payments hit the open shift
        if (p.method === 'Cash') {
          postCashToOpenShift(db, input.branchId, {
            direction: 'in',
            reason: 'sale',
            amount: p.amount,
            refType: 'sale',
            refId: saleId,
            userId: input.userId,
            at: p.paidAt ?? date,
          });
        }
      }
    }

    // ----- stock out (final only) -----
    if (status === 'final') {
      for (const l of computedLines) {
        const baseQty = l.input.qty * (l.input.unitFactor ?? 1);
        recordMovement(db, {
          productId: l.input.productId,
          branchId: input.branchId,
          reason: 'sale',
          qty: -baseQty,
          unit: l.input.unitUsed ?? 'pc',
          unitCost: l.unitCost,
          refType: 'sale',
          refId: saleId,
          refNo: invoiceNo,
          userId: input.userId,
          at: date,
        });
      }
    }

    // ----- audit + activity + FTS -----
    db.prepare(
      `INSERT INTO sale_audit (id, sale_id, at, by_user, action, note) VALUES (?,?,?,?,?,?)`,
    ).run(newId('au'), saleId, date, input.userId, 'created', null);

    const customerName =
      (db.prepare('SELECT name FROM customers WHERE id = ?').get(input.customerId ?? '') as
        | { name: string }
        | undefined)?.name ?? 'Walk-in Customer';

    db.prepare(
      `INSERT INTO fts_invoices (sale_id, invoice_no, customer_name) VALUES (?,?,?)`,
    ).run(saleId, invoiceNo, customerName);

    if (status === 'final') {
      logActivity(db, {
        by: input.userId,
        branchId: input.branchId,
        action: 'created',
        entity: 'sale',
        entityId: saleId,
        entityRef: invoiceNo,
        message: `New sale to ${customerName}`,
        amount: totals.total,
        at: date,
      });
    }

    return { id: saleId, invoiceNo, totals, cogs, profit, paid, due };
  });
}

/** Add a payment to an existing sale; updates paid/due and routes cash. */
export function addSalePayment(db: DB, saleId: string, p: SalePaymentInput, userId: string) {
  return tx(db, () => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as
      | Record<string, unknown>
      | undefined;
    if (!sale) throw new Error('Sale not found');
    const at = p.paidAt ?? new Date().toISOString();
    db.prepare(
      `INSERT INTO sale_payments (id, sale_id, method, amount, reference, paid_at, by_user)
       VALUES (?,?,?,?,?,?,?)`,
    ).run(newId('pay'), saleId, p.method, round2(p.amount), p.reference ?? null, at, userId);

    const paid = round2((sale.paid as number) + p.amount);
    const due = round2(Math.max(0, (sale.total as number) - paid));
    db.prepare('UPDATE sales SET paid = ?, due = ?, updated_at = ? WHERE id = ?').run(
      paid,
      due,
      at,
      saleId,
    );

    if (p.method === 'Cash') {
      postCashToOpenShift(db, sale.branch_id as string, {
        direction: 'in',
        reason: 'sale',
        amount: p.amount,
        refType: 'sale',
        refId: saleId,
        userId,
        at,
      });
    }

    db.prepare(`INSERT INTO sale_audit (id, sale_id, at, by_user, action, note) VALUES (?,?,?,?,?,?)`).run(
      newId('au'),
      saleId,
      at,
      userId,
      'paid',
      `${p.method} ${round2(p.amount)}`,
    );
    logActivity(db, {
      by: userId,
      branchId: sale.branch_id as string,
      action: 'paid',
      entity: 'sale',
      entityId: saleId,
      entityRef: sale.invoice_no as string,
      message: `Payment received via ${p.method}`,
      amount: p.amount,
      at,
    });
    return { paid, due };
  });
}

/** Void a final sale — reverses stock, marks status, reverses cash if needed. */
export function voidSale(db: DB, saleId: string, userId: string, reason?: string) {
  return tx(db, () => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as
      | Record<string, unknown>
      | undefined;
    if (!sale) throw new Error('Sale not found');
    if (sale.status === 'void') return;
    const at = new Date().toISOString();

    // reverse stock for each line
    if (sale.status === 'final') {
      const lines = db.prepare('SELECT * FROM sale_lines WHERE sale_id = ?').all(saleId) as Record<
        string,
        unknown
      >[];
      for (const l of lines) {
        const baseQty = (l.qty as number) * (l.unit_factor as number);
        recordMovement(db, {
          productId: l.product_id as string,
          branchId: sale.branch_id as string,
          reason: 'sale_return',
          qty: +baseQty, // add back
          unit: l.unit_used as string,
          unitCost: l.unit_cost_at_sale as number,
          refType: 'sale',
          refId: saleId,
          refNo: sale.invoice_no as string,
          note: 'void reversal',
          userId,
          at,
        });
      }
      // reverse cash that was collected in cash
      const cashPaid = db
        .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM sale_payments WHERE sale_id = ? AND method = 'Cash'")
        .get(saleId) as { s: number };
      if (cashPaid.s > 0) {
        postCashToOpenShift(db, sale.branch_id as string, {
          direction: 'out',
          reason: 'refund',
          amount: cashPaid.s,
          refType: 'sale',
          refId: saleId,
          note: 'void cash reversal',
          userId,
          at,
        });
      }
    }

    db.prepare(
      `UPDATE sales SET status = 'void', voided_at = ?, voided_by = ?, void_reason = ?, updated_at = ? WHERE id = ?`,
    ).run(at, userId, reason ?? null, at, saleId);

    db.prepare(`INSERT INTO sale_audit (id, sale_id, at, by_user, action, note) VALUES (?,?,?,?,?,?)`).run(
      newId('au'),
      saleId,
      at,
      userId,
      'voided',
      reason ?? null,
    );
    logActivity(db, {
      by: userId,
      branchId: sale.branch_id as string,
      action: 'voided',
      entity: 'sale',
      entityId: saleId,
      entityRef: sale.invoice_no as string,
      message: `Voided — ${reason ?? 'no reason'}`,
      amount: sale.total as number,
      at,
    });
  });
}

/**
 * Delete a draft/quotation sale (these never touched stock or cash).
 * Mirrors deletePurchase: final/void sales must go through voidSale instead so
 * their stock + cash side-effects are reversed. sale_lines/sale_payments/sale_audit
 * are removed by ON DELETE CASCADE (see schema.ts); fts_invoices has no FK so we
 * clean its row explicitly.
 */
export function deleteSale(db: DB, saleId: string) {
  return tx(db, () => {
    const sale = db.prepare('SELECT status FROM sales WHERE id = ?').get(saleId) as
      | { status: string }
      | undefined;
    if (!sale) throw new Error('Sale not found');
    if (sale.status === 'final' || sale.status === 'void') {
      throw new Error('Cannot delete a final or void sale. Void it instead (reverses stock & cash).');
    }
    // drafts/quotations never affected stock or cash — safe to remove.
    db.prepare('DELETE FROM fts_invoices WHERE sale_id = ?').run(saleId);
    db.prepare('DELETE FROM sales WHERE id = ?').run(saleId); // cascades to lines/payments/audit
    logActivity(db, {
      by: 'system',
      action: 'deleted',
      entity: 'sale',
      entityId: saleId,
      message: `Deleted ${sale.status} sale`,
      at: new Date().toISOString(),
    });
    return { id: saleId };
  });
}
