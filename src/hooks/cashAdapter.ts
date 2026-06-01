import type { CashMovement, MovementType, Shift } from '@/stores/cashRegister';

/**
 * Maps backend cash_shifts / cash_movements rows (snake_case) into the frontend
 * Shift / CashMovement shapes that all the cash-register components already
 * consume. Mirrors purchaseAdapter.ts / contactAdapter.ts.
 *
 * The drawer's expected cash is DERIVED from movements on the backend (never a
 * stored running column); when a `totals` object from `cash.shiftTotals` is
 * passed we surface those derived figures on the Shift.
 *
 * DEFERRED (shift totals byMethod/salesCount/salesTotal): only cashIn/cashOut/
 * expected are exact. byMethod is best-effort ≈ { Cash: cashIn } and the
 * sales counters are 0, because the backend does not yet aggregate per-shift
 * sales-by-payment-method. Fill these in when a `cash.shiftSales` style channel
 * lands.
 */

/** Single-branch assumption for now: id <-> display name. */
export const BRANCH_NAME: Record<string, string> = { br_mp: 'Mirpur Branch' };

/** Resolve a branch id from a display name (defaults to the primary branch). */
export function resolveBranchId(name: string): string {
  return name.startsWith('br_') ? name : 'br_mp';
}

/** A cash_shifts row as returned by `shifts.list` (with joined user_name). */
export interface BackendShift {
  id: string;
  shift_no: number;
  branch_id: string;
  user_id: string;
  user_name?: string | null;
  opened_at: string;
  opening_cash: number;
  open_note: string | null;
  status: string;
  closed_at: string | null;
  counted_cash: number | null;
  expected_cash: number | null;
  variance: number | null;
  carried_float: number | null;
  close_note: string | null;
}

/** The shape returned by `cash.shiftTotals`. */
export interface BackendShiftTotals {
  openingCash: number;
  cashIn: number;
  cashOut: number;
  expected: number;
}

/** A cash_movements row as returned by `shifts.movements`. */
export interface BackendMovement {
  id: string;
  shift_id: string;
  branch_id: string | null;
  direction: 'in' | 'out';
  reason: string;
  amount: number;
  ref_type: string | null;
  ref_id: string | null;
  note: string | null;
  user_id: string | null;
  at: string;
}

export function toShift(row: BackendShift, totals?: BackendShiftTotals): Shift {
  const shift: Shift = {
    id: row.id,
    shiftNo: row.shift_no,
    branch: BRANCH_NAME[row.branch_id] ?? row.branch_id,
    status: row.status === 'closed' ? 'closed' : 'open',
    openedBy: row.user_name ?? row.user_id,
    openedAt: row.opened_at,
    openingCash: row.opening_cash,
    openingNote: row.open_note ?? undefined,
    closedBy: row.closed_at ? (row.user_name ?? row.user_id) : undefined,
    closedAt: row.closed_at ?? undefined,
    // Denominations are NOT stored on the backend (only counted_cash total), so
    // the per-note breakdown is unavailable when reading back. See store.closeShift.
    countedDenominations: undefined,
    countedTotal: row.counted_cash ?? undefined,
    variance: row.variance ?? undefined,
    carriedFloat: row.carried_float ?? undefined,
    closingNote: row.close_note ?? undefined,
  };
  if (totals) {
    shift.totals = {
      cashIn: totals.cashIn,
      cashOut: totals.cashOut,
      expected: totals.expected,
      // best-effort — see file header note
      salesCount: 0,
      salesTotal: 0,
      byMethod: { Cash: totals.cashIn },
    };
  }
  return shift;
}

/** Derive a frontend MovementType from a backend (direction, reason) pair. */
function toMovementType(direction: 'in' | 'out', reason: string): MovementType {
  switch (reason) {
    case 'sale':
      return 'sale_cash';
    case 'refund':
      return 'refund';
    case 'expense':
      return 'expense';
    case 'supplier_paid':
      return 'supplier_paid';
    case 'manual_in':
      return 'manual_in';
    case 'manual_out':
      return 'manual_out';
    default:
      // Unknown reason: fall back to the direction.
      return direction === 'in' ? 'manual_in' : 'manual_out';
  }
}

export function toMovement(row: BackendMovement): CashMovement {
  return {
    id: row.id,
    shiftId: row.shift_id,
    type: toMovementType(row.direction, row.reason),
    amount: row.amount,
    // cash_movements has ref_id only (no ref_no column).
    reference: row.ref_id ?? undefined,
    note: row.note ?? undefined,
    cashier: row.user_id ?? '',
    at: row.at,
  };
}

