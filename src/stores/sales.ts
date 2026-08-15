import { create } from 'zustand';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast';
import { useBranches } from '@/stores/branches';
import { toSaleRecord, toSellReturnRecord, toShipment, type BackendSale } from '@/hooks/saleAdapter';

/**
 * Resolve a branch value (which may be an id like `br_mp` OR a display name like
 * "Mirpur Branch") into a real backend branch id. Looks the name up in the
 * branches store; falls back to the default/first branch only when truly
 * unresolvable. This prevents the old "any name → br_mp" collapse that would
 * silently mis-post a non-default-branch sale to the default branch.
 */
function resolveBranchToId(branch: string | undefined): string {
  if (branch && branch.startsWith('br_')) return branch; // already an id
  const items = useBranches.getState().items;
  if (branch) {
    const match = items.find((b) => b.name === branch);
    if (match) return match.id;
  }
  const def = items.find((b) => b.isDefault) ?? items[0];
  return def?.id ?? 'br_mp';
}

/**
 * Sale lifecycle status:
 *  final     — completed sale, recorded
 *  draft     — saved but not finalized
 *  quotation — sent to customer, has expiry, can convert to final
 *  void      — voided final sale (kept for audit; reverses stock & dues)
 */
export type SaleStatus = 'final' | 'draft' | 'quotation' | 'void';

export interface SaleLine {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discountPct: number;
  discountFlat: number;
  taxPct: number;
}

export interface SalePayment {
  id: string;
  method: 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank' | 'Credit';
  amount: number;
  reference?: string;
  paidAt: string;
}

export interface SaleAuditEntry {
  id: string;
  at: string;
  by: string;
  action: 'created' | 'edited' | 'voided' | 'paid' | 'returned' | 'shipped';
  note?: string;
}

export interface SaleRecord {
  id: string;
  invoiceNo: string;
  status: SaleStatus;
  date: string;
  customerId: string;
  customerName: string;
  branch: string;
  user: string;
  lines: SaleLine[];
  // Money breakdown
  subtotal: number;
  totalLineDiscount: number;
  orderDiscountPct: number;
  orderDiscountFlat: number;
  orderDiscount: number;
  taxPct: number;
  tax: number;
  shipping: number;
  other: number;
  total: number;
  paid: number;
  due: number;
  // Payments
  payments: SalePayment[];
  // Quotations
  validUntil?: string;
  // Notes
  notes?: string;
  // Audit
  audit: SaleAuditEntry[];
  // Profit (would be computed from cost-at-sale; mock value here)
  profit?: number;
  // Linkage
  returnIds?: string[];
  shipmentId?: string;
  sourceQuotationId?: string;
}

// Sell Return
export interface ReturnLine {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unit: string;
  unitPrice: number;
  refundAmount: number;
}

export interface SellReturn {
  id: string;
  refNo: string;
  saleId: string;
  saleInvoiceNo: string;
  date: string;
  customerId: string;
  customerName: string;
  user: string;
  reason?: 'damaged' | 'wrong-item' | 'changed-mind' | 'defective' | 'warranty' | 'other';
  refundMethod: 'Cash' | 'Card' | 'bKash' | 'Nagad' | 'Bank' | 'CreditAdjust' | 'StoreCredit';
  lines: ReturnLine[];
  total: number;
  notes?: string;
  manual?: boolean; // true when no source invoice
}

// Shipment
export type ShipmentStatus = 'pending' | 'in-transit' | 'delivered' | 'failed';
export interface Shipment {
  id: string;
  refNo: string;
  saleId: string;
  saleInvoiceNo: string;
  customerName: string;
  driver?: string;
  vehicleNo?: string;
  trackingNo?: string;
  status: ShipmentStatus;
  address: string;
  targetDate?: string;
  deliveredAt?: string;
  notes?: string;
  createdAt: string;
}

interface SalesState {
  sales: SaleRecord[];
  returns: SellReturn[];
  shipments: Shipment[];
  loading: boolean;
  /** Total rows matching the CURRENT query (not the number loaded). */
  total: number;
  /** The query that produced `sales` — re-run by `hydrate()` after any write. */
  query: SalesQuery;
  /**
   * Load ONE page of sales. All filtering happens in SQL, so the renderer never
   * holds more than `pageSize` rows.
   */
  loadPage: (patch?: Partial<SalesQuery>) => Promise<void>;
  /** Re-run the last query (used after a write). Also refreshes returns/shipments. */
  hydrate: () => Promise<void>;
  // Sales CRUD
  addSale: (s: SaleRecord) => void;
  /**
   * Correct an existing sale IN PLACE via `sales.update`, keeping its invoice
   * number. `reason` is mandatory — it is written to the sale's audit trail.
   * Resolves true on success so the caller can navigate only when it worked.
   */
  updateSale: (id: string, next: SaleRecord, reason: string) => Promise<boolean>;
  voidSale: (id: string, by: string, reason?: string) => void;
  deleteSale: (id: string) => void; // only for drafts/quotations
  addPayment: (saleId: string, p: Omit<SalePayment, 'id'>) => void;
  // Returns
  addReturn: (r: SellReturn) => void;
  // Shipments
  addShipment: (s: Shipment) => void;
  updateShipment: (id: string, patch: Partial<Shipment>) => void;
}

const CURRENT_USER = 'u_admin';

/** Server-side query for the sales list. Mirrors `PageQuery` in backend/services/paged.ts. */
export interface SalesQuery {
  page: number;
  pageSize: number;
  /** Which lifecycle statuses this screen shows (Sales vs Drafts vs Quotations). */
  statuses: SaleStatus[];
  customerId?: string;
  userId?: string;
  method?: string;
  /**
   * Settlement state, filtered IN SQL.
   *
   * This used to be a client-side filter over the rows of the loaded page, which
   * meant "Due" showed only the unpaid invoices among the newest 50 and reported
   * "no sales match" whenever the unpaid ones were further back. See
   * `PageQuery.payment` in backend/services/paged.ts.
   */
  payment?: 'paid' | 'partial' | 'due';
  from?: string;
  to?: string;
  q?: string;
}

interface SalesPageResponse {
  rows: BackendSale[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_SALES_QUERY: SalesQuery = {
  page: 1,
  pageSize: 50,
  // Voided sales are excluded by default; the Sales screen has a toggle that adds
  // them back. Drafts and Quotations set their own statuses.
  statuses: ['final'],
};

/** Guards against out-of-order responses when the user types or pages quickly. */
let salesRequestToken = 0;

let invoiceCounter = 0;
let draftCounter = 100;
let quoteCounter = 100;
let returnCounter = 100;
let shipmentCounter = 100;

export function nextInvoiceNo(status: SaleStatus = 'final') {
  const year = new Date().getFullYear();
  if (status === 'draft') {
    draftCounter += 1;
    return `DRF-${year}-${String(draftCounter).padStart(4, '0')}`;
  }
  if (status === 'quotation') {
    quoteCounter += 1;
    return `QTN-${year}-${String(quoteCounter).padStart(4, '0')}`;
  }
  invoiceCounter += 1;
  return `INV-${year}-${String(invoiceCounter + 600).padStart(4, '0')}`;
}

export function nextReturnNo() {
  returnCounter += 1;
  return `RTN-${new Date().getFullYear()}-${String(returnCounter).padStart(4, '0')}`;
}

export function nextShipmentNo() {
  shipmentCounter += 1;
  return `SHP-${new Date().getFullYear()}-${String(shipmentCounter).padStart(4, '0')}`;
}

export const useSales = create<SalesState>((set, get) => ({
  sales: [],
  returns: [],
  // Backed by the `shipments` table.
  shipments: [],
  loading: false,
  total: 0,
  query: { ...DEFAULT_SALES_QUERY },

  /**
   * PERFORMANCE — this replaced an N+1 that froze the app.
   *
   * The old `hydrate()` fetched EVERY sale and then made one `sales.get` IPC
   * call per row (3,000+ synchronous SQLite hits on the main process). Now a
   * single `sales.listPage` call returns one page with lines/payments/audit
   * already attached, plus the total for the pager — about five queries no
   * matter how much history the shop has.
   */
  loadPage: async (patch) => {
    const query: SalesQuery = { ...get().query, ...patch };
    // Any filter change resets to page 1 — staying on page 9 of a narrower
    // result set would show an empty table.
    if (patch && Object.keys(patch).some((k) => k !== 'page')) query.page = patch.page ?? 1;

    set({ loading: true, query });
    const token = ++salesRequestToken;
    try {
      const res = await api<SalesPageResponse>('sales.listPage', {
        page: query.page,
        pageSize: query.pageSize,
        statuses: query.statuses,
        customerId: query.customerId === 'all' ? undefined : query.customerId,
        userId: query.userId === 'all' ? undefined : query.userId,
        method: query.method === 'all' ? undefined : query.method,
        payment: query.payment,
        from: query.from,
        to: query.to,
        q: query.q?.trim() || undefined,
      });
      // Drop a stale response so fast typing/paging can't overwrite newer rows.
      if (token !== salesRequestToken) return;
      set({ sales: res.rows.map(toSaleRecord), total: res.total, loading: false });
    } catch (e: unknown) {
      if (token !== salesRequestToken) return;
      toast.error(e instanceof Error ? e.message : 'Failed to load sales');
      set({ loading: false });
    }
  },

  /**
   * Re-run the current page query, and refresh the (small) returns + shipments
   * lists. Called after every write.
   */
  hydrate: async () => {
    await get().loadPage();
    try {
      const [returns, shipments] = await Promise.all([
        api<Parameters<typeof toSellReturnRecord>[0][]>('sellReturns.list', {}),
        api<Parameters<typeof toShipment>[0][]>('shipments.list', {}),
      ]);
      set({
        returns: returns.map(toSellReturnRecord),
        shipments: shipments.map(toShipment),
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load returns/shipments');
    }
  },

  addSale: (s) => {
    {
      // Resolve branch name -> id via the branches store (AddSale still uses
      // branch names); falls back to the default branch only if unresolvable.
      const branchId = resolveBranchToId(s.branch);
      // Only pass a customerId when it looks like a real backend id; a
      // walk-in/unsaved selection must persist as "no customer".
      const customerId = s.customerId?.startsWith('cu_') ? s.customerId : undefined;
      void api('sales.create', {
        status: s.status,
        date: s.date,
        customerId,
        branchId,
        userId: CURRENT_USER,
        lines: s.lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitUsed: l.unit,
          spr: l.unitPrice,
          discountPct: l.discountPct,
          discountFlat: l.discountFlat,
          taxPct: l.taxPct,
        })),
        orderDiscountPct: s.orderDiscountPct,
        orderDiscountFlat: s.orderDiscountFlat,
        taxPct: s.taxPct,
        shipping: s.shipping,
        other: s.other,
        payments: s.payments.map((pay) => ({
          method: pay.method,
          amount: pay.amount,
          reference: pay.reference,
          paidAt: pay.paidAt,
        })),
        validUntil: s.validUntil,
        notes: s.notes,
      })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to save sale');
          void get().hydrate();
        });
    }
  },
  /**
   * Edit an existing sale through the backend.
   *
   * This used to patch only the local copy, with a note saying no `sales.update`
   * channel existed. It does now: `updateSale` in backend/services/sales.ts
   * reverses the original stock and cash and re-applies the corrected figures in
   * one transaction, keeping the invoice number. So the ONLY thing to do here is
   * send it and re-hydrate from the database — never mutate the local list, or
   * the screen would show numbers the database does not agree with.
   *
   * `sales.update` is gated behind the `sales.edit` permission at the IPC
   * boundary, so a cashier's attempt fails with a permission error and the
   * caller surfaces it.
   */
  updateSale: async (id, next, reason) => {
    const branchId = resolveBranchToId(next.branch);
    const customerId = next.customerId?.startsWith('cu_') ? next.customerId : undefined;
    try {
      await api('sales.update', {
        saleId: id,
        input: {
          status: next.status,
          date: next.date,
          customerId,
          branchId,
          userId: CURRENT_USER,
          lines: next.lines.map((l) => ({
            productId: l.productId,
            qty: l.qty,
            unitUsed: l.unit,
            spr: l.unitPrice,
            discountPct: l.discountPct,
            discountFlat: l.discountFlat,
            taxPct: l.taxPct,
          })),
          orderDiscountPct: next.orderDiscountPct,
          orderDiscountFlat: next.orderDiscountFlat,
          taxPct: next.taxPct,
          shipping: next.shipping,
          other: next.other,
          // Payments already recorded against the invoice are preserved as-is;
          // the edit is about what was sold and for how much.
          payments: next.payments.map((pay) => ({
            method: pay.method,
            amount: pay.amount,
            reference: pay.reference,
            paidAt: pay.paidAt,
          })),
          validUntil: next.validUntil,
          notes: next.notes,
          reason,
        },
      });
      await get().hydrate();
      return true;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save the correction');
      await get().hydrate();
      return false;
    }
  },
  voidSale: (id, _by, reason) => {
    void api('sales.void', { saleId: id, userId: CURRENT_USER, reason })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to void sale');
        void get().hydrate();
      });
  },
  // Only drafts/quotations are deletable — the backend enforces that rule (a
  // final sale must be voided instead, so stock and dues are reversed).
  deleteSale: (id) => {
    void api('sales.delete', { saleId: id })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to delete sale');
        void get().hydrate();
      });
  },
  addPayment: (saleId, p) => {
    void api('sales.addPayment', {
      saleId,
      payment: { method: p.method, amount: p.amount, reference: p.reference, paidAt: p.paidAt },
      userId: CURRENT_USER,
    })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to record payment');
        void get().hydrate();
      });
  },
  addReturn: (r) => {
    void api('sellReturns.create', {
      saleId: r.saleId || undefined,
      customerId: r.customerId?.startsWith('cu_') ? r.customerId : undefined,
      branchId: 'br_mp',
      userId: CURRENT_USER,
      reason: r.reason,
      refundMethod: r.refundMethod,
      lines: r.lines.map((l) => ({
        productId: l.productId,
        qty: l.qty,
        unit: l.unit,
        unitPrice: l.unitPrice,
        refundAmount: l.refundAmount,
      })),
      notes: r.notes,
    })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to save return');
        void get().hydrate();
      });
  },
  // ----- Shipments (logistics tracking) -----
  // Backed by the `shipments` table + service under Electron. A shipment is a
  // pure tracking record: creating/updating it NEVER touches stock, cash, COGS,
  // or due (enforced in backend/services/shipments.ts).
  //
  // NOTE: the sale's `shipmentId` field is NOT persisted to a sales column. The
  // Shipments list is driven entirely by the shipments table (via hydrate), so
  // under backend we do NOT mutate the sale locally and just rehydrate. The
  // SaleDetail "Create Shipment" button guard (`!sale.shipmentId`) stays as a
  // soft client-side hint only (it won't reflect server state after rehydrate).
  addShipment: (s) => {
    void api('shipments.create', {
      saleId: s.saleId || undefined,
      saleInvoiceNo: s.saleInvoiceNo || undefined,
      customerName: s.customerName || undefined,
      driver: s.driver,
      vehicleNo: s.vehicleNo,
      trackingNo: s.trackingNo,
      status: s.status,
      address: s.address,
      targetDate: s.targetDate,
      notes: s.notes,
      branchId: 'br_mp',
      userId: CURRENT_USER,
    })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to save shipment');
        void get().hydrate();
      });
  },
  updateShipment: (id, patch) => {
    void api('shipments.update', {
      id,
      patch: {
        status: patch.status,
        driver: patch.driver,
        vehicleNo: patch.vehicleNo,
        trackingNo: patch.trackingNo,
        address: patch.address,
        targetDate: patch.targetDate,
        notes: patch.notes,
      },
    })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to update shipment');
        void get().hydrate();
      });
  },
}));
