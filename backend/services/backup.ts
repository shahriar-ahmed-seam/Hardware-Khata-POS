import fs from 'node:fs';
import path from 'node:path';
import { openDatabase, type DB } from '../db/connection.ts';
import { getSetting, setSetting } from './settings.ts';

/**
 * BACKUP & CLOUD SAVING
 * =====================
 *
 * WHAT THIS ACTUALLY DOES (and what it deliberately does not)
 * -----------------------------------------------------------
 * A backup here is a **complete, self-contained SQLite snapshot** of the shop
 * database, written with `VACUUM INTO`. That gives us three things a plain file
 * copy cannot:
 *   1. a CONSISTENT image even though the app is live (no half-written pages,
 *      no dependency on the -wal/-shm sidecar files),
 *   2. a COMPACT file (the vacuum drops free pages), and
 *   3. a file that is itself a normal database, so it can be verified by simply
 *      opening it and running `PRAGMA integrity_check` — which we do, before the
 *      snapshot is allowed to count as successful.
 *
 * "Cloud saving" is implemented as **snapshots written into a folder that the
 * user's existing cloud client already syncs** (OneDrive, Google Drive, Dropbox
 * — all three ship a desktop folder on Windows). That is a deliberate design
 * choice, not a shortcut:
 *   - It works on day one with NO account, NO API key, NO OAuth screen and no
 *     credentials stored on the shop's counter PC.
 *   - This app makes NO outbound network request of its own. Shop data (customer
 *     names, phone numbers, prices, balances) is never transmitted anywhere by
 *     us; it is handed to the sync client the owner already trusts and installed.
 *   - It is fully offline-tolerant, which matters for a shop with unreliable
 *     internet: the snapshot always succeeds locally and the sync client
 *     uploads whenever the connection returns.
 *
 * A hosted-provider adapter (S3/Supabase/etc.) would need an account, secret
 * storage and a conflict-resolution design, and it would start sending shop data
 * to a third party. `SyncTarget` below is the seam for that, but nothing is
 * stubbed or faked: only the folder target exists, and the UI says exactly that.
 *
 * WHY THIS MODULE HAS NO ELECTRON IMPORTS
 * Same rule as every other backend service: it must be callable from the Node
 * verification harness. Anything that needs a native dialog, `app.getPath()` or
 * an app relaunch (i.e. RESTORE) lives in electron/backup.ts instead.
 */

/** The settings_kv key holding the backup configuration blob. */
const BACKUP_KEY = 'backup';

/** Snapshot filename prefix + extension. */
const PREFIX = 'pos-backup-';
const EXT = '.sqlite3';

/** Never keep fewer than this many snapshots, whatever the caller asks for. */
const MIN_KEEP = 1;
const MAX_KEEP = 365;
const DEFAULT_KEEP = 14;

/**
 * Where a snapshot goes. Only 'folder' is implemented — see the module note.
 * Kept as a named union so adding a hosted target later is an additive change
 * rather than a redesign.
 */
export type SyncTarget = 'folder';

export interface BackupConfig {
  /**
   * Absolute folder that snapshots are written to. Empty until the app has
   * resolved a default (the Electron layer does that on boot, since only it
   * knows the user's Documents path).
   */
  folder: string;
  /** Automatic snapshot trigger. */
  auto: 'off' | 'daily' | 'on-shift-close';
  /** How many snapshots to retain; older ones are pruned after each run. */
  keep: number;
  /**
   * True when `folder` sits inside a detected cloud-synced folder, i.e. the
   * snapshot leaves the machine. Set by the Electron layer when the user picks a
   * folder, because only it can detect OneDrive/Drive/Dropbox locations.
   */
  cloudFolder: boolean;
  /** Human label for where backups go, e.g. 'OneDrive'. Display only. */
  cloudLabel?: string;
  /**
   * Where "Save as PDF" writes the owner's own copy of an invoice. Empty means
   * "not chosen yet" — the Electron layer resolves a default on boot, the same
   * way it does for `folder`. Invoice PDFs are ALSO always copied next to the
   * database and into the backup folder, so a PDF is protected exactly like the
   * database is even if this is left alone. See backend/services/invoices.ts.
   */
  pdfFolder: string;
  lastBackupAt?: string;
  lastBackupPath?: string;
  lastBackupBytes?: number;
  /** Message from the most recent FAILED run; cleared on success. */
  lastError?: string;
  /**
   * Last successful snapshot written to REMOVABLE media (a pendrive). Tracked
   * separately from `lastBackupAt` on purpose: a pendrive backup is an
   * occasional, physically-off-site copy, and folding it into the same field
   * would make the scheduled folder backup look healthier than it is.
   */
  lastUsbBackupAt?: string;
  lastUsbBackupPath?: string;
  /** Human label of the drive it went to, e.g. "E: (SANDISK)". Display only. */
  lastUsbLabel?: string;
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  folder: '',
  auto: 'daily',
  keep: DEFAULT_KEEP,
  cloudFolder: false,
  pdfFolder: '',
};

export interface SnapshotInfo {
  name: string;
  path: string;
  /** ISO timestamp parsed from the FILENAME (not the mtime — see parseSnapshotAt). */
  at: string;
  bytes: number;
}

export interface BackupResult {
  ok: true;
  name: string;
  path: string;
  at: string;
  bytes: number;
  /** Snapshots deleted by retention during this run. */
  pruned: string[];
}

// --------------------------------------------------------------- pure helpers

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/**
 * Build a snapshot filename from a timestamp, using LOCAL time.
 *
 * Local time is intentional: the owner reads these filenames in their file
 * manager and needs "yesterday evening" to look like yesterday evening. The
 * format sorts lexicographically in chronological order, which is what the
 * retention logic relies on.
 */
export function snapshotFileName(at: Date): string {
  const stamp =
    `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}` +
    `-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `${PREFIX}${stamp}${EXT}`;
}

/**
 * Recover the timestamp encoded in a snapshot filename, or null if the name is
 * not one of ours.
 *
 * The filename is the source of truth rather than the file mtime, because
 * copying a snapshot around (which is exactly what a cloud sync client does)
 * rewrites mtime and would scramble retention ordering.
 */
export function parseSnapshotAt(name: string): string | null {
  if (!name.startsWith(PREFIX) || !name.endsWith(EXT)) return null;
  const stamp = name.slice(PREFIX.length, name.length - EXT.length);
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(stamp);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  );
  if (Number.isNaN(date.getTime())) return null;
  // Reject impossible dates that Date silently rolls over (e.g. month 13).
  if (date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return null;
  return date.toISOString();
}

export function isSnapshotName(name: string): boolean {
  return parseSnapshotAt(name) !== null;
}

/** Clamp a requested retention count into a sane range. */
export function normalizeKeep(keep: unknown): number {
  const n = Math.floor(Number(keep));
  if (!Number.isFinite(n)) return DEFAULT_KEEP;
  return Math.min(Math.max(n, MIN_KEEP), MAX_KEEP);
}

/**
 * Given the snapshot names present in a folder, decide which to DELETE so that
 * `keep` newest survive. Pure, so retention is verifiable without touching disk.
 *
 * Names that aren't ours are never returned — a backup folder may legitimately
 * hold the user's own files, and deleting those would be unforgivable.
 */
export function selectPrunable(names: string[], keep: number): string[] {
  const k = normalizeKeep(keep);
  const ours = names.filter(isSnapshotName).sort(); // filename sorts chronologically
  if (ours.length <= k) return [];
  return ours.slice(0, ours.length - k); // oldest first
}

/** Escape one CSV field: quote when needed, double any embedded quote. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a CSV document (CRLF line endings, for Excel on Windows). */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) lines.push(r.map(csvCell).join(','));
  return lines.join('\r\n') + '\r\n';
}

// ------------------------------------------------------------------- config

/**
 * Read the configuration, picking ONLY known fields.
 *
 * Deliberately not `{ ...defaults, ...raw }`. An installation that has been
 * upgraded still holds whatever shape an older build wrote to this key — the
 * pre-backup builds stored `{ cloudProvider, autoBackup, cloudConnected }` for a
 * provider integration that never existed. Spreading that in would carry dead
 * fields forward forever and let a stale `autoBackup` masquerade as config.
 * Anything unrecognised is dropped; anything invalid falls back to the default.
 */
export function getBackupConfig(db: DB): BackupConfig {
  const raw = (getSetting(db, BACKUP_KEY) ?? {}) as Record<string, unknown>;

  const auto = raw.auto;
  const optional = <T>(value: unknown, kind: 'string' | 'number'): T | undefined =>
    typeof value === kind ? (value as T) : undefined;

  return {
    folder: typeof raw.folder === 'string' ? raw.folder : DEFAULT_BACKUP_CONFIG.folder,
    pdfFolder: typeof raw.pdfFolder === 'string' ? raw.pdfFolder : DEFAULT_BACKUP_CONFIG.pdfFolder,
    auto:
      auto === 'off' || auto === 'daily' || auto === 'on-shift-close'
        ? auto
        : DEFAULT_BACKUP_CONFIG.auto,
    keep: normalizeKeep(raw.keep),
    cloudFolder: raw.cloudFolder === true,
    cloudLabel: optional<string>(raw.cloudLabel, 'string'),
    lastBackupAt: optional<string>(raw.lastBackupAt, 'string'),
    lastBackupPath: optional<string>(raw.lastBackupPath, 'string'),
    lastBackupBytes: optional<number>(raw.lastBackupBytes, 'number'),
    lastError: optional<string>(raw.lastError, 'string'),
    lastUsbBackupAt: optional<string>(raw.lastUsbBackupAt, 'string'),
    lastUsbBackupPath: optional<string>(raw.lastUsbBackupPath, 'string'),
    lastUsbLabel: optional<string>(raw.lastUsbLabel, 'string'),
  };
}

export function setBackupConfig(db: DB, patch: Partial<BackupConfig>): BackupConfig {
  const next: BackupConfig = { ...getBackupConfig(db), ...patch };
  next.keep = normalizeKeep(next.keep);
  setSetting(db, BACKUP_KEY, next);
  return getBackupConfig(db);
}

/**
 * Set the default folder ONCE, if the owner has never chosen one. Called by the
 * Electron layer at boot (it knows the Documents path). Never overwrites a
 * folder the owner picked.
 */
export function ensureBackupFolder(db: DB, defaultFolder: string): BackupConfig {
  const cfg = getBackupConfig(db);
  if (cfg.folder) return cfg;
  return setBackupConfig(db, { folder: defaultFolder });
}

// ------------------------------------------------------------------ snapshots

/** List our snapshots in `folder`, newest first. Missing folder → empty list. */
export function listSnapshots(folder: string): SnapshotInfo[] {
  if (!folder || !fs.existsSync(folder)) return [];
  let names: string[];
  try {
    names = fs.readdirSync(folder);
  } catch {
    return [];
  }
  const out: SnapshotInfo[] = [];
  for (const name of names) {
    const at = parseSnapshotAt(name);
    if (!at) continue;
    const full = path.join(folder, name);
    let bytes = 0;
    try {
      const st = fs.statSync(full);
      if (!st.isFile()) continue;
      bytes = st.size;
    } catch {
      continue;
    }
    out.push({ name, path: full, at, bytes });
  }
  return out.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
}

/**
 * Open a snapshot file read-only and prove it is a usable database.
 *
 * A backup nobody has verified is a rumour, not a backup. We check the SQLite
 * integrity of the file AND that the core tables are readable, then report the
 * row counts so the caller can show the owner what the file contains.
 */
export function verifySnapshot(file: string): {
  ok: boolean;
  error?: string;
  counts?: Record<string, number>;
} {
  if (!fs.existsSync(file)) return { ok: false, error: 'Snapshot file not found' };
  let probe: DB | null = null;
  try {
    // READ-ONLY on purpose: verifying must not modify the snapshot, and it must
    // not create `-wal`/`-shm` sidecars beside a file that a cloud client is
    // syncing.
    probe = openDatabase(file, { readonly: true });
    const integrity = probe.pragma('integrity_check') as { integrity_check: string }[];
    const verdict = integrity[0]?.integrity_check;
    if (verdict !== 'ok') return { ok: false, error: `Integrity check failed: ${verdict}` };

    const counts: Record<string, number> = {};
    for (const table of ['sales', 'purchases', 'products', 'customers', 'stock_movements']) {
      const row = probe.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
      counts[table] = row.n;
    }
    return { ok: true, counts };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    try {
      probe?.close();
    } catch {
      // Closing a probe handle can only fail if it never opened; nothing to do.
    }
  }
}

/**
 * Take a snapshot NOW.
 *
 * Order of operations matters for safety:
 *   1. write to the destination via `VACUUM INTO` (a consistent, compact copy),
 *   2. VERIFY the written file opens and passes integrity_check,
 *   3. only then prune old snapshots — so a failed backup can never be the
 *      reason the previous good one was deleted,
 *   4. record the outcome in the config so the UI can show it.
 *
 * On failure the error is recorded in `lastError` and re-thrown, leaving
 * `lastBackupAt` pointing at the last run that actually worked.
 */
export function runBackup(
  db: DB,
  opts: { folder?: string; keep?: number; at?: Date } = {},
): BackupResult {
  const cfg = getBackupConfig(db);
  const folder = opts.folder ?? cfg.folder;
  if (!folder) {
    const error = 'No backup folder is set. Choose one in Settings → Backup.';
    setBackupConfig(db, { lastError: error });
    throw new Error(error);
  }

  const at = opts.at ?? new Date();
  const name = snapshotFileName(at);
  const dest = path.join(folder, name);

  try {
    fs.mkdirSync(folder, { recursive: true });

    // VACUUM INTO refuses to overwrite. Two snapshots inside the same second
    // (only really possible from a script) would collide, so step the name.
    let finalDest = dest;
    let finalName = name;
    let bump = 1;
    while (fs.existsSync(finalDest)) {
      finalName = `${PREFIX}${name.slice(PREFIX.length, name.length - EXT.length)}-${bump}${EXT}`;
      finalDest = path.join(folder, finalName);
      bump++;
      if (bump > 50) throw new Error('Could not find a free snapshot filename');
    }

    // Bound parameter, not string interpolation — the path comes from a folder
    // picker and may contain quotes or backslashes.
    db.prepare('VACUUM INTO ?').run(finalDest);

    const check = verifySnapshot(finalDest);
    if (!check.ok) {
      // A corrupt snapshot is worse than none: remove it so it can never be
      // restored by mistake, and keep the previous good one in place.
      try {
        fs.unlinkSync(finalDest);
      } catch {
        // Best effort — the verification error below is the real signal.
      }
      throw new Error(check.error ?? 'Snapshot verification failed');
    }

    const bytes = fs.statSync(finalDest).size;

    // Retention runs only after a verified success.
    const keep = normalizeKeep(opts.keep ?? cfg.keep);
    const pruned: string[] = [];
    for (const victim of selectPrunable(
      fs.readdirSync(folder),
      keep,
    )) {
      // Never prune the file we just wrote, whatever the clock did.
      if (victim === finalName) continue;
      try {
        fs.unlinkSync(path.join(folder, victim));
        pruned.push(victim);
      } catch {
        // A locked/synced file will be pruned on the next run instead.
      }
    }

    const iso = at.toISOString();
    setBackupConfig(db, {
      folder,
      lastBackupAt: iso,
      lastBackupPath: finalDest,
      lastBackupBytes: bytes,
      lastError: undefined,
    });

    return { ok: true, name: finalName, path: finalDest, at: iso, bytes, pruned };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    setBackupConfig(db, { lastError: message });
    throw new Error(message);
  }
}

/**
 * Write ONE verified snapshot into an arbitrary folder, without touching the
 * configured backup folder, its retention, or `lastBackupAt`.
 *
 * This is what a pendrive backup uses. `runBackup` deliberately records the
 * folder it wrote to as THE backup folder and prunes old snapshots there —
 * correct for the scheduled destination, wrong for a one-off copy onto removable
 * media: it would silently repoint the shop's backups at a drive that is about
 * to be unplugged, and it would delete history off a pendrive the owner is using
 * as an archive. So this shares the naming and the verification, and nothing else.
 *
 * Same safety order as runBackup: write, then verify, and delete the file if it
 * does not verify — a corrupt snapshot is worse than no snapshot, because it
 * looks like one.
 */
export function snapshotTo(
  db: DB,
  folder: string,
  opts: { at?: Date } = {},
): { ok: true; name: string; path: string; at: string; bytes: number } {
  if (!folder) throw new Error('No destination folder given.');

  const at = opts.at ?? new Date();
  const name = snapshotFileName(at);
  fs.mkdirSync(folder, { recursive: true });

  // VACUUM INTO refuses to overwrite, so step the name on a collision.
  let finalName = name;
  let finalDest = path.join(folder, finalName);
  let bump = 1;
  while (fs.existsSync(finalDest)) {
    finalName = `${PREFIX}${name.slice(PREFIX.length, name.length - EXT.length)}-${bump}${EXT}`;
    finalDest = path.join(folder, finalName);
    bump++;
    if (bump > 50) throw new Error('Could not find a free snapshot filename');
  }

  db.prepare('VACUUM INTO ?').run(finalDest);

  const check = verifySnapshot(finalDest);
  if (!check.ok) {
    try {
      fs.unlinkSync(finalDest);
    } catch {
      // Best effort — the verification error is the real signal.
    }
    throw new Error(check.error ?? 'Snapshot verification failed');
  }

  return {
    ok: true,
    name: finalName,
    path: finalDest,
    at: at.toISOString(),
    bytes: fs.statSync(finalDest).size,
  };
}

export interface BackupStatus {
  config: BackupConfig;
  snapshots: SnapshotInfo[];
  /** Whether the configured folder currently exists and is writable. */
  folderReady: boolean;
  /** Size of the live database file, or null for an in-memory DB. */
  liveBytes: number | null;
}

/** Everything the Backup screen needs, in one read. */
export function backupStatus(db: DB): BackupStatus {
  const config = getBackupConfig(db);
  let folderReady = false;
  if (config.folder) {
    try {
      fs.mkdirSync(config.folder, { recursive: true });
      fs.accessSync(config.folder, fs.constants.W_OK);
      folderReady = true;
    } catch {
      folderReady = false;
    }
  }

  // `PRAGMA database_list` gives the live file path; it is '' for :memory:.
  let liveBytes: number | null = null;
  try {
    const entry = (db.pragma('database_list') as { name: string; file: string }[]).find(
      (d) => d.name === 'main',
    );
    if (entry?.file) liveBytes = fs.statSync(entry.file).size;
  } catch {
    liveBytes = null;
  }

  return { config, snapshots: listSnapshots(config.folder), folderReady, liveBytes };
}

/**
 * Should a 'daily' automatic backup run right now?
 *
 * Pure and time-injectable so the schedule is verifiable. The rule is simply
 * "no verified snapshot yet today (local date), and it is past `hour`" — rather
 * than a fixed alarm at 02:00. A shop PC is often switched off overnight, and an
 * alarm-based schedule would silently never fire on such a machine.
 */
export function isDailyBackupDue(
  cfg: Pick<BackupConfig, 'auto' | 'lastBackupAt'>,
  now: Date,
  hour = 2,
): boolean {
  if (cfg.auto !== 'daily') return false;
  if (now.getHours() < hour) return false;
  if (!cfg.lastBackupAt) return true;
  const last = new Date(cfg.lastBackupAt);
  if (Number.isNaN(last.getTime())) return true;
  return (
    last.getFullYear() !== now.getFullYear() ||
    last.getMonth() !== now.getMonth() ||
    last.getDate() !== now.getDate()
  );
}

// ----------------------------------------------------------------- CSV export

export type ExportKind =
  | 'sales'
  | 'purchases'
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'stock';

/**
 * Build a CSV for one dataset.
 *
 * These are flat, accountant-friendly extracts straight out of SQL — no derived
 * estimates and no invented columns. Stock is the one derived export: on-hand is
 * summed from `stock_movements`, which is the only place stock ever lives.
 */
export function buildExportCsv(db: DB, kind: ExportKind): string {
  switch (kind) {
    case 'sales': {
      const rows = db
        .prepare(
          `SELECT s.invoice_no, s.date, s.status, COALESCE(c.name,'Walk-in Customer') AS customer,
                  s.subtotal, s.order_discount, s.tax, s.total,
                  COALESCE((SELECT SUM(p.amount) FROM sale_payments p WHERE p.sale_id = s.id),0) AS paid,
                  u.name AS user, b.name AS branch
             FROM sales s
             LEFT JOIN customers c ON c.id = s.customer_id
             LEFT JOIN users u ON u.id = s.user_id
             LEFT JOIN branches b ON b.id = s.branch_id
            ORDER BY s.date DESC, s.id DESC`,
        )
        .all() as Record<string, unknown>[];
      return toCsv(
        [
          'Invoice No',
          'Date',
          'Status',
          'Customer',
          'Subtotal',
          'Discount',
          'Tax',
          'Total',
          'Paid',
          'Due',
          'User',
          'Branch',
        ],
        rows.map((r) => [
          r.invoice_no,
          r.date,
          r.status,
          r.customer,
          r.subtotal,
          r.order_discount,
          r.tax,
          r.total,
          r.paid,
          Number(r.total ?? 0) - Number(r.paid ?? 0),
          r.user,
          r.branch,
        ]),
      );
    }
    case 'purchases': {
      const rows = db
        .prepare(
          `SELECT p.ref_no, p.date, p.status, sup.name AS supplier, p.subtotal, p.total,
                  COALESCE((SELECT SUM(pp.amount) FROM purchase_payments pp WHERE pp.purchase_id = p.id),0) AS paid,
                  b.name AS branch
             FROM purchases p
             LEFT JOIN suppliers sup ON sup.id = p.supplier_id
             LEFT JOIN branches b ON b.id = p.branch_id
            ORDER BY p.date DESC, p.id DESC`,
        )
        .all() as Record<string, unknown>[];
      return toCsv(
        ['Ref No', 'Date', 'Status', 'Supplier', 'Subtotal', 'Total', 'Paid', 'Due', 'Branch'],
        rows.map((r) => [
          r.ref_no,
          r.date,
          r.status,
          r.supplier,
          r.subtotal,
          r.total,
          r.paid,
          Number(r.total ?? 0) - Number(r.paid ?? 0),
          r.branch,
        ]),
      );
    }
    case 'products': {
      const rows = db
        .prepare(
          `SELECT p.sku, p.name, p.barcode, c.name AS category, br.name AS brand, p.unit AS unit,
                  p.cost, p.price, p.wholesale_price, p.reorder_level
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             LEFT JOIN brands br ON br.id = p.brand_id
            ORDER BY p.name`,
        )
        .all() as Record<string, unknown>[];
      return toCsv(
        [
          'SKU',
          'Name',
          'Barcode',
          'Category',
          'Brand',
          'Unit',
          'Cost',
          'Price',
          'Wholesale Price',
          'Reorder Level',
        ],
        rows.map((r) => [
          r.sku,
          r.name,
          r.barcode,
          r.category,
          r.brand,
          r.unit,
          r.cost,
          r.price,
          r.wholesale_price,
          r.reorder_level,
        ]),
      );
    }
    case 'customers': {
      const rows = db
        .prepare(
          `SELECT name, phone, alt_phone, email, address, price_group, opening_balance,
                  credit_limit, joined
             FROM customers ORDER BY name`,
        )
        .all() as Record<string, unknown>[];
      return toCsv(
        [
          'Name',
          'Phone',
          'Alt Phone',
          'Email',
          'Address',
          'Price Group',
          'Opening Balance',
          'Credit Limit',
          'Joined',
        ],
        rows.map((r) => [
          r.name,
          r.phone,
          r.alt_phone,
          r.email,
          r.address,
          r.price_group,
          r.opening_balance,
          r.credit_limit,
          r.joined,
        ]),
      );
    }
    case 'suppliers': {
      const rows = db
        .prepare(
          `SELECT name, company, contact_person, phone, email, address, tax_id,
                  payment_terms, opening_balance
             FROM suppliers ORDER BY name`,
        )
        .all() as Record<string, unknown>[];
      return toCsv(
        [
          'Name',
          'Company',
          'Contact Person',
          'Phone',
          'Email',
          'Address',
          'Tax ID',
          'Payment Terms',
          'Opening Balance',
        ],
        rows.map((r) => [
          r.name,
          r.company,
          r.contact_person,
          r.phone,
          r.email,
          r.address,
          r.tax_id,
          r.payment_terms,
          r.opening_balance,
        ]),
      );
    }
    case 'stock': {
      // On-hand is DERIVED from movements — never a stored column.
      const rows = db
        .prepare(
          `SELECT p.sku, p.name, b.name AS branch, SUM(m.qty) AS on_hand, p.cost, p.price,
                  SUM(m.qty) * p.cost AS value_at_cost
             FROM stock_movements m
             JOIN products p ON p.id = m.product_id
             LEFT JOIN branches b ON b.id = m.branch_id
            GROUP BY m.product_id, m.branch_id
            HAVING SUM(m.qty) <> 0
            ORDER BY p.name, b.name`,
        )
        .all() as Record<string, unknown>[];
      return toCsv(
        ['SKU', 'Product', 'Branch', 'On Hand', 'Cost', 'Price', 'Value at Cost'],
        rows.map((r) => [
          r.sku,
          r.name,
          r.branch,
          r.on_hand,
          r.cost,
          r.price,
          r.value_at_cost,
        ]),
      );
    }
  }
}

const EXPORT_KINDS: ExportKind[] = [
  'sales',
  'purchases',
  'products',
  'customers',
  'suppliers',
  'stock',
];

/**
 * Write one CSV export into `<backup folder>/exports/` and return where it went.
 *
 * The export lands next to the snapshots on purpose: if that folder is cloud
 * synced, the accountant's CSV is off the machine for free, by the same
 * mechanism and with the same guarantees as the snapshots.
 */
export function exportCsvFile(
  db: DB,
  payload: { kind: ExportKind; folder?: string; at?: Date },
): { ok: true; kind: ExportKind; path: string; bytes: number; rows: number } {
  if (!EXPORT_KINDS.includes(payload.kind)) {
    throw new Error(`Unknown export: ${String(payload.kind)}`);
  }
  const cfg = getBackupConfig(db);
  const base = payload.folder ?? cfg.folder;
  if (!base) throw new Error('No backup folder is set. Choose one in Settings → Backup.');

  const at = payload.at ?? new Date();
  const dir = path.join(base, 'exports');
  fs.mkdirSync(dir, { recursive: true });

  const stamp = snapshotFileName(at).slice(PREFIX.length, -EXT.length);
  const file = path.join(dir, `${payload.kind}-${stamp}.csv`);
  const csv = buildExportCsv(db, payload.kind);
  // BOM so Excel on Windows reads UTF-8 (Bangla names, ৳) correctly.
  fs.writeFileSync(file, '\uFEFF' + csv, 'utf-8');

  return {
    ok: true,
    kind: payload.kind,
    path: file,
    bytes: fs.statSync(file).size,
    // Header line does not count as a row.
    rows: Math.max(0, csv.trimEnd().split('\r\n').length - 1),
  };
}
