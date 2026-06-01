import type { DB } from '../db/connection.ts';
import { formatRef } from '../core/ids.ts';

/**
 * Atomic document reference generation from the invoice_schemes table.
 * Each docType has a default scheme; we increment its counter and format.
 * Must be called inside a transaction (the callers already are).
 */
export type DocType =
  | 'sale'
  | 'pos'
  | 'quotation'
  | 'draft'
  | 'purchase'
  | 'return'
  | 'purchase_return'
  | 'shipment'
  | 'transfer'
  | 'adjustment'
  | 'expense';

// Fallback prefixes when a scheme row doesn't exist for a docType.
const FALLBACK: Record<DocType, { prefix: string; pad: number }> = {
  sale: { prefix: 'INV', pad: 4 },
  pos: { prefix: 'POS', pad: 4 },
  quotation: { prefix: 'QTN', pad: 4 },
  draft: { prefix: 'DRF', pad: 4 },
  purchase: { prefix: 'PO', pad: 4 },
  return: { prefix: 'RTN', pad: 4 },
  purchase_return: { prefix: 'PRTN', pad: 4 },
  shipment: { prefix: 'SHP', pad: 4 },
  transfer: { prefix: 'TRF', pad: 4 },
  adjustment: { prefix: 'ADJ', pad: 4 },
  expense: { prefix: 'EXP', pad: 4 },
};

export function nextRef(db: DB, docType: DocType, date = new Date()): string {
  // Map purchase_return -> stored doc_type 'return' shares? keep separate scheme key.
  const schemeRow = db
    .prepare("SELECT * FROM invoice_schemes WHERE doc_type = ? AND is_default = 1 LIMIT 1")
    .get(docType) as Record<string, unknown> | undefined;

  if (schemeRow) {
    const next = (schemeRow.current_counter as number) + 1;
    db.prepare('UPDATE invoice_schemes SET current_counter = ? WHERE id = ?').run(
      next,
      schemeRow.id,
    );
    return formatRef({
      prefix: schemeRow.prefix as string,
      yearFormat: schemeRow.year_format as 'none' | 'YY' | 'YYYY',
      separator: schemeRow.separator as string,
      counterPadding: schemeRow.counter_padding as number,
      counter: next,
      date,
    });
  }

  // No scheme: use a key-value counter so refs are still unique + sequential.
  const fb = FALLBACK[docType];
  const key = `seq_${docType}`;
  const row = db.prepare('SELECT value FROM settings_kv WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  const current = row ? Number(row.value) : 0;
  const next = current + 1;
  db.prepare(
    'INSERT INTO settings_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, String(next));
  return formatRef({
    prefix: fb.prefix,
    yearFormat: 'YYYY',
    separator: '-',
    counterPadding: fb.pad,
    counter: next,
    date,
  });
}
