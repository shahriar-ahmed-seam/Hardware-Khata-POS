import { useMemo, useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  isInRange,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { useSales } from '@/stores/sales';
import { useCustomers } from '@/stores/contacts';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface GroupRow {
  group: string;
  customerCount: number;
  saleCount: number;
  grossSales: number;
  netSales: number;
  avgTicket: number;
  totalDue: number;
}

/** One `reports.customerGroup` row. */
interface BackendGroupRow {
  group: string;
  saleCount: number;
  grossSales: number;
  netSales: number;
  avgTicket: number;
}

export default function CustomerGroupPage() {
  const sales = useSales((s) => s.sales);
  const customers = useCustomers((s) => s.items);
  const hydrateCustomers = useCustomers((s) => s.hydrate);

  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');

  // The backend customerGroup aggregation does not include per-group customer
  // counts or outstanding due; those are merged in from the customers store, so
  // hydrate it on mount to populate them when this is the entry point. The mock
  // computation path reads the sales store directly, so hydrate that too (cheap
  // no-op without a backend).
  useEffect(() => {
    void hydrateCustomers();
    void useSales.getState().hydrate();
  }, [hydrateCustomers]);

  // Backend wiring: sales metrics come from `reports.customerGroup`. Customer
  // counts + outstanding due are NOT in that shape, so they are merged in from
  // the customers store (range-independent figures).
  const branchId = useBranchId(branch);
  const { data: beRows, loading, backend, error } = useReport<BackendGroupRow[]>(
    'reports.customerGroup',
    hasBackend() ? { range, branchId } : null,
    [range, branchId],
  );

  const mockRows: GroupRow[] = useMemo(() => {
    const fSales = sales.filter(
      (s) => s.status === 'final' && isInRange(s.date, range) && (!branch || s.branch === branch),
    );

    const customersByGroup = new Map<string, number>();
    customers.forEach((c) => {
      customersByGroup.set(c.group, (customersByGroup.get(c.group) ?? 0) + 1);
    });

    const map = new Map<string, GroupRow>();
    customers.forEach((c) => {
      if (!map.has(c.group)) {
        map.set(c.group, {
          group: c.group,
          customerCount: customersByGroup.get(c.group) ?? 0,
          saleCount: 0,
          grossSales: 0,
          netSales: 0,
          avgTicket: 0,
          totalDue: 0,
        });
      }
      const row = map.get(c.group)!;
      row.totalDue += c.due;
    });

    fSales.forEach((sale) => {
      const customer = customers.find((c) => c.id === sale.customerId);
      const group = customer?.group ?? 'Retail';
      let row = map.get(group);
      if (!row) {
        row = {
          group,
          customerCount: customersByGroup.get(group) ?? 0,
          saleCount: 0,
          grossSales: 0,
          netSales: 0,
          avgTicket: 0,
          totalDue: 0,
        };
        map.set(group, row);
      }
      row.saleCount += 1;
      row.grossSales += sale.subtotal;
      row.netSales += sale.subtotal - sale.orderDiscount;
    });

    const list = Array.from(map.values());
    list.forEach((r) => {
      r.avgTicket = r.saleCount > 0 ? r.netSales / r.saleCount : 0;
    });
    list.sort((a, b) => b.netSales - a.netSales);
    return list;
  }, [sales, customers, range, branch]);

  // Map backend rows; merge customer counts + total due from the store (those
  // figures are not part of the backend customerGroup aggregation).
  const backendRows: GroupRow[] | null = useMemo(() => {
    if (!backend || !beRows) return null;
    const countByGroup = new Map<string, number>();
    const dueByGroup = new Map<string, number>();
    customers.forEach((c) => {
      countByGroup.set(c.group, (countByGroup.get(c.group) ?? 0) + 1);
      dueByGroup.set(c.group, (dueByGroup.get(c.group) ?? 0) + c.due);
    });
    return beRows
      .map((r) => ({
        group: r.group,
        customerCount: countByGroup.get(r.group) ?? 0,
        saleCount: r.saleCount,
        grossSales: r.grossSales,
        netSales: r.netSales,
        avgTicket: r.avgTicket,
        totalDue: dueByGroup.get(r.group) ?? 0,
      }))
      .sort((a, b) => b.netSales - a.netSales);
  }, [backend, beRows, customers]);

  const rows: GroupRow[] = backend && error ? [] : (backendRows ?? mockRows);

  const totals = useMemo(
    () => ({
      customers: rows.reduce((a, r) => a + r.customerCount, 0),
      saleCount: rows.reduce((a, r) => a + r.saleCount, 0),
      grossSales: rows.reduce((a, r) => a + r.grossSales, 0),
      netSales: rows.reduce((a, r) => a + r.netSales, 0),
      due: rows.reduce((a, r) => a + r.totalDue, 0),
    }),
    [rows],
  );

  const groupColor = (g: string) => {
    if (g === 'Wholesale') return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
    if (g === 'Contractor') return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    return 'bg-success/10 text-success border-success/30';
  };

  return (
    <div>
      <ReportToolbar
        title="Customer Group Report"
        subtitle={`${formatNumber(totals.customers)} customers · ${formatBDT(totals.netSales)} net sales`}
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
      />

      <div className="p-6 space-y-4 max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Customers" value={formatNumber(totals.customers)} />
          <Kpi label="Transactions" value={formatNumber(totals.saleCount)} />
          <Kpi label="Net sales" value={formatBDT(totals.netSales)} tone="primary" />
          <Kpi label="Outstanding due" value={formatBDT(totals.due)} tone="warning" />
        </div>

        {/* Cards per group */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {rows.map((r) => {
            const pct = totals.netSales > 0 ? (r.netSales / totals.netSales) * 100 : 0;
            return (
              <Card key={r.group} className={cn('p-4 border-l-4', groupColor(r.group))}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{r.group}</div>
                  <div className="text-[11px] tabular text-muted-foreground">{pct.toFixed(0)}%</div>
                </div>
                <div className="tabular font-bold text-xl mt-1">{formatBDT(r.netSales)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {formatNumber(r.saleCount)} sales · avg {formatBDT(r.avgTicket)}
                </div>
                <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-current opacity-60" style={{ width: `${pct}%` }} />
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            <div>Group</div>
            <div className="text-right">Customers</div>
            <div className="text-right">Sales</div>
            <div className="text-right">Gross</div>
            <div className="text-right">Net</div>
            <div className="text-right">Avg ticket</div>
            <div className="text-right">Due</div>
          </div>
          {rows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <Users className="size-6 mx-auto mb-2 opacity-50" />
              {backend && loading ? 'Loading…' : backend && error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No data in this range.'}
            </div>
          )}
          {rows.map((r) => (
            <div
              key={r.group}
              className="grid grid-cols-[1.4fr_0.8fr_0.8fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/30 text-sm"
            >
              <div className="font-medium">{r.group}</div>
              <div className="tabular text-right">{formatNumber(r.customerCount)}</div>
              <div className="tabular text-right">{formatNumber(r.saleCount)}</div>
              <div className="tabular text-right">{formatBDT(r.grossSales)}</div>
              <div className="tabular text-right font-medium">{formatBDT(r.netSales)}</div>
              <div className="tabular text-right">{formatBDT(r.avgTicket)}</div>
              <div className="tabular text-right text-warning">{formatBDT(r.totalDue)}</div>
            </div>
          ))}
          {rows.length > 0 && (
            <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 border-t-2 border-border bg-secondary/40 text-sm font-semibold">
              <div>Total</div>
              <div className="tabular text-right">{formatNumber(totals.customers)}</div>
              <div className="tabular text-right">{formatNumber(totals.saleCount)}</div>
              <div className="tabular text-right">{formatBDT(totals.grossSales)}</div>
              <div className="tabular text-right">{formatBDT(totals.netSales)}</div>
              <div />
              <div className="tabular text-right text-warning">{formatBDT(totals.due)}</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'success' | 'warning';
}) {
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label}
      </div>
      <div
        className={cn(
          'tabular font-bold text-lg mt-1',
          tone === 'primary' && 'text-primary',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </div>
    </Card>
  );
}
