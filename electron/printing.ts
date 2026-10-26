import { BrowserWindow, type PrinterInfo } from 'electron';
import net from 'node:net';

/**
 * REAL PRINTING (the Electron half). See src/lib/printing.ts for the renderer.
 *
 * Three ways a document reaches paper:
 *
 *  1. INSTALLED PRINTER (USB thermal with its Windows driver, or any A4 printer).
 *     The renderer serialises the print sheet into ONE self-contained HTML page
 *     (the app's CSS inlined + the sheet's markup). It is loaded into a hidden,
 *     sandboxed window with no preload — so it can reach nothing — and printed
 *     with `webContents.print`, silently to the chosen printer when the shop has
 *     configured one. The printed copy is the same markup as the preview.
 *
 *  2. NETWORK ESC/POS (a LAN thermal printer on port 9100). The renderer encodes
 *     ESC/POS bytes (src/lib/escpos.ts) and this file writes them to a TCP
 *     socket. Drawer kick and cut are bytes in that stream.
 *
 *  3. Nothing configured / no bridge → the renderer keeps the old
 *     `window.print()` dialog. Nothing here is involved.
 *
 * The hidden window is ALWAYS destroyed — on success, on failure and on timeout.
 */

/** Hidden print/PDF windows, so other code can tell them from the app window. */
const printWindows = new WeakSet<BrowserWindow>();

export function isPrintWindow(win: BrowserWindow): boolean {
  return printWindows.has(win);
}

/** The app's own window (never one of ours). */
function appWindow(): BrowserWindow | null {
  const all = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && !printWindows.has(w));
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !printWindows.has(focused)) return focused;
  return all[0] ?? null;
}

// ---------------------------------------------------------------- printers.list

export interface PrinterListItem {
  name: string;
  displayName: string;
  isDefault: boolean;
  description: string;
  /** Raw OS status code (Windows PRINTER_STATUS_* flags, CUPS state). */
  status: number;
  /** Plain words for the status, or '' when the OS gave nothing useful. */
  statusText: string;
}

/** Windows PRINTER_STATUS_* flags that a shopkeeper can act on. */
const WIN_STATUS: [number, string][] = [
  [0x00000080, 'Offline'],
  [0x00000010, 'Out of paper'],
  [0x00000008, 'Paper jam'],
  [0x00000002, 'Error'],
  [0x00000001, 'Paused'],
  [0x00400000, 'Door open'],
  [0x00000400, 'Printing'],
];

function statusText(p: PrinterInfo): string {
  const code = Number(p.status ?? 0);
  if (process.platform === 'win32') {
    if (!code) return 'Ready';
    const hit = WIN_STATUS.find(([flag]) => (code & flag) !== 0);
    return hit ? hit[1] : '';
  }
  // CUPS: printer-state 3 idle, 4 printing, 5 stopped.
  const state = Number((p.options as Record<string, string> | undefined)?.['printer-state'] ?? code);
  if (state === 3) return 'Ready';
  if (state === 4) return 'Printing';
  if (state === 5) return 'Stopped';
  return '';
}

export async function listPrinters(): Promise<PrinterListItem[]> {
  const win = appWindow();
  if (!win) return [];
  const wc = win.webContents as Electron.WebContents & { getPrinters?: () => PrinterInfo[] };
  let list: PrinterInfo[] = [];
  if (typeof wc.getPrintersAsync === 'function') list = await wc.getPrintersAsync();
  else if (typeof wc.getPrinters === 'function') list = wc.getPrinters();
  return list.map((p) => ({
    name: p.name,
    displayName: p.displayName || p.name,
    isDefault: !!p.isDefault,
    description: p.description ?? '',
    status: Number(p.status ?? 0),
    statusText: statusText(p),
  }));
}

// ---------------------------------------------------------------- hidden window

const LOAD_TIMEOUT_MS = 30_000;
/** A print dialog waits for a person; the silent path must not. */
const DIALOG_TIMEOUT_MS = 5 * 60_000;
/** Data URLs past this are refused by Chromium (2 MB URL cap), with headroom. */
const MAX_HTML_BYTES = 1_400_000;

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} took too long (over ${Math.round(ms / 1000)} s).`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * The directory the app itself was loaded from (dev server root or dist/), so
 * the print page resolves the app's fonts and stylesheets exactly as the app
 * does. Falls back to undefined (plain data: URL) when there is no app window.
 */
function appBaseUrl(): string | undefined {
  const url = appWindow()?.webContents.getURL();
  if (!url) return undefined;
  try {
    const u = new URL('.', url);
    if (u.protocol === 'file:' || u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch {
    /* fall through */
  }
  return undefined;
}

/**
 * Lock the page down further than the sandbox already does: no script, and
 * styles/fonts/images only from the app itself or inline. Injected by the main
 * process so whatever the renderer sent cannot opt out of it.
 */
function withCsp(html: string, base: string | undefined): string {
  let self = '';
  if (base) {
    const u = new URL(base);
    self = u.protocol === 'file:' ? 'file:' : u.origin;
  }
  const csp = [
    "default-src 'none'",
    "script-src 'none'",
    `style-src 'unsafe-inline' ${self}`.trim(),
    `font-src data: ${self}`.trim(),
    `img-src data: blob: ${self}`.trim(),
  ].join('; ');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${meta}`);
  return `<!doctype html><html><head>${meta}</head><body>${html}</body></html>`;
}

/**
 * Load `html` into a fresh hidden window and run `use` on it. The window is
 * destroyed whatever happens.
 */
async function withHiddenPage<T>(
  html: string,
  widthPx: number,
  use: (win: BrowserWindow) => Promise<T>,
): Promise<T> {
  if (typeof html !== 'string' || !html.trim()) throw new Error('Nothing to print.');
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) throw new Error('The document is too large to print.');

  const base = appBaseUrl();
  const win = new BrowserWindow({
    show: false,
    width: Math.max(400, Math.min(1200, Math.round(widthPx) + 40)),
    height: 1000,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
      // A hidden window is throttled hard; fonts and layout must still finish.
      backgroundThrottling: false,
    },
  });
  printWindows.add(win);
  const wc = win.webContents;
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e) => e.preventDefault());
  wc.on('will-redirect', (e) => e.preventDefault());
  wc.on('will-attach-webview', (e) => e.preventDefault());

  try {
    const dataUrl = `data:text/html;charset=utf-8;base64,${Buffer.from(withCsp(html, base), 'utf8').toString('base64')}`;
    try {
      await withTimeout(wc.loadURL(dataUrl, base ? { baseURLForDataURL: base } : undefined), LOAD_TIMEOUT_MS, 'Loading the document');
    } catch (e) {
      // A base URL the platform will not accept: load without it (fonts then
      // fall back to the system's, the layout is unchanged).
      if (!base || wc.isDestroyed()) throw e;
      await withTimeout(wc.loadURL(dataUrl), LOAD_TIMEOUT_MS, 'Loading the document');
    }
    return await use(win);
  } finally {
    printWindows.delete(win);
    if (!win.isDestroyed()) win.destroy();
  }
}

/**
 * Wait for web fonts (Bangla) and return the content height in CSS px.
 * Bounded: if the page never answers, print anyway at a safe height.
 */
async function settleAndMeasure(win: BrowserWindow): Promise<number | null> {
  const script = `(async () => {
    try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]); } catch (e) {}
    const b = document.body, d = document.documentElement;
    return Math.ceil(Math.max(b ? b.scrollHeight : 0, d ? d.scrollHeight : 0));
  })()`;
  try {
    const h = await withTimeout(win.webContents.executeJavaScript(script, true) as Promise<unknown>, 6000, 'Preparing the page');
    const n = Number(h);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- printers.printHtml

export type PaperWidthMm = 58 | 80 | 210;

export interface PrintHtmlInput {
  html?: unknown;
  deviceName?: unknown;
  paperWidthMm?: unknown;
  copies?: unknown;
  silent?: unknown;
}

const PX_PER_MM = 96 / 25.4;

function paperWidth(v: unknown): PaperWidthMm {
  const n = Number(v);
  return n === 58 || n === 210 ? n : 80;
}

/** One job at a time, so two receipts never interleave in the spooler. */
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

export function printHtml(input: PrintHtmlInput): Promise<{ ok: boolean; error?: string }> {
  return enqueue(() => doPrintHtml(input));
}

async function doPrintHtml(input: PrintHtmlInput): Promise<{ ok: boolean; error?: string }> {
  const html = typeof input?.html === 'string' ? input.html : '';
  const width = paperWidth(input?.paperWidthMm);
  const copies = Math.max(1, Math.min(10, Math.floor(Number(input?.copies) || 1)));
  const silent = input?.silent !== false;
  const deviceName = typeof input?.deviceName === 'string' ? input.deviceName.trim() : '';

  try {
    // Silent printing to a name Windows does not know fails with an unhelpful
    // message (or not at all on some drivers), so check it first.
    if (deviceName) {
      const installed = await listPrinters().catch(() => [] as PrinterListItem[]);
      if (installed.length > 0 && !installed.some((p) => p.name === deviceName)) {
        return { ok: false, error: `The printer "${deviceName}" is not installed on this PC.` };
      }
    }

    await withHiddenPage(html, width * PX_PER_MM, async (win) => {
      const heightPx = await settleAndMeasure(win);
      let pageSize: Electron.WebContentsPrintOptions['pageSize'];
      if (width === 210) {
        pageSize = 'A4';
      } else {
        // A roll has no page length: size the page to the content (+5 mm feed)
        // so the printer does not feed a metre of blank paper. Height is kept
        // above the width or Chromium treats the page as landscape.
        const contentMm = heightPx ? heightPx / PX_PER_MM : 200;
        const heightMm = Math.min(3000, Math.max(width + 10, Math.ceil(contentMm + 5)));
        pageSize = { width: width * 1000, height: heightMm * 1000 };
      }

      const job = new Promise<void>((resolve, reject) => {
        win.webContents.print(
          {
            silent,
            deviceName: deviceName || undefined,
            printBackground: true,
            margins: { marginType: 'none' },
            copies,
            pageSize,
          },
          (success, failureReason) => {
            if (success) resolve();
            else reject(new Error(failureReason === 'cancelled' ? 'Printing was cancelled.' : failureReason || 'The printer refused the job.'));
          },
        );
      });
      await withTimeout(job, silent ? LOAD_TIMEOUT_MS : DIALOG_TIMEOUT_MS, 'Printing');
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------- PDF from HTML (R75)

/**
 * Render self-contained HTML to an A4 PDF in a hidden window, instead of
 * capturing whatever the app window shows. Used by electron/invoicePdf.ts.
 */
export function htmlToPdf(html: string): Promise<Buffer> {
  return enqueue(() =>
    withHiddenPage(html, 210 * PX_PER_MM, async (win) => {
      await settleAndMeasure(win);
      return withTimeout(
        // No PDF margins: the A4 page from buildPrintHtml pads itself by 10 mm.
        win.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true,
          landscape: false,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
        LOAD_TIMEOUT_MS,
        'Creating the PDF',
      );
    }),
  );
}

// ---------------------------------------------------------------- printers.rawEscpos

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HOSTNAME = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** Null when the address is usable, else why not. Pure, for the checks. */
export function printerAddressError(host: unknown, port: unknown): string | null {
  if (typeof host !== 'string' || !host.trim()) return 'Enter the printer\'s IP address.';
  const h = host.trim();
  if (!IPV4.test(h) && !(HOSTNAME.test(h) && !/^\d+(\.\d+)*$/.test(h))) {
    return `"${h}" is not an IP address or a computer name.`;
  }
  const p = Number(port);
  if (!Number.isInteger(p) || p < 1 || p > 65535) return 'The port must be a number from 1 to 65535.';
  return null;
}

/** Network ESC/POS addresses saved in Settings → Printers (old and new shapes). */
export function configuredNetworkPrinters(saved: unknown): { host: string; port: number }[] {
  if (!Array.isArray(saved)) return [];
  const out: { host: string; port: number }[] = [];
  for (const raw of saved) {
    const p = (raw ?? {}) as Record<string, unknown>;
    const conn = String(p.connection ?? '').toLowerCase();
    if (conn !== 'network') continue;
    if (typeof p.host === 'string' && p.host.trim()) {
      out.push({ host: p.host.trim(), port: Number(p.port) || 9100 });
    } else if (typeof p.ipOrPort === 'string' && p.ipOrPort.trim()) {
      const [h, pt] = p.ipOrPort.trim().split(':');
      out.push({ host: h, port: Number(pt) || 9100 });
    }
  }
  return out;
}

const CONNECT_TIMEOUT_MS = 5000;
const SEND_TIMEOUT_MS = 15_000;
const MAX_RAW_BYTES = 1_000_000;

export interface RawEscposInput {
  host?: unknown;
  port?: unknown;
  data?: unknown;
}

export function sendRawEscpos(input: RawEscposInput): Promise<{ ok: boolean; error?: string }> {
  const host = typeof input?.host === 'string' ? input.host.trim() : '';
  const port = input?.port == null || input.port === '' ? 9100 : Number(input.port);
  const bad = printerAddressError(host, port);
  if (bad) return Promise.resolve({ ok: false, error: bad });
  if (typeof input?.data !== 'string' || !input.data) return Promise.resolve({ ok: false, error: 'Nothing to print.' });
  const bytes = Buffer.from(input.data, 'base64');
  if (bytes.length === 0) return Promise.resolve({ ok: false, error: 'Nothing to print.' });
  if (bytes.length > MAX_RAW_BYTES) return Promise.resolve({ ok: false, error: 'The document is too large to print.' });

  return enqueue(
    () =>
      new Promise<{ ok: boolean; error?: string }>((resolve) => {
        let settled = false;
        const socket = new net.Socket();
        const finish = (r: { ok: boolean; error?: string }) => {
          if (settled) return;
          settled = true;
          clearTimeout(connectTimer);
          clearTimeout(sendTimer);
          socket.destroy();
          resolve(r);
        };
        const connectTimer = setTimeout(
          () => finish({ ok: false, error: `No answer from the printer at ${host}:${port}. Is it switched on and on the same network?` }),
          CONNECT_TIMEOUT_MS,
        );
        const sendTimer = setTimeout(
          () => finish({ ok: false, error: `The printer at ${host}:${port} stopped responding.` }),
          SEND_TIMEOUT_MS,
        );
        socket.once('error', (e: NodeJS.ErrnoException) => {
          const why =
            e.code === 'ECONNREFUSED'
              ? `The printer at ${host}:${port} refused the connection. Check the port (usually 9100).`
              : e.code === 'EHOSTUNREACH' || e.code === 'ENETUNREACH'
                ? `${host} cannot be reached from this PC.`
                : e.code === 'ENOTFOUND'
                  ? `No computer called "${host}" was found on the network.`
                  : `Could not print to ${host}:${port}: ${e.message}`;
          finish({ ok: false, error: why });
        });
        socket.connect(port, host, () => {
          clearTimeout(connectTimer);
          socket.write(bytes, (err) => {
            if (err) return finish({ ok: false, error: `Could not print to ${host}:${port}: ${err.message}` });
            // Half-close and let the printer drain; a printer that never closes
            // its side is fine — the bytes are already in its buffer.
            socket.end(() => finish({ ok: true }));
          });
        });
      }),
  );
}
