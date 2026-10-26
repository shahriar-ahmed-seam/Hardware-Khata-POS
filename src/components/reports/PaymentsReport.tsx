import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Banknote } from 'lucide-react';
import { ReportToolbar, ReportSelect, DEFAULT_RANGE, isDatePreset, type DateRange } from './ReportToolbar';
import { ReportKpi } from './ReportKpi';
import { ReportTable, moneyCol, type ReportColumn, tableSection } from './ReportTable';
import { useReportQuery } from './useReportQuery';
import { useBranchId } from '@/hooks/useReport';
import { useDateFormat } from '@/lib/formatDate';
import { labelFor } from '@/lib/labels';
import { formatBDT, formatNumber } from '@/lib/utils';

/**
 * Money collected (sales) and Money paid to suppliers share this page: method
 * cards for the methods actually used, then one row per payment.
 */
export interface PaymentRow {
  id: string;
  date: string;
  ref: string;
  party: string;
  method: string;
  amount: number;
  reference?: string;
  user: string;
}

interface Summary {
  byMethod: { method: string; amount: number; cnt: number }[];
  total: number;
}
interface RowsResult<R> {
  rows: R[];
  total: number;
  truncated: boolean;
}

interface Props<R> {
  title: string;
  summaryChannel: string;
  rowsChannel: string;
  mapRow: (r: R) => PaymentRow;
  refHeader: string;
  partyHeader: string;
  userHeader: string;
  searchPlaceholder: string;
  defaultRange?: DateRange;
}

/** "Credit" is a sale left on the khata, not money in hand. */
const methodLabel = (m: string) => (m === 'Credit' ? 'On khata' : labelFor('paymentMethod', m));

export function PaymentsReport<R>({
  title,
  summaryChannel,
  rowsChannel,
  mapRow,
  refHeader,
  partyHeader,
  userHeader,
  searchPlaceholder,
  defaultRange = DEFAULT_RANGE,
}: Props<R>) {
  const df = useDateFormat();
  const [params] = useSearchParams();
  const urlPreset = params.get('preset');
  const [range, setRange] = useState<DateRange>(
    isDatePreset(urlPreset) && urlPreset !== 'custom' ? { preset: urlPreset } : defaultRange,
  );
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('');

  const branchId = useBranchId(branch);
  const sum = useReportQuery<Summary>(summaryChannel, { range, branchId }, [range, branchId]);
  const det = useReportQuery<RowsResult<R>>(rowsChannel, { range, branchId }, [range, branchId]);

  const methods = useMemo(
    () => (sum.data?.byMethod ?? []).filter((m) => m.cnt > 0).sort((a, b) => b.amount - a.amount),
    [sum.data],
  );
  const total = sum.data?.total ?? 0;

  const rows = useMemo(() => {
    let list = (det.data?.rows ?? []).map(mapRow);
    if (method) list = list.filter((r) => r.method === method);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => `${r.ref} ${r.party} ${r.reference ?? ''} ${r.user}`.toLowerCase().includes(t));
    }
    return list;
    // mapRow is a stable module-level function in both pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [det.data, q, method]);

  // Filtered on screen → the footer sums what is shown and says so.
  const narrowed = !!method || !!q;
  const footTotal = narrowed ? rows.reduce((a, r) => a + r.amount, 0) : total;

  const screenColumns: ReportColumn<PaymentRow>[] = [
    {
      key: 'date',
      header: 'Date',
      text: (r) => df.dateTime(r.date),
      sort: (r) => r.date,
      cell: (r) => (
        <div className="whitespace-nowrap tabular">
          <div>{df.date(r.date)}</div>
          <div className="text-xs text-muted-foreground">{df.time(r.date)}</div>
        </div>
      ),
    },
    { key: 'ref', header: refHeader, text: (r) => r.ref, className: 'whitespace-nowrap' },
    { key: 'party', header: partyHeader, text: (r) => r.party, cell: (r) => <span className="block truncate max-w-[16rem]">{r.party}</span> },
    {
      key: 'method',
      header: 'Method',
      word: true,
      text: (r) => methodLabel(r.method),
      cell: (r) => (
        <div>
          <div>{methodLabel(r.method)}</div>
          {r.reference && <div className="text-xs text-muted-foreground truncate max-w-[12rem]">{r.reference}</div>}
        </div>
      ),
    },
    { key: 'user', header: userHeader, text: (r) => r.user || '—', className: 'text-muted-foreground' },
    moneyCol<PaymentRow>('amount', 'Amount', (r) => r.amount, {
      strong: true,
      total: formatBDT(footTotal),
      csvTotal: footTotal,
    }),
  ];
  // The transaction ID is a sub-line on screen but its own column on paper/CSV.
  const columns: ReportColumn<PaymentRow>[] = [
    ...screenColumns.slice(0, 4),
    { key: 'reference', header: 'Transaction ID', text: (r) => r.reference ?? '' },
    ...screenColumns.slice(4),
  ];

  return (
    <div>
      <ReportToolbar
        title={title}
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
        search={{ value: q, onChange: setQ, placeholder: searchPlaceholder }}
        filters={
          <ReportSelect aria-label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">All methods</option>
            {methods.map((m) => (
              <option key={m.method} value={m.method}>
                {methodLabel(m.method)}
              </option>
            ))}
          </ReportSelect>
        }
        exportDoc={() => ({
          kpis: [
            { label: 'Total', value: formatBDT(total) },
            ...methods.map((m) => ({ label: methodLabel(m.method), value: formatBDT(m.amount) })),
          ],
          sections: [tableSection(columns, rows, { totalLabel: narrowed ? 'Shown' : 'Total' })],
        })}
      />

      <div className="px-6 py-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <ReportKpi hero label="Total" value={formatBDT(total)} loading={sum.loading && !sum.data} />
          {methods.map((m) => (
            <ReportKpi
              key={m.method}
              label={methodLabel(m.method)}
              value={formatBDT(m.amount)}
              active={method === m.method}
              onClick={() => setMethod((cur) => (cur === m.method ? '' : m.method))}
              sub={
                <span className="tabular">
                  {formatNumber(m.cnt)} <span>payments</span> · {total > 0 ? ((m.amount / total) * 100).toFixed(0) : 0}%
                </span>
              }
            />
          ))}
        </div>

        <ReportTable
          columns={screenColumns}
          rows={rows}
          rowKey={(r, i) => r.id || String(i)}
          loading={sum.loading || det.loading}
          error={sum.error || det.error}
          onRetry={() => {
            sum.reload();
            det.reload();
          }}
          totalLabel={narrowed ? 'Shown' : 'Total'}
          empty={{ icon: Banknote, title: 'No payments in this period.', message: 'Try another date range.' }}
          notice={
            det.data?.truncated ? (
              <span className="tabular">
                <span>Showing latest:</span> {formatNumber(det.data.rows.length)} <span>of</span>{' '}
                {formatNumber(det.data.total)}
              </span>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
