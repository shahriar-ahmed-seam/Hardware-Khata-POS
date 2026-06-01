import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, hasBackend } from '@/lib/api';
import { useDashboard } from '@/stores/dashboard';
import { toast } from '@/stores/toast';
import {
  toRangeInput,
  mapHourly,
  mapTrend,
  mapMonthly,
  mapTopProducts,
  mapTopCustomers,
  mapRecentSales,
  mapRecentPurchases,
  mapLowStock,
  mapCustomerDues,
  mapSupplierDues,
  mapPaymentBreakdown,
  mapExpenseBreakdown,
  mapActivityFeed,
  mapBirthdays,
  mapCash,
  type DashboardBundle,
  type BackendStats,
  type BackendHourly,
  type BackendTrend,
  type BackendMonthly,
  type BackendTopProduct,
  type BackendTopCustomer,
  type BackendRecentSale,
  type BackendRecentPurchase,
  type BackendLowStock,
  type BackendBreakdownPayment,
  type BackendBreakdownExpense,
  type BackendActivity,
  type BackendBirthday,
  type BackendContactRow,
  type BackendShiftRow,
  type BackendShiftTotals,
} from './dashboardAdapter';

export { toRangeInput } from './dashboardAdapter';
export type { DashboardBundle } from './dashboardAdapter';

/**
 * DASHBOARD DATA PROVIDER
 *
 * Single read-only fetch layer for the whole Dashboard. On mount and whenever
 * the selected range / customRange / refreshKey change, it fetches every
 * `dashboard.*` aggregation (plus the contact + shift reads the dues lists and
 * cash card need) in parallel via `api()`, then maps the snake_case backend
 * rows into the exact shapes the existing KPI/widget components render.
 *
 * When `hasBackend()` is false (browser dev), it returns `backend:false` and
 * `data:null`; every component then keeps using its current mock imports
 * unchanged.
 *
 * DEFERRALS (commented through the slice):
 *  1. Single-branch assumption — DEFAULT_BRANCH = 'br_mp'. The branch picker is
 *     not wired to a real branch context yet; all queries pin this branch.
 *  2. salesTrend is fixed at 7 days and salesVsPurchaseVsExpense at 6 months
 *     regardless of the selected range — these widgets are inherently
 *     multi-period, so the range selector does not drive them.
 *  3. KPI deltas: only sales/profit/transactions/itemsSold/newCustomers carry a
 *     backend deltaPct. cashInDrawer / dues / stock-count KPIs show no delta
 *     (the backend does not compute one) — that is expected.
 *  4. Auto-refresh is a full refetch every 30s (no incremental/websocket) which
 *     is fine for a local SQLite DB.
 */

/** Single-branch assumption for now. */
export const DEFAULT_BRANCH = 'br_mp';

interface DashboardDataValue {
  data: DashboardBundle | null;
  loading: boolean;
  backend: boolean;
  /**
   * True when a backend fetch FAILED under `hasBackend()`. The dashboard uses
   * this to show an explicit error state instead of silently rendering MOCK
   * numbers — a real backend failure must never masquerade as real data.
   */
  error: boolean;
  refresh: () => void;
}

const DashboardDataContext = createContext<DashboardDataValue | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const range = useDashboard((s) => s.range);
  const customRange = useDashboard((s) => s.customRange);

  const backend = hasBackend();
  const [data, setData] = useState<DashboardBundle | null>(null);
  const [loading, setLoading] = useState(backend);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Guard against setting state after unmount / out-of-order responses.
  const reqIdRef = useRef(0);
  // Toast once per failed fetch attempt (not on every re-render).
  const toastedRef = useRef(false);

  useEffect(() => {
    if (!backend) {
      setData(null);
      setLoading(false);
      setError(false);
      return;
    }

    const reqId = ++reqIdRef.current;
    let cancelled = false;
    setLoading(true);
    setError(false);
    toastedRef.current = false;

    const rangePayload = { range: toRangeInput(range, customRange), branchId: DEFAULT_BRANCH };

    (async () => {
      try {
        const [
          stats,
          hourly,
          salesTrend,
          monthly,
          topProducts,
          topCustomers,
          recentSales,
          recentPurchases,
          lowStock,
          paymentBreakdown,
          expenseBreakdown,
          activityFeed,
          birthdays,
          customers,
          suppliers,
          shifts,
        ] = await Promise.all([
          api<BackendStats>('dashboard.stats', rangePayload),
          api<BackendHourly[]>('dashboard.hourlySales', rangePayload),
          api<BackendTrend[]>('dashboard.salesTrend', { days: 7, branchId: DEFAULT_BRANCH }),
          api<BackendMonthly[]>('dashboard.salesVsPurchaseVsExpense', {
            months: 6,
            branchId: DEFAULT_BRANCH,
          }),
          api<BackendTopProduct[]>('dashboard.topProducts', { ...rangePayload, limit: 5 }),
          api<BackendTopCustomer[]>('dashboard.topCustomers', { ...rangePayload, limit: 5 }),
          api<BackendRecentSale[]>('dashboard.recentSales', { limit: 8, branchId: DEFAULT_BRANCH }),
          api<BackendRecentPurchase[]>('dashboard.recentPurchases', {
            limit: 8,
            branchId: DEFAULT_BRANCH,
          }),
          api<BackendLowStock[]>('dashboard.lowStock', { limit: 50, branchId: DEFAULT_BRANCH }),
          api<BackendBreakdownPayment[]>('dashboard.paymentBreakdown', rangePayload),
          api<BackendBreakdownExpense[]>('dashboard.expenseBreakdown', rangePayload),
          api<BackendActivity[]>('dashboard.activityFeed', { limit: 20, branchId: DEFAULT_BRANCH }),
          api<BackendBirthday[]>('dashboard.birthdays', { daysAhead: 7 }),
          api<BackendContactRow[]>('customers.list', {}),
          api<BackendContactRow[]>('suppliers.list', {}),
          api<BackendShiftRow[]>('shifts.list', { branchId: DEFAULT_BRANCH }),
        ]);

        // Cash card: find the open shift for the branch, then pull its totals.
        const openShift = shifts.find((sh) => sh.status === 'open');
        let shiftTotals: BackendShiftTotals | null = null;
        if (openShift) {
          shiftTotals = await api<BackendShiftTotals>('cash.shiftTotals', { shiftId: openShift.id });
        }

        if (cancelled || reqId !== reqIdRef.current) return;

        const now = new Date();
        const bundle: DashboardBundle = {
          stats,
          hourly: mapHourly(hourly),
          salesTrend: mapTrend(salesTrend),
          monthlyCompare: mapMonthly(monthly),
          topProducts: mapTopProducts(topProducts),
          topCustomers: mapTopCustomers(topCustomers),
          recentSales: mapRecentSales(recentSales),
          recentPurchases: mapRecentPurchases(recentPurchases),
          lowStock: mapLowStock(lowStock),
          customerDues: mapCustomerDues(customers),
          supplierDues: mapSupplierDues(suppliers),
          cash: mapCash(openShift, shiftTotals),
          expenseBreakdown: mapExpenseBreakdown(expenseBreakdown),
          paymentBreakdown: mapPaymentBreakdown(paymentBreakdown),
          activityFeed: mapActivityFeed(activityFeed, now),
          birthdays: mapBirthdays(birthdays, now),
        };
        setData(bundle);
        setError(false);
      } catch (err) {
        // Backend error: surface it. Do NOT silently fall back to MOCK — flip
        // `error` so the dashboard shows an explicit error state, and toast once
        // per attempt. (Mock is only legitimate when !hasBackend().)
        if (!cancelled && reqId === reqIdRef.current) {
          console.error('[useDashboardData] fetch failed:', err);
          setData(null);
          setError(true);
          if (!toastedRef.current) {
            toastedRef.current = true;
            toast.error(err instanceof Error ? err.message : 'Failed to load dashboard');
          }
        }
      } finally {
        if (!cancelled && reqId === reqIdRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [backend, range, customRange, refreshKey]);

  const value = useMemo<DashboardDataValue>(
    () => ({ data, loading, backend, error, refresh }),
    [data, loading, backend, error, refresh],
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

/**
 * Access the dashboard data bundle. Safe to call even when no provider is
 * mounted (returns a backend:false / data:null default) so individual
 * components stay resilient and keep their mock fallback.
 */
export function useDashboardData(): DashboardDataValue {
  const ctx = useContext(DashboardDataContext);
  if (ctx) return ctx;
  return { data: null, loading: false, backend: false, error: false, refresh: () => {} };
}
