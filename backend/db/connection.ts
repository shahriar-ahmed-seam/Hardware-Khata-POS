import Database from 'better-sqlite3';
import { SCHEMA_SQL, FTS_SQL } from './schema.ts';

export type DB = Database.Database;

/**
 * Open (or create) a SQLite database with the right pragmas for an offline POS:
 *  - WAL journal for concurrent read/write, synchronous=FULL so a power cut
 *    cannot undo a committed sale
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
      // FULL, not NORMAL: in WAL mode NORMAL keeps the file consistent but a
      // power cut can roll back the last few commits — a sale whose receipt is
      // already printed. Load-shedding makes that a real case for this shop;
      // FULL costs one extra flush per commit, nothing at counter volumes.
      db.pragma('synchronous = FULL');
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
 *  v6 — clear dead `blob:` image URLs from products.image_url and the
 *       business_info / brands logo_url columns. Those were
 *       `URL.createObjectURL()` handles, valid only inside the window that made
 *       them, so they were already unusable. See `clearEphemeralImageUrls`.
 *  v7 — retractable cost history. Adds `product_cost_history.ref_type`,
 *       `.ref_id`, `.retracted_at` and `.retract_reason`. A cancelled purchase
 *       reverses its stock and its cash, but the buying price it recorded stayed
 *       in the average forever — for a delivery that never arrived. The rows are
 *       now MARKED rather than deleted (history stays append-only) and the
 *       `cost`/`avg_cost` cache is recomputed ignoring retracted rows.
 *       All four columns are additive and nullable, so every existing entry
 *       stays live. See `addCostRetractionColumns`.
 *  v8 — add `sales.credited`, the amount of an invoice settled by a CreditAdjust
 *       sell return rather than by money. `customerDue` always deducted those
 *       returns while the invoice kept its original `due`, so the customer's
 *       balance and the invoice contradicted each other and the invoice could
 *       never reach zero. Additive with a default of 0, and back-filled from the
 *       returns already on record — see `addSaleCreditedColumn`.
 *  v10 — add `purchases.credited`, the supplier-side twin of v8, back-filled from
 *       the CreditAdjust purchase returns on record. See `addPurchaseCreditedColumn`.
 *  v9 — add `purchase_lines.unit_factor`, so a purchase can be entered in the
 *       unit the SUPPLIER quoted (a dozen, a box, a bundle) while stock still
 *       moves in the base unit the shop sells. Defaults to 1, which is what every
 *       existing line already means. See `addPurchaseUnitFactor`.
 *  v11 — `account_payments` (money paid on account: opening balances and
 *       advances), `cash_shifts.closed_by`, and the missing lookup indexes.
 *       See `addV11`.
 *  v12 — `purchase_lines.prev_sell_price` (the sell price a bill replaced, put
 *       back when the bill is cancelled or corrected), and the price rights: the
 *       backend now checks `pos.discount` / `pos.priceOverride`, so every role
 *       that could sell keeps them (the owner can take them away in Roles).
 *       See `addV12`.
 */
/** The newest schema this build understands. Bump with every new migration step. */
export const CURRENT_SCHEMA_VERSION = 12;

/** The highest migration recorded in a database (0 for a brand-new file). */
export function schemaVersionOf(db: DB): number {
  const hasTable = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get();
  if (!hasTable) return 0;
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number | null };
  return row?.v ?? 0;
}

/** The refusal shown when a database is newer than this build. */
export function newerSchemaMessage(found: number): string {
  return (
    `This data was saved by a newer version of the app (data version ${found}; ` +
    `this version understands up to ${CURRENT_SCHEMA_VERSION}). ` +
    'Install the newer version to open it. Opening it here could write figures the newer version does not expect.'
  );
}

interface MigrationStep {
  version: number;
  name: string;
  run: (db: DB) => void;
}

/**
 * Every schema step, in order. A step's changes and its `schema_migrations`
 * row are written in ONE transaction (see `migrate`), so a step either lands
 * completely or not at all.
 */
const MIGRATIONS: MigrationStep[] = [
  { version: 1, name: 'initial schema', run: () => {} },
  {
    version: 2,
    name: 'price_groups: default_credit_limit, default_discount_pct, tax_exempt',
    run: addPriceGroupColumns,
  },
  { version: 3, name: 'shipments table', run: addShipmentColumns },
  {
    version: 4,
    name: 'product cost history: products.avg_cost / cost_updated_at + product_cost_history',
    run: addCostHistoryColumns,
  },
  { version: 5, name: 'products.archived_at (retire a product that has documents)', run: addProductArchiveColumn },
  { version: 6, name: 'clear dead blob: image URLs (product photos + shop logo)', run: clearEphemeralImageUrls },
  {
    version: 7,
    name: 'product_cost_history: ref_type/ref_id + retracted_at/retract_reason',
    run: addCostRetractionColumns,
  },
  {
    version: 8,
    name: 'sales.credited (CreditAdjust returns settle the invoice they came from)',
    run: (d) => {
      addSaleCreditedColumn(d);
      backfillSaleCredited(d);
    },
  },
  { version: 9, name: 'purchase_lines.unit_factor (buy by the dozen, sell by the piece)', run: addPurchaseUnitFactor },
  {
    version: 10,
    name: 'purchases.credited (CreditAdjust purchase returns settle the bill they came from)',
    run: (d) => {
      addPurchaseCreditedColumn(d);
      backfillPurchaseCredited(d);
    },
  },
  {
    version: 11,
    name: 'account_payments, cash_shifts.closed_by, indexes for the hot lookups',
    run: addV11,
  },
  {
    version: 12,
    name: 'purchase_lines.prev_sell_price; keep discount/price rights on roles that sell',
    run: addV12,
  },
];

/**
 * v12.
 *  - `purchase_lines.prev_sell_price` — see the schema comment (R41).
 *  - Until now `pos.discount` and `pos.priceOverride` were never checked, so a
 *    cashier bargained freely. The backend checks them from this version (R16).
 *    So nothing changes at the counter on upgrade, every role that can sell
 *    (`sales.create`) is given both; the owner can take them away per role.
 */
function addV12(db: DB): void {
  const cols = db.prepare('PRAGMA table_info(purchase_lines)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'prev_sell_price')) {
    db.exec('ALTER TABLE purchase_lines ADD COLUMN prev_sell_price REAL');
  }
  const roles = db.prepare('SELECT id, permissions FROM roles').all() as { id: string; permissions: string }[];
  const save = db.prepare('UPDATE roles SET permissions = ? WHERE id = ?');
  for (const r of roles) {
    let perms: string[];
    try {
      const parsed = JSON.parse(r.permissions) as unknown;
      perms = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      continue;
    }
    if (!perms.includes('sales.create')) continue;
    const next = [...perms];
    for (const p of ['pos.discount', 'pos.priceOverride']) if (!next.includes(p)) next.push(p);
    if (next.length !== perms.length) save.run(JSON.stringify(next), r.id);
  }
}

/**
 * Bring a database up to CURRENT_SCHEMA_VERSION.
 *
 * SAFETY (audit R33–R35):
 *  - A database NEWER than this build is refused with a clear message, before
 *    anything is written. An older build used to open it and write figures
 *    (e.g. `due` ignoring `credited`) the newer schema does not expect.
 *  - Each step runs in its own transaction together with its version row. A
 *    step that fails rolls back completely and the error is thrown; the
 *    database stays at the last step that succeeded, and the next start
 *    retries from there. Backfills no longer swallow their errors: recording a
 *    version whose data change did not happen is how books go quietly wrong.
 *  - Steps are applied by what is MISSING from `schema_migrations`, not by
 *    comparing with the highest version. The v10 step used to run on
 *    `applied < CURRENT_VERSION`, which would have re-run it on every v10
 *    database the moment the constant became 11.
 *  - Before upgrading an existing file database, a copy is taken beside it
 *    (`<file>.pre-v<N>-<time>.sqlite3`) with VACUUM INTO.
 */
export function migrate(db: DB): void {
  const found = schemaVersionOf(db);
  if (found > CURRENT_SCHEMA_VERSION) throw new Error(newerSchemaMessage(found));

  db.exec(SCHEMA_SQL);
  db.exec(FTS_SQL);

  const done = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version),
  );
  const pending = MIGRATIONS.filter((m) => !done.has(m.version));
  if (pending.length === 0) return;

  if (found > 0) copyBeforeUpgrade(db, found);

  const record = db.prepare('INSERT OR IGNORE INTO schema_migrations(version, name) VALUES (?, ?)');
  for (const step of pending) {
    db.transaction(() => {
      step.run(db);
      record.run(step.version, step.name);
    })();
  }
}

/**
 * A copy of the database as it was before an upgrade, next to the file.
 * Best effort: the per-step transactions already keep each step atomic, so a
 * failed copy (a full disk, a read-only folder) is reported, not fatal.
 */
function copyBeforeUpgrade(db: DB, fromVersion: number): void {
  const file = db.name;
  if (!file || file === ':memory:' || db.memory) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = `${file}.pre-v${fromVersion}-${stamp}.sqlite3`;
  try {
    db.prepare('VACUUM INTO ?').run(dest);
  } catch (e) {
    console.warn(`[migrate] could not copy the database before upgrading: ${e instanceof Error ? e.message : e}`);
  }
}

/**
 * v11.
 *  - `account_payments` (created by SCHEMA_SQL): money paid on account — an
 *    opening balance settled, or an advance — which used to have nowhere to go,
 *    so the Receive Payment screen dropped it (audit R30).
 *  - `cash_shifts.closed_by`: who counted and closed the drawer (R27).
 *  - Indexes for the lookups that scanned whole tables (R65).
 */
function addV11(db: DB): void {
  const shiftCols = new Set(
    (db.prepare('PRAGMA table_info(cash_shifts)').all() as { name: string }[]).map((c) => c.name),
  );
  if (!shiftCols.has('closed_by')) db.exec('ALTER TABLE cash_shifts ADD COLUMN closed_by TEXT');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_account_payments_party ON account_payments(party_type, party_id);
    CREATE INDEX IF NOT EXISTS idx_account_payments_paid_at ON account_payments(paid_at);
    CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase ON purchase_payments(purchase_id);
    CREATE INDEX IF NOT EXISTS idx_sale_payments_paid_at ON sale_payments(paid_at);
    CREATE INDEX IF NOT EXISTS idx_purchase_payments_paid_at ON purchase_payments(paid_at);
    CREATE INDEX IF NOT EXISTS idx_sale_audit_sale ON sale_audit(sale_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_audit_purchase ON purchase_audit(purchase_id);
    CREATE INDEX IF NOT EXISTS idx_sell_returns_customer ON sell_returns(customer_id);
    CREATE INDEX IF NOT EXISTS idx_sell_return_lines_return ON sell_return_lines(return_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase ON purchase_returns(purchase_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier ON purchase_returns(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_returns_date ON purchase_returns(date);
    CREATE INDEX IF NOT EXISTS idx_purchase_return_lines_return ON purchase_return_lines(return_id);
    CREATE INDEX IF NOT EXISTS idx_stock_mov_ref_no ON stock_movements(ref_no);
    CREATE INDEX IF NOT EXISTS idx_stock_mov_ref_id ON stock_movements(ref_id);
    CREATE INDEX IF NOT EXISTS idx_stock_mov_branch_prod ON stock_movements(branch_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_transfer_lines_transfer ON stock_transfer_lines(transfer_id);
    CREATE INDEX IF NOT EXISTS idx_adjustment_lines_adjustment ON stock_adjustment_lines(adjustment_id);
    CREATE INDEX IF NOT EXISTS idx_stock_adjustments_date ON stock_adjustments(date);
    CREATE INDEX IF NOT EXISTS idx_customers_created ON customers(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_agent ON sales(agent_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);
    CREATE INDEX IF NOT EXISTS idx_activity_branch_at ON activity_log(branch_id, at);
    CREATE INDEX IF NOT EXISTS idx_sales_status_date ON sales(status, date);
    CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branch_id, date);
  `);
}

/**
 * v10 — `purchases.credited`, the supplier-side twin of v8's `sales.credited`.
 *
 * A CreditAdjust purchase return is a credit note from the supplier: it writes
 * down what the shop owes without any money moving. `supplierDue` always deducted
 * those returns, but the BILL kept its original `due`, so the supplier's payable
 * and the bills behind it disagreed — and `paySupplier`, which allocates against
 * the bills, would pay the credited amount a second time.
 *
 * Additive with a default of 0, and back-filled from the returns already on
 * record (only against bills that were not cancelled, the same scope
 * `supplierDue` uses). Like v8, this is a migration that writes existing data,
 * because not doing so would leave those bills permanently overpayable.
 */
function addPurchaseCreditedColumn(db: DB): void {
  const cols = new Set(
    (db.prepare('PRAGMA table_info(purchases)').all() as { name: string }[]).map((c) => c.name),
  );
  if (cols.has('credited')) return;
  try {
    db.exec('ALTER TABLE purchases ADD COLUMN credited REAL NOT NULL DEFAULT 0');
  } catch {
    // "duplicate column name" — already present; ignore to stay idempotent.
  }
}

function backfillPurchaseCredited(db: DB): void {
  // No try/catch: SCHEMA_SQL has already created purchase_returns, so a failure
  // here is real and must stop the step (it used to be swallowed while the
  // version was still recorded).
  {
    db.exec(`
      UPDATE purchases SET credited = (
        SELECT COALESCE(SUM(r.total), 0) FROM purchase_returns r
         WHERE r.purchase_id = purchases.id AND r.refund_method = 'CreditAdjust'
      )
      WHERE status != 'cancelled' AND EXISTS (
        SELECT 1 FROM purchase_returns r
         WHERE r.purchase_id = purchases.id AND r.refund_method = 'CreditAdjust'
      );
      UPDATE purchases SET due = MAX(0, ROUND(total - paid - credited, 2))
       WHERE status != 'cancelled' AND credited > 0;
    `);
  }
}

/**
 * v9 — `purchase_lines.unit_factor`.
 *
 * Suppliers quote packs: "5 dozen at 620 each". The shop sells pieces. Before
 * this, a purchase entered as 5 dozen added FIVE to stock instead of sixty, so the
 * only safe way to buy was to convert by hand and enter 60 at 51.6667 — which does
 * not divide evenly and left the bill a few paisa away from what the supplier
 * actually charged.
 *
 * Defaults to 1, which is exactly what every existing line means (it was entered
 * in base units), so nothing existing changes value.
 */
function addPurchaseUnitFactor(db: DB): void {
  const cols = new Set(
    (db.prepare('PRAGMA table_info(purchase_lines)').all() as { name: string }[]).map(
      (c) => c.name,
    ),
  );
  if (cols.has('unit_factor')) return;
  try {
    db.exec('ALTER TABLE purchase_lines ADD COLUMN unit_factor REAL NOT NULL DEFAULT 1');
  } catch {
    // "duplicate column name" — already present; ignore to stay idempotent.
  }
}

/**
 * v8 — `sales.credited`.
 *
 * A CreditAdjust sell return writes down what the customer owes without any money
 * moving. `customerDue` always subtracted those returns, but the INVOICE kept its
 * original `due`, so the two disagreed permanently: a ৳20,000 credit sale with a
 * ৳6,000 credit return showed the customer owing ৳14,000 while the invoice still
 * read "Unpaid ৳20,000" — and collecting the ৳14,000 left the invoice stuck at
 * ৳6,000 for ever, because the missing amount existed only as a return row.
 *
 * Additive with a default of 0, so nothing existing changes shape. Unlike the
 * other migrations this one DOES back-fill, because the correct value is not a
 * guess: it is the sum of the CreditAdjust returns already recorded against each
 * sale. Not back-filling would leave those invoices permanently unsettleable.
 */
function addSaleCreditedColumn(db: DB): void {
  const cols = new Set(
    (db.prepare('PRAGMA table_info(sales)').all() as { name: string }[]).map((c) => c.name),
  );
  if (cols.has('credited')) return;
  try {
    db.exec('ALTER TABLE sales ADD COLUMN credited REAL NOT NULL DEFAULT 0');
  } catch {
    // "duplicate column name" — already present; ignore to stay idempotent.
  }
}

/**
 * Set `credited` from the CreditAdjust returns that already exist, and bring
 * `due` back into line with `total - paid - credited`.
 *
 * Only touches FINAL sales that actually have such a return, so a database with
 * none is left completely untouched. Idempotent: re-running recomputes the same
 * numbers from the same source rows.
 */
function backfillSaleCredited(db: DB): void {
  // No try/catch: SCHEMA_SQL has already created sell_returns (see the note on
  // backfillPurchaseCredited).
  {
    db.exec(`
      UPDATE sales SET credited = (
        SELECT COALESCE(SUM(r.total), 0) FROM sell_returns r
         WHERE r.sale_id = sales.id AND r.refund_method = 'CreditAdjust'
      )
      WHERE status = 'final' AND EXISTS (
        SELECT 1 FROM sell_returns r
         WHERE r.sale_id = sales.id AND r.refund_method = 'CreditAdjust'
      );
      UPDATE sales SET due = MAX(0, ROUND(total - paid - credited, 2))
       WHERE status = 'final' AND credited > 0;
    `);
  }
}

/**
 * v7 — let a cost-history entry be RETRACTED.
 *
 * Fresh databases get all four columns from SCHEMA_SQL, so this only does work on
 * one that already exists. Every column is nullable with no default, so each
 * existing entry stays exactly as it is and keeps counting towards the average —
 * the retraction only applies to purchases cancelled from here on. PRAGMA-checked
 * so a re-run is a clean no-op.
 *
 * Nothing is back-filled on purpose: a purchase cancelled BEFORE this existed did
 * not record which history rows it created (there was no `ref_id`), so guessing
 * from timestamps could retract a price the owner typed by hand.
 */
function addCostRetractionColumns(db: DB): void {
  const cols = new Set(
    (db.prepare('PRAGMA table_info(product_cost_history)').all() as { name: string }[]).map(
      (c) => c.name,
    ),
  );
  const additions: [string, string][] = [
    ['ref_type', 'ALTER TABLE product_cost_history ADD COLUMN ref_type TEXT'],
    ['ref_id', 'ALTER TABLE product_cost_history ADD COLUMN ref_id TEXT'],
    ['retracted_at', 'ALTER TABLE product_cost_history ADD COLUMN retracted_at TEXT'],
    ['retract_reason', 'ALTER TABLE product_cost_history ADD COLUMN retract_reason TEXT'],
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

/**
 * v6 — remove image references that were never storable.
 *
 * An earlier build saved product photos and the shop logo as
 * `URL.createObjectURL(file)`. That `blob:` URL belongs to the window that
 * created it, so every one of them was already dead: photos disappeared on the
 * next app start, and the shop logo printed as a broken image on receipts.
 *
 * The values cannot be recovered — the picture was never copied anywhere — so the
 * only honest thing is to clear them. A NULL renders the category placeholder,
 * which is a truthful "no picture", whereas leaving the string renders a broken
 * image and hides the fact that the photo needs re-adding.
 *
 * Only `blob:` values are touched. Real data URLs written by the fixed build, and
 * any ordinary path or http URL, are left exactly as they are.
 */
export function clearEphemeralImageUrls(db: DB): void {
  try {
    db.exec("UPDATE products SET image_url = NULL WHERE image_url LIKE 'blob:%'");
  } catch {
    // Column missing on an unexpected schema — nothing to clean.
  }
  try {
    // The shop logo. This one also printed broken on every receipt.
    db.exec("UPDATE business_info SET logo_url = NULL WHERE logo_url LIKE 'blob:%'");
  } catch {
    // Same.
  }
  try {
    // Brands carry a logo column too, so clean it for consistency.
    db.exec("UPDATE brands SET logo_url = NULL WHERE logo_url LIKE 'blob:%'");
  } catch {
    // Column absent on an unexpected schema revision.
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
