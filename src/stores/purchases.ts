import { create } from 'zustand';
import { currentUserId } from '@/lib/actor';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast';
import {
  toPurchaseRecord,
  toPurchaseReturnRecord,
  type BackendPurchase,
  type BackendPurchaseReturn,
} from '@/hooks/purchaseAdapter';
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
  /** The unit the SUPPLIER quoted — 'dozen', 'box', or the base unit. */
  unit: string;
  /**
   * How many of the shop's selling units are in one purchase unit. 12 for a
   * dozen; 1 (or undefined) when buying in the same unit you sell in.
   *
   * This is what makes "5 dozen for 620 each" work without inventing money: the
   * bill is 5 × 620 exactly, stock arrives as 60, and the per-piece cost
   * (51.666…) is kept at full precision where valuation reads it. Rounding it to
   * 51.67 and multiplying by 60 would value the delivery at ৳3,100.20 against a
   * ৳3,100 bill. See createPurchase in backend/services/purchases.ts.
   */
  unitFactor?: number;
  /** The shop's own selling unit, recorded on the stock movement. */
  baseUnit?: string;
  imei?: string; // serial / IMEI for serialized items
  /** Cost of ONE PURCHASE UNIT (one dozen), before discounts. */
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
  /**
   * Settled by a supplier CREDIT NOTE (a CreditAdjust purchase return) rather
   * than by money. INVARIANT: due = max(0, total − paid − credited). Schema v10.
   */
  credited: number;
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
  /** Admin correction of a saved bill. Resolves true once the backend has it. */
  updatePurchase: (id: string, p: PurchaseRecord, reason: string) => Promise<boolean>;
  /** Mark an ordered / in-transit bill received. */
  receivePurchase: (id: string) => Promise<boolean>;
  cancelPurchase: (id: string, by: string, reason?: string) => Promise<boolean>;
  deletePurchase: (id: string) => Promise<boolean>;
  addPayment: (purchaseId: string, p: Omit<PurchasePayment, 'id'>) => Promise<boolean>;
  addReturn: (r: PurchaseReturn) => Promise<boolean>;
}


/**
 * The body both `purchases.create` and `purchases.update` take, from the form's
 * record. One builder, so a correction can never be sent differently from a new
 * bill. Payments are NOT part of it: a new bill adds its own, and a correction
 * keeps the ones already made.
 */
function purchaseInputOf(p: PurchaseRecord) {
  return {
    status: p.status,
    date: p.date,
    supplierId: p.supplierId || undefined,
    // Resolve branch name -> id via the branches store (the form uses names).
    branchId: resolveBranchToId(p.branch),
    userId: currentUserId(),
    payTerms: p.payTerms,
    lines: p.lines.map((l) => ({
      productId: l.productId,
      qty: l.qty,
      unit: l.unit,
      // "5 dozen at 620": qty and cost stay as the supplier billed them and
      // the backend converts stock to base units, so the bill matches the
      // supplier to the paisa even though 620/12 does not divide evenly.
      unitFactor: l.unitFactor && l.unitFactor > 0 ? l.unitFactor : 1,
      baseUnit: l.baseUnit,
      imei: l.imei,
      unitCostBeforeDisc: l.unitCostBeforeDisc,
      discountPct: l.discountPct,
      discountFlat: l.discountFlat,
      newSellPrice: l.newSellPrice,
    })),
    orderDiscountType: p.orderDiscountType,
    orderDiscountValue: p.orderDiscountValue,
    taxPct: p.taxPct,
    shipping: p.shipping,
    other: p.other,
    notes: p.notes,
  };
}

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

  /**
   * Re-run the current page query (called after every write), AND load the
   * purchase returns. Nothing used to load them, so the Purchase Returns screen
   * was always empty. They are header-only and grow slowly; the screen pages
   * them in memory.
   */
  hydrate: async () => {
    await Promise.all([
      get().loadPage(),
      api<BackendPurchaseReturn[]>('purchaseReturns.list')
        .then((rows) => set({ returns: rows.map(toPurchaseReturnRecord) }))
        .catch(() => {
          // Leave the last good list in place rather than blanking the screen.
        }),
    ]);
  },

  addPurchase: async (p) => {
    // Resolve branch name -> id via the branches store (AddPurchase still uses
    // branch names); falls back to the default branch only if unresolvable.
    try {
      // Await the create so callers (e.g. Save & Pay) can attach a payment to
      // the PERSISTED purchase. purchases.create returns the new backend id.
      const res = await api<{ id: string; refNo: string }>('purchases.create', {
        ...purchaseInputOf(p),
        payments: p.payments.map((pay) => ({
          method: pay.method,
          amount: pay.amount,
          reference: pay.reference,
          paidAt: pay.paidAt,
        })),
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
  /**
   * Correct a saved purchase through the backend (admin — `purchases.edit`).
   * The bill keeps its number and its payments; lines, prices, supplier and
   * status are re-applied in one transaction (updatePurchase in
   * backend/services/purchases.ts). This used to change only the in-memory copy,
   * which the next load threw away.
   */
  updatePurchase: async (id, p, reason) => {
    try {
      await api('purchases.update', { purchaseId: id, input: { ...purchaseInputOf(p), reason } });
      await get().hydrate();
      return true;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save the correction');
      await get().hydrate();
      return false;
    }
  },
  /** An ordered / in-transit bill arrives: its goods go into stock, as entered. */
  receivePurchase: async (id) => {
    try {
      await api('purchases.receive', { purchaseId: id, userId: currentUserId() });
      await get().hydrate();
      toast.success('Goods received — stock updated');
      return true;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to receive the goods');
      await get().hydrate();
      return false;
    }
  },
  // These resolve true only once the backend accepted them (they used to be
  // fire-and-forget, so a screen could close on a write that was refused).
  cancelPurchase: (id, _by, reason) =>
    settlePurchase(
      get,
      api('purchases.cancel', { purchaseId: id, userId: currentUserId(), reason }),
      'Failed to cancel purchase',
    ),
  // Business rule lives in the backend: a `received` purchase cannot be deleted
  // (it must be cancelled so stock is reversed); ordered/in-transit/cancelled
  // never touched stock and are safe to remove.
  deletePurchase: (id) =>
    settlePurchase(get, api('purchases.delete', { purchaseId: id }), 'Failed to delete purchase'),
  addPayment: (purchaseId, p) =>
    settlePurchase(
      get,
      api('purchases.addPayment', {
        purchaseId,
        payment: { method: p.method, amount: p.amount, reference: p.reference, paidAt: p.paidAt },
        userId: currentUserId(),
      }),
      'Failed to record payment',
    ),
  // Resolves true only once the backend has accepted the return.
  addReturn: async (r) => {
    try {
      await api('purchaseReturns.create', {
        purchaseId: r.purchaseId,
        supplierId: r.supplierId || undefined,
        // No branchId: the goods leave from the branch the bill was received at.
        userId: currentUserId(),
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
      });
      await get().hydrate();
      toast.success('Purchase return saved');
      return true;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save return');
      void get().hydrate();
      return false;
    }
  },
}));

/** Wait for a purchase write, then re-read either way. True only when accepted. */
async function settlePurchase(
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
