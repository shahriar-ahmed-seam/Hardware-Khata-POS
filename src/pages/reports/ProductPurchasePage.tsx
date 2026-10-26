import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package } from 'lucide-react';
import { ReportToolbar, ReportSelect, DEFAULT_RANGE, type DateRange } from '@/components/reports/ReportToolbar';
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
import { useCategories } from '@/hooks/useCatalog';
import { useBranchId } from '@/hooks/useReport';
import { formatBDT, formatNumber } from '@/lib/utils';

interface Row {
  productId: string;
  name: string;
  sku: string;
  category: string;
  categoryId: string;
  qty: number;
  spend: number;
  avgCost: number;
  bills: number;
}

interface BackendPurchaseRow {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  spend: number;
  avgCost: number;
  bills: number;
}
interface BackendProductRow {
  id: string;
  sku: string;
  category_id?: string | null;
  category_name?: string | null;
}

export default function ProductPurchasePage() {
  const nav = useNavigate();
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const branchId = useBranchId(branch);
  const res = useReportQuery<BackendPurchaseRow[]>('reports.productPurchase', { range, branchId }, [range, branchId]);
  const { data: products } = useReportQuery<BackendProductRow[]>('products.list', {}, []);
  const categories = useCategories().data ?? [];

  const rows: Row[] = useMemo(() => {
    if (!res.data) return [];
    const cat = new Map((products ?? []).map((p) => [p.sku, p]));
    let list = res.data.map((r) => ({
      ...r,
      category: cat.get(r.sku)?.category_name ?? '—',
      categoryId: cat.get(r.sku)?.category_id ?? '',
    }));
    if (categoryId) list = list.filter((r) => r.categoryId === categoryId);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => `${r.name} ${r.sku}`.toLowerCase().includes(t));
    }
    return list;
  }, [res.data, products, categoryId, q]);

  const totals = useMemo(
    () => ({ qty: rows.reduce((a, r) => a + r.qty, 0), spend: rows.reduce((a, r) => a + r.spend, 0) }),
    [rows],
  );

  const columns: ReportColumn<Row>[] = useMemo(
    () => [
      { key: 'name', header: 'Product', text: (r) => r.name, sort: (r) => r.name, cell: (r) => <NameCell name={r.name} sub={r.sku} /> },
      { key: 'category', header: 'Category', text: (r) => r.category, sort: (r) => r.category, className: 'text-muted-foreground' },
      numCol('qty', 'Units', (r) => r.qty, { totalValue: totals.qty }),
      moneyCol('avg', 'Average cost', (r) => r.avgCost),
      moneyCol('spend', 'Spent', (r) => r.spend, { totalValue: totals.spend, strong: true }),
      // A bill with several products counts once per product, so no total here.
      numCol('bills', 'Bills', (r) => r.bills),
    ],
    [totals],
  );
  const sorted = useSortedRows(rows, columns, { key: 'spend', dir: 'desc' });

  return (
    <div>
      <ReportToolbar
        title="Purchases by product"
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
            { label: 'Total spent', value: formatBDT(totals.spend) },
            { label: 'Units bought', value: formatNumber(totals.qty) },
          ],
          sections: [tableSection(columns, sorted.rows)],
        })}
      />

      <div className="px-6 py-4 space-y-4">
        <ReportKpis className="lg:grid-cols-3">
          <ReportKpi hero label="Total spent" value={formatBDT(totals.spend)} loading={res.loading && !res.data} />
          <ReportKpi label="Units bought" value={formatNumber(totals.qty)} loading={res.loading && !res.data} />
        </ReportKpis>

        <ReportTable
          columns={columns}
          rows={sorted.rows}
          sort={sorted.sort}
          onSort={sorted.onSort}
          rowKey={(r) => r.productId}
          onRowClick={(r) => nav(`/products/${r.productId}`)}
          loading={res.loading}
          error={res.error}
          onRetry={res.reload}
          empty={{ icon: Package, title: 'No purchases in this period.', message: 'Try another date range.' }}
        />
      </div>
    </div>
  );
}
