import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, HandCoins, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { toCustomer, type BackendCustomer } from '@/hooks/contactAdapter';
import { toSaleRecord, type BackendSale } from '@/hooks/saleAdapter';
import type { Customer } from '@/types/domain';
import type { SaleRecord } from '@/stores/sales';
import { EmptyState } from '@/components/ui/EmptyState';
import { groupLabel, groupVariant, TH } from '@/components/contacts/shared';
import { ReceivePaymentModal } from '@/components/contacts/ReceivePaymentModal';
import { formatBDT, cn } from '@/lib/utils';

type Bucket = 'all' | '0-30' | '30-60' | '60-90' | '90+';

export default function CustomerDues() {
  const nav = useNavigate();
  /**
   * WHOLE-LIST AGGREGATE — this screen is an aging report: every customer with a
   * due, and the age of each one's OLDEST unpaid invoice. `useCustomers().items`
   * and `useSales().sales` are ONE PAGE each, so reading them would quietly
   * report the aging of whatever happened to be loaded. Both inputs therefore
   * come from the UNPAGED channels (`customers.list` carries the derived `due`,
   * `sales.list` carries per-invoice `due` + date). The arithmetic below is
   * unchanged — only the source of the rows moved.
   */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  // Bumped after a payment so the aging figures reload (they no longer ride on a
  // store hydrate). IPC calls are FIFO on one channel, so this read lands after
  // the payment writes.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void Promise.all([
      api<BackendCustomer[]>('customers.list', {}),
      api<BackendSale[]>('sales.list', {}),
    ])
      .then(([customerRows, saleRows]) => {
        if (!alive) return;
        setCustomers(customerRows.map(toCustomer));
        setSales(saleRows.map(toSaleRecord));
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        // Channel error or running outside Electron — show the empty state
        // rather than a partial figure.
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const [q, setQ] = useState('');
  const [bucket, setBucket] = useState<Bucket>('all');
  const [payFor, setPayFor] = useState<string | null>(null);

  // For each customer with due, find the OLDEST unpaid invoice and compute its age
  const rows = useMemo(() => {
    const today = new Date();
    return customers
      .filter((c) => c.due > 0)
      .map((c) => {
        const invoices = sales
          .filter((s) => s.status === 'final' && s.customerId === c.id && s.due > 0)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const oldest = invoices[0];
        const age = oldest
          ? Math.floor((today.getTime() - new Date(oldest.date).getTime()) / 86_400_000)
          : 0;
        let bucketTag: Exclude<Bucket, 'all'> = '0-30';
        if (age >= 90) bucketTag = '90+';
        else if (age >= 60) bucketTag = '60-90';
        else if (age >= 30) bucketTag = '30-60';
        return { c, oldest, age, bucketTag };
      })
      .sort((a, b) => b.age - a.age);
  }, [customers, sales]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (q && !`${r.c.name} ${r.c.phone}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (bucket !== 'all' && r.bucketTag !== bucket) return false;
      return true;
    });
  }, [rows, q, bucket]);

  const totals = {
    customers: rows.length,
    total: rows.reduce((s, r) => s + r.c.due, 0),
    b1: rows.filter((r) => r.bucketTag === '0-30').reduce((s, r) => s + r.c.due, 0),
    b2: rows.filter((r) => r.bucketTag === '30-60').reduce((s, r) => s + r.c.due, 0),
    b3: rows.filter((r) => r.bucketTag === '60-90').reduce((s, r) => s + r.c.due, 0),
    b4: rows.filter((r) => r.bucketTag === '90+').reduce((s, r) => s + r.c.due, 0),
  };

  return (
    <div>
      <PageHeader
        title="Customer Dues"
        subtitle={loading ? 'Loading…' : undefined}
        // The SMS reminder buttons are gone: there was no gateway behind them,
        // so they never sent anything. Collecting a due is done from the row.
      />

      <div className="p-6 space-y-4">
        {/* Aging buckets */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Bucket
            label="Total"
            value={formatBDT(totals.total)}
            active={bucket === 'all'}
            onClick={() => setBucket('all')}
          />
          <Bucket
            label="0–30 days"
            value={formatBDT(totals.b1)}
            active={bucket === '0-30'}
            onClick={() => setBucket('0-30')}
            tone="default"
          />
          <Bucket
            label="30–60 days"
            value={formatBDT(totals.b2)}
            active={bucket === '30-60'}
            onClick={() => setBucket('30-60')}
            tone={totals.b2 > 0 ? 'warning' : undefined}
          />
          <Bucket
            label="60–90 days"
            value={formatBDT(totals.b3)}
            active={bucket === '60-90'}
            onClick={() => setBucket('60-90')}
            tone={totals.b3 > 0 ? 'warning' : undefined}
          />
          <Bucket
            label="90+ days"
            value={formatBDT(totals.b4)}
            active={bucket === '90+'}
            onClick={() => setBucket('90+')}
            tone={totals.b4 > 0 ? 'destructive' : undefined}
          />
        </div>

        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name / phone…"
              className="pl-9"
              aria-label="Search"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className={cn(TH, 'text-left pl-4')}>Customer</th>
                <th className={cn(TH, 'text-left')}>Phone</th>
                <th className={cn(TH, 'text-left')}>Group</th>
                <th className={cn(TH, 'text-right')}>Outstanding</th>
                <th className={cn(TH, 'text-right')}>Limit</th>
                <th className={cn(TH, 'text-right')}>Age</th>
                <th className={cn(TH, 'w-32')}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const overLimit = !!r.c.creditLimit && r.c.due >= r.c.creditLimit;
                return (
                  <tr
                    key={r.c.id}
                    onClick={() => nav(`/contacts/customers/${r.c.id}`)}
                    className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-semibold">{r.c.name}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{r.c.phone}</td>
                    <td className="px-3 py-3">
                      <Badge variant={groupVariant(r.c.group)}>{groupLabel(r.c.group)}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right tabular font-semibold text-destructive">
                      {formatBDT(r.c.due, { withSymbol: false })}
                    </td>
                    <td className="px-3 py-3 text-right tabular text-muted-foreground whitespace-nowrap">
                      {r.c.creditLimit ? formatBDT(r.c.creditLimit, { withSymbol: false }) : '—'}
                      {overLimit && (
                        <AlertTriangle className="size-3.5 inline ml-1 text-destructive" aria-label="Over limit" />
                      )}
                    </td>
                    <td className="px-3 py-3 text-right" title={r.oldest ? r.oldest.invoiceNo : undefined}>
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
                          r.bucketTag === '90+'
                            ? 'bg-destructive/15 text-destructive'
                            : r.bucketTag === '60-90'
                              ? 'bg-warning/15 text-warning'
                              : r.bucketTag === '30-60'
                                ? 'bg-warning/10 text-warning'
                                : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        <span className="tabular">{r.age}</span> <span>days</span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" onClick={() => setPayFor(r.c.id)}>
                        <HandCoins className="size-4 text-success" /> Receive
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    {loading ? (
                      <div className="px-4 py-12 text-center text-muted-foreground">Loading customer dues…</div>
                    ) : (
                      <EmptyState compact title="No customer dues match these filters." />
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <ReceivePaymentModal
        open={!!payFor}
        onClose={() => {
          setPayFor(null);
          setReloadKey((k) => k + 1);
        }}
        customerId={payFor}
      />
    </div>
  );
}

function Bucket({
  label,
  value,
  active,
  onClick,
  tone,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
  tone?: 'default' | 'warning' | 'destructive';
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-xl border p-4 text-left transition',
        active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:bg-secondary/40',
      )}
    >
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div
        className={cn(
          'text-lg font-bold mt-0.5 tabular',
          tone === 'destructive' && 'text-destructive',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </div>
    </button>
  );
}
