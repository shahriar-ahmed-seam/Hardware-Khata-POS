import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { ReportToolbar, DEFAULT_RANGE, type DateRange } from '@/components/reports/ReportToolbar';
import { ReportKpi, ReportKpis } from '@/components/reports/ReportKpi';
import { ReportTable, moneyCol, numCol, tableSection, type ReportColumn } from '@/components/reports/ReportTable';
import { useReportQuery } from '@/components/reports/useReportQuery';
import { useBranchId } from '@/hooks/useReport';
import { labelFor } from '@/lib/labels';
import { formatBDT, formatNumber, cn } from '@/lib/utils';

/**
 * One `reports.customerGroup` row; every figure comes from the backend
 * (customer counts and dues in SQL, not from the paginated customers store).
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
  const res = useReportQuery<GroupRow[]>('reports.customerGroup', { range, branchId }, [range, branchId]);
  const rows = useMemo(() => res.data ?? [], [res.data]);

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

  const columns: ReportColumn<GroupRow>[] = [
    { key: 'group', header: 'Group', word: true, text: (r) => labelFor('priceGroup', r.group), className: 'font-medium' },
    numCol('customers', 'Customers', (r) => r.customerCount, { totalValue: totals.customers }),
    numCol('sales', 'Invoices', (r) => r.saleCount, { totalValue: totals.saleCount }),
    moneyCol('gross', 'Gross sales', (r) => r.grossSales, { totalValue: totals.grossSales }),
    moneyCol('net', 'Net sales', (r) => r.netSales, { totalValue: totals.netSales, strong: true }),
    moneyCol('avg', 'Average sale', (r) => r.avgTicket),
    // Dues are lifetime balances, not this period — said in the header.
    moneyCol('due', 'Due (all time)', (r) => r.totalDue, {
      totalValue: totals.due,
      cell: (r) => <span className={cn(r.totalDue > 0 && 'text-destructive')}>{formatBDT(r.totalDue)}</span>,
    }),
  ];

  return (
    <div>
      <ReportToolbar
        title="Customer groups"
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
        exportDoc={() => ({
          kpis: [
            { label: 'Net sales', value: formatBDT(totals.netSales) },
            { label: 'Invoices', value: formatNumber(totals.saleCount) },
          ],
          sections: [tableSection(columns, rows)],
        })}
      />

      <div className="px-6 py-4 space-y-4">
        <ReportKpis className="lg:grid-cols-3">
          <ReportKpi hero label="Net sales" value={formatBDT(totals.netSales)} loading={res.loading && !res.data} />
          <ReportKpi label="Invoices" value={formatNumber(totals.saleCount)} loading={res.loading && !res.data} />
          <ReportKpi label="Customers" value={formatNumber(totals.customers)} loading={res.loading && !res.data} />
        </ReportKpis>

        <ReportTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.group}
          loading={res.loading}
          error={res.error}
          onRetry={res.reload}
          empty={{ icon: Users, title: 'No sales in this period.', message: 'Try another date range.' }}
        />
      </div>
    </div>
  );
}
