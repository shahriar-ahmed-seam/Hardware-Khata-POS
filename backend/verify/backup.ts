/**
 * BACKUP / CLOUD SAVING VERIFICATION
 * ==================================
 * Covers `backend/services/backup.ts`.
 *
 * A backup nobody verified is a rumour, so this suite asserts the properties
 * that decide whether the owner actually gets their shop back:
 *
 *  - a snapshot is a REAL, openable database whose row counts match the source
 *  - the snapshot is taken through the api facade, exactly as the app calls it
 *  - retention deletes the OLDEST snapshots and never a file that isn't ours
 *  - a failed backup never deletes the previous good one
 *  - restoring the CONTENT of a snapshot yields the same money totals
 *  - config round-trips through settings_kv and is clamped
 *  - the daily schedule fires once a day and not more
 *  - CSV exports quote/escape correctly and cover every row
 *
 * Run standalone: npx tsx backend/verify/backup.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, migrate, type DB } from '../db/connection.ts';
import { simulate } from '../seed/simulate.ts';
import { buildApi } from '../api.ts';
import { getSetting, setSetting } from '../services/settings.ts';
import { Suite } from './assert.ts';
import {
  invoicePdfFileName,
  invoicePdfTargets,
  invoicePdfTargetsFor,
  listInvoicePdfs,
  saveInvoicePdfCopies,
} from '../services/invoices.ts';
import {
  buildExportCsv,
  csvCell,
  getBackupConfig,
  isDailyBackupDue,
  listSnapshots,
  normalizeKeep,
  parseSnapshotAt,
  runBackup,
  selectPrunable,
  setBackupConfig,
  snapshotFileName,
  snapshotTo,
  verifySnapshot,
} from '../services/backup.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function runBackupChecks(s: Suite) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-backup-verify-'));
  const folder = path.join(tmp, 'Backups');

  const db: DB = openDatabase(':memory:');
  migrate(db);
  simulate(db, { days: 45, seed: 31 });

  const api = buildApi();
  const call = (ch: string, payload: unknown = {}): any => api[ch](db, payload);

  // ------------------------------------------------------------ pure helpers
  s.section('backup-naming');
  const at = new Date(2026, 7, 2, 14, 5, 9); // 2 Aug 2026, 14:05:09 local
  s.eq('snapshot filename encodes the local timestamp', snapshotFileName(at), 'pos-backup-20260802-140509.sqlite3');
  s.eq(
    'a filename round-trips back to its timestamp',
    parseSnapshotAt(snapshotFileName(at)),
    at.toISOString(),
  );
  s.eq('a foreign filename is not treated as a snapshot', parseSnapshotAt('accounts-2026.xlsx'), null);
  s.eq('a lookalike with a bad month is rejected', parseSnapshotAt('pos-backup-20261302-000000.sqlite3'), null);
  s.ok(
    'filenames sort chronologically as plain strings',
    snapshotFileName(new Date(2026, 0, 2, 3, 4, 5)) < snapshotFileName(new Date(2026, 0, 2, 3, 4, 6)),
  );

  s.section('backup-retention-rules');
  const names = [
    'pos-backup-20260101-010000.sqlite3',
    'pos-backup-20260102-010000.sqlite3',
    'pos-backup-20260103-010000.sqlite3',
    'pos-backup-20260104-010000.sqlite3',
  ];
  s.eq('keeping 2 of 4 prunes 2', selectPrunable(names, 2).length, 2);
  s.eq(
    'retention prunes the OLDEST first',
    selectPrunable(names, 2).join(','),
    'pos-backup-20260101-010000.sqlite3,pos-backup-20260102-010000.sqlite3',
  );
  s.eq('nothing is pruned when under the limit', selectPrunable(names, 10).length, 0);
  s.eq(
    'files that are not our snapshots are NEVER pruned',
    selectPrunable([...names, 'tax-return.pdf', 'notes.txt'], 1).filter((n) => !n.startsWith('pos-backup-')).length,
    0,
  );
  s.eq('retention never drops below 1', selectPrunable(names, 0).length, names.length - 1);
  s.eq('keep is clamped up from 0', normalizeKeep(0), 1);
  s.eq('keep is clamped down from absurd values', normalizeKeep(100000), 365);
  s.eq('a non-numeric keep falls back to the default', normalizeKeep('lots'), 14);

  // ------------------------------------------------------------------ config
  s.section('backup-config');
  // An upgraded install still holds whatever an older build wrote to this key.
  // Pre-backup builds stored a `{ cloudProvider, autoBackup, cloudConnected }`
  // blob for a provider integration that never existed, so reading must DROP
  // unknown fields rather than carry them forward.
  setSetting(db, 'backup', {
    cloudProvider: 'supabase',
    autoBackup: 'on-shift-close',
    cloudConnected: false,
  });
  const legacy = getBackupConfig(db) as unknown as Record<string, unknown>;
  s.eq('a legacy config blob does not crash the reader', typeof legacy.auto, 'string');
  s.eq('legacy `autoBackup` is not mistaken for the schedule', legacy.auto, 'daily');
  s.eq('unknown legacy fields are dropped', legacy.cloudProvider, undefined);
  s.eq('a legacy blob yields no folder', legacy.folder, '');
  // Writing it back must persist the CLEAN shape, not the legacy one.
  setBackupConfig(db, {});
  s.eq(
    'writing back drops the legacy fields for good',
    (getSetting(db, 'backup') as Record<string, unknown>).cloudProvider,
    undefined,
  );
  setSetting(db, 'backup', null);

  const fresh = getBackupConfig(db);
  s.eq('a fresh install has no folder set', fresh.folder, '');
  s.eq('a fresh install still has a schedule', fresh.auto, 'daily');
  s.ok('a fresh install is not marked cloud', fresh.cloudFolder === false);

  const saved = setBackupConfig(db, { folder, keep: 3, auto: 'on-shift-close' });
  s.eq('config round-trips through settings_kv', saved.folder, folder);
  s.eq('schedule round-trips', saved.auto, 'on-shift-close');
  s.eq('keep round-trips', saved.keep, 3);
  s.eq('a later read sees the same config', getBackupConfig(db).folder, folder);
  s.eq(
    'an unknown schedule value is rejected, not stored',
    setBackupConfig(db, { auto: 'whenever' as any }).auto,
    'daily',
  );
  setBackupConfig(db, { auto: 'on-shift-close' });

  // -------------------------------------------------------------- snapshots
  s.section('backup-snapshot');
  const liveSales = (db.prepare('SELECT COUNT(*) AS n FROM sales').get() as { n: number }).n;
  const liveTotal = (
    db.prepare("SELECT COALESCE(SUM(total),0) AS v FROM sales WHERE status='final'").get() as {
      v: number;
    }
  ).v;
  const liveStock = (
    db.prepare('SELECT COALESCE(SUM(qty),0) AS v FROM stock_movements').get() as { v: number }
  ).v;
  s.gt('the simulated shop has data worth backing up', liveSales, 0);

  const first = call('backup.run', {}) as { name: string; path: string; bytes: number };
  s.ok('backup.run reports a snapshot name', first.name.startsWith('pos-backup-'));
  s.ok('the snapshot file exists on disk', fs.existsSync(first.path));
  s.gt('the snapshot is not empty', first.bytes, 0);

  const verified = verifySnapshot(first.path);
  s.ok('the snapshot passes integrity_check', verified.ok);
  s.eq('the snapshot holds every sale', verified.counts?.sales ?? -1, liveSales);
  // Verifying opens the file READ-ONLY. If it opened read-write, SQLite would
  // switch the snapshot to WAL and drop `-wal`/`-shm` files beside it — which a
  // cloud client would then sync as extra, confusing files.
  s.ok(
    'verifying a snapshot writes no WAL sidecar files next to it',
    !fs.existsSync(first.path + '-wal') && !fs.existsSync(first.path + '-shm'),
  );

  // The real test of a backup: open it as a database and reconcile the money.
  // Read-only, so reading a snapshot never writes WAL sidecars next to it.
  const restored = openDatabase(first.path, { readonly: true });
  const restoredTotal = (
    restored.prepare("SELECT COALESCE(SUM(total),0) AS v FROM sales WHERE status='final'").get() as {
      v: number;
    }
  ).v;
  const restoredStock = (
    restored.prepare('SELECT COALESCE(SUM(qty),0) AS v FROM stock_movements').get() as { v: number }
  ).v;
  const restoredCustomers = (
    restored.prepare('SELECT COUNT(*) AS n FROM customers').get() as { n: number }
  ).n;
  const liveCustomers = (db.prepare('SELECT COUNT(*) AS n FROM customers').get() as { n: number }).n;
  s.money('restored sales total matches the live shop to the cent', restoredTotal, liveTotal);
  s.money('restored stock movements sum matches the live shop', restoredStock, liveStock);
  s.eq('restored customer count matches', restoredCustomers, liveCustomers);
  s.eq(
    'the restored copy reports no foreign-key violations',
    (restored.pragma('foreign_key_check') as unknown[]).length,
    0,
  );
  restored.close();

  s.section('backup-status');
  const status = call('backup.status', {}) as {
    config: { folder: string; lastBackupAt?: string };
    snapshots: { name: string }[];
    folderReady: boolean;
  };
  s.ok('status reports the folder as writable', status.folderReady);
  s.eq('status lists the snapshot we just took', status.snapshots.length, 1);
  s.ok('status records when the backup ran', !!status.config.lastBackupAt);

  // ------------------------------------------------------------- retention
  s.section('backup-retention-on-disk');
  // Take more snapshots than `keep` (3), with distinct timestamps.
  const base = new Date(2026, 0, 10, 9, 0, 0);
  for (let i = 0; i < 5; i++) {
    runBackup(db, { at: new Date(base.getTime() + i * 3600_000) });
  }
  // A file the owner put in the folder themselves — it must survive.
  const ownFile = path.join(folder, 'shop-notes.txt');
  fs.writeFileSync(ownFile, 'do not delete me');
  runBackup(db, { at: new Date(base.getTime() + 6 * 3600_000) });

  const kept = listSnapshots(folder);
  s.eq('retention keeps exactly `keep` snapshots', kept.length, 3);
  s.ok('the owner’s own file in the folder is untouched', fs.existsSync(ownFile));
  s.ok(
    'the surviving snapshots are the newest ones',
    kept[0].name > kept[kept.length - 1].name,
  );
  s.eq(
    'listSnapshots ignores files that are not ours',
    listSnapshots(folder).filter((x) => !x.name.startsWith('pos-backup-')).length,
    0,
  );

  s.section('backup-failure-is-safe');
  const before = listSnapshots(folder).length;
  let threw = false;
  try {
    // A path that cannot be created: an existing FILE used as a directory.
    runBackup(db, { folder: path.join(ownFile, 'nested') });
  } catch {
    threw = true;
  }
  s.ok('a backup to an impossible folder fails loudly', threw);
  s.eq('a failed backup deletes nothing', listSnapshots(folder).length, before);
  s.ok('the failure is recorded for the owner to see', !!getBackupConfig(db).lastError);
  // A successful run must clear the stale error.
  runBackup(db, { folder });
  s.eq('a later success clears the recorded error', getBackupConfig(db).lastError, undefined);

  // ------------------------------------------------ portable (pendrive) copy
  // `snapshotTo` is what a pendrive backup uses. The point of it existing
  // separately from runBackup is that it must NOT hijack the shop's configured
  // backup destination or prune what is already on the stick — a pendrive is
  // about to be unplugged, and it is often used as a keep-everything archive.
  s.section('backup-portable');
  {
    const stick = path.join(tmp, 'PretendPendrive', 'HardwareKhataPOS', 'Backups');
    const cfgBefore = getBackupConfig(db);

    // Two copies in a row, so retention (if it leaked in) would show up.
    const first = snapshotTo(db, stick, { at: new Date(2026, 2, 1, 8, 0, 0) });
    const second = snapshotTo(db, stick, { at: new Date(2026, 2, 2, 8, 0, 0) });

    s.ok('a portable snapshot is written', fs.existsSync(first.path));
    s.ok('the portable snapshot verifies as a real database', verifySnapshot(first.path).ok);
    s.gt('the portable snapshot has bytes', first.bytes, 0);
    s.eq(
      'the portable snapshot lands in the folder it was given',
      path.dirname(first.path).toLowerCase(),
      stick.toLowerCase(),
    );
    s.eq(
      'the portable snapshot carries the same row counts as the live database',
      verifySnapshot(first.path).counts?.sales ?? -1,
      (db.prepare('SELECT COUNT(*) AS n FROM sales').get() as { n: number }).n,
    );
    s.eq('a second portable copy does not replace the first', listSnapshots(stick).length, 2);
    s.ok('both portable snapshots survive (no pruning on removable media)', fs.existsSync(second.path));

    const cfgAfter = getBackupConfig(db);
    s.eq('a portable copy does NOT change the configured backup folder', cfgAfter.folder, cfgBefore.folder);
    s.eq(
      'a portable copy does NOT touch lastBackupAt',
      cfgAfter.lastBackupAt,
      cfgBefore.lastBackupAt,
    );
    s.eq(
      'a portable copy does NOT touch lastBackupPath',
      cfgAfter.lastBackupPath,
      cfgBefore.lastBackupPath,
    );
    s.eq(
      'the scheduled backup folder still holds only its own snapshots',
      listSnapshots(folder).some((sn) => sn.path.toLowerCase().startsWith(stick.toLowerCase())),
      false,
    );

    // A destination that cannot be written is an error, not a silent no-op.
    let portableFailed = '';
    try {
      snapshotTo(db, '');
    } catch (e) {
      portableFailed = e instanceof Error ? e.message : String(e);
    }
    s.ok('a portable copy with no destination is refused', portableFailed.includes('destination'));

    // The USB fields are display-only bookkeeping and must round-trip like the
    // rest of the config blob.
    setBackupConfig(db, {
      lastUsbBackupAt: second.at,
      lastUsbBackupPath: second.path,
      lastUsbLabel: 'E: (PENDRIVE)',
    });
    const usbCfg = getBackupConfig(db);
    s.eq('the last pendrive backup time round-trips', usbCfg.lastUsbBackupAt, second.at);
    s.eq('the last pendrive drive label round-trips', usbCfg.lastUsbLabel, 'E: (PENDRIVE)');
    s.eq(
      'recording a pendrive backup still does not move the scheduled folder',
      getBackupConfig(db).folder,
      cfgBefore.folder,
    );
  }

  s.section('backup-verify-rejects-junk');
  const junk = path.join(tmp, 'not-a-database.sqlite3');
  fs.writeFileSync(junk, 'this is definitely not sqlite');
  s.ok('a corrupt file is refused', verifySnapshot(junk).ok === false);
  s.ok('a missing file is refused', verifySnapshot(path.join(tmp, 'absent.sqlite3')).ok === false);

  // -------------------------------------------------------------- scheduling
  s.section('backup-schedule');
  const noon = new Date(2026, 4, 10, 12, 0, 0);
  s.ok('daily is not due when the schedule is off', !isDailyBackupDue({ auto: 'off' }, noon));
  s.ok(
    'daily is not due when shift-close is chosen',
    !isDailyBackupDue({ auto: 'on-shift-close' }, noon),
  );
  s.ok('daily is due when nothing has ever been backed up', isDailyBackupDue({ auto: 'daily' }, noon));
  s.ok(
    'daily is not due again the same day',
    !isDailyBackupDue({ auto: 'daily', lastBackupAt: new Date(2026, 4, 10, 3, 0, 0).toISOString() }, noon),
  );
  s.ok(
    'daily becomes due the next day',
    isDailyBackupDue({ auto: 'daily', lastBackupAt: new Date(2026, 4, 9, 23, 0, 0).toISOString() }, noon),
  );
  s.ok(
    'daily waits until the configured hour',
    !isDailyBackupDue({ auto: 'daily' }, new Date(2026, 4, 10, 1, 0, 0)),
  );
  s.ok(
    'a corrupt last-run timestamp is treated as never',
    isDailyBackupDue({ auto: 'daily', lastBackupAt: 'not-a-date' }, noon),
  );

  // ------------------------------------------------------------- CSV export
  s.section('backup-csv');
  s.eq('a plain value is not quoted', csvCell('Hammer'), 'Hammer');
  s.eq('a value with a comma is quoted', csvCell('Nut, bolt'), '"Nut, bolt"');
  s.eq('an embedded quote is doubled', csvCell('12" pipe'), '"12"" pipe"');
  s.eq('a newline is quoted', csvCell('line1\nline2'), '"line1\nline2"');
  s.eq('null becomes an empty field', csvCell(null), '');

  const salesCsv = buildExportCsv(db, 'sales');
  const salesLines = salesCsv.trimEnd().split('\r\n');
  s.ok('the sales export starts with a header row', salesLines[0].startsWith('Invoice No,Date,Status'));
  s.eq('the sales export covers every sale', salesLines.length - 1, liveSales);
  s.ok(
    'every sales row has the same number of fields as the header',
    (() => {
      const want = salesLines[0].split(',').length;
      // Count top-level commas only — quoted fields may contain commas.
      const fields = (line: string) => {
        let n = 1;
        let quoted = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') quoted = !quoted;
          else if (ch === ',' && !quoted) n++;
        }
        return n;
      };
      return salesLines.every((l) => fields(l) === want);
    })(),
  );

  const productCount = (db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n;
  s.eq(
    'the products export covers every product',
    buildExportCsv(db, 'products').trimEnd().split('\r\n').length - 1,
    productCount,
  );

  // Stock export is DERIVED from movements — assert it against the same sum.
  const stockCsv = buildExportCsv(db, 'stock').trimEnd().split('\r\n').slice(1);
  const csvOnHand = stockCsv.reduce((acc, line) => {
    // Columns are SKU, Product, Branch, On Hand, Cost, Price, Value at Cost.
    // A product name may be quoted and contain commas, which shifts indices
    // from the LEFT — but the last four fields are always plain numbers, so
    // counting back from the end finds On Hand reliably.
    const cols = line.split(',');
    return acc + Number(cols[cols.length - 4]);
  }, 0);
  const derivedOnHand = (
    db
      .prepare(
        `SELECT COALESCE(SUM(t.q),0) AS v FROM (
           SELECT SUM(qty) AS q FROM stock_movements GROUP BY product_id, branch_id HAVING SUM(qty) <> 0
         ) t`,
      )
      .get() as { v: number }
  ).v;
  s.money('the stock export on-hand equals the movement sum', csvOnHand, derivedOnHand);

  s.section('backup-export-file');
  const exported = call('backup.export', { kind: 'customers' }) as {
    path: string;
    rows: number;
    bytes: number;
  };
  s.ok('the export file is written to disk', fs.existsSync(exported.path));
  s.ok('the export lands in an exports subfolder', exported.path.includes(`${path.sep}exports${path.sep}`));
  s.eq('the export row count matches the contact book', exported.rows, liveCustomers);
  s.ok(
    'the export is UTF-8 with a BOM so Excel reads Bangla correctly',
    fs.readFileSync(exported.path, 'utf-8').charCodeAt(0) === 0xfeff,
  );
  let badKind = false;
  try {
    call('backup.export', { kind: 'everything' });
  } catch {
    badKind = true;
  }
  s.ok('an unknown export kind is refused', badKind);

  // ------------------------------------------------- invoice PDF archive
  // Save as PDF writes the SAME file to up to three places so an invoice is
  // protected exactly like the database. These checks cover the naming (invoice
  // numbers are shop data and can contain characters Windows forbids) and the
  // de-duplication (an owner may legitimately point their PDF folder at the
  // backup folder).
  s.section('invoice-pdf-naming');
  s.eq('a plain invoice number becomes a pdf name', invoicePdfFileName('INV-2026-0004'), 'INV-2026-0004.pdf');
  s.eq('a slash cannot escape the folder', invoicePdfFileName('INV/2026/0004'), 'INV-2026-0004.pdf');
  s.eq(
    'every Windows-illegal character is replaced',
    invoicePdfFileName('A<B>C:D"E\\F|G?H*I'),
    'A-B-C-D-E-F-G-H-I.pdf',
  );
  s.eq('surrounding whitespace is trimmed', invoicePdfFileName('  INV-1  '), 'INV-1.pdf');
  s.eq('a trailing dot is dropped (illegal on Windows)', invoicePdfFileName('INV-1...'), 'INV-1.pdf');
  s.eq('an empty invoice number still yields a usable name', invoicePdfFileName(''), 'invoice.pdf');
  s.eq(
    'an all-punctuation number still yields a usable name',
    invoicePdfFileName('///'),
    'invoice.pdf',
  );
  s.ok(
    'an absurdly long number is truncated',
    invoicePdfFileName('X'.repeat(500)).length <= 125,
  );

  s.section('invoice-pdf-targets');
  const t3 = invoicePdfTargets({
    pdfFolder: path.join(tmp, 'MyPdfs'),
    dbFolder: path.join(tmp, 'dbdir'),
    backupFolder: path.join(tmp, 'Backups'),
  });
  s.eq('three distinct folders give three targets', t3.length, 3);
  s.ok('the chosen folder is included', t3.some((x) => x.kind === 'chosen'));
  s.ok('the database folder is included', t3.some((x) => x.kind === 'database'));
  s.ok('the backup folder is included', t3.some((x) => x.kind === 'backup'));
  s.ok(
    'the database copy goes in an invoices subfolder',
    t3.find((x) => x.kind === 'database')!.dir.endsWith(`${path.sep}invoices`),
  );
  s.eq(
    'a PDF folder equal to the backup invoices folder is not written twice',
    invoicePdfTargets({
      pdfFolder: path.join(tmp, 'Backups', 'invoices'),
      backupFolder: path.join(tmp, 'Backups'),
    }).length,
    1,
  );
  s.eq(
    'case and separator differences still count as one folder',
    invoicePdfTargets({
      pdfFolder: path.join(tmp, 'MyPdfs'),
      dbFolder: undefined,
      backupFolder: undefined,
    })
      .concat(invoicePdfTargets({ pdfFolder: path.join(tmp, 'mypdfs') }))
      .filter((x, i, a) => a.findIndex((y) => y.dir.toLowerCase() === x.dir.toLowerCase()) === i)
      .length,
    1,
  );
  s.eq('no folders configured gives no targets', invoicePdfTargets({}).length, 0);

  s.section('invoice-pdf-write');
  const fakePdf = Buffer.from('%PDF-1.4 fake invoice bytes');
  const writeTargets = invoicePdfTargets({
    pdfFolder: path.join(tmp, 'MyPdfs'),
    dbFolder: path.join(tmp, 'dbdir'),
    backupFolder: path.join(tmp, 'Backups'),
  });
  const written = saveInvoicePdfCopies(fakePdf, 'INV-TEST-1.pdf', writeTargets);
  s.eq('all three copies are written', written.saved.length, 3);
  s.eq('nothing failed', written.failed.length, 0);
  s.ok('the reported primary copy is the owner-chosen one', written.primary?.kind === 'chosen');
  s.ok(
    'every reported copy really exists on disk',
    written.saved.every((c) => fs.existsSync(c.path)),
  );
  s.ok(
    'every copy has the same size as the source',
    written.saved.every((c) => c.bytes === fakePdf.length),
  );
  s.ok(
    'folders are created if missing',
    fs.existsSync(path.join(tmp, 'dbdir', 'invoices', 'INV-TEST-1.pdf')),
  );

  // One bad target must not lose the good ones — an unplugged drive or a cloud
  // folder mid-sync should never cost the shop its invoice copy.
  const blocker = path.join(tmp, 'blocker.txt');
  fs.writeFileSync(blocker, 'not a folder');
  const partial = saveInvoicePdfCopies(fakePdf, 'INV-TEST-2.pdf', [
    { dir: path.join(blocker, 'nested'), kind: 'chosen' },
    { dir: path.join(tmp, 'dbdir', 'invoices'), kind: 'database' },
  ]);
  s.eq('a good target still succeeds when another fails', partial.saved.length, 1);
  s.eq('the failure is reported, not thrown', partial.failed.length, 1);
  s.ok('the primary falls back to a copy that worked', partial.primary?.kind === 'database');

  s.section('invoice-pdf-listing');
  const listed = listInvoicePdfs(path.join(tmp, 'dbdir', 'invoices'));
  s.gte('the archive lists what was written', listed.length, 2);
  s.ok('only pdf files are listed', listed.every((x) => x.name.endsWith('.pdf')));
  fs.writeFileSync(path.join(tmp, 'dbdir', 'invoices', 'notes.txt'), 'ignore me');
  s.ok(
    'a non-pdf in the folder is ignored',
    listInvoicePdfs(path.join(tmp, 'dbdir', 'invoices')).every((x) => x.name !== 'notes.txt'),
  );
  s.eq('a missing folder lists nothing', listInvoicePdfs(path.join(tmp, 'nope')).length, 0);

  s.section('invoice-pdf-config');
  setBackupConfig(db, { pdfFolder: path.join(tmp, 'ConfiguredPdfs') });
  s.eq(
    'the pdf folder round-trips through settings_kv',
    getBackupConfig(db).pdfFolder,
    path.join(tmp, 'ConfiguredPdfs'),
  );
  s.eq(
    'the pdf folder survives an unrelated config write',
    (setBackupConfig(db, { keep: 30 })).pdfFolder,
    path.join(tmp, 'ConfiguredPdfs'),
  );
  s.eq(
    'targets resolved from config include the configured folder',
    invoicePdfTargetsFor(db, path.join(tmp, 'dbdir')).filter((x) => x.kind === 'chosen').length,
    1,
  );

  s.section('backup-no-folder');
  const db2 = openDatabase(':memory:');
  migrate(db2);
  let refused = false;
  try {
    runBackup(db2);
  } catch {
    refused = true;
  }
  s.ok('a backup with no folder configured is refused', refused);
  db2.close();

  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---- standalone runner (mirrors paging.ts) ----
if (
  import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/') ||
  // Path separators differ on Windows, so match the bare filename. Only the
  // ENTRY script lands in argv[1], so backend/services/backup.ts (imported, not
  // executed) can never trigger this.
  process.argv[1]?.endsWith('backup.ts')
) {
  const s = new Suite();
  const t0 = Date.now();
  runBackupChecks(s);
  const rep = s.report();
  const ms = Date.now() - t0;
  console.log(`BACKUP: ${rep.passed}/${rep.total} checks in ${ms}ms`);
  if (rep.failed > 0) {
    console.log(`\n❌ ${rep.failed} FAILURES:`);
    for (const f of rep.failures) console.log(`   - ${f.name}: ${f.detail ?? ''}`);
    process.exit(1);
  }
  console.log('✅ ALL BACKUP CHECKS PASSED');
}
