/**
 * RIGOROUS BACKEND VERIFICATION
 * Builds a fresh in-memory DB, seeds a year of synthetic shop activity through
 * the real services, then asserts every accounting identity, stock invariant,
 * derived-balance cross-check, and aggregation consistency. Exits non-zero on
 * any failure so it can gate a build.
 */
import { openDatabase, migrate, type DB } from '../db/connection.ts';
import { simulate } from '../seed/simulate.ts';
import { Suite } from './assert.ts';
import { EPSILON, round2 } from '../core/money.ts';
import { stockOnHand, stockLevels, weightedAvgCost } from '../services/stock.ts';
import { customerDue, supplierDue } from '../services/ledger.ts';
import {
  computeSaleLine,
  computeSaleTotals,
  computePurchaseLine,
  computePurchaseTotals,
} from '../core/calc.ts';
import { amountInWords, intToWords } from '../core/words.ts';
import { getStats, paymentMethodBreakdown } from '../services/dashboard.ts';
import { profitLoss, productSell, taxReport, sellPayments } from '../services/reports.ts';
import { resolveRange } from '../core/dates.ts';
import { createSale, voidSale } from '../services/sales.ts';

function row<T = Record<string, unknown>>(db: DB, sql: string, ...args: unknown[]): T {
  return db.prepare(sql).get(...args) as T;
}
function rows<T = Record<string, unknown>>(db: DB, sql: string, ...args: unknown[]): T[] {
  return db.prepare(sql).all(...args) as T[];
}

function main() {
  const t0 = Date.now();
  const db = openDatabase(':memory:');
  migrate(db);

  console.log('Seeding 365 days of synthetic activity...');
  const sim = simulate(db, { days: 365, seed: 2026 });
  const seedMs = Date.now() - t0;
  console.log(
    `Seeded in ${seedMs}ms — sales=${sim.salesCount} purchases=${sim.purchasesCount} returns=${sim.returnsCount} expenses=${sim.expensesCount} shifts=${sim.shiftsCount}`,
  );

  const s = new Suite();

  // ============================================================
  // 0. PURE CALCULATION CORE (unit-level)
  // ============================================================
  s.section('core-calc');
  {
    const line = computeSaleLine({ qty: 5, spr: 540, markupPct: 0, discountPct: 0, discountFlat: 0 });
    s.money('sale line basic', line.lineSubtotal, 2700);
    const line2 = computeSaleLine({ qty: 2, spr: 100, markupPct: 10, discountPct: 10, discountFlat: 5 });
    // unit=110, gross=220, after10%=198, -5 = 193
    s.money('sale line markup+disc', line2.lineSubtotal, 193);
    s.money('sale line unit price', line2.unitPrice, 110);

    const totals = computeSaleTotals({
      lineSubtotals: [2700, 193],
      lineGrosses: [2700, 220],
      orderDiscountPct: 0,
      orderDiscountFlat: 200,
      taxPct: 0,
      shipping: 0,
      other: 0,
    });
    s.money('order subtotal', totals.subtotal, 2893);
    s.money('order discount flat', totals.orderDiscount, 200);
    s.money('order total', totals.total, 2693);
    s.money('total line discount', totals.totalLineDiscount, 27); // 220-193

    const tx = computeSaleTotals({
      lineSubtotals: [1000],
      lineGrosses: [1000],
      orderDiscountPct: 10,
      orderDiscountFlat: 0,
      taxPct: 15,
      shipping: 50,
      other: 0,
    });
    // disc=100, taxable=900, tax=135, total=900+135+50=1085
    s.money('tax + shipping total', tx.total, 1085);
    s.money('tax amount', tx.tax, 135);

    const pl = computePurchaseLine({ qty: 10, unitCostBeforeDisc: 100, discountPct: 10, discountFlat: 0, taxPct: 5 });
    // ucbt=90, lineTotal=90*10*1.05=945
    s.money('purchase line', pl.lineTotal, 945);
    s.money('purchase ucbt', pl.unitCostBeforeTax, 90);

    const pt = computePurchaseTotals({
      lines: [{ qty: 10, unitCostBeforeDisc: 100, discountPct: 0, discountFlat: 0, taxPct: 0 }],
      orderDiscountType: 'percent',
      orderDiscountValue: 10,
      taxPct: 0,
      shipping: 0,
      other: 0,
    });
    // gross 1000, disc 100, total 900
    s.money('purchase totals', pt.total, 900);

    // amount in words
    s.eq('words 0', intToWords(0), 'Zero');
    s.eq('words 1234567', intToWords(1234567), 'Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven');
    s.eq('words paisa', amountInWords(3020.5), 'Taka Three Thousand Twenty and Fifty Paisa Only');
  }

  // ============================================================
  // 1. STOCK INVARIANTS
  // ============================================================
  s.section('stock');
  {
    // 1a. Stock on hand for every product/branch is never negative (we always guarded sales)
    const negs = rows<{ product_id: string; branch_id: string; s: number }>(
      db,
      `SELECT product_id, branch_id, SUM(qty) AS s FROM stock_movements GROUP BY product_id, branch_id HAVING s < 0`,
    );
    s.ok('no negative stock anywhere', negs.length === 0, `found ${negs.length} negative balances`);

    // 1b. Every sale line has a matching stock-out movement of equal magnitude
    const finalSales = rows<{ id: string }>(db, "SELECT id FROM sales WHERE status='final'");
    let mismatched = 0;
    for (const sale of finalSales.slice(0, 200)) {
      // sample 200 for speed
      const lines = rows<{ product_id: string; qty: number; unit_factor: number }>(
        db,
        'SELECT product_id, qty, unit_factor FROM sale_lines WHERE sale_id = ?',
        sale.id,
      );
      for (const l of lines) {
        const mov = row<{ s: number }>(
          db,
          "SELECT COALESCE(SUM(qty),0) AS s FROM stock_movements WHERE ref_id = ? AND product_id = ? AND reason='sale'",
          sale.id,
          l.product_id,
        );
        if (Math.abs(mov.s + l.qty * l.unit_factor) > EPSILON) mismatched++;
      }
    }
    s.ok('sale lines match stock-out movements (sampled)', mismatched === 0, `${mismatched} mismatches`);

    // 1c. stockOnHand == stockLevels map
    const levels = stockLevels(db, 'br_mp');
    const sampleProd = 'p1';
    s.money('stockOnHand == stockLevels', stockOnHand(db, sampleProd, 'br_mp'), levels.get(sampleProd) ?? 0);

    // 1d. weighted avg cost is positive for products that were purchased
    const wac = weightedAvgCost(db, 'p1');
    s.gt('weighted avg cost positive', wac, 0);
  }

  // ============================================================
  // 2. SALE-LEVEL ACCOUNTING IDENTITIES (every single sale)
  // ============================================================
  s.section('sale-identities');
  {
    const allSales = rows<Record<string, number | string>>(db, "SELECT * FROM sales WHERE status='final'");
    let totalMismatch = 0;
    let dueMismatch = 0;
    let profitMismatch = 0;
    let lineSumMismatch = 0;
    for (const sale of allSales) {
      const id = sale.id as string;
      // total = taxableBase + tax + shipping + other + roundoff (taxableBase clamped >= 0)
      const taxableBase = round2(Math.max(0, (sale.subtotal as number) - (sale.order_discount as number)));
      const expectedTotal = round2(
        taxableBase + (sale.tax as number) + (sale.shipping as number) + (sale.other as number) + (sale.round_off as number),
      );
      if (Math.abs(expectedTotal - (sale.total as number)) > EPSILON) totalMismatch++;

      // due = total - paid (>= 0)
      const paid = row<{ s: number }>(db, 'SELECT COALESCE(SUM(amount),0) AS s FROM sale_payments WHERE sale_id = ?', id).s;
      const expectedDue = round2(Math.max(0, (sale.total as number) - paid));
      if (Math.abs(expectedDue - (sale.due as number)) > EPSILON) dueMismatch++;
      if (Math.abs(paid - (sale.paid as number)) > EPSILON) dueMismatch++;

      // subtotal = sum(line_subtotal)
      const lineSum = row<{ s: number }>(db, 'SELECT COALESCE(SUM(line_subtotal),0) AS s FROM sale_lines WHERE sale_id = ?', id).s;
      if (Math.abs(round2(lineSum) - (sale.subtotal as number)) > EPSILON) lineSumMismatch++;

      // profit = subtotal - order_discount - cogs
      const expectedProfit = round2((sale.subtotal as number) - (sale.order_discount as number) - (sale.cogs as number));
      if (Math.abs(expectedProfit - (sale.profit as number)) > EPSILON) profitMismatch++;
    }
    s.ok(`total = taxableBase+tax+ship+other+roundoff (n=${allSales.length})`, totalMismatch === 0, `${totalMismatch} bad`);
    s.ok('due = total - paid, clamped >= 0', dueMismatch === 0, `${dueMismatch} bad`);
    s.ok('subtotal = sum(line subtotals)', lineSumMismatch === 0, `${lineSumMismatch} bad`);
    s.ok('profit = subtotal - orderDisc - cogs', profitMismatch === 0, `${profitMismatch} bad`);

    // cogs = sum(qty * unit_cost_at_sale)
    let cogsMismatch = 0;
    for (const sale of allSales.slice(0, 300)) {
      const id = sale.id as string;
      const c = row<{ s: number }>(db, 'SELECT COALESCE(SUM(qty*unit_cost_at_sale),0) AS s FROM sale_lines WHERE sale_id = ?', id).s;
      if (Math.abs(round2(c) - (sale.cogs as number)) > EPSILON) cogsMismatch++;
    }
    s.ok('cogs = sum(qty*unitCostAtSale) (sampled)', cogsMismatch === 0, `${cogsMismatch} bad`);
  }

  // ============================================================
  // 3. PURCHASE-LEVEL IDENTITIES
  // ============================================================
  s.section('purchase-identities');
  {
    const all = rows<Record<string, number | string>>(db, "SELECT * FROM purchases WHERE status != 'cancelled'");
    let dueMismatch = 0;
    let stockInMismatch = 0;
    for (const pur of all) {
      const id = pur.id as string;
      const paid = row<{ s: number }>(db, 'SELECT COALESCE(SUM(amount),0) AS s FROM purchase_payments WHERE purchase_id = ?', id).s;
      const expectedDue = round2(Math.max(0, (pur.total as number) - paid));
      if (Math.abs(expectedDue - (pur.due as number)) > EPSILON) dueMismatch++;
      if (Math.abs(round2(paid) - (pur.paid as number)) > EPSILON) dueMismatch++;
    }
    s.ok(`purchase due = total - paid (n=${all.length})`, dueMismatch === 0, `${dueMismatch} bad`);

    // received purchase lines create matching stock-in movements
    for (const pur of all.slice(0, 150)) {
      if (pur.status !== 'received') continue;
      const id = pur.id as string;
      const lines = rows<{ product_id: string; qty: number }>(db, 'SELECT product_id, qty FROM purchase_lines WHERE purchase_id = ?', id);
      for (const l of lines) {
        const mov = row<{ s: number }>(
          db,
          "SELECT COALESCE(SUM(qty),0) AS s FROM stock_movements WHERE ref_id = ? AND product_id = ? AND reason='purchase'",
          id,
          l.product_id,
        );
        if (Math.abs(mov.s - l.qty) > EPSILON) stockInMismatch++;
      }
    }
    s.ok('purchase lines match stock-in movements (sampled)', stockInMismatch === 0, `${stockInMismatch} bad`);
  }

  // ============================================================
  // 4. DERIVED LEDGER BALANCES
  // ============================================================
  s.section('ledger');
  {
    // customer due never below -EPSILON; ledger ends at the derived due
    const custs = rows<{ id: string }>(db, 'SELECT id FROM customers');
    let ledgerMismatch = 0;
    let negativeDue = 0;
    for (const c of custs) {
      const due = customerDue(db, c.id);
      if (due < -EPSILON) negativeDue++;
      // cross-check: due == opening + sales - payments - creditReturns
      const open = row<{ b: number }>(db, 'SELECT opening_balance AS b FROM customers WHERE id = ?', c.id).b;
      const sales = row<{ s: number }>(db, "SELECT COALESCE(SUM(total),0) AS s FROM sales WHERE customer_id=? AND status='final'", c.id).s;
      const pays = row<{ s: number }>(
        db,
        "SELECT COALESCE(SUM(p.amount),0) AS s FROM sale_payments p JOIN sales sa ON sa.id=p.sale_id WHERE sa.customer_id=? AND sa.status='final'",
        c.id,
      ).s;
      const cr = row<{ s: number }>(db, "SELECT COALESCE(SUM(total),0) AS s FROM sell_returns WHERE customer_id=? AND refund_method='CreditAdjust'", c.id).s;
      const expected = round2(open + sales - pays - cr);
      if (Math.abs(expected - due) > EPSILON) ledgerMismatch++;
    }
    s.ok('customer due formula consistent', ledgerMismatch === 0, `${ledgerMismatch} bad`);
    s.ok('customer due never negative', negativeDue === 0, `${negativeDue} negative`);

    const sups = rows<{ id: string }>(db, 'SELECT id FROM suppliers');
    let supMismatch = 0;
    for (const sp of sups) {
      const due = supplierDue(db, sp.id);
      const open = row<{ b: number }>(db, 'SELECT opening_balance AS b FROM suppliers WHERE id = ?', sp.id).b;
      const pur = row<{ s: number }>(db, "SELECT COALESCE(SUM(total),0) AS s FROM purchases WHERE supplier_id=? AND status!='cancelled'", sp.id).s;
      const pays = row<{ s: number }>(
        db,
        "SELECT COALESCE(SUM(p.amount),0) AS s FROM purchase_payments p JOIN purchases pu ON pu.id=p.purchase_id WHERE pu.supplier_id=? AND pu.status!='cancelled'",
        sp.id,
      ).s;
      const expected = round2(open + pur - pays);
      if (Math.abs(expected - due) > EPSILON) supMismatch++;
    }
    s.ok('supplier due formula consistent', supMismatch === 0, `${supMismatch} bad`);
  }

  // ============================================================
  // 5. CASH DRAWER RECONCILIATION (every shift)
  // ============================================================
  s.section('cash');
  {
    const shifts = rows<Record<string, number | string>>(db, 'SELECT * FROM cash_shifts');
    let expectedMismatch = 0;
    let varianceMismatch = 0;
    for (const sh of shifts) {
      const id = sh.id as string;
      const inRow = row<{ s: number }>(db, "SELECT COALESCE(SUM(amount),0) AS s FROM cash_movements WHERE shift_id=? AND direction='in' AND reason!='opening'", id).s;
      const outRow = row<{ s: number }>(db, "SELECT COALESCE(SUM(amount),0) AS s FROM cash_movements WHERE shift_id=? AND direction='out'", id).s;
      const expected = round2((sh.opening_cash as number) + inRow - outRow);
      if (sh.status === 'closed') {
        if (Math.abs(expected - (sh.expected_cash as number)) > EPSILON) expectedMismatch++;
        const expVar = round2((sh.counted_cash as number) - (sh.expected_cash as number));
        if (Math.abs(expVar - (sh.variance as number)) > EPSILON) varianceMismatch++;
      }
    }
    s.ok(`shift expected = opening + in - out (n=${shifts.length})`, expectedMismatch === 0, `${expectedMismatch} bad`);
    s.ok('shift variance = counted - expected', varianceMismatch === 0, `${varianceMismatch} bad`);

    // every cash sale payment created exactly one 'in' cash movement
    const cashSalePays = row<{ s: number }>(db, "SELECT COALESCE(SUM(amount),0) AS s FROM sale_payments WHERE method='Cash'").s;
    const cashInMovements = row<{ s: number }>(db, "SELECT COALESCE(SUM(amount),0) AS s FROM cash_movements WHERE reason='sale' AND direction='in'").s;
    s.money('cash sale payments == cash-in movements', cashInMovements, cashSalePays);

    // cash expenses == expense cash-out movements
    const cashExp = row<{ s: number }>(db, "SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE payment_method='Cash' AND voided=0").s;
    const expOut = row<{ s: number }>(db, "SELECT COALESCE(SUM(amount),0) AS s FROM cash_movements WHERE reason='expense' AND direction='out'").s;
    s.money('cash expenses == expense cash-out', expOut, cashExp);
  }

  // ============================================================
  // 6. REFERENCE NUMBER UNIQUENESS
  // ============================================================
  s.section('references');
  {
    const dupInv = rows<{ invoice_no: string; c: number }>(db, 'SELECT invoice_no, COUNT(*) c FROM sales GROUP BY invoice_no HAVING c > 1');
    s.ok('sale invoice numbers unique', dupInv.length === 0, `${dupInv.length} dups`);
    const dupPo = rows<{ ref_no: string; c: number }>(db, 'SELECT ref_no, COUNT(*) c FROM purchases GROUP BY ref_no HAVING c > 1');
    s.ok('purchase refs unique', dupPo.length === 0, `${dupPo.length} dups`);
    const dupSku = rows<{ sku: string; c: number }>(db, 'SELECT sku, COUNT(*) c FROM products GROUP BY sku HAVING c > 1');
    s.ok('product SKUs unique', dupSku.length === 0, `${dupSku.length} dups`);
  }

  // ============================================================
  // 7. AGGREGATION CONSISTENCY (dashboard vs raw)
  // ============================================================
  s.section('dashboard');
  {
    const yearRange = { preset: 'thisYear' as const };
    const stats = getStats(db, yearRange);
    // dashboard sales total == raw sum within thisYear range
    const resolved = resolveRange(yearRange);
    const raw = row<{ s: number }>(db, "SELECT COALESCE(SUM(total),0) AS s FROM sales WHERE status='final' AND date>=? AND date<=?", resolved.from, resolved.to).s;
    s.money('dashboard sales total == raw', stats.sales.total, round2(raw));

    // gross profit == revenue - cogs
    s.money('dashboard gross profit identity', stats.profit.grossProfit, round2(stats.profit.revenue - stats.profit.cogs));
    // net profit == gross - expenses
    s.money('dashboard net profit identity', stats.profit.netProfit, round2(stats.profit.grossProfit - stats.profit.expenses));

    // payment breakdown sums to total payments in range
    const pmb = paymentMethodBreakdown(db, yearRange);
    const pmbTotal = round2(pmb.reduce((a, m) => a + m.amount, 0));
    const rawPay = row<{ s: number }>(
      db,
      "SELECT COALESCE(SUM(p.amount),0) AS s FROM sale_payments p JOIN sales sa ON sa.id=p.sale_id WHERE sa.status='final' AND p.paid_at>=? AND p.paid_at<=?",
      resolved.from,
      resolved.to,
    ).s;
    s.money('payment breakdown sums to raw payments', pmbTotal, round2(rawPay));

    // counts positive (sanity that the sim produced data)
    s.gt('dashboard transaction count > 0', stats.transactions.count, 0);
    s.gt('stock value at cost > 0', stats.stockValueAtCost, 0);
  }

  // ============================================================
  // 8. REPORT CONSISTENCY
  // ============================================================
  s.section('reports');
  {
    const yearRange = { preset: 'thisYear' as const };
    // product sell report: total revenue == sum of final sale subtotals (after line disc) within range,
    // but careful: report sums line_subtotal; raw is sum of sale_lines.line_subtotal for final sales in range
    const ps = productSell(db, yearRange);
    const psRevenue = round2(ps.reduce((a, r) => a + r.revenue, 0));
    const resolved = resolveRange(yearRange);
    const rawLineRev = row<{ s: number }>(
      db,
      "SELECT COALESCE(SUM(sl.line_subtotal),0) AS s FROM sale_lines sl JOIN sales s ON s.id=sl.sale_id WHERE s.status='final' AND s.date>=? AND s.date<=?",
      resolved.from,
      resolved.to,
    ).s;
    s.money('product-sell revenue == raw line subtotals', psRevenue, round2(rawLineRev));

    // product sell profit == revenue - cost per row, aggregated
    const psProfit = round2(ps.reduce((a, r) => a + r.profit, 0));
    const psCost = round2(ps.reduce((a, r) => a + r.cost, 0));
    s.money('product-sell profit == revenue - cost', psProfit, round2(psRevenue - psCost));

    // tax report sales total == sum of sale tax in range
    const tr = taxReport(db, yearRange);
    const rawTax = row<{ s: number }>(db, "SELECT COALESCE(SUM(tax),0) AS s FROM sales WHERE status='final' AND date>=? AND date<=?", resolved.from, resolved.to).s;
    s.money('tax report sales total == raw tax', tr.salesTotal, round2(rawTax));

    // sell payments report total == payment breakdown total
    const sp = sellPayments(db, yearRange);
    const rawPay = row<{ s: number }>(
      db,
      "SELECT COALESCE(SUM(p.amount),0) AS s FROM sale_payments p JOIN sales sa ON sa.id=p.sale_id WHERE sa.status='final' AND p.paid_at>=? AND p.paid_at<=?",
      resolved.from,
      resolved.to,
    ).s;
    s.money('sell payments report == raw payments', sp.total, round2(rawPay));

    // profit/loss net profit components
    const pl = profitLoss(db, yearRange);
    const recomputedGross = round2(pl.moneyIn.totalSalesExclTaxDisc - pl.moneyOut.cogs - pl.moneyOut.sellReturns);
    s.money('P/L gross profit identity', pl.grossProfit, recomputedGross);
  }

  // ============================================================
  // 9. GLOBAL ACCOUNTING IDENTITY (whole shop)
  // ============================================================
  s.section('global');
  {
    // Total cash collected from sales (cash method) must equal total 'sale' cash-in movements
    const totalSalesProfit = row<{ s: number }>(db, "SELECT COALESCE(SUM(profit),0) AS s FROM sales WHERE status='final'").s;
    s.gt('shop has positive aggregate gross profit', totalSalesProfit, 0);

    // Sum of all stock movements per product == current stockLevels (definitional, but verify no orphan)
    const allLevels = stockLevels(db);
    let orphan = 0;
    for (const [pid] of allLevels) {
      const exists = row<{ c: number }>(db, 'SELECT COUNT(*) c FROM products WHERE id = ?', pid).c;
      if (exists === 0) orphan++;
    }
    s.ok('no stock movements for non-existent products', orphan === 0, `${orphan} orphan`);

    // Every sale references a real branch + user
    const badRef = row<{ c: number }>(
      db,
      `SELECT COUNT(*) c FROM sales s LEFT JOIN branches b ON b.id=s.branch_id LEFT JOIN users u ON u.id=s.user_id WHERE b.id IS NULL OR u.id IS NULL`,
    ).c;
    s.eq('all sales reference valid branch+user', badRef, 0);

    // FK integrity: pragma foreign_key_check returns no rows
    const fkErrors = rows(db, 'PRAGMA foreign_key_check');
    s.ok('foreign key integrity', fkErrors.length === 0, `${fkErrors.length} FK violations`);

    // FTS index covers all products
    const ftsCount = row<{ c: number }>(db, 'SELECT COUNT(*) c FROM fts_products').c;
    const prodCount = row<{ c: number }>(db, 'SELECT COUNT(*) c FROM products').c;
    s.eq('FTS products index complete', ftsCount, prodCount);

    // FTS search actually works
    const found = rows<{ product_id: string }>(db, "SELECT product_id FROM fts_products WHERE fts_products MATCH 'cement'");
    s.gt('FTS search finds cement', found.length, 0);
  }

  // ============================================================
  // 10. VOID BEHAVIOR (targeted operation test on a clean sale)
  // ============================================================
  s.section('void');
  {
    // create + void a sale, ensure stock returns and status flips
    const pidBefore = stockOnHand(db, 'p1', 'br_mp');
    const sale = createSale(db, {
      status: 'final',
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 3, spr: 520 }],
      payments: [{ method: 'Cash', amount: 1560 }],
    });
    const pidAfterSale = stockOnHand(db, 'p1', 'br_mp');
    s.money('stock reduced by sale', pidAfterSale, round2(pidBefore - 3));

    voidSale(db, sale.id, 'u_admin', 'test void');
    const pidAfterVoid = stockOnHand(db, 'p1', 'br_mp');
    s.money('stock restored after void', pidAfterVoid, pidBefore);
    const voided = row<{ status: string }>(db, 'SELECT status FROM sales WHERE id = ?', sale.id).status;
    s.eq('sale marked void', voided, 'void');
  }

  // ----- report -----
  const rep = s.report();
  const ms = Date.now() - t0;
  console.log('\n' + '='.repeat(64));
  console.log(`VERIFICATION: ${rep.passed}/${rep.total} checks passed in ${ms}ms`);
  if (rep.failed > 0) {
    console.log(`\n❌ ${rep.failed} FAILURES:`);
    for (const f of rep.failures) console.log(`   - ${f.name}: ${f.detail ?? ''}`);
    console.log('='.repeat(64));
    db.close();
    process.exit(1);
  }
  console.log('✅ ALL CHECKS PASSED');
  console.log('='.repeat(64));
  db.close();
}

main();
