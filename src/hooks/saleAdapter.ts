import type {
  SaleRecord,
  SaleLine,
  SalePayment,
  SaleAuditEntry,
  SellReturn,
  Shipment,
  ShipmentStatus,
} from '@/stores/sales';

/**
 * Maps a backend sale (snake_case, with nested lines/payments/audit) into the
 * frontend SaleRecord shape that all the sale components already consume.
 * Mirrors purchaseAdapter.ts precisely.
 *
 * Read shapes come from backend/services/queries.ts (getSale + listSales). The
 * list query aliases customer_name / user_name; the detail query nests
 * lines / payments / audit.
 */

interface BackendSaleLine {
  product_id: string;
  name_at_sale: string;
  sku_at_sale: string;
  qty: number;
  unit_used: string;
  unit_price: number;
  discount_pct: number;
  discount_flat: number;
  tax_pct: number;
}
interface BackendSalePayment {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
  paid_at: string;
}
interface BackendSaleAudit {
  id: string;
  at: string;
  by_user: string | null;
  action: string;
  note: string | null;
}
export interface BackendSale {
  id: string;
  invoice_no: string;
  status: string;
  date: string;
  customer_id: string | null;
  customer_name?: string | null;
  branch_id: string;
  user_id: string;
  user_name?: string | null;
  subtotal: number;
  total_line_discount: number;
  order_discount_pct: number;
  order_discount_flat: number;
  order_discount: number;
  tax_pct: number;
  tax: number;
  shipping: number;
  other: number;
  total: number;
  paid: number;
  due: number;
  profit?: number | null;
  valid_until: string | null;
  source_quotation_id?: string | null;
  notes: string | null;
  lines?: BackendSaleLine[];
  payments?: BackendSalePayment[];
  audit?: BackendSaleAudit[];
}

function mapLine(l: BackendSaleLine): SaleLine {
  return {
    productId: l.product_id,
    name: l.name_at_sale,
    sku: l.sku_at_sale,
    qty: l.qty,
    unit: l.unit_used,
    unitPrice: l.unit_price,
    discountPct: l.discount_pct,
    discountFlat: l.discount_flat,
    taxPct: l.tax_pct,
  };
}

export function toSaleRecord(b: BackendSale): SaleRecord {
  return {
    id: b.id,
    invoiceNo: b.invoice_no,
    status: b.status as SaleRecord['status'],
    date: b.date,
    customerId: b.customer_id ?? '',
    customerName: b.customer_name ?? 'Walk-in Customer',
    branch: b.branch_id,
    user: b.user_name ?? b.user_id,
    lines: (b.lines ?? []).map(mapLine),
    subtotal: b.subtotal,
    totalLineDiscount: b.total_line_discount,
    orderDiscountPct: b.order_discount_pct,
    orderDiscountFlat: b.order_discount_flat,
    orderDiscount: b.order_discount,
    taxPct: b.tax_pct,
    tax: b.tax,
    shipping: b.shipping,
    other: b.other,
    total: b.total,
    paid: b.paid,
    due: b.due,
    payments: (b.payments ?? []).map(
      (p): SalePayment => ({
        id: p.id,
        method: p.method as SalePayment['method'],
        amount: p.amount,
        reference: p.reference ?? undefined,
        paidAt: p.paid_at,
      }),
    ),
    validUntil: b.valid_until ?? undefined,
    notes: b.notes ?? undefined,
    audit: (b.audit ?? []).map(
      (a): SaleAuditEntry => ({
        id: a.id,
        at: a.at,
        by: a.by_user ?? '',
        action: a.action as SaleAuditEntry['action'],
        note: a.note ?? undefined,
      }),
    ),
    profit: b.profit ?? undefined,
    sourceQuotationId: b.source_quotation_id ?? undefined,
  };
}

// ---- Sell return (list rows only) ----
interface BackendSellReturn {
  id: string;
  ref_no: string;
  sale_id: string | null;
  sale_invoice_no: string | null;
  date: string;
  customer_id: string | null;
  branch_id: string | null;
  user_id: string | null;
  reason: string | null;
  refund_method: string;
  total: number;
  notes: string | null;
  manual: number;
}

/**
 * Maps a `sellReturns.list` row (header only) into the SellReturn shape.
 * NOTE (deferred): the list query returns no nested return lines, so `lines`
 * is left empty. The Sell Returns list page only renders header fields, so this
 * is fine — full detail-line wiring is deferred (mirrors PurchaseReturns).
 */
export function toSellReturnRecord(b: BackendSellReturn): SellReturn {
  return {
    id: b.id,
    refNo: b.ref_no,
    saleId: b.sale_id ?? '',
    saleInvoiceNo: b.sale_invoice_no ?? '',
    date: b.date,
    customerId: b.customer_id ?? '',
    customerName: 'Walk-in Customer',
    user: b.user_id ?? '',
    reason: (b.reason ?? undefined) as SellReturn['reason'],
    refundMethod: b.refund_method as SellReturn['refundMethod'],
    lines: [],
    total: b.total,
    notes: b.notes ?? undefined,
    manual: !!b.manual,
  };
}

// ---- Shipment (logistics tracking) ----
interface BackendShipment {
  id: string;
  ref_no: string;
  sale_id: string | null;
  sale_invoice_no: string | null;
  customer_name: string | null;
  driver: string | null;
  vehicle_no: string | null;
  tracking_no: string | null;
  status: string;
  address: string | null;
  target_date: string | null;
  delivered_at: string | null;
  notes: string | null;
  branch_id?: string | null;
  created_by?: string | null;
  created_at: string;
}

/** Maps a `shipments.list` row (snake_case) into the frontend Shipment shape. */
export function toShipment(b: BackendShipment): Shipment {
  return {
    id: b.id,
    refNo: b.ref_no,
    saleId: b.sale_id ?? '',
    saleInvoiceNo: b.sale_invoice_no ?? '',
    customerName: b.customer_name ?? 'Walk-in Customer',
    driver: b.driver ?? undefined,
    vehicleNo: b.vehicle_no ?? undefined,
    trackingNo: b.tracking_no ?? undefined,
    status: b.status as ShipmentStatus,
    address: b.address ?? '',
    targetDate: b.target_date ?? undefined,
    deliveredAt: b.delivered_at ?? undefined,
    notes: b.notes ?? undefined,
    createdAt: b.created_at,
  };
}
