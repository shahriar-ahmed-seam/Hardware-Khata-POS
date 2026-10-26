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
import { useRange } from './range';

interface KpiMeta {
  id: KpiId;
  label: string;
  description: string;
  icon: any;
  /** Follows the dashboard time range. */
  ranged?: boolean;
}

// Range-driven figures have plain labels; the range shows beside them
// (`ranged`). The "Today's …" labels used to stay on whatever range was picked.
export const KPI_META: Record<KpiId, KpiMeta> = {
  sales:          { id: 'sales',          label: 'Sales',            description: 'Money from sales in the chosen time', icon: Banknote, ranged: true },
  profit:         { id: 'profit',         label: 'Profit',           description: 'Sales − cost of goods − expenses',    icon: TrendingUp, ranged: true },
  transactions:   { id: 'transactions',   label: 'Invoices',         description: 'Number of sales in the chosen time',  icon: Receipt, ranged: true },
  itemsSold:      { id: 'itemsSold',      label: 'Items sold',       description: 'Units sold in the chosen time',       icon: Boxes, ranged: true },
  newCustomers:   { id: 'newCustomers',   label: 'New customers',    description: 'Customers added in the chosen time',  icon: Users, ranged: true },
  cashInDrawer:   { id: 'cashInDrawer',   label: 'Cash in drawer',   description: 'Cash in the drawer right now',        icon: Coins },
  customerDues:   { id: 'customerDues',   label: 'Customers owe us', description: 'Total all customers owe',             icon: HandCoins },
  supplierDues:   { id: 'supplierDues',   label: 'We owe suppliers', description: 'Total we owe all suppliers',          icon: Building2 },
  lowStock:       { id: 'lowStock',       label: 'Low stock',        description: 'Items at or below reorder level',     icon: AlertTriangle },
  outOfStock:     { id: 'outOfStock',     label: 'Out of stock',     description: 'Items with no stock left',            icon: PackageX },
  todayExpenses:  { id: 'todayExpenses',  label: 'Expenses',         description: 'Expenses in the chosen time',         icon: Wallet, ranged: true },
  todayPurchases: { id: 'todayPurchases', label: 'Purchases',        description: 'Goods received in the chosen time',   icon: ShoppingBag, ranged: true },
  returnsToday:   { id: 'returnsToday',   label: 'Returns',          description: 'Money refunded in the chosen time',   icon: Undo2, ranged: true },
};

interface RenderArgs {
  showDelta: boolean;
  // Action handlers fired by special KPIs
  onOpenProfit: () => void;
}

/** The previous period's figure, back from the current one and its % change. */
function prevOf(cur: number, deltaPct: number | null | undefined): number | null {
  if (typeof deltaPct !== 'number' || deltaPct <= -100) return null;
  return cur / (1 + deltaPct / 100);
}

export function renderKpi(id: KpiId, args: RenderArgs) {
  // Wrapped in a component so the data hook is called from a stable component
  // instance (KPIs can be toggled, which changes how many times renderKpi runs;
  // calling the hook directly inside renderKpi would break the rules of hooks).
  return <KpiRenderer id={id} args={args} />;
}

function KpiRenderer({ id, args }: { id: KpiId; args: RenderArgs }) {
  const { data } = useDashboardData();
  const { range, label: period, compare } = useRange();
  // Backend-only: no fallback data source. While the first fetch is in flight
  // (or after a failure) `stats` is null and every KPI renders a neutral zero
  // with no delta rather than a fabricated number.
  const live = data ? data.stats : null;
  const m = KPI_META[id];
  const common = {
    icon: m.icon,
    label: m.label,
    showDelta: args.showDelta,
    period: m.ranged ? period : undefined,
    compareLabel: compare,
  };
  // Today: show yesterday's figure, not a % (always red before closing time).
  const prevMoney = (cur: number, d: number | null | undefined) => {
    if (range !== 'today') return undefined;
    const p = prevOf(cur, d);
    return p === null ? undefined : formatBDT(p);
  };
  const prevCount = (cur: number, d: number | null | undefined) => {
    if (range !== 'today') return undefined;
    const p = prevOf(cur, d);
    return p === null ? undefined : formatNumber(Math.round(p));
  };

  switch (id) {
    case 'sales':
      return (
        <Kpi
          {...common}
          value={formatBDT(live?.sales.total ?? 0)}
          delta={live?.sales.deltaPct}
          prevValue={prevMoney(live?.sales.total ?? 0, live?.sales.deltaPct)}
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
          prevValue={prevMoney(live?.profit.netProfit ?? 0, live?.profit.deltaPct)}
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
          prevValue={prevCount(live?.transactions.count ?? 0, live?.transactions.deltaPct)}
          tone="info"
          to="/sales"
        />
      );
    case 'itemsSold':
      return (
        <Kpi
          {...common}
          value={formatNumber(live?.itemsSold.count ?? 0)}
          delta={live?.itemsSold.deltaPct}
          prevValue={prevCount(live?.itemsSold.count ?? 0, live?.itemsSold.deltaPct)}
          tone="warning"
        />
      );
    case 'newCustomers':
      return (
        <Kpi
          {...common}
          value={String(live?.newCustomers.count ?? 0)}
          delta={live?.newCustomers.deltaPct}
          prevValue={prevCount(live?.newCustomers.count ?? 0, live?.newCustomers.deltaPct)}
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
          value={formatBDT(live?.returnsToday ?? 0)}
          tone="destructive"
          to="/sales/returns"
        />
      );
  }
}
