import { create } from 'zustand';
import { currentUserId } from '@/lib/actor';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import { CASH_CHANGED_EVENT } from '@/lib/queryClient';
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
  | 'expense_reversal'
  | 'supplier_refund'
  | 'manual_out';

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  sale_cash: 'Cash sale',
  payment_received: 'Payment received',
  manual_in: 'Manual cash in',
  refund: 'Refund',
  supplier_paid: 'Paid supplier',
  expense: 'Expense',
  expense_reversal: 'Expense reversed',
  supplier_refund: 'Refund from supplier',
  manual_out: 'Manual cash out',
};

export const MOVEMENT_DIRECTION: Record<MovementType, 'in' | 'out'> = {
  sale_cash: 'in',
  payment_received: 'in',
  manual_in: 'in',
  refund: 'out',
  supplier_paid: 'out',
  expense: 'out',
  expense_reversal: 'in',
  supplier_refund: 'in',
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
  /** Start the drawer with a counted amount. Resolves true once the backend has it. */
  openShift: (data: { openingCash: number; note?: string; cashier: string; branch: string }) => Promise<boolean>;
  /**
   * Cash In / Cash Out. The backend finds (or opens) the drawer, so no shift is
   * needed first. Resolves true once recorded.
   */
  recordMovement: (m: Omit<CashMovement, 'id' | 'at' | 'shiftId'> & { shiftId?: string }) => Promise<boolean>;
  /** What the next drawer would start with (the last shift's float or count). */
  carriedForward: (branch: string) => Promise<number | null>;
  closeShift: (
    shiftId: string,
    data: {
      countedDenominations: DenominationCount;
      carriedFloat: number;
      note?: string;
      closedBy: string;
    },
  ) => Promise<boolean>;
  getCurrentShift: (branch: string) => Shift | undefined;
}

// Under the backend, getCurrentShift ignores the branch string and returns the
// one open shift. Branch ids are resolved from the real branch list — see
// src/lib/branch.ts. There is deliberately no `DEFAULT_BRANCH = 'br_mp'` constant
// any more: it was the demo fixture's id, and a cash movement stamped with the
// wrong branch drops out of every branch-scoped drawer figure.

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

      /**
       * Start the drawer with a counted amount (optional — it also opens by
       * itself with the first cash event). The branch is resolved before
       * writing, and refused rather than guessed: `requireBranchId` throws.
       * Every refusal is shown; it used to be swallowed, and the screen got a
       * placeholder "open" shift that did not exist.
       */
      openShift: async ({ openingCash, note, branch }) => {
        try {
          const branchId = requireBranchId(branch);
          await api('cash.openShift', {
            branchId,
            userId: currentUserId(),
            openingCash,
            note,
          });
          await get().hydrate();
          return true;
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Could not start the drawer');
          await get().hydrate();
          return false;
        }
      },

      recordMovement: async ({ shiftId, type, amount, note, reason }) => {
        if (!(amount > 0)) {
          toast.error('Enter an amount above zero.');
          return false;
        }
        const direction = MOVEMENT_DIRECTION[type];
        // The movement belongs to the branch of the drawer it lands in. With no
        // drawer open yet, that is the shop's default branch — the backend then
        // opens the drawer itself.
        const shiftBranch = shiftId ? get().shifts.find((s) => s.id === shiftId)?.branch : undefined;
        try {
          await api('cash.move', {
            branchId: requireBranchId(shiftBranch),
            direction,
            amount,
            note: [reason, note].filter(Boolean).join(' · ') || undefined,
            userId: currentUserId(),
          });
          await get().hydrate();
          return true;
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Failed to record cash movement');
          await get().hydrate();
          return false;
        }
      },

      carriedForward: async (branch) => {
        try {
          const res = await api<{ amount: number }>('cash.carriedForward', {
            branchId: requireBranchId(branch),
          });
          return res.amount;
        } catch {
          return null;
        }
      },

      closeShift: async (shiftId, { countedDenominations, carriedFloat, note }) => {
        // DEFERRED (denominations not persisted): the backend stores only the
        // counted_cash TOTAL — the per-note DenominationCount is frontend-only
        // and is lost on reload (toShift leaves countedDenominations undefined).
        const countedCash = denominationsTotal(countedDenominations);
        try {
          await api('cash.closeShift', { shiftId, countedCash, carriedFloat, note });
          await get().hydrate();
          // A shift close may take a backup; let the backup banner look again soon.
          setTimeout(() => window.dispatchEvent(new Event('pos:backup-health')), 5000);
          return true;
        } catch (e: unknown) {
          // Resolves false so the Close Shift screen stays open on a refusal (a
          // count over the variance limit, a shift already closed) instead of
          // vanishing as if it had worked.
          toast.error(e instanceof Error ? e.message : 'Failed to close shift');
          void get().hydrate();
          return false;
        }
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

/**
 * A sale, refund, payment or expense moved cash (src/lib/queryClient.ts
 * afterWrite): re-read the drawer, so its figure is never left behind (R84).
 * Debounced — one save can be followed by another at once.
 */
if (typeof window !== 'undefined') {
  let timer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener(CASH_CHANGED_EVENT, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void useCashRegister.getState().hydrate();
    }, 300);
  });
}
