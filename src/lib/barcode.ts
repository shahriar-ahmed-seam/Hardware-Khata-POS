/**
 * REAL BARCODES FOR THE LABEL PRINTER (B7).
 *
 * The label used to carry a decorative stripe (a repeating CSS gradient) that
 * no scanner could read. This encodes the product's code for real, as modules:
 * a string of '1' (bar) and '0' (space), each one module wide. The label draws
 * it as an SVG, so it prints sharp at any printer resolution.
 *
 *  - EAN-13 when the code is 13 digits with a correct check digit, or 12 digits
 *    (the check digit is added). That is what the goods from the market carry.
 *  - Code 128 for everything else (the shop's own codes and SKUs): set C for
 *    an all-digit code (half the width), set B for text.
 *
 * Pure and dependency-free. The tables are checked in backend/verify/safety.ts
 * (every Code 128 symbol is 11 modules wide, EAN check digits, known codes).
 */

/** Bar/space widths of the 107 Code 128 symbols (106 = stop, 7 elements). */
export const CODE128_WIDTHS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_B = 104;
const START_C = 105;
const CODE_B = 100; // in set C: switch to set B
const STOP = 106;

function widthsToModules(widths: string): string {
  let out = '';
  for (let i = 0; i < widths.length; i++) out += (i % 2 === 0 ? '1' : '0').repeat(Number(widths[i]));
  return out;
}

/**
 * Code 128 symbol values for `text`, start and check included, stop excluded.
 *
 * Kept deliberately simple: a code that is all digits goes in set C (two digits
 * per symbol — a 13-digit code prints half as wide), with its last digit in set
 * B when the count is odd; anything else goes in set B throughout.
 */
export function code128Values(text: string): number[] | null {
  if (!text) return null;
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) return null; // set B covers printable ASCII only
  }
  const values: number[] = [];
  if (/^\d{2,}$/.test(text)) {
    values.push(START_C);
    const pairs = text.length - (text.length % 2);
    for (let i = 0; i < pairs; i += 2) values.push(Number(text.slice(i, i + 2)));
    if (text.length % 2 === 1) {
      values.push(CODE_B);
      values.push(text.charCodeAt(text.length - 1) - 32);
    }
  } else {
    values.push(START_B);
    for (const ch of text) values.push(ch.charCodeAt(0) - 32);
  }
  let check = values[0];
  for (let k = 1; k < values.length; k++) check += values[k] * k;
  values.push(check % 103);
  return values;
}

/** Code 128 as modules, quiet zones not included. Null if it cannot be encoded. */
export function code128Modules(text: string): string | null {
  const values = code128Values(text);
  if (!values) return null;
  return [...values, STOP].map((v) => widthsToModules(CODE128_WIDTHS[v])).join('');
}

// ------------------------------------------------------------------ EAN-13

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** The EAN-13 check digit of the first 12 digits. */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

/** The full 13 digits, or null when `code` is not a valid EAN-13 (or 12 digits). */
export function ean13Digits(code: string): string | null {
  if (/^\d{12}$/.test(code)) return code + ean13CheckDigit(code);
  if (/^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12])) return code;
  return null;
}

/** EAN-13 as modules (95), or null. */
export function ean13Modules(code: string): string | null {
  const d = ean13Digits(code);
  if (!d) return null;
  const parity = EAN_PARITY[Number(d[0])];
  let out = '101';
  for (let i = 1; i <= 6; i++) out += (parity[i - 1] === 'L' ? EAN_L : EAN_G)[Number(d[i])];
  out += '01010';
  for (let i = 7; i <= 12; i++) out += EAN_R[Number(d[i])];
  return out + '101';
}

export type BarcodeKind = 'EAN-13' | 'Code128';

/**
 * The barcode for a label. `prefer` is Settings → Barcode's code type: EAN-13
 * is used only when the code really is one (a wrong check digit would scan as
 * nothing); anything else prints as Code 128.
 */
export function encodeBarcode(
  code: string,
  prefer: BarcodeKind = 'Code128',
): { kind: BarcodeKind; modules: string; text: string } | null {
  const clean = (code ?? '').trim();
  if (!clean) return null;
  const ean = ean13Digits(clean);
  if (ean && (prefer === 'EAN-13' || /^\d{13}$/.test(clean))) {
    const modules = ean13Modules(ean);
    if (modules) return { kind: 'EAN-13', modules, text: ean };
  }
  const modules = code128Modules(clean);
  return modules ? { kind: 'Code128', modules, text: clean } : null;
}
