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
import { shopBranchId } from './branch.ts';
import {
  assertDiscountWithinSubtotal,
  assertDocumentLines,
  assertOrderCharges,
  assertSaleSettlement,
  canonicalMethod,
  isWalkIn,
  normalisePayments,
} from '../core/validate.ts';
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
  /** Internal: who took a payment carried over by a correction. Never from the screen. */
  byUser?: string;
}

export interface CreateSaleInput {
  status?: SaleStatus;
  date?: string;
  customerId?: string;
  /** Omitted → the sale's/bill's branch, else the shop's default (services/branch.ts). */
  branchId?: string;
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
  /** Set by `convertSale`: the quotation this sale was made from. */
  sourceQuotationId?: string;
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
  /** Products already on the sale being corrected: an archived one may stay on it. */
  opts: { priorProducts?: ReadonlySet<string> } = {},
) {
  // Nothing reaches the arithmetic unchecked (backend/core/validate.ts): a
  // negative quantity used to put stock IN, a discount bigger than the bill
  // was stored, and NaN travelled into every total.
  assertDocumentLines(
    input.lines?.map((l) => ({
      productId: l.productId,
      qty: l.qty,
      price: l.spr,
      discountPct: l.discountPct,
      discountFlat: l.discountFlat,
      unitFactor: l.unitFactor,
    })),
    'sale',
  );
  input.lines.forEach((l, i) => {
    if (l.markupPct !== undefined && l.markupPct !== null && (!Number.isFinite(l.markupPct) || l.markupPct < -100)) {
      throw new Error(`Line ${i + 1}: the markup must be a number above −100%.`);
    }
    // VAT on a sale is charged on the whole bill. A line's own tax % used to be
    // STORED and never charged, so the invoice and its lines disagreed. It is
    // now stored as 0 (writeSaleBody) — not refused, because correcting an
    // older sale re-sends whatever that line carried, and it was never money.
  });
  assertOrderCharges(input);
  const checkedPayments = normalisePayments(input.payments);

  const computedLines = input.lines.map((l, idx) => {
    const c = computeSaleLine({
      qty: l.qty,
      spr: l.spr,
      markupPct: l.markupPct ?? 0,
      discountPct: l.discountPct ?? 0,
      discountFlat: l.discountFlat ?? 0,
    });
    const prod = db
      .prepare('SELECT name, sku, archived_at FROM products WHERE id = ?')
      .get(l.productId) as { name: string; sku: string; archived_at: string | null } | undefined;
    if (!prod) throw new Error(`Line ${idx + 1}: that product does not exist.`);
    // An archived product is out of the catalogue; it cannot be sold again, but
    // a correction may keep it on the invoice it was already sold on.
    if (prod.archived_at && !opts.priorProducts?.has(l.productId)) {
      throw new Error(`${prod.name} is archived. Restore it to the catalogue before selling it.`);
    }
    const unitCost =
      l.unitCostAtSale !== undefined ? l.unitCostAtSale : weightedAvgCost(db, l.productId);
    return {
      idx,
      input: l,
      unitPrice: c.unitPrice,
      lineSubtotal: c.lineSubtotal,
      lineGross: round2(c.unitPrice * l.qty),
      unitCost,
      name: prod.name,
      sku: prod.sku ?? '—',
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
  assertDiscountWithinSubtotal(totals.orderDiscount, totals.subtotal);

  /**
   * COGS in BASE units. `unitCost` is the cost of ONE BASE UNIT (a piece) — the
   * weighted average and the stock movement are both per piece — while the line
   * quantity is in the unit it was sold in. Selling 5 dozen used to book the
   * cost of 5 pieces. The stock movement already used `qty × factor`.
   */
  const cogs = computeCogs(
    computedLines.map((l) => ({
      qty: l.input.qty * (l.input.unitFactor ?? 1),
      unitCostAtSale: l.unitCost,
    })),
  );
  const profit = computeSaleProfit(totals.subtotal, totals.orderDiscount, cogs);

  /**
   * A DRAFT or QUOTATION has no settlement: nothing has been sold, so nobody owes
   * anything. Both columns are 0.
   *
   * Note what that means downstream: `due = 0` reads as "fully paid" to anything
   * that only looks at the two numbers. Every screen that can show a non-final
   * document must therefore check the STATUS FIRST — see `settlementOf`, which now
   * takes the status and returns a distinct state for these.
   *
   * `credited` is not set here: it belongs to sell returns that happened
   * independently of this input, so createSale leaves it at its default 0 and
   * updateSale carries the existing value forward.
   */
  const payments = checkedPayments;
  const paid = status === 'final' ? sum2(payments.map((p) => p.amount)) : 0;
  const due = status === 'final' ? round2(Math.max(0, totals.total - paid)) : 0;

  return { computedLines, totals, cogs, profit, payments, paid, due };
}

type ComputedSaleBody = ReturnType<typeof computeSaleBody>;

/**
 * The customer and branch a sale names must exist. With foreign keys on, a bad
 * id failed as a bare "FOREIGN KEY constraint failed"; without, it wrote a sale
 * nobody's khata or branch report would ever include.
 */
function assertSaleRefs(db: DB, input: { customerId?: string | null; branchId?: string }) {
  if (!input.branchId) throw new Error('The sale has no branch.');
  if (!db.prepare('SELECT 1 FROM branches WHERE id = ?').get(input.branchId)) {
    throw new Error('That branch does not exist.');
  }
  if (input.customerId && !db.prepare('SELECT 1 FROM customers WHERE id = ?').get(input.customerId)) {
    throw new Error('That customer does not exist.');
  }
}

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
      // Never charged (VAT is order-level), so never stored — see computeSaleBody.
      taxPct: 0,
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
      byUser: p.byUser ?? userId,
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
    // No branch named → the shop's default branch (one branch for now).
    const branchId = shopBranchId(db, input.branchId);
    input = { ...input, branchId };
    const status: SaleStatus = input.status ?? 'final';
    const date = input.date ?? new Date().toISOString();
    const saleId = newId('sale');

    assertSaleRefs(db, input);
    const body = computeSaleBody(db, input, status);
    const { totals, cogs, profit, paid, due } = body;
    if (status === 'final') {
      assertSaleSettlement({ customerId: input.customerId, total: totals.total, paid });
    }

    const invoiceNo = nextRef(db, status === 'final' ? 'sale' : status === 'draft' ? 'draft' : status === 'quotation' ? 'quotation' : 'sale');

    // ----- insert sale header -----
    db.prepare(
      `INSERT INTO sales (id, invoice_no, status, date, customer_id, branch_id, user_id, agent_id,
         subtotal, total_line_discount, order_discount_pct, order_discount_flat, order_discount,
         tax_pct, tax, shipping, other, round_off, total, paid, due, cogs, profit, valid_until, notes,
         source_quotation_id)
       VALUES (@id, @invoiceNo, @status, @date, @customerId, @branchId, @userId, @agentId,
         @subtotal, @totalLineDiscount, @odpct, @odflat, @orderDiscount,
         @taxPct, @tax, @shipping, @other, @roundOff, @total, @paid, @due, @cogs, @profit, @validUntil, @notes,
         @sourceQuotationId)`,
    ).run({
      id: saleId,
      invoiceNo,
      status,
      date,
      customerId: input.customerId ?? null,
      branchId: branchId,
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
      sourceQuotationId: input.sourceQuotationId ?? null,
    });

    // ----- lines + payments + stock/cash side effects -----
    writeSaleBody(db, {
      saleId,
      invoiceNo,
      status,
      date,
      branchId: branchId,
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
        branchId: branchId,
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
export function updateSale(
  db: DB,
  saleId: string,
  input: UpdateSaleInput,
  /**
   * Internal, set only by `convertSale`: the real invoice number a finalised
   * draft gets, and permission to turn a draft into a final sale.
   */
  opts: { newInvoiceNo?: string; converting?: boolean } = {},
) {
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
    /**
     * A FINAL sale cannot be turned back into a draft or a quotation.
     *
     * That edit used to go through: the stock came back and the cash went out,
     * but every NON-cash payment row was deleted with the old body and a draft
     * writes no payments — so a bKash or card payment the customer really made
     * vanished from the database. A sale that should not have happened is voided;
     * its number, its payments and the reason stay on record.
     */
    if (oldStatus === 'final' && newStatus !== 'final') {
      throw new Error(
        `${sale.invoice_no as string} is final and cannot become a ${newStatus}. Void it instead.`,
      );
    }
    /**
     * A draft or quotation becomes a sale only through `convertSale`, which
     * gives it a real invoice number and keeps a quotation as it was. Finalising
     * one here kept its DRF-/QTN- number as the invoice number.
     */
    if (oldStatus !== 'final' && newStatus === 'final' && !opts.converting) {
      throw new Error(
        `${sale.invoice_no as string} is a ${oldStatus}. Use "Convert to Sale" to make it a sale.`,
      );
    }
    assertSaleRefs(db, { customerId: input.customerId, branchId: input.branchId || (sale.branch_id as string) });

    /**
     * PAYMENT HISTORY SURVIVES A CORRECTION unless the correction changes it.
     *
     * Every payment row is rebuilt from the input below. An edit that did not
     * send its payments used to delete them — a bKash or card payment the
     * customer really made vanished. With no payment list, the existing rows are
     * carried over as they were, with their date and who took them.
     */
    if (input.payments === undefined && oldStatus === 'final') {
      const kept = db
        .prepare('SELECT method, amount, reference, paid_at, by_user FROM sale_payments WHERE sale_id = ? ORDER BY paid_at, rowid')
        .all(saleId) as { method: string; amount: number; reference: string | null; paid_at: string; by_user: string | null }[];
      input = {
        ...input,
        payments: kept.map((p) => ({
          method: p.method,
          amount: p.amount,
          reference: p.reference ?? undefined,
          paidAt: p.paid_at,
          byUser: p.by_user ?? undefined,
        })),
      };
    } else if (input.payments) {
      // Who took a payment is never the screen's to say. A payment the edit
      // sends back UNCHANGED (same method, amount, reference and time) keeps
      // the person who originally took it; only new or changed rows are
      // credited to the person making the correction.
      const pool = (
        db
          .prepare('SELECT method, amount, reference, paid_at, by_user FROM sale_payments WHERE sale_id = ?')
          .all(saleId) as { method: string; amount: number; reference: string | null; paid_at: string; by_user: string | null }[]
      ).map((r) => ({ ...r, used: false }));
      input = {
        ...input,
        payments: input.payments.map(({ byUser: _b, ...p }) => {
          const same = pool.find(
            (r) =>
              !r.used &&
              r.method === p.method &&
              Math.abs(r.amount - Number(p.amount)) < 0.005 &&
              (r.reference ?? '') === (p.reference ?? '') &&
              !!p.paidAt &&
              r.paid_at === p.paidAt,
          );
          if (!same) return p;
          same.used = true;
          return { ...p, byUser: same.by_user ?? undefined };
        }),
      };
    }

    /**
     * What the edit does NOT say is carried over from the line it replaces.
     *
     * The edit form sends neither the pack size nor the cost at sale. Defaulting
     * the pack size to 1 re-deducted TWO pieces for a line that had taken out two
     * dozen (the reversal above uses the stored factor), leaving 22 phantom pieces
     * on the shelf; and re-deriving the cost from today's average rewrote the
     * profit of a sale made weeks ago. A finalized sale keeps its cost of goods; a
     * draft being finalized takes today's, because it is being sold now.
     */
    const priorLines = db
      .prepare('SELECT product_id, unit_factor, unit_cost_at_sale, qty FROM sale_lines WHERE sale_id = ? ORDER BY line_no')
      .all(saleId) as { product_id: string; unit_factor: number; unit_cost_at_sale: number; qty: number }[];
    const prior = new Map<string, { unit_factor: number; unit_cost_at_sale: number }>();
    for (const l of priorLines) if (!prior.has(l.product_id)) prior.set(l.product_id, l);
    input = {
      ...input,
      lines: input.lines.map((l) => {
        const p = prior.get(l.productId);
        return {
          ...l,
          unitFactor: l.unitFactor ?? (p && p.unit_factor > 0 ? p.unit_factor : undefined),
          unitCostAtSale:
            l.unitCostAtSale ?? (oldStatus === 'final' && p ? p.unit_cost_at_sale : undefined),
        };
      }),
    };

    /**
     * A correction cannot sell fewer than have already come back. If 4 of 10 were
     * returned and the invoice is corrected to 3, the shop would hold a return for
     * goods it never sold.
     */
    if (oldStatus === 'final') {
      const returned = db
        .prepare(
          `SELECT product_id, SUM(qty) AS base FROM stock_movements
            WHERE ref_type = 'sale' AND ref_id = ? AND reason = 'sale_return'
            GROUP BY product_id`,
        )
        .all(saleId) as { product_id: string; base: number }[];
      for (const r of returned) {
        const newBase = input.lines
          .filter((l) => l.productId === r.product_id)
          .reduce((a, l) => a + l.qty * (l.unitFactor ?? 1), 0);
        if (newBase + 1e-9 < r.base) {
          throw new Error(
            `${r.base} of that item were already returned on ${sale.invoice_no as string}, so the corrected sale cannot have fewer.`,
          );
        }
      }
    }

    const at = new Date().toISOString();
    const invoiceNo = opts.newInvoiceNo ?? (sale.invoice_no as string);
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
    const body = computeSaleBody(db, input, newStatus, {
      priorProducts: new Set(priorLines.map((l) => l.product_id)),
    });
    const { totals, cogs, profit, paid } = body;
    if (newStatus === 'final') {
      assertSaleSettlement({
        customerId: input.customerId,
        total: totals.total,
        paid,
        credited: (sale.credited as number) ?? 0,
      });
    }
    /**
     * `credited` SURVIVES a correction, and the due is recomputed around it.
     *
     * Credit notes are not part of the edited input — they come from sell returns
     * that already happened — so re-deriving `due` as `total - paid` here would
     * silently wipe them and put the customer back in debt for goods they had
     * returned. Zeroed only when the correction turns the sale into a draft or a
     * quotation, which have no settlement at all.
     */
    const credited = newStatus === 'final' ? round2((sale.credited as number) ?? 0) : 0;
    const due =
      newStatus === 'final' ? round2(Math.max(0, totals.total - paid - credited)) : 0;

    // ---------- 4. rewrite the header (id + invoice_no untouched) ----------
    db.prepare(
      `UPDATE sales SET
         invoice_no = @invoiceNo,
         status = @status, date = @date, customer_id = @customerId, branch_id = @branchId,
         agent_id = @agentId, subtotal = @subtotal, total_line_discount = @totalLineDiscount,
         order_discount_pct = @odpct, order_discount_flat = @odflat, order_discount = @orderDiscount,
         tax_pct = @taxPct, tax = @tax, shipping = @shipping, other = @other, round_off = @roundOff,
         total = @total, paid = @paid, credited = @credited, due = @due,
         cogs = @cogs, profit = @profit,
         valid_until = @validUntil, notes = @notes, updated_at = @updatedAt
       WHERE id = @id`,
    ).run({
      id: saleId,
      invoiceNo,
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
      credited,
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

/**
 * Turn a DRAFT or a QUOTATION into a real sale.
 *
 * "Convert to Sale" used to open the edit form and nothing more: the page never
 * read `?convert=true`, so a quotation stayed a quotation; saving it went through
 * the Admin-only correction path with a mandatory "why is this being corrected?"
 * prompt; and converting a draft by hand kept its DRAFT number (`DRF-…`) as the
 * invoice number, because a correction keeps the number the customer holds.
 *
 *  - A DRAFT is the sale itself, not yet finished: it is finalised in place and
 *    given a real invoice number from the sale sequence. Stock and cash apply
 *    now, once, through the same writer every sale uses.
 *  - A QUOTATION is a document the customer was handed and may be holding: it is
 *    KEPT, and a new final sale is made from it with `source_quotation_id`
 *    pointing back. A quotation converts once; a second attempt says which
 *    invoice it already became (unless that invoice was voided).
 *
 * The input is the sale as it will be finalised — the form lets prices and
 * quantities be adjusted at the counter before converting.
 */
export function convertSale(
  db: DB,
  saleId: string,
  input: Omit<UpdateSaleInput, 'reason' | 'status' | 'sourceQuotationId'>,
) {
  return tx(db, () => {
    const src = db.prepare('SELECT status, invoice_no FROM sales WHERE id = ?').get(saleId) as
      | { status: SaleStatus; invoice_no: string }
      | undefined;
    if (!src) throw new Error('Sale not found');

    if (src.status === 'draft') {
      const invoiceNo = nextRef(db, 'sale');
      const res = updateSale(
        db,
        saleId,
        { ...input, status: 'final', reason: `Converted from draft ${src.invoice_no}` },
        { newInvoiceNo: invoiceNo, converting: true },
      );
      return { id: saleId, invoiceNo, from: src.invoice_no, total: res.totals.total, due: res.due };
    }

    if (src.status === 'quotation') {
      const already = db
        .prepare("SELECT invoice_no FROM sales WHERE source_quotation_id = ? AND status != 'void'")
        .get(saleId) as { invoice_no: string } | undefined;
      if (already) {
        throw new Error(`${src.invoice_no} was already converted to ${already.invoice_no}.`);
      }
      const res = createSale(db, { ...input, status: 'final', sourceQuotationId: saleId });
      db.prepare(
        `INSERT INTO sale_audit (id, sale_id, at, by_user, action, note) VALUES (?,?,?,?,?,?)`,
      ).run(newId('au'), saleId, new Date().toISOString(), input.userId, 'converted', res.invoiceNo);
      return { id: res.id, invoiceNo: res.invoiceNo, from: src.invoice_no, total: res.totals.total, due: res.due };
    }

    throw new Error(`${src.invoice_no} is ${src.status} — only a draft or a quotation can be converted.`);
  });
}

/** Add a payment to an existing sale; updates paid/due and routes cash. */
export function addSalePayment(db: DB, saleId: string, p: SalePaymentInput, userId: string) {
  return tx(db, () => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as
      | Record<string, unknown>
      | undefined;
    if (!sale) throw new Error('Sale not found');
    /**
     * Money can only be taken against a FINAL invoice. A payment on a voided sale
     * used to go through and re-open it — `due` became `total − paid` on a
     * cancelled invoice — and the cash landed in the drawer against nothing. A
     * draft or quotation is not a bill yet.
     */
    if (sale.status !== 'final') {
      throw new Error(`${sale.invoice_no as string} is ${sale.status as string} — a payment needs a final sale.`);
    }
    if (!Number.isFinite(p.amount) || p.amount <= 0) {
      throw new Error('A payment must be more than zero.');
    }
    // 'cash' in lower case used to skip the drawer: only 'Cash' posts to it.
    p = { ...p, method: canonicalMethod(p.method) };
    // A named customer may pay ahead (the extra is a credit on their account);
    // a walk-in has no account to hold it.
    if (isWalkIn(sale.customer_id as string | null) && p.amount > (sale.due as number) + 0.005) {
      throw new Error('A walk-in customer cannot pay more than is owing on the bill.');
    }
    const at = p.paidAt ?? new Date().toISOString();
    db.prepare(
      `INSERT INTO sale_payments (id, sale_id, method, amount, reference, paid_at, by_user)
       VALUES (?,?,?,?,?,?,?)`,
    ).run(newId('pay'), saleId, p.method, round2(p.amount), p.reference ?? null, at, userId);

    const paid = round2((sale.paid as number) + p.amount);
    // `credited` (CreditAdjust returns) settles the invoice too, so it has to come
    // off the due as well — otherwise an invoice with a credit note could never be
    // cleared by payment, which is exactly the bug this column was added for.
    const credited = round2((sale.credited as number) ?? 0);
    const due = round2(Math.max(0, (sale.total as number) - paid - credited));
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

    /**
     * NO VOID AFTER A RETURN.
     *
     * The void puts back every line in full and pays back all the cash taken. A
     * return has already done part of both: sell 10, take 4 back, void — and 14
     * went back on a shelf that had 10 taken off it, while a cash refund went out
     * of the drawer twice. Reversing "what is left" is possible, but the refund
     * method of each return (cash, credit note, store credit) decides what is
     * left in the drawer and on the khata, and guessing at that is how the books
     * go wrong. Returning the remaining items is the honest way to undo the rest.
     */
    const returns = (
      db.prepare('SELECT COUNT(*) AS c FROM sell_returns WHERE sale_id = ?').get(saleId) as { c: number }
    ).c;
    if (returns > 0) {
      throw new Error(
        `${sale.invoice_no as string} already has a return against it, so it cannot be voided. Return the remaining items instead.`,
      );
    }
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

    /**
     * `paid`, `credited` and `due` are ZEROED, not left as they were.
     *
     * A voided invoice is cancelled: nobody owes anything on it any more. The
     * columns used to be left untouched, and because `paid`/`due` drive the
     * settlement badge, the payment filter in `paged.ts`, the pager count and the
     * per-row Due column, one voided credit sale produced four different answers
     * on one screen — a red "৳8,500 Unpaid" row sitting under a KPI strip that
     * (correctly) excluded voids, and matching the "Unpaid" filter.
     *
     * `customerDue` never counted it (every term is scoped `status='final'`), so
     * this brings the row into line with the ledger rather than changing what the
     * shop is owed. The `sale_payments` rows are deliberately KEPT: they are the
     * record of money that really did change hands before the void, and the cash
     * reversal above is what returns it.
     */
    db.prepare(
      `UPDATE sales
          SET status = 'void', paid = 0, credited = 0, due = 0,
              voided_at = ?, voided_by = ?, void_reason = ?, updated_at = ?
        WHERE id = ?`,
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
