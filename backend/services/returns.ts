import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { round2, sum2, clampZero } from '../core/money.ts';
import { recordMovement, weightedAvgCost } from './stock.ts';
import { postCashToOpenShift } from './cash.ts';
import { logActivity } from './activity.ts';
import { nextRef } from './sequences.ts';

// ---------- Sell return ----------
export interface SellReturnLineInput {
  productId: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  refundAmount: number;
}

export interface CreateSellReturnInput {
  saleId?: string;
  date?: string;
  customerId?: string;
  branchId: string;
  userId: string;
  reason?: string;
  refundMethod: string; // Cash|Card|bKash|Nagad|Bank|CreditAdjust|StoreCredit
  lines: SellReturnLineInput[];
  notes?: string;
}

export function createSellReturn(db: DB, input: CreateSellReturnInput) {
  return tx(db, () => {
    const id = newId('ret');
    const date = input.date ?? new Date().toISOString();
    const refNo = nextRef(db, 'return');
    const sale = input.saleId
      ? (db.prepare('SELECT invoice_no, customer_id FROM sales WHERE id = ?').get(input.saleId) as
          | { invoice_no: string; customer_id: string | null }
          | undefined)
      : undefined;
    // Inherit the customer from the source sale when not explicitly provided.
    const customerId = input.customerId ?? sale?.customer_id ?? undefined;
    const total = sum2(input.lines.map((l) => l.refundAmount));
    const customerName =
      (db.prepare('SELECT name FROM customers WHERE id = ?').get(customerId ?? '') as
        | { name: string }
        | undefined)?.name ?? 'Walk-in Customer';

    db.prepare(
      `INSERT INTO sell_returns (id, ref_no, sale_id, sale_invoice_no, date, customer_id, branch_id, user_id, reason, refund_method, total, notes, manual)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      refNo,
      input.saleId ?? null,
      sale?.invoice_no ?? null,
      date,
      customerId ?? null,
      input.branchId,
      input.userId,
      input.reason ?? null,
      input.refundMethod,
      total,
      input.notes ?? null,
      input.saleId ? 0 : 1,
    );

    const lineStmt = db.prepare(
      `INSERT INTO sell_return_lines (id, return_id, product_id, name_at_return, sku_at_return, qty, unit, unit_price, unit_cost, refund_amount)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const l of input.lines) {
      const prod = db.prepare('SELECT name, sku FROM products WHERE id = ?').get(l.productId) as
        | { name: string; sku: string }
        | undefined;
      const cost = weightedAvgCost(db, l.productId);
      lineStmt.run(
        newId('rl'),
        id,
        l.productId,
        prod?.name ?? null,
        prod?.sku ?? null,
        l.qty,
        l.unit ?? 'pc',
        l.unitPrice,
        cost,
        round2(l.refundAmount),
      );
      // stock comes back in
      recordMovement(db, {
        productId: l.productId,
        branchId: input.branchId,
        reason: 'sale_return',
        qty: +l.qty,
        unit: l.unit ?? 'pc',
        unitCost: cost,
        refType: 'sale',
        refId: input.saleId ?? id,
        refNo,
        userId: input.userId,
        at: date,
      });
    }

    // refund handling
    if (input.refundMethod === 'Cash') {
      postCashToOpenShift(db, input.branchId, {
        direction: 'out',
        reason: 'refund',
        amount: total,
        refType: 'return',
        refId: id,
        userId: input.userId,
        at: date,
      });
    } else if (input.refundMethod === 'StoreCredit' && customerId) {
      db.prepare('UPDATE customers SET store_credit = store_credit + ? WHERE id = ?').run(
        total,
        customerId,
      );
    }
    // CreditAdjust reduces due implicitly via the ledger calc (return counts against sales)

    // link to sale audit
    if (input.saleId) {
      db.prepare(`INSERT INTO sale_audit (id, sale_id, at, by_user, action, note) VALUES (?,?,?,?,?,?)`).run(
        newId('au'),
        input.saleId,
        date,
        input.userId,
        'returned',
        refNo,
      );
    }
    logActivity(db, {
      by: input.userId,
      branchId: input.branchId,
      action: 'returned',
      entity: 'return',
      entityId: id,
      entityRef: refNo,
      message: `Return processed${sale ? ' for ' + sale.invoice_no : ''}`,
      amount: total,
      at: date,
    });

    return { id, refNo, total };
  });
}

// ---------- Purchase return ----------
export interface PurchaseReturnLineInput {
  productId: string;
  qty: number;
  unit?: string;
  unitCost: number;
  refundAmount: number;
}

export interface CreatePurchaseReturnInput {
  purchaseId?: string;
  date?: string;
  supplierId?: string;
  branchId: string;
  userId: string;
  reason?: string;
  refundMethod: string; // CashRefund|CreditAdjust|Bank|bKash|Nagad
  lines: PurchaseReturnLineInput[];
  notes?: string;
}

export function createPurchaseReturn(db: DB, input: CreatePurchaseReturnInput) {
  return tx(db, () => {
    const id = newId('pret');
    const date = input.date ?? new Date().toISOString();
    const refNo = nextRef(db, 'purchase_return');
    const pur = input.purchaseId
      ? (db.prepare('SELECT ref_no, supplier_name FROM purchases WHERE id = ?').get(input.purchaseId) as
          | { ref_no: string; supplier_name: string }
          | undefined)
      : undefined;
    const total = sum2(input.lines.map((l) => l.refundAmount));

    db.prepare(
      `INSERT INTO purchase_returns (id, ref_no, purchase_id, purchase_ref_no, date, supplier_id, supplier_name, branch_id, user_id, reason, refund_method, total, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      refNo,
      input.purchaseId ?? null,
      pur?.ref_no ?? null,
      date,
      input.supplierId ?? null,
      pur?.supplier_name ?? null,
      input.branchId,
      input.userId,
      input.reason ?? null,
      input.refundMethod,
      total,
      input.notes ?? null,
    );

    const lineStmt = db.prepare(
      `INSERT INTO purchase_return_lines (id, return_id, product_id, name, sku, qty, unit, unit_cost, refund_amount)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    for (const l of input.lines) {
      const prod = db.prepare('SELECT name, sku FROM products WHERE id = ?').get(l.productId) as
        | { name: string; sku: string }
        | undefined;
      lineStmt.run(
        newId('prl'),
        id,
        l.productId,
        prod?.name ?? null,
        prod?.sku ?? null,
        l.qty,
        l.unit ?? 'pc',
        l.unitCost,
        round2(l.refundAmount),
      );
      // stock goes out (returned to supplier)
      recordMovement(db, {
        productId: l.productId,
        branchId: input.branchId,
        reason: 'purchase_return',
        qty: -l.qty,
        unit: l.unit ?? 'pc',
        unitCost: l.unitCost,
        refType: 'purchase',
        refId: input.purchaseId ?? id,
        refNo,
        userId: input.userId,
        at: date,
      });
    }

    if (input.refundMethod === 'CashRefund') {
      // we get cash back from supplier
      postCashToOpenShift(db, input.branchId, {
        direction: 'in',
        reason: 'manual_in',
        amount: total,
        refType: 'purchase_return',
        refId: id,
        userId: input.userId,
        at: date,
      });
    }

    logActivity(db, {
      by: input.userId,
      branchId: input.branchId,
      action: 'returned',
      entity: 'return',
      entityId: id,
      entityRef: refNo,
      message: `Purchase return${pur ? ' for ' + pur.ref_no : ''}`,
      amount: total,
      at: date,
    });
    return { id, refNo, total };
  });
}
