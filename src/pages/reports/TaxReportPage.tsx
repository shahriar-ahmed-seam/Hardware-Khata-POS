import { useMemo, useState } from 'react';
import { Percent } from 'lucide-react';
import { ReportToolbar, DEFAULT_RANGE, type DateRange } from '@/components/reports/ReportToolbar';
import { ReportKpi, ReportKpis } from '@/components/reports/ReportKpi';
import { ReportTable, ReportError, moneyCol, numCol, tableSection, type ReportColumn } from '@/components/reports/ReportTable';
import { useReportQuery } from '@/components/reports/useReportQuery';
import { Card } from '@/components/ui/Card';
import { useBranchId } from '@/hooks/useReport';
import { formatBDT, formatNumber } from '@/lib/utils';

interface TaxRow {
  rate: number;
  count: number;
  taxable: number;
  tax: number;
}

/** `reports.tax`. */
interface BackendTax {
  salesByRate: { rate: number; invoices: number; taxable: number; tax: number }[];
  purchaseByRate: { rate: number; bills: number; taxable: number; tax: number }[];
  salesTotal: number;
  purchaseTotal: number;
  net: number;
}

const cols = (countHeader: string, taxHeader: string, rows: TaxRow[], total: number): ReportColumn<TaxRow>[] => [
  { key: 'rate', header: 'Rate', text: (r) => `${r.rate.toFixed(1)}%`, csv: (r) => r.rate, className: 'font-medium tabular' },
  numCol('count', countHeader, (r) => r.count, { totalValue: rows.reduce((a, r) => a + r.count, 0) }),
  moneyCol('taxable', 'Taxable amount', (r) => r.taxable, { totalValue: rows.reduce((a, r) => a + r.taxable, 0) }),
  moneyCol('tax', taxHeader, (r) => r.tax, { totalValue: total, strong: true }),
];

/** VAT report: sales VAT and purchase VAT, both always shown (one row per rate). */
export default function TaxReportPage() {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');

  const branchId = useBranchId(branch);
  const res = useReportQuery<BackendTax>('reports.tax', { range, branchId }, [range, branchId]);
  const be = res.data;
  const waiting = res.loading && !be;

  const sales: TaxRow[] = useMemo(
    () => (be?.salesByRate ?? []).map((r) => ({ rate: r.rate, count: r.invoices, taxable: r.taxable, tax: r.tax })),
    [be],
  );
  const purchases: TaxRow[] = useMemo(
    () => (be?.purchaseByRate ?? []).map((r) => ({ rate: r.rate, count: r.bills, taxable: r.taxable, tax: r.tax })),
    [be],
  );
  const salesCols = cols('Invoices', 'VAT collected', sales, be?.salesTotal ?? 0);
  const purchaseCols = cols('Bills', 'VAT paid', purchases, be?.purchaseTotal ?? 0);
  const net = be?.net ?? 0;

  return (
    <div>
      <ReportToolbar
        title="VAT report"
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
        exportDoc={
          be
            ? () => ({
                kpis: [
                  { label: 'Net VAT', value: formatBDT(net) },
                  { label: 'Sales VAT collected', value: formatBDT(be.salesTotal) },
                  { label: 'Purchase VAT paid', value: formatBDT(be.purchaseTotal) },
                ],
                sections: [
                  tableSection(salesCols, sales, { heading: 'Sales VAT by rate' }),
                  tableSection(purchaseCols, purchases, { heading: 'Purchase VAT by rate' }),
                ],
              })
            : undefined
        }
      />

      <div className="px-6 py-4 space-y-4">
        {res.error ? (
          <Card>
            <ReportError onRetry={res.reload} />
          </Card>
        ) : (
          <>
            <ReportKpis className="lg:grid-cols-3">
              <ReportKpi
                hero
                label="Net VAT"
                value={formatBDT(net)}
                tone={net < 0 ? 'good' : 'default'}
                loading={waiting}
                sub={net >= 0 ? 'Owed to government' : 'Refundable'}
              />
              <ReportKpi
                label="Sales VAT collected"
                value={formatBDT(be?.salesTotal ?? 0)}
                loading={waiting}
                sub={
                  <span className="tabular">
                    <span>Invoices:</span> {formatNumber(sales.reduce((a, r) => a + r.count, 0))}
                  </span>
                }
              />
              <ReportKpi
                label="Purchase VAT paid"
                value={formatBDT(be?.purchaseTotal ?? 0)}
                loading={waiting}
                sub={
                  <span className="tabular">
                    <span>Bills:</span> {formatNumber(purchases.reduce((a, r) => a + r.count, 0))}
                  </span>
                }
              />
            </ReportKpis>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <ReportTable
                heading="Sales VAT by rate"
                columns={salesCols}
                rows={sales}
                rowKey={(r) => String(r.rate)}
                loading={res.loading}
                empty={{ icon: Percent, title: 'No VAT on sales in this period.' }}
              />
              <ReportTable
                heading="Purchase VAT by rate"
                columns={purchaseCols}
                rows={purchases}
                rowKey={(r) => String(r.rate)}
                loading={res.loading}
                empty={{ icon: Percent, title: 'No VAT on purchases in this period.' }}
              />
            </div>

            <details className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium focus-ring rounded">About these numbers</summary>
              <p className="mt-2 text-muted-foreground">
                Use Sales VAT collected as your output VAT, and Purchase VAT paid as your input VAT. Net VAT is what you
                owe (or can claim back) before any credits or rebates. Check with your accountant before filing with NBR.
              </p>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
