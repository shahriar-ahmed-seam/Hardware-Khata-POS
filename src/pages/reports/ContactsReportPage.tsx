import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
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
import { Segmented } from '@/components/ui/Segmented';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { labelFor } from '@/lib/labels';
import { formatBDT, cn } from '@/lib/utils';

type Mode = 'customers' | 'suppliers';

/** One customer or supplier, with lifetime totals. */
interface Row {
  id: string;
  name: string;
  sub: string;
  /** Customer price group, or supplier payment terms. */
  extra: string;
  count: number;
  total: number;
  paid: number;
  due: number;
}

interface BackendCustomerRow {
  id: string;
  name: string;
  phone?: string | null;
  price_group?: string | null;
  due?: number;
  totalPurchase?: number;
  totalPaid?: number;
  saleCount?: number;
}
interface BackendSupplierRow {
  id: string;
  name: string;
  phone?: string | null;
  company?: string | null;
  payment_terms?: string | null;
  due?: number;
  totalPurchase?: number;
  totalPaid?: number;
  purchaseCount?: number;
}

/** Balances are lifetime figures (the list channels take no dates), so no date presets. */
export default function ContactsReportPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>('customers');
  const [q, setQ] = useState('');
  const [onlyDue, setOnlyDue] = useState(true);

  const cust = useReportQuery<BackendCustomerRow[]>('customers.list', {}, []);
  const supp = useReportQuery<BackendSupplierRow[]>('suppliers.list', {}, []);
  const cur = mode === 'customers' ? cust : supp;
  const isCust = mode === 'customers';

  const all: Row[] = useMemo(() => {
    if (isCust) {
      return (cust.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        sub: c.phone ?? '',
        extra: labelFor('priceGroup', c.price_group ?? 'retail'),
        count: c.saleCount ?? 0,
        total: c.totalPurchase ?? 0,
        paid: c.totalPaid ?? 0,
        due: c.due ?? 0,
      }));
    }
    return (supp.data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      sub: s.company ?? s.phone ?? '',
      extra: s.payment_terms ?? '—',
      count: s.purchaseCount ?? 0,
      total: s.totalPurchase ?? 0,
      paid: s.totalPaid ?? 0,
      due: s.due ?? 0,
    }));
  }, [isCust, cust.data, supp.data]);

  const searched = useMemo(() => {
    if (!q) return all;
    const t = q.toLowerCase();
    return all.filter((r) => `${r.name} ${r.sub}`.toLowerCase().includes(t));
  }, [all, q]);
  const rows = useMemo(() => (onlyDue ? searched.filter((r) => r.due > 0) : searched), [searched, onlyDue]);

  // KPIs cover everyone matching the search, not only those with a due.
  const totals = useMemo(
    () => ({
      total: searched.reduce((a, r) => a + r.total, 0),
      paid: searched.reduce((a, r) => a + r.paid, 0),
      due: searched.reduce((a, r) => a + r.due, 0),
      shownDue: rows.reduce((a, r) => a + r.due, 0),
      shownTotal: rows.reduce((a, r) => a + r.total, 0),
      shownPaid: rows.reduce((a, r) => a + r.paid, 0),
    }),
    [searched, rows],
  );

  const columns: ReportColumn<Row>[] = useMemo(
    () => [
      {
        key: 'name',
        header: isCust ? 'Customer' : 'Supplier',
        text: (r) => r.name,
        sort: (r) => r.name,
        cell: (r) => <NameCell name={r.name} sub={r.sub} />,
      },
      { key: 'extra', header: isCust ? 'Group' : 'Terms', text: (r) => r.extra, word: isCust, className: 'text-muted-foreground' },
      numCol('count', isCust ? 'Invoices' : 'Bills', (r) => r.count),
      moneyCol('total', isCust ? 'Total sales' : 'Total purchases', (r) => r.total, { totalValue: totals.shownTotal }),
      moneyCol('paid', isCust ? 'Collected' : 'Paid', (r) => r.paid, { totalValue: totals.shownPaid }),
      moneyCol('due', 'Due', (r) => r.due, {
        totalValue: totals.shownDue,
        cell: (r) => (
          <span className={cn('font-medium', r.due > 0 ? 'text-destructive' : 'text-muted-foreground')}>
            {formatBDT(r.due)}
          </span>
        ),
      }),
    ],
    [isCust, totals],
  );
  const sorted = useSortedRows(rows, columns, { key: 'due', dir: 'desc' });

  return (
    <div>
      <ReportToolbar
        title="Customer & supplier balances"
        asOf="All time, as of"
        search={{
          value: q,
          onChange: setQ,
          placeholder: isCust ? 'Search customer name or phone…' : 'Search supplier name or company…',
        }}
        filters={
          <Segmented
            ariaLabel="Show"
            value={mode}
            onChange={setMode}
            options={(['customers', 'suppliers'] as Mode[]).map((m) => ({ value: m, label: labelFor('contactMode', m) }))}
          />
        }
        exportDoc={() => ({
          kpis: [
            { label: 'Outstanding', value: formatBDT(totals.due) },
            { label: isCust ? 'Total sales' : 'Total purchases', value: formatBDT(totals.total) },
            { label: isCust ? 'Collected' : 'Paid', value: formatBDT(totals.paid) },
          ],
          sections: [tableSection(columns, sorted.rows, { heading: labelFor('contactMode', mode) })],
        })}
      />

      <div className="px-6 py-4 space-y-4">
        <ReportKpis>
          <ReportKpi
            hero
            label="Outstanding"
            value={formatBDT(totals.due)}
            tone={totals.due > 0 ? 'bad' : 'default'}
            loading={cur.loading && !cur.data}
            sub={isCust ? 'Customers owe you' : 'You owe suppliers'}
          />
          <ReportKpi label={isCust ? 'Total sales' : 'Total purchases'} value={formatBDT(totals.total)} loading={cur.loading && !cur.data} />
          <ReportKpi label={isCust ? 'Collected' : 'Paid'} value={formatBDT(totals.paid)} loading={cur.loading && !cur.data} />
          <div className="rounded-xl border border-border bg-card px-1 flex items-center">
            <ToggleRow label="Only with a due" checked={onlyDue} onChange={setOnlyDue} />
          </div>
        </ReportKpis>

        <ReportTable
          columns={columns}
          rows={sorted.rows}
          sort={sorted.sort}
          onSort={sorted.onSort}
          rowKey={(r) => r.id}
          // The whole row opens the khata.
          onRowClick={(r) => nav(`/contacts/${mode}/${r.id}`)}
          loading={cur.loading}
          error={cur.error}
          onRetry={cur.reload}
          empty={{
            icon: Users,
            title: onlyDue ? 'Nobody has a due.' : 'No one matches.',
            message: onlyDue ? 'Turn off “Only with a due” to see everyone.' : 'Clear the search.',
          }}
        />
      </div>
    </div>
  );
}
