import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ReportToolbar, DEFAULT_RANGE, type DateRange } from '@/components/reports/ReportToolbar';
import { ReportKpi, ReportKpis } from '@/components/reports/ReportKpi';
import { ReportError } from '@/components/reports/ReportTable';
import { useReportQuery } from '@/components/reports/useReportQuery';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useBranchId } from '@/hooks/useReport';
import { formatBDT, cn } from '@/lib/utils';
import { round2, sum2 } from '@/lib/money';

/** `reports.profitLoss` (backend/services/reports.ts). */
interface BackendProfitLoss {
  moneyIn: { totalSalesExclTaxDisc: number; sellShipping: number; sellOther: number; purchaseReturns: number };
  moneyOut: {
    cogs: number;
    /** Cost of goods customers brought back; comes off the cost of goods sold. */
    returnedCost?: number;
    sellReturns: number;
    expenses: number;
    stockAdjustment: number;
  };
  tax: { salesTaxCollected: number; purchaseTaxPaid: number; netVat: number };
  grossProfit: number;
  marginPct: number;
  netProfit: number;
}

interface Line {
  label: string;
  amount: number;
}

export default function ProfitLossPage() {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [allLines, setAllLines] = useState(false);

  const branchId = useBranchId(branch);
  const { data: be, loading, error, reload } = useReportQuery<BackendProfitLoss>(
    'reports.profitLoss',
    { range, branchId },
    [range, branchId],
  );
  const waiting = loading && !be;

  // Same split the backend's net profit uses: income − costs = net profit.
  const income: Line[] = be
    ? [
        { label: 'Sales (after discounts, without VAT)', amount: be.moneyIn.totalSalesExclTaxDisc },
        { label: 'Delivery charges', amount: be.moneyIn.sellShipping },
        { label: 'Other charges', amount: be.moneyIn.sellOther },
      ]
    : [];
  const costs: Line[] = be
    ? [
        { label: 'Cost of goods sold', amount: round2(be.moneyOut.cogs - (be.moneyOut.returnedCost ?? 0)) },
        { label: 'Sell returns', amount: be.moneyOut.sellReturns },
        { label: 'Expenses', amount: be.moneyOut.expenses },
        // A stock loss is a negative adjustment; shown as a cost. Never "-0".
        { label: 'Stock lost (damage, theft)', amount: be.moneyOut.stockAdjustment ? -be.moneyOut.stockAdjustment : 0 },
      ]
    : [];
  const incomeTotal = sum2(income.map((l) => l.amount));
  const costTotal = sum2(costs.map((l) => l.amount));
  const hiddenCount = [...income, ...costs].filter((l) => l.amount === 0).length;
  const shown = (ls: Line[]) => (allLines ? ls : ls.filter((l) => l.amount !== 0));

  const exportDoc = () => ({
    kpis: be
      ? [
          { label: 'Net profit', value: formatBDT(be.netProfit) },
          { label: 'Gross profit', value: formatBDT(be.grossProfit) },
          { label: 'Margin on sales', value: `${be.marginPct.toFixed(1)}%` },
          { label: 'VAT collected', value: formatBDT(be.tax.salesTaxCollected) },
          { label: 'VAT paid on purchases', value: formatBDT(be.tax.purchaseTaxPaid) },
        ]
      : [],
    sections: [
      { heading: 'Sales & income', ls: income, total: incomeTotal },
      { heading: 'Costs', ls: costs, total: costTotal },
    ].map((s) => ({
      heading: s.heading,
      columns: [{ header: 'Line' }, { header: 'Amount', align: 'right' as const }],
      rows: s.ls.map((l) => [l.label, formatBDT(l.amount)]),
      csvRows: s.ls.map((l) => [l.label, l.amount]),
      wordColumns: [0],
      footer: ['Total', formatBDT(s.total)],
      csvFooter: ['Total', s.total],
    })),
  });

  return (
    <div>
      <ReportToolbar
        title="Profit / Loss"
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
        exportDoc={be ? exportDoc : undefined}
      />

      <div className="px-6 py-4 space-y-4">
        {error ? (
          <Card>
            <ReportError onRetry={reload} />
          </Card>
        ) : (
          <>
            <ReportKpis className="lg:grid-cols-3">
              <ReportKpi
                hero
                label="Net profit"
                value={be ? formatBDT(be.netProfit) : ''}
                tone={be && be.netProfit < 0 ? 'bad' : 'good'}
                loading={waiting}
                sub={
                  be && (
                    <span className="tabular">
                      <span>Sales & income</span> {formatBDT(incomeTotal)} − <span>Costs</span> {formatBDT(costTotal)}
                    </span>
                  )
                }
              />
              <ReportKpi label="Gross profit" value={be ? formatBDT(be.grossProfit) : ''} loading={waiting} />
              <ReportKpi
                // Gross profit over sales (not markup over cost).
                label="Margin on sales"
                value={be ? `${be.marginPct.toFixed(1)}%` : ''}
                loading={waiting}
              />
            </ReportKpis>

            {be && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Block title="Sales & income" lines={shown(income)} total={incomeTotal} />
                  <Block title="Costs" lines={shown(costs)} total={costTotal} />
                </div>
                {hiddenCount > 0 && (
                  <Button variant="ghost" onClick={() => setAllLines((v) => !v)}>
                    {allLines ? 'Hide empty lines' : 'Show all lines'}
                  </Button>
                )}

                <Card className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-6 flex-wrap text-sm">
                    <span>
                      <span className="text-muted-foreground">VAT collected</span>{' '}
                      <span className="tabular font-medium">{formatBDT(be.tax.salesTaxCollected)}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">VAT paid on purchases</span>{' '}
                      <span className="tabular font-medium">{formatBDT(be.tax.purchaseTaxPaid)}</span>
                    </span>
                  </div>
                  <Link to="/reports/tax" className="text-sm font-medium text-primary hover:underline focus-ring rounded">
                    Open VAT report
                  </Link>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Block({ title, lines, total }: { title: string; lines: Line[]; total: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-sm">{title}</h2>
        <span className="tabular font-semibold text-sm">{formatBDT(total)}</span>
      </div>
      <ul className="divide-y divide-border">
        {lines.map((l) => (
          <li key={l.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>{l.label}</span>
            <span className={cn('tabular', l.amount < 0 && 'text-destructive')}>{formatBDT(l.amount)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
