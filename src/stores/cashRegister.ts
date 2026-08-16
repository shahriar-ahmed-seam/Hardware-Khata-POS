import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast';
import {
  toMovement,
  toShift,
  type BackendMovement,
  type BackendShift,
  type BackendShiftTotals,
} from '@/hooks/cashAdapter';
import { branchIdOf, requireBranchId } from '@/lib/branch';

export type MovementType =
  | 'sale_cash'
  | 'payment_received'
  | 'manual_in'
  | 'refund'
  | 'supplier_paid'
  | 'expense'
  | 'manual_out';

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  sale_cash: 'Cash sale',
  payment_received: 'Payment received',
  manual_in: 'Manual cash in',
  refund: 'Refund',
  supplier_paid: 'Paid supplier',
  expense: 'Expense',
  manual_out: 'Manual cash out',
};

export const MOVEMENT_DIRECTION: Record<MovementType, 'in' | 'out'> = {
  sale_cash: 'in',
  payment_received: 'in',
  manual_in: 'in',
  refund: 'out',
  supplier_paid: 'out',
  expense: 'out',
  manual_out: 'out',
};

export const MANUAL_REASONS = [
  'Petty cash',
  'Float top-up',
  'Bank deposit',
  'Personal use',
  'Other',
] as const;
export type ManualReason = (typeof MANUAL_REASONS)[number];

export interface CashMovement {
  id: string;
  shiftId: string;
  type: MovementType;
  amount: number;
  reference?: string; // invoice / supplier / expense ref
  note?: string;
  reason?: ManualReason;
  cashier: string;
  at: string; // ISO
}

export type ShiftStatus = 'open' | 'closed';

export interface DenominationCount {
  d1000?: number;
  d500?: number;
  d200?: number;
  d100?: number;
  d50?: number;
  d20?: number;
  d10?: number;
  d5?: number;
  d2?: number;
  d1?: number;
}

export const DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

export function denominationsTotal(d: DenominationCount): number {
  return (
    (d.d1000 ?? 0) * 1000 +
    (d.d500 ?? 0) * 500 +
    (d.d200 ?? 0) * 200 +
    (d.d100 ?? 0) * 100 +
    (d.d50 ?? 0) * 50 +
    (d.d20 ?? 0) * 20 +
    (d.d10 ?? 0) * 10 +
    (d.d5 ?? 0) * 5 +
    (d.d2 ?? 0) * 2 +
    (d.d1 ?? 0) * 1
  );
}

export interface Shift {
  id: string;
  shiftNo: number;
  branch: string;
  status: ShiftStatus;
  openedBy: string;
  openedAt: string;
  openingCash: number;
  openingNote?: string;
  closedBy?: string;
  closedAt?: string;
  countedDenominations?: DenominationCount;
  countedTotal?: number;
  variance?: number; // counted - expected
  carriedFloat?: number; // amount kept as next-shift float
  closingNote?: string;
  // pre-aggregates filled at close (reports)
  totals?: {
    cashIn: number;
    cashOut: number;
    expected: number;
    salesCount: number;
    salesTotal: number;
    byMethod: Record<string, number>; // sales totals by payment method
  };
}

interface State {
  shifts: Shift[];
  movements: CashMovement[];
  loading: boolean;
  varianceWarnThreshold: number;
  varianceBlockThreshold: number;

  hydrate: () => Promise<void>;
  ensureShiftMovements: (shiftId: string) => Promise<void>;
  openShift: (data: { openingCash: number; note?: string; cashier: string; branch: string }) => Shift;
  recordMovement: (m: Omit<CashMovement, 'id' | 'at' | 'shiftId'> & { shiftId?: string }) => CashMovement | null;
  closeShift: (
    shiftId: string,
    data: {
      countedDenominations: DenominationCount;
      carriedFloat: number;
      note?: string;
      closedBy: string;
    },
  ) => Shift | null;
  getCurrentShift: (branch: string) => Shift | undefined;
}

// Under the backend, getCurrentShift ignores the branch string and returns the
// one open shift. Branch ids are resolved from the real branch list — see
// src/lib/branch.ts. There is deliberately no `DEFAULT_BRANCH = 'br_mp'` constant
// any more: it was the demo fixture's id, and a cash movement stamped with the
// wrong branch drops out of every branch-scoped drawer figure.
const CURRENT_USER = 'u_admin';

/**
 * How many recent shifts to hydrate with their derived totals. Each one costs a
 * `cash.shiftTotals` call, so this caps the work regardless of how much history
 * the shop has accumulated. Full history lives in the Register Report.
 */
const SHIFT_HISTORY_LIMIT = 30;

function seedNow() {
  return new Date().toISOString();
}

export const useCashRegister = create<State>()(
  persist(
    (set, get) => ({
      // We start empty and let hydrate() replace the arrays from the DB (so any
      // stale persisted data is reconciled).
      shifts: [],
      movements: [],
      loading: false,
      varianceWarnThreshold: 100,
      varianceBlockThreshold: 1000,

      /**
       * Load shifts + the open shift's movements from the backend. REPLACES the
       * arrays so any stale persisted data is reconciled.
       */
      hydrate: async () => {
        set({ loading: true });
        try {
          const allRows = await api<BackendShift[]>('shifts.list', {});
          // PERFORMANCE: expected drawer cash is DERIVED, so it needs one
          // `cash.shiftTotals` call per shift. A shop accumulates ~2 shifts a
          // day, so after a year that loop alone is ~700 synchronous IPC calls
          // and it blocks the app on every hydrate.
          //
          // The screen only ever shows the open shift plus recent history, so we
          // bound it: keep the open shift (wherever it sits) plus the newest
          // SHIFT_HISTORY_LIMIT rows. Older shifts stay reachable through the
          // Register Report, which queries the backend directly.
          const openRow = allRows.find((r) => r.status === 'open');
          const recent = allRows.slice(0, SHIFT_HISTORY_LIMIT);
          const rows =
            openRow && !recent.some((r) => r.id === openRow.id) ? [openRow, ...recent] : recent;
          const shifts = await Promise.all(
            rows.map(async (row) => {
              const totals = await api<BackendShiftTotals>('cash.shiftTotals', {
                shiftId: row.id,
              });
              return toShift(row, totals);
            }),
          );
          // Movements list only needs the OPEN shift up front; closed shifts are
          // fetched on demand via ensureShiftMovements (X/Z reports, close modal).
          let movements: CashMovement[] = [];
          if (openRow) {
            const mvRows = await api<BackendMovement[]>('shifts.movements', {
              shiftId: openRow.id,
            });
            movements = mvRows
              .filter((m) => m.reason !== 'opening')
              .map(toMovement);
          }
          set({ shifts, movements, loading: false });
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Failed to load cash register');
          set({ loading: false });
        }
      },

      /**
       * Fetch a specific shift's movements on demand (used to view a closed /
       * historical shift). Merges into the store (dedup by id). No-op if we
       * already have movements for that shift.
       */
      ensureShiftMovements: async (shiftId) => {
        if (get().movements.some((m) => m.shiftId === shiftId)) return;
        try {
          const mvRows = await api<BackendMovement[]>('shifts.movements', { shiftId });
          const fetched = mvRows.filter((m) => m.reason !== 'opening').map(toMovement);
          set((s) => {
            const known = new Set(s.movements.map((m) => m.id));
            const merged = [...s.movements, ...fetched.filter((m) => !known.has(m.id))];
            return { movements: merged };
          });
        } catch {
          /* ignore — view falls back to whatever is in the store */
        }
      },

      openShift: ({ openingCash, note, cashier, branch }) => {
        // Resolve the branch before writing, and refuse rather than guess — a
        // shift opened against the wrong branch takes the whole day's cash with
        // it. `requireBranchId` throws, so the toast below is what the cashier
        // sees instead of a silently mis-filed shift.
        let branchId: string;
        try {
          branchId = requireBranchId(branch);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No branch is available yet');
          return {
            id: 'sh_pending',
            shiftNo: 0,
            branch,
            status: 'open',
            openedBy: cashier,
            openedAt: seedNow(),
            openingCash,
            openingNote: note,
          };
        }
        // Fire the write, then hydrate to pull the real shift. A "shift already
        // open" rejection is swallowed after a hydrate so the UI just shows the
        // existing open shift. The modal ignores the returned (optimistic) shift
        // and the brief gap is covered by `loading`.
        void api('cash.openShift', {
          branchId,
          userId: CURRENT_USER,
          openingCash,
          note,
        })
          .then(() => get().hydrate())
          .catch(() => get().hydrate());
        // Optimistic shape only — NOT pushed to state; the row arrives via hydrate().
        return {
          id: 'sh_pending',
          shiftNo: 0,
          branch,
          status: 'open',
          openedBy: cashier,
          openedAt: seedNow(),
          openingCash,
          openingNote: note,
        };
      },

      recordMovement: ({ shiftId, type, amount, reference, note, reason, cashier }) => {
        if (amount <= 0) return null;
        if (!shiftId) return null;
        const direction = MOVEMENT_DIRECTION[type];
        // Manual movements carry their own reason; everything else auto-posts
        // from its own slice, so `type` doubles as the backend reason.
        const backendReason =
          type === 'manual_in' ? 'manual_in' : type === 'manual_out' ? 'manual_out' : type;
        // The movement belongs to the branch of the shift it is posted to, not to
        // a hard-coded default. `branchIdOf` resolves the shift's display name
        // back to its id and falls back to the shop's default branch.
        const shiftBranch = get().shifts.find((s) => s.id === shiftId)?.branch;
        void api('cash.move', {
          shiftId,
          branchId: branchIdOf(shiftBranch),
          direction,
          reason: backendReason,
          amount,
          note,
          userId: CURRENT_USER,
        })
          .then(() => get().hydrate())
          .catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Failed to record cash movement');
            void get().hydrate();
          });
        // Optimistic shape only — NOT pushed to state; the row arrives via hydrate().
        return {
          id: 'mv_pending',
          shiftId,
          type,
          amount,
          reference,
          note,
          reason,
          cashier,
          at: seedNow(),
        };
      },

      closeShift: (shiftId, { countedDenominations, carriedFloat, note }) => {
        // DEFERRED (denominations not persisted): the backend stores only the
        // counted_cash TOTAL — the per-note DenominationCount is frontend-only
        // and is lost on reload (toShift leaves countedDenominations undefined).
        const countedCash = denominationsTotal(countedDenominations);
        void api('cash.closeShift', {
          shiftId,
          countedCash,
          carriedFloat,
          note,
        })
          .then(() => get().hydrate())
          .catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : 'Failed to close shift');
            void get().hydrate();
          });
        // The closed shift comes back via hydrate; nothing to return optimistically.
        return null;
      },

      getCurrentShift: () => {
        // Single-branch assumption: ignore the branch string and return the one
        // open shift the backend reports.
        return get().shifts.find((s) => s.status === 'open');
      },
    }),
    // v2: drops cached demo shifts/movements. `hydrate()` refills from the DB.
    { name: 'pos-cash-register', version: 2 },
  ),
);

// Helpers
export function shiftDuration(s: Shift): string {
  const start = new Date(s.openedAt).getTime();
  const end = s.closedAt ? new Date(s.closedAt).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}
