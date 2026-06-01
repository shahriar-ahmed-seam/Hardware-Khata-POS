import { useMemo, useState } from 'react';
import { Search, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  isInRange,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useCustomers, useSuppliers } from '@/stores/contacts';
import { useSales } from '@/stores/sales';
import { usePurchases } from '@/stores/purchases';
import { useReport } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

type Mode = 'customers' | 'suppliers';

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  group: string;
  creditLimit: number;
  sales: number;
  paid: number;
  count: number;
  due: number;
}

interface SupplierRow {
  id: string;
  name: string;
  phone: string;
  company?: string;
  terms?: string;
  spend: number;
  paid: number;
  count: number;
  due: number;
}

/** A `customers.list` row (snake_case + derived totals from customerTotals). */
interface BackendCustomerRow {
  id: string;
  name: string;
  phone?: string | null;
  price_group?: string | null;
  credit_limit?: number | null;
  due?: number;
  totalPurchase?: number;
  totalPaid?: number;
  saleCount?: number;
}

/** A `suppliers.list` row (snake_case + derived totals from supplierTotals). */
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

export default function ContactsReportPage() {
  const [mode, setMode] = useState<Mode>('customers');
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');

  const customers = useCustomers((s) => s.items);
  const suppliers = useSuppliers((s) => s.items);
  const sales = useSales((s) => s.sales);
  const purchases = usePurchases((s) => s.purchases);

  // Backend wiring: list rows already carry derived due/totalPurchase/totalPaid
  // and sale/purchase counts. NOTE: those derived totals are LIFETIME figures,
  // so the date range does not slice the backed numbers (range still applies to
  // the mock fallback) — acceptable for a contacts rollup report.
  const { data: beCustomers, loading: loadingC, backend, error } = useReport<BackendCustomerRow[]>(
    'customers.list',
    hasBackend() ? {} : null,
    [],
  );
  const { data: beSuppliers, loading: loadingS } = useReport<BackendSupplierRow[]>(
    'suppliers.list',
    hasBackend() ? {} : null,
    [],
  );
  const loading = mode === 'customers' ? loadingC : loadingS;

  const mockCustomerRows = useMemo(() => {
    const fSales = sales.filter(
      (s) => s.status === 'final' && isInRange(s.date, range) && (!branch || s.branch === branch),
    );
    const map = new Map<string, { sales: number; paid: number; count: number }>();
    fSales.forEach((s) => {
      const existing = map.get(s.customerId) ?? { sales: 0, paid: 0, count: 0 };
      existing.sales += s.total;
      existing.paid += s.paid;
      existing.count += 1;
      map.set(s.customerId, existing);
    });

    let list = customers.map((c) => {
      const m = map.get(c.id) ?? { sales: 0, paid: 0, count: 0 };
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        group: c.group,
        creditLimit: c.creditLimit ?? 0,
        sales: m.sales,
        paid: m.paid,
        count: m.count,
        due: c.due,
      };
    });

    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => `${r.name} ${r.phone}`.toLowerCase().includes(t));
    }
    return list.sort((a, b) => b.sales - a.sales);
  }, [customers, sales, range, branch, q]);

  const mockSupplierRows = useMemo(() => {
    const fPurchases = purchases.filter(
      (p) => p.status !== 'cancelled' && isInRange(p.date, range) && (!branch || p.branch === branch),
    );
    const map = new Map<string, { spend: number; paid: number; count: number }>();
    fPurchases.forEach((p) => {
      const existing = map.get(p.supplierId) ?? { spend: 0, paid: 0, count: 0 };
      existing.spend += p.total;
      existing.paid += p.paid;
      existing.count += 1;
      map.set(p.supplierId, existing);
    });

    let list = suppliers.map((s) => {
      const m = map.get(s.id) ?? { spend: 0, paid: 0, count: 0 };
      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        company: s.company,
        terms: s.paymentTerms,
        spend: m.spend,
        paid: m.paid,
        count: m.count,
        due: s.due,
      };
    });

    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) =>
        `${r.name} ${r.phone} ${r.company ?? ''}`.toLowerCase().includes(t),
      );
    }
    return list.sort((a, b) => b.spend - a.spend);
  }, [suppliers, purchases, range, branch, q]);

  // Map backend customer rows (lifetime derived totals) → page row shape.
  const backendCustomerRows: CustomerRow[] | null = useMemo(() => {
    if (!backend || !beCustomers) return null;
    let list = beCustomers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? '',
      group: c.price_group ?? 'Retail',
      creditLimit: c.credit_limit ?? 0,
      sales: c.totalPurchase ?? 0,
      paid: c.totalPaid ?? 0,
      count: c.saleCount ?? 0,
      due: c.due ?? 0,
    }));
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => `${r.name} ${r.phone}`.toLowerCase().includes(t));
    }
    return list.sort((a, b) => b.sales - a.sales);
  }, [backend, beCustomers, q]);

  const backendSupplierRows: SupplierRow[] | null = useMemo(() => {
    if (!backend || !beSuppliers) return null;
    let list = beSuppliers.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone ?? '',
      company: s.company ?? undefined,
      terms: s.payment_terms ?? undefined,
      spend: s.totalPurchase ?? 0,
      paid: s.totalPaid ?? 0,
      count: s.purchaseCount ?? 0,
      due: s.due ?? 0,
    }));
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) =>
        `${r.name} ${r.phone} ${r.company ?? ''}`.toLowerCase().includes(t),
      );
    }
    return list.sort((a, b) => b.spend - a.spend);
  }, [backend, beSuppliers, q]);

  const customerRows: CustomerRow[] = backend && error ? [] : (backendCustomerRows ?? mockCustomerRows);
  const supplierRows: SupplierRow[] = backend && error ? [] : (backendSupplierRows ?? mockSupplierRows);

  const totals = useMemo(() => {
    if (mode === 'customers') {
      return {
        count: customerRows.length,
        sales: customerRows.reduce((a, r) => a + r.sales, 0),
        paid: customerRows.reduce((a, r) => a + r.paid, 0),
        due: customerRows.reduce((a, r) => a + r.due, 0),
      };
    }
    return {
      count: supplierRows.length,
      sales: supplierRows.reduce((a, r) => a + r.spend, 0),
      paid: supplierRows.reduce((a, r) => a + r.paid, 0),
      due: supplierRows.reduce((a, r) => a + r.due, 0),
    };
  }, [mode, customerRows, supplierRows]);

  return (
    <div>
      <ReportToolbar
        title="Customer / Supplier Report"
        subtitle={`${formatNumber(totals.count)} ${mode} · ${formatBDT(totals.sales)} ${
          mode === 'customers' ? 'sales' : 'purchases'
        }`}
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
      />

      <div className="p-6 space-y-4 max-w-6xl">
        <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-md w-fit">
          {(['customers', 'suppliers'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'h-8 px-3 rounded text-sm font-medium capitalize transition',
                mode === m
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Total" value={formatNumber(totals.count)} />
          <Kpi
            label={mode === 'customers' ? 'Sales' : 'Purchases'}
            value={formatBDT(totals.sales)}
            tone="primary"
          />
          <Kpi
            label={mode === 'customers' ? 'Collected' : 'Paid'}
            value={formatBDT(totals.paid)}
            tone="success"
          />
          <Kpi label="Outstanding" value={formatBDT(totals.due)} tone="warning" />
        </div>

        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${mode}…`}
              className="pl-9"
            />
          </div>
        </Card>

        {mode === 'customers' ? (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1.6fr_0.8fr_0.7fr_1fr_1fr_1fr_0.6fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              <div>Customer</div>
              <div>Group</div>
              <div className="text-right">Sales #</div>
              <div className="text-right">Total sales</div>
              <div className="text-right">Collected</div>
              <div className="text-right">Due</div>
              <div />
            </div>
            {customerRows.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                {backend && loading ? 'Loading…' : backend && error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No customers match.'}
              </div>
            )}
            {customerRows.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1.6fr_0.8fr_0.7fr_1fr_1fr_1fr_0.6fr] gap-2 px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/30 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">{c.phone}</div>
                </div>
                <div>
                  <Badge variant="default">{c.group}</Badge>
                </div>
                <div className="tabular text-right">{formatNumber(c.count)}</div>
                <div className="tabular text-right font-medium">{formatBDT(c.sales)}</div>
                <div className="tabular text-right text-success">{formatBDT(c.paid)}</div>
                <div
                  className={cn(
                    'tabular text-right font-medium',
                    c.due > 0 ? 'text-warning' : 'text-muted-foreground',
                  )}
                >
                  {formatBDT(c.due)}
                </div>
                <div className="flex items-center justify-end">
                  <Link
                    to={`/contacts/customers/${c.id}`}
                    className="text-muted-foreground hover:text-primary"
                    title="Open ledger"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1.6fr_1fr_0.7fr_1fr_1fr_1fr_0.6fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
              <div>Supplier</div>
              <div>Terms</div>
              <div className="text-right">Bills #</div>
              <div className="text-right">Total spend</div>
              <div className="text-right">Paid</div>
              <div className="text-right">Due</div>
              <div />
            </div>
            {supplierRows.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                {backend && loading ? 'Loading…' : backend && error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No suppliers match.'}
              </div>
            )}
            {supplierRows.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[1.6fr_1fr_0.7fr_1fr_1fr_1fr_0.6fr] gap-2 px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/30 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {s.company ?? s.phone}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{s.terms ?? '—'}</div>
                <div className="tabular text-right">{formatNumber(s.count)}</div>
                <div className="tabular text-right font-medium">{formatBDT(s.spend)}</div>
                <div className="tabular text-right text-success">{formatBDT(s.paid)}</div>
                <div
                  className={cn(
                    'tabular text-right font-medium',
                    s.due > 0 ? 'text-warning' : 'text-muted-foreground',
                  )}
                >
                  {formatBDT(s.due)}
                </div>
                <div className="flex items-center justify-end">
                  <Link
                    to={`/contacts/suppliers/${s.id}`}
                    className="text-muted-foreground hover:text-primary"
                    title="Open ledger"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'success' | 'warning';
}) {
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label}
      </div>
      <div
        className={cn(
          'tabular font-bold text-lg mt-1',
          tone === 'primary' && 'text-primary',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </div>
    </Card>
  );
}
