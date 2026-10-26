/**
 * Self-check for the ESC/POS encoder (src/lib/escpos.ts). Not in CI.
 * Run: npx tsx scripts/check-escpos.mts
 */
import {
  CMD_CUT,
  CMD_DRAWER,
  CMD_INIT,
  bytesToBase64,
  charsPerLine,
  encodeEscpos,
  layoutRow,
  toPrintableAscii,
  wrap,
} from '../src/lib/escpos';

let pass = 0;
let fail = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass++;
  else {
    fail++;
    console.error(`FAIL ${name}\n  expected: ${w}\n  actual:   ${g}`);
  }
};
const has = (bytes: Uint8Array, seq: number[]) => {
  outer: for (let i = 0; i + seq.length <= bytes.length; i++) {
    for (let j = 0; j < seq.length; j++) if (bytes[i + j] !== seq[j]) continue outer;
    return true;
  }
  return false;
};
const count = (bytes: Uint8Array, seq: number[]) => {
  let n = 0;
  for (let i = 0; i + seq.length <= bytes.length; i++) {
    if (seq.every((b, j) => bytes[i + j] === b)) n++;
  }
  return n;
};

check('58mm columns', charsPerLine(58), 32);
check('80mm columns', charsPerLine(80), 48);
check('commands: cut', CMD_CUT, [0x1d, 0x56, 66, 0]);
check('commands: drawer', CMD_DRAWER, [0x1b, 0x70, 0, 25, 250]);

check('ascii: taka + bangla digits', toPrintableAscii('৳ ১২৩.৫০'), 'Tk 123.50');
check('ascii: bangla word', toPrintableAscii('সিমেন্ট Cement'), '? Cement');
check('ascii: typography', toPrintableAscii('5 × 10 − 2 · ok'), '5 x 10 - 2 - ok');

check('wrap', wrap('aaa bbb ccc', 7), ['aaa bbb', 'ccc']);
check('wrap long word', wrap('abcdefghij', 4), ['abcd', 'efgh', 'ij']);
check('row fits', layoutRow('Total', '100.00', 16), ['Total     100.00']);
check('row wraps, value shares last line', layoutRow('A very long label', '9.99', 12), ['A very long', 'label   9.99']);
check('row wraps, value on own line', layoutRow('A very long label here', '9.99', 12), ['A very long', 'label here', '        9.99']);
for (const w of [32, 48]) {
  const rows = layoutRow('Cement OPC 50kg, BM-CMNT-OPC long name', '2,700.00', w);
  check(`row width ${w}`, rows.every((r) => r.length <= w), true);
}

const bytes = encodeEscpos(
  [
    { kind: 'text', text: 'Shop', align: 'center', bold: true, size: 'double' },
    { kind: 'rule' },
    { kind: 'row', left: 'Total Payable', right: 'Tk 3,020.00', bold: true, size: 'double' },
  ],
  { paperWidthMm: 80, cut: true, drawer: true, copies: 2 },
);
check('starts with init', Array.from(bytes.slice(0, 2)), CMD_INIT);
check('drawer kicked once', count(bytes, CMD_DRAWER), 1);
check('cut per copy', count(bytes, CMD_CUT), 2);
check('centre align', has(bytes, [0x1b, 0x61, 1]), true);
check('bold on', has(bytes, [0x1b, 0x45, 1]), true);
check('double size', has(bytes, [0x1d, 0x21, 0x11]), true);
check('rule is full width', has(bytes, Array(48).fill(0x2d)), true);
check('only ascii text', Array.from(bytes).every((b) => b < 0x80 || b === 0xfa), true);

const plain = encodeEscpos([{ kind: 'text', text: 'x' }], { paperWidthMm: 58 });
check('no cut, no drawer', [count(plain, CMD_CUT), count(plain, CMD_DRAWER)], [0, 0]);
check('base64', bytesToBase64(Uint8Array.from([0x1b, 0x40, 0x41])), 'G0BB');

console.log(`escpos: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
