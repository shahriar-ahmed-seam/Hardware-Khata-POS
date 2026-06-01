import type { DB } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { computeExpectedCash, computeVariance } from '../core/calc.ts';
import { round2 } from '../core/money.ts';

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

/** Route a cash event to the currently open shift for a branch (if any). */
export function postCashToOpenShift(
  db: DB,
  branchId: string,
  m: Omit<CashMovementInput, 'shiftId' | 'branchId'>,
): string | null {
  const shift = getOpenShift(db, branchId);
  if (!shift) return null;
  return recordCashMovement(db, { ...m, shiftId: shift.id as string, branchId });
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
}

export function closeShift(db: DB, i: CloseShiftInput) {
  const t = shiftTotals(db, i.shiftId);
  const variance = computeVariance(i.countedCash, t.expected);
  db.prepare(
    `UPDATE cash_shifts
        SET closed_at = @at, counted_cash = @counted, expected_cash = @expected,
            variance = @variance, carried_float = @float, close_note = @note, status = 'closed'
      WHERE id = @id`,
  ).run({
    id: i.shiftId,
    at: i.at ?? new Date().toISOString(),
    counted: round2(i.countedCash),
    expected: t.expected,
    variance,
    float: i.carriedFloat ?? null,
    note: i.note ?? null,
  });
  return { expected: t.expected, counted: round2(i.countedCash), variance };
}
