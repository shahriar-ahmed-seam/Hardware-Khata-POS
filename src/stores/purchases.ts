import { create } from 'zustand';
import { api, hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';
import { useBranches } from '@/stores/branches';
import { toPurchaseRecord, type BackendPurchase } from '@/hooks/purchaseAdapter';

/**
 * Resolve a branch value (id like `br_mp` OR display name like "Mirpur Branch")
 * into a real backend branch id via the branches store; falls back to the
 * default/first branch only when truly unresolvable. Prevents the old
 * "any name → br_mp" collapse that would mis-post a non-default-branch purchase.
 */
function resolveBranchToId(branch: string | undefined): string {
  if (branch && branch.startsWith('br_')) return branch;
  const items = useBranches.getState().items;
  if (branch) {
    const match = items.find((b) => b.name === branch);
    if (match) return match.id;
  }
  const def = items.find((b) => b.isDefault) ?? items[0];
  return def?.id ?? 'br_mp';
}

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
  attachmentName?: string; // mock — file uploads in backend
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
export function recomputeLine(l: PurchaseLine): PurchaseLine {
  const grossPerUnit = l.unitCostBeforeDisc;
  const afterPct = grossPerUnit * (1 - l.discountPct / 100);
  const afterFlat = afterPct - l.discountFlat;
  const unitCostBeforeTax = Math.max(0, afterFlat);
  const lineTotal = unitCostBeforeTax * l.qty * (1 + l.taxPct / 100);
  let marginPct: number | undefined;
  if (l.newSellPrice && unitCostBeforeTax > 0) {
    marginPct = ((l.newSellPrice - unitCostBeforeTax) / unitCostBeforeTax) * 100;
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

export function computeTotals(p: {
  lines: PurchaseLine[];
  orderDiscountType: 'flat' | 'percent';
  orderDiscountValue: number;
  taxPct: number;
  shipping: number;
  other: number;
}): PurchaseTotals {
  let gross = 0;
  let afterLine = 0;
  for (const l of p.lines) {
    const ll = recomputeLine(l);
    gross += ll.unitCostBeforeDisc * ll.qty;
    afterLine += ll.unitCostBeforeTax * ll.qty;
  }
  const totalLineDiscount = gross - afterLine;
  const orderDiscount =
    p.orderDiscountType === 'percent'
      ? afterLine * (p.orderDiscountValue / 100)
      : p.orderDiscountValue;
  const taxableBase = Math.max(0, afterLine - orderDiscount);
  const tax = taxableBase * (p.taxPct / 100);
  const total = taxableBase + tax + (p.shipping || 0) + (p.other || 0);
  return {
    subtotal: gross,
    totalLineDiscount,
    orderDiscount,
    taxableBase,
    tax,
    shipping: p.shipping || 0,
    other: p.other || 0,
    total,
  };
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

// ---- Seed ----
const SEED: PurchaseRecord[] = [
  {
    id: 'pu_seed1',
    refNo: 'PO-2026-0042',
    status: 'received',
    date: '2026-05-25T15:30:00',
    supplierId: 's1',
    supplierName: 'BSRM Steels Ltd',
    supplierAddress: 'Chittagong, Bangladesh',
    branch: 'Mirpur Branch',
    user: 'Seam',
    payTerms: 'Net30',
    lines: [
      {
        productId: 'p9',
        name: 'MS Rebar 12mm',
        sku: 'BM-RBR-12',
        qty: 4500,
        unit: 'kg',
        unitCostBeforeDisc: 92,
        discountPct: 0,
        discountFlat: 0,
        taxPct: 0,
        unitCostBeforeTax: 92,
        lineTotal: 414000,
      },
    ],
    subtotal: 414000,
    totalLineDiscount: 0,
    orderDiscountType: 'flat',
    orderDiscountValue: 0,
    orderDiscount: 0,
    taxPct: 0,
    tax: 0,
    shipping: 11000,
    other: 0,
    total: 425000,
    paid: 425000,
    due: 0,
    payments: [
      {
        id: 'pp1',
        method: 'Bank',
        amount: 425000,
        reference: 'TRX BSRM 25/5',
        paidAt: '2026-05-25T15:35:00',
      },
    ],
    audit: [{ id: 'a1', at: '2026-05-25T15:30:00', by: 'Seam', action: 'created' }],
  },
  {
    id: 'pu_seed2',
    refNo: 'PO-2026-0041',
    status: 'received',
    date: '2026-05-23T11:00:00',
    supplierId: 's2',
    supplierName: 'Berger Paints BD',
    supplierAddress: 'Tejgaon, Dhaka',
    branch: 'Mirpur Branch',
    user: 'Seam',
    payTerms: 'Net15',
    lines: [
      {
        productId: 'p6b',
        name: 'Weather Coat White 4L',
        sku: 'PN-WHITE-4L',
        qty: 30,
        unit: 'pc',
        unitCostBeforeDisc: 1750,
        discountPct: 0,
        discountFlat: 0,
        taxPct: 0,
        unitCostBeforeTax: 1750,
        lineTotal: 52500,
      },
      {
        productId: 'p6c',
        name: 'Weather Coat White 20L',
        sku: 'PN-WHITE-20L',
        qty: 4,
        unit: 'pc',
        unitCostBeforeDisc: 8000,
        discountPct: 0,
        discountFlat: 0,
        taxPct: 0,
        unitCostBeforeTax: 8000,
        lineTotal: 32000,
      },
    ],
    subtotal: 84500,
    totalLineDiscount: 0,
    orderDiscountType: 'flat',
    orderDiscountValue: 0,
    orderDiscount: 0,
    taxPct: 0,
    tax: 0,
    shipping: 0,
    other: 0,
    total: 84500,
    paid: 50000,
    due: 34500,
    payments: [
      {
        id: 'pp2',
        method: 'Cash',
        amount: 50000,
        paidAt: '2026-05-23T11:05:00',
      },
    ],
    audit: [{ id: 'a2', at: '2026-05-23T11:00:00', by: 'Seam', action: 'created' }],
  },
  {
    id: 'pu_seed3',
    refNo: 'PO-2026-0040',
    status: 'received',
    date: '2026-05-20T16:00:00',
    supplierId: 's4',
    supplierName: 'Bosch BD Distributor',
    branch: 'Mirpur Branch',
    user: 'Seam',
    payTerms: 'Net30',
    lines: [
      {
        productId: 'p2',
        name: 'Cordless Drill 13mm',
        sku: 'PT-DRL-13',
        qty: 12,
        unit: 'pc',
        unitCostBeforeDisc: 6800,
        discountPct: 0,
        discountFlat: 0,
        taxPct: 0,
        unitCostBeforeTax: 6800,
        lineTotal: 81600,
      },
    ],
    subtotal: 81600,
    totalLineDiscount: 0,
    orderDiscountType: 'flat',
    orderDiscountValue: 0,
    orderDiscount: 0,
    taxPct: 0,
    tax: 0,
    shipping: 0,
    other: 42400,
    total: 124000,
    paid: 0,
    due: 124000,
    payments: [],
    audit: [{ id: 'a3', at: '2026-05-20T16:00:00', by: 'Seam', action: 'created' }],
  },
  {
    id: 'pu_seed4',
    refNo: 'PO-2026-0039',
    status: 'received',
    date: '2026-05-19T10:00:00',
    supplierId: 's3',
    supplierName: 'RFL Plastics',
    branch: 'Mirpur Branch',
    user: 'Faruq',
    payTerms: 'Cash',
    lines: [
      {
        productId: 'p4',
        name: 'PVC Pipe 1" x 20ft',
        sku: 'PL-PIPE-PVC-1',
        qty: 120,
        unit: 'pc',
        unitCostBeforeDisc: 320,
        discountPct: 0,
        discountFlat: 0,
        taxPct: 0,
        unitCostBeforeTax: 320,
        lineTotal: 38400,
      },
    ],
    subtotal: 38400,
    totalLineDiscount: 0,
    orderDiscountType: 'flat',
    orderDiscountValue: 0,
    orderDiscount: 0,
    taxPct: 0,
    tax: 0,
    shipping: 0,
    other: 0,
    total: 38400,
    paid: 38400,
    due: 0,
    payments: [
      {
        id: 'pp3',
        method: 'Cash',
        amount: 38400,
        paidAt: '2026-05-19T10:00:00',
      },
    ],
    audit: [{ id: 'a4', at: '2026-05-19T10:00:00', by: 'Faruq', action: 'created' }],
  },
];

interface State {
  purchases: PurchaseRecord[];
  returns: PurchaseReturn[];
  loading: boolean;
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
  purchases: hasBackend() ? [] : SEED,
  returns: [],
  loading: false,

  /** Load purchases (with nested detail) from the backend. No-op without backend. */
  hydrate: async () => {
    if (!hasBackend()) return;
    set({ loading: true });
    try {
      const list = await api<BackendPurchase[]>('purchases.list', {});
      // list rows lack nested lines/payments; fetch detail for each (small N in practice).
      const detailed = await Promise.all(
        list.map((row) => api<BackendPurchase>('purchases.get', { id: row.id })),
      );
      set({ purchases: detailed.map(toPurchaseRecord), loading: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load purchases');
      set({ loading: false });
    }
  },

  addPurchase: async (p) => {
    if (hasBackend()) {
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
    }
    set((s) => ({ purchases: [p, ...s.purchases] }));
    return p.id;
  },
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
    if (hasBackend()) {
      void api('purchases.cancel', { purchaseId: id, userId: CURRENT_USER, reason })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to cancel purchase');
          void get().hydrate();
        });
      return;
    }
    set((s) => ({
      purchases: s.purchases.map((x) =>
        x.id === id
          ? {
              ...x,
              status: 'cancelled',
              audit: [
                ...x.audit,
                { id: 'a_' + Date.now(), at: new Date().toISOString(), by, action: 'cancelled', note: reason },
              ],
            }
          : x,
      ),
    }));
  },
  deletePurchase: (id) => {
    if (hasBackend()) {
      void api('purchases.delete', { purchaseId: id })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to delete purchase');
          void get().hydrate();
        });
      return;
    }
    set((s) => ({
      purchases: s.purchases.filter(
        (x) => !(x.id === id && (x.status === 'ordered' || x.status === 'cancelled')),
      ),
    }));
  },
  addPayment: (purchaseId, p) => {
    if (hasBackend()) {
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
      return;
    }
    set((s) => ({
      purchases: s.purchases.map((x) => {
        if (x.id !== purchaseId) return x;
        const payment: PurchasePayment = { ...p, id: 'pay_' + Date.now() };
        const paid = x.paid + p.amount;
        return {
          ...x,
          paid,
          due: Math.max(0, x.total - paid),
          payments: [...x.payments, payment],
          audit: [
            ...x.audit,
            {
              id: 'a_' + Date.now(),
              at: new Date().toISOString(),
              by: 'Seam',
              action: 'paid',
              note: `${p.method} ৳ ${p.amount}`,
            },
          ],
        };
      }),
    }));
  },
  addReturn: (r) => {
    if (hasBackend()) {
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
      return;
    }
    set((s) => ({
      returns: [r, ...s.returns],
      purchases: s.purchases.map((p) =>
        p.id === r.purchaseId
          ? {
              ...p,
              returnIds: [...(p.returnIds ?? []), r.id],
              audit: [
                ...p.audit,
                { id: 'a_' + Date.now(), at: new Date().toISOString(), by: r.user, action: 'returned' },
              ],
            }
          : p,
      ),
    }));
  },
}));
