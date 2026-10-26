import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package } from 'lucide-react';
import { ReportToolbar, ReportSelect, DEFAULT_RANGE, resolveRange, type DateRange } from '@/components/reports/ReportToolbar';
import { ReportKpi, ReportKpis } from '@/components/reports/ReportKpi';
import {
  ReportTable,
  NameCell,
  moneyCol,
  numCol,
  tableSection,
  useSortedRows,
  type ReportColumn,
} from '@/components/reports/ReportTable';
import { useReportQuery } from '@/components/reports/useReportQuery';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { Badge } from '@/components/ui/Badge';
import { useCategories } from '@/hooks/useCatalog';
import { useBranchId } from '@/hooks/useReport';
import { useDateFormat } from '@/lib/formatDate';
import { formatBDT, formatNumber, cn } from '@/lib/utils';

interface Row {
  productId: string;
  name: string;
  sku: string;
  category: string;
  categoryId: string;
  qty: number;
  revenue: number;
  profit: number;
  marginPct: number;
  invoices: number;
  /** Units in the previous period of the same length; null = not in the comparison list. */
  previous: number | null;
  deltaPct: number | null;
}

interface BackendSellRow {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  invoices: number;
}
interface BackendTrendRow {
  productId: string;
  current: number;
  previous: number;
  deltaPct: number;
}
interface BackendProductRow {
  id: string;
  sku: string;
  category_id?: string | null;
  category_name?: string | null;
}

const pct = (n: number) => `${n.toFixed(1)}%`;

/** Sales by product. Also hosts the old Trending report as "Compare with previous period". */
export default function ProductSellPage() {
  const nav = useNavigate();
  const df = useDateFormat();
  const [params] = useSearchParams();
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [compare, setCompare] = useState(params.get('compare') === '1');

  const branchId = useBranchId(branch);
  const sell = useReportQuery<BackendSellRow[]>('reports.productSell', { range, branchId }, [range, branchId]);
  const trend = useReportQuery<BackendTrendRow[]>(
    'reports.trending',
    compare ? { range, branchId, metric: 'qty' } : null,
    [range, branchId, compare],
  );
  const { data: products } = useReportQuery<BackendProductRow[]>('products.list', {}, []);
  const categories = useCategories().data ?? [];

  const rows: Row[] = useMemo(() => {
    if (!sell.data) return [];
    const cat = new Map((products ?? []).map((p) => [p.sku, p]));
    const prev = new Map((trend.data ?? []).map((t) => [t.productId, t]));
    let list = sell.data.map((r) => {
      const c = cat.get(r.sku);
      const t = prev.get(r.productId);
      return {
        productId: r.productId,
        name: r.name,
        sku: r.sku,
        category: c?.category_name ?? '—',
        categoryId: c?.category_id ?? '',
        qty: r.qty,
        revenue: r.revenue,
        profit: r.profit,
        marginPct: r.marginPct,
        invoices: r.invoices,
        previous: t ? t.previous : null,
        deltaPct: t ? t.deltaPct : null,
      };
    });
    if (categoryId) list = list.filter((r) => r.categoryId === categoryId);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => `${r.name} ${r.sku}`.toLowerCase().includes(t));
    }
    return list;
  }, [sell.data, products, trend.data, categoryId, q]);

  const totals = useMemo(
    () => ({
      qty: rows.reduce((a, r) => a + r.qty, 0),
      revenue: rows.reduce((a, r) => a + r.revenue, 0),
      profit: rows.reduce((a, r) => a + r.profit, 0),
      invoices: rows.reduce((a, r) => a + r.invoices, 0),
    }),
    [rows],
  );
  const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  // The comparison period: same length, right before the chosen one (as the backend does).
  const prevLabel = useMemo(() => {
    const { from, to } = resolveRange(range);
    const span = to.getTime() - from.getTime();
    return `${df.date(new Date(from.getTime() - span - 1))} – ${df.date(new Date(from.getTime() - 1))}`;
  }, [range, df]);

  const changeText = (r: Row) =>
    r.previous === null ? '—' : r.previous === 0 ? 'New' : `${r.deltaPct! > 0 ? '+' : ''}${r.deltaPct!.toFixed(0)}%`;

  const columns: ReportColumn<Row>[] = useMemo(() => {
    const product: ReportColumn<Row> = {
      key: 'name',
      header: 'Product',
      text: (r) => r.name,
      sort: (r) => r.name,
      cell: (r) => <NameCell name={r.name} sub={compare ? `${r.sku} · ${r.category}` : r.sku} />,
    };
    const units = numCol<Row>('qty', 'Units', (r) => r.qty, { totalValue: totals.qty });
    const sales = moneyCol<Row>('revenue', 'Sales', (r) => r.revenue, { totalValue: totals.revenue, strong: true });
    const profit = moneyCol<Row>('profit', 'Profit', (r) => r.profit, { totalValue: totals.profit });
    // Profit over sales; the stock side shows markup over cost, hence the label.
    const margin: ReportColumn<Row> = {
      key: 'margin',
      header: 'Margin on sales',
      align: 'right',
      text: (r) => pct(r.marginPct),
      csv: (r) => r.marginPct,
      sort: (r) => r.marginPct,
      cell: (r) => <span className={cn(r.marginPct < 0 && 'text-destructive')}>{pct(r.marginPct)}</span>,
      total: pct(totalMargin),
    };
    if (!compare) {
      return [
        product,
        { key: 'category', header: 'Category', text: (r) => r.category, sort: (r) => r.category, className: 'text-muted-foreground' },
        units,
        numCol<Row>('invoices', 'Invoices', (r) => r.invoices, { totalValue: totals.invoices }),
        sales,
        profit,
        margin,
      ];
    }
    return [
      product,
      units,
      {
        key: 'previous',
        header: 'Units before',
        align: 'right',
        text: (r) => (r.previous === null ? '—' : formatNumber(r.previous)),
        csv: (r) => r.previous ?? '',
        sort: (r) => r.previous ?? -1,
        className: 'text-muted-foreground',
      },
      {
        key: 'change',
        header: 'Change',
        align: 'right',
        text: changeText,
        csv: changeText,
        sort: (r) => (r.previous === 0 ? Number.MAX_SAFE_INTEGER : (r.deltaPct ?? -Infinity)),
        word: true,
        cell: (r) =>
          r.previous === 0 ? (
            <Badge variant="info">New</Badge>
          ) : (
            <span className={cn(r.deltaPct !== null && r.deltaPct < 0 && 'text-destructive')}>{changeText(r)}</span>
          ),
      },
      sales,
      profit,
      margin,
    ];
  }, [compare, totals, totalMargin]);

  const sorted = useSortedRows(rows, columns, { key: compare ? 'qty' : 'revenue', dir: 'desc' });

  return (
    <div>
      <ReportToolbar
        title="Sales by product"
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
        search={{ value: q, onChange: setQ, placeholder: 'Search product or SKU…' }}
        filters={
          <ReportSelect aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </ReportSelect>
        }
        exportDoc={() => ({
          kpis: [
            { label: 'Sales before bill discounts', value: formatBDT(totals.revenue) },
            { label: 'Profit', value: formatBDT(totals.profit) },
            { label: 'Units sold', value: formatNumber(totals.qty) },
          ],
          sections: [tableSection(columns, sorted.rows)],
        })}
      />

      <div className="px-6 py-4 space-y-4">
        <ReportKpis>
          <ReportKpi hero label="Sales before bill discounts" value={formatBDT(totals.revenue)} loading={sell.loading && !sell.data} />
          <ReportKpi
            label="Profit"
            value={formatBDT(totals.profit)}
            tone={totals.profit < 0 ? 'bad' : 'good'}
            loading={sell.loading && !sell.data}
          />
          <ReportKpi label="Units sold" value={formatNumber(totals.qty)} loading={sell.loading && !sell.data} />
          <div className="rounded-xl border border-border bg-card px-4 py-2 flex flex-col justify-center">
            <ToggleRow label="Compare with previous period" checked={compare} onChange={setCompare} />
            {compare && (
              <div className="text-xs text-muted-foreground tabular">
                <span>Compared with</span> <span>{prevLabel}</span>
              </div>
            )}
          </div>
        </ReportKpis>

        <ReportTable
          columns={columns}
          rows={sorted.rows}
          sort={sorted.sort}
          onSort={sorted.onSort}
          rowKey={(r) => r.productId}
          onRowClick={(r) => nav(`/products/${r.productId}`)}
          loading={sell.loading}
          error={sell.error}
          onRetry={sell.reload}
          empty={{ icon: Package, title: 'No sales in this period.', message: 'Try another date range.' }}
          notice={
            compare && trend.data && trend.data.length >= 50 ? (
              <span>Units before are shown for the top 50 products.</span>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
