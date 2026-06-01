import { create } from 'zustand';
import { api, hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';
import { useBranches } from '@/stores/branches';
import { resolveBranchId } from '@/hooks/useReport';
import {
  toTransfer,
  toAdjustment,
  type BackendTransfer,
  type BackendAdjustment,
} from '@/hooks/stockOpsAdapter';

// ----- Stock Movement (audit log) -----
export type MovementReason =
  | 'sale'
  | 'sale_return'
  | 'purchase'
  | 'purchase_return'
  | 'transfer_out'
  | 'transfer_in'
  | 'damage'
  | 'theft'
  | 'sample'
  | 'recount'
  | 'opening_stock'
  | 'other';

export interface StockMovement {
  id: string;
  productId: string;
  branch: string;
  reason: MovementReason;
  qty: number; // signed: + adds stock, - removes
  unit: string;
  reference?: string;
  note?: string;
  user: string;
  at: string;
}

// ----- Transfers -----
export type TransferStatus = 'pending' | 'in-transit' | 'received' | 'cancelled';

export interface TransferLine {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unit: string;
  unitCost: number;
  receivedQty?: number; // set when receiving
}

export interface StockTransfer {
  id: string;
  refNo: string;
  date: string;
  fromBranch: string;
  toBranch: string;
  lines: TransferLine[];
  status: TransferStatus;
  notes?: string;
  createdBy: string;
  receivedBy?: string;
  receivedAt?: string;
  receiveNote?: string;
}

// ----- Adjustments -----
export type AdjustmentType = 'damage' | 'theft' | 'sample' | 'recount' | 'other';

export interface AdjustmentLine {
  productId: string;
  name: string;
  sku: string;
  qty: number; // signed: + found, - lost
  unit: string;
  unitCost: number;
}

export interface StockAdjustment {
  id: string;
  refNo: string;
  date: string;
  branch: string;
  type: AdjustmentType;
  lines: AdjustmentLine[];
  reason?: string;
  createdBy: string;
}

interface State {
  movements: StockMovement[];
  transfers: StockTransfer[];
  adjustments: StockAdjustment[];
  loading: boolean;

  hydrate: () => Promise<void>;
  addTransfer: (t: StockTransfer) => void;
  receiveTransfer: (
    id: string,
    receivedLines: { productId: string; receivedQty: number }[],
    note?: string,
    receivedBy?: string,
  ) => void;
  cancelTransfer: (id: string) => void;

  addAdjustment: (a: StockAdjustment) => void;
}

let transferCounter = 100;
let adjustmentCounter = 100;
export function nextTransferRef() {
  transferCounter += 1;
  return `TRF-${new Date().getFullYear()}-${String(transferCounter).padStart(4, '0')}`;
}
export function nextAdjustmentRef() {
  adjustmentCounter += 1;
  return `ADJ-${new Date().getFullYear()}-${String(adjustmentCounter).padStart(4, '0')}`;
}

const SEED_TRANSFERS: StockTransfer[] = [
  {
    id: 't_seed1',
    refNo: 'TRF-2026-0042',
    date: '2026-05-25T10:30:00',
    fromBranch: 'Mirpur Branch',
    toBranch: 'Uttara Branch',
    status: 'in-transit',
    notes: '12 bags cement + 8 boxes nails',
    createdBy: 'Seam',
    lines: [
      {
        productId: 'p8',
        name: 'Cement OPC 50kg',
        sku: 'BM-CMNT-OPC',
        qty: 12,
        unit: 'bag',
        unitCost: 480,
      },
      {
        productId: 'p7',
        name: 'Iron Nail 2.5"',
        sku: 'FS-NAIL-2.5',
        qty: 8,
        unit: 'kg',
        unitCost: 110,
      },
    ],
  },
  {
    id: 't_seed2',
    refNo: 'TRF-2026-0041',
    date: '2026-05-22T14:00:00',
    fromBranch: 'Mirpur Branch',
    toBranch: 'Uttara Branch',
    status: 'received',
    createdBy: 'Faruq',
    receivedBy: 'Karim',
    receivedAt: '2026-05-22T18:30:00',
    lines: [
      {
        productId: 'p1',
        name: 'Claw Hammer 16oz',
        sku: 'HT-CLW-16',
        qty: 10,
        unit: 'pc',
        unitCost: 380,
        receivedQty: 10,
      },
    ],
  },
];

const SEED_ADJUSTMENTS: StockAdjustment[] = [
  {
    id: 'a_seed1',
    refNo: 'ADJ-2026-0017',
    date: '2026-05-24T11:00:00',
    branch: 'Mirpur Branch',
    type: 'damage',
    reason: 'Pallet fell during forklift move',
    createdBy: 'Seam',
    lines: [
      {
        productId: 'p6c',
        name: 'Weather Coat White 20L',
        sku: 'PN-WHITE-20L',
        qty: -2,
        unit: 'pc',
        unitCost: 8200,
      },
    ],
  },
  {
    id: 'a_seed2',
    refNo: 'ADJ-2026-0016',
    date: '2026-05-20T17:30:00',
    branch: 'Mirpur Branch',
    type: 'recount',
    reason: 'Quarterly count',
    createdBy: 'Seam',
    lines: [
      {
        productId: 'p7',
        name: 'Iron Nail 2.5"',
        sku: 'FS-NAIL-2.5',
        qty: 4,
        unit: 'kg',
        unitCost: 110,
      },
      {
        productId: 'p13',
        name: 'Wood Screw 1.5" (100pc)',
        sku: 'FS-SCRW-1.5',
        qty: -3,
        unit: 'box',
        unitCost: 130,
      },
    ],
  },
];

const CURRENT_USER = 'u_admin';

/** Build an id→name resolver from the branches store for display mapping. */
function branchIdToName(id: string): string {
  return useBranches.getState().items.find((b) => b.id === id)?.name ?? id;
}

export const useStock = create<State>((set, get) => ({
  movements: [],
  transfers: hasBackend() ? [] : SEED_TRANSFERS,
  adjustments: hasBackend() ? [] : SEED_ADJUSTMENTS,
  loading: false,

  /** Load transfers + adjustments from the backend. No-op without backend. */
  hydrate: async () => {
    if (!hasBackend()) return;
    set({ loading: true });
    try {
      const [transfers, adjustments] = await Promise.all([
        api<BackendTransfer[]>('transfers.list', {}),
        api<BackendAdjustment[]>('adjustments.list', {}),
      ]);
      set({
        // backend rows carry branch IDs — map id→name for display via the store.
        transfers: transfers.map((t) => toTransfer(t, branchIdToName)),
        adjustments: adjustments.map((a) => toAdjustment(a, branchIdToName)),
        loading: false,
      });
    } catch (e: unknown) {
      // Leave the existing arrays untouched; surface the failure to the user.
      toast.error(e instanceof Error ? e.message : 'Failed to load stock operations');
      set({ loading: false });
    }
  },

  addTransfer: (t) => {
    if (hasBackend()) {
      const branches = useBranches.getState().items;
      // Branch NAME -> ID before every write: the backend feeds these straight
      // into recordMovement as the branch key; sending a name would land the
      // movement on a non-existent branch.
      void api('transfers.create', {
        date: t.date,
        fromBranch: resolveBranchId(branches, t.fromBranch),
        toBranch: resolveBranchId(branches, t.toBranch),
        status: t.status,
        notes: t.notes,
        lines: t.lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unit: l.unit,
          unitCost: l.unitCost,
        })),
        createdBy: CURRENT_USER,
      })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to save transfer');
          void get().hydrate();
        });
      return;
    }
    set((s) => ({ transfers: [t, ...s.transfers] }));
  },
  receiveTransfer: (id, receivedLines, note, receivedBy) => {
    if (hasBackend()) {
      void api('transfers.receive', {
        transferId: id,
        received: receivedLines.map((r) => ({ productId: r.productId, receivedQty: r.receivedQty })),
        userId: CURRENT_USER,
        note,
      })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to receive transfer');
          void get().hydrate();
        });
      return;
    }
    set((s) => ({
      transfers: s.transfers.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'received',
              receivedBy: receivedBy ?? 'Seam',
              receivedAt: new Date().toISOString(),
              receiveNote: note,
              lines: t.lines.map((l) => {
                const r = receivedLines.find((x) => x.productId === l.productId);
                return r ? { ...l, receivedQty: r.receivedQty } : { ...l, receivedQty: l.qty };
              }),
            }
          : t,
      ),
    }));
  },
  cancelTransfer: (id) => {
    // DEFERRED: there is NO backend handler to cancel/reverse a transfer. A real
    // cancel would have to reverse the transfer_out (and any transfer_in) stock
    // movements, which only the backend can do safely. Faking a 'cancelled'
    // status here under backend would desync stock (movements stay applied), so
    // we intentionally do nothing destructive and keep this MOCK-ONLY.
    if (hasBackend()) {
      toast.info('Transfer cancel not yet supported with the database');
      return;
    }
    set((s) => ({
      transfers: s.transfers.map((t) => (t.id === id ? { ...t, status: 'cancelled' } : t)),
    }));
  },

  addAdjustment: (a) => {
    if (hasBackend()) {
      const branches = useBranches.getState().items;
      // Branch NAME -> ID before the write (see addTransfer note). qty is signed
      // and passed through unchanged; the backend records the signed movement.
      void api('adjustments.create', {
        date: a.date,
        branchId: resolveBranchId(branches, a.branch),
        type: a.type,
        reason: a.reason,
        lines: a.lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unit: l.unit,
          unitCost: l.unitCost,
        })),
        createdBy: CURRENT_USER,
      })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to save adjustment');
          void get().hydrate();
        });
      return;
    }
    set((s) => ({ adjustments: [a, ...s.adjustments] }));
  },
}));
