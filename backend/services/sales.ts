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
 * Compute every derived figure for a set of sale lines + order-level fields.
 *
 * SHARED BY createSale AND updateSale ON PURPOSE. These are the verified money
 * paths; having each of them do its own arithmetic is how the two silently
 * diverge, and a corrected invoice would then not agree with the original.
 * `unit_cost_at_sale` (and therefore COGS) is resolved here too.
 */
function computeSaleBody(
  db: DB,
  input: Pick<
    CreateSaleInput,
    | 'lines'
    | 'orderDiscountPct'
    | 'orderDiscountFlat'
    | 'taxPct'
    | 'shipping'
    | 'other'
    | 'roundOff'
    | 'payments'
  >,
  status: SaleStatus,
) {
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

  return { computedLines, totals, cogs, profit, payments, paid, due };
}

type ComputedSaleBody = ReturnType<typeof computeSaleBody>;

/**
 * Write sale_lines + sale_payments and apply the stock/cash side effects for one
 * sale. Assumes the header row already exists and that any PREVIOUS lines,
 * payments and side effects have already been removed/reversed by the caller.
 *
 * Drafts and quotations write lines only — they never touch stock or cash.
 */
function writeSaleBody(
  db: DB,
  args: {
    saleId: string;
    invoiceNo: string;
    status: SaleStatus;
    date: string;
    branchId: string;
    userId: string;
    body: ComputedSaleBody;
  },
) {
  const { saleId, invoiceNo, status, date, branchId, userId, body } = args;

  const lineStmt = db.prepare(
    `INSERT INTO sale_lines (id, sale_id, product_id, name_at_sale, sku_at_sale, qty, unit_used, unit_factor,
       spr_at_sale, markup_pct, unit_price, discount_pct, discount_flat, tax_pct, unit_cost_at_sale, line_subtotal, line_no)
     VALUES (@id, @saleId, @productId, @name, @sku, @qty, @unit, @factor,
       @spr, @markup, @unitPrice, @dpct, @dflat, @taxPct, @cost, @subtotal, @lineNo)`,
  );
  for (const l of body.computedLines) {
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

  if (status !== 'final') return;

  const payStmt = db.prepare(
    `INSERT INTO sale_payments (id, sale_id, method, amount, reference, paid_at, by_user)
     VALUES (@id, @saleId, @method, @amount, @reference, @paidAt, @byUser)`,
  );
  for (const p of body.payments) {
    payStmt.run({
      id: newId('pay'),
      saleId,
      method: p.method,
      amount: round2(p.amount),
      reference: p.reference ?? null,
      paidAt: p.paidAt ?? date,
      byUser: userId,
    });
    // Cash payments hit the open shift
    if (p.method === 'Cash') {
      postCashToOpenShift(db, branchId, {
        direction: 'in',
        reason: 'sale',
        amount: p.amount,
        refType: 'sale',
        refId: saleId,
        userId,
        at: p.paidAt ?? date,
      });
    }
  }

  for (const l of body.computedLines) {
    const baseQty = l.input.qty * (l.input.unitFactor ?? 1);
    recordMovement(db, {
      productId: l.input.productId,
      branchId,
      reason: 'sale',
      qty: -baseQty,
      unit: l.input.unitUsed ?? 'pc',
      unitCost: l.unitCost,
      refType: 'sale',
      refId: saleId,
      refNo: invoiceNo,
      userId,
      at: date,
    });
  }
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

    const body = computeSaleBody(db, input, status);
    const { totals, cogs, profit, paid, due } = body;

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

    // ----- lines + payments + stock/cash side effects -----
    writeSaleBody(db, {
      saleId,
      invoiceNo,
      status,
      date,
      branchId: input.branchId,
      userId: input.userId,
      body,
    });

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

export interface UpdateSaleInput extends CreateSaleInput {
  /**
   * Why the invoice was corrected. REQUIRED and recorded in sale_audit: an edit
   * rewrites money that has already been taken, so "who changed what, when and
   * why" has to survive in the record. Without it an edit is indistinguishable
   * from a mistake being covered up.
   */
  reason: string;
}

/**
 * Correct an existing sale IN PLACE, keeping its id and invoice number.
 *
 * WHY IN PLACE
 * The customer is holding a printed invoice with that number on it. Void +
 * re-create leaves a voided invoice and a second number for the same
 * transaction, and the shopkeeper then has to explain two documents for one
 * purchase. So the number is stable and the correction is recorded against it.
 *
 * HOW IT STAYS HONEST — reverse, then re-apply, in ONE transaction:
 *
 *  1. If the sale was 'final', every line's stock movement is reversed with a
 *     dedicated `sale_edit` reason (NOT `sale_return`, which would make a
 *     correction look like a customer bringing goods back), and the cash that
 *     was collected in cash is posted OUT.
 *  2. The old sale_lines and sale_payments rows are deleted.
 *  3. The new lines/payments are written and their side effects applied through
 *     exactly the same code path `createSale` uses (`writeSaleBody`).
 *
 * The net effect on stock and on the drawer is therefore the DIFFERENCE between
 * the old and new invoice, and it arrives as appended movements — so
 * `stock = SUM(stock_movements.qty)` and every derived balance still hold, and
 * the whole correction is auditable movement by movement.
 *
 * NOT ALLOWED: editing a voided sale (it has already been reversed and settled —
 * make a new sale), and setting status to 'void' (that is `voidSale`, which
 * records who voided it and why).
 *
 * CASH CAVEAT, same as voidSale: the reversal is posted to the shift that is
 * open NOW, which may not be the shift that took the money. That is deliberate —
 * a closed shift has been counted and reconciled, and silently rewriting it
 * would break a figure the owner already signed off on. The correction shows up
 * in today's drawer, which is where the money actually moves.
 */
export function updateSale(db: DB, saleId: string, input: UpdateSaleInput) {
  return tx(db, () => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as
      | Record<string, unknown>
      | undefined;
    if (!sale) throw new Error('Sale not found');

    const oldStatus = sale.status as SaleStatus;
    if (oldStatus === 'void') {
      throw new Error(
        'A voided sale cannot be edited — its stock and cash have already been reversed. Create a new sale instead.',
      );
    }
    if (!input.reason || !input.reason.trim()) {
      throw new Error('A reason is required to edit a sale.');
    }
    if (input.lines.length === 0) {
      throw new Error('A sale must have at least one line.');
    }

    const newStatus: SaleStatus = input.status ?? oldStatus;
    if (newStatus === 'void') {
      throw new Error('Use sales.void to void a sale, so the reversal is recorded as a void.');
    }

    const at = new Date().toISOString();
    const invoiceNo = sale.invoice_no as string;
    const oldBranchId = sale.branch_id as string;
    const oldTotal = sale.total as number;
    // The sale keeps its original date unless the caller changes it: an edit
    // corrects what was sold, it does not move the sale to today.
    const date = input.date ?? (sale.date as string);
    const branchId = input.branchId || oldBranchId;

    // ---------- 1. reverse the old side effects ----------
    if (oldStatus === 'final') {
      const oldLines = db.prepare('SELECT * FROM sale_lines WHERE sale_id = ?').all(saleId) as Record<
        string,
        unknown
      >[];
      for (const l of oldLines) {
        const baseQty = (l.qty as number) * (l.unit_factor as number);
        recordMovement(db, {
          productId: l.product_id as string,
          branchId: oldBranchId,
          reason: 'sale_edit',
          qty: +baseQty, // put it back
          unit: l.unit_used as string,
          unitCost: l.unit_cost_at_sale as number,
          refType: 'sale',
          refId: saleId,
          refNo: invoiceNo,
          note: 'edit reversal',
          userId: input.userId,
          at,
        });
      }

      const cashPaid = db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) AS s FROM sale_payments WHERE sale_id = ? AND method = 'Cash'",
        )
        .get(saleId) as { s: number };
      if (cashPaid.s > 0) {
        postCashToOpenShift(db, oldBranchId, {
          direction: 'out',
          reason: 'sale_edit',
          amount: cashPaid.s,
          refType: 'sale',
          refId: saleId,
          note: 'edit cash reversal',
          userId: input.userId,
          at,
        });
      }
    }

    // ---------- 2. drop the old body ----------
    db.prepare('DELETE FROM sale_lines WHERE sale_id = ?').run(saleId);
    db.prepare('DELETE FROM sale_payments WHERE sale_id = ?').run(saleId);

    // ---------- 3. recompute from the new input ----------
    const body = computeSaleBody(db, input, newStatus);
    const { totals, cogs, profit, paid, due } = body;

    // ---------- 4. rewrite the header (id + invoice_no untouched) ----------
    db.prepare(
      `UPDATE sales SET
         status = @status, date = @date, customer_id = @customerId, branch_id = @branchId,
         agent_id = @agentId, subtotal = @subtotal, total_line_discount = @totalLineDiscount,
         order_discount_pct = @odpct, order_discount_flat = @odflat, order_discount = @orderDiscount,
         tax_pct = @taxPct, tax = @tax, shipping = @shipping, other = @other, round_off = @roundOff,
         total = @total, paid = @paid, due = @due, cogs = @cogs, profit = @profit,
         valid_until = @validUntil, notes = @notes, updated_at = @updatedAt
       WHERE id = @id`,
    ).run({
      id: saleId,
      status: newStatus,
      date,
      customerId: input.customerId ?? null,
      branchId,
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
      updatedAt: at,
    });

    // ---------- 5. re-apply, through the same writer createSale uses ----------
    writeSaleBody(db, {
      saleId,
      invoiceNo,
      status: newStatus,
      date,
      branchId,
      userId: input.userId,
      body,
    });

    // ---------- 6. audit trail ----------
    const customerName =
      (db.prepare('SELECT name FROM customers WHERE id = ?').get(input.customerId ?? '') as
        | { name: string }
        | undefined)?.name ?? 'Walk-in Customer';

    // fts_invoices has no FK to sales, so keep it in step by hand. The customer
    // can change on an edit (wrong customer is a common reason to correct one).
    db.prepare('DELETE FROM fts_invoices WHERE sale_id = ?').run(saleId);
    db.prepare(`INSERT INTO fts_invoices (sale_id, invoice_no, customer_name) VALUES (?,?,?)`).run(
      saleId,
      invoiceNo,
      customerName,
    );

    const statusNote = newStatus === oldStatus ? '' : ` · ${oldStatus} → ${newStatus}`;
    const note = `${input.reason.trim()} · total ${oldTotal} → ${totals.total}${statusNote}`;
    db.prepare(
      `INSERT INTO sale_audit (id, sale_id, at, by_user, action, note) VALUES (?,?,?,?,?,?)`,
    ).run(newId('au'), saleId, at, input.userId, 'edited', note);

    logActivity(db, {
      by: input.userId,
      branchId,
      action: 'edited',
      entity: 'sale',
      entityId: saleId,
      entityRef: invoiceNo,
      message: `Edited ${invoiceNo} — ${input.reason.trim()}`,
      amount: totals.total,
      at,
    });

    return { id: saleId, invoiceNo, totals, cogs, profit, paid, due, previousTotal: oldTotal };
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
