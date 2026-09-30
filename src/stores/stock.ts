import { create } from 'zustand';
import { currentUserId } from '@/lib/actor';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast';
import { branchNameOf, requireBranchId } from '@/lib/branch';
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
  | 'transfer_cancel'
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
  // Each write resolves true only once the backend accepted it.
  addTransfer: (t: StockTransfer) => Promise<boolean>;
  receiveTransfer: (
    id: string,
    receivedLines: { productId: string; receivedQty: number }[],
    note?: string,
    receivedBy?: string,
  ) => Promise<boolean>;
  cancelTransfer: (id: string, reason?: string) => Promise<boolean>;
  addAdjustment: (a: StockAdjustment) => Promise<boolean>;
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


/** Build an id→name resolver from the branches store for display mapping. */
const branchIdToName = branchNameOf;

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

  addTransfer: async (t) => {
    // Branch NAME -> ID before every write: the backend feeds these straight
    // into recordMovement as the branch key; sending a name would land the
    // movement on a non-existent branch.
    //
    // This used to call the REPORT-FILTER resolver, whose contract is "'' means
    // all branches" — so it returns `undefined`, and an unresolvable branch here
    // wrote a transfer with a null branch id: stock left nowhere and arrived
    // nowhere. `requireBranchId` throws instead, and we refuse the write.
    let fromBranch: string;
    let toBranch: string;
    try {
      fromBranch = requireBranchId(t.fromBranch);
      toBranch = requireBranchId(t.toBranch);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No branch is available yet');
      return false;
    }
    return settleStock(get, api('transfers.create', {
      date: t.date,
      fromBranch,
      toBranch,
      status: t.status,
      notes: t.notes,
      lines: t.lines.map((l) => ({
        productId: l.productId,
        qty: l.qty,
        unit: l.unit,
        unitCost: l.unitCost,
      })),
      createdBy: currentUserId(),
    }), 'Failed to save transfer');
  },
  receiveTransfer: (id, receivedLines, note) =>
    settleStock(
      get,
      api('transfers.receive', {
        transferId: id,
        received: receivedLines.map((r) => ({ productId: r.productId, receivedQty: r.receivedQty })),
        userId: currentUserId(),
        note,
      }),
      'Failed to receive transfer',
    ),
  // The backend puts the dispatched goods back at the source with appended
  // movements; a received transfer is refused there (its goods have arrived).
  cancelTransfer: async (id, reason) => {
    const ok = await settleStock(
      get,
      api('transfers.cancel', { transferId: id, userId: currentUserId(), reason }),
      'Failed to cancel transfer',
    );
    if (ok) toast.success('Transfer cancelled — the goods are back at the sending branch');
    return ok;
  },
  addAdjustment: async (a) => {
    // Branch NAME -> ID before the write (see addTransfer note). qty is signed
    // and passed through unchanged; the backend records the signed movement.
    let branchId: string;
    try {
      branchId = requireBranchId(a.branch);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No branch is available yet');
      return false;
    }
    return settleStock(get, api('adjustments.create', {
      date: a.date,
      branchId,
      type: a.type,
      reason: a.reason,
      lines: a.lines.map((l) => ({
        productId: l.productId,
        qty: l.qty,
        unit: l.unit,
        unitCost: l.unitCost,
      })),
      createdBy: currentUserId(),
    }), 'Failed to save adjustment');
  },
}));

/** Wait for a stock write, then re-read either way. True only when accepted. */
async function settleStock(
  get: () => { hydrate: () => Promise<void> },
  write: Promise<unknown>,
  failure: string,
): Promise<boolean> {
  try {
    await write;
    void get().hydrate();
    return true;
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : failure);
    void get().hydrate();
    return false;
  }
}
