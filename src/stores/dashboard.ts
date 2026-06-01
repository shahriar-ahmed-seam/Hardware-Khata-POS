import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// All available KPIs (full set — user can opt in any)
export const ALL_KPIS = [
  'sales',
  'profit',
  'transactions',
  'itemsSold',
  'newCustomers',
  'cashInDrawer',
  'customerDues',
  'supplierDues',
  'lowStock',
  'outOfStock',
  'todayExpenses',
  'todayPurchases',
  'returnsToday',
] as const;

export type KpiId = (typeof ALL_KPIS)[number];

// All available widgets
export const ALL_WIDGETS = [
  'hourlySales',
  'salesTrend',
  'salesVsPurchaseVsExpense',
  'profitLossSummary',
  'topSellingProducts',
  'topCustomers',
  'recentSales',
  'recentPurchases',
  'lowStockList',
  'customerDuesList',
  'supplierDuesList',
  'cashRegisterCard',
  'expenseBreakdown',
  'paymentMethodBreakdown',
  'activityFeed',
  'birthdayList',
] as const;

export type WidgetId = (typeof ALL_WIDGETS)[number];

export type TimeRange =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'lastMonth'
  | 'custom';

interface DashboardState {
  range: TimeRange;
  customRange?: { from: string; to: string };
  showDeltas: boolean;
  // Order matters; only items in the array are shown
  kpis: KpiId[];
  widgets: WidgetId[];

  setRange: (r: TimeRange) => void;
  setCustomRange: (from: string, to: string) => void;
  setShowDeltas: (v: boolean) => void;

  toggleKpi: (id: KpiId) => void;
  toggleWidget: (id: WidgetId) => void;
  moveKpi: (id: KpiId, dir: -1 | 1) => void;
  moveWidget: (id: WidgetId, dir: -1 | 1) => void;
  resetLayout: () => void;
}

const DEFAULT_KPIS: KpiId[] = ['sales', 'profit', 'transactions', 'newCustomers'];
const DEFAULT_WIDGETS: WidgetId[] = [
  'hourlySales',
  'topSellingProducts',
  'recentSales',
  'lowStockList',
];

function move<T>(arr: T[], item: T, dir: -1 | 1): T[] {
  const i = arr.indexOf(item);
  if (i === -1) return arr;
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const useDashboard = create<DashboardState>()(
  persist(
    (set) => ({
      range: 'today',
      showDeltas: true,
      kpis: DEFAULT_KPIS,
      widgets: DEFAULT_WIDGETS,

      setRange: (range) => set({ range }),
      setCustomRange: (from, to) => set({ customRange: { from, to }, range: 'custom' }),
      setShowDeltas: (showDeltas) => set({ showDeltas }),

      toggleKpi: (id) =>
        set((s) => ({
          kpis: s.kpis.includes(id) ? s.kpis.filter((k) => k !== id) : [...s.kpis, id],
        })),
      toggleWidget: (id) =>
        set((s) => ({
          widgets: s.widgets.includes(id)
            ? s.widgets.filter((w) => w !== id)
            : [...s.widgets, id],
        })),
      moveKpi: (id, dir) => set((s) => ({ kpis: move(s.kpis, id, dir) })),
      moveWidget: (id, dir) => set((s) => ({ widgets: move(s.widgets, id, dir) })),
      resetLayout: () => set({ kpis: DEFAULT_KPIS, widgets: DEFAULT_WIDGETS }),
    }),
    { name: 'pos-dashboard' },
  ),
);
