import type { WidgetId } from '@/stores/dashboard';
import { Widget } from './Widget';
import { useRange } from './range';
// Loaded after first paint — see lazyWidgets.ts. Same names, same props as
// ./widgets; <Widget> holds the Suspense boundary they resolve against.
import * as W from './lazyWidgets';

export interface WidgetMeta {
  id: WidgetId;
  label: string;
  description: string;
  // grid span hint (in 12-col grid)
  span: number;
}

export const WIDGET_META: Record<WidgetId, WidgetMeta> = {
  hourlySales:              { id: 'hourlySales',              label: 'Hourly Sales',                description: 'Sales by hour',               span: 8 },
  salesTrend:               { id: 'salesTrend',               label: 'Sales Trend (7 days)',        description: 'Last 7 days revenue line',    span: 6 },
  salesVsPurchaseVsExpense: { id: 'salesVsPurchaseVsExpense', label: 'Sales vs Purchases vs Expenses', description: 'Monthly comparison',       span: 8 },
  profitLossSummary:        { id: 'profitLossSummary',        label: 'Profit / Loss Summary',       description: 'Profit and loss',             span: 4 },
  topSellingProducts:       { id: 'topSellingProducts',       label: 'Top Selling Products',        description: 'Best sellers',                span: 4 },
  topCustomers:             { id: 'topCustomers',             label: 'Top Customers',               description: 'By money spent',              span: 4 },
  recentSales:              { id: 'recentSales',              label: 'Recent Sales',                description: 'Last invoices',               span: 8 },
  recentPurchases:          { id: 'recentPurchases',          label: 'Recent Purchases',            description: 'Last GRNs',                   span: 6 },
  lowStockList:             { id: 'lowStockList',             label: 'Low Stock',                   description: 'Items at or below reorder',   span: 4 },
  customerDuesList:         { id: 'customerDuesList',         label: 'Customer Dues',               description: 'Top outstanding receivables', span: 4 },
  supplierDuesList:         { id: 'supplierDuesList',         label: 'Supplier Dues',               description: 'Top outstanding payables',    span: 4 },
  cashRegisterCard:         { id: 'cashRegisterCard',         label: 'Cash Register',               description: 'Current shift summary',       span: 4 },
  expenseBreakdown:         { id: 'expenseBreakdown',         label: 'Expense Breakdown',           description: 'Donut by category',           span: 6 },
  paymentMethodBreakdown:   { id: 'paymentMethodBreakdown',   label: 'Payment Methods',             description: 'Donut by tender',             span: 6 },
  activityFeed:             { id: 'activityFeed',             label: 'Activity Feed',               description: 'Latest events',               span: 4 },
  birthdayList:             { id: 'birthdayList',             label: 'Birthday List',               description: 'Customers to wish',           span: 4 },
};

/** Range-driven widgets show the range beside their title. */
const RANGED = new Set<WidgetId>([
  'hourlySales',
  'profitLossSummary',
  'topSellingProducts',
  'topCustomers',
  'expenseBreakdown',
  'paymentMethodBreakdown',
]);

export function renderWidget(id: WidgetId) {
  return <WidgetRenderer id={id} />;
}

function WidgetRenderer({ id }: { id: WidgetId }) {
  const { label: period } = useRange();
  const m = WIDGET_META[id];
  const common = {
    title: m.label,
    description: m.description,
    // Own text node beside the title, so it translates.
    badge: RANGED.has(id) ? (
      <span className="text-xs font-normal rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">{period}</span>
    ) : undefined,
  };

  switch (id) {
    case 'hourlySales':
      // The old `+12.4%` badge here was a hardcoded number, not a real trend —
      // removed with the rest of the fabricated dashboard data.
      return (
        <Widget {...common} to="/reports">
          <W.HourlySales />
        </Widget>
      );
    case 'salesTrend':
      return <Widget {...common} to="/reports"><W.SalesTrend /></Widget>;
    case 'salesVsPurchaseVsExpense':
      return <Widget {...common} to="/reports"><W.SalesVsPurchaseVsExpense /></Widget>;
    case 'profitLossSummary':
      return <Widget {...common} to="/reports/profit-loss" toLabel="Profit / Loss Report"><W.ProfitLossSummary /></Widget>;
    case 'topSellingProducts':
      return <Widget {...common}><W.TopSellingProducts /></Widget>;
    case 'topCustomers':
      return <Widget {...common} to="/contacts/customers"><W.TopCustomers /></Widget>;
    case 'recentSales':
      return <Widget {...common} to="/sales"><W.RecentSales /></Widget>;
    case 'recentPurchases':
      return <Widget {...common} to="/purchases"><W.RecentPurchases /></Widget>;
    case 'lowStockList':
      return <Widget {...common} to="/stock/alerts"><W.LowStockList /></Widget>;
    case 'customerDuesList':
      return <Widget {...common} to="/contacts/dues" toLabel="Collect"><W.CustomerDuesList /></Widget>;
    case 'supplierDuesList':
      return <Widget {...common} to="/contacts/suppliers" toLabel="Manage"><W.SupplierDuesList /></Widget>;
    case 'cashRegisterCard':
      return <Widget {...common} to="/cash-register" toLabel="Open Register"><W.CashRegisterCard /></Widget>;
    case 'expenseBreakdown':
      return <Widget {...common} to="/expenses"><W.ExpenseBreakdown /></Widget>;
    case 'paymentMethodBreakdown':
      return <Widget {...common} to="/sales"><W.PaymentMethodBreakdown /></Widget>;
    case 'activityFeed':
      return <Widget {...common}><W.ActivityFeed /></Widget>;
    case 'birthdayList':
      // Linked to /sms, which is not routed at all — the SMS feature was removed
      // because it had no backend, so the button landed on "Not Found". Points at
      // the customer list instead, which is where you would act on it.
      return <Widget {...common} to="/contacts/customers" toLabel="Customers"><W.BirthdayList /></Widget>;
  }
}
