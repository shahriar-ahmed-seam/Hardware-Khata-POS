import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import { ReportKpi, ReportKpis } from '@/components/reports/ReportKpi';
import { ReportTable, NameCell, moneyCol, numCol, tableSection, type ReportColumn } from '@/components/reports/ReportTable';
import { useReportQuery } from '@/components/reports/useReportQuery';
import { useBranchId } from '@/hooks/useReport';
import { formatBDT, formatNumber, cn } from '@/lib/utils';

interface AlertItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  reorderLevel: number;
  unit: string;
  category: string;
  /** Enough to reach twice the reorder level (at least 1). */
  orderQty: number;
  orderCost: number;
}

/** `dashboard.lowStock` (low + out items). */
interface BackendLowStock {
  id: string;
  name: string;
  sku: string;
  reorder_level: number;
  cost: number;
  stock: number;
}
interface BackendProductRow {
  id: string;
  unit?: string | null;
  category_name?: string | null;
}

/** Low stock — a live list; no dates. */
export default function StockAlertReportPage() {
  const nav = useNavigate();
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'low' | 'out'>('low');

  const branchId = useBranchId(branch);
  const low = useReportQuery<BackendLowStock[]>('dashboard.lowStock', { limit: 200, branchId }, [branchId]);
  const { data: products } = useReportQuery<BackendProductRow[]>('products.list', {}, []);

  const all: AlertItem[] = useMemo(() => {
    const meta = new Map((products ?? []).map((p) => [p.id, p]));
    return (low.data ?? []).map((p) => {
      const orderQty = Math.max(1, p.reorder_level * 2 - p.stock);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        reorderLevel: p.reorder_level,
        unit: meta.get(p.id)?.unit ?? 'pc',
        category: meta.get(p.id)?.category_name ?? '—',
        orderQty,
        orderCost: orderQty * p.cost,
      };
    });
  }, [low.data, products]);

  const lowItems = useMemo(() => all.filter((p) => p.stock > 0 && p.stock <= p.reorderLevel), [all]);
  const outItems = useMemo(() => all.filter((p) => p.stock <= 0), [all]);
  const rows = useMemo(() => {
    const list = tab === 'low' ? lowItems : outItems;
    if (!q) return list;
    const t = q.toLowerCase();
    return list.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(t));
  }, [tab, lowItems, outItems, q]);
  const orderTotal = rows.reduce((a, p) => a + p.orderCost, 0);

  const columns: ReportColumn<AlertItem>[] = [
    { key: 'name', header: 'Product', text: (r) => r.name, cell: (r) => <NameCell name={r.name} sub={r.sku} /> },
    { key: 'category', header: 'Category', text: (r) => r.category, className: 'text-muted-foreground' },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      text: (r) => `${formatNumber(r.stock)} ${r.unit}`,
      csv: (r) => r.stock,
      cell: (r) => (
        <span className={cn('font-medium', r.stock <= 0 && 'text-destructive')}>
          {formatNumber(r.stock)} {r.unit}
        </span>
      ),
    },
    numCol('reorder', 'Reorder level', (r) => r.reorderLevel, { className: 'text-muted-foreground' }),
    numCol('orderQty', 'Order qty', (r) => r.orderQty, { className: 'font-medium' }),
    moneyCol('orderCost', 'Order cost', (r) => r.orderCost, { totalValue: orderTotal }),
  ];

  return (
    <div>
      <ReportToolbar
        title="Low stock"
        asOf="Stock as of"
        branch={branch}
        onBranchChange={setBranch}
        search={{ value: q, onChange: setQ, placeholder: 'Search product or SKU…' }}
        exportDoc={() => ({
          kpis: [
            { label: 'Low stock', value: formatNumber(lowItems.length) },
            { label: 'Out of stock', value: formatNumber(outItems.length) },
            { label: 'Order cost', value: formatBDT(orderTotal) },
          ],
          sections: [tableSection(columns, rows, { heading: tab === 'low' ? 'Low stock' : 'Out of stock' })],
        })}
      />

      <div className="px-6 py-4 space-y-4">
        {/* The two counts are the tabs. */}
        <ReportKpis className="lg:grid-cols-3">
          <ReportKpi
            label="Low stock"
            value={formatNumber(lowItems.length)}
            tone={lowItems.length > 0 ? 'warn' : 'default'}
            active={tab === 'low'}
            onClick={() => setTab('low')}
            sub="At or below the reorder level"
          />
          <ReportKpi
            label="Out of stock"
            value={formatNumber(outItems.length)}
            tone={outItems.length > 0 ? 'bad' : 'default'}
            active={tab === 'out'}
            onClick={() => setTab('out')}
            sub="None left"
          />
          <ReportKpi label="Order cost" value={formatBDT(orderTotal)} sub="Ordering up to twice the reorder level" />
        </ReportKpis>

        <ReportTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => nav(`/products/${r.id}`)}
          loading={low.loading}
          error={low.error}
          onRetry={low.reload}
          empty={{
            icon: AlertTriangle,
            title: tab === 'low' ? 'Nothing is running low.' : 'Nothing is out of stock.',
            message: 'Products appear here when they reach their reorder level.',
          }}
        />
      </div>
    </div>
  );
}
