import { Badge } from '@/components/ui/Badge';

/**
 * ============================================================================
 *  HOW SETTLED IS THIS DOCUMENT — ONE VOCABULARY, EVERYWHERE
 * ============================================================================
 *
 * The same states were spelled out by hand in six places (the Sales and Purchases
 * lists, both detail drawers, the customer's invoice list and a dashboard widget),
 * each with its own copy of the `due === 0 ? … : paid > 0 ? …` ladder.
 *
 * WHY THE WORDS ARE WHAT THEY ARE
 *  - "Partial" is a bookkeeping term. "Part paid" says the same thing in words a
 *    shopkeeper uses without translating them first.
 *  - "Due" is genuinely ambiguous: it reads as "a due" (a noun, the amount) or as
 *    "due today" (a deadline). What it means here is that NOTHING has been paid,
 *    so it says "Unpaid".
 *
 * THE STATUS IS PART OF THE ANSWER — this is the bug that was here.
 * A draft and a quotation are stored with `paid = 0, due = 0`, because nothing has
 * been sold yet. Reading only the two numbers, `due === 0` looked like "fully
 * paid", so a quotation for ৳12,000 rendered a green **Paid** badge in the
 * customer's history — next to a Total of 12,000 and a Due of '—'. Three cells
 * contradicting each other. `settlementOf` now takes the status and answers
 * 'draft' / 'quotation' / 'void' before it looks at any money.
 *
 * CREDIT NOTES COUNT AS SETTLED.
 * `credited` is the part of an invoice written off by a CreditAdjust sell return —
 * settled, but with no money received. It has to count towards settlement or an
 * invoice that was half-returned reads "Unpaid" while the customer owes only the
 * remainder. See `sales.credited` (schema v8).
 *
 * The keys `paid` / `partial` / `due` are unchanged because they are what the
 * backend's `PageQuery.payment` filter expects.
 */
export type SettlementKey = 'paid' | 'partial' | 'due';

/** Every state a document can be in on screen, settlement or otherwise. */
export type DocState = SettlementKey | 'draft' | 'quotation' | 'void';

export interface SettlementInput {
  paid: number;
  due: number;
  /** Settled by a credit note rather than money. Defaults to 0. */
  credited?: number;
  /** 'final' | 'draft' | 'quotation' | 'void'. Omit for purchases. */
  status?: string;
}

/**
 * What state to show for a document. STATUS WINS over the money, because a draft
 * with `due = 0` has not been paid — it has not been sold.
 */
export function settlementOf(doc: SettlementInput): DocState {
  if (doc.status === 'void') return 'void';
  if (doc.status === 'draft') return 'draft';
  if (doc.status === 'quotation') return 'quotation';
  // A paisa of float noise must not read as "unpaid", hence the epsilon.
  if (doc.due <= 0.004) return 'paid';
  return doc.paid + (doc.credited ?? 0) > 0.004 ? 'partial' : 'due';
}

export const SETTLEMENT_LABEL: Record<DocState, string> = {
  paid: 'Paid',
  partial: 'Part paid',
  due: 'Unpaid',
  draft: 'Draft',
  quotation: 'Quotation',
  void: 'Voided',
};

const VARIANT: Record<DocState, 'success' | 'warning' | 'destructive' | 'default'> = {
  paid: 'success',
  partial: 'warning',
  due: 'destructive',
  // Neither good nor bad — these are not settlement states at all.
  draft: 'default',
  quotation: 'default',
  void: 'destructive',
};

/**
 * The badge every list and drawer uses. Pass the document's own numbers AND its
 * status — all of them are backend-derived, so this cannot disagree with the
 * ledger.
 */
export function SettlementBadge({ paid, due, credited, status }: SettlementInput) {
  const key = settlementOf({ paid, due, credited, status });
  return <Badge variant={VARIANT[key]}>{SETTLEMENT_LABEL[key]}</Badge>;
}
