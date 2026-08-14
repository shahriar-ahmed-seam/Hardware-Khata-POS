import { lazy } from 'react';

/**
 * THE DASHBOARD WIDGETS, LOADED AFTER FIRST PAINT.
 *
 * `widgets.tsx` is the only module that imports `recharts`, which is by far the
 * heaviest dependency in the app (~410 KB minified). The dashboard is the screen
 * the app opens on, so that charting code was being parsed and compiled before
 * the owner could see anything at all — the worst possible moment on a low-end
 * PC.
 *
 * Every widget here points at the SAME module, so React fetches that one chunk
 * once and all sixteen resolve together. The visible effect is that the KPI
 * numbers and the lists paint immediately and the charts appear a few frames
 * later, instead of everything waiting for the charts.
 *
 * The component names and props are identical to `widgets.tsx` — this file is a
 * loading strategy, not an abstraction. `<Widget>` provides the one Suspense
 * boundary they all fall back to.
 */
const widgets = () => import('./widgets');

export const HourlySales = lazy(() => widgets().then((m) => ({ default: m.HourlySales })));
export const SalesTrend = lazy(() => widgets().then((m) => ({ default: m.SalesTrend })));
export const SalesVsPurchaseVsExpense = lazy(() =>
  widgets().then((m) => ({ default: m.SalesVsPurchaseVsExpense })),
);
export const ProfitLossSummary = lazy(() =>
  widgets().then((m) => ({ default: m.ProfitLossSummary })),
);
export const TopSellingProducts = lazy(() =>
  widgets().then((m) => ({ default: m.TopSellingProducts })),
);
export const TopCustomers = lazy(() => widgets().then((m) => ({ default: m.TopCustomers })));
export const RecentSales = lazy(() => widgets().then((m) => ({ default: m.RecentSales })));
export const RecentPurchases = lazy(() => widgets().then((m) => ({ default: m.RecentPurchases })));
export const LowStockList = lazy(() => widgets().then((m) => ({ default: m.LowStockList })));
export const CustomerDuesList = lazy(() =>
  widgets().then((m) => ({ default: m.CustomerDuesList })),
);
export const SupplierDuesList = lazy(() =>
  widgets().then((m) => ({ default: m.SupplierDuesList })),
);
export const CashRegisterCard = lazy(() =>
  widgets().then((m) => ({ default: m.CashRegisterCard })),
);
export const ExpenseBreakdown = lazy(() =>
  widgets().then((m) => ({ default: m.ExpenseBreakdown })),
);
export const PaymentMethodBreakdown = lazy(() =>
  widgets().then((m) => ({ default: m.PaymentMethodBreakdown })),
);
export const ActivityFeed = lazy(() => widgets().then((m) => ({ default: m.ActivityFeed })));
export const BirthdayList = lazy(() => widgets().then((m) => ({ default: m.BirthdayList })));
