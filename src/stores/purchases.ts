import { create } from 'zustand';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast';
import { toPurchaseRecord, type BackendPurchase } from '@/hooks/purchaseAdapter';
import { requireBranchId } from '@/lib/branch';
import { markupOnCostPct, purchaseLine, purchaseTotals } from '@/lib/money';

/**
 * Purchases store. Backend-only: the list is loaded through `hydrate` and every
 * write persists via the IPC api, then rehydrates.
 */

/** Branch id / display name → backend branch id. See `src/lib/branch.ts`. */
const resolveBranchToId = requireBranchId;

export type PurchaseStatus = 'received' | 'ordered' | 'in-transit' | 'cancelled';

export interface PurchaseLine {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unit: string;
  imei?: string; // serial / IMEI for serialized items
  unitCostBeforeDisc: number;
  discountPct: number;
  discountFlat: number;
  taxPct: number; // line tax %
  // Computed at save time but kept for fast reads:
  unitCostBeforeTax: number; // = unitCostBeforeDisc × (1 - discountPct/100) - discountFlat
  lineTotal: number; // = unitCostBeforeTax × qty × (1 + taxPct/100)
  // For sell-price update prompt
  newSellPrice?: number; // optional override of product sell price after this purchase
  marginPct?: number; // computed view: (newSellPrice - unitCostBeforeTax) / unitCostBeforeTax * 100
}

export type PaymentMethod = 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Bank' | 'Cheque';

export interface PurchasePayment {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  paidAt: string;
}

export interface PurchaseAuditEntry {
  id: string;
  at: string;
  by: string;
  action: 'created' | 'edited' | 'cancelled' | 'paid' | 'returned';
  note?: string;
}

export interface PurchaseRecord {
  id: string;
  refNo: string;
  status: PurchaseStatus;
  date: string;
  supplierId: string;
  supplierName: string;
  supplierAddress?: string;
  branch: string;
  user: string;
  payTerms?: string;
  attachmentName?: string; // client-side only — file uploads are not persisted yet
  lines: PurchaseLine[];
  // Money breakdown
  subtotal: number;
  totalLineDiscount: number;
  orderDiscountType: 'flat' | 'percent';
  orderDiscountValue: number;
  orderDiscount: number;
  taxPct: number; // order-level purchase tax %
  tax: number;
  shipping: number;
  shippingDetails?: string;
  other: number;
  total: number;
  paid: number;
  due: number;
  payments: PurchasePayment[];
  notes?: string;
  audit: PurchaseAuditEntry[];
  // Linkage
  returnIds?: string[];
}

// ---- Returns ----
export type ReturnRefundMethod = 'CashRefund' | 'CreditAdjust' | 'Bank' | 'bKash' | 'Nagad';
export type ReturnReason = 'damaged' | 'wrong-item' | 'expired' | 'short-shipped' | 'other';

export interface PurchaseReturnLine {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unit: string;
  unitCost: number;
  refundAmount: number;
}

export interface PurchaseReturn {
  id: string;
  refNo: string;
  purchaseId: string;
  purchaseRefNo: string;
  date: string;
  supplierId: string;
  supplierName: string;
  user: string;
  reason?: ReturnReason;
  refundMethod: ReturnRefundMethod;
  lines: PurchaseReturnLine[];
  total: number;
  notes?: string;
}

// ---- Helpers ----
/**
 * Preview a purchase line exactly as the backend will store it.
 *
 * Delegates to `src/lib/money.ts` (which mirrors `computePurchaseLine`) rather
 * than repeating the arithmetic. The old copy here had the right ORDER and the
 * right clamp but no rounding, and the backend rounds the unit cost BEFORE
 * multiplying by quantity — so a line of 100 units at 99.99 less 12.5% showed a
 * net cost of 87.49 and a line total of 8,749.13, which do not agree with each
 * other and are ৳0.13 above the bill that actually gets saved. That drift
 * accumulated across lines into the total the buyer approved.
 */
export function recomputeLine(l: PurchaseLine): PurchaseLine {
  const { unitCostBeforeTax, lineTotal } = purchaseLine(l);
  let marginPct: number | undefined;
  // Left undefined (renders '—') rather than 0 when there is no new sell price
  // or no cost to compare against: "0% margin" would be a claim, not a blank.
  if (l.newSellPrice && unitCostBeforeTax > 0) {
    marginPct = markupOnCostPct(l.newSellPrice, unitCostBeforeTax);
  }
  return { ...l, unitCostBeforeTax, lineTotal, marginPct };
}

export interface PurchaseTotals {
  subtotal: number;
  totalLineDiscount: number;
  orderDiscount: number;
  taxableBase: number;
  tax: number;
  shipping: number;
  other: number;
  total: number;
}

/** Mirrors `computePurchaseTotals` via src/lib/money.ts — see `recomputeLine`. */
export function computeTotals(p: {
  lines: PurchaseLine[];
  orderDiscountType: 'flat' | 'percent';
  orderDiscountValue: number;
  taxPct: number;
  shipping: number;
  other: number;
}): PurchaseTotals {
  return purchaseTotals({
    lines: p.lines,
    orderDiscountType: p.orderDiscountType,
    orderDiscountValue: p.orderDiscountValue,
    taxPct: p.taxPct,
    shipping: p.shipping,
    other: p.other,
  });
}

// ---- Counters ----
let purchaseCounter = 42;
let returnCounter = 100;

export function nextPurchaseRef() {
  purchaseCounter += 1;
  return `PO-${new Date().getFullYear()}-${String(purchaseCounter).padStart(4, '0')}`;
}
export function nextPurchaseReturnRef() {
  returnCounter += 1;
  return `PRTN-${new Date().getFullYear()}-${String(returnCounter).padStart(4, '0')}`;
}

/** Server-side query for the purchases list. Mirrors `PageQuery` in backend/services/paged.ts. */
export interface PurchasesQuery {
  page: number;
  pageSize: number;
  statuses?: PurchaseStatus[];
  supplierId?: string;
  /**
   * Settlement state, filtered IN SQL — see `PageQuery.payment` in
   * backend/services/paged.ts. It was a client-side filter over the loaded page,
   * so "Due" only ever found the unpaid bills among the newest 50.
   */
  payment?: 'paid' | 'partial' | 'due';
  from?: string;
  to?: string;
  q?: string;
}

interface PurchasesPageResponse {
  rows: BackendPurchase[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_PURCHASES_QUERY: PurchasesQuery = { page: 1, pageSize: 50 };

/** Guards against out-of-order responses when the user types or pages quickly. */
let purchasesRequestToken = 0;

interface State {
  purchases: PurchaseRecord[];
  returns: PurchaseReturn[];
  loading: boolean;
  /** Total rows matching the CURRENT query (not the number loaded). */
  total: number;
  query: PurchasesQuery;
  /** Load ONE page; all filtering happens in SQL. */
  loadPage: (patch?: Partial<PurchasesQuery>) => Promise<void>;
  hydrate: () => Promise<void>;
  addPurchase: (p: PurchaseRecord) => Promise<string>;
  updatePurchase: (id: string, patch: Partial<PurchaseRecord>) => void;
  cancelPurchase: (id: string, by: string, reason?: string) => void;
  deletePurchase: (id: string) => void;
  addPayment: (purchaseId: string, p: Omit<PurchasePayment, 'id'>) => void;
  addReturn: (r: PurchaseReturn) => void;
}

const CURRENT_USER = 'u_admin';

export const usePurchases = create<State>((set, get) => ({
  purchases: [],
  returns: [],
  loading: false,
  total: 0,
  query: { ...DEFAULT_PURCHASES_QUERY },

  /**
   * PERFORMANCE — this replaced an N+1 that froze the app.
   *
   * The old `hydrate()` fetched EVERY purchase then made one `purchases.get`
   * IPC call per row. Now a single `purchases.listPage` call returns one page
   * with lines/payments/audit attached, plus the total for the pager.
   */
  loadPage: async (patch) => {
    const query: PurchasesQuery = { ...get().query, ...patch };
    if (patch && Object.keys(patch).some((k) => k !== 'page')) query.page = patch.page ?? 1;

    set({ loading: true, query });
    const token = ++purchasesRequestToken;
    try {
      const res = await api<PurchasesPageResponse>('purchases.listPage', {
        page: query.page,
        pageSize: query.pageSize,
        statuses: query.statuses,
        supplierId: query.supplierId === 'all' ? undefined : query.supplierId,
        payment: query.payment,
        from: query.from,
        to: query.to,
        q: query.q?.trim() || undefined,
      });
      if (token !== purchasesRequestToken) return;
      set({ purchases: res.rows.map(toPurchaseRecord), total: res.total, loading: false });
    } catch (e: unknown) {
      if (token !== purchasesRequestToken) return;
      toast.error(e instanceof Error ? e.message : 'Failed to load purchases');
      set({ loading: false });
    }
  },

  /** Re-run the current page query (called after every write). */
  hydrate: async () => {
    await get().loadPage();
  },

  addPurchase: async (p) => {
    // Resolve branch name -> id via the branches store (AddPurchase still uses
    // branch names); falls back to the default branch only if unresolvable.
    const branchId = resolveBranchToId(p.branch);
    try {
      // Await the create so callers (e.g. Save & Pay) can attach a payment to
      // the PERSISTED purchase. purchases.create returns the new backend id.
      const res = await api<{ id: string; refNo: string }>('purchases.create', {
        status: p.status,
        date: p.date,
        supplierId: p.supplierId || undefined,
        branchId,
        userId: CURRENT_USER,
        payTerms: p.payTerms,
        lines: p.lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unit: l.unit,
          imei: l.imei,
          unitCostBeforeDisc: l.unitCostBeforeDisc,
          discountPct: l.discountPct,
          discountFlat: l.discountFlat,
          taxPct: l.taxPct,
          newSellPrice: l.newSellPrice,
        })),
        orderDiscountType: p.orderDiscountType,
        orderDiscountValue: p.orderDiscountValue,
        taxPct: p.taxPct,
        shipping: p.shipping,
        other: p.other,
        payments: p.payments.map((pay) => ({
          method: pay.method,
          amount: pay.amount,
          reference: pay.reference,
          paidAt: pay.paidAt,
        })),
        notes: p.notes,
      });
      // Rehydrate so the just-created purchase (with the real id) is in the store.
      await get().hydrate();
      return res.id;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save purchase');
      await get().hydrate();
      // Surface the failure so callers don't attach a payment to a missing id.
      throw e;
    }
  },
  // NOTE: there is no `purchases.update` channel yet, so editing an existing
  // purchase only touches the in-memory copy until that backend op lands.
  updatePurchase: (id, patch) =>
    set((s) => ({
      purchases: s.purchases.map((x) =>
        x.id === id
          ? {
              ...x,
              ...patch,
              audit: [
                ...x.audit,
                { id: 'a_' + Date.now(), at: new Date().toISOString(), by: 'Seam', action: 'edited' },
              ],
            }
          : x,
      ),
    })),
  cancelPurchase: (id, by, reason) => {
    void api('purchases.cancel', { purchaseId: id, userId: CURRENT_USER, reason })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to cancel purchase');
        void get().hydrate();
      });
  },
  // Business rule lives in the backend: a `received` purchase cannot be deleted
  // (it must be cancelled so stock is reversed); ordered/in-transit/cancelled
  // never touched stock and are safe to remove.
  deletePurchase: (id) => {
    void api('purchases.delete', { purchaseId: id })
      .then(() => get().hydrate())
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to delete purchase');
        void get().hydrate();
      });
  },
  addPayment: (purchaseId, p) => {
    void api('purchases.addPayment', {
      purchaseId,
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
    void api('purchaseReturns.create', {
      purchaseId: r.purchaseId,
      supplierId: r.supplierId,
      branchId: 'br_mp',
      userId: CURRENT_USER,
      reason: r.reason,
      refundMethod: r.refundMethod,
      lines: r.lines.map((l) => ({
        productId: l.productId,
        qty: l.qty,
        unit: l.unit,
        unitCost: l.unitCost,
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
}));
