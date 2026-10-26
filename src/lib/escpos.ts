/**
 * MINIMAL ESC/POS ENCODER for network thermal printers (Xprinter, Rongta,
 * Epson TM and their clones all speak this subset).
 *
 * Pure: no DOM, no Electron. src/lib/printing.ts turns a print sheet into
 * `EscLine`s; scripts/check-escpos.mts checks the bytes.
 *
 * Text mode is plain ASCII. These printers have no Bangla code page, so a
 * Bangla word cannot be sent as text: it prints as "?" (`toPrintableAscii`).
 * Shops that need Bangla on the slip use the installed-printer (driver)
 * connection, which prints the page as an image through Windows.
 */

export type EscAlign = 'left' | 'center' | 'right';
export type EscSize = 'normal' | 'double';

export type EscLine =
  | { kind: 'text'; text: string; align?: EscAlign; bold?: boolean; size?: EscSize }
  /** Label on the left, value on the right, padded to the paper width. */
  | { kind: 'row'; left: string; right: string; bold?: boolean; size?: EscSize }
  | { kind: 'rule'; char?: string }
  | { kind: 'feed'; lines?: number };

export interface EscposOptions {
  paperWidthMm: 58 | 80;
  /** Feed and partial-cut after each copy. */
  cut?: boolean;
  /** Kick the cash drawer (pin 2) once, before the first copy. */
  drawer?: boolean;
  copies?: number;
}

// ---------------------------------------------------------------- commands

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** ESC @ — reset the printer to its power-on state. */
export const CMD_INIT = [ESC, 0x40];
/** ESC a n — 0 left, 1 centre, 2 right. */
export const cmdAlign = (a: EscAlign) => [ESC, 0x61, a === 'center' ? 1 : a === 'right' ? 2 : 0];
/** ESC E n — emphasised (bold) on/off. */
export const cmdBold = (on: boolean) => [ESC, 0x45, on ? 1 : 0];
/** GS ! n — 0x11 double width + height, 0x00 normal. */
export const cmdSize = (s: EscSize) => [GS, 0x21, s === 'double' ? 0x11 : 0x00];
/** ESC d n — print and feed n lines. */
export const cmdFeed = (n: number) => [ESC, 0x64, Math.max(0, Math.min(255, n))];
/** GS V 66 0 — feed to the cutter and partial-cut. */
export const CMD_CUT = [GS, 0x56, 66, 0];
/** ESC p 0 25 250 — drawer pulse on pin 2: 50 ms on, 500 ms off. */
export const CMD_DRAWER = [ESC, 0x70, 0, 25, 250];

/** Font A characters per line: 32 on a 58mm roll, 48 on 80mm. */
export function charsPerLine(paperWidthMm: 58 | 80): number {
  return paperWidthMm === 58 ? 32 : 48;
}

// ---------------------------------------------------------------- text

const REPLACE: Record<string, string> = {
  '৳': 'Tk',
  '×': 'x',
  '−': '-',
  '–': '-',
  '—': '-',
  '·': '-',
  '•': '-',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '…': '...',
  '\u00a0': ' ',
  '\u2009': ' ',
  '\u202f': ' ',
};

/**
 * Text the printer can actually print: Bangla digits become 0-9, common
 * typography becomes ASCII, accents are dropped, and anything else (a Bangla
 * word) becomes a single "?" rather than mojibake.
 */
export function toPrintableAscii(input: string): string {
  let s = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x09e6 && code <= 0x09ef) s += String(code - 0x09e6);
    else if (REPLACE[ch] !== undefined) s += REPLACE[ch];
    else s += ch;
  }
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^\x20-\x7e]+/g, '?');
  return s.replace(/\s+/g, ' ').trim();
}

/** Word-wrap to `width` columns; a word longer than a line is split. */
export function wrap(text: string, width: number): string[] {
  const w = Math.max(1, width);
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ').filter(Boolean)) {
    let rest = word;
    while (rest.length > w) {
      if (line) {
        out.push(line);
        line = '';
      }
      out.push(rest.slice(0, w));
      rest = rest.slice(w);
    }
    if (!rest) continue;
    if (!line) line = rest;
    else if (line.length + 1 + rest.length <= w) line += ' ' + rest;
    else {
      out.push(line);
      line = rest;
    }
  }
  if (line) out.push(line);
  return out;
}

/**
 * Label left, value right. When both do not fit on one line the label wraps
 * and the value goes right-aligned on the last line (or a line of its own).
 */
export function layoutRow(left: string, right: string, width: number): string[] {
  const l = left.trim();
  const r = right.trim();
  if (!r) return wrap(l, width);
  if (!l) return [r.length >= width ? r.slice(0, width) : ' '.repeat(width - r.length) + r];
  if (l.length + 1 + r.length <= width) return [l + ' '.repeat(width - l.length - r.length) + r];
  const lines = wrap(l, width);
  const last = lines[lines.length - 1];
  if (last.length + 1 + r.length <= width) {
    lines[lines.length - 1] = last + ' '.repeat(width - last.length - r.length) + r;
    return lines;
  }
  for (const piece of wrap(r, width)) lines.push(' '.repeat(width - piece.length) + piece);
  return lines;
}

function ascii(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out.push(c >= 0x20 && c <= 0x7e ? c : 0x3f);
  }
  return out;
}

// ---------------------------------------------------------------- encode

/** Encode one or more copies of `lines` as an ESC/POS byte stream. */
export function encodeEscpos(lines: readonly EscLine[], opts: EscposOptions): Uint8Array {
  const width = charsPerLine(opts.paperWidthMm);
  const copies = Math.max(1, Math.min(10, Math.floor(opts.copies ?? 1)));
  const bytes: number[] = [...CMD_INIT];
  if (opts.drawer) bytes.push(...CMD_DRAWER);

  for (let copy = 0; copy < copies; copy++) {
    if (copy > 0) bytes.push(...CMD_INIT);
    for (const line of lines) {
      if (line.kind === 'feed') {
        bytes.push(...cmdFeed(line.lines ?? 1));
        continue;
      }
      if (line.kind === 'rule') {
        bytes.push(...cmdAlign('left'), ...ascii((line.char ?? '-').repeat(width)), LF);
        continue;
      }
      const size = line.size ?? 'normal';
      // Double width halves the characters that fit on a line.
      const cols = size === 'double' ? Math.floor(width / 2) : width;
      const rows =
        line.kind === 'row'
          ? layoutRow(toPrintableAscii(line.left), toPrintableAscii(line.right), cols)
          : wrap(toPrintableAscii(line.text), cols);
      if (rows.length === 0) continue;
      bytes.push(...cmdAlign(line.kind === 'text' ? (line.align ?? 'left') : 'left'));
      if (line.bold) bytes.push(...cmdBold(true));
      if (size === 'double') bytes.push(...cmdSize('double'));
      for (const r of rows) bytes.push(...ascii(r), LF);
      if (size === 'double') bytes.push(...cmdSize('normal'));
      if (line.bold) bytes.push(...cmdBold(false));
    }
    bytes.push(...cmdAlign('left'));
    if (opts.cut) bytes.push(...cmdFeed(4), ...CMD_CUT);
    else bytes.push(...cmdFeed(3));
  }
  return Uint8Array.from(bytes);
}

/** Base64 for the IPC hop (`printers.rawEscpos`). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
