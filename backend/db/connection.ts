import Database from 'better-sqlite3';
import { SCHEMA_SQL, FTS_SQL } from './schema.ts';

export type DB = Database.Database;

/**
 * Open (or create) a SQLite database with the right pragmas for an offline POS:
 *  - WAL journal for concurrent read/write
 *  - foreign_keys ON for referential integrity
 *  - busy_timeout so brief locks don't throw
 *
 * Pass ':memory:' for tests, or an absolute file path for the real app.
 */
export function openDatabase(filePath: string): DB {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  return db;
}

/**
 * Apply the base schema + FTS schema. Idempotent (uses IF NOT EXISTS).
 * Records the migration version so future migrations can be layered on.
 *
 * MIGRATIONS
 *  v1 — initial schema.
 *  v2 — add price_groups.default_credit_limit / default_discount_pct / tax_exempt.
 *       The base SCHEMA_SQL above already includes these columns for FRESH DBs
 *       (CREATE TABLE IF NOT EXISTS). For ALREADY-created DBs the table exists
 *       without them, so we ADD COLUMN idempotently (each ALTER is a no-op when
 *       the column is already present). These are additive, nullable/defaulted
 *       columns — no existing data is read or rewritten, so the migration is safe.
 *  v3 — add the `shipments` table (logistics/delivery tracking linked to a sale).
 *       FRESH DBs get the whole table from SCHEMA_SQL (CREATE TABLE IF NOT EXISTS),
 *       so no ALTER is needed there. ALREADY-created DBs that ran an earlier
 *       shipments definition without the branch_id / created_by columns get them
 *       ADDed idempotently (PRAGMA-checked, each ALTER a no-op when present).
 *       Purely additive — no data migration.
 */
export function migrate(db: DB): void {
  db.exec(SCHEMA_SQL);
  db.exec(FTS_SQL);

  const CURRENT_VERSION = 3;
  const row = db
    .prepare('SELECT MAX(version) AS v FROM schema_migrations')
    .get() as { v: number | null };
  const applied = row?.v ?? 0;

  if (applied < 1) {
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, name) VALUES (?, ?)').run(
      1,
      'initial schema',
    );
  }

  if (applied < 2) {
    addPriceGroupColumns(db);
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, name) VALUES (?, ?)').run(
      2,
      'price_groups: default_credit_limit, default_discount_pct, tax_exempt',
    );
  }

  if (applied < CURRENT_VERSION) {
    addShipmentColumns(db);
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, name) VALUES (?, ?)').run(
      3,
      'shipments table',
    );
  }
}

/**
 * Idempotently add the three v2 columns to an existing price_groups table.
 * Checks PRAGMA table_info first so a re-run (or a fresh DB that already has
 * them from SCHEMA_SQL) is a clean no-op rather than throwing.
 */
function addPriceGroupColumns(db: DB): void {
  const cols = new Set(
    (db.prepare('PRAGMA table_info(price_groups)').all() as { name: string }[]).map((c) => c.name),
  );
  const additions: [string, string][] = [
    ['default_credit_limit', 'ALTER TABLE price_groups ADD COLUMN default_credit_limit REAL'],
    ['default_discount_pct', 'ALTER TABLE price_groups ADD COLUMN default_discount_pct REAL'],
    ['tax_exempt', 'ALTER TABLE price_groups ADD COLUMN tax_exempt INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [col, ddl] of additions) {
    if (cols.has(col)) continue;
    try {
      db.exec(ddl);
    } catch {
      // SQLite throws "duplicate column name" if the column already exists —
      // safe to ignore so the migration stays idempotent.
    }
  }
}

/**
 * Idempotently add the v3 branch_id / created_by columns to an existing
 * shipments table. FRESH DBs already created the table WITH these columns via
 * SCHEMA_SQL, so this is a clean no-op there. For DBs created against an earlier
 * shipments definition that lacked them, the ALTERs add them; PRAGMA-checked so
 * a re-run never throws. Both columns are nullable — no data migration needed.
 */
function addShipmentColumns(db: DB): void {
  // Guard: if for some reason the table is missing, SCHEMA_SQL (run just before
  // this in migrate) already created it, so table_info will return columns.
  const cols = new Set(
    (db.prepare('PRAGMA table_info(shipments)').all() as { name: string }[]).map((c) => c.name),
  );
  const additions: [string, string][] = [
    ['branch_id', 'ALTER TABLE shipments ADD COLUMN branch_id TEXT REFERENCES branches(id)'],
    ['created_by', 'ALTER TABLE shipments ADD COLUMN created_by TEXT'],
  ];
  for (const [col, ddl] of additions) {
    if (cols.has(col)) continue;
    try {
      db.exec(ddl);
    } catch {
      // "duplicate column name" — already present; ignore to stay idempotent.
    }
  }
}

/** Wrap a function in a transaction (auto rollback on throw). */
export function tx<T>(db: DB, fn: () => T): T {
  const wrapped = db.transaction(fn);
  return wrapped();
}

/** Drop everything — used by the test harness for a clean slate. */
export function resetDatabase(db: DB): void {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  db.pragma('foreign_keys = OFF');
  const dropAll = db.transaction(() => {
    for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${t.name}"`);
  });
  dropAll();
  db.pragma('foreign_keys = ON');
}
