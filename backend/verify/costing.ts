/**
 * PURCHASE-PRICE (COST) HISTORY VERIFICATION
 * ==========================================
 * Covers `backend/services/costing.ts`.
 *
 * The properties that matter:
 *  - the history table is the source of truth and `products.cost` /
 *    `avg_cost` / `cost_updated_at` are caches that CANNOT drift from it
 *  - the current buying price is always the newest entry
 *  - the average is the mean of every recorded price
 *  - the first manual change captures the product's opening cost, so the average
 *    is not built from a half-story
 *  - COGS / weighted-average cost is NOT disturbed by recording a buying price
 *    (that is verified money math and must stay put)
 *
 * Run standalone: npx tsx backend/verify/costing.ts
 */
import { openDatabase, migrate, type DB } from '../db/connection.ts';
import { seedMaster } from '../seed/master.ts';
import { simulate } from '../seed/simulate.ts';
import { buildApi } from '../api.ts';
import { Suite } from './assert.ts';
import { computeAvgCost, listCostHistory, setProductCost } from '../services/costing.ts';
import { createProduct } from '../services/catalog.ts';
import { cancelPurchase, createPurchase } from '../services/purchases.ts';
import { weightedAvgCost, recordMovement, stockOnHand } from '../services/stock.ts';
import { round2 } from '../core/money.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function runCosting(s: Suite) {
  const db: DB = openDatabase(':memory:');
  migrate(db);
  seedMaster(db);

  const api = buildApi();
  const call = (ch: string, payload: unknown = {}): any => api[ch](db, payload);

  // ------------------------------------------------------------ schema is there
  s.section('costing-schema');
  const cols = new Set(
    (db.prepare('PRAGMA table_info(products)').all() as { name: string }[]).map((c) => c.name),
  );
  s.ok('products.avg_cost exists', cols.has('avg_cost'));
  s.ok('products.cost_updated_at exists', cols.has('cost_updated_at'));
  s.eq(
    'product_cost_history table exists',
    (
      db
        .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='product_cost_history'")
        .get() as { n: number }
    ).n,
    1,
  );
  // Cost history landed in v4; v5 added products.archived_at. A fresh DB is
  // always migrated to the current head, and every migration below it must be
  // recorded — otherwise an older database would skip one on upgrade.
  const versions = (
    db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {
      version: number;
    }[]
  ).map((r) => r.version);
  s.eq('every migration up to the head is recorded', versions.join(','), '1,2,3,4,5,6,7');
  s.ok('cost-history migration (v4) is recorded', versions.includes(4));
  s.ok('products.archived_at exists (v5)', cols.has('archived_at'));
  s.ok('blob-image cleanup migration (v6) is recorded', versions.includes(6));
  // v7 — a cost entry can be retracted (a cancelled purchase's price stops
  // counting towards the average) and knows which document recorded it.
  const historyCols = new Set(
    (db.prepare('PRAGMA table_info(product_cost_history)').all() as { name: string }[]).map(
      (c) => c.name,
    ),
  );
  s.ok('product_cost_history.retracted_at exists (v7)', historyCols.has('retracted_at'));
  s.ok('product_cost_history.retract_reason exists (v7)', historyCols.has('retract_reason'));
  s.ok('product_cost_history.ref_type exists (v7)', historyCols.has('ref_type'));
  s.ok('product_cost_history.ref_id exists (v7)', historyCols.has('ref_id'));
  s.ok('cost-retraction migration (v7) is recorded', versions.includes(7));

  // --------------------------------------------------- a brand-new product
  s.section('costing-new-product');
  const id = createProduct(db, {
    sku: 'COST-TEST-1',
    name: 'Cost History Widget',
    cost: 100,
    price: 150,
    unit: 'pc',
    userId: 'u_admin',
  }).id;

  const fresh = db.prepare('SELECT cost, avg_cost, cost_updated_at FROM products WHERE id = ?').get(id) as {
    cost: number;
    avg_cost: number;
    cost_updated_at: string | null;
  };
  s.money('a new product starts at its opening cost', fresh.cost, 100);
  s.money('a new product average equals its opening cost', fresh.avg_cost, 100);
  s.ok('a new product records when its cost was set', !!fresh.cost_updated_at);
  s.eq('creating a product opens the history with one entry', listCostHistory(db, id).length, 1);
  s.eq('that first entry is marked as the opening price', listCostHistory(db, id)[0].source, 'initial');

  // ------------------------------------------------------ recording a change
  s.section('costing-set-cost');
  // The owner's example: bought at 100 a few months ago, 120 today.
  const after120 = call('products.setCost', {
    productId: id,
    cost: 120,
    userId: 'u_admin',
    note: 'Supplier raised the rate',
  }) as { cost: number; avgCost: number; costUpdatedAt: string; entryCount: number };

  s.money('current buying price becomes the new price', after120.cost, 120);
  s.money('average of 100 and 120 is 110', after120.avgCost, 110);
  s.eq('the change is on record', after120.entryCount, 2);
  s.ok('the change is timestamped', !!after120.costUpdatedAt);

  const row120 = db.prepare('SELECT cost, avg_cost FROM products WHERE id = ?').get(id) as {
    cost: number;
    avg_cost: number;
  };
  s.money('products.cost cache matches', row120.cost, 120);
  s.money('products.avg_cost cache matches', row120.avg_cost, 110);

  // A third price, to prove the mean is over ALL entries and not just the last two.
  const after90 = call('products.setCost', { productId: id, cost: 90, userId: 'u_admin' }) as {
    cost: number;
    avgCost: number;
  };
  s.money('a lower price still becomes the current price', after90.cost, 90);
  s.money('average of 100, 120 and 90 is 103.33', after90.avgCost, round2((100 + 120 + 90) / 3));

  // ---------------------------------------------------------------- history
  s.section('costing-history');
  const history = call('products.costHistory', { productId: id }) as {
    cost: number;
    at: string;
    source: string;
    userId: string | null;
    userName: string | null;
    note: string | null;
  }[];
  s.eq('history holds every entry', history.length, 3);
  s.money('history is newest first', history[0].cost, 90);
  s.money('the oldest entry is the opening price', history[history.length - 1].cost, 100);
  s.ok(
    'history is ordered strictly newest-first by time',
    history.every((h, i) => i === 0 || history[i - 1].at >= h.at),
  );
  s.ok('history records who made the change', history[0].userName === 'Seam' || !!history[0].userId);
  s.eq('the note is kept', history.find((h) => h.cost === 120)?.note, 'Supplier raised the rate');
  s.ok(
    'history limit is clamped to a sane maximum',
    (call('products.costHistory', { productId: id, limit: 100000 }) as unknown[]).length <= 200,
  );

  s.section('costing-info');
  const info = call('products.costInfo', { productId: id }) as {
    cost: number;
    avgCost: number;
    entryCount: number;
  };
  s.money('costInfo reports the current price', info.cost, 90);
  s.money('costInfo reports the average', info.avgCost, round2((100 + 120 + 90) / 3));
  s.eq('costInfo reports the entry count', info.entryCount, 3);

  // --------------------------------------------- the cache cannot drift
  s.section('costing-cache-identity');
  // This is the whole reason the columns are safe to read: they are recomputed
  // from the history on every write, never incremented in place.
  const drifted = (db.prepare('SELECT id, cost, avg_cost FROM products').all() as {
    id: string;
    cost: number;
    avg_cost: number;
  }[]).filter((p) => Math.abs(p.avg_cost - computeAvgCost(db, p.id)) > 0.005);
  s.eq('no product average has drifted from its history', drifted.length, 0);

  const newestMismatch = (db.prepare('SELECT id, cost FROM products').all() as {
    id: string;
    cost: number;
  }[]).filter((p) => {
    const newest = db
      .prepare('SELECT cost FROM product_cost_history WHERE product_id = ? ORDER BY at DESC, rowid DESC LIMIT 1')
      .get(p.id) as { cost: number } | undefined;
    return !!newest && Math.abs(newest.cost - p.cost) > 0.005;
  });
  s.eq('every current cost equals its newest history entry', newestMismatch.length, 0);

  // ------------------------------------- a product that predates the feature
  s.section('costing-legacy-product');
  // Simulate an upgraded install: a product with a cost but NO history rows.
  const legacyId = createProduct(db, {
    sku: 'COST-LEGACY',
    name: 'Legacy Widget',
    cost: 200,
    price: 260,
    unit: 'pc',
  }).id;
  db.prepare('DELETE FROM product_cost_history WHERE product_id = ?').run(legacyId);
  db.prepare('UPDATE products SET avg_cost = 0, cost_updated_at = NULL WHERE id = ?').run(legacyId);

  s.money('a product with no history averages its current cost', computeAvgCost(db, legacyId), 200);
  const legacyAfter = setProductCost(db, { productId: legacyId, cost: 240, userId: 'u_admin' });
  s.money('its first change becomes the current price', legacyAfter.cost, 240);
  s.money('the old price is captured, so the average is 220 not 240', legacyAfter.avgCost, 220);
  s.eq('two entries now exist for it', legacyAfter.entryCount, 2);
  s.eq(
    'the captured entry is marked as the opening price',
    listCostHistory(db, legacyId).find((h) => h.cost === 200)?.source,
    'initial',
  );

  // ------------------------------------------------------------ rejections
  s.section('costing-rejections');
  let negative = false;
  try {
    setProductCost(db, { productId: id, cost: -5 });
  } catch {
    negative = true;
  }
  s.ok('a negative buying price is refused', negative);

  let missing = false;
  try {
    setProductCost(db, { productId: 'p_does_not_exist', cost: 10 });
  } catch {
    missing = true;
  }
  s.ok('an unknown product is refused', missing);
  s.money('a refused change leaves the price alone', costOf(db, id), 90);
  s.eq(
    'a refused change adds no history',
    listCostHistory(db, id).length,
    3,
  );
  // Zero is allowed — a giveaway/sample item legitimately costs nothing.
  const zero = setProductCost(db, { productId: id, cost: 0, userId: 'u_admin' });
  s.money('zero is an acceptable buying price', zero.cost, 0);

  // ------------------------- COGS must be untouched by a buying-price entry
  s.section('costing-does-not-touch-cogs');
  const cogsId = createProduct(db, {
    sku: 'COST-COGS',
    name: 'COGS Widget',
    cost: 50,
    price: 80,
    unit: 'pc',
  }).id;
  // 10 in at 50 → weighted average cost is 50.
  recordMovement(db, {
    productId: cogsId,
    branchId: 'br_mp',
    reason: 'purchase',
    qty: 10,
    unitCost: 50,
    userId: 'u_admin',
  });
  const wacBefore = weightedAvgCost(db, cogsId);
  s.money('weighted-average cost starts at the movement cost', wacBefore, 50);
  setProductCost(db, { productId: cogsId, cost: 999, userId: 'u_admin' });
  s.money(
    'recording a buying price does NOT change weighted-average cost',
    weightedAvgCost(db, cogsId),
    wacBefore,
  );
  s.ok(
    'the two averages are deliberately different figures',
    Math.abs(computeAvgCost(db, cogsId) - weightedAvgCost(db, cogsId)) > 0.01,
  );

  // ------------------- A PURCHASE MOVES BOTH BUYING PRICES (the reported bug)
  //
  // Before this, `createPurchase` wrote `products.cost` with a raw UPDATE and
  // ONLY when the line carried a new sell price — so the average purchase price
  // never moved on a purchase, and when it did fire the cache silently stopped
  // agreeing with its own history. These checks pin both halves.
  s.section('costing-purchase-feeds-history');
  const buyId = createProduct(db, {
    sku: 'COST-BUY',
    name: 'Purchased Widget',
    cost: 100,
    price: 150,
    unit: 'pc',
  }).id;
  s.money('opening buying price is the created cost', costOf(db, buyId), 100);

  // Buy at 120 and DO NOT touch the sell price — the old code did nothing here.
  createPurchase(db, {
    branchId: 'br_mp',
    userId: 'u_admin',
    supplierId: 'sp1',
    lines: [{ productId: buyId, qty: 10, unitCostBeforeDisc: 120 }],
  });
  s.money('a purchase updates the CURRENT buying price', costOf(db, buyId), 120);
  s.money('a purchase updates the AVERAGE buying price', computeAvgCost(db, buyId), 110);
  s.eq(
    'the purchase appended one history entry',
    listCostHistory(db, buyId).filter((h) => h.source === 'purchase').length,
    1,
  );
  s.eq(
    'the entry names the purchase it came from',
    listCostHistory(db, buyId)[0].note?.startsWith('Purchase ') ?? false,
    true,
  );

  // A second purchase at 140 → mean of 100, 120, 140.
  createPurchase(db, {
    branchId: 'br_mp',
    userId: 'u_admin',
    supplierId: 'sp1',
    lines: [{ productId: buyId, qty: 5, unitCostBeforeDisc: 140, newSellPrice: 200 }],
  });
  s.money('the average blends every purchase', computeAvgCost(db, buyId), round2((100 + 120 + 140) / 3));
  s.money('a new sell price on the line still applies', priceOf(db, buyId), 200);
  s.money(
    'the cached cost still equals the newest entry',
    costOf(db, buyId),
    listCostHistory(db, buyId)[0].cost,
  );

  // An ORDERED purchase has not arrived, so it must not claim a buying price
  // any more than it claims stock.
  const avgBeforeOrdered = computeAvgCost(db, buyId);
  createPurchase(db, {
    status: 'ordered',
    branchId: 'br_mp',
    userId: 'u_admin',
    supplierId: 'sp1',
    lines: [{ productId: buyId, qty: 5, unitCostBeforeDisc: 999 }],
  });
  s.money(
    'an ordered (not received) purchase does not record a buying price',
    computeAvgCost(db, buyId),
    avgBeforeOrdered,
  );

  // ------------- A PRODUCT BORN ON A PURCHASE IS NOT PRICED TWICE ------------
  // The owner's report, with their numbers. Adding a product from inside Add
  // Purchase pre-fills the line's unit cost from the cost typed in the drawer, so
  // creating the product AND receiving the line recorded the same observation
  // twice. It looked harmless until the second real purchase:
  //     created 120, received 120, later bought at 124
  //     -> (120 + 120 + 124) / 3 = 121.33   but the shop only ever paid 120 and 124
  //     -> the honest average is (120 + 124) / 2 = 122
  s.section('costing-new-product-on-a-purchase');
  {
    // `recordOpeningCost: false` is what NewProductDrawer sends in lockStock mode.
    const bornId = createProduct(db, {
      sku: 'COST-BORN-ON-PURCHASE',
      name: 'Added While Buying It',
      cost: 120,
      price: 150,
      unit: 'bag',
      openingStock: 0,
      recordOpeningCost: false,
    }).id;

    s.eq('no history entry is opened for it', listCostHistory(db, bornId).length, 0);
    s.money('but it still shows the cost that was typed', costOf(db, bornId), 120);
    s.money(
      'and the average falls back to that cost rather than 0',
      computeAvgCost(db, bornId),
      120,
    );

    createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: bornId, qty: 10, unitCostBeforeDisc: 120 }],
    });
    s.eq('the purchase line records the FIRST entry', listCostHistory(db, bornId).length, 1);
    s.money('the average is still 120', computeAvgCost(db, bornId), 120);

    createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: bornId, qty: 10, unitCostBeforeDisc: 124 }],
    });
    s.eq('two purchases, two entries', listCostHistory(db, bornId).length, 2);
    s.money(
      'the average is (120 + 124) / 2, NOT (120 + 120 + 124) / 3',
      computeAvgCost(db, bornId),
      122,
    );
    s.money('and the current buying price is the newest one', costOf(db, bornId), 124);

    // The default is unchanged: a product added to the catalogue on its own DOES
    // open its history, because nothing else is about to record that price.
    const cataloguedId = createProduct(db, {
      sku: 'COST-BORN-IN-CATALOGUE',
      name: 'Added On Its Own',
      cost: 120,
      price: 150,
      unit: 'bag',
    }).id;
    s.eq(
      'a product added on its own still opens its history',
      listCostHistory(db, cataloguedId).length,
      1,
    );
    createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: cataloguedId, qty: 10, unitCostBeforeDisc: 124 }],
    });
    s.money(
      'so ITS average counts the opening price it really stated',
      computeAvgCost(db, cataloguedId),
      122,
    );
  }

  // ------------------------------- CANCELLING a purchase retracts its price
  // The deliberate decision (v7): a cancellation already reverses the stock and
  // the cash, and the buying price has to come back too — if the delivery never
  // arrived, the shop never paid that price. Leaving it in meant a purchase keyed
  // at the wrong price and cancelled a minute later moved the average for good.
  // The row is RETRACTED, never deleted: the history is the audit record of what
  // was entered, and hiding that it was ever entered is the opposite of useful.
  s.section('costing-cancelled-purchase-retracts');
  {
    const cancelId = createProduct(db, {
      sku: 'COST-CANCEL',
      name: 'Cancelled Delivery Widget',
      cost: 100,
      price: 150,
      unit: 'pc',
    }).id;
    s.money('starts at its opening buying price', costOf(db, cancelId), 100);
    s.money('average starts there too', computeAvgCost(db, cancelId), 100);

    // A real delivery at 120 — this one stays.
    createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: cancelId, qty: 10, unitCostBeforeDisc: 120 }],
    });
    s.money('a received purchase moves the average', computeAvgCost(db, cancelId), 110);

    // Now the fat-fingered one: 1200 instead of 120, then cancelled.
    const oops = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: cancelId, qty: 10, unitCostBeforeDisc: 1200 }],
    });
    s.money('the mistake skews the average while it stands', computeAvgCost(db, cancelId), round2((100 + 120 + 1200) / 3));
    s.money('and it becomes the current buying price', costOf(db, cancelId), 1200);
    const stockBefore = stockOnHand(db, cancelId, 'br_mp');

    cancelPurchase(db, oops.id, 'u_admin', 'wrong price keyed');

    s.money(
      'cancelling puts the AVERAGE back to what the shop really paid',
      computeAvgCost(db, cancelId),
      110,
    );
    s.money(
      'cancelling puts the CURRENT buying price back as well',
      costOf(db, cancelId),
      120,
    );
    s.money('the stock is reversed as before', stockOnHand(db, cancelId, 'br_mp'), stockBefore - 10);

    // The row is still there, marked — deleting it would hide the mistake.
    const hist = listCostHistory(db, cancelId);
    const retracted = hist.filter((h) => h.retractedAt !== null);
    s.eq('the retracted entry is KEPT, not deleted', retracted.length, 1);
    s.money('the kept entry still shows the price that was entered', retracted[0].cost, 1200);
    s.ok(
      'the retraction records why',
      (retracted[0].retractReason ?? '').includes('cancelled'),
    );
    s.eq(
      'the entries that still count are the ones that really happened',
      hist.filter((h) => h.retractedAt === null).length,
      2,
    );
    s.money(
      'the cache agrees with the non-retracted history',
      costOf(db, cancelId),
      hist.filter((h) => h.retractedAt === null)[0].cost,
    );

    // Cancelling twice must not double-retract or throw.
    cancelPurchase(db, oops.id, 'u_admin', 'again');
    s.money('cancelling again changes nothing', computeAvgCost(db, cancelId), 110);
    s.eq(
      'cancelling again does not mark anything else',
      listCostHistory(db, cancelId).filter((h) => h.retractedAt !== null).length,
      1,
    );

    // A product whose ONLY price came from a cancelled purchase must not report 0.
    const onlyId = createProduct(db, {
      sku: 'COST-ONLY-CANCELLED',
      name: 'Only Ever Cancelled',
      cost: 0,
      price: 90,
      unit: 'pc',
    }).id;
    const onlyPur = createPurchase(db, {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: onlyId, qty: 4, unitCostBeforeDisc: 55 }],
    });
    s.money('its only price is the purchase price', costOf(db, onlyId), 55);
    cancelPurchase(db, onlyPur.id, 'u_admin', 'never delivered');
    // Nothing is left standing, so the average falls back to products.cost —
    // which the cache leaves alone when there is no live entry. The point is that
    // it is not a confident 0 next to a real one.
    s.money(
      'with nothing left on record the average follows the stored cost',
      computeAvgCost(db, onlyId),
      costOf(db, onlyId),
    );
  }

  // ------------------------------------------- the read paths expose it
  s.section('costing-read-paths');
  const listed = (call('products.list', {}) as Record<string, any>[]).find((p) => p.id === id);
  s.ok('products.list exposes avg_cost', listed !== undefined && 'avg_cost' in listed);
  s.ok('products.list exposes cost_updated_at', listed !== undefined && 'cost_updated_at' in listed);
  const paged = (call('products.listPage', { pageSize: 200 }) as { rows: Record<string, any>[] }).rows.find(
    (p) => p.id === id,
  );
  s.ok('products.listPage exposes avg_cost', paged !== undefined && 'avg_cost' in paged);
  const got = call('products.get', { id }) as Record<string, any>;
  s.ok('products.get exposes avg_cost', 'avg_cost' in got);

  db.close();

  // -------------------- a full simulated year keeps the identity ----------
  s.section('costing-identity-on-a-year');
  const big: DB = openDatabase(':memory:');
  migrate(big);
  simulate(big, { days: 90, seed: 19 });
  const bigProducts = big.prepare('SELECT id, cost, avg_cost FROM products').all() as {
    id: string;
    cost: number;
    avg_cost: number;
  }[];
  s.gt('the simulated shop has a catalogue', bigProducts.length, 0);
  s.eq(
    'every simulated product average matches its history',
    bigProducts.filter((p) => Math.abs(p.avg_cost - computeAvgCost(big, p.id)) > 0.005).length,
    0,
  );
  s.eq(
    'no simulated product has a zero average with a real cost',
    bigProducts.filter((p) => p.cost > 0 && p.avg_cost === 0).length,
    0,
  );
  big.close();
}

function costOf(db: DB, productId: string): number {
  return (db.prepare('SELECT cost FROM products WHERE id = ?').get(productId) as { cost: number }).cost;
}

function priceOf(db: DB, productId: string): number {
  return (db.prepare('SELECT price FROM products WHERE id = ?').get(productId) as { price: number }).price;
}

// ---- standalone runner (mirrors paging.ts / backup.ts) ----
if (
  import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/') ||
  // Path separators differ on Windows, so match the bare filename. Only the
  // ENTRY script lands in argv[1], so services/costing.ts can never trigger it.
  process.argv[1]?.endsWith('costing.ts')
) {
  const s = new Suite();
  const t0 = Date.now();
  runCosting(s);
  const rep = s.report();
  const ms = Date.now() - t0;
  console.log(`COSTING: ${rep.passed}/${rep.total} checks in ${ms}ms`);
  if (rep.failed > 0) {
    console.log(`\n❌ ${rep.failed} FAILURES:`);
    for (const f of rep.failures) console.log(`   - ${f.name}: ${f.detail ?? ''}`);
    process.exit(1);
  }
  console.log('✅ ALL COSTING CHECKS PASSED');
}
