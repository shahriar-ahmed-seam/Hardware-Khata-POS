import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

/**
 * One `reports.customerGroup` row — every figure now comes from the backend
 * aggregation.
 *
 * This page used to merge `customerCount` / `totalDue` in from the customers
 * store. That store became paginated (one 50-row page), which silently capped
 * this report at 50 customers, so both figures moved into SQL. See
 * `customerGroup()` in backend/services/reports.ts.
 */
interface GroupRow {
  group: string;
  customerCount: number;
  saleCount: number;
  grossSales: number;
  netSales: number;
  avgTicket: number;
  totalDue: number;
}

export default function CustomerGroupPage() {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');

  const branchId = useBranchId(branch);
  const { data: beRows, loading, error } = useReport<GroupRow[]>(
    'reports.customerGroup',
    hasBackend() ? { range, branchId } : null,
    [range, branchId],
  );

  const rows: GroupRow[] = useMemo(() => beRows ?? [], [beRows]);

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

        <div className="text-xs text-muted-foreground">
          Sales figures cover the selected date range. Customer counts and outstanding due are
          lifetime balances across all branches.
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
              {loading
                ? 'Loading…'
                : error
                  ? 'Couldn’t load — backend error. Check connection and retry.'
                  : 'No data in this range.'}
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
