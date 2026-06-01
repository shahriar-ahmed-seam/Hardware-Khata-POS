import type {
  PurchaseRecord,
  PurchaseLine,
  PurchasePayment,
  PurchaseAuditEntry,
} from '@/stores/purchases';

/**
 * Maps a backend purchase (snake_case, with nested lines/payments/audit) into the
 * frontend PurchaseRecord shape that all the purchase components already consume.
 */

interface BackendPurchaseLine {
  product_id: string;
  name: string;
  sku: string;
  qty: number;
  unit: string;
  imei: string | null;
  unit_cost_before_disc: number;
  discount_pct: number;
  discount_flat: number;
  tax_pct: number;
  unit_cost_before_tax: number;
  line_total: number;
  new_sell_price: number | null;
}
interface BackendPayment {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
  paid_at: string;
}
interface BackendAudit {
  id: string;
  at: string;
  by_user: string | null;
  action: string;
  note: string | null;
}
export interface BackendPurchase {
  id: string;
  ref_no: string;
  status: string;
  date: string;
  supplier_id: string | null;
  supplier_name: string | null;
  branch_id: string;
  user_id: string;
  user_name?: string | null;
  pay_terms: string | null;
  subtotal: number;
  total_line_discount: number;
  order_discount_type: string;
  order_discount_value: number;
  order_discount: number;
  tax_pct: number;
  tax: number;
  shipping: number;
  other: number;
  total: number;
  paid: number;
  due: number;
  notes: string | null;
  lines?: BackendPurchaseLine[];
  payments?: BackendPayment[];
  audit?: BackendAudit[];
}

function mapLine(l: BackendPurchaseLine): PurchaseLine {
  return {
    productId: l.product_id,
    name: l.name,
    sku: l.sku,
    qty: l.qty,
    unit: l.unit,
    imei: l.imei ?? undefined,
    unitCostBeforeDisc: l.unit_cost_before_disc,
    discountPct: l.discount_pct,
    discountFlat: l.discount_flat,
    taxPct: l.tax_pct,
    unitCostBeforeTax: l.unit_cost_before_tax,
    lineTotal: l.line_total,
    newSellPrice: l.new_sell_price ?? undefined,
  };
}

export function toPurchaseRecord(b: BackendPurchase): PurchaseRecord {
  return {
    id: b.id,
    refNo: b.ref_no,
    status: b.status as PurchaseRecord['status'],
    date: b.date,
    supplierId: b.supplier_id ?? '',
    supplierName: b.supplier_name ?? '',
    branch: b.branch_id,
    user: b.user_name ?? b.user_id,
    payTerms: b.pay_terms ?? undefined,
    lines: (b.lines ?? []).map(mapLine),
    subtotal: b.subtotal,
    totalLineDiscount: b.total_line_discount,
    orderDiscountType: b.order_discount_type as 'flat' | 'percent',
    orderDiscountValue: b.order_discount_value,
    orderDiscount: b.order_discount,
    taxPct: b.tax_pct,
    tax: b.tax,
    shipping: b.shipping,
    other: b.other,
    total: b.total,
    paid: b.paid,
    due: b.due,
    payments: (b.payments ?? []).map(
      (p): PurchasePayment => ({
        id: p.id,
        method: p.method as PurchasePayment['method'],
        amount: p.amount,
        reference: p.reference ?? undefined,
        paidAt: p.paid_at,
      }),
    ),
    notes: b.notes ?? undefined,
    audit: (b.audit ?? []).map(
      (a): PurchaseAuditEntry => ({
        id: a.id,
        at: a.at,
        by: a.by_user ?? '',
        action: a.action as PurchaseAuditEntry['action'],
        note: a.note ?? undefined,
      }),
    ),
  };
}
