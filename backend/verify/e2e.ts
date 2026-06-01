/**
 * END-TO-END FULL-SHOP-DAY VERIFICATION
 * =====================================
 * The final whole-app gate. Drives the EXACT `buildApi()` channels the renderer
 * calls — from a CLEAN first-run database through a complete day of operations —
 * and asserts that every cross-module number reconciles.
 *
 * WHY THIS EXISTS:
 *   The unit/scenario suites (scenarios.ts) prove each service in isolation, and
 *   api.ts proves every channel resolves against a SIMULATED dataset. This suite
 *   proves the WHOLE flow works together THROUGH THE API FACADE (the IPC surface),
 *   starting from the same clean state a real owner sees on first launch:
 *
 *       openDatabase(':memory:') → migrate(db) → seedMaster(db)
 *
 *   i.e. master/reference data only, NO opening stock, NO demo simulation. Every
 *   number below therefore has to be *built* by the day's operations — exactly
 *   like a real shop's first day.
 *
 * ENFORCEMENT NOTE (documented, intentional):
 *   This harness calls the backend handlers DIRECTLY via `api[ch](db, payload)`.
 *   The Electron IPC permission gate (electron/ipc.ts + electron/permissions.ts)
 *   lives at the transport boundary, NOT in buildApi() or the services — so it is
 *   deliberately NOT exercised here. That keeps the harness pure and is the
 *   correct separation of concerns: the gate is covered by the manual
 *   cashier-permission smoke step (docs/06-E2E-AND-SMOKE-TEST.md) and by design.
 */
import { openDatabase, migrate, type DB } from '../db/connection.ts';
import { seedMaster } from '../seed/master.ts';
import { buildApi } from '../api.ts';
import { Suite } from './assert.ts';
import { round2 } from '../core/money.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function runE2E(s: Suite) {
  // ---- CLEAN, MIGRATED, MASTER-ONLY DB (the first-run starting point) ----
  const db: DB = openDatabase(':memory:');
  migrate(db);
  seedMaster(db);

  // Build the api map and a `call(ch, payload)` helper EXACTLY like api.ts.
  const api = buildApi();
  const call = (ch: string, payload: unknown = {}): any => api[ch](db, payload);

  // Small read helpers expressed through the channel surface.
  const stockAt = (productId: string, branchId?: string): number =>
    (call('products.get', { id: productId, branchId }) as { stock: number }).stock;
  const drawerExpected = (shiftId: string): number =>
    (call('cash.shiftTotals', { shiftId }) as { expected: number }).expected;
  const customerDueOf = (id: string): number => (call('customers.get', { id }) as { due: number }).due;
  const supplierDueOf = (id: string): number => (call('suppliers.get', { id }) as { due: number }).due;

  // The owner's chosen first-run PIN (replaces the seed default of 1234).
  const OWNER_PIN = '246810';
  const OPENING_CASH = 5000;

  // ========================================================================
  // 1) FIRST-RUN: setup.status → complete → authenticate → self-disabling
  // ========================================================================
  s.section('e2e-first-run');
  {
    const before = call('setup.status') as { complete: boolean };
    s.ok('setup.status reports NOT complete on a clean db', before.complete === false);

    const result = call('setup.complete', {
      shop: {
        name: 'Seam Hardware & Tools',
        tagline: 'Your neighborhood hardware store',
        phonePrimary: '01700-000000',
        address: 'Mirpur 10, Dhaka',
        currencySymbol: '৳',
      },
      defaultTaxId: 'tx_5',
      branch: { name: 'Main Counter', address: 'Mirpur 10, Dhaka' },
      admin: { name: 'Shop Owner', username: 'owner', pin: OWNER_PIN },
      printer: { name: 'Front Counter', paperWidth: 80 },
      cloud: true,
    }) as { ok: boolean; adminUserId: string; permissions: string[] };
    s.ok('setup.complete returns ok', result.ok === true);
    s.eq('setup.complete returns the admin user id', result.adminUserId, 'u_admin');
    s.gt('setup.complete returns admin permissions', result.permissions.length, 0);

    const after = call('setup.status') as { complete: boolean };
    s.ok('setup.status reports complete after the wizard', after.complete === true);

    const biz = call('business.get') as { name: string; default_branch_id: string };
    s.eq('business name persisted from wizard', biz.name, 'Seam Hardware & Tools');
    s.eq('business default branch set to br_mp', biz.default_branch_id, 'br_mp');

    const branches = call('branches.list') as { id: string; name: string; is_default: number }[];
    const mp = branches.find((b) => b.id === 'br_mp')!;
    s.eq('default branch renamed by wizard', mp.name, 'Main Counter');
    s.eq('default branch flagged is_default', mp.is_default, 1);
    s.eq('exactly one default branch', branches.filter((b) => b.is_default === 1).length, 1);

    // The chosen PIN authenticates; the seed default (1234) no longer works.
    const auth = call('auth.authenticate', { mode: 'pin', userId: 'u_admin', secret: OWNER_PIN }) as {
      ok: boolean;
    };
    s.ok('admin authenticates with the chosen first-run PIN', auth.ok === true);
    const authOld = call('auth.authenticate', { mode: 'pin', userId: 'u_admin', secret: '1234' }) as {
      ok: boolean;
    };
    s.ok('the seed default PIN (1234) is rejected after setup', authOld.ok === false);

    // Run-once / self-disabling: a second setup.complete THROWS.
    let replayBlocked = false;
    try {
      call('setup.complete', {
        shop: { name: 'Hijack' },
        branch: { name: 'Hijack Branch' },
        admin: { name: 'Attacker', username: 'attacker', pin: '000000' },
      });
    } catch {
      replayBlocked = true;
    }
    s.ok('a second setup.complete throws (run-once)', replayBlocked);
  }

  // ========================================================================
  // 2) OPEN SHIFT
  // ========================================================================
  s.section('e2e-open-shift');
  s.ok('no open shift on br_mp before opening', !call('cash.openShiftFor', { branchId: 'br_mp' }));
  const shiftId = call('cash.openShift', {
    branchId: 'br_mp',
    userId: 'u_admin',
    openingCash: OPENING_CASH,
  }) as string;
  s.ok('cash.openShift returns a shift id', typeof shiftId === 'string' && shiftId.length > 0);
  s.money('shift expected == opening cash (no movements yet)', drawerExpected(shiftId), OPENING_CASH);

  // ========================================================================
  // 3) RECEIVE A PURCHASE (stock in) — the day's first inventory
  // ========================================================================
  // Clean DB ⇒ every product starts at ZERO stock. The purchase BUILDS it.
  s.section('e2e-purchase');
  let drawer = OPENING_CASH; // running model of the drawer's expected cash
  {
    s.money('p1 stock starts at 0 (clean db)', stockAt('p1', 'br_mp'), 0);
    s.money('p7 stock starts at 0 (clean db)', stockAt('p7', 'br_mp'), 0);

    // Two lines, partial CASH payment (rest on supplier credit).
    const PURCHASE_CASH = 3000;
    const created = call('purchases.create', {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [
        { productId: 'p1', qty: 100, unitCostBeforeDisc: 400, taxPct: 0 }, // 40000
        { productId: 'p7', qty: 50, unitCostBeforeDisc: 320, taxPct: 0 }, // 16000
      ],
      payments: [{ method: 'Cash', amount: PURCHASE_CASH }],
    }) as { id: string; totals: { total: number }; paid: number; due: number };
    s.money('purchase total = sum of line totals', created.totals.total, 56000);

    s.money('p1 stock rose by purchased qty', stockAt('p1', 'br_mp'), 100);
    s.money('p7 stock rose by purchased qty', stockAt('p7', 'br_mp'), 50);

    // Supplier due == total − paid.
    s.money('supplier sp1 due == total − paid', supplierDueOf('sp1'), round2(created.totals.total - PURCHASE_CASH));

    // The cash portion reduced the drawer.
    drawer = round2(drawer - PURCHASE_CASH);
    s.money('drawer reduced by the cash paid to supplier', drawerExpected(shiftId), drawer);
  }

  // ========================================================================
  // 4) POS-STYLE CASH SALE (the hero-screen path)
  // ========================================================================
  s.section('e2e-pos-cash-sale');
  let cashSaleId = '';
  {
    const stockBefore = stockAt('p1', 'br_mp');
    // Mirrors the POS checkout payload mapping: branch/user, lines with `spr`,
    // a single Cash payment fully covering the total.
    const sale = call('sales.create', {
      branchId: 'br_mp',
      userId: 'u_admin',
      lines: [{ productId: 'p1', qty: 10, spr: 520 }],
      payments: [{ method: 'Cash', amount: 5200 }],
    }) as { id: string; totals: { total: number }; due: number };
    cashSaleId = sale.id;

    s.money('cash sale total', sale.totals.total, 5200);
    s.money('cash sale fully paid (due 0)', sale.due, 0);
    s.money('p1 stock dropped by sold qty', stockAt('p1', 'br_mp'), round2(stockBefore - 10));

    drawer = round2(drawer + 5200);
    s.money('drawer rose by the cash sale amount', drawerExpected(shiftId), drawer);

    const list = call('sales.list', {}) as { id: string; status: string }[];
    s.ok('the cash sale appears in sales.list', list.some((r) => r.id === cashSaleId));
    s.eq('the cash sale is final', list.find((r) => r.id === cashSaleId)?.status ?? '', 'final');
  }

  // ========================================================================
  // 5) CREDIT SALE + CUSTOMER DUE
  // ========================================================================
  s.section('e2e-credit-sale');
  {
    const cu2DueBefore = customerDueOf('cu2'); // opening 0 for cu2
    const stockBefore = stockAt('p1', 'br_mp');

    const sale = call('sales.create', {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 5, spr: 520 }],
      payments: [], // full credit
    }) as { id: string; totals: { total: number }; due: number };
    s.money('credit sale total', sale.totals.total, 2600);
    s.money('credit sale due == full total', sale.due, 2600);
    s.money('p1 stock dropped by credit-sold qty', stockAt('p1', 'br_mp'), round2(stockBefore - 5));
    s.money('customer cu2 due rose by the sale total', customerDueOf('cu2'), round2(cu2DueBefore + 2600));

    // Partial payment in cash: due drops exactly, drawer rises.
    const PARTIAL = 1000;
    const after = call('sales.addPayment', {
      saleId: sale.id,
      payment: { method: 'Cash', amount: PARTIAL },
      userId: 'u_admin',
    }) as { due: number };
    s.money('credit sale due drops by the partial payment', after.due, round2(2600 - PARTIAL));
    s.money('customer cu2 due drops by the partial payment', customerDueOf('cu2'), round2(cu2DueBefore + 2600 - PARTIAL));

    drawer = round2(drawer + PARTIAL);
    s.money('drawer rose by the cash partial payment', drawerExpected(shiftId), drawer);
  }

  // ========================================================================
  // 6) SELL RETURN (restock + cash refund) against the cash sale
  // ========================================================================
  s.section('e2e-sell-return');
  {
    const stockBefore = stockAt('p1', 'br_mp');
    const REFUND = 2080; // 4 @ 520
    const ret = call('sellReturns.create', {
      saleId: cashSaleId,
      branchId: 'br_mp',
      userId: 'u_admin',
      refundMethod: 'Cash',
      lines: [{ productId: 'p1', qty: 4, unitPrice: 520, refundAmount: REFUND }],
    }) as { id: string; total: number };
    s.money('sell-return total', ret.total, REFUND);
    s.money('p1 stock restored by returned qty', stockAt('p1', 'br_mp'), round2(stockBefore + 4));

    drawer = round2(drawer - REFUND);
    s.money('drawer reduced by the cash refund', drawerExpected(shiftId), drawer);

    const list = call('sellReturns.list', {}) as { id: string; total: number }[];
    s.ok('the sell return appears in sellReturns.list', list.some((r) => r.id === ret.id));
  }

  // ========================================================================
  // 7) EXPENSE (cash) then VOID — drawer drops then is restored
  // ========================================================================
  s.section('e2e-expense');
  {
    const EXPENSE = 500;
    const exp = call('expenses.create', {
      branchId: 'br_mp',
      userId: 'u_admin',
      amount: EXPENSE,
      paymentMethod: 'Cash',
      categoryId: 'ec_misc',
      note: 'Tea & snacks',
    }) as { id: string };
    s.money('drawer drops by the cash expense', drawerExpected(shiftId), round2(drawer - EXPENSE));

    call('expenses.void', { id: exp.id, reason: 'logged twice', userId: 'u_admin' });
    s.money('drawer restored after voiding the expense', drawerExpected(shiftId), drawer);
    const list = call('expenses.list', {}) as { id: string }[];
    s.ok('voided expense drops out of expenses.list', !list.some((e) => e.id === exp.id));
  }

  // ========================================================================
  // 8) STOCK TRANSFER br_mp → br_ut (dispatch in-transit, then receive)
  // ========================================================================
  s.section('e2e-transfer');
  {
    const TRANSFER_QTY = 20;
    const mpBefore = stockAt('p1', 'br_mp');
    const utBefore = stockAt('p1', 'br_ut');
    const totalBefore = stockAt('p1'); // all branches

    const t = call('transfers.create', {
      fromBranch: 'br_mp',
      toBranch: 'br_ut',
      status: 'in-transit',
      lines: [{ productId: 'p1', qty: TRANSFER_QTY }],
      createdBy: 'u_admin',
    }) as { id: string };
    s.money('transfer reduces source branch on dispatch', stockAt('p1', 'br_mp'), round2(mpBefore - TRANSFER_QTY));
    s.money('destination not yet increased while in-transit', stockAt('p1', 'br_ut'), utBefore);

    call('transfers.receive', {
      transferId: t.id,
      received: [{ productId: 'p1', receivedQty: TRANSFER_QTY }],
      userId: 'u_admin',
    });
    s.money('destination increased on receive', stockAt('p1', 'br_ut'), round2(utBefore + TRANSFER_QTY));
    s.money('total stock conserved across the transfer', stockAt('p1'), totalBefore);
  }

  // ========================================================================
  // 9) ADJUSTMENT (damage, signed −qty)
  // ========================================================================
  s.section('e2e-adjustment');
  {
    const ADJ_QTY = 5;
    const before = stockAt('p1', 'br_mp');
    call('adjustments.create', {
      branchId: 'br_mp',
      type: 'damage',
      reason: 'water damage',
      lines: [{ productId: 'p1', qty: -ADJ_QTY }],
      createdBy: 'u_admin',
    });
    s.money('damage adjustment reduces stock by exactly the qty', stockAt('p1', 'br_mp'), round2(before - ADJ_QTY));
  }

  // ========================================================================
  // 10) CLOSE SHIFT — expected reconciles, variance 0
  // ========================================================================
  s.section('e2e-close-shift');
  {
    const totals = call('cash.shiftTotals', { shiftId }) as {
      openingCash: number;
      cashIn: number;
      cashOut: number;
      expected: number;
    };
    // Independent recompute: expected = opening + cashIn − cashOut.
    s.money(
      'shiftTotals.expected == opening + cashIn − cashOut',
      totals.expected,
      round2(totals.openingCash + totals.cashIn - totals.cashOut),
    );
    s.money('shiftTotals.expected matches the running drawer model', totals.expected, drawer);

    const close = call('cash.closeShift', { shiftId, countedCash: totals.expected }) as {
      expected: number;
      variance: number;
    };
    s.money('closing with counted == expected yields variance 0', close.variance, 0);
    s.ok('no open shift on br_mp after close', !call('cash.openShiftFor', { branchId: 'br_mp' }));
  }

  // ========================================================================
  // 11) CROSS-MODULE RECONCILIATION — the money-conservation finale
  // ========================================================================
  s.section('e2e-reconciliation');
  {
    const today = { range: { preset: 'today' as const } };

    // ----- Dashboard vs raw -----
    const stats = call('dashboard.stats', today) as {
      sales: { total: number };
      transactions: { count: number };
      cashInDrawer: number;
      customerDuesTotal: number;
      supplierDuesTotal: number;
    };
    const allSales = call('sales.list', {}) as {
      status: string;
      total: number;
      subtotal: number;
      order_discount: number;
      cogs: number;
    }[];
    const finalSales = allSales.filter((r) => r.status === 'final');
    const rawSalesTotal = round2(finalSales.reduce((a, r) => a + r.total, 0));
    s.money('dashboard sales total == Σ final-sale totals (sales.list)', stats.sales.total, rawSalesTotal);
    s.eq('dashboard transaction count == # of final sales', stats.transactions.count, finalSales.length);

    // shift is closed ⇒ cash in drawer is 0 (getStats only counts OPEN shifts)
    s.money('dashboard cash-in-drawer == 0 (shift closed)', stats.cashInDrawer, 0);

    // dues totals match summing the list endpoints
    const custList = call('customers.list', {}) as { due: number }[];
    const supList = call('suppliers.list', {}) as { due: number }[];
    const custDueSum = round2(custList.reduce((a, c) => a + c.due, 0));
    const supDueSum = round2(supList.reduce((a, s2) => a + s2.due, 0));
    s.money('dashboard customer dues == Σ customers.list dues', stats.customerDuesTotal, custDueSum);
    s.money('dashboard supplier dues == Σ suppliers.list dues', stats.supplierDuesTotal, supDueSum);

    // ----- Reports vs raw -----
    const pl = call('reports.profitLoss', today) as {
      moneyIn: { totalSalesExclTaxDisc: number; sellShipping: number; sellOther: number; purchaseReturns: number };
      moneyOut: { cogs: number; sellReturns: number; expenses: number; stockAdjustment: number };
      grossProfit: number;
      netProfit: number;
    };
    // revenue / cogs reconcile to the raw final sales primitives
    const rawNet = round2(finalSales.reduce((a, r) => a + (r.subtotal - r.order_discount), 0));
    const rawCogs = round2(finalSales.reduce((a, r) => a + r.cogs, 0));
    s.money('P/L revenue (net of disc) == Σ(subtotal − order_discount)', pl.moneyIn.totalSalesExclTaxDisc, rawNet);
    s.money('P/L COGS == Σ sale.cogs', pl.moneyOut.cogs, rawCogs);

    const rawSellReturns = round2(
      (call('sellReturns.list', {}) as { total: number }[]).reduce((a, r) => a + r.total, 0),
    );
    s.money('P/L sell-returns == Σ sellReturns.list totals', pl.moneyOut.sellReturns, rawSellReturns);

    // grossProfit identity = revenue − cogs − sellReturns
    s.money(
      'P/L grossProfit == revenue − COGS − sellReturns',
      pl.grossProfit,
      round2(rawNet - rawCogs - rawSellReturns),
    );
    // netProfit identity recomputed from the SAME primitives the report exposes
    const recomputedNet = round2(
      pl.grossProfit +
        pl.moneyIn.sellShipping +
        pl.moneyIn.sellOther +
        pl.moneyIn.purchaseReturns -
        pl.moneyOut.expenses +
        pl.moneyOut.stockAdjustment,
    );
    s.money('P/L netProfit identity reconciles', pl.netProfit, recomputedNet);

    // reports.stock total value == Σ per-product stock×cost (two ways)
    const stock = call('reports.stock', {}) as {
      rows: { stock: number; cost: number; valueAtCost: number }[];
      totalValueAtCost: number;
    };
    const rowSum = round2(stock.rows.reduce((a, r) => a + r.valueAtCost, 0));
    s.money('reports.stock total == Σ row valueAtCost', stock.totalValueAtCost, rowSum);
    let perRowOk = true;
    for (const r of stock.rows) {
      if (Math.abs(r.valueAtCost - round2(r.stock * r.cost)) > 0.01) perRowOk = false;
    }
    s.ok('reports.stock rows: valueAtCost == stock × cost', perRowOk);

    // recompute the same total from products.list (all branches)
    const prods = call('products.list', {}) as { id: string; stock: number; cost: number }[];
    const prodValueSum = round2(prods.reduce((a, p) => a + p.stock * p.cost, 0));
    s.money('reports.stock total == Σ products.list (stock × cost)', stock.totalValueAtCost, prodValueSum);

    // no row reports negative stock
    s.ok('reports.stock: no product reports negative stock', stock.rows.every((r) => r.stock >= 0));

    // ----- Integrity -----
    const negs = db
      .prepare(
        'SELECT product_id FROM stock_movements GROUP BY product_id, branch_id HAVING SUM(qty) < 0',
      )
      .all() as { product_id: string }[];
    s.ok('no negative stock at any (product, branch)', negs.length === 0, `${negs.length} negative`);
    const fk = db.prepare('PRAGMA foreign_key_check').all();
    s.ok('PRAGMA foreign_key_check is clean', fk.length === 0, `${fk.length} violations`);
  }

  db.close();
}

// ---- standalone runner (mirrors scenarios.ts) ----
if (
  import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/') ||
  process.argv[1]?.endsWith('e2e.ts')
) {
  const s = new Suite();
  const t0 = Date.now();
  runE2E(s);
  const rep = s.report();
  const ms = Date.now() - t0;
  console.log(`E2E (full-shop-day): ${rep.passed}/${rep.total} checks in ${ms}ms`);
  if (rep.failed > 0) {
    console.log(`\n❌ ${rep.failed} FAILURES:`);
    for (const f of rep.failures) console.log(`   - ${f.name}: ${f.detail ?? ''}`);
    process.exit(1);
  }
  console.log('✅ ALL E2E CHECKS PASSED');
}
