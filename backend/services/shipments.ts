import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { logActivity } from './activity.ts';
import { nextRef } from './sequences.ts';

/**
 * SHIPMENTS — logistics / delivery tracking.
 *
 * A shipment is a pure tracking record that links to a sale and captures
 * delivery info (driver, vehicle, tracking no, address, target/delivered dates,
 * status). Creating or updating a shipment is DELIBERATELY side-effect-free with
 * respect to the accounting/stock world: it NEVER touches stock_movements,
 * cash_movements, COGS, customer/supplier dues, or sale totals. The Shipments
 * page is driven entirely by this table.
 *
 * Statuses: pending | in-transit | delivered | failed.
 */

export interface CreateShipmentInput {
  saleId?: string;
  saleInvoiceNo?: string;
  customerName?: string;
  driver?: string;
  vehicleNo?: string;
  trackingNo?: string;
  status?: string;
  address?: string;
  targetDate?: string;
  notes?: string;
  branchId?: string;
  userId?: string;
}

export function createShipment(db: DB, input: CreateShipmentInput) {
  return tx(db, () => {
    const id = newId('shp');
    const refNo = nextRef(db, 'shipment');

    // When linked to a sale, backfill invoice no + customer name from the sale /
    // its customer if the caller did not pass them explicitly. Pure reads.
    let saleInvoiceNo = input.saleInvoiceNo ?? null;
    let customerName = input.customerName ?? null;
    if (input.saleId) {
      const sale = db
        .prepare('SELECT invoice_no, customer_id FROM sales WHERE id = ?')
        .get(input.saleId) as { invoice_no: string; customer_id: string | null } | undefined;
      if (sale) {
        if (!saleInvoiceNo) saleInvoiceNo = sale.invoice_no;
        if (!customerName) {
          const cust = sale.customer_id
            ? (db.prepare('SELECT name FROM customers WHERE id = ?').get(sale.customer_id) as
                | { name: string }
                | undefined)
            : undefined;
          customerName = cust?.name ?? 'Walk-in Customer';
        }
      }
    }

    const status = input.status ?? 'pending';
    const createdAt = new Date().toISOString();
    // If the shipment is born 'delivered', stamp delivered_at immediately.
    const deliveredAt = status === 'delivered' ? createdAt : null;

    db.prepare(
      `INSERT INTO shipments
         (id, ref_no, sale_id, sale_invoice_no, customer_name, driver, vehicle_no, tracking_no,
          status, address, target_date, delivered_at, notes, branch_id, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      refNo,
      input.saleId ?? null,
      saleInvoiceNo,
      customerName,
      input.driver ?? null,
      input.vehicleNo ?? null,
      input.trackingNo ?? null,
      status,
      input.address ?? null,
      input.targetDate ?? null,
      deliveredAt,
      input.notes ?? null,
      input.branchId ?? null,
      input.userId ?? null,
      createdAt,
    );

    logActivity(db, {
      by: input.userId,
      branchId: input.branchId,
      action: 'shipped',
      entity: 'shipment',
      entityId: id,
      entityRef: refNo,
      message: `Shipment created${saleInvoiceNo ? ' for ' + saleInvoiceNo : ''}`,
      at: createdAt,
    });

    return { id, refNo };
  });
}

export interface UpdateShipmentPatch {
  status?: string;
  driver?: string;
  vehicleNo?: string;
  trackingNo?: string;
  address?: string;
  targetDate?: string;
  notes?: string;
}

export function updateShipment(db: DB, id: string, patch: UpdateShipmentPatch) {
  return tx(db, () => {
    const existing = db.prepare('SELECT * FROM shipments WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) throw new Error('Shipment not found');

    const sets: string[] = [];
    const params: Record<string, unknown> = { id };
    const map: [keyof UpdateShipmentPatch, string][] = [
      ['status', 'status'],
      ['driver', 'driver'],
      ['vehicleNo', 'vehicle_no'],
      ['trackingNo', 'tracking_no'],
      ['address', 'address'],
      ['targetDate', 'target_date'],
      ['notes', 'notes'],
    ];
    for (const [key, col] of map) {
      if (patch[key] !== undefined) {
        sets.push(`${col} = @${col}`);
        params[col] = patch[key];
      }
    }

    // When status flips to 'delivered' and delivered_at isn't set yet, stamp now.
    if (patch.status === 'delivered' && !existing.delivered_at) {
      sets.push('delivered_at = @delivered_at');
      params.delivered_at = new Date().toISOString();
    }

    if (sets.length > 0) {
      db.prepare(`UPDATE shipments SET ${sets.join(', ')} WHERE id = @id`).run(params);
    }

    logActivity(db, {
      by: (existing.created_by as string) ?? undefined,
      branchId: (existing.branch_id as string) ?? undefined,
      action: 'edited',
      entity: 'shipment',
      entityId: id,
      entityRef: existing.ref_no as string,
      message: patch.status ? `Shipment status → ${patch.status}` : 'Shipment updated',
    });

    return { id };
  });
}

/** Hard delete (added for parity/completeness — no stock/cash side effects). */
export function deleteShipment(db: DB, id: string) {
  return tx(db, () => {
    const existing = db.prepare('SELECT ref_no, branch_id, created_by FROM shipments WHERE id = ?').get(id) as
      | { ref_no: string; branch_id: string | null; created_by: string | null }
      | undefined;
    if (!existing) return { id };
    db.prepare('DELETE FROM shipments WHERE id = ?').run(id);
    logActivity(db, {
      by: existing.created_by ?? undefined,
      branchId: existing.branch_id ?? undefined,
      action: 'deleted',
      entity: 'shipment',
      entityId: id,
      entityRef: existing.ref_no,
      message: 'Shipment deleted',
    });
    return { id };
  });
}
