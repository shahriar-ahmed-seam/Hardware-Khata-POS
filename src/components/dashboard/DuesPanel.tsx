import { Link } from 'react-router-dom';
import { HandCoins, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PhoneAction, isCallable } from '@/components/ui/PhoneAction';
import { useDashboardData } from '@/hooks/useDashboardData';
import { formatBDT } from '@/lib/utils';

/**
 * WHO OWES US, AND WHO WE OWE - ON THE DASHBOARD.
 *
 * The owner asked to see the people carrying dues and part-payments without
 * digging. Both lists already existed as optional widgets nobody had switched on,
 * which meant the answer to "who has not paid me" was three clicks away on the
 * one screen that is open all day.
 *
 * WHERE THE NUMBERS COME FROM - and what they do and do not mean.
 * These are the customer/supplier BALANCES the backend derives from the
 * underlying sales, purchases, payments and returns (balances are never stored
 * running totals - see the architecture rules). A balance above zero is money
 * outstanding, whether it came from one wholly unpaid invoice or five that were
 * part-paid, which is exactly the figure you want before picking up the phone.
 *
 * The phone number is shown because it is what the employee does next. Nothing
 * here is estimated: a customer with no number on file says so.
 */
export function DuesPanel() {
  const { data, loading } = useDashboardData();

  const customers = data?.customerDues ?? [];
  const suppliers = data?.supplierDues ?? [];
  const owedToUs = customers.reduce((s, c) => s + c.due, 0);
  const owedByUs = suppliers.reduce((s, c) => s + c.due, 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card className="p-4">
        <Header
          title="Customers who owe us"
          total={owedToUs}
          count={customers.length}
          to="/contacts/dues"
          actionLabel="Collect"
          tone="destructive"
        />
        <List
          rows={customers}
          loading={loading && !data}
          emptyLabel="Nobody owes you anything right now."
          hrefFor={(id) => `/contacts/customers/${id}`}
        />
      </Card>

      <Card className="p-4">
        <Header
          title="Suppliers we owe"
          total={owedByUs}
          count={suppliers.length}
          to="/contacts/suppliers"
          actionLabel="Manage"
          tone="warning"
        />
        <List
          rows={suppliers}
          loading={loading && !data}
          emptyLabel="You are square with every supplier."
          hrefFor={(id) => `/contacts/suppliers/${id}`}
        />
      </Card>
    </div>
  );
}

function Header({
  title,
  total,
  count,
  to,
  actionLabel,
  tone,
}: {
  title: string;
  total: number;
  count: number;
  to: string;
  actionLabel: string;
  tone: 'destructive' | 'warning';
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <HandCoins className="size-4 text-muted-foreground shrink-0" />
          {/* One complete phrase per node, for the Bangla layer. */}
          <div className="text-sm font-semibold truncate">{title}</div>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={
              tone === 'destructive'
                ? 'text-lg font-bold tabular text-destructive'
                : 'text-lg font-bold tabular text-warning'
            }
          >
            {formatBDT(total)}
          </span>
          <Badge variant="default">
            {count} {count === 1 ? 'account' : 'accounts'}
          </Badge>
        </div>
      </div>
      <Link
        to={to}
        className="text-[11px] inline-flex items-center gap-1 text-primary hover:underline shrink-0 mt-1"
      >
        {actionLabel} <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}

function List({
  rows,
  loading,
  emptyLabel,
  hrefFor,
}: {
  rows: { id: string; name: string; due: number; phone?: string; group?: string }[];
  loading: boolean;
  emptyLabel: string;
  hrefFor: (id: string) => string;
}) {
  if (loading) {
    return <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (rows.length === 0) {
    return <div className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</div>;
  }
  return (
    <div className="rounded-lg border border-border divide-y divide-border">
      {/* Capped at eight: this is a prompt to act, not the ledger. The link above
          goes to the full list. */}
      {rows.slice(0, 8).map((r) => {
        const callable = isCallable(r.phone) ? r.phone : null;
        return (
          <div key={r.id} className="flex items-center gap-2 px-3 py-2">
            <Link to={hrefFor(r.id)} className="min-w-0 flex-1 group">
              <div className="text-sm font-medium truncate group-hover:text-primary">{r.name}</div>
              <div className="text-[11px] text-muted-foreground font-mono truncate">
                {callable ?? 'No phone on file'}
              </div>
            </Link>
            <div className="text-sm font-mono tabular font-semibold shrink-0">
              {formatBDT(r.due, { withSymbol: false })}
            </div>
            {callable && <PhoneAction phone={callable} label={r.name} className="h-8 px-2" />}
          </div>
        );
      })}
      {rows.length > 8 && (
        <div className="px-3 py-2 text-[11px] text-muted-foreground">
          and {rows.length - 8} more
        </div>
      )}
    </div>
  );
}
