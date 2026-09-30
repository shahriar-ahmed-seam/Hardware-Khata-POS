import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { recordMovement, weightedAvgCost } from './stock.ts';
import { logActivity } from './activity.ts';
import { nextRef } from './sequences.ts';
import { shopBranchId } from './branch.ts';

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
    // A transfer to the SAME branch took the goods out and put them back with a
    // document claiming they had moved.
    if (!input.fromBranch || !input.toBranch || input.fromBranch === input.toBranch) {
      throw new Error('A transfer needs two different branches.');
    }
    if (!input.lines || input.lines.length === 0) {
      throw new Error('A transfer needs at least one item.');
    }
    for (const l of input.lines) {
      if (!Number.isFinite(l.qty) || l.qty <= 0) {
        throw new Error('Each transferred item needs a quantity above zero.');
      }
    }
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
    const t = db.prepare('SELECT ref_no, status FROM stock_transfers WHERE id = ?').get(transferId) as
      | { ref_no: string; status: string }
      | undefined;
    if (!t) throw new Error('Transfer not found');
    /**
     * A transfer is received ONCE. Receiving it again posted every line into the
     * destination a second time — stock out of nowhere — and a cancelled
     * transfer's goods are already back at the source.
     */
    if (t.status === 'received') throw new Error(`${t.ref_no} has already been received.`);
    if (t.status === 'cancelled') throw new Error(`${t.ref_no} was cancelled and cannot be received.`);

    /**
     * What arrived is between nothing and what was sent, per product. More than
     * was sent created stock from nothing; a negative figure removed it. When the
     * same product is on two lines the received figure is filled line by line in
     * order — the update used to key on product and write the WHOLE figure onto
     * every line with that product.
     */
    const lines = db
      .prepare('SELECT id, product_id, name, qty FROM stock_transfer_lines WHERE transfer_id = ? ORDER BY rowid')
      .all(transferId) as { id: string; product_id: string; name: string | null; qty: number }[];
    const sent = new Map<string, number>();
    for (const l of lines) sent.set(l.product_id, (sent.get(l.product_id) ?? 0) + l.qty);
    const got = new Map<string, number>();
    for (const r of received) got.set(r.productId, (got.get(r.productId) ?? 0) + r.receivedQty);
    for (const [productId, qty] of got) {
      const max = sent.get(productId);
      if (max === undefined) throw new Error(`That item is not on ${t.ref_no}.`);
      if (!Number.isFinite(qty) || qty < 0) throw new Error('A received quantity cannot be negative.');
      if (qty > max + 1e-9) {
        const name = lines.find((l) => l.product_id === productId)?.name ?? 'that item';
        throw new Error(`Only ${max} of ${name} were sent on ${t.ref_no}; ${qty} cannot arrive.`);
      }
    }
    const setReceived = db.prepare('UPDATE stock_transfer_lines SET received_qty = ? WHERE id = ?');
    const left = new Map(got);
    for (const l of lines) {
      if (!left.has(l.product_id)) continue; // not reported → the full line arrived
      const take = Math.min(l.qty, left.get(l.product_id) ?? 0);
      setReceived.run(take, l.id);
      left.set(l.product_id, (left.get(l.product_id) ?? 0) - take);
    }

    const at = new Date().toISOString();
    receiveTransferInternal(db, transferId, userId, at);
    if (note) db.prepare('UPDATE stock_transfers SET receive_note = ? WHERE id = ?').run(note, transferId);
  });
}

/**
 * Cancel a transfer that has not arrived — the goods go back to where they left.
 *
 * There was no way to do this, and the screen could only say so: a transfer
 * dispatched by mistake left its stock "in transit" for ever. Dispatch took the
 * stock out of the source with a `transfer_out` movement; cancelling puts
 * exactly that back with an appended `transfer_cancel` movement — nothing is
 * deleted, so `stock = SUM(movements)` still holds and the history shows both.
 * A RECEIVED transfer cannot be cancelled: its goods are at the destination, and
 * moving them back is a new transfer.
 */
export function cancelTransfer(db: DB, transferId: string, userId: string, reason?: string) {
  return tx(db, () => {
    const t = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(transferId) as
      | Record<string, unknown>
      | undefined;
    if (!t) throw new Error('Transfer not found');
    if (t.status === 'cancelled') return { id: transferId };
    if (t.status === 'received') {
      throw new Error(
        `${t.ref_no as string} has already been received. To move the goods back, make a transfer the other way.`,
      );
    }
    const at = new Date().toISOString();
    const out = db
      .prepare(
        `SELECT product_id, qty, unit, unit_cost FROM stock_movements
          WHERE ref_type = 'transfer' AND ref_id = ? AND reason = 'transfer_out'`,
      )
      .all(transferId) as { product_id: string; qty: number; unit: string; unit_cost: number }[];
    for (const m of out) {
      recordMovement(db, {
        productId: m.product_id,
        branchId: t.from_branch as string,
        reason: 'transfer_cancel',
        qty: -m.qty, // the dispatch was negative; this puts it back
        unit: m.unit,
        unitCost: m.unit_cost,
        refType: 'transfer',
        refId: transferId,
        refNo: t.ref_no as string,
        note: reason ? `cancelled: ${reason}` : 'cancelled',
        userId,
        at,
      });
    }
    db.prepare(`UPDATE stock_transfers SET status = 'cancelled', receive_note = ? WHERE id = ?`).run(
      reason ?? null,
      transferId,
    );
    logActivity(db, {
      by: userId,
      branchId: t.from_branch as string,
      action: 'voided',
      entity: 'transfer',
      entityId: transferId,
      entityRef: t.ref_no as string,
      message: `Transfer cancelled — ${reason ?? 'no reason'}`,
      at,
    });
    return { id: transferId };
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
  /** Omitted → the shop's default branch (services/branch.ts). */
  branchId?: string;
  type: AdjustmentType;
  reason?: string;
  lines: AdjustmentLineInput[];
  createdBy: string;
}

export function createAdjustment(db: DB, rawInput: CreateAdjustmentInput) {
  return tx(db, () => {
    const input = { ...rawInput, branchId: shopBranchId(db, rawInput.branchId) };
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
