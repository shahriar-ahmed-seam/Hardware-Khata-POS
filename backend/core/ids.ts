/**
 * ID + reference-number generation.
 *
 * Entity IDs are short, sortable, collision-resistant strings (prefix + base36
 * time + random). Document reference numbers (INV-2026-0001 etc.) come from the
 * invoice_schemes counter, handled in the service layer; this module provides
 * a fallback formatter.
 */

let counter = 0;

export function newId(prefix: string): string {
  counter = (counter + 1) % 0x10000;
  const time = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0x10000).toString(36);
  const seq = counter.toString(36);
  return `${prefix}_${time}${rand}${seq}`;
}

/** Build a document reference like PREFIX-YYYY-0001 from scheme parts. */
export function formatRef(opts: {
  prefix: string;
  yearFormat: 'none' | 'YY' | 'YYYY';
  separator: string;
  counterPadding: number;
  counter: number;
  date?: Date;
}): string {
  const d = opts.date ?? new Date();
  const year = d.getFullYear();
  const yearStr =
    opts.yearFormat === 'YYYY'
      ? String(year)
      : opts.yearFormat === 'YY'
        ? String(year).slice(-2)
        : '';
  const num = String(opts.counter).padStart(opts.counterPadding, '0');
  const parts = [opts.prefix];
  if (yearStr) parts.push(yearStr);
  parts.push(num);
  return parts.join(opts.separator);
}
