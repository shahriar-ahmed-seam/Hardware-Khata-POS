import { create } from 'zustand';

export type ActivityAction =
  | 'created'
  | 'edited'
  | 'voided'
  | 'paid'
  | 'returned'
  | 'shipped'
  | 'opened'
  | 'closed'
  | 'transferred'
  | 'adjusted'
  | 'login'
  | 'logout'
  | 'deleted'
  | 'imported';

export type ActivityEntity =
  | 'sale'
  | 'purchase'
  | 'return'
  | 'shipment'
  | 'product'
  | 'customer'
  | 'supplier'
  | 'expense'
  | 'shift'
  | 'transfer'
  | 'adjustment'
  | 'user'
  | 'settings';

export interface ActivityEvent {
  id: string;
  at: string;
  by: string; // user name
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string;
  entityRef?: string; // human-readable like "INV-2026-0451"
  message: string;
  amount?: number;
  branch?: string;
}

const now = Date.now();
const m = (mins: number) => new Date(now - mins * 60_000).toISOString();
const h = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
const d = (days: number) => new Date(now - days * 86_400_000).toISOString();

const SEED: ActivityEvent[] = [
  {
    id: 'a1',
    at: m(3),
    by: 'Seam',
    action: 'created',
    entity: 'sale',
    entityRef: 'INV-2026-0451',
    message: 'New sale to Walk-in Customer',
    amount: 4520,
    branch: 'Mirpur Branch',
  },
  {
    id: 'a2',
    at: m(18),
    by: 'Seam',
    action: 'paid',
    entity: 'sale',
    entityRef: 'INV-2026-0450',
    message: 'Payment received via bKash',
    amount: 12000,
    branch: 'Mirpur Branch',
  },
  {
    id: 'a3',
    at: m(45),
    by: 'Faruq',
    action: 'created',
    entity: 'expense',
    entityRef: 'EXP-0042',
    message: 'Cement delivery van',
    amount: 3200,
    branch: 'Uttara Branch',
  },
  {
    id: 'a4',
    at: h(1.5),
    by: 'Seam',
    action: 'opened',
    entity: 'shift',
    message: 'Opened shift with ৳ 5,000 float',
    amount: 5000,
    branch: 'Mirpur Branch',
  },
  {
    id: 'a5',
    at: h(2),
    by: 'Seam',
    action: 'login',
    entity: 'user',
    message: 'Signed in',
    branch: 'Mirpur Branch',
  },
  {
    id: 'a6',
    at: h(3.2),
    by: 'Faruq',
    action: 'created',
    entity: 'purchase',
    entityRef: 'PO-2026-0042',
    message: 'New purchase from BSRM Steels Ltd',
    amount: 425000,
    branch: 'Mirpur Branch',
  },
  {
    id: 'a7',
    at: h(5),
    by: 'Seam',
    action: 'voided',
    entity: 'sale',
    entityRef: 'INV-2026-0440',
    message: 'Voided — reason: customer cancelled',
    amount: 3220,
    branch: 'Mirpur Branch',
  },
  {
    id: 'a8',
    at: h(7),
    by: 'Rana',
    action: 'returned',
    entity: 'return',
    entityRef: 'RTN-2026-0005',
    message: 'Return processed for INV-2026-0448',
    amount: 520,
    branch: 'Mirpur Branch',
  },
  {
    id: 'a9',
    at: d(1),
    by: 'Seam',
    action: 'closed',
    entity: 'shift',
    message: 'Closed shift with ৳ 28 variance',
    amount: 28,
    branch: 'Mirpur Branch',
  },
  {
    id: 'a10',
    at: d(1.1),
    by: 'Rashed',
    action: 'transferred',
    entity: 'transfer',
    entityRef: 'TRF-2026-0014',
    message: 'Transferred 30 bags cement Mirpur → Uttara',
    branch: 'Mirpur Branch',
  },
  {
    id: 'a11',
    at: d(1.4),
    by: 'Rashed',
    action: 'adjusted',
    entity: 'adjustment',
    entityRef: 'ADJ-2026-0009',
    message: 'Damage adjustment — 4 PVC pipes',
    amount: -1280,
    branch: 'Mirpur Branch',
  },
  {
    id: 'a12',
    at: d(2),
    by: 'Seam',
    action: 'edited',
    entity: 'product',
    entityRef: 'BM-CMNT-OPC',
    message: 'Updated sell price to ৳ 555',
    branch: 'Mirpur Branch',
  },
  {
    id: 'a13',
    at: d(2.3),
    by: 'Seam',
    action: 'imported',
    entity: 'product',
    message: 'Imported 84 products from CSV',
    branch: 'Mirpur Branch',
  },
  {
    id: 'a14',
    at: d(3),
    by: 'Seam',
    action: 'created',
    entity: 'customer',
    entityRef: 'CU-0048',
    message: 'New customer: Rahim Construction',
    branch: 'Mirpur Branch',
  },
  {
    id: 'a15',
    at: d(4),
    by: 'Seam',
    action: 'edited',
    entity: 'settings',
    message: 'Updated business info',
    branch: 'Mirpur Branch',
  },
  {
    id: 'a16',
    at: d(5),
    by: 'Faruq',
    action: 'paid',
    entity: 'purchase',
    entityRef: 'PO-2026-0041',
    message: 'Paid Berger Paints BD via Bank',
    amount: 50000,
    branch: 'Mirpur Branch',
  },
  {
    id: 'a17',
    at: d(6),
    by: 'Seam',
    action: 'shipped',
    entity: 'shipment',
    entityRef: 'SHP-2026-0021',
    message: 'Shipment dispatched to New Era Builders',
    branch: 'Mirpur Branch',
  },
  {
    id: 'a18',
    at: d(8),
    by: 'Rana',
    action: 'login',
    entity: 'user',
    message: 'Signed in',
    branch: 'Mirpur Branch',
  },
  {
    id: 'a19',
    at: d(10),
    by: 'Seam',
    action: 'deleted',
    entity: 'sale',
    entityRef: 'DRF-2026-0006',
    message: 'Deleted draft',
    branch: 'Mirpur Branch',
  },
];

interface State {
  events: ActivityEvent[];
  log: (e: Omit<ActivityEvent, 'id' | 'at'>) => void;
}

export const useActivity = create<State>((set) => ({
  events: SEED,
  log: (e) =>
    set((s) => ({
      events: [{ id: 'a_' + Date.now(), at: new Date().toISOString(), ...e }, ...s.events],
    })),
}));
