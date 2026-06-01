import type { DB } from '../db/connection.ts';
import { Rng } from './rng.ts';
import { seedMaster, type SeededMaster } from './master.ts';
import { createPurchase } from '../services/purchases.ts';
import { createSale } from '../services/sales.ts';
import { createSellReturn } from '../services/returns.ts';
import { createExpense } from '../services/expenses.ts';
import { createAdjustment, createTransfer } from '../services/stockOps.ts';
import { openShift, closeShift, getOpenShift } from '../services/cash.ts';
import { recordMovement, stockOnHand } from '../services/stock.ts';
import { computeSaleLine, computeSaleTotals, computePurchaseTotals } from '../core/calc.ts';
import { round2 } from '../core/money.ts';

export interface SimulateOptions {
  days?: number;        // how many days of history (default 365)
  seed?: number;
  branchId?: string;    // primary branch for sales (default first)
}

export interface SimulateResult extends SeededMaster {
  salesCount: number;
  purchasesCount: number;
  returnsCount: number;
  expensesCount: number;
  shiftsCount: number;
}

interface ProductRow {
  id: string;
  price: number;
  cost: number;
  wholesale_price: number | null;
  contractor_price: number | null;
}

/**
 * Generate a coherent history:
 *   - opening stock for every product at the primary branch
 *   - weekly/biweekly purchases that top up stock
 *   - daily shifts with multiple sales (cash + non-cash + credit)
 *   - occasional returns, expenses, transfers, adjustments
 * All operations go through the real services, so every invariant the services
 * enforce (stock from movements, derived dues, cash routing) holds by construction.
 */
export function simulate(db: DB, opts: SimulateOptions = {}): SimulateResult {
  const days = opts.days ?? 365;
  const rng = new Rng(opts.seed ?? 12345);
  const master = seedMaster(db);
  const branch = opts.branchId ?? master.branchIds[0];
  const otherBranch = master.branchIds[1];
  const cashier = 'u_rana';
  const manager = 'u_admin';

  const products = db
    .prepare('SELECT id, price, cost, wholesale_price, contractor_price FROM products')
    .all() as ProductRow[];

  // ----- Opening stock (as movements dated at start) -----
  const start = new Date(Date.now() - days * 86400000);
  const openingDate = start.toISOString();
  for (const p of products) {
    const qty = rng.int(80, 400);
    recordMovement(db, {
      productId: p.id,
      branchId: branch,
      reason: 'opening_stock',
      qty,
      unitCost: p.cost,
      refType: 'opening',
      note: 'opening stock',
      userId: manager,
      at: openingDate,
    });
    // smaller opening stock at the second (active) branch
    recordMovement(db, {
      productId: p.id,
      branchId: otherBranch,
      reason: 'opening_stock',
      qty: rng.int(20, 120),
      unitCost: p.cost,
      refType: 'opening',
      userId: manager,
      at: openingDate,
    });
  }

  let salesCount = 0;
  let purchasesCount = 0;
  let returnsCount = 0;
  let expensesCount = 0;
  let shiftsCount = 0;

  const customers = master.customerIds;
  const suppliers = master.supplierIds;
  const agents = master.agentIds;

  // group products by supplier-ish for purchases (just random subsets)
  const dayMs = 86400000;

  for (let d = 0; d < days; d++) {
    const dayStart = new Date(start.getTime() + d * dayMs);
    const dow = dayStart.getDay();
    // shop closed on Friday (dow 5) sometimes
    const isClosed = dow === 5 && rng.chance(0.5);
    if (isClosed) continue;

    // ----- Weekly purchase (restock) on ~Saturday or when low -----
    if (rng.chance(0.22)) {
      const supplier = rng.pick(suppliers);
      const lineCount = rng.int(2, 5);
      const lines: { productId: string; qty: number; unitCostBeforeDisc: number; discountPct: number; taxPct: number }[] = [];
      const used = new Set<string>();
      for (let i = 0; i < lineCount; i++) {
        const p = rng.pick(products);
        if (used.has(p.id)) continue;
        used.add(p.id);
        lines.push({
          productId: p.id,
          qty: rng.int(20, 150),
          unitCostBeforeDisc: round2(p.cost * (1 + (rng.next() - 0.5) * 0.06)),
          discountPct: rng.chance(0.3) ? rng.int(1, 5) : 0,
          taxPct: 0,
        });
      }
      if (lines.length > 0) {
        const purDate = new Date(dayStart.getTime() + 9 * 3600000).toISOString();
        // compute the REAL total (after line discounts) so payments are realistic
        const pt = computePurchaseTotals({
          lines: lines.map((l) => ({
            qty: l.qty,
            unitCostBeforeDisc: l.unitCostBeforeDisc,
            discountPct: l.discountPct ?? 0,
            discountFlat: 0,
            taxPct: l.taxPct ?? 0,
          })),
          orderDiscountType: 'flat',
          orderDiscountValue: 0,
          taxPct: 0,
          shipping: 0,
          other: 0,
        });
        const total = pt.total;
        // pay fully, partially, or on credit
        const payRoll = rng.next();
        const payments =
          payRoll < 0.5
            ? [{ method: rng.pick(['Cash', 'Bank', 'bKash']), amount: total, paidAt: purDate }]
            : payRoll < 0.8
              ? [{ method: 'Bank', amount: round2(total * 0.5), paidAt: purDate }]
              : [];
        createPurchase(db, {
          status: 'received',
          date: purDate,
          supplierId: supplier,
          branchId: branch,
          userId: manager,
          lines,
          payments,
        });
        purchasesCount++;
      }
    }

    // ----- Open a shift for the day -----
    const openExisting = getOpenShift(db, branch);
    let shiftId: string;
    const openAt = new Date(dayStart.getTime() + 9.5 * 3600000).toISOString();
    if (openExisting) {
      shiftId = openExisting.id as string;
    } else {
      shiftId = openShift(db, {
        branchId: branch,
        userId: cashier,
        openingCash: 5000,
        at: openAt,
      });
      shiftsCount++;
    }

    // ----- Sales through the day -----
    const saleCount = rng.weighted([0, rng.int(3, 8), rng.int(8, 18), rng.int(18, 30)], [0.05, 0.35, 0.4, 0.2]);
    for (let s = 0; s < saleCount; s++) {
      const hour = rng.int(10, 20);
      const min = rng.int(0, 59);
      const saleDate = new Date(dayStart.getTime() + hour * 3600000 + min * 60000).toISOString();
      const customerId = rng.chance(0.45) ? rng.pick(customers) : 'cu1'; // 45% identified, else walk-in
      const cust = db.prepare('SELECT price_group FROM customers WHERE id = ?').get(customerId) as
        | { price_group: string }
        | undefined;
      const group = cust?.price_group ?? 'Retail';

      const lineCount = rng.weighted([1, 2, 3, rng.int(4, 7)], [0.4, 0.3, 0.2, 0.1]);
      const lines: { productId: string; qty: number; spr: number; discountPct: number; taxPct: number }[] = [];
      const used = new Set<string>();
      for (let i = 0; i < lineCount; i++) {
        const p = rng.pick(products);
        if (used.has(p.id)) continue;
        const onHand = stockOnHand(db, p.id, branch);
        if (onHand <= 1) continue;
        used.add(p.id);
        const qty = Math.min(onHand - 1, rng.int(1, 8));
        if (qty <= 0) continue;
        const spr =
          group === 'Wholesale'
            ? p.wholesale_price ?? p.price
            : group === 'Contractor'
              ? p.contractor_price ?? p.price
              : p.price;
        lines.push({
          productId: p.id,
          qty,
          spr,
          discountPct: rng.chance(0.15) ? rng.int(1, 8) : 0,
          taxPct: 0,
        });
      }
      if (lines.length === 0) continue;

      // order-level
      const orderDiscountFlat = rng.chance(0.1) ? rng.int(20, 200) : 0;
      // compute the EXACT total via the core so full-payment sales are due=0
      const computedLines = lines.map((l) =>
        computeSaleLine({
          qty: l.qty,
          spr: l.spr,
          markupPct: 0,
          discountPct: l.discountPct ?? 0,
          discountFlat: 0,
        }),
      );
      const st = computeSaleTotals({
        lineSubtotals: computedLines.map((c) => c.lineSubtotal),
        lineGrosses: computedLines.map((c, i) => round2(c.unitPrice * lines[i].qty)),
        orderDiscountPct: 0,
        orderDiscountFlat,
        taxPct: 0,
        shipping: 0,
        other: 0,
      });
      const estTotal = st.total;

      // payment behavior: walk-ins pay full cash/mobile; credit customers may part-pay
      let payments;
      const method = rng.weighted(['Cash', 'bKash', 'Nagad', 'Card', 'Bank', 'Credit'], [0.5, 0.18, 0.12, 0.08, 0.05, 0.07]);
      if (customerId === 'cu1' || method !== 'Credit') {
        payments = [{ method: method === 'Credit' ? 'Cash' : method, amount: estTotal, paidAt: saleDate, reference: method === 'Cash' ? undefined : 'TX' + rng.int(10000, 99999) }];
      } else {
        // credit sale: partial or none
        const payRoll = rng.next();
        payments =
          payRoll < 0.4
            ? [{ method: 'Cash', amount: round2(estTotal * 0.5), paidAt: saleDate }]
            : [];
      }

      createSale(db, {
        status: 'final',
        date: saleDate,
        customerId: customerId === 'cu1' ? undefined : customerId,
        branchId: branch,
        userId: cashier,
        agentId: group === 'Contractor' && rng.chance(0.5) ? rng.pick(agents) : undefined,
        lines,
        orderDiscountFlat,
        taxPct: 0,
        payments,
      });
      salesCount++;
    }

    // ----- occasional return -----
    if (rng.chance(0.06)) {
      const recent = db
        .prepare("SELECT id, branch_id FROM sales WHERE status='final' AND branch_id = ? ORDER BY date DESC LIMIT 30")
        .all(branch) as { id: string; branch_id: string }[];
      if (recent.length > 0) {
        const sale = rng.pick(recent);
        const sLines = db
          .prepare('SELECT product_id, qty, unit_price FROM sale_lines WHERE sale_id = ?')
          .all(sale.id) as { product_id: string; qty: number; unit_price: number }[];
        if (sLines.length > 0) {
          const l = rng.pick(sLines);
          const retQty = Math.max(1, Math.floor(l.qty / 2));
          const retDate = new Date(dayStart.getTime() + 15 * 3600000).toISOString();
          createSellReturn(db, {
            saleId: sale.id,
            date: retDate,
            branchId: branch,
            userId: cashier,
            reason: rng.pick(['damaged', 'wrong-item', 'changed-mind', 'defective']),
            refundMethod: rng.pick(['Cash', 'CreditAdjust', 'StoreCredit']),
            lines: [
              {
                productId: l.product_id,
                qty: retQty,
                unitPrice: l.unit_price,
                refundAmount: round2(retQty * l.unit_price),
              },
            ],
          });
          returnsCount++;
        }
      }
    }

    // ----- expenses (a few per week) -----
    if (rng.chance(0.25)) {
      const cat = rng.pick(master.expenseCategoryIds);
      const amt = cat === 'ec_rent' ? 45000 : cat === 'ec_salary' ? rng.int(15000, 30000) : rng.int(500, 6000);
      createExpense(db, {
        date: new Date(dayStart.getTime() + 12 * 3600000).toISOString(),
        categoryId: cat,
        amount: amt,
        paymentMethod: rng.pick(['Cash', 'bKash', 'Bank']),
        note: 'Operating expense',
        branchId: branch,
        userId: manager,
      });
      expensesCount++;
    }

    // ----- occasional transfer to other branch -----
    if (rng.chance(0.04)) {
      const p = rng.pick(products);
      const onHand = stockOnHand(db, p.id, branch);
      if (onHand > 30) {
        createTransfer(db, {
          date: new Date(dayStart.getTime() + 11 * 3600000).toISOString(),
          fromBranch: branch,
          toBranch: otherBranch,
          status: 'received',
          lines: [{ productId: p.id, qty: rng.int(5, 20) }],
          createdBy: manager,
        });
      }
    }

    // ----- occasional adjustment -----
    if (rng.chance(0.03)) {
      const p = rng.pick(products);
      const onHand = stockOnHand(db, p.id, branch);
      if (onHand > 5) {
        createAdjustment(db, {
          date: new Date(dayStart.getTime() + 16 * 3600000).toISOString(),
          branchId: branch,
          type: rng.pick(['damage', 'theft', 'recount']),
          reason: 'Routine adjustment',
          lines: [{ productId: p.id, qty: -rng.int(1, 3) }],
          createdBy: manager,
        });
      }
    }

    // ----- close the shift at end of day -----
    const totals = (() => {
      const inRow = db
        .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM cash_movements WHERE shift_id = ? AND direction='in' AND reason != 'opening'")
        .get(shiftId) as { s: number };
      const outRow = db
        .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM cash_movements WHERE shift_id = ? AND direction='out'")
        .get(shiftId) as { s: number };
      return 5000 + inRow.s - outRow.s;
    })();
    // counted cash = expected +/- small variance occasionally
    const variance = rng.chance(0.3) ? rng.int(-50, 50) : 0;
    closeShift(db, {
      shiftId,
      countedCash: round2(totals + variance),
      carriedFloat: 5000,
      at: new Date(dayStart.getTime() + 21 * 3600000).toISOString(),
    });
  }

  return {
    ...master,
    salesCount,
    purchasesCount,
    returnsCount,
    expensesCount,
    shiftsCount,
  };
}
