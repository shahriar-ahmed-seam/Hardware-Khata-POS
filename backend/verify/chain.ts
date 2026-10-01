/**
 * ============================================================================
 *  THE SALE / PURCHASE CHAIN — what a document may and may not have done to it
 * ============================================================================
 *
 * Every section here is a hole that was open in 0.8.0 and let stock or money go
 * wrong with no error at all: returns beyond what was sold, returns on drafts and
 * voided sales, pack sizes ignored on the way back, voids and cancels after a
 * return, payments on cancelled documents, a transfer received twice. Each check
 * asserts the refusal AND that nothing moved when it was refused.
 *
 * Run as part of `backend:verify:all` (via all.ts), or alone:
 *   npx tsx backend/verify/chain.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, migrate, schemaVersionOf, CURRENT_SCHEMA_VERSION, type DB } from '../db/connection.ts';
import { verifySnapshot } from '../services/backup.ts';
import { seedMaster } from '../seed/master.ts';
import { Suite } from './assert.ts';
import { round2 } from '../core/money.ts';
import { recordMovement, stockOnHand, weightedAvgCost } from '../services/stock.ts';
import { createTransfer, receiveTransfer, cancelTransfer, createAdjustment } from '../services/stockOps.ts';
import { createSale, voidSale, addSalePayment, updateSale, convertSale } from '../services/sales.ts';
import {
  createPurchase,
  cancelPurchase,
  deletePurchase,
  addPurchasePayment,
  updatePurchase,
  receivePurchase,
} from '../services/purchases.ts';
import { createSellReturn, createPurchaseReturn, returnedOnSale } from '../services/returns.ts';
import { computeReturnRefund } from '../core/calc.ts';
import { customerDue, customerLedger, supplierDue, supplierLedger } from '../services/ledger.ts';
import { customerGroup, sellPayments as reportSellPayments } from '../services/reports.ts';
import { receiveCustomerPayment } from '../services/accounts.ts';
import { buildApi } from '../api.ts';
import {
  deltaPct,
  getStats,
  hourlySales,
  salesTrend,
  salesVsPurchaseVsExpense,
} from '../services/dashboard.ts';
import { ftsQuery, globalSearch } from '../services/queries.ts';
import {
  openShift,
  closeShift,
  shiftTotals,
  getOpenShift,
  carriedForwardCash,
  manualCashMove,
} from '../services/cash.ts';
import { createExpense } from '../services/expenses.ts';
import { paySupplier } from '../services/contacts.ts';
import { listPurchasesPage } from '../services/paged.ts';
import { shopBranchId } from '../services/branch.ts';
import { setDefaultBranch, updateBusinessInfo } from '../services/settings.ts';
import { createShipment } from '../services/shipments.ts';
import { createProduct } from '../services/catalog.ts';

function fresh(): DB {
  const db = openDatabase(':memory:');
  migrate(db);
  seedMaster(db);
  recordMovement(db, { productId: 'p1', branchId: 'br_mp', reason: 'opening_stock', qty: 100, unitCost: 380 });
  recordMovement(db, { productId: 'p19', branchId: 'br_mp', reason: 'opening_stock', qty: 200, unitCost: 480 });
  return db;
}

/** Run `fn`; the check passes only if it throws (optionally matching `pattern`). */
function refuses(s: Suite, name: string, fn: () => unknown, pattern?: RegExp) {
  try {
    fn();
    s.ok(name, false, 'expected a refusal, but it went through');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    s.ok(name, pattern ? pattern.test(msg) : true, `refused with an unexpected message: ${msg}`);
  }
}

const count = (db: DB, sql: string, ...args: unknown[]) =>
  (db.prepare(sql).get(...args) as { c: number }).c;

export function runChain(s: Suite) {
  // ------------------------------------------------------------------ F6
  s.section('chain-sell-return-limits');
  {
    const db = fresh();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 10, spr: 520 }],
      payments: [{ method: 'Cash', amount: 5200 }],
    });
    const ret = (qty: number, refund = qty * 520, method = 'Cash') =>
      createSellReturn(db, {
        saleId: sale.id,
        branchId: 'br_mp',
        userId: 'u_admin',
        refundMethod: method,
        lines: [{ productId: 'p1', qty, unitPrice: 520, refundAmount: refund }],
      });

    ret(6);
    s.money('first return of 6 goes through', stockOnHand(db, 'p1', 'br_mp'), 96);
    refuses(s, 'returning 5 more of 10 sold (6 back) is refused', () => ret(5), /can still be returned/);
    s.money('the refused return moved no stock', stockOnHand(db, 'p1', 'br_mp'), 96);
    s.eq('the refused return wrote no row', count(db, 'SELECT COUNT(*) c FROM sell_returns WHERE sale_id = ?', sale.id), 1);
    ret(4);
    s.money('returning exactly the remaining 4 is allowed', stockOnHand(db, 'p1', 'br_mp'), 100);
    refuses(s, 'nothing is left to return after that', () => ret(1));

    refuses(s, 'an item not on the invoice is refused', () =>
      createSellReturn(db, {
        saleId: sale.id,
        branchId: 'br_mp',
        userId: 'u_admin',
        refundMethod: 'Cash',
        lines: [{ productId: 'p19', qty: 1, unitPrice: 1, refundAmount: 1 }],
      }),
    /not on/);
    db.close();
  }

  s.section('chain-sell-return-inputs');
  {
    const db = fresh();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 10, spr: 520 }],
      payments: [{ method: 'Cash', amount: 5200 }],
    });
    const base = { saleId: sale.id, branchId: 'br_mp', userId: 'u_admin', refundMethod: 'Cash' };
    refuses(s, 'a zero quantity is refused', () =>
      createSellReturn(db, { ...base, lines: [{ productId: 'p1', qty: 0, unitPrice: 520, refundAmount: 0 }] }),
    );
    refuses(s, 'a negative quantity is refused', () =>
      createSellReturn(db, { ...base, lines: [{ productId: 'p1', qty: -2, unitPrice: 520, refundAmount: 0 }] }),
    );
    refuses(s, 'a negative refund is refused', () =>
      createSellReturn(db, { ...base, lines: [{ productId: 'p1', qty: 1, unitPrice: 520, refundAmount: -5 }] }),
    );
    refuses(s, 'an empty return is refused', () => createSellReturn(db, { ...base, lines: [] }));
    refuses(
      s,
      'refunding more than the items were worth is refused',
      () => createSellReturn(db, { ...base, lines: [{ productId: 'p1', qty: 2, unitPrice: 520, refundAmount: 2000 }] }),
      /more than those items were worth/,
    );
    s.money('none of the refused returns moved stock', stockOnHand(db, 'p1', 'br_mp'), 90);
    db.close();
  }

  s.section('chain-sell-return-status');
  {
    const db = fresh();
    const mk = (status: 'draft' | 'quotation' | 'final') =>
      createSale(db, {
        status,
        branchId: 'br_mp',
        userId: 'u_admin',
        customerId: 'cu2',
        lines: [{ productId: 'p1', qty: 3, spr: 520 }],
        payments: status === 'final' ? [{ method: 'Cash', amount: 1560 }] : [],
      });
    const retOn = (saleId: string) =>
      createSellReturn(db, {
        saleId,
        branchId: 'br_mp',
        userId: 'u_admin',
        refundMethod: 'Cash',
        lines: [{ productId: 'p1', qty: 1, unitPrice: 520, refundAmount: 520 }],
      });
    const before = stockOnHand(db, 'p1', 'br_mp');
    refuses(s, 'a return on a draft is refused', () => retOn(mk('draft').id), /only a final sale/);
    refuses(s, 'a return on a quotation is refused', () => retOn(mk('quotation').id), /only a final sale/);
    const v = mk('final');
    voidSale(db, v.id, 'u_admin', 'test');
    const afterVoid = stockOnHand(db, 'p1', 'br_mp');
    refuses(s, 'a return on a voided sale is refused', () => retOn(v.id), /only a final sale/);
    s.money('drafts and quotations never moved stock', before, 100);
    s.money('the refused return on the void moved nothing', stockOnHand(db, 'p1', 'br_mp'), afterVoid);
    refuses(s, 'a return on a sale that does not exist is refused', () => retOn('nope'), /not found/);
    db.close();
  }

  s.section('chain-sell-return-walk-in');
  {
    const db = fresh();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      lines: [{ productId: 'p1', qty: 4, spr: 520 }],
      payments: [{ method: 'Cash', amount: 2080 }],
    });
    const retWith = (method: string) =>
      createSellReturn(db, {
        saleId: sale.id,
        branchId: 'br_mp',
        userId: 'u_admin',
        refundMethod: method,
        lines: [{ productId: 'p1', qty: 1, unitPrice: 520, refundAmount: 520 }],
      });
    refuses(s, 'store credit on a walk-in sale is refused (nobody to hold it)', () => retWith('StoreCredit'), /named customer/);
    refuses(s, 'a credit note on a walk-in sale is refused', () => retWith('CreditAdjust'), /named customer/);
    retWith('Cash');
    s.money('a cash refund on a walk-in sale is fine', stockOnHand(db, 'p1', 'br_mp'), 97);
    db.close();
  }

  s.section('chain-sell-return-two-lines');
  {
    const db = fresh();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [
        { productId: 'p1', qty: 3, spr: 520 },
        { productId: 'p1', qty: 2, spr: 500 },
      ],
      payments: [{ method: 'Cash', amount: 2560 }],
    });
    const ret = (qty: number) =>
      createSellReturn(db, {
        saleId: sale.id,
        branchId: 'br_mp',
        userId: 'u_admin',
        refundMethod: 'Cash',
        lines: [{ productId: 'p1', qty, unitPrice: 500, refundAmount: qty * 500 }],
      });
    refuses(s, 'the same product on two lines: 6 of 5 is refused', () => ret(6));
    ret(5);
    s.money('all 5 across both lines can come back', stockOnHand(db, 'p1', 'br_mp'), 100);
    db.close();
  }

  s.section('chain-purchase-return');
  {
    const db = fresh();
    // Five dozen at 620 a dozen: 60 pieces on the shelf, ৳3,100 on the bill.
    const pur = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p19', qty: 5, unit: 'dozen', unitFactor: 12, unitCostBeforeDisc: 620, taxPct: 0 }],
      payments: [],
    });
    s.money('the pack purchase put 60 pieces in', stockOnHand(db, 'p19', 'br_mp'), 260);
    const dueBefore = supplierDue(db, 'sp1');
    const ret = (qty: number, method = 'CreditAdjust') =>
      createPurchaseReturn(db, {
        purchaseId: pur.id,
        branchId: 'br_mp',
        userId: 'u_admin',
        refundMethod: method,
        lines: [{ productId: 'p19', qty, unit: 'dozen', unitCost: 620, refundAmount: qty * 620 }],
      });

    const r1 = ret(1);
    s.money('returning ONE DOZEN takes 12 pieces off the shelf', stockOnHand(db, 'p19', 'br_mp'), 248);
    const mv = db
      .prepare("SELECT qty, unit_cost FROM stock_movements WHERE ref_id = ? AND reason = 'purchase_return'")
      .get(pur.id) as { qty: number; unit_cost: number };
    s.money('the movement is -12 in base units', mv.qty, -12);
    s.ok('and is valued per piece, not per dozen', Math.abs(mv.unit_cost - 620 / 12) < 1e-6);
    const row = db.prepare('SELECT supplier_id FROM purchase_returns WHERE id = ?').get(r1.id) as {
      supplier_id: string | null;
    };
    s.eq('the return inherits the supplier from the bill', row.supplier_id, 'sp1');
    s.money('so the credit note reduces what the shop owes them', supplierDue(db, 'sp1'), round2(dueBefore - 620));
    s.eq(
      'the bill records that goods went back',
      count(db, "SELECT COUNT(*) c FROM purchase_audit WHERE purchase_id = ? AND action = 'returned'", pur.id),
      1,
    );
    refuses(s, 'returning 5 dozen of the 4 left is refused', () => ret(5), /can still be returned/);
    s.money('the refused return moved nothing', stockOnHand(db, 'p19', 'br_mp'), 248);
    refuses(
      s,
      'refunding more than the bill was worth is refused',
      () =>
        createPurchaseReturn(db, {
          purchaseId: pur.id,
          branchId: 'br_mp',
          userId: 'u_admin',
          refundMethod: 'CashRefund',
          lines: [{ productId: 'p19', qty: 1, unitCost: 620, refundAmount: 999 }],
        }),
      /more than those items were worth/,
    );

    const ordered = createPurchase(db, {
      status: 'ordered',
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [],
    });
    refuses(
      s,
      'a return on an ordered (not received) purchase is refused',
      () =>
        createPurchaseReturn(db, {
          purchaseId: ordered.id,
          branchId: 'br_mp',
          userId: 'u_admin',
          refundMethod: 'CashRefund',
          lines: [{ productId: 'p1', qty: 1, unitCost: 400, refundAmount: 400 }],
        }),
      /only a received purchase/,
    );
    db.close();
  }

  // ------------------------------------------------------------------ F12
  // A discounted invoice refunds what the customer paid, not the list price.
  s.section('chain-refund-is-what-was-paid');
  {
    const db = fresh();
    // 10 at 500 with 10% off the line, then ৳450 off the whole bill: 4,500 → 4,050.
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 10, spr: 500, discountPct: 10 }],
      orderDiscountFlat: 450,
      payments: [{ method: 'Cash', amount: 4050 }],
    });
    const head = db.prepare('SELECT subtotal, order_discount, tax_pct, total FROM sales WHERE id = ?').get(sale.id) as {
      subtotal: number;
      order_discount: number;
      tax_pct: number;
      total: number;
    };
    s.money('the invoice is 4,050', head.total, 4050);
    const paidFor2 = computeReturnRefund({
      lineSubtotal: 4500,
      lineQty: 10,
      returnQty: 2,
      subtotal: head.subtotal,
      orderDiscount: head.order_discount,
      taxPct: head.tax_pct,
    });
    s.money('two of them cost the customer 810', paidFor2, 810);
    refuses(
      s,
      'refunding the list price (1,000) for two is refused',
      () =>
        createSellReturn(db, {
          saleId: sale.id,
          branchId: 'br_mp',
          userId: 'u_admin',
          refundMethod: 'Cash',
          lines: [{ productId: 'p1', qty: 2, unitPrice: 500, refundAmount: 1000 }],
        }),
      /more than those items were worth/,
    );
    createSellReturn(db, {
      saleId: sale.id,
      branchId: 'br_mp',
      userId: 'u_admin',
      refundMethod: 'Cash',
      lines: [{ productId: 'p1', qty: 2, unitPrice: 500, refundAmount: paidFor2 }],
    });
    s.eq('the paid-for figure is accepted', count(db, 'SELECT COUNT(*) c FROM sell_returns WHERE sale_id = ?', sale.id), 1);
    s.eq(
      'returnedOnSale reports what came back, in the sale unit',
      returnedOnSale(db, sale.id).p1,
      2,
    );
    db.close();
  }

  // ------------------------------------------------------------------ F17
  s.section('chain-wac-ignores-cancelled');
  {
    const db = fresh();
    const before = weightedAvgCost(db, 'p1'); // opening 100 @ 380
    s.money('the average starts at the opening cost', before, 380);
    const oops = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 100, unitCostBeforeDisc: 3800, taxPct: 0 }], // a slipped zero
      payments: [],
    });
    s.ok('the mistyped bill moves the average', weightedAvgCost(db, 'p1') > 1000);
    cancelPurchase(db, oops.id, 'u_admin', 'typed 3800 for 380');
    s.money('cancelling it takes it back out of the average', weightedAvgCost(db, 'p1'), before);
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 2, spr: 520 }],
      payments: [{ method: 'Cash', amount: 1040 }],
    });
    s.money(
      'so the next sale is costed at 380, not the mistake',
      (db.prepare('SELECT cogs FROM sales WHERE id = ?').get(sale.id) as { cogs: number }).cogs,
      760,
    );
    db.close();
  }

  s.section('chain-local-time-buckets');
  {
    const db = fresh();
    // 00:30 on the shop's clock today — in UTC+6 that is 18:30 YESTERDAY in UTC.
    const now = new Date();
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 30).toISOString();
    createSale(db, {
      date: at,
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 1, spr: 777 }],
      payments: [{ method: 'Cash', amount: 777 }],
    });
    const localDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const hours = hourlySales(db, { preset: 'today' });
    s.ok('a 00:30 sale is in the 00:00 hour, on the shop clock', hours.some((h) => h.hour === 0 && h.total === 777));
    const trend = salesTrend(db, 7);
    s.ok('and on TODAY in the daily trend, not yesterday', trend.some((d) => d.day === localDay && d.total >= 777));
    const months = salesVsPurchaseVsExpense(db, 1);
    s.eq('and in this month', months[0]?.month, localDay.slice(0, 7));
    s.ok('with its amount', (months[0]?.sales ?? 0) >= 777);
    db.close();
  }

  // ------------------------------------------------------------------ F20
  s.section('chain-dashboard-deltas');
  {
    s.eq('0 vs 0 has no percentage', deltaPct(0, 0), null);
    s.eq('something vs nothing has no percentage (not "100%")', deltaPct(500, 0), null);
    s.eq('a real change is a percentage', deltaPct(150, 100), 50);
    s.eq('an equal day is 0%', deltaPct(100, 100), 0);
    s.eq('a loss turning into a profit reads as a rise', deltaPct(100, -100), 200);
    const db = fresh();
    const stats = getStats(db, { preset: 'today' });
    s.eq('an empty shop shows no sales delta', stats.sales.deltaPct, null);
    s.eq('an empty shop shows no transactions delta', stats.transactions.deltaPct, null);
    db.close();
  }

  // ------------------------------------------------------ R3 R4 R9 R24 R54
  s.section('chain-input-checks');
  {
    const db = fresh();
    const base = { branchId: 'br_mp', userId: 'u_admin', customerId: 'cu2' };
    const line = { productId: 'p1', qty: 1, spr: 500 };
    const stock0 = stockOnHand(db, 'p1', 'br_mp');
    refuses(s, 'a negative quantity is refused (it used to put stock IN)', () =>
      createSale(db, { ...base, lines: [{ ...line, qty: -5 }], payments: [] }), /above zero/);
    s.money('and stock did not move', stockOnHand(db, 'p1', 'br_mp'), stock0);
    refuses(s, 'a NaN price is refused', () => createSale(db, { ...base, lines: [{ ...line, spr: NaN }] }), /number/);
    refuses(s, 'a negative price is refused', () => createSale(db, { ...base, lines: [{ ...line, spr: -1 }] }), /below 0/);
    refuses(s, 'a line discount over 100% is refused', () =>
      createSale(db, { ...base, lines: [{ ...line, discountPct: 120 }] }), /above 100/);
    refuses(s, 'an order discount bigger than the goods is refused', () =>
      createSale(db, { ...base, lines: [line], orderDiscountFlat: 900 }), /more than the items/);
    refuses(s, 'VAT over 100% is refused', () => createSale(db, { ...base, lines: [line], taxPct: 150 }), /above 100/);
    refuses(s, 'a round-off is a few taka, not a discount', () =>
      createSale(db, { ...base, lines: [line], roundOff: -300 }), /round-off/);
    const lineVat = createSale(db, { ...base, lines: [{ ...line, taxPct: 5 }], payments: [] });
    s.eq(
      'a per-line VAT % is not stored (it was never charged; VAT is on the bill)',
      (db.prepare('SELECT tax_pct FROM sale_lines WHERE sale_id = ?').get(lineVat.id) as { tax_pct: number }).tax_pct,
      0,
    );
    refuses(s, 'an unknown product is refused', () =>
      createSale(db, { ...base, lines: [{ ...line, productId: 'p_nope' }] }), /does not exist/);
    refuses(s, 'an unknown customer is refused', () =>
      createSale(db, { ...base, customerId: 'cu_nope', lines: [line] }), /customer does not exist/);
    refuses(s, 'a sale with no items is refused', () => createSale(db, { ...base, lines: [] }), /at least one item/);
    refuses(s, 'an unknown payment method is refused', () =>
      createSale(db, { ...base, lines: [line], payments: [{ method: 'Gold', amount: 500 }] }), /not a payment method/);

    // Methods are stored in one spelling, so lower-case cash still reaches the drawer.
    const lower = createSale(db, { ...base, lines: [line], payments: [{ method: 'cash', amount: 500 }] });
    s.eq(
      '"cash" is stored as Cash',
      (db.prepare('SELECT method FROM sale_payments WHERE sale_id = ?').get(lower.id) as { method: string }).method,
      'Cash',
    );
    s.money('and reached the drawer', shiftTotals(db, getOpenShift(db, 'br_mp')!.id as string).cashIn, 500);

    // বাকি needs a name; a walk-in cannot pay ahead.
    refuses(s, 'credit on a walk-in is refused', () =>
      createSale(db, { branchId: 'br_mp', userId: 'u_admin', lines: [line], payments: [{ method: 'Cash', amount: 100 }] }),
    /named customer/);
    refuses(s, 'credit on the seeded walk-in customer is refused too', () =>
      createSale(db, { ...base, customerId: 'cu1', lines: [line], payments: [] }), /named customer/);
    const walk = createSale(db, { branchId: 'br_mp', userId: 'u_admin', lines: [line], payments: [{ method: 'Cash', amount: 500 }] });
    s.ok('a fully paid walk-in sale is fine', !!walk.id);
    const named = createSale(db, { ...base, lines: [line], payments: [] });
    const paidAhead = addSalePayment(db, named.id, { method: 'Cash', amount: 700 }, 'u_admin');
    s.money('a named customer may pay ahead: the invoice clears', paidAhead.due, 0);

    // Archived products are out of the catalogue, but stay on old invoices.
    db.prepare("UPDATE products SET archived_at = '2026-01-01' WHERE id = 'p19'").run();
    refuses(s, 'an archived product cannot be sold', () =>
      createSale(db, { ...base, lines: [{ productId: 'p19', qty: 1, spr: 600 }] }), /archived/);
    db.prepare("UPDATE products SET archived_at = NULL WHERE id = 'p19'").run();

    // Purchases get the same checks.
    const pbase = { branchId: 'br_mp', userId: 'u_admin', supplierId: 'sp1' };
    const pline = { productId: 'p1', qty: 10, unitCostBeforeDisc: 380 };
    refuses(s, 'a purchase with a negative quantity is refused', () =>
      createPurchase(db, { ...pbase, lines: [{ ...pline, qty: -10 }] }), /above zero/);
    refuses(s, 'a purchase line VAT is refused (it never reached the bill total)', () =>
      createPurchase(db, { ...pbase, lines: [{ ...pline, taxPct: 5 }] }), /whole bill/);
    refuses(s, 'a purchase order discount bigger than the goods is refused', () =>
      createPurchase(db, { ...pbase, lines: [pline], orderDiscountType: 'flat', orderDiscountValue: 5000 }), /more than the items/);
    refuses(s, 'an unknown supplier is refused', () =>
      createPurchase(db, { ...pbase, supplierId: 'sp_nope', lines: [pline] }), /supplier does not exist/);
    refuses(s, 'paying over a bill with no supplier is refused', () =>
      createPurchase(db, { branchId: 'br_mp', userId: 'u_admin', lines: [pline], payments: [{ method: 'Bank', amount: 5000 }] }),
    /supplier to hold the advance/);
    db.close();
  }

  s.section('chain-pack-cogs');
  {
    const db = fresh();
    // p1 costs 380 a piece (opening stock). Two dozen at 5,000 a dozen.
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 2, unitUsed: 'dz', unitFactor: 12, spr: 5000 }],
      payments: [{ method: 'Bank', amount: 10000 }],
    });
    const row = db.prepare('SELECT cogs FROM sales WHERE id = ?').get(sale.id) as { cogs: number };
    s.money('COGS counts every piece sold (24 × 380), not 2 pieces', row.cogs, 24 * 380);
    s.money('and stock moved 24 pieces', stockOnHand(db, 'p1', 'br_mp'), 76);
    db.close();
  }

  s.section('chain-correction-keeps-payments');
  {
    const db = fresh();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_rana',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 2, spr: 500 }],
      payments: [{ method: 'bKash', amount: 1000, reference: 'BK9', paidAt: '2026-09-01T05:00:00.000Z' }],
    });
    updateSale(db, sale.id, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 2, spr: 480 }],
      reason: 'price agreed after the bill',
    });
    const pays = db.prepare('SELECT method, amount, reference, paid_at, by_user FROM sale_payments WHERE sale_id = ?').all(sale.id) as {
      method: string; amount: number; reference: string; paid_at: string; by_user: string;
    }[];
    s.eq('a correction that does not send payments keeps them', pays.length, 1);
    s.eq('with the method and reference', `${pays[0]?.method} ${pays[0]?.reference}`, 'bKash BK9');
    s.eq('with the date it was paid', pays[0]?.paid_at, '2026-09-01T05:00:00.000Z');
    s.eq('and who took it', pays[0]?.by_user, 'u_rana');

    // The edit screen sends the payment list back: an unchanged row keeps the
    // person who took it, and only the new row is credited to the editor.
    updateSale(db, sale.id, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 2, spr: 520 }],
      payments: [
        { method: 'bKash', amount: 1000, reference: 'BK9', paidAt: '2026-09-01T05:00:00.000Z' },
        { method: 'Bank', amount: 40, reference: 'TT1', paidAt: '2026-09-02T05:00:00.000Z' },
      ],
      reason: 'price corrected again',
    });
    const pays2 = db
      .prepare('SELECT method, by_user FROM sale_payments WHERE sale_id = ? ORDER BY paid_at')
      .all(sale.id) as { method: string; by_user: string }[];
    s.eq('an unchanged payment sent back by the edit keeps who took it', pays2[0]?.by_user, 'u_rana');
    s.eq('a payment added in the edit is credited to the editor', pays2[1]?.by_user, 'u_admin');
    const draft = createSale(db, { branchId: 'br_mp', userId: 'u_admin', customerId: 'cu2', status: 'draft', lines: [{ productId: 'p1', qty: 1, spr: 500 }] });
    refuses(s, 'an edit cannot turn a draft into a sale (Convert does that)', () =>
      updateSale(db, draft.id, {
        status: 'final',
        branchId: 'br_mp',
        userId: 'u_admin',
        customerId: 'cu2',
        lines: [{ productId: 'p1', qty: 1, spr: 500 }],
        reason: 'x',
      }),
    /Convert to Sale/);
    db.close();
  }

  // ------------------------------------------------------------ R51 edit
  s.section('chain-purchase-edit');
  {
    const db = fresh();
    // p1: 100 on hand at 380 (opening stock).
    const bill = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400 }],
      payments: [{ method: 'Bank', amount: 1000 }],
    });
    // Sell most of what came in, so the correction must not fail the stock rule.
    createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 108, spr: 500 }],
      payments: [{ method: 'Bank', amount: 54000 }],
    });
    s.money('before the edit, 2 are left', stockOnHand(db, 'p1', 'br_mp'), 2);

    const res = updatePurchase(db, bill.id, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 12, unitCostBeforeDisc: 420 }],
      reason: 'supplier sent 12, invoice said 420',
    });
    s.eq('the bill keeps its number', res.refNo, bill.refNo);
    s.money('stock moves by the difference only (+2)', stockOnHand(db, 'p1', 'br_mp'), 4);
    s.money('the new total', res.totals.total, 5040);
    s.money('the payment made is kept', res.paid, 1000);
    s.money('and the due is recomputed around it', res.due, 4040);
    s.eq('the payment row is untouched', count(db, 'SELECT COUNT(*) c FROM purchase_payments WHERE purchase_id = ?', bill.id), 1);
    s.money(
      'the average cost counts the corrected receipt only',
      weightedAvgCost(db, 'p1'),
      round2((100 * 380 + 12 * 420) / 112),
    );
    s.money('the buying price is the corrected one', (db.prepare("SELECT cost FROM products WHERE id = 'p1'").get() as { cost: number }).cost, 420);
    s.eq(
      'the edit is in the bill audit',
      count(db, "SELECT COUNT(*) c FROM purchase_audit WHERE purchase_id = ? AND action = 'edited'", bill.id),
      1,
    );
    s.money('the supplier owes/is owed the corrected amount', supplierDue(db, 'sp1'), 4040);
    refuses(s, 'an edit needs a reason', () =>
      updatePurchase(db, bill.id, { branchId: 'br_mp', userId: 'u_admin', supplierId: 'sp1', lines: [{ productId: 'p1', qty: 12, unitCostBeforeDisc: 420 }], reason: ' ' }),
    /reason/);
    refuses(s, 'received goods cannot become an order again', () =>
      updatePurchase(db, bill.id, { status: 'ordered', branchId: 'br_mp', userId: 'u_admin', supplierId: 'sp1', lines: [{ productId: 'p1', qty: 12, unitCostBeforeDisc: 420 }], reason: 'x' }),
    /cancel it instead/);
    refuses(s, 'a correction that would take stock below zero is refused', () =>
      updatePurchase(db, bill.id, { branchId: 'br_mp', userId: 'u_admin', supplierId: 'sp1', lines: [{ productId: 'p1', qty: 5, unitCostBeforeDisc: 420 }], reason: 'x' }),
    );
    s.money('and nothing moved', stockOnHand(db, 'p1', 'br_mp'), 4);

    db.close();
  }
  {
    // Cancelling a corrected bill puts everything back as if it never came.
    const db = fresh();
    const bill = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400 }],
    });
    updatePurchase(db, bill.id, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 12, unitCostBeforeDisc: 420 }],
      reason: 'count corrected',
    });
    cancelPurchase(db, bill.id, 'u_admin', 'whole delivery rejected');
    s.money('cancel after edit: stock is what it was before the bill', stockOnHand(db, 'p1', 'br_mp'), 100);
    s.money('and the average cost is back to the opening stock', weightedAvgCost(db, 'p1'), 380);
    db.close();
  }
  {
    const db = fresh();
    const bill = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400 }],
    });
    createPurchaseReturn(db, {
      purchaseId: bill.id,
      branchId: 'br_mp',
      userId: 'u_admin',
      refundMethod: 'CreditAdjust',
      lines: [{ productId: 'p1', qty: 4, unitCost: 400, refundAmount: 1600 }],
    });
    refuses(s, 'a correction cannot bring in fewer than were sent back', () =>
      updatePurchase(db, bill.id, { branchId: 'br_mp', userId: 'u_admin', supplierId: 'sp1', lines: [{ productId: 'p1', qty: 3, unitCostBeforeDisc: 400 }], reason: 'x' }),
    /already sent back/);
    const upd = updatePurchase(db, bill.id, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 390 }],
      reason: 'price corrected',
    });
    s.money('a credit note survives a correction', upd.due, round2(3900 - 1600));

    // An ORDERED bill arrives.
    const order = createPurchase(db, {
      status: 'ordered',
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p19', qty: 5, unitCostBeforeDisc: 500 }],
    });
    const s0 = stockOnHand(db, 'p19', 'br_mp');
    receivePurchase(db, order.id, 'u_admin');
    s.money('receiving an ordered bill puts its goods in', stockOnHand(db, 'p19', 'br_mp'), s0 + 5);
    s.eq('and it is received', (db.prepare('SELECT status FROM purchases WHERE id = ?').get(order.id) as { status: string }).status, 'received');
    refuses(s, 'a bill is received once', () => receivePurchase(db, order.id, 'u_admin'), /already been received/);
    cancelPurchase(db, order.id, 'u_admin', 'x');
    refuses(s, 'a cancelled bill cannot be edited', () =>
      updatePurchase(db, order.id, { branchId: 'br_mp', userId: 'u_admin', supplierId: 'sp1', lines: [{ productId: 'p19', qty: 5, unitCostBeforeDisc: 500 }], reason: 'x' }),
    /cancelled/);
    db.close();
  }

  // ------------------------------------------------------------ R5 R7 R8
  s.section('chain-refund-within-settlement');
  {
    const db = fresh();
    const base = { branchId: 'br_mp', userId: 'u_admin', customerId: 'cu2' };
    // An unpaid credit sale: cash cannot be handed back for it.
    const credit = createSale(db, { ...base, lines: [{ productId: 'p1', qty: 4, spr: 500 }], payments: [] });
    refuses(s, 'no cash refund on an unpaid invoice', () =>
      createSellReturn(db, {
        saleId: credit.id,
        ...base,
        refundMethod: 'Cash',
        lines: [{ productId: 'p1', qty: 1, unitPrice: 500, refundAmount: 500 }],
      }),
    /nothing to hand back/);
    const cn = createSellReturn(db, {
      saleId: credit.id,
      ...base,
      refundMethod: 'CreditAdjust',
      lines: [{ productId: 'p1', qty: 1, unitPrice: 500, refundAmount: 500 }],
    });
    s.ok('a credit note settles part of what is owed', !!cn.id);

    // Part paid: at most what was paid comes back as money; at most what is owed as credit.
    const part = createSale(db, {
      ...base,
      lines: [{ productId: 'p1', qty: 4, spr: 500 }],
      payments: [{ method: 'Cash', amount: 600 }],
    });
    refuses(s, 'money back is capped at what was paid', () =>
      createSellReturn(db, {
        saleId: part.id,
        ...base,
        refundMethod: 'Cash',
        lines: [{ productId: 'p1', qty: 2, unitPrice: 500, refundAmount: 1000 }],
      }),
    /At most 600/);
    refuses(s, 'a credit note is capped at what is still owed', () =>
      createSellReturn(db, {
        saleId: part.id,
        ...base,
        refundMethod: 'CreditAdjust',
        lines: [{ productId: 'p1', qty: 4, unitPrice: 500, refundAmount: 2000 }],
      }),
    /1400 still owed/);
    createSellReturn(db, {
      saleId: part.id,
      ...base,
      refundMethod: 'Cash',
      lines: [{ productId: 'p1', qty: 1, unitPrice: 500, refundAmount: 500 }],
    });
    refuses(s, 'earlier money-back returns count against what was paid', () =>
      createSellReturn(db, {
        saleId: part.id,
        ...base,
        refundMethod: 'StoreCredit',
        lines: [{ productId: 'p1', qty: 1, unitPrice: 500, refundAmount: 500 }],
      }),
    /At most 100/);
    refuses(s, 'a return must be against a sale', () =>
      createSellReturn(db, {
        ...base,
        refundMethod: 'Cash',
        lines: [{ productId: 'p1', qty: 1, unitPrice: 500, refundAmount: 500 }],
      }),
    /against the sale/);
    refuses(s, 'a purchase return must be against a bill', () =>
      createPurchaseReturn(db, {
        branchId: 'br_mp',
        userId: 'u_admin',
        supplierId: 'sp1',
        refundMethod: 'CashRefund',
        lines: [{ productId: 'p1', qty: 1, unitCost: 380, refundAmount: 380 }],
      }),
    /against the bill/);
    const unpaidBill = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400 }],
    });
    refuses(s, 'no cash back from a supplier on an unpaid bill', () =>
      createPurchaseReturn(db, {
        purchaseId: unpaidBill.id,
        branchId: 'br_mp',
        userId: 'u_admin',
        refundMethod: 'CashRefund',
        lines: [{ productId: 'p1', qty: 1, unitCost: 400, refundAmount: 400 }],
      }),
    /Nothing was paid on this bill/);
    db.close();
  }

  s.section('chain-nothing-vanishes-on-cancel-or-void');
  {
    const db = fresh();
    // R5: an ORDERED bill with a cash advance, cancelled — the cash comes back.
    const ordered = createPurchase(db, {
      status: 'ordered',
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400 }],
      payments: [{ method: 'Cash', amount: 1000 }],
    });
    const drawer = getOpenShift(db, 'br_mp')!.id as string;
    s.money('the advance left the drawer', shiftTotals(db, drawer).expected, -1000);
    cancelPurchase(db, ordered.id, 'u_admin', 'supplier out of stock');
    s.money('cancelling the ordered bill brings the cash advance back', shiftTotals(db, drawer).expected, 0);

    // A bank advance on a cancelled bill stays with the supplier, as a credit.
    const before = supplierDue(db, 'sp1');
    const bank = createPurchase(db, {
      status: 'ordered',
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400 }],
      payments: [{ method: 'Bank', amount: 1500 }],
    });
    cancelPurchase(db, bank.id, 'u_admin', 'not needed');
    s.money('a bank advance on a cancelled bill is still owed by the supplier', supplierDue(db, 'sp1'), round2(before - 1500));

    // A bKash payment on a voided sale stays owed to the customer.
    const cBefore = customerDue(db, 'cu2');
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 2, spr: 500 }],
      payments: [{ method: 'bKash', amount: 1000, reference: 'BK1' }],
    });
    voidSale(db, sale.id, 'u_admin', 'wrong customer');
    s.money('a bKash payment on a voided sale is owed back to the customer', customerDue(db, 'cu2'), round2(cBefore - 1000));
    s.ok(
      'and shows on their ledger',
      customerLedger(db, 'cu2').some((e) => e.reference.includes('(voided)') && e.credit === 1000),
    );
    db.close();
  }

  // ------------------------------------------------------------------ R6
  // No "Open Shift" step: every cash event lands in a drawer, which opens itself.
  s.section('chain-drawer-opens-itself');
  {
    const db = fresh();
    const shifts = () => count(db, 'SELECT COUNT(*) c FROM cash_shifts');
    s.eq('a new shop has no drawer yet', shifts(), 0);

    const first = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      lines: [{ productId: 'p1', qty: 1, spr: 500 }],
      payments: [{ method: 'Cash', amount: 500 }],
    });
    const open1 = getOpenShift(db, 'br_mp');
    s.ok('a cash sale with no shift open opens the drawer', !!open1);
    s.money('the first drawer starts at zero', (open1?.opening_cash as number) ?? -1, 0);
    s.money('and the sale cash is in it', shiftTotals(db, open1!.id as string).expected, 500);
    s.ok(
      'the drawer says it opened by itself',
      String(open1?.open_note ?? '').startsWith('Opened automatically'),
    );

    createExpense(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      categoryId: 'ec_misc',
      amount: 120,
      paymentMethod: 'Cash',
      date: new Date().toISOString(),
    });
    s.eq('a second cash event uses the same drawer', shifts(), 1);
    s.money('the expense came out of it', shiftTotals(db, open1!.id as string).expected, 380);

    // Count and close, leaving a float; the next cash event carries it forward.
    closeShift(db, { shiftId: open1!.id as string, countedCash: 380, carriedFloat: 300, closedBy: 'u_rana' });
    s.money('what the next drawer will start with is the float left', carriedForwardCash(db, 'br_mp').amount, 300);
    s.eq(
      'the close records who counted it (R27)',
      (db.prepare('SELECT closed_by AS b FROM cash_shifts WHERE id = ?').get(open1!.id) as { b: string }).b,
      'u_rana',
    );
    s.eq(
      'and the close is in the activity log',
      count(db, "SELECT COUNT(*) c FROM activity_log WHERE entity = 'shift' AND action = 'closed' AND by_user = 'u_rana'"),
      1,
    );
    s.ok('the sale is on record', !!first.id);
    db.close();
  }
  {
    const db = fresh();
    const credit = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 2, spr: 500 }],
      payments: [],
    });
    const s1 = openShift(db, { branchId: 'br_mp', userId: 'u_admin', openingCash: 1000 });
    closeShift(db, { shiftId: s1, countedCash: 1000 });
    s.money('with no float set, the whole count is carried forward', carriedForwardCash(db, 'br_mp').amount, 1000);

    // A due collected after the close opens the next drawer at the carried count.
    addSalePayment(db, credit.id, { method: 'Cash', amount: 400 }, 'u_admin');
    const open2 = getOpenShift(db, 'br_mp');
    s.ok('a due collected after a close opens the next drawer', !!open2 && open2.id !== s1);
    s.money('starting from the carried count', (open2?.opening_cash as number) ?? -1, 1000);
    s.money('with the payment in it', shiftTotals(db, open2!.id as string).expected, 1400);

    // Reversals are recorded too: a void with no drawer open takes the cash out.
    closeShift(db, { shiftId: open2!.id as string, countedCash: 1400 });
    const cashSale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      lines: [{ productId: 'p1', qty: 1, spr: 500 }],
      payments: [{ method: 'Cash', amount: 500 }],
    });
    const open3 = getOpenShift(db, 'br_mp')!;
    closeShift(db, { shiftId: open3.id as string, countedCash: 1900 });
    voidSale(db, cashSale.id, 'u_admin', 'wrong item');
    const open4 = getOpenShift(db, 'br_mp');
    s.ok('a void with no drawer open still records the cash going out', !!open4);
    s.money('the refund came out of the new drawer', shiftTotals(db, open4!.id as string).expected, 1400);
    s.eq(
      'every cash payment ever taken has a drawer movement',
      count(
        db,
        `SELECT COUNT(*) c FROM sale_payments p
          WHERE p.method = 'Cash'
            AND NOT EXISTS (SELECT 1 FROM cash_movements m WHERE m.ref_id = p.sale_id AND m.direction = 'in')`,
      ),
      0,
    );

    // Cash In / Cash Out: the backend picks the drawer and checks the input.
    const moveId = manualCashMove(db, {
      branchId: 'br_mp',
      direction: 'in',
      amount: 250,
      note: 'Float top-up',
      userId: 'u_admin',
      shiftId: s1, // a CLOSED shift from the screen is ignored
    });
    const moved = db.prepare('SELECT shift_id FROM cash_movements WHERE id = ?').get(moveId) as { shift_id: string };
    s.eq('a manual cash-in lands in the OPEN drawer, never a closed one', moved.shift_id, open4!.id);
    refuses(s, 'a manual move needs an amount above zero', () =>
      manualCashMove(db, { branchId: 'br_mp', direction: 'out', amount: -5, userId: 'u_admin' }),
    /above zero/);
    refuses(s, 'a manual move needs a direction', () =>
      manualCashMove(db, { branchId: 'br_mp', direction: 'sideways' as 'in', amount: 5, userId: 'u_admin' }),
    /cash in or cash out/);
    s.eq(
      'a manual move is in the activity log',
      count(db, "SELECT COUNT(*) c FROM activity_log WHERE entity = 'cash' AND entity_id = ?", moveId),
      1,
    );
    refuses(s, 'opening cash cannot be negative', () =>
      openShift(db, { branchId: 'br_ut', userId: 'u_admin', openingCash: -1 }),
    /negative/);
    db.close();
  }

  // ------------------------------------------------------------------ one branch
  // The screens used to send the demo fixture's id 'br_mp' on every write. A
  // write with no branch now goes to the shop's DEFAULT branch; a return or a
  // shipment goes to the branch of the document it came from.
  s.section('chain-single-branch');
  {
    const db = fresh();
    const branchOf = (table: string, id: string) =>
      (db.prepare(`SELECT branch_id AS b FROM ${table} WHERE id = ?`).get(id) as { b: string | null }).b;

    s.eq('with no branch named, the default branch is used', shopBranchId(db), 'br_mp');
    const sale = createSale(db, {
      userId: 'u_admin',
      lines: [{ productId: 'p1', qty: 2, spr: 500 }],
      payments: [{ method: 'Cash', amount: 1000 }],
    });
    s.eq('a sale with no branch lands on the default branch', branchOf('sales', sale.id), 'br_mp');
    s.money('and its stock comes off that branch', stockOnHand(db, 'p1', 'br_mp'), 98);
    refuses(
      s,
      'a branch that does not exist is refused, not guessed',
      () =>
        createSale(db, {
          branchId: 'br_nope',
          userId: 'u_admin',
          lines: [{ productId: 'p1', qty: 1, spr: 500 }],
          payments: [{ method: 'Cash', amount: 500 }],
        }),
      /branch does not exist/,
    );

    // A sale made at another branch: its return and shipment go back THERE.
    recordMovement(db, { productId: 'p1', branchId: 'br_ut', reason: 'opening_stock', qty: 10, unitCost: 380 });
    const utSale = createSale(db, {
      branchId: 'br_ut',
      userId: 'u_admin',
      lines: [{ productId: 'p1', qty: 3, spr: 500 }],
      payments: [{ method: 'Cash', amount: 1500 }],
    });
    const sr = createSellReturn(db, {
      saleId: utSale.id,
      userId: 'u_admin',
      refundMethod: 'Cash',
      lines: [{ productId: 'p1', qty: 1, unitPrice: 500, refundAmount: 500 }],
    });
    s.eq("a return with no branch goes to the sale's branch", branchOf('sell_returns', sr.id), 'br_ut');
    s.money('and the goods are back on that shelf', stockOnHand(db, 'p1', 'br_ut'), 8);
    s.money('not on the default branch', stockOnHand(db, 'p1', 'br_mp'), 98);
    const ship = createShipment(db, { saleId: utSale.id, userId: 'u_admin', address: 'Uttara 7' });
    s.eq("a shipment with no branch goes out from the sale's branch", branchOf('shipments', ship.id), 'br_ut');

    // Purchases: no branch → default; the return leaves from the bill's branch.
    const pur = createPurchase(db, {
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p19', qty: 4, unitCostBeforeDisc: 480, taxPct: 0 }],
      payments: [],
    });
    s.eq('a purchase with no branch lands on the default branch', branchOf('purchases', pur.id), 'br_mp');
    const utPur = createPurchase(db, {
      branchId: 'br_ut',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p19', qty: 6, unitCostBeforeDisc: 480, taxPct: 0 }],
      payments: [],
    });
    const pr = createPurchaseReturn(db, {
      purchaseId: utPur.id,
      userId: 'u_admin',
      refundMethod: 'CreditAdjust',
      lines: [{ productId: 'p19', qty: 2, unitCost: 480, refundAmount: 960 }],
    });
    s.eq("a purchase return with no branch leaves from the bill's branch", branchOf('purchase_returns', pr.id), 'br_ut');
    s.money('the goods left that branch', stockOnHand(db, 'p19', 'br_ut'), 4);

    // Stock count and new-product opening stock with no branch.
    const adj = createAdjustment(db, {
      type: 'recount',
      reason: 'counted',
      lines: [{ productId: 'p19', qty: -1 }],
      createdBy: 'u_admin',
    });
    s.eq('a stock count with no branch is filed at the default branch', branchOf('stock_adjustments', adj.id), 'br_mp');
    const prod = createProduct(db, { sku: 'SB-1', name: 'Single-branch bolt', cost: 10, price: 15, openingStock: 25 });
    s.money('opening stock with no branch is recorded, not dropped', stockOnHand(db, prod.id, 'br_mp'), 25);

    // Moving the default moves where the next write goes, and both records agree.
    setDefaultBranch(db, 'br_ut');
    const biz = () =>
      (db.prepare('SELECT default_branch_id AS d FROM business_info WHERE id = 1').get() as { d: string }).d;
    const flagged = () =>
      (db.prepare('SELECT id FROM branches WHERE is_default = 1').all() as { id: string }[]).map((r) => r.id).join(',');
    s.eq('Set default also moves the business default branch', biz(), 'br_ut');
    s.eq('exactly one branch is flagged default', flagged(), 'br_ut');
    const after = createSale(db, {
      userId: 'u_admin',
      lines: [{ productId: 'p1', qty: 1, spr: 500 }],
      payments: [{ method: 'Cash', amount: 500 }],
    });
    s.eq('after the default moves, a sale with no branch goes to the new default', branchOf('sales', after.id), 'br_ut');
    updateBusinessInfo(db, { defaultBranchId: 'br_mp' });
    s.eq("Business Info's default branch also moves the branch list's flag", flagged(), 'br_mp');
    s.eq('and the next write follows it', shopBranchId(db), 'br_mp');

    const paid = paySupplier(db, { supplierId: 'sp1', amount: 100, method: 'Bank', userId: 'u_admin' });
    s.money('a supplier payment with no branch goes through', paid.allocated, 100);
    db.close();
  }

  s.section('chain-search');
  {
    const db = fresh();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 1, spr: 520 }],
      payments: [{ method: 'Cash', amount: 520 }],
    });
    const hits = (q: string) => (globalSearch(db, q).invoices as { sale_id: string }[]).map((r) => r.sale_id);
    s.ok('the full invoice number (with dashes) finds the sale', hits(sale.invoiceNo).includes(sale.id));
    s.ok('the start of it does too', hits(sale.invoiceNo.slice(0, 6)).includes(sale.id));
    for (const bad of ['(', 'AND', 'a:b', '"', '-', 'NEAR(', '*']) {
      let threw = false;
      try {
        globalSearch(db, bad);
      } catch {
        threw = true;
      }
      s.ok(`search does not break on ${JSON.stringify(bad)}`, !threw);
    }
    s.eq('punctuation alone is not a search', ftsQuery('( - *'), null);
    s.eq('quotes are escaped, not stripped', ftsQuery('5"'), '"5"""*');
    db.close();
  }

  // ------------------------------------------------------------------ F15
  s.section('chain-convert');
  {
    const db = fresh();
    const shiftId = openShift(db, { branchId: 'br_mp', userId: 'u_admin', openingCash: 1000 });
    const body = {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 4, spr: 500 }],
      payments: [{ method: 'Cash', amount: 2000 }],
    };

    // ---- a draft is finalised in place, with a real number ----
    const draft = createSale(db, { ...body, status: 'draft', payments: [] });
    s.ok('a draft carries a draft number', draft.invoiceNo.startsWith('DRF'));
    const conv = convertSale(db, draft.id, body);
    const row = db.prepare('SELECT status, invoice_no FROM sales WHERE id = ?').get(draft.id) as {
      status: string;
      invoice_no: string;
    };
    s.eq('the converted draft keeps its id', conv.id, draft.id);
    s.eq('and is final', row.status, 'final');
    s.ok('and gets a real invoice number, not the draft one', !row.invoice_no.startsWith('DRF') && row.invoice_no === conv.invoiceNo);
    s.money('stock moved once', stockOnHand(db, 'p1', 'br_mp'), 96);
    s.money('cash taken once', shiftTotals(db, shiftId).expected, 3000);
    s.eq(
      'its stock movement carries the new number',
      (db.prepare("SELECT ref_no FROM stock_movements WHERE ref_id = ? AND reason = 'sale'").get(draft.id) as { ref_no: string })
        .ref_no,
      conv.invoiceNo,
    );
    refuses(s, 'a final sale cannot be converted', () => convertSale(db, draft.id, body), /only a draft or a quotation/);

    // ---- a quotation is kept; a new sale is made from it ----
    const quote = createSale(db, { ...body, status: 'quotation', payments: [] });
    const made = convertSale(db, quote.id, body);
    s.ok('converting a quotation makes a NEW sale', made.id !== quote.id);
    s.eq(
      'the quotation is kept as a quotation',
      (db.prepare('SELECT status FROM sales WHERE id = ?').get(quote.id) as { status: string }).status,
      'quotation',
    );
    s.eq(
      'the new sale points back at it',
      (db.prepare('SELECT source_quotation_id AS q FROM sales WHERE id = ?').get(made.id) as { q: string }).q,
      quote.id,
    );
    s.eq(
      'the quotation records what it became',
      count(db, "SELECT COUNT(*) c FROM sale_audit WHERE sale_id = ? AND action = 'converted'", quote.id),
      1,
    );
    s.money('the new sale moved stock', stockOnHand(db, 'p1', 'br_mp'), 92);
    refuses(s, 'a quotation converts once', () => convertSale(db, quote.id, body), /already converted/);
    voidSale(db, made.id, 'u_admin', 'customer changed mind');
    const again = convertSale(db, quote.id, body);
    s.ok('once that sale is voided, the quotation can be converted again', again.id !== made.id);
    db.close();
  }

  // ------------------------------------------------------------------ F14
  s.section('chain-return-reads');
  {
    const db = fresh();
    const api = buildApi();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [
        { productId: 'p1', qty: 3, spr: 500 },
        { productId: 'p19', qty: 2, spr: 700 },
      ],
      payments: [{ method: 'Cash', amount: 2900 }],
    });
    const ret = createSellReturn(db, {
      saleId: sale.id,
      branchId: 'br_mp',
      userId: 'u_admin',
      refundMethod: 'Cash',
      lines: [
        { productId: 'p1', qty: 1, unitPrice: 500, refundAmount: 500 },
        { productId: 'p19', qty: 2, unitPrice: 700, refundAmount: 1400 },
      ],
    });
    const custName = (db.prepare("SELECT name FROM customers WHERE id = 'cu2'").get() as { name: string }).name;
    const listed = (api['sellReturns.list'](db, {}) as { id: string; customer_name: string | null }[]).find(
      (r) => r.id === ret.id,
    );
    s.eq('the sell-return list names the real customer', listed?.customer_name ?? null, custName);
    const one = api['sellReturns.get'](db, { id: ret.id }) as {
      customer_name: string;
      lines: { product_id: string; qty: number; refund_amount: number }[];
    } | null;
    s.eq('sellReturns.get carries both lines', one?.lines.length ?? 0, 2);
    s.money(
      'and its lines add up to the return total',
      round2((one?.lines ?? []).reduce((a, l) => a + l.refund_amount, 0)),
      ret.total,
    );
    s.eq('an unknown return reads as null', api['sellReturns.get'](db, { id: 'nope' }), null);

    const pur = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [],
    });
    // Unpaid bill: the goods go back on a credit note (cash back is refused —
    // nothing was paid on it; see chain-refund-within-settlement).
    const pret = createPurchaseReturn(db, {
      purchaseId: pur.id,
      branchId: 'br_mp',
      userId: 'u_admin',
      refundMethod: 'CreditAdjust',
      lines: [{ productId: 'p1', qty: 3, unitCost: 400, refundAmount: 1200 }],
    });
    const plist = api['purchaseReturns.list'](db, {}) as { id: string }[];
    s.ok('the purchase return is in purchaseReturns.list', plist.some((r) => r.id === pret.id));
    const pone = api['purchaseReturns.get'](db, { id: pret.id }) as {
      purchase_ref_no: string;
      lines: { qty: number }[];
    } | null;
    s.eq('purchaseReturns.get carries its line', pone?.lines.length ?? 0, 1);
    s.eq('and names the bill it came from', pone?.purchase_ref_no ?? '', pur.refNo);
    db.close();
  }

  // ------------------------------------------------------------------ F7
  s.section('chain-no-void-after-return');
  {
    const db = fresh();
    const shiftId = openShift(db, { branchId: 'br_mp', userId: 'u_admin', openingCash: 1000 });
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 10, spr: 520 }],
      payments: [{ method: 'Cash', amount: 5200 }],
    });
    createSellReturn(db, {
      saleId: sale.id,
      branchId: 'br_mp',
      userId: 'u_admin',
      refundMethod: 'Cash',
      lines: [{ productId: 'p1', qty: 4, unitPrice: 520, refundAmount: 2080 }],
    });
    const stock = stockOnHand(db, 'p1', 'br_mp');
    const drawer = shiftTotals(db, shiftId).expected;
    refuses(s, 'a sale with a return cannot be voided', () => voidSale(db, sale.id, 'u_admin', 'x'), /already has a return/);
    s.money('the refused void put nothing back on the shelf', stockOnHand(db, 'p1', 'br_mp'), stock);
    s.money('and took nothing out of the drawer', shiftTotals(db, shiftId).expected, drawer);
    s.eq(
      'the sale is still final',
      (db.prepare('SELECT status FROM sales WHERE id = ?').get(sale.id) as { status: string }).status,
      'final',
    );
    // The honest way to undo the rest still works.
    createSellReturn(db, {
      saleId: sale.id,
      branchId: 'br_mp',
      userId: 'u_admin',
      refundMethod: 'Cash',
      lines: [{ productId: 'p1', qty: 6, unitPrice: 520, refundAmount: 3120 }],
    });
    s.money('returning the rest brings stock back exactly', stockOnHand(db, 'p1', 'br_mp'), 100);
    s.money('and the drawer is back where it started', shiftTotals(db, shiftId).expected, 1000);
    db.close();
  }

  s.section('chain-no-cancel-after-return');
  {
    const db = fresh();
    const pur = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p19', qty: 5, unit: 'dozen', unitFactor: 12, unitCostBeforeDisc: 620, taxPct: 0 }],
      payments: [],
    });
    createPurchaseReturn(db, {
      purchaseId: pur.id,
      branchId: 'br_mp',
      userId: 'u_admin',
      refundMethod: 'CreditAdjust',
      lines: [{ productId: 'p19', qty: 1, unitCost: 620, refundAmount: 620 }],
    });
    const stock = stockOnHand(db, 'p19', 'br_mp');
    refuses(
      s,
      'a purchase with a return cannot be cancelled',
      () => cancelPurchase(db, pur.id, 'u_admin', 'x'),
      /already has a return/,
    );
    s.money('the refused cancel removed nothing', stockOnHand(db, 'p19', 'br_mp'), stock);
    refuses(s, 'nor deleted', () => deletePurchase(db, pur.id));
    db.close();
  }

  s.section('chain-payment-guards');
  {
    const db = fresh();
    const shiftId = openShift(db, { branchId: 'br_mp', userId: 'u_admin', openingCash: 1000 });
    const credit = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 2, spr: 500 }],
      payments: [],
    });
    voidSale(db, credit.id, 'u_admin', 'mistake');
    const drawer = shiftTotals(db, shiftId).expected;
    refuses(s, 'a voided sale cannot be paid', () =>
      addSalePayment(db, credit.id, { method: 'Cash', amount: 1000 }, 'u_admin'),
    /needs a final sale/);
    s.money('the refused payment put no cash in the drawer', shiftTotals(db, shiftId).expected, drawer);
    s.money(
      'and the void still owes nothing',
      (db.prepare('SELECT due FROM sales WHERE id = ?').get(credit.id) as { due: number }).due,
      0,
    );
    const draft = createSale(db, {
      status: 'draft',
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 1, spr: 500 }],
    });
    refuses(s, 'a draft cannot be paid', () =>
      addSalePayment(db, draft.id, { method: 'Cash', amount: 500 }, 'u_admin'),
    );
    const live = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 1, spr: 500 }],
      payments: [],
    });
    refuses(s, 'a zero payment is refused', () =>
      addSalePayment(db, live.id, { method: 'Cash', amount: 0 }, 'u_admin'),
    );
    refuses(s, 'a negative payment is refused', () =>
      addSalePayment(db, live.id, { method: 'Cash', amount: -100 }, 'u_admin'),
    );

    const pur = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 5, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [],
    });
    cancelPurchase(db, pur.id, 'u_admin', 'wrong');
    refuses(s, 'a cancelled purchase cannot be paid', () =>
      addPurchasePayment(db, pur.id, { method: 'Cash', amount: 100 }, 'u_admin'),
    /cancelled/);
    const ordered = createPurchase(db, {
      status: 'ordered',
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 5, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [],
    });
    addPurchasePayment(db, ordered.id, { method: 'Bank', amount: 500 }, 'u_admin');
    s.money(
      'an ordered purchase can still take an advance',
      (db.prepare('SELECT paid FROM purchases WHERE id = ?').get(ordered.id) as { paid: number }).paid,
      500,
    );
    refuses(s, 'a purchase with a payment cannot be deleted', () => deletePurchase(db, ordered.id), /payments/);
    s.eq('so it is still there', count(db, 'SELECT COUNT(*) c FROM purchase_payments WHERE purchase_id = ?', ordered.id), 1);

    closeShift(db, { shiftId, countedCash: shiftTotals(db, shiftId).expected });
    refuses(s, 'a closed shift cannot be closed again', () => closeShift(db, { shiftId, countedCash: 0 }), /already closed/);
    s.money(
      'its counted cash is not overwritten',
      (db.prepare('SELECT counted_cash FROM cash_shifts WHERE id = ?').get(shiftId) as { counted_cash: number })
        .counted_cash,
      1000,
    );
    db.close();
  }

  s.section('chain-update-sale-guards');
  {
    const db = fresh();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 2, spr: 500 }],
      payments: [{ method: 'bKash', amount: 1000, reference: 'TX1' }],
    });
    refuses(
      s,
      'a final sale cannot be turned back into a draft',
      () =>
        updateSale(db, sale.id, {
          status: 'draft',
          branchId: 'br_mp',
          userId: 'u_admin',
          customerId: 'cu2',
          lines: [{ productId: 'p1', qty: 2, spr: 500 }],
          reason: 'x',
        }),
      /cannot become a draft/,
    );
    s.eq(
      'so the bKash payment is still on record',
      count(db, 'SELECT COUNT(*) c FROM sale_payments WHERE sale_id = ?', sale.id),
      1,
    );

    // A sale of two DOZEN (factor 12) corrected without resending the factor.
    const pack = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p19', qty: 2, unitUsed: 'dozen', unitFactor: 12, spr: 6000 }],
      payments: [{ method: 'Cash', amount: 12000 }],
    });
    s.money('two dozen took 24 pieces', stockOnHand(db, 'p19', 'br_mp'), 176);
    const costBefore = (
      db.prepare('SELECT unit_cost_at_sale AS c FROM sale_lines WHERE sale_id = ?').get(pack.id) as { c: number }
    ).c;
    // A later, dearer delivery moves today's average cost.
    createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p19', qty: 100, unitCostBeforeDisc: 900, taxPct: 0 }],
      payments: [],
    });
    updateSale(db, pack.id, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p19', qty: 2, unitUsed: 'dozen', spr: 6000 }],
      payments: [{ method: 'Cash', amount: 12000 }],
      reason: 'fixing a typo in the notes',
    });
    s.money(
      'an edit that does not resend the pack size keeps it (no phantom pieces)',
      stockOnHand(db, 'p19', 'br_mp'),
      276,
    );
    const costAfter = (
      db.prepare('SELECT unit_cost_at_sale AS c FROM sale_lines WHERE sale_id = ?').get(pack.id) as { c: number }
    ).c;
    s.money('and keeps the cost the goods were sold at', costAfter, costBefore);

    // A correction cannot sell fewer than have already come back.
    const r = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 10, spr: 500 }],
      payments: [{ method: 'Cash', amount: 5000 }],
    });
    createSellReturn(db, {
      saleId: r.id,
      branchId: 'br_mp',
      userId: 'u_admin',
      refundMethod: 'Cash',
      lines: [{ productId: 'p1', qty: 4, unitPrice: 500, refundAmount: 2000 }],
    });
    refuses(
      s,
      'correcting a sale to fewer than were returned is refused',
      () =>
        updateSale(db, r.id, {
          branchId: 'br_mp',
          userId: 'u_admin',
          customerId: 'cu2',
          lines: [{ productId: 'p1', qty: 3, spr: 500 }],
          payments: [{ method: 'Cash', amount: 1500 }],
          reason: 'x',
        }),
      /already returned/,
    );
    db.close();
  }

  // ------------------------------------------------------------------ F8
  // Books written before the guards above could hold a credit note on a sale
  // that was voided LATER (or a bill cancelled later). The guards make that
  // impossible to create now, so it is built here the way old data looks: the
  // return first, then the status flipped underneath it.
  s.section('chain-balances-ignore-dead-documents');
  {
    const db = fresh();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 10, spr: 1000 }],
      payments: [],
    });
    const before = customerDue(db, 'cu2');
    createSellReturn(db, {
      saleId: sale.id,
      branchId: 'br_mp',
      userId: 'u_admin',
      refundMethod: 'CreditAdjust',
      lines: [{ productId: 'p1', qty: 2, unitPrice: 1000, refundAmount: 2000 }],
    });
    s.money('a live credit note reduces the khata', customerDue(db, 'cu2'), round2(before - 2000));
    // The old books: voided afterwards, columns zeroed the way voidSale does.
    db.prepare("UPDATE sales SET status='void', paid=0, credited=0, due=0 WHERE id = ?").run(sale.id);
    const allSalesBefore = before - 10000; // what the customer owed without this sale
    s.money(
      'once the sale is void, its credit note no longer comes off the khata',
      customerDue(db, 'cu2'),
      round2(allSalesBefore),
    );
    s.ok(
      'nor does it appear in the customer ledger',
      !customerLedger(db, 'cu2').some((e) => e.type === 'return'),
    );
    const invoiceDues = (
      db
        .prepare("SELECT COALESCE(SUM(due),0) AS s FROM sales WHERE customer_id = 'cu2' AND status = 'final'")
        .get() as { s: number }
    ).s;
    const opening = (db.prepare("SELECT opening_balance AS o FROM customers WHERE id = 'cu2'").get() as { o: number }).o;
    s.money('the khata equals opening + the dues on the invoices', customerDue(db, 'cu2'), round2(opening + invoiceDues));

    // The customer-group report uses the same definition.
    const group = (db.prepare("SELECT COALESCE(price_group,'Retail') AS g FROM customers WHERE id = 'cu2'").get() as {
      g: string;
    }).g;
    const members = db
      .prepare("SELECT id FROM customers WHERE COALESCE(price_group,'Retail') = ?")
      .all(group) as { id: string }[];
    const expected = round2(members.reduce((a, m) => a + round2(customerDue(db, m.id)), 0));
    const row = customerGroup(db, { preset: 'thisYear' }).find((r) => r.group === group);
    s.money('the customer-group report agrees with the khata', row?.totalDue ?? NaN, expected);

    const pur = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [],
    });
    const supBefore = supplierDue(db, 'sp1');
    createPurchaseReturn(db, {
      purchaseId: pur.id,
      branchId: 'br_mp',
      userId: 'u_admin',
      refundMethod: 'CreditAdjust',
      lines: [{ productId: 'p1', qty: 2, unitCost: 400, refundAmount: 800 }],
    });
    s.money('a live supplier credit note reduces the payable', supplierDue(db, 'sp1'), round2(supBefore - 800));
    db.prepare("UPDATE purchases SET status='cancelled', paid=0, due=0 WHERE id = ?").run(pur.id);
    s.money(
      'once the bill is cancelled, its credit note no longer comes off the payable',
      supplierDue(db, 'sp1'),
      round2(supBefore - 4000),
    );
    db.close();
  }

  // ------------------------------------------------------------------ F9
  s.section('chain-purchase-credited');
  {
    const db = fresh();
    // A ৳10,000 bill on credit, then a ৳3,000 credit note from the supplier.
    const pur = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp2',
      lines: [{ productId: 'p1', qty: 25, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [],
    });
    const bill = () =>
      db.prepare('SELECT total, paid, credited, due FROM purchases WHERE id = ?').get(pur.id) as {
        total: number;
        paid: number;
        credited: number;
        due: number;
      };
    const supStart = supplierDue(db, 'sp2');
    createPurchaseReturn(db, {
      purchaseId: pur.id,
      branchId: 'br_mp',
      userId: 'u_admin',
      refundMethod: 'CreditAdjust',
      lines: [{ productId: 'p1', qty: 7.5, unitCost: 400, refundAmount: 3000 }],
    });
    s.money('the credit note is recorded on the bill', bill().credited, 3000);
    s.money('the bill due drops to what is really owed', bill().due, 7000);
    s.money('no money was recorded as paid', bill().paid, 0);
    s.money('the supplier payable agrees with the bill', supplierDue(db, 'sp2'), round2(supStart - 3000));
    s.eq(
      'the bill now reads as partly settled in the Purchases filter',
      listPurchasesPage(db, { payment: 'partial', pageSize: 200 }).rows.some((r) => r.id === pur.id),
      true,
    );

    // THE CASE THAT WAS BROKEN: "Pay supplier" allocates against bills. It used
    // to allocate `total - paid` = 10,000 and pay the credited 3,000 again.
    const res = paySupplier(db, {
      supplierId: 'sp2',
      amount: 10000,
      method: 'Bank',
      userId: 'u_admin',
      branchId: 'br_mp',
    });
    s.money('paying the supplier allocates only the real 7,000', res.allocated, 7000);
    s.money('and keeps the 3,000 it did not need as an advance', res.advance, 3000);
    s.money('the bill is cleared', bill().due, 0);
    s.money(
      'the advance stays with the supplier (nothing dropped)',
      supplierDue(db, 'sp2'),
      round2(supStart - 3000 - 10000),
    );
    s.money('paid + credited account for the total exactly once', round2(bill().paid + bill().credited), bill().total);

    // THE INVARIANT, over every bill in this book.
    const broken = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM purchases
            WHERE status != 'cancelled' AND ABS(due - MAX(0, ROUND(total - paid - credited, 2))) > 0.005`,
        )
        .get() as { c: number }
    ).c;
    s.eq('every live bill satisfies due = max(0, total - paid - credited)', broken, 0);
    db.close();
  }

  s.section('chain-purchase-credited-backfill');
  {
    // A database from before v10: the column exists (fresh schema) but the
    // migration has not run, so credited is 0 and the bill still shows its full
    // due even though a credit note sits against it.
    const db = fresh();
    const pur = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp2',
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [],
    });
    createPurchaseReturn(db, {
      purchaseId: pur.id,
      branchId: 'br_mp',
      userId: 'u_admin',
      refundMethod: 'CreditAdjust',
      lines: [{ productId: 'p1', qty: 2, unitCost: 400, refundAmount: 800 }],
    });
    db.prepare('UPDATE purchases SET credited = 0, due = total - paid WHERE id = ?').run(pur.id);
    db.prepare('DELETE FROM schema_migrations WHERE version = 10').run();
    migrate(db);
    const row = db.prepare('SELECT credited, due FROM purchases WHERE id = ?').get(pur.id) as {
      credited: number;
      due: number;
    };
    s.money('the v10 migration back-fills credited from the returns on record', row.credited, 800);
    s.money('and brings the bill due into line', row.due, 3200);
    db.close();
  }

  // --------------------------------------------------------- R30 on account
  // Receive Payment used to loop one un-awaited sales.addPayment per invoice and
  // save NOTHING for money that did not fit an invoice (an opening balance, an
  // advance). One backend call now places every taka.
  s.section('chain-account-payments');
  {
    const db = fresh();
    const drawerIn = () =>
      (
        db
          .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM cash_movements WHERE direction = 'in' AND reason = 'payment_received'")
          .get() as { s: number }
      ).s;
    // cu4 starts with an opening balance of 5,000.
    const credit = createSale(db, {
      userId: 'u_admin',
      customerId: 'cu4',
      lines: [{ productId: 'p1', qty: 4, spr: 500 }],
      payments: [],
    });
    s.money('opening 5,000 + a 2,000 credit sale', customerDue(db, 'cu4'), 7000);

    const r1 = receiveCustomerPayment(db, { partyId: 'cu4', amount: 3000, method: 'Cash', userId: 'u_rana' });
    s.money('the opening balance is paid first', r1.toOpening, 3000);
    s.money('nothing went to the invoice yet', r1.allocated, 0);
    s.ok('it is saved as a payment on account', !!r1.accountPaymentId && !!r1.refNo);
    s.money('the balance drops by the payment', customerDue(db, 'cu4'), 4000);
    s.money('the cash is in the drawer', drawerIn(), 3000);

    const r2 = receiveCustomerPayment(db, { partyId: 'cu4', amount: 4500, method: 'Bank', reference: 'TT9', userId: 'u_rana' });
    s.money('the rest of the opening balance', r2.toOpening, 2000);
    s.money('then the oldest invoice', r2.allocated, 2000);
    s.money('and what is left is an advance, not dropped', r2.advance, 500);
    s.money('the customer is 500 ahead', customerDue(db, 'cu4'), -500);
    s.money(
      'the invoice is settled',
      (db.prepare('SELECT due FROM sales WHERE id = ?').get(credit.id) as { due: number }).due,
      0,
    );
    const ledger = customerLedger(db, 'cu4');
    s.money('the khata ends at the same balance', ledger[ledger.length - 1]?.balance ?? NaN, -500);
    s.eq('with both payments on account in it', ledger.filter((e) => e.reference.includes('on account')).length, 2);

    // Picked mode: the chosen invoice first, the rest to the account.
    const second = createSale(db, {
      userId: 'u_admin',
      customerId: 'cu4',
      lines: [{ productId: 'p1', qty: 2, spr: 500 }],
      payments: [],
    });
    refuses(
      s,
      'more than an invoice owes cannot be applied to it',
      () =>
        receiveCustomerPayment(db, {
          partyId: 'cu4',
          amount: 2000,
          method: 'Cash',
          userId: 'u_rana',
          allocations: [{ docId: second.id, amount: 1500 }],
        }),
      /owing/,
    );
    const other = createSale(db, {
      userId: 'u_admin',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 1, spr: 500 }],
      payments: [],
    });
    refuses(
      s,
      "another customer's invoice cannot be picked",
      () =>
        receiveCustomerPayment(db, {
          partyId: 'cu4',
          amount: 500,
          method: 'Cash',
          userId: 'u_rana',
          allocations: [{ docId: other.id, amount: 500 }],
        }),
      /not an open invoice/,
    );
    refuses(
      s,
      'picked amounts cannot add up to more than the payment',
      () =>
        receiveCustomerPayment(db, {
          partyId: 'cu4',
          amount: 300,
          method: 'Cash',
          userId: 'u_rana',
          allocations: [{ docId: second.id, amount: 800 }],
        }),
      /more than the payment/,
    );
    const r3 = receiveCustomerPayment(db, {
      partyId: 'cu4',
      amount: 1200,
      method: 'Cash',
      userId: 'u_rana',
      allocations: [{ docId: second.id, amount: 1000 }],
    });
    s.money('picked: the invoice gets what was chosen', r3.allocated, 1000);
    s.money('picked: the rest becomes an advance', r3.advance, 200);
    s.money('the customer is now 700 ahead', customerDue(db, 'cu4'), -700);

    refuses(s, 'a walk-in has no account to pay into', () =>
      receiveCustomerPayment(db, { partyId: 'cu1', amount: 100, method: 'Cash', userId: 'u_rana' }),
    /walk-in/);
    refuses(s, 'a payment of zero is refused', () =>
      receiveCustomerPayment(db, { partyId: 'cu4', amount: 0, method: 'Cash', userId: 'u_rana' }),
    /more than zero/);
    refuses(s, 'an unknown customer is refused', () =>
      receiveCustomerPayment(db, { partyId: 'cu_nope', amount: 10, method: 'Cash', userId: 'u_rana' }),
    /does not exist/);

    // NOTHING LOST: every taka received is on an invoice or on the account.
    const onInvoices = (
      db
        .prepare(
          `SELECT COALESCE(SUM(p.amount),0) AS s FROM sale_payments p JOIN sales sa ON sa.id = p.sale_id
            WHERE sa.customer_id = 'cu4'`,
        )
        .get() as { s: number }
    ).s;
    const onAccount = (
      db
        .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM account_payments WHERE party_type = 'customer' AND party_id = 'cu4'")
        .get() as { s: number }
    ).s;
    s.money('every taka received is recorded somewhere', round2(onInvoices + onAccount), 3000 + 4500 + 1200);

    // The payment report counts money on account too.
    const report = reportSellPayments(db, { preset: 'today' });
    s.ok(
      'the sell payment report includes payments on account',
      report.total >= 3000 + 4500 + 1200 - 0.005,
    );

    // Supplier side: sp5 starts with an opening balance of 8,000.
    const bill = createPurchase(db, {
      userId: 'u_admin',
      supplierId: 'sp5',
      lines: [{ productId: 'p19', qty: 5, unitCostBeforeDisc: 600, taxPct: 0 }],
      payments: [],
    });
    s.money('supplier opening 8,000 + a 3,000 bill', supplierDue(db, 'sp5'), 11000);
    const paid = paySupplier(db, { supplierId: 'sp5', amount: 10000, method: 'Bank', userId: 'u_admin' });
    s.money('the supplier opening balance is paid first', paid.toOpening, 8000);
    s.money('then the bill', paid.allocated, 2000);
    s.money('the payable is what is left', supplierDue(db, 'sp5'), 1000);
    s.money(
      'the bill shows the part paid',
      (db.prepare('SELECT due FROM purchases WHERE id = ?').get(bill.id) as { due: number }).due,
      1000,
    );
    const sl = supplierLedger(db, 'sp5');
    s.money('the supplier khata ends at the payable', sl[sl.length - 1]?.balance ?? NaN, supplierDue(db, 'sp5'));
    s.ok('and shows the payment on account', sl.some((e) => e.reference.includes('on account')));
    db.close();
  }

  // ------------------------------------------------------- R33–R35 migrations
  s.section('chain-migrations');
  {
    const db = fresh();
    const versions = () =>
      (db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[])
        .map((r) => r.version)
        .join(',');
    s.eq('a fresh database is at the current data version', schemaVersionOf(db), CURRENT_SCHEMA_VERSION);
    s.eq('with every step recorded', versions(), Array.from({ length: CURRENT_SCHEMA_VERSION }, (_, i) => i + 1).join(','));
    const cols = (t: string) =>
      new Set((db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name));
    s.ok('v11: account_payments exists', cols('account_payments').has('party_id'));
    s.ok('v11: cash_shifts.closed_by exists', cols('cash_shifts').has('closed_by'));
    s.ok(
      'v11: the lookup indexes exist',
      !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_purchase_payments_purchase'").get(),
    );

    // v10 must not run again just because a LATER step is missing.
    const pur = createPurchase(db, {
      userId: 'u_admin',
      supplierId: 'sp2',
      lines: [{ productId: 'p1', qty: 5, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [],
    });
    createPurchaseReturn(db, {
      purchaseId: pur.id,
      userId: 'u_admin',
      refundMethod: 'CreditAdjust',
      lines: [{ productId: 'p1', qty: 1, unitCost: 400, refundAmount: 400 }],
    });
    db.prepare('UPDATE purchases SET credited = 0 WHERE id = ?').run(pur.id); // a marker
    db.prepare('DELETE FROM schema_migrations WHERE version = 11').run();
    migrate(db);
    const credited = (db.prepare('SELECT credited AS c FROM purchases WHERE id = ?').get(pur.id) as { c: number }).c;
    s.money('only the missing step runs; v10 is not re-applied', credited, 0);
    s.eq('and the missing step is recorded again', schemaVersionOf(db), CURRENT_SCHEMA_VERSION);

    // A step that fails rolls back completely and is NOT recorded.
    db.prepare('DELETE FROM schema_migrations WHERE version = 10').run();
    db.exec("CREATE TRIGGER boom BEFORE UPDATE ON purchases BEGIN SELECT RAISE(ABORT, 'disk said no'); END;");
    refuses(s, 'a failing backfill stops the migration (it used to be swallowed)', () => migrate(db), /disk said no/);
    s.ok('the failed step is not recorded', !versions().split(',').includes('10'));
    db.exec('DROP TRIGGER boom');
    migrate(db);
    s.ok('the next start retries it', versions().split(',').includes('10'));
    s.money(
      'and its backfill lands',
      (db.prepare('SELECT credited AS c FROM purchases WHERE id = ?').get(pur.id) as { c: number }).c,
      400,
    );

    // A database from a NEWER build is refused before anything is written.
    db.prepare('INSERT INTO schema_migrations(version, name) VALUES (?, ?)').run(CURRENT_SCHEMA_VERSION + 1, 'future');
    const salesBefore = count(db, 'SELECT COUNT(*) c FROM sales');
    refuses(s, 'a database from a newer version is refused with a clear message', () => migrate(db), /newer version/);
    s.eq('and nothing in it changed', count(db, 'SELECT COUNT(*) c FROM sales'), salesBefore);
    db.close();
  }
  {
    // A file database gets a copy beside it before an upgrade.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-mig-'));
    const file = path.join(dir, 'pos.db');
    const a = openDatabase(file);
    migrate(a);
    // Take the database back one step, as though an older build wrote it.
    a.prepare('DELETE FROM schema_migrations WHERE version = ?').run(CURRENT_SCHEMA_VERSION);
    a.close();
    const b = openDatabase(file);
    migrate(b);
    b.close();
    const copies = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(`pos.db.pre-v${CURRENT_SCHEMA_VERSION - 1}-`) && f.endsWith('.sqlite3'));
    s.eq('an upgrade first copies the database beside it', copies.length, 1);
    const c = openDatabase(file);
    migrate(c);
    c.close();
    s.eq(
      'a start with nothing to upgrade makes no copy',
      fs.readdirSync(dir).filter((f) => f.includes('.pre-v')).length,
      1,
    );
    // A snapshot from a newer build is refused by the restore check.
    const future = path.join(dir, 'future.sqlite3');
    const d = openDatabase(future);
    migrate(d);
    d.prepare('INSERT INTO schema_migrations(version, name) VALUES (?, ?)').run(CURRENT_SCHEMA_VERSION + 1, 'future');
    d.close();
    const check = verifySnapshot(future);
    s.ok('a backup from a newer version is refused before restore', !check.ok && /newer version/.test(check.error ?? ''));
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // ------------------------------------------------------------------ F10
  s.section('chain-transfers');
  {
    const db = fresh();
    const both = () => round2(stockOnHand(db, 'p1', 'br_mp') + stockOnHand(db, 'p1', 'br_ut'));
    const total0 = both();
    refuses(s, 'a transfer to the same branch is refused', () =>
      createTransfer(db, { fromBranch: 'br_mp', toBranch: 'br_mp', lines: [{ productId: 'p1', qty: 5 }], createdBy: 'u_admin' }),
    /two different branches/);
    refuses(s, 'a transfer of zero is refused', () =>
      createTransfer(db, { fromBranch: 'br_mp', toBranch: 'br_ut', lines: [{ productId: 'p1', qty: 0 }], createdBy: 'u_admin' }),
    );

    const t = createTransfer(db, {
      fromBranch: 'br_mp',
      toBranch: 'br_ut',
      status: 'in-transit',
      lines: [{ productId: 'p1', qty: 20 }],
      createdBy: 'u_admin',
    });
    refuses(s, 'more cannot arrive than was sent', () =>
      receiveTransfer(db, t.id, [{ productId: 'p1', receivedQty: 25 }], 'u_admin'),
    /cannot arrive/);
    refuses(s, 'a negative arrival is refused', () =>
      receiveTransfer(db, t.id, [{ productId: 'p1', receivedQty: -1 }], 'u_admin'),
    );
    const utBefore = stockOnHand(db, 'p1', 'br_ut');
    receiveTransfer(db, t.id, [{ productId: 'p1', receivedQty: 18 }], 'u_admin');
    s.money('18 of 20 arrived', stockOnHand(db, 'p1', 'br_ut'), round2(utBefore + 18));
    refuses(s, 'a received transfer cannot be received again', () =>
      receiveTransfer(db, t.id, [{ productId: 'p1', receivedQty: 18 }], 'u_admin'),
    /already been received/);
    s.money('so the destination did not double', stockOnHand(db, 'p1', 'br_ut'), round2(utBefore + 18));
    refuses(s, 'a received transfer cannot be cancelled', () => cancelTransfer(db, t.id, 'u_admin', 'x'), /already been received/);
    s.money('the 2 lost in transit are the only difference across branches', both(), round2(total0 - 2));

    // Two lines of the same product: the received figure is filled in order.
    const two = createTransfer(db, {
      fromBranch: 'br_mp',
      toBranch: 'br_ut',
      lines: [
        { productId: 'p1', qty: 3 },
        { productId: 'p1', qty: 4 },
      ],
      createdBy: 'u_admin',
    });
    const ut2 = stockOnHand(db, 'p1', 'br_ut');
    receiveTransfer(db, two.id, [{ productId: 'p1', receivedQty: 5 }], 'u_admin');
    s.money('5 of 7 arrived across two lines — not 5 on each', stockOnHand(db, 'p1', 'br_ut'), round2(ut2 + 5));

    // Cancel sends the goods back.
    const mpBefore = stockOnHand(db, 'p1', 'br_mp');
    const c = createTransfer(db, {
      fromBranch: 'br_mp',
      toBranch: 'br_ut',
      lines: [{ productId: 'p1', qty: 10 }],
      createdBy: 'u_admin',
    });
    s.money('dispatch takes 10 from the source', stockOnHand(db, 'p1', 'br_mp'), round2(mpBefore - 10));
    const utC = stockOnHand(db, 'p1', 'br_ut');
    cancelTransfer(db, c.id, 'u_admin', 'wrong branch');
    s.money('cancelling puts all 10 back at the source', stockOnHand(db, 'p1', 'br_mp'), mpBefore);
    s.money('and nothing ever reached the destination', stockOnHand(db, 'p1', 'br_ut'), utC);
    s.eq(
      'the transfer is marked cancelled',
      (db.prepare('SELECT status FROM stock_transfers WHERE id = ?').get(c.id) as { status: string }).status,
      'cancelled',
    );
    s.eq(
      'the reversal is an appended movement, not a deletion',
      count(db, "SELECT COUNT(*) c FROM stock_movements WHERE ref_id = ? AND reason IN ('transfer_out','transfer_cancel')", c.id),
      2,
    );
    refuses(s, 'a cancelled transfer cannot be received', () =>
      receiveTransfer(db, c.id, [{ productId: 'p1', receivedQty: 10 }], 'u_admin'),
    /cancelled/);
    const mpAfter = stockOnHand(db, 'p1', 'br_mp');
    cancelTransfer(db, c.id, 'u_admin', 'again');
    s.money('cancelling twice changes nothing', stockOnHand(db, 'p1', 'br_mp'), mpAfter);
    db.close();
  }
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('verify/chain.ts');
if (isMain) {
  const s = new Suite();
  runChain(s);
  const rep = s.report();
  console.log(`CHAIN: ${rep.passed}/${rep.total} checks`);
  if (rep.failed > 0) {
    for (const f of rep.failures) console.log(`   - ${f.name}: ${f.detail ?? ''}`);
    process.exit(1);
  }
  console.log('ALL CHAIN CHECKS PASSED');
}
