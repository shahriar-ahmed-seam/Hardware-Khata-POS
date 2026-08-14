import { BrowserWindow, shell, app } from 'electron';
import path from 'node:path';
import {
  invoicePdfFileName,
  invoicePdfTargetsFor,
  listInvoicePdfs,
  saveInvoicePdfCopies,
  INVOICE_SUBFOLDER,
  type SaveResult,
} from '../backend/services/invoices.ts';
import { getBackupConfig, setBackupConfig } from '../backend/services/backup.ts';
import { getDb, dbFilePath } from './db.ts';

/**
 * INVOICE → PDF (the Electron half)
 *
 * HOW THE PDF IS RENDERED
 * It reuses the print pipeline that already exists and is already verified,
 * rather than introducing a PDF library and a second copy of the receipt layout
 * that would drift from the printed one.
 *
 * `webContents.printToPDF()` applies the PRINT stylesheet. When the receipt
 * modal is open a `<PrintSheet>` is mounted, which portals the receipt outside
 * `#root` and puts `has-print-sheet` on <body> — and the print CSS then hides
 * `#root` entirely and shows only that sheet. So printToPDF captures exactly the
 * same black-on-white receipt that the Print button sends to the printer. No
 * app chrome, no dark theme, no second layout to maintain.
 *
 * WHY A4
 * The PDF is an archive/emailing artefact, not the thermal slip. `.print-frame-sheet`
 * is `width: auto` under print, and the receipt body is fluid, so on A4 it simply
 * lays out at A4 width. A thermal-width PDF would be a tall ribbon that no
 * office printer or accountant wants.
 */
const PDF_PAGE_SIZE = 'A4' as const;

function targetWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

/** Folder holding the live database — invoice PDFs are archived alongside it. */
function dbFolder(): string {
  return path.dirname(dbFilePath());
}

/**
 * Resolve a default PDF folder once, if the owner has never chosen one.
 * Mirrors `initBackupDefaults` — Documents/HardwareKhataPOS/Invoices.
 */
export function initInvoicePdfDefaults(): void {
  try {
    const db = getDb();
    const cfg = getBackupConfig(db);
    if (cfg.pdfFolder) return;
    setBackupConfig(db, {
      pdfFolder: path.join(app.getPath('documents'), 'HardwareKhataPOS', 'Invoices'),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[invoice-pdf] could not initialise the default folder:', e);
  }
}

export interface SavePdfResponse extends SaveResult {
  fileName: string;
}

/**
 * Render the currently-previewed invoice to PDF and write every archive copy.
 *
 * Returns which copies succeeded and which did not; a single unwritable target
 * (unplugged drive, cloud folder mid-sync) must not lose the other copies.
 */
export async function saveInvoicePdf(payload: {
  invoiceNo?: string;
}): Promise<SavePdfResponse | { ok: false; error: string }> {
  const win = targetWindow();
  if (!win) return { ok: false, error: 'No window is open to render the invoice.' };

  const invoiceNo = (payload?.invoiceNo ?? '').trim();
  const fileName = invoicePdfFileName(invoiceNo);

  let pdf: Buffer;
  try {
    pdf = await win.webContents.printToPDF({
      pageSize: PDF_PAGE_SIZE,
      // The receipt draws its own rules and the barcode as a background, so
      // backgrounds must be kept or the barcode would come out blank.
      printBackground: true,
      landscape: false,
    });
  } catch (e) {
    return {
      ok: false,
      error: `Could not create the PDF: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!pdf || pdf.length === 0) {
    return { ok: false, error: 'The PDF came out empty. Keep the receipt open and try again.' };
  }

  const targets = invoicePdfTargetsFor(getDb(), dbFolder());
  if (targets.length === 0) {
    return { ok: false, error: 'No folder is set to save PDFs into.' };
  }

  const result = saveInvoicePdfCopies(pdf, fileName, targets);
  if (result.saved.length === 0) {
    const why = result.failed[0]?.error ?? 'unknown error';
    return { ok: false, error: `Could not write the PDF: ${why}` };
  }
  return { ...result, fileName };
}

/** Archived invoice PDFs from the folder that travels with the database. */
export function listArchivedInvoices(limit?: number) {
  return listInvoicePdfs(path.join(dbFolder(), INVOICE_SUBFOLDER), limit);
}

/** Open the owner's PDF folder in Explorer. */
export function revealPdfFolder(): { ok: boolean; error?: string } {
  const folder = getBackupConfig(getDb()).pdfFolder || path.join(dbFolder(), INVOICE_SUBFOLDER);
  try {
    void shell.openPath(folder);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Open one saved PDF in the system's default viewer. */
export function openPdf(file: string): { ok: boolean; error?: string } {
  if (!file) return { ok: false, error: 'No file given' };
  try {
    void shell.openPath(file);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
