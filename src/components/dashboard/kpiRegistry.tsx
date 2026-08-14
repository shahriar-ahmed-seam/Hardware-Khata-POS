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
  const { data } = useDashboardData();
  // Backend-only: no fallback data source. While the first fetch is in flight
  // (or after a failure) `stats` is null and every KPI renders a neutral zero
  // with no delta rather than a fabricated number.
  const live = data ? data.stats : null;
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
          value={formatBDT(live?.sales.total ?? 0)}
          delta={live?.sales.deltaPct}
          tone="primary"
          to="/sales"
        />
      );
    case 'profit':
      return (
        <Kpi
          {...common}
          value={formatBDT(live?.profit.netProfit ?? 0)}
          delta={live?.profit.deltaPct}
          tone="success"
          onClick={args.onOpenProfit}
        />
      );
    case 'transactions':
      return (
        <Kpi
          {...common}
          value={formatNumber(live?.transactions.count ?? 0)}
          delta={live?.transactions.deltaPct}
          tone="success"
          to="/sales"
        />
      );
    case 'itemsSold':
      return (
        <Kpi
          {...common}
          value={formatNumber(live?.itemsSold.count ?? 0)}
          delta={live?.itemsSold.deltaPct}
          tone="warning"
        />
      );
    case 'newCustomers':
      return (
        <Kpi
          {...common}
          value={String(live?.newCustomers.count ?? 0)}
          delta={live?.newCustomers.deltaPct}
          tone="info"
          to="/contacts/customers"
        />
      );
    case 'cashInDrawer':
      // No backend delta for live cash — show none (expected; see hook header).
      return (
        <Kpi
          {...common}
          value={formatBDT(live?.cashInDrawer ?? 0)}
          tone="primary"
          to="/cash-register"
        />
      );
    case 'customerDues':
      return (
        <Kpi
          {...common}
          value={formatBDT(live?.customerDuesTotal ?? 0)}
          tone="destructive"
          to="/contacts/dues"
        />
      );
    case 'supplierDues':
      return (
        <Kpi
          {...common}
          value={formatBDT(live?.supplierDuesTotal ?? 0)}
          tone="warning"
          to="/contacts/suppliers"
        />
      );
    case 'lowStock':
      return (
        <Kpi
          {...common}
          value={String(live?.lowStockCount ?? 0)}
          tone="warning"
          to="/stock/alerts"
        />
      );
    case 'outOfStock':
      return (
        <Kpi
          {...common}
          value={String(live?.outOfStockCount ?? 0)}
          tone="destructive"
          to="/stock/alerts"
        />
      );
    case 'todayExpenses':
      return (
        <Kpi
          {...common}
          value={formatBDT(live?.todayExpenses ?? 0)}
          tone="warning"
          to="/expenses"
        />
      );
    case 'todayPurchases':
      return (
        <Kpi
          {...common}
          value={formatBDT(live?.todayPurchases ?? 0)}
          tone="info"
          to="/purchases"
        />
      );
    case 'returnsToday':
      return (
        <Kpi
          {...common}
          value={String(live?.returnsToday ?? 0)}
          tone="destructive"
          to="/sales/returns"
        />
      );
  }
}
