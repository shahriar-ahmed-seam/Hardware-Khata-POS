import { tx, type DB } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { computeExpectedCash, computeVariance } from '../core/calc.ts';
import { round2 } from '../core/money.ts';
import { logActivity } from './activity.ts';

/**
 * Cash register / shift management. The drawer's expected cash is always
 * derived from movements, never stored as a running column.
 */

export interface OpenShiftInput {
  branchId: string;
  userId: string;
  openingCash: number;
  note?: string;
  at?: string;
}

export function getOpenShift(db: DB, branchId: string) {
  return db
    .prepare("SELECT * FROM cash_shifts WHERE branch_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1")
    .get(branchId) as Record<string, unknown> | undefined;
}

export function openShift(db: DB, i: OpenShiftInput): string {
  if (!Number.isFinite(i.openingCash) || i.openingCash < 0) {
    throw new Error('Opening cash cannot be negative.');
  }
  // One transaction: the shift row and its opening movement stand or fall
  // together, and the shift number is read and used inside it.
  return tx(db, () => openShiftInTx(db, i));
}

function openShiftInTx(db: DB, i: OpenShiftInput): string {
  const existing = getOpenShift(db, i.branchId);
  if (existing) throw new Error('A shift is already open for this branch');
  const id = newId('shift');
  const maxNo = db.prepare('SELECT COALESCE(MAX(shift_no),0) AS n FROM cash_shifts').get() as {
    n: number;
  };
  const at = i.at ?? new Date().toISOString();
  db.prepare(
    `INSERT INTO cash_shifts (id, shift_no, branch_id, user_id, opened_at, opening_cash, open_note, status)
     VALUES (@id, @no, @branchId, @userId, @at, @openingCash, @note, 'open')`,
  ).run({
    id,
    no: maxNo.n + 1,
    branchId: i.branchId,
    userId: i.userId,
    at,
    openingCash: round2(i.openingCash),
    note: i.note ?? null,
  });
  // Opening cash recorded as an 'in' movement of reason 'opening'
  recordCashMovement(db, {
    shiftId: id,
    branchId: i.branchId,
    direction: 'in',
    reason: 'opening',
    amount: i.openingCash,
    userId: i.userId,
    at,
  });
  return id;
}

export interface CashMovementInput {
  shiftId: string;
  branchId?: string;
  direction: 'in' | 'out';
  reason: string;
  amount: number;
  refType?: string;
  refId?: string;
  note?: string;
  userId?: string;
  at?: string;
}

export function recordCashMovement(db: DB, m: CashMovementInput): string {
  const id = newId('cm');
  db.prepare(
    `INSERT INTO cash_movements (id, shift_id, branch_id, direction, reason, amount, ref_type, ref_id, note, user_id, at)
     VALUES (@id, @shiftId, @branchId, @direction, @reason, @amount, @refType, @refId, @note, @userId, @at)`,
  ).run({
    id,
    shiftId: m.shiftId,
    branchId: m.branchId ?? null,
    direction: m.direction,
    reason: m.reason,
    amount: round2(Math.abs(m.amount)),
    refType: m.refType ?? null,
    refId: m.refId ?? null,
    note: m.note ?? null,
    userId: m.userId ?? null,
    at: m.at ?? new Date().toISOString(),
  });
  return id;
}

/**
 * What the last shift left in the drawer, for a drawer that opens itself.
 *
 * A counted close says what stayed behind: the carried float when one was set,
 * otherwise the whole count. A shift that was never closed has no count, so the
 * figure is what the books expected. The very first drawer starts at 0.
 */
export function carriedForwardCash(db: DB, branchId: string): { amount: number; fromShiftNo: number | null } {
  const last = db
    .prepare(
      `SELECT id, shift_no, status, counted_cash, carried_float
         FROM cash_shifts WHERE branch_id = ? ORDER BY opened_at DESC, shift_no DESC LIMIT 1`,
    )
    .get(branchId) as
    | { id: string; shift_no: number; status: string; counted_cash: number | null; carried_float: number | null }
    | undefined;
  if (!last) return { amount: 0, fromShiftNo: null };
  if (last.status === 'closed') {
    const amount = last.carried_float ?? last.counted_cash ?? shiftTotals(db, last.id).expected;
    return { amount: round2(amount), fromShiftNo: last.shift_no };
  }
  return { amount: round2(shiftTotals(db, last.id).expected), fromShiftNo: last.shift_no };
}

/** Somebody to open an automatic drawer under when the event names no user. */
function fallbackUserId(db: DB): string {
  const row = db
    .prepare(
      `SELECT id FROM users ORDER BY (status = 'active') DESC, (role_id = 'role_admin') DESC, id LIMIT 1`,
    )
    .get() as { id: string } | undefined;
  if (!row) throw new Error('No user exists to open the cash drawer under.');
  return row.id;
}

/**
 * The open drawer for a branch, opened now if there is none.
 *
 * NO CASH EVENT MAY GO UNRECORDED. Cash used to reach the drawer only while
 * somebody had pressed "Open Shift"; otherwise every cash sale, due collection,
 * refund, expense and supplier payment was silently dropped from the drawer —
 * and an elderly shopkeeper will forget that button on a busy morning. So the
 * drawer opens itself on the first cash event, starting from what the last
 * shift left in it (`carriedForwardCash`). Counting and closing stay available
 * and optional; the next cash event after a close opens the next drawer.
 */
export function ensureOpenShift(
  db: DB,
  branchId: string,
  opts: { userId?: string; at?: string } = {},
): Record<string, unknown> {
  const open = getOpenShift(db, branchId);
  if (open) return open;
  const carry = carriedForwardCash(db, branchId);
  const note =
    carry.fromShiftNo === null
      ? 'Opened automatically with the first cash entry.'
      : `Opened automatically with the first cash entry; opening cash carried from shift #${carry.fromShiftNo}.`;
  openShift(db, {
    branchId,
    userId: opts.userId || fallbackUserId(db),
    openingCash: carry.amount,
    note,
    at: opts.at,
  });
  return getOpenShift(db, branchId) as Record<string, unknown>;
}

/**
 * Route a cash event to the branch's drawer, opening one if none is open.
 * Always returns the movement id: a cash event is never dropped.
 */
export function postCashToOpenShift(
  db: DB,
  branchId: string,
  m: Omit<CashMovementInput, 'shiftId' | 'branchId'>,
): string {
  const shift = ensureOpenShift(db, branchId, { userId: m.userId, at: m.at });
  return recordCashMovement(db, { ...m, shiftId: shift.id as string, branchId });
}

/** Reasons a person may post by hand (Cash In / Cash Out on the register). */
const MANUAL_REASONS: Record<'in' | 'out', string> = { in: 'manual_in', out: 'manual_out' };

export interface ManualCashMoveInput {
  branchId: string;
  direction: 'in' | 'out';
  amount: number;
  note?: string;
  userId?: string;
  at?: string;
  /** Ignored: the drawer is resolved here, never taken from the screen. */
  shiftId?: string;
}

/**
 * Cash In / Cash Out typed at the register.
 *
 * This used to be the raw writer: the screen chose the shift (a closed,
 * Z-reported one included), the direction was not checked and the sign was
 * dropped. Now the drawer is resolved here like every other cash event, the
 * amount must be a real positive number, and the movement is logged.
 */
export function manualCashMove(db: DB, i: ManualCashMoveInput): string {
  if (i.direction !== 'in' && i.direction !== 'out') {
    throw new Error('Choose cash in or cash out.');
  }
  if (!Number.isFinite(i.amount) || i.amount <= 0) {
    throw new Error('Enter an amount above zero.');
  }
  if (!i.branchId) throw new Error('No branch is set for this drawer.');
  const id = postCashToOpenShift(db, i.branchId, {
    direction: i.direction,
    reason: MANUAL_REASONS[i.direction],
    amount: i.amount,
    note: i.note,
    userId: i.userId,
    at: i.at,
  });
  logActivity(db, {
    by: i.userId,
    branchId: i.branchId,
    action: i.direction === 'in' ? 'cash_in' : 'cash_out',
    entity: 'cash',
    entityId: id,
    message: i.note ? `Cash ${i.direction}: ${i.note}` : `Cash ${i.direction}`,
    amount: round2(i.amount),
    at: i.at,
  });
  return id;
}

export function shiftTotals(db: DB, shiftId: string) {
  const shift = db.prepare('SELECT * FROM cash_shifts WHERE id = ?').get(shiftId) as
    | Record<string, unknown>
    | undefined;
  if (!shift) throw new Error('Shift not found');
  const inRow = db
    .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM cash_movements WHERE shift_id = ? AND direction = 'in' AND reason != 'opening'")
    .get(shiftId) as { s: number };
  const outRow = db
    .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM cash_movements WHERE shift_id = ? AND direction = 'out'")
    .get(shiftId) as { s: number };
  const openingCash = shift.opening_cash as number;
  const expected = computeExpectedCash({
    openingCash,
    cashIn: inRow.s,
    cashOut: outRow.s,
  });
  return {
    shift,
    openingCash,
    cashIn: round2(inRow.s),
    cashOut: round2(outRow.s),
    expected,
  };
}

export interface CloseShiftInput {
  shiftId: string;
  countedCash: number;
  carriedFloat?: number;
  note?: string;
  at?: string;
  /** Who counted and closed it. Stamped from the session at the IPC boundary. */
  closedBy?: string;
}

export function closeShift(db: DB, i: CloseShiftInput) {
  const t = shiftTotals(db, i.shiftId);
  // Closing twice overwrote the counted cash and the variance of a shift that
  // was already reported on its Z-report.
  if ((t.shift.status as string) === 'closed') {
    throw new Error('This shift is already closed.');
  }
  const variance = computeVariance(i.countedCash, t.expected);
  const at = i.at ?? new Date().toISOString();
  db.prepare(
    `UPDATE cash_shifts
        SET closed_at = @at, counted_cash = @counted, expected_cash = @expected,
            variance = @variance, carried_float = @float, close_note = @note, status = 'closed',
            closed_by = @closedBy
      WHERE id = @id`,
  ).run({
    id: i.shiftId,
    at,
    counted: round2(i.countedCash),
    expected: t.expected,
    variance,
    float: i.carriedFloat ?? null,
    note: i.note ?? null,
    closedBy: i.closedBy ?? null,
  });
  // The close is in the audit trail too, with who counted and the difference.
  logActivity(db, {
    by: i.closedBy,
    branchId: t.shift.branch_id as string,
    action: 'closed',
    entity: 'shift',
    entityId: i.shiftId,
    message: `Drawer closed: counted ${round2(i.countedCash)}, expected ${t.expected}, difference ${variance}`,
    amount: round2(i.countedCash),
    at,
  });
  return { expected: t.expected, counted: round2(i.countedCash), variance };
}
