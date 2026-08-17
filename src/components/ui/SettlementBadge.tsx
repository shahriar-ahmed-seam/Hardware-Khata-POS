import { Badge } from '@/components/ui/Badge';

/**
 * ============================================================================
 *  HOW SETTLED IS THIS DOCUMENT — ONE VOCABULARY, EVERYWHERE
 * ============================================================================
 *
 * The same three states were spelled out by hand in six places (the Sales and
 * Purchases lists, both detail drawers, the customer's invoice list and a
 * dashboard widget), each with its own copy of the `due === 0 ? … : paid > 0 ? …`
 * ladder. They agreed by luck, and they used the accounting words "Partial" and
 * "Due".
 *
 * WHY THE WORDS CHANGED
 *  - "Partial" is a bookkeeping term. "Part paid" says the same thing in words a
 *    shopkeeper uses without translating them first.
 *  - "Due" is genuinely ambiguous: it reads as "a due" (a noun, the amount) or as
 *    "due today" (a deadline). What it actually means here is that NOTHING has
 *    been paid, so it says "Unpaid".
 *
 * The keys are unchanged (`paid` / `partial` / `due`) because they are what the
 * backend's `PageQuery.payment` filter expects — only the labels are plain now.
 */
export type SettlementKey = 'paid' | 'partial' | 'due';

/** Which of the three states a document is in, from its own two numbers. */
export function settlementOf(doc: { paid: number; due: number }): SettlementKey {
  // A paisa of float noise must not read as "unpaid", hence the epsilon.
  if (doc.due <= 0.004) return 'paid';
  return doc.paid > 0.004 ? 'partial' : 'due';
}

export const SETTLEMENT_LABEL: Record<SettlementKey, string> = {
  paid: 'Paid',
  partial: 'Part paid',
  due: 'Unpaid',
};

const VARIANT: Record<SettlementKey, 'success' | 'warning' | 'destructive'> = {
  paid: 'success',
  partial: 'warning',
  due: 'destructive',
};

/**
 * The badge every list and drawer uses. Pass the document's own `paid`/`due` —
 * both are derived by the backend, so this can never disagree with the ledger.
 */
export function SettlementBadge({ paid, due }: { paid: number; due: number }) {
  const key = settlementOf({ paid, due });
  return <Badge variant={VARIANT[key]}>{SETTLEMENT_LABEL[key]}</Badge>;
}
