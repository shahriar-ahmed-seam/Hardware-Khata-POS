import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Link } from 'react-router-dom';
import {
  todayStats,
  recentSales,
  customers,
  suppliers,
  lowStock,
  dashboardMock,
} from '@/mocks/data';
import { Badge } from '@/components/ui/Badge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

const TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
  color: 'hsl(var(--popover-foreground))',
};

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(220 70% 60%)',
];

/** Minimal inline placeholder shown while a backend-backed widget is loading. */
function Loading({ className }: { className?: string }) {
  return (
    <div className={cn('flex-1 min-h-[200px] grid place-items-center text-sm text-muted-foreground', className)}>
      Loading…
    </div>
  );
}

export function HourlySales() {
  const { data, backend, loading } = useDashboardData();
  if (backend && loading && !data) return <div className="h-64 w-full"><Loading /></div>;
  const chartData = backend && data ? data.hourly : todayStats.hourly;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="hsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatBDT(v), 'Sales']} />
          <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#hsGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalesTrend() {
  const { data, backend, loading } = useDashboardData();
  if (backend && loading && !data) return <div className="h-64 w-full"><Loading /></div>;
  const chartData = backend && data ? data.salesTrend : dashboardMock.salesTrend7d;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatBDT(v), 'Sales']} />
          <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalesVsPurchaseVsExpense() {
  const { data, backend, loading } = useDashboardData();
  if (backend && loading && !data) return <div className="h-64 w-full"><Loading /></div>;
  const chartData = backend && data ? data.monthlyCompare : dashboardMock.monthlyCompare;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000000}M`} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatBDT(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="purchases" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProfitLossSummary() {
  const { data, backend, loading } = useDashboardData();
  if (backend && loading && !data) return <Loading />;
  const p = backend && data ? data.stats.profit : dashboardMock.todayProfit;
  return (
    <div className="space-y-3 flex-1 flex flex-col">
      <div className="grid grid-cols-2 gap-3 flex-1 content-start">
        <Stat label="Revenue" value={formatBDT(p.revenue)} />
        <Stat label="COGS" value={formatBDT(p.cogs)} muted />
        <Stat label="Gross Profit" value={formatBDT(p.grossProfit)} tone="success" />
        <Stat label="Margin" value={`${p.marginPct.toFixed(1)}%`} tone="success" />
        <Stat label="Expenses" value={formatBDT(p.expenses)} muted />
        <Stat label="Net Profit" value={formatBDT(p.netProfit)} tone="success" big />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  muted,
  tone,
  big,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: 'success';
  big?: boolean;
}) {
  return (
    <div className={cn('rounded-lg border border-border p-3', big && 'col-span-2')}>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div
        className={cn(
          'font-mono font-bold mt-0.5',
          big ? 'text-xl' : 'text-sm',
          muted && 'text-muted-foreground',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function TopSellingProducts() {
  const { data, backend, loading } = useDashboardData();
  if (backend && loading && !data) return <Loading />;
  const items = backend && data ? data.topProducts : todayStats.topItems;
  return (
    <div className="space-y-2.5 flex-1 min-h-[200px] overflow-auto scroll-hide pr-1">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="grid place-items-center size-8 rounded-md bg-secondary text-xs font-semibold shrink-0">
            #{i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{it.name}</div>
            <div className="text-[11px] text-muted-foreground">{formatNumber(it.qty)} units</div>
          </div>
          <div className="text-sm font-mono">{formatBDT(it.total)}</div>
        </div>
      ))}
    </div>
  );
}

export function TopCustomers() {
  const { data, backend, loading } = useDashboardData();
  if (backend && loading && !data) return <Loading />;
  const list = backend && data ? data.topCustomers : dashboardMock.topCustomers;
  return (
    <div className="space-y-2.5 flex-1 min-h-[200px] overflow-auto scroll-hide pr-1">
      {list.map((c, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="grid place-items-center size-8 rounded-md bg-secondary text-xs font-semibold shrink-0">
            #{i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{c.name}</div>
            <div className="text-[11px] text-muted-foreground">{c.orders} orders</div>
          </div>
          <div className="text-sm font-mono">{formatBDT(c.total)}</div>
        </div>
      ))}
    </div>
  );
}

export function RecentSales() {
  const { data, backend, loading } = useDashboardData();
  const rows = backend && data ? data.recentSales : recentSales;
  return (
    <div className="-mx-4 -mb-4 flex-1 flex flex-col">
      <div className="flex-1 min-h-[260px] overflow-auto scroll-hide">
        {backend && loading && !data ? (
          <Loading />
        ) : (
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase text-muted-foreground border-b border-border sticky top-0 bg-card z-10">
            <tr>
              <th className="text-left font-medium px-4 py-2">Invoice</th>
              <th className="text-left font-medium px-2 py-2">Customer</th>
              <th className="text-right font-medium px-2 py-2">Total</th>
              <th className="text-left font-medium px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/40">
                <td className="px-4 py-2 font-mono text-xs">{s.invoiceNo}</td>
                <td className="px-2 py-2 truncate max-w-[140px]">{s.customerName}</td>
                <td className="px-2 py-2 text-right font-mono">{formatBDT(s.total, { withSymbol: false })}</td>
                <td className="px-4 py-2">
                  <Badge
                    variant={
                      s.status === 'paid' ? 'success' : s.status === 'partial' ? 'warning' : 'destructive'
                    }
                  >
                    {s.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

export function RecentPurchases() {
  const { data, backend, loading } = useDashboardData();
  if (backend && loading && !data) return <Loading />;
  const list = backend && data ? data.recentPurchases : dashboardMock.recentPurchases;
  return (
    <div className="space-y-2 flex-1 min-h-[200px] overflow-auto scroll-hide pr-1">
      {list.map((p) => (
        <div key={p.ref} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{p.supplier}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{p.ref} · {p.date}</div>
          </div>
          <div className="text-sm font-mono">{formatBDT(p.total)}</div>
        </div>
      ))}
    </div>
  );
}

export function LowStockList() {
  const { data, backend, loading } = useDashboardData();
  if (backend && loading && !data) return <Loading />;
  const list = backend && data ? data.lowStock : lowStock;
  return (
    <div className="space-y-2 flex-1 min-h-[200px] overflow-auto scroll-hide pr-1">
      {list.length === 0 && (
        <div className="h-full grid place-items-center text-center text-sm text-muted-foreground">All items well stocked.</div>
      )}
      {list.map((p) => (
        <div key={p.id} className="flex items-center justify-between text-sm gap-3">
          <div className="min-w-0">
            <div className="font-medium truncate">{p.name}</div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {p.sku} · reorder at {p.reorderLevel}
            </div>
          </div>
          <Badge variant={p.stock === 0 ? 'destructive' : 'warning'}>
            {p.stock} {p.unit}
          </Badge>
        </div>
      ))}
    </div>
  );
}

export function CustomerDuesList() {
  const { data, backend, loading } = useDashboardData();
  if (backend && loading && !data) return <Loading />;
  const dues =
    backend && data
      ? data.customerDues
      : customers.filter((c) => c.due > 0).sort((a, b) => b.due - a.due);
  return (
    <div className="space-y-2 flex-1 min-h-[200px] overflow-auto scroll-hide pr-1">
      {dues.length === 0 && <div className="h-full grid place-items-center text-center text-sm text-muted-foreground">No outstanding dues.</div>}
      {dues.map((c) => (
        <Link
          key={c.id}
          to="/contacts/dues"
          className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0 hover:bg-secondary/40 -mx-2 px-2 rounded"
        >
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{c.name}</div>
            <div className="text-[11px] text-muted-foreground">{c.group}</div>
          </div>
          <div className="text-sm font-mono text-destructive">{formatBDT(c.due)}</div>
        </Link>
      ))}
    </div>
  );
}

export function SupplierDuesList() {
  const { data, backend, loading } = useDashboardData();
  if (backend && loading && !data) return <Loading />;
  const dues =
    backend && data
      ? data.supplierDues
      : suppliers.filter((s) => s.due > 0).sort((a, b) => b.due - a.due);
  return (
    <div className="space-y-2 flex-1 min-h-[200px] overflow-auto scroll-hide pr-1">
      {dues.length === 0 && <div className="h-full grid place-items-center text-center text-sm text-muted-foreground">No outstanding payables.</div>}
      {dues.map((s) => (
        <Link
          key={s.id}
          to="/contacts/suppliers"
          className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0 hover:bg-secondary/40 -mx-2 px-2 rounded"
        >
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{s.name}</div>
            <div className="text-[11px] text-muted-foreground">{s.phone}</div>
          </div>
          <div className="text-sm font-mono text-warning">{formatBDT(s.due)}</div>
        </Link>
      ))}
    </div>
  );
}

export function CashRegisterCard() {
  const { data, backend, loading } = useDashboardData();
  if (backend && loading && !data) return <Loading />;
  const card = backend && data ? data.cash : null;
  const opening = card ? card.opening : 5000;
  const cashIn = card ? card.cashIn : 84200;
  const cashOut = card ? card.cashOut : 14200;
  const expected = card ? card.expected : opening + cashIn - cashOut;
  // Footer: from the open shift when backend-backed, else the mock label.
  let footer = 'Shift #1234 · Opened 09:00 by Seam';
  if (backend && data) {
    if (card) {
      const opened = card.openedAt
        ? new Date(card.openedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '';
      footer = `Shift #${card.shiftNo ?? '—'} · Opened ${opened} by ${card.openedBy ?? '—'}`;
    } else {
      footer = 'No open shift';
    }
  }
  return (
    <div className="space-y-3 flex-1 flex flex-col min-h-[200px]">
      <div className="grid grid-cols-2 gap-2 flex-1 content-start">
        <Mini label="Opening" value={formatBDT(opening, { withSymbol: false })} />
        <Mini label="Cash In" value={formatBDT(cashIn, { withSymbol: false })} tone="success" />
        <Mini label="Cash Out" value={formatBDT(cashOut, { withSymbol: false })} tone="warning" />
        <Mini label="Expected" value={formatBDT(expected, { withSymbol: false })} tone="primary" />
      </div>
      <div className="text-[11px] text-muted-foreground">{footer}</div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'warning' | 'primary' }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div
        className={cn(
          'font-mono font-bold text-sm mt-0.5',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'primary' && 'text-primary',
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function ExpenseBreakdown() {
  const ctx = useDashboardData();
  if (ctx.backend && ctx.loading && !ctx.data) return <Loading className="min-h-[220px]" />;
  const data = ctx.backend && ctx.data ? ctx.data.expenseBreakdown : dashboardMock.expenseBreakdown;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-4 flex-1 min-h-[220px]">
      <div className="size-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatBDT(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="flex-1 truncate">{d.name}</span>
            <span className="font-mono">{formatBDT(d.value, { withSymbol: false })}</span>
            <span className="text-muted-foreground w-10 text-right">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PaymentMethodBreakdown() {
  const ctx = useDashboardData();
  if (ctx.backend && ctx.loading && !ctx.data) return <Loading className="min-h-[220px]" />;
  const data = ctx.backend && ctx.data ? ctx.data.paymentBreakdown : dashboardMock.paymentMethodBreakdown;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-4 flex-1 min-h-[220px]">
      <div className="size-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatBDT(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="flex-1">{d.name}</span>
            <span className="font-mono">{formatBDT(d.value, { withSymbol: false })}</span>
            <span className="text-muted-foreground w-10 text-right">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivityFeed() {
  const { data, backend, loading } = useDashboardData();
  const dotColor: Record<string, string> = {
    sale: 'bg-primary',
    payment: 'bg-success',
    purchase: 'bg-accent',
    expense: 'bg-warning',
    stock: 'bg-destructive',
    shift: 'bg-muted-foreground',
  };
  if (backend && loading && !data) return <Loading />;
  const feed = backend && data ? data.activityFeed : dashboardMock.activityFeed;
  return (
    <div className="space-y-3 flex-1 min-h-[200px] overflow-auto scroll-hide pr-1 relative">
      <div className="absolute left-1 top-2 bottom-2 w-px bg-border" />
      {feed.map((a) => (
        <div key={a.id} className="flex items-start gap-3 relative">
          <span className={cn('size-2 rounded-full mt-1.5 ring-4 ring-card', dotColor[a.type] ?? 'bg-muted-foreground')} />
          <div className="flex-1 min-w-0">
            <div className="text-xs">{a.text}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{a.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BirthdayList() {
  const { data, backend, loading } = useDashboardData();
  if (backend && loading && !data) return <Loading />;
  const list = backend && data ? data.birthdays : dashboardMock.birthdays;
  return (
    <div className="space-y-2 flex-1 min-h-[200px] overflow-auto scroll-hide pr-1">
      {list.length === 0 && (
        <div className="h-full grid place-items-center text-center text-sm text-muted-foreground">No upcoming birthdays.</div>
      )}
      {list.map((b) => (
        <div key={b.name} className="flex items-center justify-between text-sm gap-3 py-1.5 border-b border-border/50 last:border-0">
          <div className="min-w-0">
            <div className="font-medium truncate">{b.name}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{b.phone}</div>
          </div>
          <Badge variant={b.when === 'Today' ? 'success' : 'info'}>{b.when}</Badge>
        </div>
      ))}
    </div>
  );
}
