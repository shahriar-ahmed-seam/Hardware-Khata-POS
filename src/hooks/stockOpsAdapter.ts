import type {
  StockTransfer,
  TransferLine,
  TransferStatus,
  StockAdjustment,
  AdjustmentLine,
  AdjustmentType,
} from '@/stores/stock';

/**
 * Maps backend stock-ops rows (snake_case, with nested lines) into the frontend
 * StockTransfer / StockAdjustment shapes the Stock pages already consume.
 *
 * IMPORTANT — branch IDs vs names: the backend stores branch IDs (br_mp, …) for
 * from_branch / to_branch / branch_id. The UI renders branch NAMES, so each
 * mapper takes an `idToName` resolver (built from the branches store at the call
 * site) and converts id→name for display. The adapter itself stays pure.
 */

// ----- Transfers -----
interface BackendTransferLine {
  product_id: string;
  name: string | null;
  sku: string | null;
  qty: number;
  unit: string;
  unit_cost: number;
  received_qty: number | null;
}

export interface BackendTransfer {
  id: string;
  ref_no: string;
  date: string;
  from_branch: string;
  to_branch: string;
  status: string;
  notes: string | null;
  created_by: string | null;
  received_by: string | null;
  received_at: string | null;
  receive_note: string | null;
  lines?: BackendTransferLine[];
}

function mapTransferLine(l: BackendTransferLine): TransferLine {
  return {
    productId: l.product_id,
    name: l.name ?? '',
    sku: l.sku ?? '',
    qty: l.qty,
    unit: l.unit,
    unitCost: l.unit_cost,
    receivedQty: l.received_qty ?? undefined,
  };
}

export function toTransfer(b: BackendTransfer, idToName: (id: string) => string): StockTransfer {
  return {
    id: b.id,
    refNo: b.ref_no,
    date: b.date,
    fromBranch: idToName(b.from_branch),
    toBranch: idToName(b.to_branch),
    status: b.status as TransferStatus,
    notes: b.notes ?? undefined,
    createdBy: b.created_by ?? '',
    receivedBy: b.received_by ?? undefined,
    receivedAt: b.received_at ?? undefined,
    receiveNote: b.receive_note ?? undefined,
    lines: (b.lines ?? []).map(mapTransferLine),
  };
}

// ----- Adjustments -----
interface BackendAdjustmentLine {
  product_id: string;
  name: string | null;
  sku: string | null;
  qty: number;
  unit: string;
  unit_cost: number;
}

export interface BackendAdjustment {
  id: string;
  ref_no: string;
  date: string;
  branch_id: string;
  type: string;
  reason: string | null;
  created_by: string | null;
  lines?: BackendAdjustmentLine[];
}

function mapAdjustmentLine(l: BackendAdjustmentLine): AdjustmentLine {
  return {
    productId: l.product_id,
    name: l.name ?? '',
    sku: l.sku ?? '',
    qty: l.qty, // signed — backend stores the signed movement qty unchanged
    unit: l.unit,
    unitCost: l.unit_cost,
  };
}

export function toAdjustment(
  b: BackendAdjustment,
  idToName: (id: string) => string,
): StockAdjustment {
  return {
    id: b.id,
    refNo: b.ref_no,
    date: b.date,
    branch: idToName(b.branch_id),
    type: b.type as AdjustmentType,
    reason: b.reason ?? undefined,
    createdBy: b.created_by ?? '',
    lines: (b.lines ?? []).map(mapAdjustmentLine),
  };
}
