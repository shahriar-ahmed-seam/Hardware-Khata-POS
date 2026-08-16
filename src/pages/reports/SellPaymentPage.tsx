import { useMemo, useState } from 'react';
import { Banknote, Smartphone, CreditCard, Building, Wallet, Search } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

const METHOD_ICON: Record<string, any> = {
  Cash: Banknote,
  bKash: Smartphone,
  Nagad: Smartphone,
  Card: CreditCard,
  Bank: Building,
  Credit: Wallet,
};

const METHOD_TONE: Record<string, string> = {
  Cash: 'bg-success/10 text-success',
  bKash: 'bg-pink-500/10 text-pink-600',
  Nagad: 'bg-orange-500/10 text-orange-600',
  Card: 'bg-blue-500/10 text-blue-600',
  Bank: 'bg-indigo-500/10 text-indigo-600',
  Credit: 'bg-amber-500/10 text-amber-600',
};

interface Row {
  saleId: string;
  invoiceNo: string;
  date: string;
  customer: string;
  method: string;
  amount: number;
  reference?: string;
  user: string;
}

/** Shape returned by `reports.sellPayments` / `reports.purchasePayments`. */
interface BackendPayments {
  byMethod: { method: string; amount: number; cnt: number }[];
  total: number;
}

/** Shape returned by `reports.sellPaymentRows` — one row per payment. */
interface BackendPaymentRows {
  rows: {
    id: string;
    sale_id: string;
    invoice_no: string;
    paid_at: string;
    method: string;
    amount: number;
    reference: string | null;
    customer_name: string;
    user_name: string | null;
  }[];
  /** How many payments match, which may exceed the rows returned. */
  total: number;
  /** True when the safety cap trimmed the list — said out loud on screen. */
  truncated: boolean;
}

export default function SellPaymentPage() {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('');

  // Backend wiring: `reports.sellPayments` returns by-method totals only, so it
  // drives the summary chips + grand total.
  const branchId = useBranchId(branch);
  const { data: bePayments, loading, error } = useReport<BackendPayments>(
    'reports.sellPayments',
    hasBackend() ? { range, branchId } : null,
    [range, branchId],
  );

  /**
   * The DETAIL rows come from SQL over the whole range, not from the sales store.
   *
   * They used to be built by walking `useSales().sales`, which holds ONE PAGE —
   * the newest 50 invoices. So this table listed only the payments attached to
   * those 50, underneath chips and a footer total computed in SQL across the
   * entire range. The footer stated one figure and the rows added up to a smaller
   * one, with nothing on screen to explain the difference. `reports.sellPaymentRows`
   * applies exactly the same filter as `reports.sellPayments`, and the
   * verification suite asserts that the rows sum to that total.
   */
  const { data: beRows, loading: rowsLoading } = useReport<BackendPaymentRows>(
    'reports.sellPaymentRows',
    hasBackend() ? { range, branchId } : null,
    [range, branchId],
  );

  // Method + free-text narrowing stays client-side, but now over the FULL range's
  // payments rather than one page of invoices.
  const rows: Row[] = useMemo(() => {
    const out: Row[] = (beRows?.rows ?? []).map((r) => ({
      saleId: r.sale_id,
      invoiceNo: r.invoice_no,
      date: r.paid_at,
      customer: r.customer_name,
      method: r.method,
      amount: r.amount,
      reference: r.reference ?? undefined,
      user: r.user_name ?? '',
    }));
    let list = out;
    if (method) list = list.filter((r) => r.method === method);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) =>
        `${r.invoiceNo} ${r.customer} ${r.reference ?? ''} ${r.user}`.toLowerCase().includes(t),
      );
    }
    return list;
  }, [beRows, q, method]);

  /**
   * The footer total is only the sum of what is ON SCREEN when nothing has been
   * narrowed client-side. With a method or a search applied it would otherwise
   * claim a total for rows the user cannot see — the same lie in miniature.
   */
  const narrowed = !!method || !!q;
  const shownTotal = useMemo(
    () => rows.reduce((a, r) => a + r.amount, 0),
    [rows],
  );

  // By-method totals come exclusively from the backend (authoritative for the
  // period). Zeroed — never client-recomputed — until the query resolves.
  const summary = useMemo(() => {
    if (!bePayments) {
      return {
        methods: [] as [string, { count: number; amount: number }][],
        total: 0,
        count: 0,
      };
    }
    const map = new Map<string, { count: number; amount: number }>();
    for (const m of bePayments.byMethod) {
      map.set(m.method, { count: m.cnt, amount: m.amount });
    }
    return {
      methods: Array.from(map.entries()).sort((a, b) => b[1].amount - a[1].amount),
      total: bePayments.total,
      count: bePayments.byMethod.reduce((a, m) => a + m.cnt, 0),
    };
  }, [bePayments]);

  const allMethods = ['Cash', 'bKash', 'Nagad', 'Card', 'Bank', 'Credit'];

  return (
    <div>
      <ReportToolbar
        title="Sell Payment Report"
        subtitle={`${formatNumber(summary.count)} payments · ${formatBDT(summary.total)} total`}
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
        filters={
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="">All methods</option>
            {allMethods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        }
      />

      <div className="p-6 space-y-4 max-w-6xl">
        {/* Method breakdown chips */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {allMethods.map((m) => {
            const data = summary.methods.find(([k]) => k === m)?.[1] ?? { count: 0, amount: 0 };
            const pct = summary.total > 0 ? (data.amount / summary.total) * 100 : 0;
            const Icon = METHOD_ICON[m];
            return (
              <Card key={m} className="p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={cn('size-7 rounded-md grid place-items-center', METHOD_TONE[m])}>
                    <Icon className="size-3.5" />
                  </div>
                  <span className="text-sm font-medium">{m}</span>
                </div>
                <div className="tabular font-bold text-base">{formatBDT(data.amount)}</div>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                  <span>{formatNumber(data.count)} pmts</span>
                  <span className="ml-auto">{pct.toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search invoice, customer, reference…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_1.2fr_1.5fr_0.9fr_1fr_1fr_0.8fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            <div>Date</div>
            <div>Invoice</div>
            <div>Customer</div>
            <div>Method</div>
            <div>Reference</div>
            <div className="text-right">Amount</div>
            <div>Cashier</div>
          </div>
          {rows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {loading || rowsLoading
                ? 'Loading…'
                : error
                  ? 'Couldn’t load — backend error. Check connection and retry.'
                  : 'No payments in this range.'}
            </div>
          )}
          {beRows?.truncated && (
            <div className="px-4 py-2 text-xs text-warning border-b border-border">
              Showing the {formatNumber(beRows.rows.length)} most recent of{' '}
              {formatNumber(beRows.total)} payments in this range. Narrow the dates to see the
              rest.
            </div>
          )}
          {rows.map((r, i) => {
            const Icon = METHOD_ICON[r.method];
            return (
              <div
                key={r.saleId + i}
                // Presentational. There is no deep link to a single sale, so the
                // row no longer pretends to be clickable (it used to pop a
                // native alert, which cost the window its keyboard focus).
                className="grid grid-cols-[1fr_1.2fr_1.5fr_0.9fr_1fr_1fr_0.8fr] gap-2 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 text-sm"
              >
                <div className="text-muted-foreground tabular">
                  {new Date(r.date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                  })}
                  <span className="ml-1 text-[11px]">
                    {new Date(r.date).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="font-mono text-xs">{r.invoiceNo}</div>
                <div className="truncate">{r.customer}</div>
                <div>
                  <Badge variant="default" className={METHOD_TONE[r.method]}>
                    <Icon className="size-3" /> {r.method}
                  </Badge>
                </div>
                <div className="text-xs font-mono text-muted-foreground truncate">
                  {r.reference ?? '—'}
                </div>
                <div className="tabular text-right font-medium">{formatBDT(r.amount)}</div>
                <div className="text-muted-foreground truncate">{r.user}</div>
              </div>
            );
          })}
          {rows.length > 0 && (
            <div className="grid grid-cols-[1fr_1.2fr_1.5fr_0.9fr_1fr_1fr_0.8fr] gap-2 px-4 py-2.5 border-t-2 border-border bg-secondary/40 text-sm font-semibold">
              <div />
              <div />
              <div />
              <div />
              <div className="text-right text-muted-foreground">
                {narrowed ? 'Shown' : 'Total'}
              </div>
              <div className="tabular text-right">
                {formatBDT(narrowed ? shownTotal : summary.total)}
              </div>
              <div />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
