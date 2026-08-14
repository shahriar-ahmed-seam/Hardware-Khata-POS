import fs from 'node:fs';
import path from 'node:path';
import type { DB } from '../db/connection.ts';
import { getBackupConfig } from './backup.ts';

/**
 * INVOICE PDF ARCHIVE
 *
 * "Save as PDF" on the receipt writes the same file to up to THREE places, and
 * that redundancy is the point:
 *
 *   1. the owner's chosen PDF folder — the copy they actually go looking for
 *   2. `<database folder>/invoices/` — travels with the database, so a PDF is
 *      never separated from the shop data it belongs to
 *   3. `<backup folder>/invoices/` — if that folder is one the owner's OneDrive /
 *      Google Drive / Dropbox client syncs, the invoice leaves the machine by
 *      exactly the same mechanism (and with the same guarantees) as the nightly
 *      database snapshot
 *
 * Everything in this file is pure logic + `fs`, no Electron, so the verify
 * harness can prove the naming and the de-duplication. Rendering the PDF itself
 * needs Chromium (`webContents.printToPDF`) and therefore lives in
 * electron/invoicePdf.ts.
 */

/** Subfolder used inside the database and backup folders. */
export const INVOICE_SUBFOLDER = 'invoices';

/**
 * Filename for an invoice PDF.
 *
 * Invoice numbers are shop data and can legitimately contain characters Windows
 * forbids in filenames (`/` in particular is common in hand-set invoice
 * schemes), so they are sanitised rather than trusted. An empty or
 * all-punctuation number still has to produce a usable name, hence the fallback.
 */
export function invoicePdfFileName(invoiceNo: string): string {
  const cleaned = String(invoiceNo ?? '')
    .trim()
    // Windows-illegal characters plus anything non-printable.
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    // Collapse runs of separators and trim them from the ends.
    .replace(/[-\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    // Trailing dots are also illegal on Windows.
    .replace(/\.+$/, '');
  const base = cleaned.length > 0 ? cleaned.slice(0, 120) : 'invoice';
  return `${base}.pdf`;
}

export interface PdfTarget {
  dir: string;
  /** Why this copy exists — surfaced in the UI so the owner knows where it went. */
  kind: 'chosen' | 'database' | 'backup';
}

/**
 * Every folder an invoice PDF should be written to, de-duplicated.
 *
 * De-duplication matters: an owner can perfectly reasonably point their PDF
 * folder AT the backup folder, and writing the same file twice to one directory
 * would just be a wasted write and a confusing "saved to 3 places" message.
 * Comparison is case-insensitive and path-normalised because Windows treats
 * `C:\Shop\PDFs` and `c:/shop/pdfs` as the same directory.
 */
export function invoicePdfTargets(opts: {
  pdfFolder?: string;
  dbFolder?: string;
  backupFolder?: string;
}): PdfTarget[] {
  const candidates: PdfTarget[] = [];
  if (opts.pdfFolder) candidates.push({ dir: opts.pdfFolder, kind: 'chosen' });
  if (opts.dbFolder) {
    candidates.push({ dir: path.join(opts.dbFolder, INVOICE_SUBFOLDER), kind: 'database' });
  }
  if (opts.backupFolder) {
    candidates.push({ dir: path.join(opts.backupFolder, INVOICE_SUBFOLDER), kind: 'backup' });
  }

  const seen = new Set<string>();
  const out: PdfTarget[] = [];
  for (const c of candidates) {
    if (!c.dir) continue;
    const key = path.resolve(c.dir).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, dir: path.resolve(c.dir) });
  }
  return out;
}

/** Resolve the PDF targets for this installation from the stored config. */
export function invoicePdfTargetsFor(db: DB, dbFolder: string): PdfTarget[] {
  const cfg = getBackupConfig(db);
  return invoicePdfTargets({
    pdfFolder: cfg.pdfFolder,
    dbFolder,
    backupFolder: cfg.folder,
  });
}

export interface SavedCopy {
  path: string;
  kind: PdfTarget['kind'];
  bytes: number;
}

export interface SaveResult {
  /** The copy the owner should be pointed at (their chosen folder if set). */
  primary: SavedCopy | null;
  saved: SavedCopy[];
  /** Targets that could not be written, with the reason. Never throws for these. */
  failed: { dir: string; kind: PdfTarget['kind']; error: string }[];
}

/**
 * Write one PDF buffer to every target.
 *
 * A failure on ONE target must not lose the others: an unplugged USB drive or a
 * cloud folder mid-sync should not stop the invoice being archived next to the
 * database. Each write is therefore attempted independently and failures are
 * reported rather than thrown.
 */
export function saveInvoicePdfCopies(
  pdf: Uint8Array,
  fileName: string,
  targets: PdfTarget[],
): SaveResult {
  const saved: SavedCopy[] = [];
  const failed: SaveResult['failed'] = [];

  for (const t of targets) {
    const full = path.join(t.dir, fileName);
    try {
      fs.mkdirSync(t.dir, { recursive: true });
      fs.writeFileSync(full, pdf);
      saved.push({ path: full, kind: t.kind, bytes: fs.statSync(full).size });
    } catch (e) {
      failed.push({ dir: t.dir, kind: t.kind, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Prefer the owner's own folder as the copy to report; fall back to whatever
  // did succeed so a message is never empty when something was written.
  const primary = saved.find((s) => s.kind === 'chosen') ?? saved[0] ?? null;
  return { primary, saved, failed };
}

export interface ArchivedInvoice {
  name: string;
  path: string;
  bytes: number;
  /** File mtime — these are plain files, there is no embedded timestamp. */
  at: string;
}

/**
 * List the archived invoice PDFs in a folder, newest first.
 *
 * Used by the Backup screen so the owner can confirm the archive is really
 * filling up, without leaving the app to open a file manager.
 */
export function listInvoicePdfs(dir: string, limit = 200): ArchivedInvoice[] {
  if (!dir || !fs.existsSync(dir)) return [];
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out: ArchivedInvoice[] = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.pdf')) continue;
    try {
      const st = fs.statSync(path.join(dir, name));
      if (!st.isFile()) continue;
      out.push({ name, path: path.join(dir, name), bytes: st.size, at: st.mtime.toISOString() });
    } catch {
      continue;
    }
  }
  return out
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, Math.min(Math.max(1, limit), 1000));
}
