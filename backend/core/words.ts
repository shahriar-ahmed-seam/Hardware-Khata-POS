/**
 * Amount-in-words using the South-Asian (Bangladesh/India) numbering system:
 * units, tens, hundreds, then thousand, lakh (100,000), crore (10,000,000).
 * Used on invoices/receipts.
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ' ' + ONES[o] : '');
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let s = '';
  if (h) s += ONES[h] + ' Hundred';
  if (rest) s += (h ? ' ' : '') + twoDigits(rest);
  return s;
}

/** Convert an integer (BDT taka part) to South-Asian words. */
export function intToWords(num: number): string {
  if (num === 0) return 'Zero';
  let n = Math.floor(Math.abs(num));
  const parts: string[] = [];

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundreds = n;

  if (crore) parts.push(intToWords(crore) + ' Crore');
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh');
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand');
  if (hundreds) parts.push(threeDigits(hundreds));

  return parts.join(' ').trim();
}

/**
 * Full amount in words for a receipt, e.g. 3020.50 ->
 * "Taka Three Thousand Twenty and Fifty Paisa Only".
 */
export function amountInWords(amount: number, currency = 'Taka', sub = 'Paisa'): string {
  const sign = amount < 0 ? 'Minus ' : '';
  const abs = Math.abs(amount);
  const taka = Math.floor(abs);
  const paisa = Math.round((abs - taka) * 100);
  let s = `${sign}${currency} ${intToWords(taka)}`;
  if (paisa > 0) s += ` and ${twoDigits(paisa)} ${sub}`;
  return s + ' Only';
}
