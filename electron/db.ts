import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { openDatabase, migrate, type DB } from '../backend/db/connection.ts';
import { simulate } from '../backend/seed/simulate.ts';
import { seedMaster } from '../backend/seed/master.ts';
import { addDefaultCategoryAndBrand } from '../backend/seed/addDefaults.ts';

let db: DB | null = null;

export function getDb(): DB {
  if (!db) throw new Error('Database not initialized');
  return db;
}

/**
 * Absolute path of the live database file.
 *
 * Exported for the RESTORE path (electron/backup.ts), which has to replace this
 * exact file — plus its `-wal`/`-shm` sidecars — while the DB handle is closed.
 */
export function dbFilePath(): string {
  return path.join(app.getPath('userData'), 'pos.db');
}

/**
 * Initialize the database on app boot.
 *  - opens (creates) userData/pos.db
 *  - runs migrations (idempotent)
 *  - on first run (empty db): seed depending on POS_SEED env
 *      'clean' -> reference data only, EMPTY shop (default everywhere)
 *      'demo'  -> full synthetic year, for evaluation only (POS_SEED=demo)
 *      'none'  -> nothing (truly empty, no reference data either)
 *
 * 'clean' is now the default in development too. The old dev default ('demo')
 * seeded ~3,000 invented sales plus a sample catalogue, customers and suppliers;
 * that is a demo fixture, not something a real shop should ever boot into. Run
 * `POS_SEED=demo npm run dev` if you specifically want the populated dataset.
 */
export function initDb(): { firstRun: boolean; mode: string } {
  const file = path.join(app.getPath('userData'), 'pos.db');
  const existed = fs.existsSync(file);
  db = openDatabase(file);
  migrate(db);

  const businessRow = db.prepare('SELECT COUNT(*) AS c FROM business_info').get() as { c: number };
  const firstRun = !existed || businessRow.c === 0;

  const mode = process.env.POS_SEED ?? 'clean';

  if (firstRun) {
    if (mode === 'demo') {
      simulate(db, { days: 365, seed: 2026 });
    } else if (mode === 'clean') {
      // referenceOnly: roles, tax rates, units/categories/brands, expense
      // categories, one branch, one owner account and the Walk-in customer —
      // no invented products, customers, suppliers or transactions.
      seedMaster(db, { referenceOnly: true });
    }
    // 'none' leaves it empty
  }

  // Always ensure default category and brand exist (safe for existing DBs)
  addDefaultCategoryAndBrand(db);

  return { firstRun, mode };
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
