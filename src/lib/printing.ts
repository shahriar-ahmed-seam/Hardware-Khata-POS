/**
 * PRINTING FROM THE RENDERER.
 *
 * Every printable screen already mounts a `<PrintSheet>` (receipt, invoice
 * reprint, goods-received note, X/Z report). `printSheet()` sends that sheet to
 * the printer chosen in Settings → Printers:
 *
 *  - INSTALLED PRINTER (USB thermal / A4, through its Windows driver): the sheet
 *    becomes one self-contained HTML page — the app's CSS rules inlined, the
 *    sheet's markup, the page width set to the paper — and the main process
 *    prints it silently in a hidden window (`printers.printHtml`).
 *  - NETWORK ESC/POS printer: the same sheet is read into text lines and sent
 *    as ESC/POS bytes (`printers.rawEscpos`, src/lib/escpos.ts), with cut and
 *    cash-drawer kick when the profile asks for them.
 *  - No printer configured, or no Electron bridge (browser preview): the old
 *    `window.print()` dialog, unchanged. A failed print also ends there, after
 *    saying why, so the cashier can still pick a printer by hand.
 */
import { api, hasBackend } from './api';
import { BN } from './bn/dict';
import { bytesToBase64, encodeEscpos, type EscLine } from './escpos';
import { toast } from '@/stores/toast';
import {
  defaultPrinter,
  normalizePrinter,
  useSettings,
  type PrinterPaperWidth,
  type PrinterProfile,
} from '@/stores/settings';

/** 'receipt' → the default printer. 'document' → an A4 printer if there is one. */
export type PrintKind = 'receipt' | 'document';

/** Saved profiles, read through the migration so old shapes still work. */
export function printerProfiles(): PrinterProfile[] {
  return useSettings.getState().printers.map(normalizePrinter);
}

export function pickPrinter(kind: PrintKind, list: PrinterProfile[] = printerProfiles()): PrinterProfile | undefined {
  if (kind === 'document') {
    const a4 = list.filter((p) => p.paperWidth === 210);
    return a4.find((p) => p.isDefault) ?? a4[0] ?? defaultPrinter(list);
  }
  return defaultPrinter(list);
}

/** An A4 profile that is NOT the default (for a separate "Print on A4" button). */
export function extraA4Printer(list: PrinterProfile[] = printerProfiles()): PrinterProfile | undefined {
  const def = defaultPrinter(list);
  if (!def || def.paperWidth === 210) return undefined;
  return list.find((p) => p.paperWidth === 210);
}

// ---------------------------------------------------------------- HTML

/** Width the content is laid out at: the printable area of the roll. */
const PRINTABLE_MM: Record<PrinterPaperWidth, number> = { 58: 48, 80: 72, 210: 210 };

/** Make a url(...) in a stylesheet absolute, so the print page can fetch it. */
function absolutizeUrls(cssText: string, base: string): string {
  return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, q: string, ref: string) => {
    if (/^(data:|blob:|#|[a-z][a-z0-9+.-]*:)/i.test(ref.trim())) return whole;
    try {
      return `url(${q}${new URL(ref.trim(), base).href}${q})`;
    } catch {
      return whole;
    }
  });
}

/**
 * The app's CSS as text: every rule of every stylesheet on the page (Tailwind,
 * globals.css, the bundled Bangla font faces). A sheet whose rules cannot be
 * read is linked by URL instead.
 */
export function collectDocumentCss(): { css: string; links: string[] } {
  const parts: string[] = [];
  const links: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    const base = sheet.href ?? document.baseURI;
    try {
      const rules = Array.from(sheet.cssRules);
      parts.push(absolutizeUrls(rules.map((r) => r.cssText).join('\n'), base));
    } catch {
      if (sheet.href) links.push(sheet.href);
    }
  }
  return { css: parts.join('\n'), links };
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * One self-contained page: the app's CSS, then the content at the paper's
 * printable width. `contentHtml` is markup that already renders correctly
 * inside the app (normally a print sheet's `.print-doc`).
 */
export function buildPrintHtml(contentHtml: string, paperWidthMm: PrinterPaperWidth): string {
  const { css, links } = collectDocumentCss();
  // A roll is laid out at its printable width; A4 takes whatever width the
  // printer can print and pads itself, so a printer's unprintable edge never
  // clips the right-hand column.
  const width = paperWidthMm === 210 ? 'auto' : `${PRINTABLE_MM[paperWidthMm]}mm`;
  const pagePad = paperWidthMm === 210 ? '10mm' : '0';
  const own = `
@page { margin: 0; }
html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; color: #000 !important;
  width: auto !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
.hk-print { width: ${width}; box-sizing: border-box; padding: ${pagePad}; overflow: hidden; }
.hk-print .print-frame-sheet { width: 100% !important; max-width: none !important; overflow: visible !important; box-shadow: none !important; }
`;
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    ...links.map((href) => `<link rel="stylesheet" href="${escapeAttr(href)}">`),
    `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`,
    `<style>${own}</style>`,
    '</head><body class="has-print-sheet">',
    // `print-frame-root` without `hidden`: the app's print rules apply, and the
    // page still lays out on screen so its height can be measured.
    `<div class="print-frame-root hk-print"><div class="print-frame-sheet bg-white text-black" style="color-scheme: light">`,
    contentHtml,
    '</div></div></body></html>',
  ].join('');
}

/** The printable document inside a print sheet. */
function docNode(sheet: HTMLElement): HTMLElement {
  return (sheet.querySelector('.print-doc') as HTMLElement | null) ?? sheet;
}

/** The sheet as a self-contained page, e.g. for Save as PDF (A4). */
export function sheetToHtml(sheet: HTMLElement, paperWidthMm: PrinterPaperWidth = 210): string {
  return buildPrintHtml(docNode(sheet).outerHTML, paperWidthMm);
}

// ---------------------------------------------------------------- DOM → ESC/POS lines

let reverseBn: Map<string, string> | null = null;
/** A label the Bangla layer translated on screen, back in English for ASCII. */
function toEnglish(text: string): string {
  if (!/[\u0980-\u09ff]/.test(text)) return text;
  if (!reverseBn) {
    reverseBn = new Map();
    for (const [en, bn] of Object.entries(BN)) if (!reverseBn.has(bn)) reverseBn.set(bn, en);
  }
  const t = text.trim();
  const hit = reverseBn.get(t) ?? reverseBn.get(t.replace(/[:：]\s*$/, ''));
  return hit ?? text;
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'SECTION', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4']);
const SKIP_TAGS = new Set(['IMG', 'SVG', 'svg', 'STYLE', 'SCRIPT', 'CANVAS']);

interface Ctx {
  align: 'left' | 'center' | 'right';
  bold: boolean;
  big: boolean;
}

const cls = (el: Element) => el.getAttribute('class') ?? '';
const textOf = (n: Node) => toEnglish((n.textContent ?? '').replace(/\s+/g, ' ').trim());
const hasRule = (c: string, side: 't' | 'b') =>
  new RegExp(`(^|\\s)border-${side}(\\s|$)`).test(c) && !/border-black\/10/.test(c);
const TOTAL_LABEL = /^(total payable|grand total|total)$/i;

function childCtx(el: Element, ctx: Ctx): Ctx {
  const c = cls(el);
  return {
    align: /(^|\s)text-center(\s|$)/.test(c) ? 'center' : /(^|\s)text-right(\s|$)/.test(c) ? 'right' : /(^|\s)text-left(\s|$)/.test(c) ? 'left' : ctx.align,
    bold: ctx.bold || /(^|\s)font-(bold|semibold)(\s|$)/.test(c),
    big: ctx.big || /text-\[(1[2-9]|[2-9]\d)pt\]/.test(c),
  };
}

function isBlock(n: Node): n is Element {
  return n.nodeType === 1 && BLOCK_TAGS.has((n as Element).tagName);
}

function walk(el: Element, parent: Ctx, out: EscLine[]): void {
  if (SKIP_TAGS.has(el.tagName)) return;
  const c = cls(el);
  const ctx = childCtx(el, parent);
  if (hasRule(c, 't')) out.push({ kind: 'rule' });

  const kids = Array.from(el.children);
  if (el.tagName === 'TR') {
    rowFromCells(kids, ctx, out);
  } else if (/(^|\s)flex(\s|$)/.test(c) && /justify-between/.test(c) && kids.length === 2) {
    const left = textOf(kids[0]);
    const right = textOf(kids[1]);
    const bold = ctx.bold || /font-(bold|semibold)/.test(cls(kids[0]));
    const big = bold && TOTAL_LABEL.test(left);
    if (left || right) out.push({ kind: 'row', left, right, bold, size: big ? 'double' : 'normal' });
  } else if (Array.from(el.childNodes).some(isBlock)) {
    // Mixed content: inline runs become lines, blocks recurse.
    let run = '';
    const flush = () => {
      const t = toEnglish(run.replace(/\s+/g, ' ').trim());
      if (t) out.push({ kind: 'text', text: t, align: ctx.align, bold: ctx.bold, size: ctx.big ? 'double' : 'normal' });
      run = '';
    };
    for (const n of Array.from(el.childNodes)) {
      if (isBlock(n)) {
        flush();
        walk(n, ctx, out);
      } else if (n.nodeType === 1 && SKIP_TAGS.has((n as Element).tagName)) {
        continue;
      } else {
        run += ' ' + (n.textContent ?? '');
      }
    }
    flush();
  } else {
    const t = textOf(el);
    if (t) out.push({ kind: 'text', text: t, align: ctx.align, bold: ctx.bold, size: ctx.big ? 'double' : 'normal' });
  }

  if (hasRule(c, 'b')) out.push({ kind: 'rule' });
}

/** An item row: description lines on the left, the amount on the last one. */
function rowFromCells(cells: Element[], ctx: Ctx, out: EscLine[]): void {
  if (cells.length === 0) return;
  if (cells.length === 1) return walk(cells[0], ctx, out);
  const leftLines: EscLine[] = [];
  walk(cells[0], { ...ctx, align: 'left' }, leftLines);
  const texts = leftLines.flatMap((l) => (l.kind === 'text' ? [l.text] : l.kind === 'row' ? [`${l.left} ${l.right}`] : []));
  const right = cells.slice(1).map(textOf).filter(Boolean).join(' ');
  const bold = ctx.bold || cells[0].tagName === 'TH';
  texts.slice(0, -1).forEach((t) => out.push({ kind: 'text', text: t, bold }));
  out.push({ kind: 'row', left: texts[texts.length - 1] ?? '', right, bold });
}

/** Read a print sheet into ESC/POS lines (layout comes from its own markup). */
export function sheetToEscLines(sheet: HTMLElement): EscLine[] {
  const out: EscLine[] = [];
  walk(docNode(sheet), { align: 'left', bold: false, big: false }, out);
  // Two rules in a row (a bottom border then a top border) print as one.
  return out.filter((l, i) => !(l.kind === 'rule' && out[i - 1]?.kind === 'rule'));
}

// ---------------------------------------------------------------- test print

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A real page for Settings → Printers → Test print: shop name, ruler, date, Bangla. */
function testPageHtml(profile: PrinterProfile, shopName: string, when: string): string {
  // A4 is padded 10 mm a side (buildPrintHtml), leaving 190 mm.
  const width = profile.paperWidth === 210 ? 190 : PRINTABLE_MM[profile.paperWidth];
  const ticks: string[] = [];
  for (let mm = 0; mm <= width; mm += 5) {
    const major = mm % 10 === 0;
    ticks.push(
      `<div style="position:absolute;left:${mm}mm;bottom:0;width:0.3mm;height:${major ? 4 : 2}mm;background:#000"></div>` +
        (major && mm > 0 && mm < width ? `<div style="position:absolute;left:${mm - 2}mm;top:0;width:4mm;text-align:center;font-size:6pt">${mm}</div>` : ''),
    );
  }
  return `
<div class="print-doc" style="font-family:'Noto Sans Bengali','Nirmala UI',Vrinda,'Segoe UI',sans-serif;color:#000;background:#fff;font-size:9pt;line-height:1.35;padding:2mm 0">
  <div style="text-align:center;font-weight:700;font-size:13pt">${escapeHtml(shopName || 'Test print')}</div>
  <div style="text-align:center;font-weight:600">Test print</div>
  <div style="margin-top:2mm">${escapeHtml(profile.name)} &middot; ${profile.paperWidth === 210 ? 'A4' : profile.paperWidth + ' mm'}</div>
  <div>${escapeHtml(when)}</div>
  <div style="margin-top:2mm;font-size:7pt">Ruler (${width} mm printable width). Both end marks should print:</div>
  <div style="position:relative;width:${width}mm;max-width:100%;height:8mm;border-left:0.5mm solid #000;border-right:0.5mm solid #000;border-bottom:0.3mm solid #000;box-sizing:border-box">${ticks.join('')}</div>
  <div style="margin-top:2mm;font-size:11pt">বাংলা: আমার সোনার বাংলা — মোট ৳ ১,২৩৪.৫০</div>
  <div style="margin-top:2mm;font-size:7pt">If the ruler fits and the Bangla line is clear, the printer is set up.</div>
</div>`;
}

function testEscLines(profile: PrinterProfile, shopName: string, when: string): EscLine[] {
  const cols = profile.paperWidth === 58 ? 32 : 48;
  const digits = '1234567890'.repeat(Math.ceil(cols / 10)).slice(0, cols);
  return [
    { kind: 'text', text: shopName || 'Test print', align: 'center', bold: true, size: 'double' },
    { kind: 'text', text: 'Test print', align: 'center', bold: true },
    { kind: 'rule' },
    { kind: 'row', left: 'Printer', right: profile.name },
    { kind: 'row', left: 'Paper', right: `${profile.paperWidth} mm, ${cols} characters` },
    { kind: 'row', left: 'Date', right: when },
    { kind: 'text', text: 'Ruler - the line below should just fit:' },
    { kind: 'text', text: digits },
    { kind: 'rule', char: '=' },
    { kind: 'row', left: 'TOTAL', right: 'Tk 1,234.50', bold: true, size: 'double' },
    { kind: 'rule' },
    { kind: 'text', text: 'Bangla text cannot print over the network connection; it prints as "?". Use the installed-printer connection for Bangla.' },
  ];
}

/** Print the test page on `profile`. Throws with the printer's reason. */
export async function testPrint(profile: PrinterProfile, shopName: string): Promise<void> {
  if (!hasBackend()) throw new Error('Printing needs the desktop app.');
  const when = new Date().toLocaleString('en-GB');
  await sendToPrinter(
    profile,
    {
      html: () => buildPrintHtml(testPageHtml(profile, shopName, when), profile.paperWidth),
      escpos: () => testEscLines(profile, shopName, when),
    },
    // A test of a profile with "Open cash drawer" on should show it works.
    { openDrawer: true },
  );
}

// ---------------------------------------------------------------- send

export interface PrintOptions {
  kind?: PrintKind;
  /** Print on this profile instead of the one `kind` picks. */
  profile?: PrinterProfile;
  /** Network profiles with "Open cash drawer": kick it with this print. */
  openDrawer?: boolean;
}

/** Send a prepared job to one profile. Throws with the printer's reason. */
export async function sendToPrinter(
  profile: PrinterProfile,
  job: { html: () => string; escpos: () => EscLine[] },
  opts: { openDrawer?: boolean } = {},
): Promise<void> {
  if (profile.connection === 'network') {
    const bytes = encodeEscpos(job.escpos(), {
      paperWidthMm: profile.paperWidth === 58 ? 58 : 80,
      cut: profile.autoCut,
      drawer: profile.openDrawer && !!opts.openDrawer,
      copies: profile.copies,
    });
    await api('printers.rawEscpos', { host: profile.host, port: profile.port ?? 9100, data: bytesToBase64(bytes) });
    return;
  }
  await api('printers.printHtml', {
    html: job.html(),
    deviceName: profile.deviceName || undefined,
    paperWidthMm: profile.paperWidth,
    copies: profile.copies,
    silent: true,
  });
}

/**
 * Print a mounted print sheet on the configured printer, or fall back to the
 * print dialog. Resolves to how it was printed.
 */
export async function printSheet(
  sheet: HTMLElement | null | undefined,
  opts: PrintOptions = {},
): Promise<'printer' | 'dialog'> {
  const profile = opts.profile ?? pickPrinter(opts.kind ?? 'receipt');
  if (!sheet || !profile || !hasBackend()) {
    window.print();
    return 'dialog';
  }
  try {
    await sendToPrinter(
      profile,
      {
        html: () => buildPrintHtml(docNode(sheet).outerHTML, profile.paperWidth),
        escpos: () => sheetToEscLines(sheet),
      },
      { openDrawer: opts.openDrawer },
    );
    return 'printer';
  } catch (e) {
    toast.error('Could not print. Opening the print dialog instead.', {
      description: `${profile.name}: ${e instanceof Error ? e.message : String(e)}`,
    });
    window.print();
    return 'dialog';
  }
}
