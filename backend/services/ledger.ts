import type { DB } from '../db/connection.ts';
import { round2 } from '../core/money.ts';

/**
 * Customer & supplier balances are DERIVED, never stored as a running column.
 *
 * Customer due = opening_balance
 *   + sum(final sale totals)          (what they owe us)
 *   - sum(sale payments)              (what they've paid)
 *   - sum(sell returns where refund = CreditAdjust)  (credited back against due)
 *
 * Note: cash/bKash/etc refunds give money back directly and do NOT reduce due;
 * only CreditAdjust returns reduce the customer's outstanding balance.
 */
/**
 * THE CREDIT NOTES THAT COUNT against a balance: CreditAdjust returns whose
 * document is still live (or that were entered with no document at all).
 *
 * Every other term of a balance is status-scoped — only FINAL sales, only
 * non-cancelled purchases — but the credit notes were not. A credit note on a
 * sale that was voided later still came off the customer's khata, so the
 * balance and the sum of the invoice dues disagreed for good. Returns on dead
 * documents are refused now (returns.ts / voidSale), so this only matters for
 * books written before that — which is exactly where it has to be right.
 *
 * Shared by the ledger and the customer-group report so they cannot drift.
 * Use as `SELECT … ${LIVE_CREDIT_SELL_RETURNS} AND r.customer_id = ?`.
 */
export const LIVE_CREDIT_SELL_RETURNS = `FROM sell_returns r
   LEFT JOIN sales rs ON rs.id = r.sale_id
  WHERE r.refund_method = 'CreditAdjust'
    AND (r.sale_id IS NULL OR rs.status = 'final')`;

/**
 * MONEY THE SHOP STILL HOLDS for a voided sale: its non-cash payments.
 *
 * Voiding a sale pays its CASH back out of the drawer, but a bKash, card or
 * bank payment is not reversed by the app — the customer is still owed it. It
 * used to vanish with the voided sale (whose paid/due are zeroed), so nothing
 * anywhere said the shop owed that money back. It now stays on the customer's
 * account as a credit until it is settled. Use as
 * `SELECT … ${HELD_ON_VOIDED_SALES} AND sa.customer_id = ?`.
 */
export const HELD_ON_VOIDED_SALES = `FROM sale_payments p JOIN sales sa ON sa.id = p.sale_id
  WHERE sa.status = 'void' AND p.method != 'Cash'`;

/** The supplier-side twin: credit notes against a bill that was not cancelled. */
export const LIVE_CREDIT_PURCHASE_RETURNS = `FROM purchase_returns r
   LEFT JOIN purchases rp ON rp.id = r.purchase_id
  WHERE r.refund_method = 'CreditAdjust'
    AND (r.purchase_id IS NULL OR rp.status != 'cancelled')`;

/**
 * MONEY PAID ON ACCOUNT (v11): paid against the opening balance, or ahead as an
 * advance — not against one invoice or bill. It used to have nowhere to go, so
 * Receive Payment silently dropped it ("applied as advance", saved nowhere).
 * See services/accounts.ts.
 */
export function paidOnAccount(db: DB, partyType: 'customer' | 'supplier', partyId: string): number {
  const row = db
    .prepare(
      'SELECT COALESCE(SUM(amount),0) AS s FROM account_payments WHERE party_type = ? AND party_id = ?',
    )
    .get(partyType, partyId) as { s: number };
  return round2(row.s);
}

export function customerDue(db: DB, customerId: string): number {
  const c = db.prepare('SELECT opening_balance FROM customers WHERE id = ?').get(customerId) as
    | { opening_balance: number }
    | undefined;
  if (!c) return 0;
  const sales = db
    .prepare("SELECT COALESCE(SUM(total),0) AS s FROM sales WHERE customer_id = ? AND status = 'final'")
    .get(customerId) as { s: number };
  const paid = db
    .prepare(
      `SELECT COALESCE(SUM(p.amount),0) AS s
         FROM sale_payments p JOIN sales sa ON sa.id = p.sale_id
        WHERE sa.customer_id = ? AND sa.status = 'final'`,
    )
    .get(customerId) as { s: number };
  const creditReturns = db
    .prepare(`SELECT COALESCE(SUM(r.total),0) AS s ${LIVE_CREDIT_SELL_RETURNS} AND r.customer_id = ?`)
    .get(customerId) as { s: number };
  const held = db
    .prepare(`SELECT COALESCE(SUM(p.amount),0) AS s ${HELD_ON_VOIDED_SALES} AND sa.customer_id = ?`)
    .get(customerId) as { s: number };

  const onAccount = paidOnAccount(db, 'customer', customerId);

  return round2(c.opening_balance + sales.s - paid.s - creditReturns.s - held.s - onAccount);
}

export function customerTotals(db: DB, customerId: string) {
  const sales = db
    .prepare("SELECT COALESCE(SUM(total),0) AS s, COUNT(*) AS c FROM sales WHERE customer_id = ? AND status = 'final'")
    .get(customerId) as { s: number; c: number };
  const paid = db
    .prepare(
      `SELECT COALESCE(SUM(p.amount),0) AS s FROM sale_payments p JOIN sales sa ON sa.id = p.sale_id WHERE sa.customer_id = ? AND sa.status = 'final'`,
    )
    .get(customerId) as { s: number };
  return {
    totalPurchase: round2(sales.s),
    saleCount: sales.c,
    // Invoice payments plus money paid on account (opening balance / advance).
    totalPaid: round2(paid.s + paidOnAccount(db, 'customer', customerId)),
    due: customerDue(db, customerId),
  };
}

/**
 * Supplier due = opening_balance
 *   + sum(non-cancelled purchase totals)   (what we owe them)
 *   - sum(purchase payments)               (what we've paid)
 *   - sum(purchase returns CreditAdjust)   (credited against payable)
 */
export function supplierDue(db: DB, supplierId: string): number {
  const s = db.prepare('SELECT opening_balance FROM suppliers WHERE id = ?').get(supplierId) as
    | { opening_balance: number }
    | undefined;
  if (!s) return 0;
  const purchases = db
    .prepare("SELECT COALESCE(SUM(total),0) AS s FROM purchases WHERE supplier_id = ? AND status != 'cancelled'")
    .get(supplierId) as { s: number };
  const paid = db
    .prepare(
      `SELECT COALESCE(SUM(p.amount),0) AS s FROM purchase_payments p JOIN purchases pu ON pu.id = p.purchase_id WHERE pu.supplier_id = ? AND pu.status != 'cancelled'`,
    )
    .get(supplierId) as { s: number };
  const creditReturns = db
    .prepare(`SELECT COALESCE(SUM(r.total),0) AS s ${LIVE_CREDIT_PURCHASE_RETURNS} AND r.supplier_id = ?`)
    .get(supplierId) as { s: number };
  const held = heldBySupplier(db, supplierId);
  const onAccount = paidOnAccount(db, 'supplier', supplierId);
  return round2(s.opening_balance + purchases.s - paid.s - creditReturns.s - held - onAccount);
}

/**
 * Money a supplier still holds from bills that were CANCELLED.
 *
 * Cancelling a bill brings its cash back into the drawer, but a bank or bKash
 * payment is not reversed by the shop — the supplier has it. It used to vanish
 * with the cancelled bill (whose paid/due are zeroed), so the shop lost track
 * of money it is owed. It now stays on the supplier's account as a credit.
 */
export function heldBySupplier(db: DB, supplierId: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(p.amount),0) AS s FROM purchase_payments p JOIN purchases pu ON pu.id = p.purchase_id
        WHERE pu.supplier_id = ? AND pu.status = 'cancelled' AND p.method != 'Cash'`,
    )
    .get(supplierId) as { s: number };
  return round2(row.s);
}

export function supplierTotals(db: DB, supplierId: string) {
  const purchases = db
    .prepare("SELECT COALESCE(SUM(total),0) AS s, COUNT(*) AS c FROM purchases WHERE supplier_id = ? AND status != 'cancelled'")
    .get(supplierId) as { s: number; c: number };
  const paid = db
    .prepare(
      `SELECT COALESCE(SUM(p.amount),0) AS s FROM purchase_payments p JOIN purchases pu ON pu.id = p.purchase_id WHERE pu.supplier_id = ? AND pu.status != 'cancelled'`,
    )
    .get(supplierId) as { s: number };
  return {
    totalPurchase: round2(purchases.s),
    purchaseCount: purchases.c,
    totalPaid: round2(paid.s + paidOnAccount(db, 'supplier', supplierId)),
    due: supplierDue(db, supplierId),
  };
}

/** Build a chronological running-balance ledger for a customer or supplier. */
export interface LedgerEntry {
  date: string;
  type: 'opening' | 'sale' | 'purchase' | 'payment' | 'return';
  reference: string;
  debit: number;  // increases the balance (what is owed)
  credit: number; // decreases it
  balance: number;
  /** The sale / purchase the row belongs to, when it has one (for a link). */
  docId?: string;
}

/**
 * THE KHATA, built by the backend from exactly the terms `customerDue` uses, so
 * its last balance IS the customer's due. The screens used to rebuild it from
 * one page of sales and returns, which left out held credits and money paid on
 * account, so the tab's closing balance and the "Outstanding" figure could
 * disagree.
 */
export function customerLedger(db: DB, customerId: string): LedgerEntry[] {
  const c = db.prepare('SELECT opening_balance, joined FROM customers WHERE id = ?').get(customerId) as
    | { opening_balance: number; joined: string }
    | undefined;
  if (!c) return [];
  const events: Omit<LedgerEntry, 'balance'>[] = [];
  // A NEGATIVE opening balance is an advance and still belongs in the khata.
  if (Math.abs(c.opening_balance) > 0.005) {
    events.push({
      date: c.joined ?? '2000-01-01',
      type: 'opening',
      reference: 'Opening balance',
      debit: round2(c.opening_balance),
      credit: 0,
    });
  }
  const sales = db
    .prepare("SELECT id, invoice_no, date, total FROM sales WHERE customer_id = ? AND status = 'final'")
    .all(customerId) as { id: string; invoice_no: string; date: string; total: number }[];
  for (const s of sales)
    events.push({ date: s.date, type: 'sale', reference: s.invoice_no, debit: round2(s.total), credit: 0, docId: s.id });
  const pays = db
    .prepare(
      `SELECT p.paid_at AS date, p.amount, p.method, sa.id AS sale_id, sa.invoice_no
         FROM sale_payments p JOIN sales sa ON sa.id = p.sale_id
        WHERE sa.customer_id = ? AND sa.status = 'final'`,
    )
    .all(customerId) as { date: string; amount: number; method: string; sale_id: string; invoice_no: string }[];
  for (const p of pays)
    events.push({
      date: p.date,
      type: 'payment',
      reference: `${p.invoice_no} · ${p.method}`,
      debit: 0,
      credit: round2(p.amount),
      docId: p.sale_id,
    });
  const rets = db
    .prepare(`SELECT r.ref_no, r.date, r.total, r.sale_id ${LIVE_CREDIT_SELL_RETURNS} AND r.customer_id = ?`)
    .all(customerId) as { ref_no: string; date: string; total: number; sale_id: string | null }[];
  for (const r of rets)
    events.push({
      date: r.date,
      type: 'return',
      reference: r.ref_no,
      debit: 0,
      credit: round2(r.total),
      docId: r.sale_id ?? undefined,
    });
  // Non-cash money paid on a sale that was later voided: still owed back.
  const held = db
    .prepare(`SELECT p.paid_at AS date, p.amount, p.method, sa.id AS sale_id, sa.invoice_no ${HELD_ON_VOIDED_SALES} AND sa.customer_id = ?`)
    .all(customerId) as { date: string; amount: number; method: string; sale_id: string; invoice_no: string }[];
  for (const h of held)
    events.push({
      date: h.date,
      type: 'payment',
      reference: `${h.invoice_no} (voided) · ${h.method}`,
      debit: 0,
      credit: round2(h.amount),
      docId: h.sale_id,
    });
  pushOnAccount(db, 'customer', customerId, events);
  return withBalance(events);
}

/**
 * The supplier's khata — the twin of {@link customerLedger}, built from the
 * terms `supplierDue` uses, so its last balance is the payable.
 */
export function supplierLedger(db: DB, supplierId: string): LedgerEntry[] {
  const sp = db.prepare('SELECT opening_balance, created_at FROM suppliers WHERE id = ?').get(supplierId) as
    | { opening_balance: number; created_at: string }
    | undefined;
  if (!sp) return [];
  const events: Omit<LedgerEntry, 'balance'>[] = [];
  if (Math.abs(sp.opening_balance) > 0.005) {
    events.push({
      date: sp.created_at ?? '2000-01-01',
      type: 'opening',
      reference: 'Opening balance',
      debit: round2(sp.opening_balance),
      credit: 0,
    });
  }
  const bills = db
    .prepare("SELECT id, ref_no, date, total FROM purchases WHERE supplier_id = ? AND status != 'cancelled'")
    .all(supplierId) as { id: string; ref_no: string; date: string; total: number }[];
  for (const b of bills)
    events.push({ date: b.date, type: 'purchase', reference: b.ref_no, debit: round2(b.total), credit: 0, docId: b.id });
  const pays = db
    .prepare(
      `SELECT p.paid_at AS date, p.amount, p.method, pu.id AS purchase_id, pu.ref_no, pu.status
         FROM purchase_payments p JOIN purchases pu ON pu.id = p.purchase_id
        WHERE pu.supplier_id = ? AND (pu.status != 'cancelled' OR p.method != 'Cash')`,
    )
    .all(supplierId) as { date: string; amount: number; method: string; purchase_id: string; ref_no: string; status: string }[];
  // Payments on live bills, plus non-cash money on a CANCELLED bill (the
  // supplier still holds it — see heldBySupplier).
  for (const p of pays)
    events.push({
      date: p.date,
      type: 'payment',
      reference: `${p.ref_no}${p.status === 'cancelled' ? ' (cancelled)' : ''} · ${p.method}`,
      debit: 0,
      credit: round2(p.amount),
      docId: p.purchase_id,
    });
  const rets = db
    .prepare(`SELECT r.ref_no, r.date, r.total, r.purchase_id ${LIVE_CREDIT_PURCHASE_RETURNS} AND r.supplier_id = ?`)
    .all(supplierId) as { ref_no: string; date: string; total: number; purchase_id: string | null }[];
  for (const r of rets)
    events.push({
      date: r.date,
      type: 'return',
      reference: r.ref_no,
      debit: 0,
      credit: round2(r.total),
      docId: r.purchase_id ?? undefined,
    });
  pushOnAccount(db, 'supplier', supplierId, events);
  return withBalance(events);
}

/** Money paid on account: against the opening balance, or ahead (an advance). */
function pushOnAccount(
  db: DB,
  partyType: 'customer' | 'supplier',
  partyId: string,
  events: Omit<LedgerEntry, 'balance'>[],
): void {
  const rows = db
    .prepare(
      `SELECT paid_at AS date, amount, ref_no, method FROM account_payments
        WHERE party_type = ? AND party_id = ?`,
    )
    .all(partyType, partyId) as { date: string; amount: number; ref_no: string | null; method: string }[];
  for (const a of rows)
    events.push({
      date: a.date,
      type: 'payment',
      reference: `${a.ref_no ?? 'Payment'} (on account) · ${a.method}`,
      debit: 0,
      credit: round2(a.amount),
    });
}

function withBalance(events: Omit<LedgerEntry, 'balance'>[]): LedgerEntry[] {
  events.sort((a, b) => a.date.localeCompare(b.date));
  let bal = 0;
  return events.map((e) => {
    bal = round2(bal + e.debit - e.credit);
    return { ...e, balance: bal };
  });
}
