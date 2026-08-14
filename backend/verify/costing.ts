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
import { weightedAvgCost, recordMovement } from '../services/stock.ts';
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
  s.eq('every migration up to the head is recorded', versions.join(','), '1,2,3,4,5,6');
  s.ok('cost-history migration (v4) is recorded', versions.includes(4));
  s.ok('products.archived_at exists (v5)', cols.has('archived_at'));
  s.ok('blob-image cleanup migration (v6) is recorded', versions.includes(6));

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
