import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes } from 'lucide-react';
import { ReportToolbar, ReportSelect } from '@/components/reports/ReportToolbar';
import { ReportKpi, ReportKpis } from '@/components/reports/ReportKpi';
import { ReportTable, NameCell, moneyCol, tableSection, type ReportColumn } from '@/components/reports/ReportTable';
import { useReportQuery } from '@/components/reports/useReportQuery';
import { Badge } from '@/components/ui/Badge';
import { useCategories, useBrands } from '@/hooks/useCatalog';
import { useBranchId } from '@/hooks/useReport';
import { formatBDT, formatNumber } from '@/lib/utils';

type StockState = '' | 'in' | 'low' | 'out';

interface StockRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  reorder: number;
  cost: number;
  price: number;
  valueAtCost: number;
  valueAtRetail: number;
  state: string;
  categoryId: string;
  brandId: string;
}

interface BackendStock {
  rows: {
    id: string;
    name: string;
    sku: string;
    cost: number;
    price: number;
    reorder_level: number;
    stock: number;
    valueAtCost: number;
    valueAtRetail: number;
    state: string;
  }[];
  totalValueAtCost: number;
  totalValueAtRetail: number;
}
interface BackendProductRow {
  id: string;
  category_id?: string | null;
  category_name?: string | null;
  brand_id?: string | null;
  unit?: string | null;
}

const STATE_LABEL: Record<string, string> = { in: 'In stock', low: 'Low', out: 'Out of stock' };

/** A live snapshot: `reports.stock` takes no date, so the toolbar shows "as of now". */
export default function StockReportPage() {
  const nav = useNavigate();
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [stockState, setStockState] = useState<StockState>('');

  const branchId = useBranchId(branch);
  const stock = useReportQuery<BackendStock>('reports.stock', { branchId }, [branchId]);
  const { data: products } = useReportQuery<BackendProductRow[]>('products.list', {}, []);
  const categories = useCategories().data ?? [];
  const brands = useBrands().data ?? [];

  // Filtered by category/brand/search, before the Low/Out toggle (the KPI counts use this).
  const base: StockRow[] = useMemo(() => {
    if (!stock.data) return [];
    const meta = new Map((products ?? []).map((p) => [p.id, p]));
    let list = stock.data.rows.map((r) => {
      const m = meta.get(r.id);
      return {
        id: r.id,
        sku: r.sku,
        name: r.name,
        category: m?.category_name ?? '—',
        unit: m?.unit ?? 'pc',
        stock: r.stock,
        reorder: r.reorder_level,
        cost: r.cost,
        price: r.price,
        valueAtCost: r.valueAtCost,
        valueAtRetail: r.valueAtRetail,
        state: r.state,
        categoryId: m?.category_id ?? '',
        brandId: m?.brand_id ?? '',
      };
    });
    if (categoryId) list = list.filter((r) => r.categoryId === categoryId);
    if (brandId) list = list.filter((r) => r.brandId === brandId);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => `${r.name} ${r.sku}`.toLowerCase().includes(t));
    }
    return list;
  }, [stock.data, products, categoryId, brandId, q]);
  const rows = useMemo(() => (stockState ? base.filter((r) => r.state === stockState) : base), [base, stockState]);

  const totals = useMemo(
    () => ({
      cost: base.reduce((a, r) => a + r.valueAtCost, 0),
      retail: base.reduce((a, r) => a + r.valueAtRetail, 0),
      low: base.filter((r) => r.state === 'low').length,
      out: base.filter((r) => r.state === 'out').length,
      shownCost: rows.reduce((a, r) => a + r.valueAtCost, 0),
    }),
    [base, rows],
  );

  const columns: ReportColumn<StockRow>[] = [
    { key: 'name', header: 'Product', text: (r) => r.name, cell: (r) => <NameCell name={r.name} sub={r.sku} /> },
    { key: 'category', header: 'Category', text: (r) => r.category, className: 'text-muted-foreground' },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      text: (r) => `${formatNumber(r.stock)} ${r.unit}`,
      csv: (r) => r.stock,
      cell: (r) => (
        <div>
          <div className="font-medium">
            {formatNumber(r.stock)} {r.unit}
          </div>
          {r.reorder > 0 && (
            <div className="text-xs text-muted-foreground">
              <span>Reorder at</span> {formatNumber(r.reorder)}
            </div>
          )}
        </div>
      ),
    },
    moneyCol('cost', 'Cost', (r) => r.cost),
    moneyCol('price', 'Sale price', (r) => r.price),
    moneyCol('value', 'Value at cost', (r) => r.valueAtCost, { totalValue: totals.shownCost }),
    {
      key: 'state',
      header: 'Status',
      word: true,
      text: (r) => STATE_LABEL[r.state] ?? r.state,
      // A badge only where it needs attention.
      cell: (r) =>
        r.state === 'out' ? (
          <Badge variant="destructive">Out of stock</Badge>
        ) : r.state === 'low' ? (
          <Badge variant="warning">Low</Badge>
        ) : null,
    },
  ];

  const toggle = (s: StockState) => setStockState((cur) => (cur === s ? '' : s));

  return (
    <div>
      <ReportToolbar
        title="Stock report"
        asOf="Stock as of"
        branch={branch}
        onBranchChange={setBranch}
        search={{ value: q, onChange: setQ, placeholder: 'Search product or SKU…' }}
        filters={
          <>
            <ReportSelect aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </ReportSelect>
            <ReportSelect aria-label="Brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </ReportSelect>
          </>
        }
        exportDoc={() => ({
          kpis: [
            { label: 'Stock value at cost', value: formatBDT(totals.cost) },
            { label: 'Stock value at sale price', value: formatBDT(totals.retail) },
            { label: 'Low', value: formatNumber(totals.low) },
            { label: 'Out of stock', value: formatNumber(totals.out) },
          ],
          sections: [tableSection(columns, rows)],
        })}
      />

      <div className="px-6 py-4 space-y-4">
        <ReportKpis>
          <ReportKpi hero label="Stock value at cost" value={formatBDT(totals.cost)} loading={stock.loading && !stock.data} />
          <ReportKpi label="Stock value at sale price" value={formatBDT(totals.retail)} loading={stock.loading && !stock.data} />
          <ReportKpi
            label="Low"
            value={formatNumber(totals.low)}
            tone={totals.low > 0 ? 'warn' : 'default'}
            active={stockState === 'low'}
            onClick={() => toggle('low')}
            sub="Click to show only these"
          />
          <ReportKpi
            label="Out of stock"
            value={formatNumber(totals.out)}
            tone={totals.out > 0 ? 'bad' : 'default'}
            active={stockState === 'out'}
            onClick={() => toggle('out')}
            sub="Click to show only these"
          />
        </ReportKpis>

        <ReportTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => nav(`/products/${r.id}`)}
          loading={stock.loading}
          error={stock.error}
          onRetry={stock.reload}
          empty={{ icon: Boxes, title: 'No products match.', message: 'Clear the search or filters.' }}
        />
      </div>
    </div>
  );
}
