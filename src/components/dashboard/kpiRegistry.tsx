import {
  Banknote,
  Receipt,
  Boxes,
  Users,
  TrendingUp,
  Wallet,
  HandCoins,
  AlertTriangle,
  ShoppingBag,
  Undo2,
  Building2,
  PackageX,
  Coins,
} from 'lucide-react';
import type { KpiId } from '@/stores/dashboard';
import { Kpi } from './Kpi';
import { todayStats, dashboardMock, lowStock } from '@/mocks/data';
import { useDashboardData } from '@/hooks/useDashboardData';
import { formatBDT, formatNumber } from '@/lib/utils';

interface KpiMeta {
  id: KpiId;
  label: string;
  description: string;
  icon: any;
}

export const KPI_META: Record<KpiId, KpiMeta> = {
  sales:          { id: 'sales',          label: "Today's Sales",        description: 'Revenue today',                 icon: Banknote },
  profit:         { id: 'profit',         label: "Today's Profit",       description: 'Sales − COGS − expenses',       icon: TrendingUp },
  transactions:   { id: 'transactions',   label: 'Transactions',          description: 'Number of invoices today',      icon: Receipt },
  itemsSold:      { id: 'itemsSold',      label: 'Items Sold',            description: 'Units sold today',              icon: Boxes },
  newCustomers:   { id: 'newCustomers',   label: 'New Customers',         description: 'Customers registered today',    icon: Users },
  cashInDrawer:   { id: 'cashInDrawer',   label: 'Cash in Drawer',        description: 'Live cash from current shift',  icon: Coins },
  customerDues:   { id: 'customerDues',   label: 'Customer Dues',         description: 'Total outstanding from customers', icon: HandCoins },
  supplierDues:   { id: 'supplierDues',   label: 'Supplier Dues',         description: 'Total payable to suppliers',    icon: Building2 },
  lowStock:       { id: 'lowStock',       label: 'Low Stock',             description: 'Items at or below reorder',     icon: AlertTriangle },
  outOfStock:     { id: 'outOfStock',     label: 'Out of Stock',          description: 'Items with zero stock',         icon: PackageX },
  todayExpenses:  { id: 'todayExpenses',  label: "Today's Expenses",      description: 'Expenses logged today',         icon: Wallet },
  todayPurchases: { id: 'todayPurchases', label: "Today's Purchases",     description: 'Goods received today',          icon: ShoppingBag },
  returnsToday:   { id: 'returnsToday',   label: 'Returns Today',         description: 'Sell returns today',            icon: Undo2 },
};

interface RenderArgs {
  showDelta: boolean;
  removable: boolean;
  onRemove: () => void;
  // Action handlers fired by special KPIs
  onOpenProfit: () => void;
}

export function renderKpi(id: KpiId, args: RenderArgs) {
  // Wrapped in a component so the data hook is called from a stable component
  // instance (KPIs can be toggled, which changes how many times renderKpi runs;
  // calling the hook directly inside renderKpi would break the rules of hooks).
  return <KpiRenderer id={id} args={args} />;
}

function KpiRenderer({ id, args }: { id: KpiId; args: RenderArgs }) {
  const { data, backend } = useDashboardData();
  const live = backend && data ? data.stats : null;
  const m = KPI_META[id];
  const common = {
    icon: m.icon,
    label: m.label,
    showDelta: args.showDelta,
    removable: args.removable,
    onRemove: args.onRemove,
  };

  switch (id) {
    case 'sales':
      return (
        <Kpi
          {...common}
          value={formatBDT(live ? live.sales.total : todayStats.sales)}
          delta={live ? live.sales.deltaPct : 12.4}
          tone="primary"
          to="/sales"
        />
      );
    case 'profit':
      return (
        <Kpi
          {...common}
          value={formatBDT(live ? live.profit.netProfit : dashboardMock.todayProfit.netProfit)}
          delta={live ? live.profit.deltaPct : dashboardMock.todayProfit.deltaVsYesterday}
          tone="success"
          onClick={args.onOpenProfit}
        />
      );
    case 'transactions':
      return (
        <Kpi
          {...common}
          value={formatNumber(live ? live.transactions.count : todayStats.transactions)}
          delta={live ? live.transactions.deltaPct : 4.1}
          tone="success"
          to="/sales"
        />
      );
    case 'itemsSold':
      return (
        <Kpi
          {...common}
          value={formatNumber(live ? live.itemsSold.count : todayStats.itemsSold)}
          delta={live ? live.itemsSold.deltaPct : -2.6}
          tone="warning"
        />
      );
    case 'newCustomers':
      return (
        <Kpi
          {...common}
          value={String(live ? live.newCustomers.count : todayStats.newCustomers)}
          delta={live ? live.newCustomers.deltaPct : 50}
          tone="info"
          to="/contacts/customers"
        />
      );
    case 'cashInDrawer':
      // No backend delta for live cash — show none (expected; see hook header).
      return (
        <Kpi
          {...common}
          value={formatBDT(live ? live.cashInDrawer : dashboardMock.cashInDrawer)}
          tone="primary"
          to="/cash-register"
        />
      );
    case 'customerDues':
      return (
        <Kpi
          {...common}
          value={formatBDT(live ? live.customerDuesTotal : dashboardMock.customerDuesTotal)}
          tone="destructive"
          to="/contacts/dues"
        />
      );
    case 'supplierDues':
      return (
        <Kpi
          {...common}
          value={formatBDT(live ? live.supplierDuesTotal : dashboardMock.supplierDuesTotal)}
          tone="warning"
          to="/contacts/suppliers"
        />
      );
    case 'lowStock':
      return (
        <Kpi
          {...common}
          value={String(live ? live.lowStockCount : lowStock.length)}
          tone="warning"
          to="/stock/alerts"
        />
      );
    case 'outOfStock':
      return (
        <Kpi
          {...common}
          value={String(live ? live.outOfStockCount : dashboardMock.outOfStockCount)}
          tone="destructive"
          to="/stock/alerts"
        />
      );
    case 'todayExpenses':
      return (
        <Kpi
          {...common}
          value={formatBDT(live ? live.todayExpenses : dashboardMock.todayExpenses)}
          tone="warning"
          to="/expenses"
        />
      );
    case 'todayPurchases':
      return (
        <Kpi
          {...common}
          value={formatBDT(live ? live.todayPurchases : dashboardMock.todayPurchases)}
          tone="info"
          to="/purchases"
        />
      );
    case 'returnsToday':
      return (
        <Kpi
          {...common}
          value={String(live ? live.returnsToday : dashboardMock.returnsToday)}
          tone="destructive"
          to="/sales/returns"
        />
      );
  }
}
