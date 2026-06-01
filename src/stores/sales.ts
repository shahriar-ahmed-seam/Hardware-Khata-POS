import { create } from 'zustand';
import { recentSales, type Sale } from '@/mocks/data';
import { api, hasBackend } from '@/lib/api';
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

// ----- Helpers to convert legacy mock sales into rich records -----
function inflate(s: Sale): SaleRecord {
  const tax = s.tax;
  const taxPct = s.subtotal > 0 ? (tax / s.subtotal) * 100 : 0;
  return {
    id: s.id,
    invoiceNo: s.invoiceNo,
    status: 'final',
    date: s.date,
    customerId: s.customerId,
    customerName: s.customerName,
    branch: 'Mirpur Branch',
    user: s.user,
    lines: [
      // Mock single placeholder line (real data would have full lines)
      {
        productId: 'p_seed',
        name: '[items]',
        sku: '—',
        qty: s.items,
        unit: 'pc',
        unitPrice: s.subtotal / Math.max(1, s.items),
        discountPct: 0,
        discountFlat: 0,
        taxPct: 0,
      },
    ],
    subtotal: s.subtotal,
    totalLineDiscount: 0,
    orderDiscountPct: 0,
    orderDiscountFlat: s.discount,
    orderDiscount: s.discount,
    taxPct: Number(taxPct.toFixed(2)),
    tax,
    shipping: 0,
    other: 0,
    total: s.total,
    paid: s.paid,
    due: s.due,
    payments:
      s.paid > 0
        ? [
            {
              id: 'pay_' + s.id,
              method:
                s.paymentMethod === 'Mixed'
                  ? 'Cash'
                  : (s.paymentMethod as SalePayment['method']),
              amount: s.paid,
              paidAt: s.date,
            },
          ]
        : [],
    audit: [
      { id: 'a_' + s.id, at: s.date, by: s.user, action: 'created' },
    ],
    profit: Math.round((s.subtotal - s.discount) * 0.22),
  };
}

const SEED_SALES: SaleRecord[] = recentSales.map(inflate);

// Add a couple drafts and quotations for demo
SEED_SALES.push({
  ...inflate({
    id: 'sl_draft1',
    invoiceNo: 'DRF-2026-0007',
    date: '2026-05-26T09:14:00',
    customerId: 'cu2',
    customerName: 'Rahim Construction',
    items: 5,
    subtotal: 12400,
    discount: 0,
    tax: 0,
    total: 12400,
    paid: 0,
    due: 12400,
    status: 'due',
    paymentMethod: 'Credit',
    user: 'Seam',
  }),
  status: 'draft',
});

SEED_SALES.push({
  ...inflate({
    id: 'sl_quote1',
    invoiceNo: 'QTN-2026-0014',
    date: '2026-05-25T15:33:00',
    customerId: 'cu4',
    customerName: 'New Era Builders',
    items: 14,
    subtotal: 84200,
    discount: 1200,
    tax: 0,
    total: 83000,
    paid: 0,
    due: 83000,
    status: 'due',
    paymentMethod: 'Credit',
    user: 'Faruq',
  }),
  status: 'quotation',
  validUntil: '2026-06-15',
});

// One demo return + shipment
const SEED_RETURNS: SellReturn[] = [
  {
    id: 'ret1',
    refNo: 'RTN-2026-0005',
    saleId: 'sl4',
    saleInvoiceNo: 'INV-2026-0448',
    date: '2026-05-26T13:10:00',
    customerId: 'cu1',
    customerName: 'Walk-in Customer',
    user: 'Seam',
    reason: 'wrong-item',
    refundMethod: 'Cash',
    lines: [
      {
        productId: 'p1',
        name: 'Claw Hammer 16oz',
        sku: 'HT-CLW-16',
        qty: 1,
        unit: 'pc',
        unitPrice: 520,
        refundAmount: 520,
      },
    ],
    total: 520,
  },
];

const SEED_SHIPMENTS: Shipment[] = [
  {
    id: 'shp1',
    refNo: 'SHP-2026-0021',
    saleId: 'sl3',
    saleInvoiceNo: 'INV-2026-0449',
    customerName: 'New Era Builders',
    driver: 'Karim',
    vehicleNo: 'DH 11-3344',
    status: 'in-transit',
    address: 'Uttara Sector 7, Dhaka',
    targetDate: '2026-05-27',
    createdAt: '2026-05-26T11:30:00',
    notes: '24 bags cement + 150 kg rebar',
  },
];

interface SalesState {
  sales: SaleRecord[];
  returns: SellReturn[];
  shipments: Shipment[];
  loading: boolean;
  hydrate: () => Promise<void>;
  // Sales CRUD
  addSale: (s: SaleRecord) => void;
  updateSale: (id: string, patch: Partial<SaleRecord>) => void;
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
  sales: hasBackend() ? [] : SEED_SALES,
  returns: hasBackend() ? [] : SEED_RETURNS,
  // Backed by the `shipments` table under Electron; mock seed in browser dev.
  shipments: hasBackend() ? [] : SEED_SHIPMENTS,
  loading: false,

  /** Load sales (with nested detail) + sell returns + shipments from the backend. No-op without backend. */
  hydrate: async () => {
    if (!hasBackend()) return;
    set({ loading: true });
    try {
      const list = await api<BackendSale[]>('sales.list', {});
      // list rows lack nested lines/payments/audit; fetch detail per id (small N).
      const detailed = await Promise.all(
        list.map((row) => api<BackendSale>('sales.get', { id: row.id })),
      );
      const returns = await api<Parameters<typeof toSellReturnRecord>[0][]>('sellReturns.list', {});
      const shipments = await api<Parameters<typeof toShipment>[0][]>('shipments.list', {});
      set({
        sales: detailed.map(toSaleRecord),
        returns: returns.map(toSellReturnRecord),
        shipments: shipments.map(toShipment),
        loading: false,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load sales');
      set({ loading: false });
    }
  },

  addSale: (s) => {
    if (hasBackend()) {
      // Resolve branch name -> id via the branches store (AddSale still uses
      // branch names); falls back to the default branch only if unresolvable.
      const branchId = resolveBranchToId(s.branch);
      // Only pass a customerId when it looks like a real backend id; the mock
      // AddSale form uses local ids like 'cu1' that won't resolve server-side.
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
      return;
    }
    set((st) => ({ sales: [s, ...st.sales] }));
  },
  // updateSale (edit) stays mock for now — full edit-form wiring is deferred
  // until the Contacts slice provides real backend customer/product/branch ids.
  updateSale: (id, patch) =>
    set((st) => ({
      sales: st.sales.map((x) =>
        x.id === id
          ? {
              ...x,
              ...patch,
              audit: [
                ...x.audit,
                {
                  id: 'a_' + Date.now(),
                  at: new Date().toISOString(),
                  by: 'Seam',
                  action: 'edited',
                },
              ],
            }
          : x,
      ),
    })),
  voidSale: (id, by, reason) => {
    if (hasBackend()) {
      void api('sales.void', { saleId: id, userId: CURRENT_USER, reason })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to void sale');
          void get().hydrate();
        });
      return;
    }
    set((st) => ({
      sales: st.sales.map((x) =>
        x.id === id
          ? {
              ...x,
              status: 'void',
              audit: [
                ...x.audit,
                {
                  id: 'a_' + Date.now(),
                  at: new Date().toISOString(),
                  by,
                  action: 'voided',
                  note: reason,
                },
              ],
            }
          : x,
      ),
    }));
  },
  deleteSale: (id) => {
    if (hasBackend()) {
      void api('sales.delete', { saleId: id })
        .then(() => get().hydrate())
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to delete sale');
          void get().hydrate();
        });
      return;
    }
    set((st) => ({
      sales: st.sales.filter(
        (x) => !(x.id === id && (x.status === 'draft' || x.status === 'quotation')),
      ),
    }));
  },
  addPayment: (saleId, p) => {
    if (hasBackend()) {
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
      return;
    }
    set((st) => ({
      sales: st.sales.map((x) => {
        if (x.id !== saleId) return x;
        const payment: SalePayment = { ...p, id: 'pay_' + Date.now() };
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
      return;
    }
    set((st) => ({
      returns: [r, ...st.returns],
      sales: st.sales.map((s) =>
        s.id === r.saleId
          ? { ...s, returnIds: [...(s.returnIds ?? []), r.id], audit: [...s.audit, { id: 'a_' + Date.now(), at: new Date().toISOString(), by: r.user, action: 'returned' }] }
          : s,
      ),
    }));
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
    if (hasBackend()) {
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
      return;
    }
    set((st) => ({
      shipments: [s, ...st.shipments],
      sales: st.sales.map((sale) =>
        sale.id === s.saleId
          ? { ...sale, shipmentId: s.id, audit: [...sale.audit, { id: 'a_' + Date.now(), at: new Date().toISOString(), by: 'Seam', action: 'shipped' }] }
          : sale,
      ),
    }));
  },
  updateShipment: (id, patch) => {
    if (hasBackend()) {
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
      return;
    }
    set((st) => ({ shipments: st.shipments.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  },
}));
