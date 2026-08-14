import { app, dialog, shell, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import {
  ensureBackupFolder,
  getBackupConfig,
  setBackupConfig,
  runBackup,
  snapshotTo,
  verifySnapshot,
  isDailyBackupDue,
  isSnapshotName,
} from '../backend/services/backup.ts';
import { getDb, closeDb, dbFilePath } from './db.ts';

/**
 * ELECTRON SIDE OF BACKUP / CLOUD SAVING
 *
 * `backend/services/backup.ts` holds everything that is just SQLite + fs, so the
 * Node verification harness can test it. This file holds the parts that
 * genuinely need Electron and therefore cannot be verified by that harness:
 *
 *   - resolving the user's Documents folder (`app.getPath`)
 *   - detecting installed cloud-sync folders (OneDrive / Google Drive / Dropbox)
 *   - the native folder picker and file picker
 *   - RESTORE, which must close the database, swap the file and relaunch the app
 *   - the automatic-backup timer
 *
 * Nothing here opens a network connection. "Cloud" is the owner's existing sync
 * client watching the folder we write into.
 */

// ------------------------------------------------------------ folder discovery

export interface CloudFolderOption {
  id: string;
  /** Display name, e.g. 'OneDrive'. */
  label: string;
  /** Absolute folder we would write snapshots into. */
  path: string;
  /** True when this folder is synced off the machine by a third-party client. */
  cloud: boolean;
}

/** Subfolder we create inside whichever root the owner picks. */
const APP_FOLDER = 'HardwareKhataPOS';
const BACKUP_SUBFOLDER = 'Backups';

function candidate(label: string, root: string | undefined, cloud: boolean): CloudFolderOption | null {
  if (!root) return null;
  try {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return null;
  } catch {
    return null;
  }
  return {
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label,
    path: path.join(root, APP_FOLDER, BACKUP_SUBFOLDER),
    cloud,
  };
}

/** The always-available local default: Documents/HardwareKhataPOS/Backups. */
export function defaultBackupFolder(): string {
  return path.join(app.getPath('documents'), APP_FOLDER, BACKUP_SUBFOLDER);
}

/**
 * Every place we can offer to put backups, local first.
 *
 * Cloud roots are DETECTED, never assumed: each candidate is only returned if
 * the folder actually exists on this machine, so the owner is never offered a
 * OneDrive option on a PC without OneDrive.
 */
export function backupFolderOptions(): CloudFolderOption[] {
  const home = app.getPath('home');
  const env = process.env;

  const options: (CloudFolderOption | null)[] = [
    candidate('This computer', app.getPath('documents'), false),
    // OneDrive sets one of these; consumer and business installs differ.
    candidate('OneDrive', env.OneDriveConsumer || env.OneDrive, true),
    candidate('OneDrive for Business', env.OneDriveCommercial, true),
    // Google Drive for desktop uses 'My Drive' under a mounted letter, but it
    // also creates a shortcut folder in the profile on most installs.
    candidate('Google Drive', path.join(home, 'Google Drive'), true),
    candidate('Google Drive', path.join(home, 'My Drive'), true),
    candidate('Dropbox', path.join(home, 'Dropbox'), true),
    candidate('iCloud Drive', path.join(home, 'iCloudDrive'), true),
  ];

  // De-duplicate by resolved path (Google Drive can match twice).
  const seen = new Set<string>();
  const out: CloudFolderOption[] = [];
  for (const o of options) {
    if (!o) continue;
    const key = o.path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

/**
 * Work out whether a folder the owner typed or picked is inside a cloud-synced
 * root, so the UI can tell them the truth about whether data leaves the machine.
 */
export function classifyFolder(folder: string): { cloud: boolean; label?: string } {
  const target = path.resolve(folder).toLowerCase();
  for (const o of backupFolderOptions()) {
    if (!o.cloud) continue;
    // Compare against the sync ROOT, not our subfolder, so any location the
    // owner picks inside OneDrive is recognised.
    const root = path.resolve(o.path, '..', '..').toLowerCase();
    if (target === root || target.startsWith(root + path.sep)) {
      return { cloud: true, label: o.label };
    }
  }
  return { cloud: false };
}

// -------------------------------------------------------- removable media (USB)

export interface UsbDrive {
  /** Root path, e.g. 'E:\\'. */
  root: string;
  /** Drive letter without the colon, e.g. 'E'. */
  letter: string;
  /** Volume label if the drive has one, e.g. 'SANDISK'. */
  label: string;
  /** Free bytes, or null when Windows would not report it. */
  freeBytes: number | null;
  totalBytes: number | null;
  /** What the UI shows, e.g. 'E: (SANDISK)'. */
  display: string;
}

/**
 * List plugged-in removable drives (pendrives, SD cards, portable HDDs).
 *
 * WHY POWERSHELL
 * Node has no API for "is this drive removable". Windows knows: WMI's
 * Win32_LogicalDisk exposes DriveType, where 2 = removable. We ask for JSON and
 * parse it. `wmic` would be shorter but Microsoft has been removing it from
 * Windows since 2023, so it cannot be relied on.
 *
 * If the query fails for any reason (PowerShell disabled by policy, unexpected
 * output) we return an empty list rather than guessing. Offering the owner a
 * fixed disk as a "pendrive" would be worse than saying we could not find one:
 * they would think the shop's data is on a stick they can take home, and it
 * would not be.
 */
export async function listUsbDrives(): Promise<UsbDrive[]> {
  if (process.platform !== 'win32') return [];

  const script =
    'Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=2" | ' +
    'Select-Object DeviceID,VolumeName,FreeSpace,Size | ConvertTo-Json -Compress';

  const stdout = await new Promise<string>((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 8000, windowsHide: true },
      (err, out) => resolve(err ? '' : out),
    );
  });

  if (!stdout.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }
  // ConvertTo-Json emits a bare object for a single result and an array for many.
  const raw = (Array.isArray(parsed) ? parsed : [parsed]) as {
    DeviceID?: string;
    VolumeName?: string;
    FreeSpace?: number | string | null;
    Size?: number | string | null;
  }[];

  const num = (v: number | string | null | undefined): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const drives: UsbDrive[] = [];
  for (const d of raw) {
    const id = (d.DeviceID ?? '').trim(); // 'E:'
    if (!/^[A-Za-z]:$/.test(id)) continue;
    const root = id + path.sep;
    // A card reader with no card shows up as a removable drive with no media.
    // Only offer drives we can actually write to.
    try {
      if (!fs.existsSync(root)) continue;
    } catch {
      continue;
    }
    const label = (d.VolumeName ?? '').trim();
    drives.push({
      root,
      letter: id[0].toUpperCase(),
      label,
      freeBytes: num(d.FreeSpace),
      totalBytes: num(d.Size),
      display: label ? `${id} (${label})` : id,
    });
  }
  return drives;
}

/**
 * Copy a verified snapshot onto a pendrive.
 *
 * `drive` is the root of a specific drive ('E:\\'); when omitted we use the only
 * plugged-in removable drive. If there are several we do NOT pick one — the
 * caller asks the owner which, because writing the shop's whole database onto
 * the wrong stick is not something to guess at.
 *
 * The snapshot goes to <drive>\HardwareKhataPOS\Backups\ — the same layout as
 * every other destination, so the same files are recognisable wherever they are.
 * It does NOT become the configured backup folder and does NOT prune anything
 * already on the stick (see `snapshotTo`).
 */
export async function backupToUsb(drive?: string): Promise<{
  ok: boolean;
  error?: string;
  /** Set when several drives are plugged in and none was specified. */
  drives?: UsbDrive[];
  name?: string;
  path?: string;
  at?: string;
  bytes?: number;
  driveLabel?: string;
}> {
  const drives = await listUsbDrives();
  if (drives.length === 0) {
    return {
      ok: false,
      error:
        'No pendrive found. Plug one into a USB port, wait for Windows to recognise it, then try again.',
    };
  }

  let target = drives[0];
  if (drive) {
    const wanted = drives.find((d) => d.root.toLowerCase() === drive.toLowerCase());
    if (!wanted) {
      return { ok: false, error: 'That drive is no longer connected.', drives };
    }
    target = wanted;
  } else if (drives.length > 1) {
    return { ok: false, error: 'More than one drive is connected — choose which one.', drives };
  }

  // Fail BEFORE writing if the stick is too small, so the owner gets a clear
  // message instead of a half-written file and an ENOSPC.
  const dbBytes = (() => {
    try {
      return fs.statSync(dbFilePath()).size;
    } catch {
      return 0;
    }
  })();
  if (target.freeBytes !== null && dbBytes > 0 && target.freeBytes < dbBytes) {
    return {
      ok: false,
      error: `Not enough space on ${target.display}. Free up about ${Math.ceil(dbBytes / (1024 * 1024))} MB and try again.`,
    };
  }

  const folder = path.join(target.root, APP_FOLDER, BACKUP_SUBFOLDER);
  try {
    const result = snapshotTo(getDb(), folder);
    setBackupConfig(getDb(), {
      lastUsbBackupAt: result.at,
      lastUsbBackupPath: result.path,
      lastUsbLabel: target.display,
    });
    return { ...result, driveLabel: target.display };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

/** Set the default folder on first boot if the owner has never chosen one. */
export function initBackupDefaults(): void {
  try {
    const cfg = ensureBackupFolder(getDb(), defaultBackupFolder());
    // Create it now rather than lazily on the first snapshot, so "Open folder"
    // works immediately and the owner can see WHERE their backups will go before
    // one has been taken.
    if (cfg.folder) fs.mkdirSync(cfg.folder, { recursive: true });
    // Keep the cloud flag honest even if the folder was set by an older build.
    const seen = classifyFolder(cfg.folder);
    if (seen.cloud !== cfg.cloudFolder || seen.label !== cfg.cloudLabel) {
      setBackupConfig(getDb(), { cloudFolder: seen.cloud, cloudLabel: seen.label });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[backup] could not initialise defaults:', e);
  }
}

// ------------------------------------------------------------------- pickers

/**
 * Native folder picker.
 *
 * `target` says WHICH folder is being chosen: the snapshot folder, or the folder
 * "Save as PDF" writes invoices into. They are separate settings on purpose — a
 * shop may want invoice PDFs somewhere convenient to browse while snapshots go
 * to a cloud-synced folder.
 */
export async function chooseBackupFolder(preset?: string, target: 'backup' | 'pdf' = 'backup') {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
  const cfg = getBackupConfig(getDb());
  const isPdf = target === 'pdf';
  const defaultPath = preset || (isPdf ? cfg.pdfFolder : cfg.folder) || defaultBackupFolder();
  const title = isPdf ? 'Choose invoice PDF folder' : 'Choose backup folder';
  const result = win
    ? await dialog.showOpenDialog(win, {
        title,
        defaultPath,
        properties: ['openDirectory', 'createDirectory'],
      })
    : await dialog.showOpenDialog({
        title,
        defaultPath,
        properties: ['openDirectory', 'createDirectory'],
      });

  if (result.canceled || result.filePaths.length === 0) return { cancelled: true as const };
  const picked = result.filePaths[0];
  if (isPdf) {
    fs.mkdirSync(picked, { recursive: true });
    return { cancelled: false as const, config: setBackupConfig(getDb(), { pdfFolder: picked }) };
  }
  return { cancelled: false as const, config: applyFolder(picked) };
}

/** Persist the invoice-PDF folder directly (used by the one-click suggestions). */
export function applyPdfFolder(folder: string) {
  fs.mkdirSync(folder, { recursive: true });
  return setBackupConfig(getDb(), { pdfFolder: folder });
}

/** Persist a folder choice, recording whether it is cloud-synced. */
export function applyFolder(folder: string) {
  const seen = classifyFolder(folder);
  fs.mkdirSync(folder, { recursive: true });
  return setBackupConfig(getDb(), {
    folder,
    cloudFolder: seen.cloud,
    cloudLabel: seen.label,
  });
}

/** Open the backup folder in Explorer so the owner can see the files exist. */
export function revealBackupFolder(): { ok: boolean; error?: string } {
  const folder = getBackupConfig(getDb()).folder;
  if (!folder) return { ok: false, error: 'No backup folder is set.' };
  try {
    fs.mkdirSync(folder, { recursive: true });
    void shell.openPath(folder);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ------------------------------------------------------------------- restore

/**
 * RESTORE — replace the live shop database with a snapshot.
 *
 * This is the single most destructive thing the app can do: every sale, payment
 * and stock movement recorded since the snapshot is discarded. So:
 *
 *   1. The snapshot is VERIFIED first (integrity_check + readable core tables).
 *      A corrupt file is refused before anything is touched.
 *   2. The owner sees a native confirmation naming the snapshot, its date and
 *      exactly what will be lost. Defaults to Cancel.
 *   3. The CURRENT database is copied aside to `pre-restore-<timestamp>.sqlite3`
 *      in the backup folder BEFORE being overwritten, so a mistaken restore is
 *      itself recoverable.
 *   4. The `-wal` / `-shm` sidecars are removed. Leaving a stale WAL next to a
 *      replaced database would let SQLite replay the OLD shop's pages over the
 *      restored file — silent corruption.
 *   5. The app relaunches, because every open handle and all renderer state now
 *      refers to a database that no longer exists.
 */
export async function restoreFromSnapshot(payload: { file?: string } = {}) {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
  const cfg = getBackupConfig(getDb());

  // ---- pick the file ----
  let file = payload.file;
  if (!file) {
    const picked = win
      ? await dialog.showOpenDialog(win, {
          title: 'Choose a backup to restore',
          defaultPath: cfg.folder || defaultBackupFolder(),
          filters: [{ name: 'POS backup', extensions: ['sqlite3', 'db', 'sqlite'] }],
          properties: ['openFile'],
        })
      : await dialog.showOpenDialog({
          title: 'Choose a backup to restore',
          filters: [{ name: 'POS backup', extensions: ['sqlite3', 'db', 'sqlite'] }],
          properties: ['openFile'],
        });
    if (picked.canceled || picked.filePaths.length === 0) return { cancelled: true as const };
    file = picked.filePaths[0];
  }

  // ---- 1. verify BEFORE touching anything ----
  const check = verifySnapshot(file);
  if (!check.ok) {
    return { ok: false as const, error: `That file is not a usable backup: ${check.error}` };
  }

  // ---- 2. explicit, named confirmation ----
  const name = path.basename(file);
  const counts = check.counts ?? {};
  const detail =
    `Backup file: ${name}\n` +
    `It contains ${counts.sales ?? 0} sales, ${counts.products ?? 0} products and ` +
    `${counts.customers ?? 0} customers.\n\n` +
    'Everything recorded in the shop AFTER this backup was taken will be lost.\n' +
    'A copy of the current database is saved first, and the app will restart.';
  const confirm = await (win
    ? dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Cancel', 'Replace shop data'],
        defaultId: 0,
        cancelId: 0,
        title: 'Restore backup?',
        message: 'This replaces all current shop data.',
        detail,
        noLink: true,
      })
    : dialog.showMessageBox({
        type: 'warning',
        buttons: ['Cancel', 'Replace shop data'],
        defaultId: 0,
        cancelId: 0,
        title: 'Restore backup?',
        message: 'This replaces all current shop data.',
        detail,
        noLink: true,
      }));
  if (confirm.response !== 1) return { cancelled: true as const };

  const live = dbFilePath();
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '-');
  const safetyDir = cfg.folder || defaultBackupFolder();
  const safetyCopy = path.join(safetyDir, `pre-restore-${stamp}.sqlite3`);

  try {
    // ---- 3. safety copy of the CURRENT data, taken while the DB is still open
    // so it is a consistent VACUUM INTO image rather than a raw file copy.
    fs.mkdirSync(safetyDir, { recursive: true });
    getDb().prepare('VACUUM INTO ?').run(safetyCopy);

    // ---- 4. swap ----
    closeDb();
    fs.copyFileSync(file, live);
    for (const sidecar of [live + '-wal', live + '-shm']) {
      if (fs.existsSync(sidecar)) fs.rmSync(sidecar, { force: true });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error('[backup] restore failed:', message);
    return { ok: false as const, error: `Restore failed: ${message}` };
  }

  // ---- 5. relaunch ----
  app.relaunch();
  app.exit(0);
  return { ok: true as const, restoredFrom: file, safetyCopy };
}

// ------------------------------------------------------- automatic scheduling

let timer: NodeJS.Timeout | null = null;

/** How often the daily check wakes up. Cheap: it only reads the config. */
const TICK_MS = 10 * 60 * 1000;

/**
 * Start the automatic-backup timer.
 *
 * 'daily' is checked on a tick rather than scheduled as a 02:00 alarm, because a
 * shop PC is usually switched off overnight — an alarm would silently never
 * fire. `isDailyBackupDue` (pure, verified) decides; this just asks it.
 */
export function startAutoBackup(): void {
  stopAutoBackup();
  timer = setInterval(() => {
    try {
      const db = getDb();
      const cfg = getBackupConfig(db);
      if (!isDailyBackupDue(cfg, new Date())) return;
      const res = runBackup(db);
      // eslint-disable-next-line no-console
      console.log(`[backup] daily snapshot written: ${res.name} (${res.bytes} bytes)`);
    } catch (e) {
      // Never let a failed backup take the app down; the error is recorded in
      // the config and surfaced on the Backup screen.
      // eslint-disable-next-line no-console
      console.error('[backup] daily snapshot failed:', e);
    }
  }, TICK_MS);
  // Don't hold the process open just for the timer.
  timer.unref?.();
}

export function stopAutoBackup(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Called by the IPC layer right after a shift is closed successfully.
 * A shift close is the natural end of the trading day, which is why it is the
 * recommended trigger: the snapshot captures the day's takings immediately.
 */
export function onShiftClosed(): void {
  try {
    const db = getDb();
    if (getBackupConfig(db).auto !== 'on-shift-close') return;
    const res = runBackup(db);
    // eslint-disable-next-line no-console
    console.log(`[backup] shift-close snapshot written: ${res.name}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[backup] shift-close snapshot failed:', e);
  }
}

/** Re-export so ipc.ts can validate a filename without importing the service. */
export { isSnapshotName };
