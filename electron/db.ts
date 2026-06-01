import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { openDatabase, migrate, type DB } from '../backend/db/connection.ts';
import { simulate } from '../backend/seed/simulate.ts';
import { seedMaster } from '../backend/seed/master.ts';

let db: DB | null = null;

export function getDb(): DB {
  if (!db) throw new Error('Database not initialized');
  return db;
}

/**
 * Initialize the database on app boot.
 *  - opens (creates) userData/pos.db
 *  - runs migrations (idempotent)
 *  - on first run (empty db): seed depending on POS_SEED env
 *      'demo'  -> full synthetic year (default in dev)
 *      'clean' -> master/reference data only (first-run wizard takes over)
 *      'none'  -> nothing (truly empty)
 */
export function initDb(): { firstRun: boolean; mode: string } {
  const file = path.join(app.getPath('userData'), 'pos.db');
  const existed = fs.existsSync(file);
  db = openDatabase(file);
  migrate(db);

  const businessRow = db.prepare('SELECT COUNT(*) AS c FROM business_info').get() as { c: number };
  const firstRun = !existed || businessRow.c === 0;

  const mode = process.env.POS_SEED ?? (app.isPackaged ? 'clean' : 'demo');

  if (firstRun) {
    if (mode === 'demo') {
      simulate(db, { days: 365, seed: 2026 });
    } else if (mode === 'clean') {
      seedMaster(db);
    }
    // 'none' leaves it empty
  }

  return { firstRun, mode };
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
