import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { recordMovement, weightedAvgCost } from './stock.ts';
import { logActivity } from './activity.ts';
import { nextRef } from './sequences.ts';

// ---------- Stock transfer ----------
export interface TransferLineInput {
  productId: string;
  qty: number;
  unit?: string;
  unitCost?: number;
}

export interface CreateTransferInput {
  date?: string;
  fromBranch: string;
  toBranch: string;
  status?: 'pending' | 'in-transit' | 'received';
  lines: TransferLineInput[];
  notes?: string;
  createdBy: string;
}

export function createTransfer(db: DB, input: CreateTransferInput) {
  return tx(db, () => {
    const id = newId('trf');
    const date = input.date ?? new Date().toISOString();
    const refNo = nextRef(db, 'transfer');
    const status = input.status ?? 'in-transit';

    db.prepare(
      `INSERT INTO stock_transfers (id, ref_no, date, from_branch, to_branch, status, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?)`,
    ).run(id, refNo, date, input.fromBranch, input.toBranch, status, input.notes ?? null, input.createdBy);

    const lineStmt = db.prepare(
      `INSERT INTO stock_transfer_lines (id, transfer_id, product_id, name, sku, qty, unit, unit_cost, received_qty)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    for (const l of input.lines) {
      const prod = db.prepare('SELECT name, sku FROM products WHERE id = ?').get(l.productId) as
        | { name: string; sku: string }
        | undefined;
      const cost = l.unitCost ?? weightedAvgCost(db, l.productId);
      lineStmt.run(newId('tl'), id, l.productId, prod?.name ?? null, prod?.sku ?? null, l.qty, l.unit ?? 'pc', cost, null);
      // stock leaves the source branch immediately on dispatch
      recordMovement(db, {
        productId: l.productId,
        branchId: input.fromBranch,
        reason: 'transfer_out',
        qty: -l.qty,
        unit: l.unit ?? 'pc',
        unitCost: cost,
        refType: 'transfer',
        refId: id,
        refNo,
        userId: input.createdBy,
        at: date,
      });
    }

    // if created already-received, receive immediately
    if (status === 'received') {
      receiveTransferInternal(db, id, input.createdBy, date);
    }

    logActivity(db, {
      by: input.createdBy,
      branchId: input.fromBranch,
      action: 'transferred',
      entity: 'transfer',
      entityId: id,
      entityRef: refNo,
      message: `Transfer ${input.fromBranch} → ${input.toBranch}`,
      at: date,
    });
    return { id, refNo };
  });
}

function receiveTransferInternal(db: DB, transferId: string, userId: string, at: string) {
  const t = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(transferId) as Record<
    string,
    unknown
  >;
  const lines = db.prepare('SELECT * FROM stock_transfer_lines WHERE transfer_id = ?').all(transferId) as Record<
    string,
    unknown
  >[];
  for (const l of lines) {
    const recQty = (l.received_qty as number | null) ?? (l.qty as number);
    db.prepare('UPDATE stock_transfer_lines SET received_qty = ? WHERE id = ?').run(recQty, l.id);
    recordMovement(db, {
      productId: l.product_id as string,
      branchId: t.to_branch as string,
      reason: 'transfer_in',
      qty: +recQty,
      unit: l.unit as string,
      unitCost: l.unit_cost as number,
      refType: 'transfer',
      refId: transferId,
      refNo: t.ref_no as string,
      userId,
      at,
    });
  }
  db.prepare(
    `UPDATE stock_transfers SET status = 'received', received_by = ?, received_at = ? WHERE id = ?`,
  ).run(userId, at, transferId);
}

export function receiveTransfer(
  db: DB,
  transferId: string,
  received: { productId: string; receivedQty: number }[],
  userId: string,
  note?: string,
) {
  return tx(db, () => {
    // set received quantities first
    for (const r of received) {
      db.prepare(
        'UPDATE stock_transfer_lines SET received_qty = ? WHERE transfer_id = ? AND product_id = ?',
      ).run(r.receivedQty, transferId, r.productId);
    }
    const at = new Date().toISOString();
    receiveTransferInternal(db, transferId, userId, at);
    if (note) db.prepare('UPDATE stock_transfers SET receive_note = ? WHERE id = ?').run(note, transferId);
  });
}

// ---------- Stock adjustment ----------
export type AdjustmentType = 'damage' | 'theft' | 'sample' | 'recount' | 'other';

export interface AdjustmentLineInput {
  productId: string;
  qty: number; // signed
  unit?: string;
  unitCost?: number;
}

export interface CreateAdjustmentInput {
  date?: string;
  branchId: string;
  type: AdjustmentType;
  reason?: string;
  lines: AdjustmentLineInput[];
  createdBy: string;
}

export function createAdjustment(db: DB, input: CreateAdjustmentInput) {
  return tx(db, () => {
    const id = newId('adj');
    const date = input.date ?? new Date().toISOString();
    const refNo = nextRef(db, 'adjustment');
    db.prepare(
      `INSERT INTO stock_adjustments (id, ref_no, date, branch_id, type, reason, created_by) VALUES (?,?,?,?,?,?,?)`,
    ).run(id, refNo, date, input.branchId, input.type, input.reason ?? null, input.createdBy);

    const lineStmt = db.prepare(
      `INSERT INTO stock_adjustment_lines (id, adjustment_id, product_id, name, sku, qty, unit, unit_cost) VALUES (?,?,?,?,?,?,?,?)`,
    );
    const reasonMap: Record<AdjustmentType, string> = {
      damage: 'damage',
      theft: 'theft',
      sample: 'sample',
      recount: 'recount',
      other: 'other',
    };
    for (const l of input.lines) {
      const prod = db.prepare('SELECT name, sku FROM products WHERE id = ?').get(l.productId) as
        | { name: string; sku: string }
        | undefined;
      const cost = l.unitCost ?? weightedAvgCost(db, l.productId);
      lineStmt.run(newId('al'), id, l.productId, prod?.name ?? null, prod?.sku ?? null, l.qty, l.unit ?? 'pc', cost);
      recordMovement(db, {
        productId: l.productId,
        branchId: input.branchId,
        reason: reasonMap[input.type],
        qty: l.qty,
        unit: l.unit ?? 'pc',
        unitCost: cost,
        refType: 'adjustment',
        refId: id,
        refNo,
        userId: input.createdBy,
        at: date,
      });
    }

    logActivity(db, {
      by: input.createdBy,
      branchId: input.branchId,
      action: 'adjusted',
      entity: 'adjustment',
      entityId: id,
      entityRef: refNo,
      message: `${input.type} adjustment`,
      at: date,
    });
    return { id, refNo };
  });
}
