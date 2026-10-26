import { useMemo, useState } from 'react';
import { Sliders } from 'lucide-react';
import { ReportToolbar, ReportSelect, DEFAULT_RANGE, isInRange, type DateRange } from '@/components/reports/ReportToolbar';
import { ReportKpi, ReportKpis } from '@/components/reports/ReportKpi';
import { ReportTable, moneyCol, tableSection, type ReportColumn } from '@/components/reports/ReportTable';
import { useReportQuery } from '@/components/reports/useReportQuery';
import { useUserNameOf } from '@/components/stock/hooks';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { type AdjustmentType } from '@/stores/stock';
import { useBranchId } from '@/hooks/useReport';
import { useDateFormat } from '@/lib/formatDate';
import { labelFor } from '@/lib/labels';
import { formatBDT, formatNumber } from '@/lib/utils';

const ADJ_TYPES: AdjustmentType[] = ['damage', 'theft', 'sample', 'recount', 'other'];
const normalizeType = (t: string): AdjustmentType =>
  (ADJ_TYPES as string[]).includes(t) ? (t as AdjustmentType) : 'other';

interface AdjRow {
  id: string;
  refNo: string;
  date: string;
  branch: string;
  type: AdjustmentType;
  by: string;
  names: string[];
  value: number;
}

/** `adjustments.list` row with its lines (signed qty; loss is negative). */
interface BackendAdjustment {
  id: string;
  ref_no: string;
  date: string;
  branch_id: string;
  type: string;
  created_by?: string | null;
  lines: { name?: string | null; qty: number; unit_cost: number }[];
}

export default function StockAdjustmentReportPage() {
  const df = useDateFormat();
  const nameOf = useUserNameOf();
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [type, setType] = useState<AdjustmentType | ''>('');

  // The channel takes no filters: range, branch and type are applied here.
  const branchId = useBranchId(branch);
  const res = useReportQuery<BackendAdjustment[]>('adjustments.list', {}, []);

  const rows: AdjRow[] = useMemo(
    () =>
      (res.data ?? [])
        .map((a) => ({
          id: a.id,
          refNo: a.ref_no,
          date: a.date,
          branch: a.branch_id,
          type: normalizeType(a.type),
          by: a.created_by ?? '',
          names: a.lines.map((l) => l.name ?? '—'),
          value: a.lines.reduce((s, l) => s + l.qty * l.unit_cost, 0),
        }))
        .filter((a) => isInRange(a.date, range))
        .filter((a) => !branchId || a.branch === branchId)
        .filter((a) => !type || a.type === type)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [res.data, range, branchId, type],
  );

  const totals = useMemo(() => {
    let loss = 0;
    let found = 0;
    for (const a of res.data ?? []) {
      if (!rows.some((r) => r.id === a.id)) continue;
      for (const l of a.lines) {
        const v = l.qty * l.unit_cost;
        if (v < 0) loss += v;
        else found += v;
      }
    }
    return { loss, found, net: loss + found };
  }, [res.data, rows]);

  const byType = useMemo(() => {
    const m = new Map<AdjustmentType, { count: number; value: number }>();
    for (const r of rows) {
      const e = m.get(r.type) ?? { count: 0, value: 0 };
      e.count += 1;
      e.value += r.value;
      m.set(r.type, e);
    }
    return Array.from(m.entries());
  }, [rows]);

  const columns: ReportColumn<AdjRow>[] = [
    { key: 'date', header: 'Date', text: (r) => df.date(r.date), className: 'whitespace-nowrap tabular' },
    { key: 'ref', header: 'Ref', text: (r) => r.refNo, className: 'whitespace-nowrap' },
    {
      key: 'type',
      header: 'Type',
      word: true,
      text: (r) => labelFor('adjustmentType', r.type),
      cell: (r) => (
        <Badge variant={r.type === 'damage' || r.type === 'theft' ? 'destructive' : 'default'}>
          {labelFor('adjustmentType', r.type)}
        </Badge>
      ),
    },
    {
      key: 'products',
      header: 'Products',
      text: (r) => r.names.join(', '),
      // What was lost, at a glance: the first product, then how many more.
      cell: (r) => (
        <span className="block max-w-[22rem] truncate" title={r.names.join(', ')}>
          {r.names[0] ?? '—'}
          {r.names.length > 1 && (
            <span className="text-muted-foreground">
              {' '}
              +{r.names.length - 1} <span>more</span>
            </span>
          )}
        </span>
      ),
    },
    moneyCol('value', 'Value', (r) => r.value, { totalValue: totals.net, strong: true }),
    { key: 'by', header: 'By', text: (r) => (r.by ? nameOf(r.by) : '—'), className: 'text-muted-foreground' },
  ];

  return (
    <div>
      <ReportToolbar
        title="Stock adjustments"
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
        filters={
          <ReportSelect aria-label="Type" value={type} onChange={(e) => setType(e.target.value as AdjustmentType | '')}>
            <option value="">All types</option>
            {ADJ_TYPES.map((t) => (
              <option key={t} value={t}>
                {labelFor('adjustmentType', t)}
              </option>
            ))}
          </ReportSelect>
        }
        exportDoc={() => ({
          kpis: [
            { label: 'Net value', value: formatBDT(totals.net) },
            { label: 'Stock lost', value: formatBDT(Math.abs(totals.loss)) },
            { label: 'Stock found', value: formatBDT(totals.found) },
          ],
          sections: [tableSection(columns, rows)],
        })}
      />

      <div className="px-6 py-4 space-y-4">
        <ReportKpis className="lg:grid-cols-3">
          <ReportKpi
            hero
            label="Net value"
            value={formatBDT(totals.net)}
            tone={totals.net < 0 ? 'bad' : 'default'}
            loading={res.loading && !res.data}
          />
          <ReportKpi
            label="Stock lost"
            value={formatBDT(Math.abs(totals.loss))}
            tone={totals.loss < 0 ? 'bad' : 'default'}
            loading={res.loading && !res.data}
          />
          <ReportKpi label="Stock found" value={formatBDT(totals.found)} loading={res.loading && !res.data} />
        </ReportKpis>

        {byType.length > 1 && (
          <Card className="px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="font-semibold">By type</span>
            {byType.map(([t, d]) => (
              <span key={t} className="tabular">
                <span className="text-muted-foreground">{labelFor('adjustmentType', t)}</span>{' '}
                <span className="font-medium">{formatBDT(d.value)}</span>{' '}
                <span className="text-muted-foreground">
                  ({formatNumber(d.count)})
                </span>
              </span>
            ))}
          </Card>
        )}

        <ReportTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={res.loading}
          error={res.error}
          onRetry={res.reload}
          empty={{ icon: Sliders, title: 'No adjustments in this period.', message: 'Try another date range.' }}
        />
      </div>
    </div>
  );
}
