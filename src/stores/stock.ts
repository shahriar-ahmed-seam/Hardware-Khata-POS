import { create } from 'zustand';
import { api } from '@/lib/api';
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

const CURRENT_USER = 'u_admin';

/** Build an id→name resolver from the branches store for display mapping. */
function branchIdToName(id: string): string {
  return useBranches.getState().items.find((b) => b.id === id)?.name ?? id;
}

export const useStock = create<State>((set, get) => ({
  movements: [],
  transfers: [],
  adjustments: [],
  loading: false,

  /** Load transfers + adjustments from the backend. */
  hydrate: async () => {
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
  },
  receiveTransfer: (id, receivedLines, note) => {
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
  },
  cancelTransfer: () => {
    // DEFERRED: there is NO backend handler to cancel/reverse a transfer. A real
    // cancel would have to reverse the transfer_out (and any transfer_in) stock
    // movements, which only the backend can do safely. Flipping the status here
    // would desync stock (movements stay applied), so we do nothing destructive.
    toast.info('Transfer cancel not yet supported with the database');
  },

  addAdjustment: (a) => {
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
  },
}));
