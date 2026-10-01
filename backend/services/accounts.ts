import { tx, type DB } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { round2 } from '../core/money.ts';
import { canonicalMethod, isWalkIn } from '../core/validate.ts';
import { addSalePayment } from './sales.ts';
import { addPurchasePayment } from './purchases.ts';
import { postCashToOpenShift } from './cash.ts';
import { logActivity } from './activity.ts';
import { nextRef } from './sequences.ts';
import { shopBranchId } from './branch.ts';
import { paidOnAccount } from './ledger.ts';

/**
 * PAYING A WHOLE ACCOUNT — a customer settling up, or the shop paying a supplier
 * (audit R30).
 *
 * The screens used to do this themselves: Receive Payment looped one
 * `sales.addPayment` call per invoice without waiting for any of them, and
 * nothing at all was saved for the part of the money that did not fit an
 * invoice. A customer paying off an opening balance, or paying ahead, handed
 * over money the app never recorded — while the screen said "Payment will be
 * applied as advance". `paySupplier` did the same with the remainder.
 *
 * Now ONE backend call, in ONE transaction, places every taka:
 *   1. automatic mode: the opening balance first, then the oldest open
 *      documents (final invoices / live bills), and whatever is left stays on
 *      the account as an advance;
 *   2. picked mode (`allocations`): the amounts chosen per document first, then
 *      the opening balance, then an advance.
 * Money against documents is written as ordinary sale/purchase payments; the
 * opening-balance part and the advance go into `account_payments` (v11), which
 * the balances subtract (services/ledger.ts). Cash posts to the drawer either way.
 */

export interface AccountAllocation {
  /** A sale id (customer side) or a purchase id (supplier side). */
  docId: string;
  amount: number;
}

export interface AccountPaymentInput {
  partyId: string;
  amount: number;
  method: string;
  reference?: string;
  paidAt?: string;
  /** Stamped from the session at the IPC boundary. */
  userId: string;
  /** Omitted → the shop's default branch (services/branch.ts). */
  branchId?: string;
  note?: string;
  /** Picked mode: how much goes to each document. Omitted → automatic. */
  allocations?: AccountAllocation[];
}

export interface AccountPaymentResult {
  amount: number;
  /** Placed against invoices / bills, oldest first (or as picked). */
  toDocuments: { id: string; ref: string; amount: number }[];
  allocated: number;
  /** Placed against the opening balance. */
  toOpening: number;
  /** Left on the account as an advance (shown as a negative due). */
  advance: number;
  /** The account_payments row holding toOpening + advance, if any. */
  accountPaymentId: string | null;
  refNo: string | null;
}

type Side = 'customer' | 'supplier';

interface OpenDoc {
  id: string;
  ref: string;
  due: number;
}

const SIDES: Record<
  Side,
  {
    party: (db: DB, id: string) => { name: string; opening_balance: number } | undefined;
    openDocs: (db: DB, id: string) => OpenDoc[];
    doc: (db: DB, docId: string) => { party: string | null; ref: string; due: number; live: boolean } | undefined;
    pay: (db: DB, docId: string, p: { method: string; amount: number; reference?: string; paidAt: string }, userId: string) => void;
    cash: { direction: 'in' | 'out'; reason: string };
    missing: string;
    notTheirs: string;
  }
> = {
  customer: {
    party: (db, id) =>
      db.prepare('SELECT name, opening_balance FROM customers WHERE id = ?').get(id) as
        | { name: string; opening_balance: number }
        | undefined,
    openDocs: (db, id) =>
      db
        .prepare(
          `SELECT id, invoice_no AS ref, due FROM sales
            WHERE customer_id = ? AND status = 'final' AND due > 0.005
            ORDER BY date, invoice_no`,
        )
        .all(id) as OpenDoc[],
    doc: (db, docId) => {
      const r = db.prepare('SELECT customer_id, invoice_no, due, status FROM sales WHERE id = ?').get(docId) as
        | { customer_id: string | null; invoice_no: string; due: number; status: string }
        | undefined;
      return r && { party: r.customer_id, ref: r.invoice_no, due: r.due, live: r.status === 'final' };
    },
    pay: (db, docId, p, userId) => {
      addSalePayment(db, docId, p, userId);
    },
    cash: { direction: 'in', reason: 'payment_received' },
    missing: 'That customer does not exist.',
    notTheirs: 'is not an open invoice of this customer',
  },
  supplier: {
    party: (db, id) =>
      db.prepare('SELECT name, opening_balance FROM suppliers WHERE id = ?').get(id) as
        | { name: string; opening_balance: number }
        | undefined,
    openDocs: (db, id) =>
      db
        .prepare(
          // Received bills only (R51): money is not spread onto an order whose
          // goods have not come. Picking an ordered bill by hand still pays an
          // advance on it (see `doc`).
          `SELECT id, ref_no AS ref, due FROM purchases
            WHERE supplier_id = ? AND status = 'received' AND due > 0.005
            ORDER BY date, ref_no`,
        )
        .all(id) as OpenDoc[],
    doc: (db, docId) => {
      const r = db.prepare('SELECT supplier_id, ref_no, due, status FROM purchases WHERE id = ?').get(docId) as
        | { supplier_id: string | null; ref_no: string; due: number; status: string }
        | undefined;
      return r && { party: r.supplier_id, ref: r.ref_no, due: r.due, live: r.status !== 'cancelled' };
    },
    pay: (db, docId, p, userId) => {
      addPurchasePayment(db, docId, p, userId);
    },
    cash: { direction: 'out', reason: 'supplier_paid' },
    missing: 'That supplier does not exist.',
    notTheirs: 'is not an open bill of this supplier',
  },
};

function payAccount(db: DB, side: Side, input: AccountPaymentInput): AccountPaymentResult {
  return tx(db, () => {
    const cfg = SIDES[side];
    const amount = round2(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('A payment must be more than zero.');
    if (side === 'customer' && isWalkIn(input.partyId)) {
      throw new Error('A walk-in customer has no account. Take the money against the invoice instead.');
    }
    const party = input.partyId ? cfg.party(db, input.partyId) : undefined;
    if (!party) throw new Error(cfg.missing);

    const method = canonicalMethod(input.method);
    const paidAt = input.paidAt ?? new Date().toISOString();
    const branchId = shopBranchId(db, input.branchId);
    const openingOwed = Math.max(0, round2(party.opening_balance - paidOnAccount(db, side, input.partyId)));
    const payment = (amt: number) => ({ method, amount: amt, reference: input.reference, paidAt });

    const toDocuments: AccountPaymentResult['toDocuments'] = [];
    let toOpening = 0;
    let rest = amount;

    if (input.allocations && input.allocations.length > 0) {
      const seen = new Set<string>();
      const picked: { id: string; ref: string; amount: number }[] = [];
      for (const a of input.allocations) {
        const amt = round2(Number(a.amount));
        if (!Number.isFinite(amt) || amt < 0) throw new Error('Each amount applied must be zero or more.');
        if (amt === 0) continue;
        if (seen.has(a.docId)) throw new Error('The same document is listed twice.');
        seen.add(a.docId);
        const doc = cfg.doc(db, a.docId);
        if (!doc || doc.party !== input.partyId || !doc.live) {
          throw new Error(`${doc?.ref ?? 'That document'} ${cfg.notTheirs}.`);
        }
        if (amt > round2(doc.due) + 0.005) {
          throw new Error(`${doc.ref} has only ${round2(doc.due)} owing; ${amt} cannot be applied to it.`);
        }
        picked.push({ id: a.docId, ref: doc.ref, amount: amt });
      }
      const pickedTotal = round2(picked.reduce((s, p) => s + p.amount, 0));
      if (pickedTotal > amount + 0.005) {
        throw new Error('The amounts applied add up to more than the payment.');
      }
      for (const p of picked) {
        cfg.pay(db, p.id, payment(p.amount), input.userId);
        toDocuments.push(p);
      }
      rest = round2(amount - pickedTotal);
      toOpening = round2(Math.min(rest, openingOwed));
      rest = round2(rest - toOpening);
    } else {
      toOpening = round2(Math.min(amount, openingOwed));
      rest = round2(amount - toOpening);
      for (const doc of cfg.openDocs(db, input.partyId)) {
        if (rest <= 0.005) break;
        const apply = round2(Math.min(round2(doc.due), rest));
        if (apply <= 0) continue;
        cfg.pay(db, doc.id, payment(apply), input.userId);
        toDocuments.push({ id: doc.id, ref: doc.ref, amount: apply });
        rest = round2(rest - apply);
      }
    }

    const advance = Math.max(0, rest);
    const onAccount = round2(toOpening + advance);
    let accountPaymentId: string | null = null;
    let refNo: string | null = null;
    if (onAccount > 0.005) {
      accountPaymentId = newId('acp');
      refNo = nextRef(db, 'account_payment', new Date(paidAt));
      const note =
        input.note ??
        [toOpening > 0 ? `opening balance ${toOpening}` : '', advance > 0 ? `advance ${advance}` : '']
          .filter(Boolean)
          .join(', ');
      db.prepare(
        `INSERT INTO account_payments
           (id, ref_no, party_type, party_id, method, amount, reference, note, paid_at, branch_id, by_user)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        accountPaymentId,
        refNo,
        side,
        input.partyId,
        method,
        onAccount,
        input.reference ?? null,
        note || null,
        paidAt,
        branchId,
        input.userId ?? null,
      );
      if (method === 'Cash') {
        postCashToOpenShift(db, branchId, {
          direction: cfg.cash.direction,
          reason: cfg.cash.reason,
          amount: onAccount,
          refType: 'account_payment',
          refId: accountPaymentId,
          note: `${refNo} ${party.name}`,
          userId: input.userId,
          at: paidAt,
        });
      }
    }

    const allocated = round2(toDocuments.reduce((s, d) => s + d.amount, 0));
    logActivity(db, {
      by: input.userId,
      branchId,
      action: 'paid',
      entity: side,
      entityId: input.partyId,
      entityRef: refNo ?? undefined,
      message:
        side === 'customer'
          ? `Payment received from ${party.name} via ${method}`
          : `Paid ${party.name} via ${method}`,
      amount,
      at: paidAt,
    });

    return { amount, toDocuments, allocated, toOpening, advance, accountPaymentId, refNo };
  });
}

/** A customer pays (some of) what they owe, or pays ahead. */
export function receiveCustomerPayment(db: DB, input: AccountPaymentInput): AccountPaymentResult {
  return payAccount(db, 'customer', input);
}

/** The shop pays a supplier: opening balance, then the oldest bills, then an advance. */
export function payToSupplier(db: DB, input: AccountPaymentInput): AccountPaymentResult {
  return payAccount(db, 'supplier', input);
}
