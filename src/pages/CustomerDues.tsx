import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, HandCoins, MessageSquare, AlertTriangle, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCustomers } from '@/stores/contacts';
import { useSales } from '@/stores/sales';
import { Avatar } from '@/components/contacts/Avatar';
import { ReceivePaymentModal } from '@/components/contacts/ReceivePaymentModal';
import { formatBDT, cn } from '@/lib/utils';

type Bucket = 'all' | '0-30' | '30-60' | '60-90' | '90+';

export default function CustomerDues() {
  const customers = useCustomers((s) => s.items);
  const hydrate = useCustomers((s) => s.hydrate);
  const sales = useSales((s) => s.sales);
  // Hydrate from the backend on mount so deep-link entry populates the store.
  // The dues aging buckets read sales too, so hydrate that store as well.
  useEffect(() => {
    void hydrate();
    void useSales.getState().hydrate();
  }, [hydrate]);
  const [q, setQ] = useState('');
  const [bucket, setBucket] = useState<Bucket>('all');
  const [payFor, setPayFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.c.id));
  const toggleAll = () =>
    setSelected((sel) => {
      const next = new Set(sel);
      if (allSelected) filtered.forEach((r) => next.delete(r.c.id));
      else filtered.forEach((r) => next.add(r.c.id));
      return next;
    });
  const toggle = (id: string) =>
    setSelected((sel) => {
      const next = new Set(sel);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div>
      <PageHeader
        title="Customer Dues"
        subtitle={`${totals.customers} customers · ${formatBDT(totals.total)} outstanding`}
        actions={
          <Button>
            <MessageSquare className="size-4" /> Send Reminder to All Selected
          </Button>
        }
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
            tone="warning"
          />
          <Bucket
            label="60–90 days"
            value={formatBDT(totals.b3)}
            active={bucket === '60-90'}
            onClick={() => setBucket('60-90')}
            tone="warning"
          />
          <Bucket
            label="90+ days"
            value={formatBDT(totals.b4)}
            active={bucket === '90+'}
            onClick={() => setBucket('90+')}
            tone="destructive"
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
            />
          </div>
        </Card>

        {selected.size > 0 && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 flex items-center gap-2">
            <Badge variant="info">{selected.size} selected</Badge>
            <div className="flex-1" />
            <Button size="sm">
              <MessageSquare className="size-3.5" /> Send Reminder
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="text-left px-3 py-2.5 font-medium">Customer</th>
                <th className="text-left px-2 py-2.5 font-medium">Phone</th>
                <th className="text-left px-2 py-2.5 font-medium">Group</th>
                <th className="text-right px-2 py-2.5 font-medium">Outstanding</th>
                <th className="text-right px-2 py-2.5 font-medium">Limit</th>
                <th className="text-left px-2 py-2.5 font-medium">Oldest invoice</th>
                <th className="text-right px-2 py-2.5 font-medium">Age</th>
                <th className="px-4 py-2.5 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isSel = selected.has(r.c.id);
                const overLimit = !!r.c.creditLimit && r.c.due >= r.c.creditLimit;
                return (
                  <tr
                    key={r.c.id}
                    className={cn(
                      'border-t border-border hover:bg-secondary/40',
                      isSel && 'bg-primary/5',
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={isSel} onChange={() => toggle(r.c.id)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        to={`/contacts/customers/${r.c.id}`}
                        className="flex items-center gap-2.5 hover:text-primary"
                      >
                        <Avatar name={r.c.name} size={32} />
                        <div className="font-semibold">{r.c.name}</div>
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs text-muted-foreground">{r.c.phone}</td>
                    <td className="px-2 py-2.5">
                      <Badge
                        variant={
                          r.c.group === 'Wholesale'
                            ? 'info'
                            : r.c.group === 'Contractor'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {r.c.group}
                      </Badge>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular font-semibold text-destructive">
                      {formatBDT(r.c.due, { withSymbol: false })}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular text-muted-foreground">
                      {r.c.creditLimit ? formatBDT(r.c.creditLimit, { withSymbol: false }) : '—'}
                      {overLimit && <AlertTriangle className="size-3 inline ml-1 text-destructive" />}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground">
                      {r.oldest ? r.oldest.invoiceNo : '—'}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <span
                        className={cn(
                          'text-[11px] font-medium px-2 py-0.5 rounded-full',
                          r.bucketTag === '90+'
                            ? 'bg-destructive/15 text-destructive'
                            : r.bucketTag === '60-90'
                              ? 'bg-warning/15 text-warning'
                              : r.bucketTag === '30-60'
                                ? 'bg-warning/10 text-warning'
                                : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        {r.age}d
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" title="Send reminder SMS">
                          <MessageSquare className="size-3.5" />
                        </Button>
                        <Button size="sm" onClick={() => setPayFor(r.c.id)}>
                          <HandCoins className="size-3.5" /> Receive
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No customer dues match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <ReceivePaymentModal open={!!payFor} onClose={() => setPayFor(null)} customerId={payFor} />
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
      onClick={onClick}
      className={cn(
        'rounded-xl border p-4 text-left transition',
        active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:bg-secondary/40',
      )}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          'text-lg font-bold mt-0.5 font-mono tabular',
          tone === 'destructive' && 'text-destructive',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </div>
      <div className="text-[10px] mt-1 text-muted-foreground inline-flex items-center gap-1">
        Filter <ArrowRight className="size-3" />
      </div>
    </button>
  );
}
