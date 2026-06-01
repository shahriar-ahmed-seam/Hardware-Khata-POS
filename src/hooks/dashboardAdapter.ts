import type { TimeRange } from '@/stores/dashboard';

/**
 * The backend date-range preset shape (mirrors backend/core/dates.ts RangeInput).
 * Re-declared on the frontend since backend types aren't importable here.
 */
export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom';

export interface RangeInput {
  preset: DatePreset;
  from?: string;
  to?: string;
}

/**
 * Adapters + types for the Dashboard backend slice.
 *
 * Maps the backend `dashboard.*` aggregation shapes (see
 * backend/services/dashboard.ts) into the exact shapes the existing widget /
 * KPI components already render against the mock data. The components keep all
 * their Recharts/markup; only the data source swaps.
 *
 * DEFERRALS (see useDashboardData.tsx header for the full list):
 *  - Single-branch assumption (DEFAULT_BRANCH = 'br_mp').
 *  - salesTrend is fixed at 7 days; salesVsPurchaseVsExpense at 6 months,
 *    regardless of the selected range (these widgets are multi-period).
 */

// ----- Backend row shapes (snake_case as returned by the API) -----

/** The full object returned by `dashboard.stats`. */
export interface BackendStats {
  sales: { total: number; deltaPct: number };
  profit: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    marginPct: number;
    expenses: number;
    netProfit: number;
    deltaPct: number;
  };
  transactions: { count: number; deltaPct: number };
  itemsSold: { count: number; deltaPct: number };
  newCustomers: { count: number; deltaPct: number };
  cashInDrawer: number;
  customerDuesTotal: number;
  supplierDuesTotal: number;
  lowStockCount: number;
  outOfStockCount: number;
  todayExpenses: number;
  todayPurchases: number;
  returnsToday: number;
  stockValueAtCost: number;
  stockValueAtRetail: number;
}

export interface BackendHourly {
  hour: number;
  total: number;
  count: number;
}
export interface BackendTrend {
  day: string; // YYYY-MM-DD
  total: number;
}
export interface BackendMonthly {
  month: string; // YYYY-MM
  sales: number;
  purchases: number;
  expenses: number;
}
export interface BackendTopProduct {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
}
export interface BackendTopCustomer {
  customerId: string | null;
  name: string;
  orders: number;
  total: number;
}
export interface BackendRecentSale {
  id: string;
  invoice_no: string;
  date: string;
  total: number;
  paid: number;
  due: number;
  status: string;
  customer: string;
}
export interface BackendRecentPurchase {
  id: string;
  ref_no: string;
  supplier_name: string;
  date: string;
  total: number;
}
export interface BackendLowStock {
  id: string;
  name: string;
  sku: string;
  reorder_level: number;
  cost: number;
  stock: number;
  unit?: string;
}
export interface BackendBreakdownPayment {
  method: string;
  amount: number;
  count: number;
}
export interface BackendBreakdownExpense {
  category: string;
  amount: number;
  count: number;
}
export interface BackendActivity {
  id: string;
  at: string;
  by_user: string | null;
  branch_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  entity_ref: string | null;
  message: string | null;
  amount: number | null;
}
export interface BackendBirthday {
  id: string;
  name: string;
  phone: string | null;
  dob: string;
}
export interface BackendContactRow {
  id: string;
  name: string;
  phone?: string | null;
  price_group?: string | null;
  due?: number;
}
export interface BackendShiftRow {
  id: string;
  shift_no: number;
  status: string;
  opened_at: string;
  opening_cash: number;
  user_id: string;
  user_name?: string | null;
}
export interface BackendShiftTotals {
  openingCash: number;
  cashIn: number;
  cashOut: number;
  expected: number;
}

// ----- Mapped (frontend-facing) shapes the widgets consume -----

export interface HourlyPoint {
  hour: string;
  sales: number;
}
export interface TrendPoint {
  day: string;
  sales: number;
}
export interface MonthlyPoint {
  month: string;
  sales: number;
  purchases: number;
  expenses: number;
}
export interface TopProductRow {
  name: string;
  qty: number;
  total: number;
}
export interface TopCustomerRow {
  name: string;
  orders: number;
  total: number;
}
export interface RecentSaleRow {
  id: string;
  invoiceNo: string;
  customerName: string;
  total: number;
  status: 'paid' | 'partial' | 'due';
}
export interface RecentPurchaseRow {
  ref: string;
  supplier: string;
  total: number;
  date: string;
}
export interface LowStockRow {
  id: string;
  name: string;
  sku: string;
  reorderLevel: number;
  stock: number;
  unit: string;
}
export interface DueRow {
  id: string;
  name: string;
  group?: string;
  phone?: string;
  due: number;
}
export interface BreakdownSlice {
  name: string;
  value: number;
}
export interface ActivityRow {
  id: string;
  type: string;
  text: string;
  time: string;
}
export interface BirthdayRow {
  name: string;
  phone: string;
  when: string;
}
export interface CashCard {
  opening: number;
  cashIn: number;
  cashOut: number;
  expected: number;
  shiftNo?: number;
  openedAt?: string;
  openedBy?: string;
}

/** The fully-mapped bundle that the provider exposes as `data`. */
export interface DashboardBundle {
  stats: BackendStats;
  hourly: HourlyPoint[];
  salesTrend: TrendPoint[];
  monthlyCompare: MonthlyPoint[];
  topProducts: TopProductRow[];
  topCustomers: TopCustomerRow[];
  recentSales: RecentSaleRow[];
  recentPurchases: RecentPurchaseRow[];
  lowStock: LowStockRow[];
  customerDues: DueRow[];
  supplierDues: DueRow[];
  cash: CashCard | null;
  expenseBreakdown: BreakdownSlice[];
  paymentBreakdown: BreakdownSlice[];
  activityFeed: ActivityRow[];
  birthdays: BirthdayRow[];
}

// ----- Range mapping: store TimeRange -> backend RangeInput -----

/**
 * Map the store's `TimeRange` to a backend `RangeInput`. For 'custom' we read
 * the store's `customRange`; if it is missing we guard by falling back to
 * 'today' so the backend never receives an undefined custom window.
 */
export function toRangeInput(
  range: TimeRange,
  customRange?: { from: string; to: string },
): RangeInput {
  switch (range) {
    case 'today':
      return { preset: 'today' };
    case 'yesterday':
      return { preset: 'yesterday' };
    case 'week':
      return { preset: 'thisWeek' };
    case 'month':
      return { preset: 'thisMonth' };
    case 'lastMonth':
      return { preset: 'lastMonth' };
    case 'custom':
      if (customRange?.from && customRange?.to) {
        return { preset: 'custom', from: customRange.from, to: customRange.to };
      }
      // Guard: no custom window set yet -> treat as today.
      return { preset: 'today' };
    default:
      return { preset: 'today' };
  }
}

// ----- Small formatting helpers -----

function hourLabel(h: number): string {
  const period = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${period}`;
}

function weekdayLabel(isoDay: string): string {
  const d = new Date(isoDay);
  if (isNaN(d.getTime())) return isoDay;
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function monthLabel(ym: string): string {
  // ym = 'YYYY-MM'
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

/** A short relative/clock string for the activity feed `time` column. */
export function relativeTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays >= 1 && diffDays <= 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Derive a dashboard activity dot-type from the (entity, action) pair. */
export function activityType(entity: string, action: string): string {
  if (action === 'paid') return 'payment';
  switch (entity) {
    case 'sale':
    case 'return':
      return 'sale';
    case 'purchase':
      return 'purchase';
    case 'expense':
      return 'expense';
    case 'product':
    case 'adjustment':
    case 'transfer':
      return 'stock';
    case 'shift':
      return 'shift';
    default:
      return entity;
  }
}

function recentSaleStatus(paid: number, due: number): 'paid' | 'partial' | 'due' {
  if (due <= 0.01) return 'paid';
  if (paid > 0.01) return 'partial';
  return 'due';
}

// ----- Mappers -----

export function mapHourly(rows: BackendHourly[]): HourlyPoint[] {
  return rows.map((r) => ({ hour: hourLabel(r.hour), sales: r.total }));
}

export function mapTrend(rows: BackendTrend[]): TrendPoint[] {
  return rows.map((r) => ({ day: weekdayLabel(r.day), sales: r.total }));
}

export function mapMonthly(rows: BackendMonthly[]): MonthlyPoint[] {
  return rows.map((r) => ({
    month: monthLabel(r.month),
    sales: r.sales,
    purchases: r.purchases,
    expenses: r.expenses,
  }));
}

export function mapTopProducts(rows: BackendTopProduct[]): TopProductRow[] {
  return rows.map((r) => ({ name: r.name, qty: r.qty, total: r.revenue }));
}

export function mapTopCustomers(rows: BackendTopCustomer[]): TopCustomerRow[] {
  return rows.map((r) => ({ name: r.name, orders: r.orders, total: r.total }));
}

export function mapRecentSales(rows: BackendRecentSale[]): RecentSaleRow[] {
  return rows.map((r) => ({
    id: r.id,
    invoiceNo: r.invoice_no,
    customerName: r.customer,
    total: r.total,
    status: recentSaleStatus(r.paid, r.due),
  }));
}

export function mapRecentPurchases(rows: BackendRecentPurchase[]): RecentPurchaseRow[] {
  return rows.map((r) => ({
    ref: r.ref_no,
    supplier: r.supplier_name || '—',
    total: r.total,
    date: (r.date ?? '').slice(0, 10),
  }));
}

export function mapLowStock(rows: BackendLowStock[]): LowStockRow[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    reorderLevel: r.reorder_level,
    stock: r.stock,
    unit: r.unit ?? 'pc',
  }));
}

export function mapCustomerDues(rows: BackendContactRow[]): DueRow[] {
  return rows
    .filter((r) => (r.due ?? 0) > 0)
    .sort((a, b) => (b.due ?? 0) - (a.due ?? 0))
    .map((r) => ({ id: r.id, name: r.name, group: r.price_group ?? '', due: r.due ?? 0 }));
}

export function mapSupplierDues(rows: BackendContactRow[]): DueRow[] {
  return rows
    .filter((r) => (r.due ?? 0) > 0)
    .sort((a, b) => (b.due ?? 0) - (a.due ?? 0))
    .map((r) => ({ id: r.id, name: r.name, phone: r.phone ?? '', due: r.due ?? 0 }));
}

export function mapPaymentBreakdown(rows: BackendBreakdownPayment[]): BreakdownSlice[] {
  return rows.map((r) => ({ name: r.method, value: r.amount }));
}

export function mapExpenseBreakdown(rows: BackendBreakdownExpense[]): BreakdownSlice[] {
  return rows.map((r) => ({ name: r.category, value: r.amount }));
}

export function mapActivityFeed(rows: BackendActivity[], now = new Date()): ActivityRow[] {
  return rows.map((r) => {
    const ref = r.entity_ref ? `${r.entity_ref} ` : '';
    const text = r.message ?? `${ref}${r.action} ${r.entity}`.trim();
    return {
      id: r.id,
      type: activityType(r.entity, r.action),
      text,
      time: relativeTime(r.at, now),
    };
  });
}

export function mapBirthdays(rows: BackendBirthday[], now = new Date()): BirthdayRow[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return rows.map((r) => {
    const d = new Date(r.dob);
    let when = '';
    if (!isNaN(d.getTime())) {
      const next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
      const diff = Math.round((next.getTime() - today.getTime()) / 86_400_000);
      when = diff <= 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `in ${diff} days`;
    }
    return { name: r.name, phone: r.phone ?? '', when };
  });
}

export function mapCash(shift: BackendShiftRow | undefined, totals: BackendShiftTotals | null): CashCard | null {
  if (!shift || !totals) return null;
  return {
    opening: totals.openingCash,
    cashIn: totals.cashIn,
    cashOut: totals.cashOut,
    expected: totals.expected,
    shiftNo: shift.shift_no,
    openedAt: shift.opened_at,
    openedBy: shift.user_name ?? shift.user_id,
  };
}
