import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandCoins } from 'lucide-react';
import { ReportToolbar, DEFAULT_RANGE, type DateRange } from '@/components/reports/ReportToolbar';
import { ReportKpi, ReportKpis } from '@/components/reports/ReportKpi';
import { ReportTable, moneyCol, numCol, tableSection, type ReportColumn } from '@/components/reports/ReportTable';
import { useReportQuery } from '@/components/reports/useReportQuery';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBranchId } from '@/hooks/useReport';
import { formatBDT, formatNumber } from '@/lib/utils';

/**
 * One `reports.salesRep` row (one per active commission agent). There is no
 * payout ledger, so nothing is shown as "paid" — only what was earned.
 */
interface AgentRow {
  id: string;
  name: string;
  commissionPct: number;
  saleCount: number;
  grossSales: number;
  returns: number;
  netSales: number;
  commissionEarned: number;
}

export default function SalesRepPage() {
  const nav = useNavigate();
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');

  const branchId = useBranchId(branch);
  const res = useReportQuery<AgentRow[]>('reports.salesRep', { range, branchId }, [range, branchId]);

  const rows = useMemo(() => {
    let list = [...(res.data ?? [])].sort((a, b) => b.netSales - a.netSales);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(t));
    }
    return list;
  }, [res.data, q]);
  // The backend returns every active agent, so an empty answer means none are set up.
  const noAgents = !res.loading && !res.error && !!res.data && res.data.length === 0;

  const totals = useMemo(
    () => ({
      saleCount: rows.reduce((a, r) => a + r.saleCount, 0),
      grossSales: rows.reduce((a, r) => a + r.grossSales, 0),
      returns: rows.reduce((a, r) => a + r.returns, 0),
      netSales: rows.reduce((a, r) => a + r.netSales, 0),
      commission: rows.reduce((a, r) => a + r.commissionEarned, 0),
    }),
    [rows],
  );

  const columns: ReportColumn<AgentRow>[] = [
    { key: 'name', header: 'Agent', text: (r) => r.name, className: 'font-medium' },
    { key: 'rate', header: 'Rate', align: 'right', text: (r) => `${r.commissionPct}%`, csv: (r) => r.commissionPct },
    numCol('sales', 'Invoices', (r) => r.saleCount, { totalValue: totals.saleCount }),
    moneyCol('gross', 'Gross sales', (r) => r.grossSales, { totalValue: totals.grossSales }),
    moneyCol('returns', 'Returns', (r) => r.returns, { totalValue: totals.returns, className: 'text-muted-foreground' }),
    moneyCol('net', 'Net sales', (r) => r.netSales, { totalValue: totals.netSales }),
    moneyCol('commission', 'Commission', (r) => r.commissionEarned, { totalValue: totals.commission, strong: true }),
  ];

  return (
    <div>
      <ReportToolbar
        title="Sales agents"
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
        search={noAgents ? undefined : { value: q, onChange: setQ, placeholder: 'Search agent…' }}
        exportDoc={
          noAgents
            ? undefined
            : () => ({
                kpis: [
                  { label: 'Commission earned', value: formatBDT(totals.commission) },
                  { label: 'Net sales', value: formatBDT(totals.netSales) },
                ],
                sections: [tableSection(columns, rows)],
              })
        }
      />

      <div className="px-6 py-4 space-y-4">
        {noAgents ? (
          <Card>
            <EmptyState
              icon={HandCoins}
              title="No sales agents yet"
              message="Add an agent and pick them on a sale to track their commission."
              action={<Button onClick={() => nav('/settings/sales-agents')}>Add sales agent</Button>}
            />
          </Card>
        ) : (
          <>
            <ReportKpis className="lg:grid-cols-3">
              <ReportKpi hero label="Commission earned" value={formatBDT(totals.commission)} loading={res.loading && !res.data} />
              <ReportKpi label="Net sales" value={formatBDT(totals.netSales)} loading={res.loading && !res.data} />
              <ReportKpi label="Invoices" value={formatNumber(totals.saleCount)} loading={res.loading && !res.data} />
            </ReportKpis>
            <ReportTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              loading={res.loading}
              error={res.error}
              onRetry={res.reload}
              empty={{ icon: HandCoins, title: 'No agents match.', message: 'Clear the search.' }}
            />
            <p className="text-xs text-muted-foreground">Commission = net sales × rate. Returns in the period reduce net sales.</p>
          </>
        )}
      </div>
    </div>
  );
}
