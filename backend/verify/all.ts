/**
 * Combined verification entry: runs the targeted scenarios AND the full
 * simulated-dataset identity suite, plus a persistent-file smoke test.
 * Exits non-zero if anything fails. This is the single gate for "is the
 * backend correct as a whole".
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, migrate, type DB } from '../db/connection.ts';
import { simulate } from '../seed/simulate.ts';
import { Suite } from './assert.ts';
import { runScenarios } from './scenarios.ts';
import { round2, EPSILON } from '../core/money.ts';
import { stockLevels } from '../services/stock.ts';

function persistentSmokeTest(s: Suite) {
  s.section('persistent-file');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-verify-'));
  const file = path.join(dir, 'pos.db');
  try {
    const db: DB = openDatabase(file);
    migrate(db);
    const sim = simulate(db, { days: 30, seed: 99 });
    s.gt('file db: produced sales', sim.salesCount, 0);
    // close and reopen to ensure WAL persisted
    db.close();

    const db2 = openDatabase(file);
    const count = db2.prepare("SELECT COUNT(*) c FROM sales WHERE status='final'").get() as { c: number };
    s.eq('file db: sales survive reopen', count.c, sim.salesCount);
    // foreign key integrity on the persisted file
    const fk = db2.prepare('PRAGMA foreign_key_check').all();
    s.ok('file db: FK integrity', fk.length === 0, `${fk.length} violations`);
    // no negative stock
    const negs = db2
      .prepare('SELECT product_id FROM stock_movements GROUP BY product_id, branch_id HAVING SUM(qty) < 0')
      .all();
    s.ok('file db: no negative stock', negs.length === 0);
    db2.close();
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function determinismTest(s: Suite) {
  s.section('determinism');
  const run = () => {
    const db = openDatabase(':memory:');
    migrate(db);
    const sim = simulate(db, { days: 60, seed: 777 });
    const totalSales = (db.prepare("SELECT COALESCE(SUM(total),0) v FROM sales WHERE status='final'").get() as { v: number }).v;
    const levels = stockLevels(db);
    let stockSig = 0;
    for (const [, q] of levels) stockSig += q;
    db.close();
    return { salesCount: sim.salesCount, totalSales: round2(totalSales), stockSig: round2(stockSig) };
  };
  const a = run();
  const b = run();
  s.eq('same seed -> same sales count', a.salesCount, b.salesCount);
  s.ok('same seed -> same total sales', Math.abs(a.totalSales - b.totalSales) <= EPSILON, `${a.totalSales} vs ${b.totalSales}`);
  s.ok('same seed -> same stock signature', Math.abs(a.stockSig - b.stockSig) <= EPSILON, `${a.stockSig} vs ${b.stockSig}`);
}

function fullIdentitySuite(s: Suite) {
  // Inline a compact version of run.ts's identity checks on a 365-day dataset.
  s.section('identities-365');
  const db = openDatabase(':memory:');
  migrate(db);
  const sim = simulate(db, { days: 365, seed: 2026 });

  // sale identities
  const sales = db.prepare("SELECT * FROM sales WHERE status='final'").all() as Record<string, number | string>[];
  let bad = 0;
  for (const sale of sales) {
    const taxable = round2(Math.max(0, (sale.subtotal as number) - (sale.order_discount as number)));
    const expTotal = round2(taxable + (sale.tax as number) + (sale.shipping as number) + (sale.other as number) + (sale.round_off as number));
    if (Math.abs(expTotal - (sale.total as number)) > EPSILON) bad++;
    const expProfit = round2((sale.subtotal as number) - (sale.order_discount as number) - (sale.cogs as number));
    if (Math.abs(expProfit - (sale.profit as number)) > EPSILON) bad++;
  }
  s.ok(`365d: ${sales.length} sale identities`, bad === 0, `${bad} bad`);

  // global money conservation: cash-in from sales == cash sale payments
  const cashSale = (db.prepare("SELECT COALESCE(SUM(amount),0) s FROM sale_payments WHERE method='Cash'").get() as { s: number }).s;
  const cashIn = (db.prepare("SELECT COALESCE(SUM(amount),0) s FROM cash_movements WHERE reason='sale' AND direction='in'").get() as { s: number }).s;
  s.ok('365d: cash sales == cash-in movements', Math.abs(cashSale - cashIn) <= EPSILON, `${cashSale} vs ${cashIn}`);

  s.gt('365d: produced realistic volume', sim.salesCount, 1000);
  db.close();
}

function main() {
  const s = new Suite();
  const t0 = Date.now();
  runScenarios(s);
  determinismTest(s);
  persistentSmokeTest(s);
  fullIdentitySuite(s);
  const rep = s.report();
  const ms = Date.now() - t0;
  console.log('='.repeat(64));
  console.log(`COMBINED VERIFICATION: ${rep.passed}/${rep.total} checks in ${ms}ms`);
  if (rep.failed > 0) {
    console.log(`\n❌ ${rep.failed} FAILURES:`);
    for (const f of rep.failures) console.log(`   - ${f.name}: ${f.detail ?? ''}`);
    console.log('='.repeat(64));
    process.exit(1);
  }
  console.log('✅ ALL COMBINED CHECKS PASSED');
  console.log('='.repeat(64));
}

main();
