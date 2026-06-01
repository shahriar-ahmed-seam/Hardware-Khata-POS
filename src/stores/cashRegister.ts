import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';
import {
  resolveBranchId,
  toMovement,
  toShift,
  type BackendMovement,
  type BackendShift,
  type BackendShiftTotals,
} from '@/hooks/cashAdapter';

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

// Single-branch assumption for now (br_mp <-> 'Mirpur Branch'). Under the
// backend, getCurrentShift ignores the branch string and returns the one open
// shift. See cashAdapter.BRANCH_NAME / resolveBranchId.
const CURRENT_USER = 'u_admin';
const DEFAULT_BRANCH = 'br_mp';

let shiftCounter = 1234; // mock starting

function seedNow() {
  return new Date().toISOString();
}

const SEED_SHIFT: Shift = {
  id: 'sh_seed1',
  shiftNo: 1234,
  branch: 'Mirpur Branch',
  status: 'open',
  openedBy: 'Seam',
  openedAt: '2026-05-26T09:00:00',
  openingCash: 5000,
  openingNote: 'Regular Tuesday float',
};

const SEED_MOVEMENTS: CashMovement[] = [
  { id: 'mv1', shiftId: 'sh_seed1', type: 'sale_cash', amount: 685, reference: 'INV-2026-0448', cashier: 'Seam', at: '2026-05-26T10:31:00' },
  { id: 'mv2', shiftId: 'sh_seed1', type: 'manual_out', amount: 200, reason: 'Other', note: 'Tea expense', cashier: 'Seam', at: '2026-05-26T10:50:00' },
  { id: 'mv3', shiftId: 'sh_seed1', type: 'expense', amount: 3200, reference: 'EXP-0024', note: 'Petty cash · transport', cashier: 'Seam', at: '2026-05-26T10:54:00' },
  { id: 'mv4', shiftId: 'sh_seed1', type: 'sale_cash', amount: 1302, reference: 'INV-2026-0450', cashier: 'Seam', at: '2026-05-26T11:18:00' },
  { id: 'mv5', shiftId: 'sh_seed1', type: 'payment_received', amount: 10000, reference: 'INV-2026-0451 · Rahim', cashier: 'Seam', at: '2026-05-26T11:42:00' },
  // some closed shift history
];

// A handful of past closed shifts for the Register Report demo
const HISTORY: Shift[] = [
  {
    id: 'sh_h1',
    shiftNo: 1233,
    branch: 'Mirpur Branch',
    status: 'closed',
    openedBy: 'Seam',
    openedAt: '2026-05-25T09:05:00',
    openingCash: 5000,
    closedBy: 'Seam',
    closedAt: '2026-05-25T21:14:00',
    countedTotal: 88200,
    variance: -50,
    carriedFloat: 5000,
    totals: {
      cashIn: 96400,
      cashOut: 13200,
      expected: 88250,
      salesCount: 52,
      salesTotal: 142800,
      byMethod: { Cash: 96400, bKash: 22000, Nagad: 8400, Card: 16000 },
    },
  },
  {
    id: 'sh_h2',
    shiftNo: 1232,
    branch: 'Mirpur Branch',
    status: 'closed',
    openedBy: 'Faruq',
    openedAt: '2026-05-24T09:00:00',
    openingCash: 5000,
    closedBy: 'Seam',
    closedAt: '2026-05-24T21:30:00',
    countedTotal: 76300,
    variance: 0,
    carriedFloat: 5000,
    totals: {
      cashIn: 82400,
      cashOut: 11100,
      expected: 76300,
      salesCount: 41,
      salesTotal: 121600,
      byMethod: { Cash: 82400, bKash: 18000, Nagad: 5200, Card: 11000, Bank: 5000 },
    },
  },
];

export const useCashRegister = create<State>()(
  persist(
    (set, get) => ({
      // When the backend is present we start empty and let hydrate() replace the
      // arrays from the DB (so stale persisted data is reconciled). Without a
      // backend we keep the mock seed data.
      shifts: hasBackend() ? [] : [SEED_SHIFT, ...HISTORY],
      movements: hasBackend() ? [] : SEED_MOVEMENTS,
      loading: false,
      varianceWarnThreshold: 100,
      varianceBlockThreshold: 1000,

      /**
       * Load shifts + the open shift's movements from the backend. REPLACES the
       * arrays so any stale persisted data is reconciled. No-op without backend.
       */
      hydrate: async () => {
        if (!hasBackend()) return;
        set({ loading: true });
        try {
          const rows = await api<BackendShift[]>('shifts.list', {});
          // Pull derived totals per shift (expected drawer cash is never stored).
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
          const openRow = rows.find((r) => r.status === 'open');
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
       * historical shift). Merges into the store (dedup by id). No-op without
       * backend or if we already have movements for that shift.
       */
      ensureShiftMovements: async (shiftId) => {
        if (!hasBackend()) return;
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
        if (hasBackend()) {
          // Fire the write, then hydrate to pull the real shift. A "shift already
          // open" rejection is swallowed after a hydrate so the UI just shows the
          // existing open shift. The modal ignores the returned (optimistic) shift
          // and the brief gap is covered by `loading`.
          void api('cash.openShift', {
            branchId: resolveBranchId(branch),
            userId: CURRENT_USER,
            openingCash,
            note,
          })
            .then(() => get().hydrate())
            .catch(() => get().hydrate());
          // Optimistic shape only — NOT pushed to state under backend.
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
        shiftCounter += 1;
        const id = 'sh_' + Date.now();
        const shift: Shift = {
          id,
          shiftNo: shiftCounter,
          branch,
          status: 'open',
          openedBy: cashier,
          openedAt: seedNow(),
          openingCash,
          openingNote: note,
        };
        set((s) => ({ shifts: [shift, ...s.shifts] }));
        return shift;
      },

      recordMovement: ({ shiftId, type, amount, reference, note, reason, cashier }) => {
        if (amount <= 0) return null;
        if (hasBackend()) {
          if (!shiftId) return null;
          const direction = MOVEMENT_DIRECTION[type];
          // Manual movements carry their own reason; everything else auto-posts
          // from its own slice, so under the backend `type` doubles as the reason.
          const backendReason =
            type === 'manual_in' ? 'manual_in' : type === 'manual_out' ? 'manual_out' : type;
          void api('cash.move', {
            shiftId,
            branchId: DEFAULT_BRANCH,
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
          // Optimistic shape only — NOT pushed to state under backend.
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
        }
        const branch = get().shifts.find((s) => s.id === shiftId)?.branch ?? 'Mirpur Branch';
        const sid =
          shiftId ?? get().shifts.find((s) => s.status === 'open' && s.branch === branch)?.id;
        if (!sid) return null;
        const m: CashMovement = {
          id: 'mv_' + Date.now(),
          shiftId: sid,
          type,
          amount,
          reference,
          note,
          reason,
          cashier,
          at: seedNow(),
        };
        set((s) => ({ movements: [m, ...s.movements] }));
        return m;
      },

      closeShift: (shiftId, { countedDenominations, carriedFloat, note, closedBy }) => {
        if (hasBackend()) {
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
        }
        const state = get();
        const shift = state.shifts.find((s) => s.id === shiftId);
        if (!shift || shift.status !== 'open') return null;

        const movements = state.movements.filter((m) => m.shiftId === shiftId);
        const cashIn = movements
          .filter((m) => MOVEMENT_DIRECTION[m.type] === 'in')
          .reduce((s, m) => s + m.amount, 0);
        const cashOut = movements
          .filter((m) => MOVEMENT_DIRECTION[m.type] === 'out')
          .reduce((s, m) => s + m.amount, 0);
        const expected = shift.openingCash + cashIn - cashOut;
        const counted = denominationsTotal(countedDenominations);
        const variance = counted - expected;

        const updated: Shift = {
          ...shift,
          status: 'closed',
          closedAt: seedNow(),
          closedBy,
          countedDenominations,
          countedTotal: counted,
          variance,
          carriedFloat,
          closingNote: note,
          totals: {
            cashIn,
            cashOut,
            expected,
            salesCount: movements.filter((m) => m.type === 'sale_cash').length,
            salesTotal: movements
              .filter((m) => m.type === 'sale_cash')
              .reduce((s, m) => s + m.amount, 0),
            byMethod: { Cash: cashIn },
          },
        };

        set((s) => ({ shifts: s.shifts.map((x) => (x.id === shiftId ? updated : x)) }));
        return updated;
      },

      getCurrentShift: (branch) => {
        // Under the backend, single-branch assumption: ignore the branch string
        // and return the one open shift.
        if (hasBackend()) return get().shifts.find((s) => s.status === 'open');
        return get().shifts.find((s) => s.status === 'open' && s.branch === branch);
      },
    }),
    { name: 'pos-cash-register' },
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
