/**
 * TARGETED SCENARIO TESTS
 * Each test builds a tiny, fully-controlled DB and asserts exact expected
 * numbers for one operation. Complements run.ts (which validates the big
 * simulated dataset's identities). Run independently or imported.
 */
import { openDatabase, migrate, type DB } from '../db/connection.ts';
import { seedMaster } from '../seed/master.ts';
import { Suite } from './assert.ts';
import { round2 } from '../core/money.ts';
import { recordMovement, stockOnHand, weightedAvgCost } from '../services/stock.ts';
import { createSale, addSalePayment, voidSale, deleteSale } from '../services/sales.ts';
import { createPurchase, addPurchasePayment, cancelPurchase, deletePurchase } from '../services/purchases.ts';
import { createSellReturn, createPurchaseReturn } from '../services/returns.ts';
import { createShipment, updateShipment, deleteShipment } from '../services/shipments.ts';
import { createTransfer, receiveTransfer, createAdjustment } from '../services/stockOps.ts';
import { createExpense } from '../services/expenses.ts';
import {
  updateExpense,
  voidExpense,
  deleteExpense,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} from '../services/expenses.ts';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  createWarranty,
  updateWarranty,
  deleteWarranty,
  createPriceGroup,
  updatePriceGroup,
  deletePriceGroup,
} from '../services/catalog.ts';
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  paySupplier,
} from '../services/contacts.ts';
import { openShift, closeShift, shiftTotals, getOpenShift } from '../services/cash.ts';
import { customerDue, supplierDue } from '../services/ledger.ts';
import {
  updateBusinessInfo,
  createBranch,
  updateBranch,
  setDefaultBranch,
  deleteBranch,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
  createAgent,
  updateAgent,
  deleteAgent,
  createUser,
  updateUser,
  deleteUser,
  createRole,
  updateRole,
  deleteRole,
  getSetting,
  setSetting,
  getAllSettings,
} from '../services/settings.ts';
import { listAgents, listWarranties, listPriceGroups, listShipments } from '../services/queries.ts';
import {
  hashSecret,
  verifySecret,
  authenticate,
  setUserSecret,
  verifyUserPin,
} from '../services/auth.ts';
import { completeSetup, setupStatus, isSetupComplete } from '../services/setup.ts';

function fresh(): DB {
  const db = openDatabase(':memory:');
  migrate(db);
  seedMaster(db);
  // opening stock for a couple of products at Mirpur
  recordMovement(db, { productId: 'p1', branchId: 'br_mp', reason: 'opening_stock', qty: 100, unitCost: 380 });
  recordMovement(db, { productId: 'p19', branchId: 'br_mp', reason: 'opening_stock', qty: 200, unitCost: 480 });
  return db;
}

export function runScenarios(s: Suite) {
  // ---------- Scenario A: weighted average cost ----------
  s.section('scenario-wac');
  {
    const db = fresh();
    // p1 opening: 100 @ 380. Purchase 50 @ 420 -> WAC = (100*380 + 50*420)/150 = 393.33
    createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 50, unitCostBeforeDisc: 420, taxPct: 0 }],
      payments: [{ method: 'Bank', amount: 21000 }],
    });
    const wac = weightedAvgCost(db, 'p1');
    s.money('WAC blends opening + purchase', wac, round2((100 * 380 + 50 * 420) / 150));
    s.money('stock after purchase', stockOnHand(db, 'p1', 'br_mp'), 150);
    db.close();
  }

  // ---------- Scenario B: sale uses WAC as COGS, profit exact ----------
  s.section('scenario-cogs');
  {
    const db = fresh();
    // sell 10 of p1 @ 520; cost = opening WAC = 380; cogs = 3800; revenue 5200; profit 1400
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 10, spr: 520 }],
      payments: [{ method: 'Cash', amount: 5200 }],
    });
    s.money('sale total', sale.totals.total, 5200);
    s.money('sale cogs (10 @ 380)', sale.cogs, 3800);
    s.money('sale profit', sale.profit, 1400);
    s.money('sale due (fully paid)', sale.due, 0);
    s.money('stock reduced', stockOnHand(db, 'p1', 'br_mp'), 90);
    db.close();
  }

  // ---------- Scenario C: partial payment + add payment ----------
  s.section('scenario-payments');
  {
    const db = fresh();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_rana',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 10, spr: 520 }],
      payments: [{ method: 'Cash', amount: 2000 }],
    });
    s.money('partial due', sale.due, 3200);
    s.money('customer due after partial sale', customerDue(db, 'cu2'), 3200);
    const after = addSalePayment(db, sale.id, { method: 'bKash', amount: 3200, reference: 'BK1' }, 'u_rana');
    s.money('due cleared after 2nd payment', after.due, 0);
    s.money('customer due cleared', customerDue(db, 'cu2'), 0);
    db.close();
  }

  // ---------- Scenario D: overpayment clamps due to 0 ----------
  s.section('scenario-overpay');
  {
    const db = fresh();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 1, spr: 520 }],
      payments: [{ method: 'Cash', amount: 600 }], // overpay (change scenario)
    });
    s.money('overpay due is 0 not negative', sale.due, 0);
    db.close();
  }

  // ---------- Scenario E: sell return restores stock + store credit ----------
  s.section('scenario-sell-return');
  {
    const db = fresh();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_rana',
      customerId: 'cu5',
      lines: [{ productId: 'p1', qty: 10, spr: 520 }],
      payments: [{ method: 'Cash', amount: 5200 }],
    });
    s.money('stock after sale', stockOnHand(db, 'p1', 'br_mp'), 90);
    createSellReturn(db, {
      saleId: sale.id,
      branchId: 'br_mp',
      userId: 'u_rana',
      refundMethod: 'StoreCredit',
      lines: [{ productId: 'p1', qty: 4, unitPrice: 520, refundAmount: 2080 }],
    });
    s.money('stock restored by return', stockOnHand(db, 'p1', 'br_mp'), 94);
    const credit = db.prepare('SELECT store_credit FROM customers WHERE id = ?').get('cu5') as { store_credit: number };
    s.money('store credit added', credit.store_credit, 2080);
    db.close();
  }

  // ---------- Scenario F: CreditAdjust return reduces due ----------
  s.section('scenario-credit-return');
  {
    const db = fresh();
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_rana',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 10, spr: 520 }],
      payments: [], // full credit
    });
    s.money('due = full total', customerDue(db, 'cu2'), 5200);
    createSellReturn(db, {
      saleId: sale.id,
      branchId: 'br_mp',
      userId: 'u_rana',
      refundMethod: 'CreditAdjust',
      lines: [{ productId: 'p1', qty: 2, unitPrice: 520, refundAmount: 1040 }],
    });
    s.money('due reduced by credit-adjust return', customerDue(db, 'cu2'), 4160);
    db.close();
  }

  // ---------- Scenario G: purchase return reduces stock + supplier due ----------
  s.section('scenario-purchase-return');
  {
    const db = fresh();
    const pur = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 50, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [],
    });
    s.money('supplier due after credit purchase', supplierDue(db, 'sp1'), pur.totals.total);
    s.money('stock after purchase', stockOnHand(db, 'p1', 'br_mp'), 150);
    createPurchaseReturn(db, {
      purchaseId: pur.id,
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      refundMethod: 'CreditAdjust',
      lines: [{ productId: 'p1', qty: 10, unitCost: 400, refundAmount: 4000 }],
    });
    s.money('stock reduced by purchase return', stockOnHand(db, 'p1', 'br_mp'), 140);
    s.money('supplier due reduced by credit return', supplierDue(db, 'sp1'), round2(pur.totals.total - 4000));
    db.close();
  }

  // ---------- Scenario H: transfer moves stock between branches ----------
  s.section('scenario-transfer');
  {
    const db = fresh();
    const mpBefore = stockOnHand(db, 'p1', 'br_mp');
    const utBefore = stockOnHand(db, 'p1', 'br_ut');
    const t = createTransfer(db, {
      fromBranch: 'br_mp',
      toBranch: 'br_ut',
      status: 'in-transit',
      lines: [{ productId: 'p1', qty: 30 }],
      createdBy: 'u_admin',
    });
    s.money('source reduced immediately on dispatch', stockOnHand(db, 'p1', 'br_mp'), mpBefore - 30);
    s.money('destination not yet increased', stockOnHand(db, 'p1', 'br_ut'), utBefore);
    receiveTransfer(db, t.id, [{ productId: 'p1', receivedQty: 30 }], 'u_faruq');
    s.money('destination increased on receive', stockOnHand(db, 'p1', 'br_ut'), utBefore + 30);
    // conservation: total across branches unchanged
    s.money('total stock conserved across transfer', stockOnHand(db, 'p1'), mpBefore + utBefore);
    db.close();
  }

  // ---------- Scenario I: adjustment (damage) reduces stock + value signed ----------
  s.section('scenario-adjustment');
  {
    const db = fresh();
    const before = stockOnHand(db, 'p1', 'br_mp');
    createAdjustment(db, {
      branchId: 'br_mp',
      type: 'damage',
      lines: [{ productId: 'p1', qty: -5, unitCost: 380 }],
      createdBy: 'u_admin',
    });
    s.money('damage reduces stock', stockOnHand(db, 'p1', 'br_mp'), before - 5);
    db.close();
  }

  // ---------- Scenario J: cash drawer end-to-end ----------
  s.section('scenario-cash');
  {
    const db = fresh();
    const shiftId = openShift(db, { branchId: 'br_mp', userId: 'u_rana', openingCash: 5000 });
    // cash sale 5200
    createSale(db, {
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 10, spr: 520 }],
      payments: [{ method: 'Cash', amount: 5200 }],
    });
    // cash expense 1000
    createExpense(db, { branchId: 'br_mp', userId: 'u_admin', amount: 1000, paymentMethod: 'Cash', categoryId: 'ec_misc' });
    // non-cash sale should NOT affect drawer
    createSale(db, {
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 1, spr: 520 }],
      payments: [{ method: 'bKash', amount: 520, reference: 'BK9' }],
    });
    const t = shiftTotals(db, shiftId);
    // expected = 5000 + 5200 - 1000 = 9200
    s.money('drawer cash-in (sales only)', t.cashIn, 5200);
    s.money('drawer cash-out (expense)', t.cashOut, 1000);
    s.money('drawer expected', t.expected, 9200);
    const close = closeShift(db, { shiftId, countedCash: 9150 });
    s.money('variance = counted - expected', close.variance, -50);
    const open = getOpenShift(db, 'br_mp');
    s.ok('shift closed', open === undefined);
    db.close();
  }

  // ---------- Scenario K: draft/quotation do NOT touch stock ----------
  s.section('scenario-draft');
  {
    const db = fresh();
    const before = stockOnHand(db, 'p1', 'br_mp');
    createSale(db, {
      status: 'draft',
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 10, spr: 520 }],
    });
    s.money('draft does not reduce stock', stockOnHand(db, 'p1', 'br_mp'), before);
    createSale(db, {
      status: 'quotation',
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 10, spr: 520 }],
    });
    s.money('quotation does not reduce stock', stockOnHand(db, 'p1', 'br_mp'), before);
    db.close();
  }

  // ---------- Scenario L: void reverses everything ----------
  s.section('scenario-void');
  {
    const db = fresh();
    const shiftId = openShift(db, { branchId: 'br_mp', userId: 'u_rana', openingCash: 5000 });
    const before = stockOnHand(db, 'p1', 'br_mp');
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 10, spr: 520 }],
      payments: [{ method: 'Cash', amount: 5200 }],
    });
    const drawerAfterSale = shiftTotals(db, shiftId).expected;
    s.money('drawer after cash sale', drawerAfterSale, 10200);
    voidSale(db, sale.id, 'u_admin', 'mistake');
    s.money('stock restored after void', stockOnHand(db, 'p1', 'br_mp'), before);
    s.money('drawer cash reversed after void', shiftTotals(db, shiftId).expected, 5000);
    db.close();
  }

  // ---------- Scenario M: product create / update / delete ----------
  s.section('scenario-catalog');
  {
    const db = fresh();
    // create with opening stock
    const { id } = createProduct(db, {
      sku: 'TEST-001',
      name: 'Test Widget',
      categoryId: 'c1',
      brandId: 'b8',
      cost: 100,
      price: 150,
      reorderLevel: 5,
      openingStock: 40,
      branchId: 'br_mp',
      userId: 'u_admin',
    });
    s.money('created product has opening stock', stockOnHand(db, id, 'br_mp'), 40);
    const created = db.prepare('SELECT name, price FROM products WHERE id = ?').get(id) as { name: string; price: number };
    s.eq('product name persisted', created.name, 'Test Widget');
    s.money('product price persisted', created.price, 150);
    // FTS finds it
    const found = db.prepare("SELECT product_id FROM fts_products WHERE fts_products MATCH 'widget'").all();
    s.gt('new product searchable in FTS', found.length, 0);

    // update price
    updateProduct(db, id, { price: 175, name: 'Test Widget v2' });
    const updated = db.prepare('SELECT name, price FROM products WHERE id = ?').get(id) as { name: string; price: number };
    s.money('product price updated', updated.price, 175);
    s.eq('product name updated', updated.name, 'Test Widget v2');
    // FTS reflects new name
    const found2 = db.prepare("SELECT product_id FROM fts_products WHERE fts_products MATCH 'v2'").all();
    s.gt('FTS updated on rename', found2.length, 0);

    // delete blocked while stock remains
    let blocked = false;
    try {
      deleteProduct(db, id);
    } catch {
      blocked = true;
    }
    s.ok('delete blocked while stock remains', blocked);

    // delete blocked once it has document history (adjustment)
    createAdjustment(db, {
      branchId: 'br_mp',
      type: 'recount',
      lines: [{ productId: id, qty: -40, unitCost: 100 }],
      createdBy: 'u_admin',
    });
    s.money('stock zeroed', stockOnHand(db, id, 'br_mp'), 0);
    let blockedByHistory = false;
    try {
      deleteProduct(db, id);
    } catch {
      blockedByHistory = true;
    }
    s.ok('delete blocked by document history', blockedByHistory);

    // a clean product (no stock, no history) deletes successfully
    const clean = createProduct(db, {
      sku: 'TEST-CLEAN',
      name: 'Disposable Item',
      cost: 10,
      price: 20,
    });
    deleteProduct(db, clean.id);
    const gone = db.prepare('SELECT COUNT(*) c FROM products WHERE id = ?').get(clean.id) as { c: number };
    s.eq('clean product deleted', gone.c, 0);
    db.close();
  }

  // ---------- Scenario N: cancel purchase reverses stock-in AND cash ----------
  s.section('scenario-purchase-cancel');
  {
    const db = fresh();
    // Open a shift so the supplier cash payment (and its later reversal) have a
    // drawer to land in. p1 opening stock = 100 @ 380.
    const shiftId = openShift(db, { branchId: 'br_mp', userId: 'u_admin', openingCash: 50000 });
    const stockBefore = stockOnHand(db, 'p1', 'br_mp');
    const dueBefore = supplierDue(db, 'sp1');
    const drawerBefore = shiftTotals(db, shiftId).expected;

    // received purchase: 50 @ 400 = 20000, fully paid in cash
    const pur = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 50, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [{ method: 'Cash', amount: 20000 }],
    });
    s.money('stock raised by received purchase', stockOnHand(db, 'p1', 'br_mp'), stockBefore + 50);
    s.money('supplier due 0 after full cash payment', supplierDue(db, 'sp1'), dueBefore);
    s.money('drawer reduced by supplier cash payment', shiftTotals(db, shiftId).expected, drawerBefore - 20000);

    // cancel — must reverse stock-in and the cash paid in cash
    cancelPurchase(db, pur.id, 'u_admin', 'wrong order');
    const status = (db.prepare('SELECT status FROM purchases WHERE id = ?').get(pur.id) as { status: string }).status;
    s.eq('purchase marked cancelled', status, 'cancelled');
    s.money('stock-in reversed on cancel', stockOnHand(db, 'p1', 'br_mp'), stockBefore);
    s.money('supplier due consistent after cancel', supplierDue(db, 'sp1'), dueBefore);
    s.money('drawer cash restored after cancel', shiftTotals(db, shiftId).expected, drawerBefore);

    // idempotent: cancelling again must not double-reverse stock or cash
    cancelPurchase(db, pur.id, 'u_admin', 'again');
    s.money('re-cancel does not change stock', stockOnHand(db, 'p1', 'br_mp'), stockBefore);
    s.money('re-cancel does not change drawer', shiftTotals(db, shiftId).expected, drawerBefore);
    db.close();
  }

  // ---------- Scenario O: delete purchase guard/behavior ----------
  s.section('scenario-purchase-delete');
  {
    const db = fresh();
    const stockBefore = stockOnHand(db, 'p1', 'br_mp');

    // received purchase cannot be deleted (would orphan a stock-in) — must throw
    const received = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 20, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [],
    });
    let blocked = false;
    try {
      deletePurchase(db, received.id);
    } catch {
      blocked = true;
    }
    s.ok('delete blocked for received purchase', blocked);
    s.ok('received purchase still present', !!db.prepare('SELECT id FROM purchases WHERE id = ?').get(received.id));

    // ordered purchase never touched stock — safe to delete, stock unaffected
    const ordered = createPurchase(db, {
      status: 'ordered',
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [],
    });
    s.money('ordered purchase does not affect stock', stockOnHand(db, 'p1', 'br_mp'), stockBefore + 20);
    deletePurchase(db, ordered.id);
    const goneOrdered = db.prepare('SELECT COUNT(*) c FROM purchases WHERE id = ?').get(ordered.id) as { c: number };
    s.eq('ordered purchase deleted', goneOrdered.c, 0);
    s.money('stock unchanged by ordered delete', stockOnHand(db, 'p1', 'br_mp'), stockBefore + 20);

    // a cancelled purchase is deletable (stock already reversed on cancel)
    cancelPurchase(db, received.id, 'u_admin', 'voided then purge');
    s.money('stock reversed when received purchase cancelled', stockOnHand(db, 'p1', 'br_mp'), stockBefore);
    deletePurchase(db, received.id);
    const goneCancelled = db.prepare('SELECT COUNT(*) c FROM purchases WHERE id = ?').get(received.id) as { c: number };
    s.eq('cancelled purchase deleted', goneCancelled.c, 0);
    // cascade removed its lines too
    const lines = db.prepare('SELECT COUNT(*) c FROM purchase_lines WHERE purchase_id = ?').get(received.id) as { c: number };
    s.eq('deleted purchase cascades to lines', lines.c, 0);
    db.close();
  }

  // ---------- Scenario P: delete sale guard/behavior ----------
  s.section('scenario-sale-delete');
  {
    const db = fresh();
    const stockBefore = stockOnHand(db, 'p1', 'br_mp');

    // a draft never touched stock — safe to delete; lines cascade away
    const draft = createSale(db, {
      status: 'draft',
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 5, spr: 520 }],
    });
    s.money('draft does not affect stock', stockOnHand(db, 'p1', 'br_mp'), stockBefore);
    const draftLinesBefore = db.prepare('SELECT COUNT(*) c FROM sale_lines WHERE sale_id = ?').get(draft.id) as { c: number };
    s.gt('draft has lines before delete', draftLinesBefore.c, 0);
    deleteSale(db, draft.id);
    const goneDraft = db.prepare('SELECT COUNT(*) c FROM sales WHERE id = ?').get(draft.id) as { c: number };
    s.eq('draft sale deleted', goneDraft.c, 0);
    const draftLinesAfter = db.prepare('SELECT COUNT(*) c FROM sale_lines WHERE sale_id = ?').get(draft.id) as { c: number };
    s.eq('deleted draft cascades to lines', draftLinesAfter.c, 0);
    s.money('stock unchanged by draft delete', stockOnHand(db, 'p1', 'br_mp'), stockBefore);

    // a final sale cannot be deleted — must throw and remain present
    const finalSale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 3, spr: 520 }],
      payments: [{ method: 'Cash', amount: 1560 }],
    });
    let blocked = false;
    try {
      deleteSale(db, finalSale.id);
    } catch {
      blocked = true;
    }
    s.ok('delete blocked for final sale', blocked);
    s.ok('final sale still present', !!db.prepare('SELECT id FROM sales WHERE id = ?').get(finalSale.id));

    // a quotation can be deleted too
    const quote = createSale(db, {
      status: 'quotation',
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 8, spr: 520 }],
      validUntil: '2026-12-31',
    });
    deleteSale(db, quote.id);
    const goneQuote = db.prepare('SELECT COUNT(*) c FROM sales WHERE id = ?').get(quote.id) as { c: number };
    s.eq('quotation sale deleted', goneQuote.c, 0);
    db.close();
  }

  // ---------- Scenario Q: contacts CRUD + FTS + delete guards ----------
  s.section('scenario-contacts-crud');
  {
    const db = fresh();

    // --- customer create / FTS / update / delete (clean) ---
    const cust = createCustomer(db, {
      name: 'Rahim Traders',
      phone: '01711000000',
      group: 'Wholesale',
      openingBalance: 0,
      userId: 'u_admin',
    });
    const custRow = db.prepare('SELECT name, price_group FROM customers WHERE id = ?').get(cust.id) as {
      name: string;
      price_group: string;
    };
    s.eq('customer created', custRow.name, 'Rahim Traders');
    s.eq('group alias mapped to price_group', custRow.price_group, 'Wholesale');
    const cFound = db.prepare("SELECT customer_id FROM fts_customers WHERE fts_customers MATCH 'Rahim'").all();
    s.gt('new customer searchable in FTS', cFound.length, 0);

    updateCustomer(db, cust.id, { name: 'Rahim Brothers' });
    const cFound2 = db.prepare("SELECT customer_id FROM fts_customers WHERE fts_customers MATCH 'Brothers'").all();
    s.gt('FTS updated on customer rename', cFound2.length, 0);

    deleteCustomer(db, cust.id);
    const cGone = db.prepare('SELECT COUNT(*) c FROM customers WHERE id = ?').get(cust.id) as { c: number };
    s.eq('clean customer deleted', cGone.c, 0);
    const cFtsGone = db.prepare("SELECT COUNT(*) c FROM fts_customers WHERE customer_id = ?").get(cust.id) as { c: number };
    s.eq('customer fts row removed on delete', cFtsGone.c, 0);

    // --- customer with sales history: delete blocked ---
    const custWithSale = createCustomer(db, { name: 'Has History Co', phone: '01722000000', userId: 'u_admin' });
    createSale(db, {
      branchId: 'br_mp',
      userId: 'u_rana',
      customerId: custWithSale.id,
      lines: [{ productId: 'p1', qty: 1, spr: 520 }],
      payments: [{ method: 'Cash', amount: 520 }],
    });
    let custBlocked = false;
    try {
      deleteCustomer(db, custWithSale.id);
    } catch {
      custBlocked = true;
    }
    s.ok('delete blocked: customer has sales history', custBlocked);
    s.ok('customer with history still present', !!db.prepare('SELECT id FROM customers WHERE id = ?').get(custWithSale.id));

    // --- supplier create / FTS / update / delete (clean) ---
    const sup = createSupplier(db, {
      name: 'Acme Imports',
      company: 'Acme Ltd',
      phone: '01811000000',
      userId: 'u_admin',
    });
    const supRow = db.prepare('SELECT name, company FROM suppliers WHERE id = ?').get(sup.id) as {
      name: string;
      company: string;
    };
    s.eq('supplier created', supRow.name, 'Acme Imports');
    const sFound = db.prepare("SELECT supplier_id FROM fts_suppliers WHERE fts_suppliers MATCH 'Acme'").all();
    s.gt('new supplier searchable in FTS', sFound.length, 0);

    updateSupplier(db, sup.id, { name: 'Acme Global' });
    const sFound2 = db.prepare("SELECT supplier_id FROM fts_suppliers WHERE fts_suppliers MATCH 'Global'").all();
    s.gt('FTS updated on supplier rename', sFound2.length, 0);

    deleteSupplier(db, sup.id);
    const sGone = db.prepare('SELECT COUNT(*) c FROM suppliers WHERE id = ?').get(sup.id) as { c: number };
    s.eq('clean supplier deleted', sGone.c, 0);

    // --- supplier with purchase history: delete blocked ---
    const supWithPur = createSupplier(db, { name: 'Active Vendor', phone: '01822000000', userId: 'u_admin' });
    createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: supWithPur.id,
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [],
    });
    let supBlocked = false;
    try {
      deleteSupplier(db, supWithPur.id);
    } catch {
      supBlocked = true;
    }
    s.ok('delete blocked: supplier has purchase history', supBlocked);
    s.ok('supplier with history still present', !!db.prepare('SELECT id FROM suppliers WHERE id = ?').get(supWithPur.id));
    db.close();
  }

  // ---------- Scenario R: paySupplier auto-allocates oldest-first ----------
  s.section('scenario-supplier-pay');
  {
    const db = fresh();
    const sup = createSupplier(db, { name: 'Allocate Co', phone: '01911000000', userId: 'u_admin' });

    // two open credit purchases (no payments) — bill1 older than bill2
    const bill1 = createPurchase(db, {
      date: '2026-01-01T10:00:00',
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: sup.id,
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400, taxPct: 0 }], // total 4000
      payments: [],
    });
    const bill2 = createPurchase(db, {
      date: '2026-02-01T10:00:00',
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: sup.id,
      lines: [{ productId: 'p1', qty: 5, unitCostBeforeDisc: 400, taxPct: 0 }], // total 2000
      payments: [],
    });
    s.money('bill1 total', bill1.totals.total, 4000);
    s.money('bill2 total', bill2.totals.total, 2000);
    const dueBefore = supplierDue(db, sup.id);
    s.money('supplier due before pay', dueBefore, 6000);

    // pay 5000: should clear bill1 (4000) then apply 1000 to bill2
    const res = paySupplier(db, {
      supplierId: sup.id,
      amount: 5000,
      method: 'Bank',
      reference: 'PAY-1',
      userId: 'u_admin',
      branchId: 'br_mp',
    });
    s.money('allocated equals amount (within open bills)', res.allocated, 5000);
    s.money('no remainder when bills cover amount', res.remainder, 0);
    s.money('supplier due dropped by paid amount', supplierDue(db, sup.id), round2(dueBefore - 5000));

    const b1 = db.prepare('SELECT paid, due FROM purchases WHERE id = ?').get(bill1.id) as { paid: number; due: number };
    const b2 = db.prepare('SELECT paid, due FROM purchases WHERE id = ?').get(bill2.id) as { paid: number; due: number };
    s.money('oldest bill fully paid', b1.paid, 4000);
    s.money('oldest bill due hits 0', b1.due, 0);
    s.money('next bill partially paid', b2.paid, 1000);
    s.money('next bill due reduced', b2.due, 1000);

    // overpay beyond open bills: remainder is NOT persisted (advance deferral)
    const res2 = paySupplier(db, {
      supplierId: sup.id,
      amount: 5000, // only 1000 of bill2 remains open
      method: 'Cash',
      userId: 'u_admin',
      branchId: 'br_mp',
    });
    s.money('allocated only what open bills could absorb', res2.allocated, 1000);
    s.money('remainder beyond open bills returned (not persisted)', res2.remainder, 4000);
    s.money('supplier due fully cleared', supplierDue(db, sup.id), 0);
    db.close();
  }

  // ---------- Scenario S: expense category CRUD (create/update/detach/null-ref) ----------
  s.section('scenario-expense-category-crud');
  {
    const db = fresh();

    // create a category — appears in the list
    const cat = createExpenseCategory(db, { name: 'Internet', emoji: '🌐', monthlyBudget: 3000 });
    const list1 = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(cat.id) as
      | { name: string; monthly_budget: number }
      | undefined;
    s.ok('expense category created', !!list1);
    s.eq('expense category name persisted', list1?.name ?? '', 'Internet');
    s.money('expense category budget persisted', list1?.monthly_budget ?? -1, 3000);

    // update the budget
    updateExpenseCategory(db, cat.id, { monthlyBudget: 5000 });
    const afterBudget = db.prepare('SELECT monthly_budget FROM expense_categories WHERE id = ?').get(cat.id) as {
      monthly_budget: number;
    };
    s.money('expense category budget updated', afterBudget.monthly_budget, 5000);

    // create a child, then delete the parent -> child is detached (parent_id NULL)
    const parent = createExpenseCategory(db, { name: 'Office', emoji: '🏢' });
    const child = createExpenseCategory(db, { name: 'Stationery', parentId: parent.id, emoji: '✏️' });
    const childBefore = db.prepare('SELECT parent_id FROM expense_categories WHERE id = ?').get(child.id) as {
      parent_id: string | null;
    };
    s.eq('child attached to parent before delete', childBefore.parent_id ?? '', parent.id);
    deleteExpenseCategory(db, parent.id);
    const parentGone = db.prepare('SELECT COUNT(*) c FROM expense_categories WHERE id = ?').get(parent.id) as {
      c: number;
    };
    s.eq('parent category deleted', parentGone.c, 0);
    const childAfter = db.prepare('SELECT parent_id FROM expense_categories WHERE id = ?').get(child.id) as {
      parent_id: string | null;
    };
    s.ok('child detached after parent delete', childAfter.parent_id === null);

    // deleting a category nulls out referencing expenses' category_id
    createExpense(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      amount: 500,
      paymentMethod: 'Bank',
      categoryId: cat.id,
    });
    const refBefore = db.prepare('SELECT COUNT(*) c FROM expenses WHERE category_id = ?').get(cat.id) as {
      c: number;
    };
    s.gt('expense references category before delete', refBefore.c, 0);
    deleteExpenseCategory(db, cat.id);
    const refAfter = db.prepare('SELECT COUNT(*) c FROM expenses WHERE category_id = ?').get(cat.id) as {
      c: number;
    };
    s.eq('referencing expense category nulled on delete', refAfter.c, 0);
    db.close();
  }

  // ---------- Scenario T: expense void / delete reverse the drawer ----------
  s.section('scenario-expense-void-delete');
  {
    const db = fresh();
    const shiftId = openShift(db, { branchId: 'br_mp', userId: 'u_admin', openingCash: 5000 });

    // a CASH expense drops the drawer by its amount
    const cashExp = createExpense(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      amount: 1200,
      paymentMethod: 'Cash',
      categoryId: 'ec_misc',
    });
    s.money('drawer drops by cash expense', shiftTotals(db, shiftId).expected, 5000 - 1200);

    // void it -> drawer restored, voided=1
    voidExpense(db, cashExp.id, 'mistake', 'u_admin');
    s.money('drawer restored after void', shiftTotals(db, shiftId).expected, 5000);
    const voidedRow = db.prepare('SELECT voided FROM expenses WHERE id = ?').get(cashExp.id) as { voided: number };
    s.eq('expense marked voided', voidedRow.voided, 1);

    // voiding again is idempotent (no second reversal)
    voidExpense(db, cashExp.id, 'again', 'u_admin');
    s.money('re-void does not change drawer', shiftTotals(db, shiftId).expected, 5000);

    // a second cash expense, then delete it -> drawer restored and row gone
    const cashExp2 = createExpense(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      amount: 800,
      paymentMethod: 'Cash',
      categoryId: 'ec_misc',
    });
    s.money('drawer drops by second cash expense', shiftTotals(db, shiftId).expected, 5000 - 800);
    deleteExpense(db, cashExp2.id);
    s.money('drawer restored after delete', shiftTotals(db, shiftId).expected, 5000);
    const goneRow = db.prepare('SELECT COUNT(*) c FROM expenses WHERE id = ?').get(cashExp2.id) as { c: number };
    s.eq('deleted expense row gone', goneRow.c, 0);

    // a non-cash (bKash) expense never touches the drawer; void is drawer-neutral
    const bkExp = createExpense(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      amount: 2500,
      paymentMethod: 'bKash',
      reference: 'BK77',
      categoryId: 'ec_salary',
    });
    s.money('non-cash expense leaves drawer unchanged', shiftTotals(db, shiftId).expected, 5000);
    voidExpense(db, bkExp.id, 'wrong', 'u_admin');
    s.money('voiding non-cash expense leaves drawer unchanged', shiftTotals(db, shiftId).expected, 5000);

    // sanity: open shift still open throughout
    s.ok('shift still open', !!getOpenShift(db, 'br_mp'));
    db.close();
  }

  // ---------- Scenario U: editing a cash expense's amount/method keeps the drawer exact ----------
  s.section('scenario-expense-update-drawer');
  {
    const db = fresh();
    const shiftId = openShift(db, { branchId: 'br_mp', userId: 'u_admin', openingCash: 10000 });

    // cash expense 1000 -> drawer 9000
    const exp = createExpense(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      amount: 1000,
      paymentMethod: 'Cash',
      categoryId: 'ec_misc',
    });
    s.money('drawer after cash expense', shiftTotals(db, shiftId).expected, 9000);

    // edit amount 1000 -> 1500: reverse old, apply new -> drawer 8500
    updateExpense(db, exp.id, { amount: 1500 });
    s.money('drawer reflects amount edit (reverse + reapply)', shiftTotals(db, shiftId).expected, 8500);
    const amt = db.prepare('SELECT amount FROM expenses WHERE id = ?').get(exp.id) as { amount: number };
    s.money('expense amount persisted on edit', amt.amount, 1500);

    // switch method Cash -> bKash: reverse the cash hit, no new cash-out -> drawer back to 10000
    updateExpense(db, exp.id, { paymentMethod: 'bKash' });
    s.money('drawer restored when method leaves Cash', shiftTotals(db, shiftId).expected, 10000);

    // switch method bKash -> Cash (amount 1500): drawer drops again -> 8500
    updateExpense(db, exp.id, { paymentMethod: 'Cash' });
    s.money('drawer drops when method returns to Cash', shiftTotals(db, shiftId).expected, 8500);
    db.close();
  }

  // ---------- Scenario V: settings CRUD (branches/tax/users/roles/agents/KV) ----------
  s.section('scenario-settings-crud');
  {
    const db = fresh();

    // --- business info partial update ---
    updateBusinessInfo(db, { name: 'New Hardware Co', email: 'shop@new.local' });
    const biz = db.prepare('SELECT name, email, tagline FROM business_info WHERE id = 1').get() as {
      name: string;
      email: string;
      tagline: string;
    };
    s.eq('business name updated', biz.name, 'New Hardware Co');
    s.eq('business email updated', biz.email, 'shop@new.local');
    s.eq('business untouched field preserved', biz.tagline, 'Built for the shop floor');

    // --- branch create / update / setDefault (only one default) ---
    const br = createBranch(db, { name: 'Gulshan Branch', code: 'BL9001' });
    const brRow = db.prepare('SELECT name, code, active FROM branches WHERE id = ?').get(br.id) as {
      name: string;
      code: string;
      active: number;
    };
    s.eq('branch created', brRow.name, 'Gulshan Branch');
    s.eq('branch active by default', brRow.active, 1);
    updateBranch(db, br.id, { manager: 'Karim' });
    const brMgr = db.prepare('SELECT manager FROM branches WHERE id = ?').get(br.id) as { manager: string };
    s.eq('branch manager updated', brMgr.manager, 'Karim');

    setDefaultBranch(db, br.id);
    const defCount = db.prepare('SELECT COUNT(*) c FROM branches WHERE is_default = 1').get() as { c: number };
    s.eq('exactly one default branch', defCount.c, 1);
    const defId = db.prepare('SELECT id FROM branches WHERE is_default = 1').get() as { id: string };
    s.eq('the new branch is the default', defId.id, br.id);

    // delete-guard: a branch with a sale cannot be deleted
    createSale(db, {
      branchId: br.id,
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 1, spr: 520 }],
      payments: [{ method: 'Cash', amount: 520 }],
    });
    let brBlocked = false;
    try {
      deleteBranch(db, br.id);
    } catch {
      brBlocked = true;
    }
    s.ok('delete blocked: branch has a sale', brBlocked);
    s.ok('branch with history still present', !!db.prepare('SELECT id FROM branches WHERE id = ?').get(br.id));

    // a clean branch (no history) deletes successfully
    const cleanBr = createBranch(db, { name: 'Temp Branch' });
    deleteBranch(db, cleanBr.id);
    const cleanGone = db.prepare('SELECT COUNT(*) c FROM branches WHERE id = ?').get(cleanBr.id) as { c: number };
    s.eq('clean branch deleted', cleanGone.c, 0);

    // --- tax rate create with is_default clears others ---
    const tax = createTaxRate(db, { name: 'VAT 7.5%', percentage: 7.5, isDefault: true });
    const defaultTaxes = db.prepare('SELECT COUNT(*) c FROM tax_rates WHERE is_default = 1').get() as { c: number };
    s.eq('exactly one default tax rate after create', defaultTaxes.c, 1);
    const newDefault = db.prepare('SELECT id FROM tax_rates WHERE is_default = 1').get() as { id: string };
    s.eq('the new tax rate is the default', newDefault.id, tax.id);
    updateTaxRate(db, 'tx_5', { isDefault: true });
    const defaultTaxes2 = db.prepare('SELECT COUNT(*) c FROM tax_rates WHERE is_default = 1').get() as { c: number };
    s.eq('still one default after update sets a different default', defaultTaxes2.c, 1);
    deleteTaxRate(db, tax.id);
    const taxGone = db.prepare('SELECT COUNT(*) c FROM tax_rates WHERE id = ?').get(tax.id) as { c: number };
    s.eq('tax rate deleted', taxGone.c, 0);

    // --- user create (username unique), update role, delete guards ---
    const newRole = createRole(db, { name: 'Auditor', permissions: ['reports.view'] });
    const user = createUser(db, {
      name: 'Test Cashier',
      username: 'testcashier',
      pin: '9999',
      roleId: 'role_cashier',
      branchIds: ['br_mp'],
    });
    const uRow = db.prepare('SELECT name, username, role_id, pin_hash, branch_ids FROM users WHERE id = ?').get(user.id) as {
      name: string;
      username: string;
      role_id: string;
      pin_hash: string;
      branch_ids: string;
    };
    s.eq('user created', uRow.username, 'testcashier');
    s.ok('user pin hashed with bcrypt in pin_hash ($2…)', uRow.pin_hash.startsWith('$2'));
    s.ok('user pin hash is not the plaintext pin', uRow.pin_hash !== '9999');
    s.ok('user pin hash verifies against plaintext', verifySecret('9999', uRow.pin_hash).match === true);
    s.eq('user branch_ids stored as JSON', uRow.branch_ids, JSON.stringify(['br_mp']));

    // username UNIQUE conflict throws friendly error
    let dupBlocked = false;
    try {
      createUser(db, { name: 'Dup', username: 'testcashier', roleId: 'role_cashier' });
    } catch {
      dupBlocked = true;
    }
    s.ok('duplicate username throws', dupBlocked);

    // update role assignment
    updateUser(db, user.id, { roleId: newRole.id });
    const uRole = db.prepare('SELECT role_id FROM users WHERE id = ?').get(user.id) as { role_id: string };
    s.eq('user role updated', uRole.role_id, newRole.id);

    // delete-guard: u_admin can never be deleted
    let adminBlocked = false;
    try {
      deleteUser(db, 'u_admin');
    } catch {
      adminBlocked = true;
    }
    s.ok('delete blocked: owner u_admin', adminBlocked);

    // delete-guard: last admin cannot be deleted (u_admin is the only admin)
    const adminCount = db.prepare("SELECT COUNT(*) c FROM users WHERE role_id = 'role_admin'").get() as { c: number };
    s.eq('only one admin in seed', adminCount.c, 1);

    // a clean user (no history) hard-deletes
    deleteUser(db, user.id);
    const userGone = db.prepare('SELECT COUNT(*) c FROM users WHERE id = ?').get(user.id) as { c: number };
    s.eq('clean user deleted', userGone.c, 0);

    // a user referenced by a sale is soft-deactivated, not deleted
    const refUser = createUser(db, { name: 'Has Sale', username: 'hassale', roleId: 'role_cashier' });
    createSale(db, {
      branchId: 'br_mp',
      userId: refUser.id,
      lines: [{ productId: 'p1', qty: 1, spr: 520 }],
      payments: [{ method: 'Cash', amount: 520 }],
    });
    const delRes = deleteUser(db, refUser.id) as { deactivated: boolean };
    s.ok('referenced user soft-deactivated (not deleted)', delRes.deactivated === true);
    const refUserRow = db.prepare('SELECT status FROM users WHERE id = ?').get(refUser.id) as { status: string };
    s.eq('referenced user status set inactive', refUserRow.status, 'inactive');

    // --- role create / update permissions / delete-guards ---
    updateRole(db, newRole.id, { permissions: ['reports.view', 'reports.export'] });
    const roleRow = db.prepare('SELECT permissions FROM roles WHERE id = ?').get(newRole.id) as { permissions: string };
    s.eq('role permissions updated (JSON)', roleRow.permissions, JSON.stringify(['reports.view', 'reports.export']));

    // delete-guard: system role cannot be deleted
    let sysRoleBlocked = false;
    try {
      deleteRole(db, 'role_admin');
    } catch {
      sysRoleBlocked = true;
    }
    s.ok('delete blocked: system role', sysRoleBlocked);

    // delete-guard: role assigned to a user cannot be deleted.
    // Assign the still-present refUser (soft-deactivated, but its row remains) to newRole.
    updateUser(db, refUser.id, { roleId: newRole.id });
    let assignedRoleBlocked = false;
    try {
      deleteRole(db, newRole.id);
    } catch {
      assignedRoleBlocked = true;
    }
    s.ok('delete blocked: role assigned to a user', assignedRoleBlocked);

    // reassign that user away, then the role deletes cleanly
    updateUser(db, refUser.id, { roleId: 'role_cashier' });
    deleteRole(db, newRole.id);
    const roleGone = db.prepare('SELECT COUNT(*) c FROM roles WHERE id = ?').get(newRole.id) as { c: number };
    s.eq('unassigned custom role deleted', roleGone.c, 0);

    // --- commission agent create / update / deactivate-on-reference ---
    const agent = createAgent(db, { name: 'Field Rep', phone: '0170000', commissionPct: 3 });
    s.eq('agents.list read returns rows', (listAgents(db).length > 0), true);
    const agRow = db.prepare('SELECT name, commission_pct, active FROM commission_agents WHERE id = ?').get(agent.id) as {
      name: string;
      commission_pct: number;
      active: number;
    };
    s.eq('agent created', agRow.name, 'Field Rep');
    s.money('agent commission persisted', agRow.commission_pct, 3);
    updateAgent(db, agent.id, { commissionPct: 4.5 });
    const agRow2 = db.prepare('SELECT commission_pct FROM commission_agents WHERE id = ?').get(agent.id) as {
      commission_pct: number;
    };
    s.money('agent commission updated', agRow2.commission_pct, 4.5);

    // a clean agent (no sales reference) hard-deletes
    const delAgClean = deleteAgent(db, agent.id) as { deactivated: boolean };
    s.ok('clean agent deleted (not deactivated)', delAgClean.deactivated === false);

    // an agent referenced by a sale is soft-deactivated
    const refAgent = createAgent(db, { name: 'Referenced Rep', commissionPct: 2 });
    createSale(db, {
      branchId: 'br_mp',
      userId: 'u_rana',
      agentId: refAgent.id,
      lines: [{ productId: 'p1', qty: 1, spr: 520 }],
      payments: [{ method: 'Cash', amount: 520 }],
    });
    const delAgRes = deleteAgent(db, refAgent.id) as { deactivated: boolean };
    s.ok('referenced agent soft-deactivated', delAgRes.deactivated === true);
    const refAgRow = db.prepare('SELECT active FROM commission_agents WHERE id = ?').get(refAgent.id) as { active: number };
    s.eq('referenced agent set inactive', refAgRow.active, 0);

    // --- KV settings.set then settings.get round-trips a JSON blob ---
    s.ok('absent KV key returns null', getSetting(db, 'appearance') === null);
    const blob = { themeMode: 'dark', accentHue: 200, density: 'compact', fontScale: 1.1 };
    setSetting(db, 'appearance', blob);
    const readBlob = getSetting(db, 'appearance') as typeof blob;
    s.eq('KV round-trip themeMode', readBlob.themeMode, 'dark');
    s.eq('KV round-trip accentHue', readBlob.accentHue, 200);
    // upsert overwrites the same key
    setSetting(db, 'appearance', { ...blob, themeMode: 'light' });
    const readBlob2 = getSetting(db, 'appearance') as typeof blob;
    s.eq('KV upsert overwrites', readBlob2.themeMode, 'light');
    const kvCount = db.prepare("SELECT COUNT(*) c FROM settings_kv WHERE key = 'appearance'").get() as { c: number };
    s.eq('KV upsert keeps a single row per key', kvCount.c, 1);
    // getAllSettings returns the parsed object keyed by name
    setSetting(db, 'pos', { defaultPaymentMethod: 'bKash' });
    const all = getAllSettings(db);
    s.ok('getAllSettings has appearance key', 'appearance' in all);
    s.ok('getAllSettings has pos key', 'pos' in all);
    s.eq('getAllSettings parses nested value', (all.pos as { defaultPaymentMethod: string }).defaultPaymentMethod, 'bKash');
    db.close();
  }

  // ---------- Scenario AUTH: hashing, login verification, legacy migration ----------
  s.section('scenario-auth');
  {
    const db = fresh();

    // hashSecret / verifySecret round-trip
    const hash = hashSecret('1234');
    s.ok('hashSecret returns a bcrypt hash ($2…)', hash.startsWith('$2'));
    s.ok('verifySecret matches correct secret', verifySecret('1234', hash).match === true);
    s.ok('verifySecret rejects wrong secret', verifySecret('9999', hash).match === false);
    s.ok('verifySecret empty hash → no match', verifySecret('1234', '').match === false);
    s.ok('verifySecret null hash → no match', verifySecret('1234', null).match === false);
    s.ok('bcrypt match is not flagged legacy', verifySecret('1234', hash).legacy === false);

    // authenticate by PIN: the seed stores Seam's pin (1234) as a bcrypt hash.
    const okPin = authenticate(db, { mode: 'pin', userId: 'u_admin', secret: '1234' });
    s.ok('authenticate pin ok', okPin.ok === true);
    s.ok('authenticate returns sanitized user (no pin_hash key)', okPin.user ? !('pin_hash' in okPin.user) : false);
    s.ok('authenticate returns sanitized user (no password_hash key)', okPin.user ? !('password_hash' in okPin.user) : false);
    s.eq('authenticate resolves the right user', okPin.user?.id ?? '', 'u_admin');

    // permissions returned match the user's role (admin = ALL_PERMISSIONS)
    const adminRolePerms = JSON.parse(
      (db.prepare('SELECT permissions FROM roles WHERE id = ?').get('role_admin') as { permissions: string }).permissions,
    ) as string[];
    s.eq('authenticate permissions length matches role', (okPin.permissions ?? []).length, adminRolePerms.length);
    s.ok('authenticate permissions include sales.create', (okPin.permissions ?? []).includes('sales.create'));

    // wrong pin rejected
    const badPin = authenticate(db, { mode: 'pin', userId: 'u_admin', secret: '0000' });
    s.ok('authenticate wrong pin rejected', badPin.ok === false);
    s.ok('authenticate wrong pin has error', !!badPin.error);

    // last_login_at updated on success
    s.ok('authenticate updates last_login_at', !!okPin.user?.last_login_at);

    // authenticate by password (case-insensitive username)
    setUserSecret(db, 'u_admin', { password: 'sup3rSecret' });
    const okPass = authenticate(db, { mode: 'password', username: 'SEAM', secret: 'sup3rSecret' });
    s.ok('authenticate password ok (case-insensitive username)', okPass.ok === true);
    const badPass = authenticate(db, { mode: 'password', username: 'seam', secret: 'nope' });
    s.ok('authenticate wrong password rejected', badPass.ok === false);

    // status !== 'active' rejected
    db.prepare("UPDATE users SET status = 'inactive' WHERE id = ?").run('u_rana');
    const inactive = authenticate(db, { mode: 'pin', userId: 'u_rana', secret: '1111' });
    s.ok('authenticate rejects inactive user', inactive.ok === false);
    s.eq('authenticate inactive error', inactive.error ?? '', 'Account is not active');

    // ---- legacy-plaintext upgrade path ----
    // Seed a user whose pin_hash is a PLAINTEXT value (pre-bcrypt). First login
    // must succeed AND re-hash the column to a bcrypt hash that still verifies.
    db.prepare(
      "INSERT INTO users (id, name, username, pin_hash, role_id, branch_ids, status, created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run('u_legacy', 'Legacy User', 'legacy', '4242', 'role_cashier', '[]', 'active', new Date().toISOString());
    const beforeHash = (db.prepare('SELECT pin_hash FROM users WHERE id = ?').get('u_legacy') as { pin_hash: string }).pin_hash;
    s.ok('legacy pin starts as plaintext (not $2)', !beforeHash.startsWith('$2'));
    const legacyLogin = authenticate(db, { mode: 'pin', userId: 'u_legacy', secret: '4242' });
    s.ok('legacy plaintext pin authenticates', legacyLogin.ok === true);
    const afterHash = (db.prepare('SELECT pin_hash FROM users WHERE id = ?').get('u_legacy') as { pin_hash: string }).pin_hash;
    s.ok('legacy pin upgraded to bcrypt ($2…) after login', afterHash.startsWith('$2'));
    s.ok('upgraded hash still verifies', verifySecret('4242', afterHash).match === true);
    const legacyAgain = authenticate(db, { mode: 'pin', userId: 'u_legacy', secret: '4242' });
    s.ok('upgraded pin still authenticates on next login', legacyAgain.ok === true);

    // verifyUserPin (unlock / manager override)
    s.ok('verifyUserPin true for correct pin', verifyUserPin(db, 'u_admin', '1234') === true);
    s.ok('verifyUserPin false for wrong pin', verifyUserPin(db, 'u_admin', '0000') === false);
    s.ok('verifyUserPin false for missing user', verifyUserPin(db, 'nope', '1234') === false);

    // setUserSecret stores a bcrypt hash that authenticate accepts
    setUserSecret(db, 'u_faruq', { pin: '8765' });
    const newPinHash = (db.prepare('SELECT pin_hash FROM users WHERE id = ?').get('u_faruq') as { pin_hash: string }).pin_hash;
    s.ok('setUserSecret stores a bcrypt hash', newPinHash.startsWith('$2'));
    s.ok('setUserSecret new pin authenticates', authenticate(db, { mode: 'pin', userId: 'u_faruq', secret: '8765' }).ok === true);
    db.close();
  }

  // ---------- Scenario SETUP: first-run write-through (run-once + self-disabling) ----------
  s.section('scenario-setup');
  {
    const db = fresh();

    // Pre-condition: a freshly seeded DB has NOT completed setup.
    s.ok('setup not complete on fresh seed', isSetupComplete(db) === false);
    s.ok('setup.status reports incomplete', setupStatus(db).complete === false);

    // Run the wizard write-through with a full payload.
    const result = completeSetup(db, {
      shop: {
        name: 'Bashir Hardware',
        tagline: 'Quality tools since 1999',
        phonePrimary: '01777-123456',
        address: 'Gulshan 2, Dhaka',
        currencySymbol: '৳',
      },
      defaultTaxId: 'tx_5',
      branch: { name: 'Gulshan Outlet', address: 'Road 11, Gulshan 2' },
      admin: { name: 'Bashir Ahmed', username: 'Bashir', pin: '246810' },
      printer: { name: 'Front Counter', paperWidth: 80 },
      cloud: true,
    });

    // Return shape: ok + adminUserId + sanitized user (NO hashes) + permissions.
    s.ok('completeSetup returns ok', result.ok === true);
    s.eq('completeSetup returns u_admin as owner', result.adminUserId, 'u_admin');
    s.ok('completeSetup user has NO pin_hash', !('pin_hash' in result.user));
    s.ok('completeSetup user has NO password_hash', !('password_hash' in result.user));
    s.gt('completeSetup returns admin permissions', result.permissions.length, 0);
    s.ok('completeSetup permissions include settings.users', result.permissions.includes('settings.users'));

    // Business info updated.
    const biz = db.prepare('SELECT name, tagline, phone_primary, address, currency_symbol, default_branch_id FROM business_info WHERE id = 1').get() as {
      name: string;
      tagline: string;
      phone_primary: string;
      address: string;
      currency_symbol: string;
      default_branch_id: string;
    };
    s.eq('business name updated', biz.name, 'Bashir Hardware');
    s.eq('business tagline updated', biz.tagline, 'Quality tools since 1999');
    s.eq('business phone updated', biz.phone_primary, '01777-123456');
    s.eq('business default branch set to br_mp', biz.default_branch_id, 'br_mp');

    // Branch renamed + is_default, and it is the ONLY default.
    const br = db.prepare('SELECT name, address, is_default FROM branches WHERE id = ?').get('br_mp') as {
      name: string;
      address: string;
      is_default: number;
    };
    s.eq('default branch renamed', br.name, 'Gulshan Outlet');
    s.eq('default branch address updated', br.address, 'Road 11, Gulshan 2');
    s.eq('default branch is_default = 1', br.is_default, 1);
    const defCount = db.prepare('SELECT COUNT(*) c FROM branches WHERE is_default = 1').get() as { c: number };
    s.eq('exactly one default branch after setup', defCount.c, 1);

    // Admin user reconfigured: name + lowercased username + active.
    const admin = db.prepare('SELECT name, username, status FROM users WHERE id = ?').get('u_admin') as {
      name: string;
      username: string;
      status: string;
    };
    s.eq('admin name updated', admin.name, 'Bashir Ahmed');
    s.eq('admin username lowercased', admin.username, 'bashir');
    s.eq('admin status active', admin.status, 'active');

    // New PIN authenticates; the seed default (1234) no longer works.
    s.ok('admin authenticates with new pin', authenticate(db, { mode: 'pin', userId: 'u_admin', secret: '246810' }).ok === true);
    s.ok('admin old seed pin (1234) rejected', authenticate(db, { mode: 'pin', userId: 'u_admin', secret: '1234' }).ok === false);

    // Default tax set + only one default.
    const tax = db.prepare('SELECT is_default FROM tax_rates WHERE id = ?').get('tx_5') as { is_default: number };
    s.eq('chosen tax rate is default', tax.is_default, 1);
    const defTaxCount = db.prepare('SELECT COUNT(*) c FROM tax_rates WHERE is_default = 1').get() as { c: number };
    s.eq('exactly one default tax after setup', defTaxCount.c, 1);

    // Optional blobs persisted: printer + backup.
    const printers = JSON.parse(
      (db.prepare("SELECT value FROM settings_kv WHERE key = 'printers'").get() as { value: string }).value,
    ) as { name: string; paperWidth: number; isDefault: boolean }[];
    s.eq('printer profile persisted', printers.length, 1);
    s.eq('printer name persisted', printers[0].name, 'Front Counter');
    const backup = JSON.parse(
      (db.prepare("SELECT value FROM settings_kv WHERE key = 'backup'").get() as { value: string }).value,
    ) as { cloudProvider: string; autoBackup: string };
    s.eq('cloud backup provider persisted', backup.cloudProvider, 'supabase');

    // Run-once latch is set.
    s.ok('setup_complete latch set', isSetupComplete(db) === true);
    s.ok('setup.status now reports complete', setupStatus(db).complete === true);

    // Replaying setup THROWS — cannot be re-run for privilege escalation.
    let replayBlocked = false;
    try {
      completeSetup(db, {
        shop: { name: 'Malicious Rename' },
        branch: { name: 'Hijack Branch' },
        admin: { name: 'Attacker', username: 'attacker', pin: '000000' },
      });
    } catch (e) {
      replayBlocked = (e as Error).message === 'Setup already completed';
    }
    s.ok('re-running completeSetup throws "Setup already completed"', replayBlocked);

    // The replay did NOT mutate anything (business name unchanged, admin pin intact).
    const bizAfter = db.prepare('SELECT name FROM business_info WHERE id = 1').get() as { name: string };
    s.eq('business name unchanged after blocked replay', bizAfter.name, 'Bashir Hardware');
    s.ok('admin pin unchanged after blocked replay', authenticate(db, { mode: 'pin', userId: 'u_admin', secret: '246810' }).ok === true);
    db.close();
  }

  // ---------- Scenario MASTERDATA: warranties + price groups CRUD + guards ----------
  s.section('scenario-masterdata-crud');
  {
    const db = fresh();

    // ----- Warranties: create / update / delete (delete nulls product refs) -----
    const w = createWarranty(db, { name: '3 Year Extended', durationMonths: 36, description: 'Extended cover' });
    const wRow = db.prepare('SELECT name, duration_months, description FROM warranties WHERE id = ?').get(w.id) as {
      name: string;
      duration_months: number;
      description: string | null;
    };
    s.eq('warranty created', wRow.name, '3 Year Extended');
    s.eq('warranty duration persisted', wRow.duration_months, 36);
    s.eq('warranty description persisted', wRow.description ?? '', 'Extended cover');
    s.ok('listWarranties includes the new warranty', listWarranties(db).some((x) => (x.id as string) === w.id));

    // partial update: name + duration only, description untouched
    updateWarranty(db, w.id, { name: '3 Year Premium', durationMonths: 30 });
    const wRow2 = db.prepare('SELECT name, duration_months, description FROM warranties WHERE id = ?').get(w.id) as {
      name: string;
      duration_months: number;
      description: string | null;
    };
    s.eq('warranty name updated', wRow2.name, '3 Year Premium');
    s.eq('warranty duration updated', wRow2.duration_months, 30);
    s.eq('warranty description preserved on partial update', wRow2.description ?? '', 'Extended cover');

    // attach the warranty to a product, then delete the warranty -> product ref nulled
    const prod = createProduct(db, {
      sku: 'WARR-PROD-1',
      name: 'Warranty Holder',
      cost: 100,
      price: 150,
      warrantyId: w.id,
    });
    const beforeRef = db.prepare('SELECT warranty_id FROM products WHERE id = ?').get(prod.id) as {
      warranty_id: string | null;
    };
    s.eq('product references warranty before delete', beforeRef.warranty_id ?? '', w.id);
    deleteWarranty(db, w.id);
    const wGone = db.prepare('SELECT COUNT(*) c FROM warranties WHERE id = ?').get(w.id) as { c: number };
    s.eq('warranty deleted', wGone.c, 0);
    const afterRef = db.prepare('SELECT warranty_id FROM products WHERE id = ?').get(prod.id) as {
      warranty_id: string | null;
    };
    s.ok('product warranty_id nulled (not cascade-deleted) on warranty delete', afterRef.warranty_id === null);
    s.ok('product itself survives warranty delete', !!db.prepare('SELECT id FROM products WHERE id = ?').get(prod.id));

    // ----- Price groups: create (isDefault clears others) -----
    // seedMaster seeds Retail (default), Wholesale, Contractor.
    const defaultsBefore = db.prepare('SELECT COUNT(*) c FROM price_groups WHERE is_default = 1').get() as { c: number };
    s.eq('exactly one default group from seed', defaultsBefore.c, 1);

    const vip = createPriceGroup(db, {
      name: 'VIP',
      isDefault: true,
      notes: 'Top customers',
      defaultCreditLimit: 50000,
      defaultDiscountPct: 7.5,
      taxExempt: true,
    });
    const vipRow = db
      .prepare('SELECT name, is_default, notes, default_credit_limit, default_discount_pct, tax_exempt FROM price_groups WHERE id = ?')
      .get(vip.id) as {
      name: string;
      is_default: number;
      notes: string | null;
      default_credit_limit: number | null;
      default_discount_pct: number | null;
      tax_exempt: number;
    };
    s.eq('price group created', vipRow.name, 'VIP');
    s.eq('new default flag set', vipRow.is_default, 1);
    s.money('default credit limit persisted', vipRow.default_credit_limit ?? -1, 50000);
    s.money('default discount pct persisted', vipRow.default_discount_pct ?? -1, 7.5);
    s.eq('tax exempt persisted', vipRow.tax_exempt, 1);
    const defaultsAfter = db.prepare('SELECT COUNT(*) c FROM price_groups WHERE is_default = 1').get() as { c: number };
    s.eq('creating a default clears the previous default (still one)', defaultsAfter.c, 1);
    const retailDefault = db.prepare('SELECT is_default FROM price_groups WHERE id = ?').get('pg_retail') as {
      is_default: number;
    };
    s.eq('previous default (Retail) cleared', retailDefault.is_default, 0);
    s.ok(
      'listPriceGroups orders default first',
      (listPriceGroups(db)[0] as { is_default: number }).is_default === 1,
    );

    // ----- Price groups: update (camel->snake incl. 3 new cols; isDefault moves) -----
    updatePriceGroup(db, 'pg_wholesale', { defaultDiscountPct: 3, taxExempt: true, isDefault: true });
    const whRow = db
      .prepare('SELECT is_default, default_discount_pct, tax_exempt FROM price_groups WHERE id = ?')
      .get('pg_wholesale') as { is_default: number; default_discount_pct: number | null; tax_exempt: number };
    s.eq('wholesale becomes default on update', whRow.is_default, 1);
    s.money('wholesale discount updated', whRow.default_discount_pct ?? -1, 3);
    s.eq('wholesale tax exempt updated', whRow.tax_exempt, 1);
    const vipNoLongerDefault = db.prepare('SELECT is_default FROM price_groups WHERE id = ?').get(vip.id) as {
      is_default: number;
    };
    s.eq('VIP cleared when wholesale set default', vipNoLongerDefault.is_default, 0);
    const defaultsAfterUpdate = db.prepare('SELECT COUNT(*) c FROM price_groups WHERE is_default = 1').get() as {
      c: number;
    };
    s.eq('still exactly one default after update', defaultsAfterUpdate.c, 1);

    // ----- Delete guards -----
    // cannot delete the default group (wholesale is now default)
    let defaultBlocked = false;
    try {
      deletePriceGroup(db, 'pg_wholesale');
    } catch {
      defaultBlocked = true;
    }
    s.ok('delete blocked: default price group', defaultBlocked);
    s.ok('default group still present', !!db.prepare('SELECT id FROM price_groups WHERE id = ?').get('pg_wholesale'));

    // cannot delete a group a customer references (by name). Seed has Contractor customers.
    const contractorCustomers = db
      .prepare("SELECT COUNT(*) c FROM customers WHERE price_group = 'Contractor'")
      .get() as { c: number };
    s.gt('seed has Contractor customers', contractorCustomers.c, 0);
    let referencedBlocked = false;
    try {
      deletePriceGroup(db, 'pg_contractor');
    } catch {
      referencedBlocked = true;
    }
    s.ok('delete blocked: group referenced by a customer', referencedBlocked);
    s.ok('referenced group still present', !!db.prepare('SELECT id FROM price_groups WHERE id = ?').get('pg_contractor'));

    // a non-default, unreferenced group deletes cleanly (VIP has no customers)
    deletePriceGroup(db, vip.id);
    const vipGone = db.prepare('SELECT COUNT(*) c FROM price_groups WHERE id = ?').get(vip.id) as { c: number };
    s.eq('clean price group deleted', vipGone.c, 0);
    db.close();
  }

  // ---------- Scenario SHIPMENT: logistics tracking with NO stock/cash effects ----------
  s.section('scenario-shipment');
  {
    const db = fresh();
    // Open a shift so we can prove the drawer is untouched by shipment ops.
    const shiftId = openShift(db, { branchId: 'br_mp', userId: 'u_rana', openingCash: 5000 });

    // A real sale to link the shipment to.
    const sale = createSale(db, {
      branchId: 'br_mp',
      userId: 'u_rana',
      customerId: 'cu2',
      lines: [{ productId: 'p1', qty: 10, spr: 520 }],
      payments: [{ method: 'Cash', amount: 5200 }],
    });
    const saleInvoiceNo = (db.prepare('SELECT invoice_no FROM sales WHERE id = ?').get(sale.id) as {
      invoice_no: string;
    }).invoice_no;

    // Snapshot the accounting world BEFORE creating/updating the shipment.
    const stockBefore = stockOnHand(db, 'p1', 'br_mp');
    const drawerBefore = shiftTotals(db, shiftId).expected;
    const cogsBefore = (db.prepare('SELECT cogs FROM sales WHERE id = ?').get(sale.id) as { cogs: number }).cogs;
    const dueBefore = customerDue(db, 'cu2');
    const movementsBefore = (db.prepare('SELECT COUNT(*) c FROM stock_movements').get() as { c: number }).c;
    const cashMovesBefore = (db.prepare('SELECT COUNT(*) c FROM cash_movements').get() as { c: number }).c;

    // ----- create -----
    const shp = createShipment(db, {
      saleId: sale.id,
      branchId: 'br_mp',
      userId: 'u_rana',
      driver: 'Karim',
      vehicleNo: 'DH 11-3344',
      address: 'Uttara Sector 7, Dhaka',
      targetDate: '2026-05-27',
      notes: '10 units',
    });
    // ref_no matches SHP-YYYY-NNNN format
    s.ok('shipment ref_no matches SHP-YYYY-NNNN', /^SHP-\d{4}-\d{4}$/.test(shp.refNo));

    const row = db.prepare('SELECT * FROM shipments WHERE id = ?').get(shp.id) as Record<string, unknown>;
    s.eq('shipment linked sale_id', row.sale_id as string, sale.id);
    s.eq('shipment resolves sale_invoice_no from the sale', row.sale_invoice_no as string, saleInvoiceNo);
    s.eq('shipment resolves customer_name from the sale', row.customer_name as string, 'Rahim Construction');
    s.eq('shipment status defaults to pending', row.status as string, 'pending');
    s.ok('shipment delivered_at null while pending', row.delivered_at === null);
    s.eq('shipment driver persisted', row.driver as string, 'Karim');
    s.eq('shipment branch_id persisted', row.branch_id as string, 'br_mp');

    // appears in the read query
    s.ok('listShipments includes the new shipment', listShipments(db).some((x) => (x.id as string) === shp.id));

    // ----- NO stock / cash / cogs / due side effects on create -----
    s.money('create shipment does NOT change stock', stockOnHand(db, 'p1', 'br_mp'), stockBefore);
    s.money('create shipment does NOT change drawer', shiftTotals(db, shiftId).expected, drawerBefore);
    s.money('create shipment does NOT change sale COGS', (db.prepare('SELECT cogs FROM sales WHERE id = ?').get(sale.id) as { cogs: number }).cogs, cogsBefore);
    s.money('create shipment does NOT change customer due', customerDue(db, 'cu2'), dueBefore);
    s.eq('create shipment adds NO stock_movements', (db.prepare('SELECT COUNT(*) c FROM stock_movements').get() as { c: number }).c, movementsBefore);
    s.eq('create shipment adds NO cash_movements', (db.prepare('SELECT COUNT(*) c FROM cash_movements').get() as { c: number }).c, cashMovesBefore);

    // ----- update status to delivered stamps delivered_at -----
    updateShipment(db, shp.id, { status: 'delivered' });
    const delivered = db.prepare('SELECT status, delivered_at FROM shipments WHERE id = ?').get(shp.id) as {
      status: string;
      delivered_at: string | null;
    };
    s.eq('shipment status updated to delivered', delivered.status, 'delivered');
    s.ok('delivered_at stamped when status -> delivered', !!delivered.delivered_at);

    // ----- update is ALSO side-effect-free -----
    s.money('update shipment does NOT change stock', stockOnHand(db, 'p1', 'br_mp'), stockBefore);
    s.money('update shipment does NOT change drawer', shiftTotals(db, shiftId).expected, drawerBefore);
    s.money('update shipment does NOT change customer due', customerDue(db, 'cu2'), dueBefore);
    s.eq('update shipment adds NO stock_movements', (db.prepare('SELECT COUNT(*) c FROM stock_movements').get() as { c: number }).c, movementsBefore);
    s.eq('update shipment adds NO cash_movements', (db.prepare('SELECT COUNT(*) c FROM cash_movements').get() as { c: number }).c, cashMovesBefore);

    // delivered_at is NOT overwritten on a subsequent non-delivery update
    const firstDeliveredAt = delivered.delivered_at;
    updateShipment(db, shp.id, { notes: 'left with security guard' });
    const stillDelivered = db.prepare('SELECT delivered_at FROM shipments WHERE id = ?').get(shp.id) as {
      delivered_at: string | null;
    };
    s.eq('delivered_at preserved across later edits', stillDelivered.delivered_at ?? '', firstDeliveredAt ?? '');

    // ----- delete removes it -----
    deleteShipment(db, shp.id);
    const gone = db.prepare('SELECT COUNT(*) c FROM shipments WHERE id = ?').get(shp.id) as { c: number };
    s.eq('shipment deleted', gone.c, 0);
    db.close();
  }
}

// allow standalone run
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/') || process.argv[1]?.endsWith('scenarios.ts')) {
  const s = new Suite();
  runScenarios(s);
  const rep = s.report();
  console.log(`SCENARIOS: ${rep.passed}/${rep.total} passed`);
  if (rep.failed > 0) {
    for (const f of rep.failures) console.log(`   - ${f.name}: ${f.detail ?? ''}`);
    process.exit(1);
  }
  console.log('✅ ALL SCENARIOS PASSED');
}
