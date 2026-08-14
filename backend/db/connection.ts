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
export function openDatabase(filePath: string, opts: { readonly?: boolean } = {}): DB {
  const db = new Database(filePath, opts.readonly ? { readonly: true } : undefined);
  try {
    if (!opts.readonly) {
      // WAL + relaxed sync are WRITE settings. Applying them to a read-only
      // probe would fail, and switching a file to WAL creates `-wal`/`-shm`
      // sidecars next to it — something we must never do to a backup snapshot
      // sitting in a cloud-synced folder.
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
    }
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
  } catch (e) {
    // The handle already exists at this point, so a failing pragma (e.g. the
    // file is not a database) would otherwise leak an open OS file handle and
    // leave the file locked for the rest of the process.
    db.close();
    throw e;
  }
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
 *  v4 — purchase-price history. Adds the `product_cost_history` table (from
 *       SCHEMA_SQL on fresh DBs) plus `products.avg_cost` and
 *       `products.cost_updated_at`, and backfills avg_cost from the existing
 *       cost so the new column is not 0 for products that predate the feature.
 *       See `addCostHistoryColumns` below.
 *  v5 — add `products.archived_at`. Retiring a product that already appears on a
 *       document cannot be a DELETE (sale_lines/purchase_lines reference
 *       products(id) with no ON DELETE clause), so it is archived instead.
 *       Additive and nullable — every existing product stays active (NULL).
 */
export function migrate(db: DB): void {
  db.exec(SCHEMA_SQL);
  db.exec(FTS_SQL);

  const CURRENT_VERSION = 5;
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

  if (applied < 3) {
    addShipmentColumns(db);
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, name) VALUES (?, ?)').run(
      3,
      'shipments table',
    );
  }

  if (applied < 4) {
    addCostHistoryColumns(db);
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, name) VALUES (?, ?)').run(
      4,
      'product cost history: products.avg_cost / cost_updated_at + product_cost_history',
    );
  }

  if (applied < CURRENT_VERSION) {
    addProductArchiveColumn(db);
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, name) VALUES (?, ?)').run(
      5,
      'products.archived_at (retire a product that has documents)',
    );
  }
}

/**
 * v5 — `products.archived_at`.
 *
 * Fresh DBs get the column from SCHEMA_SQL, so this only does work on a database
 * that already exists. Nullable with no default, so every existing product is
 * active and nothing is rewritten. PRAGMA-checked to stay idempotent.
 */
function addProductArchiveColumn(db: DB): void {
  const cols = new Set(
    (db.prepare('PRAGMA table_info(products)').all() as { name: string }[]).map((c) => c.name),
  );
  if (cols.has('archived_at')) return;
  try {
    db.exec('ALTER TABLE products ADD COLUMN archived_at TEXT');
  } catch {
    // "duplicate column name" — already present; ignore to stay idempotent.
  }
}

/**
 * v4 — purchase-price history.
 *
 * The `product_cost_history` table itself comes from SCHEMA_SQL (CREATE TABLE IF
 * NOT EXISTS), so only the two additive product columns need an ALTER on a
 * database that already exists. Both are PRAGMA-checked so a re-run, or a fresh
 * DB that already has them, is a clean no-op.
 *
 * The backfill matters: an existing shop has products with a `cost` but no
 * history, and `avg_cost` would default to 0 — which would show up as ৳0.00 in
 * the new "Avg. buying price" column. Seeding avg_cost from the current cost
 * makes the column truthful from the first launch, and the first real price
 * change starts the actual history.
 */
function addCostHistoryColumns(db: DB): void {
  const cols = new Set(
    (db.prepare('PRAGMA table_info(products)').all() as { name: string }[]).map((c) => c.name),
  );
  const additions: [string, string][] = [
    ['avg_cost', 'ALTER TABLE products ADD COLUMN avg_cost REAL NOT NULL DEFAULT 0'],
    ['cost_updated_at', 'ALTER TABLE products ADD COLUMN cost_updated_at TEXT'],
  ];
  for (const [col, ddl] of additions) {
    if (cols.has(col)) continue;
    try {
      db.exec(ddl);
    } catch {
      // "duplicate column name" — already present; ignore to stay idempotent.
    }
  }
  // Seed the cache for rows that predate the feature. Only touches rows that
  // still hold the default, so re-running cannot overwrite a real average.
  try {
    db.exec('UPDATE products SET avg_cost = cost WHERE avg_cost = 0 AND cost > 0');
  } catch {
    // Non-fatal: the average is recomputed from history on the next price change.
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
