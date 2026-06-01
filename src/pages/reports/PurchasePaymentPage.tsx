import { useMemo, useState } from 'react';
import { Banknote, Smartphone, CreditCard, Building, FileText, Search } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  isInRange,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { usePurchases } from '@/stores/purchases';
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
  Cheque: FileText,
};

const METHOD_TONE: Record<string, string> = {
  Cash: 'bg-success/10 text-success',
  bKash: 'bg-pink-500/10 text-pink-600',
  Nagad: 'bg-orange-500/10 text-orange-600',
  Card: 'bg-blue-500/10 text-blue-600',
  Bank: 'bg-indigo-500/10 text-indigo-600',
  Cheque: 'bg-amber-500/10 text-amber-600',
};

interface Row {
  purchaseId: string;
  refNo: string;
  date: string;
  supplier: string;
  method: string;
  amount: number;
  reference?: string;
  user: string;
}

/** Shape returned by `reports.purchasePayments`. */
interface BackendPayments {
  byMethod: { method: string; amount: number; cnt: number }[];
  total: number;
}

export default function PurchasePaymentPage() {
  const purchases = usePurchases((s) => s.purchases);
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('');

  // Backend wiring: by-method totals only; detail rows stay client-side.
  const branchId = useBranchId(branch);
  const { data: bePayments, loading, backend, error } = useReport<BackendPayments>(
    'reports.purchasePayments',
    hasBackend() ? { range, branchId } : null,
    [range, branchId],
  );

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const purchase of purchases) {
      if (purchase.status === 'cancelled') continue;
      if (branch && purchase.branch !== branch) continue;
      for (const p of purchase.payments) {
        if (!isInRange(p.paidAt, range)) continue;
        out.push({
          purchaseId: purchase.id,
          refNo: purchase.refNo,
          date: p.paidAt,
          supplier: purchase.supplierName,
          method: p.method,
          amount: p.amount,
          reference: p.reference,
          user: purchase.user,
        });
      }
    }
    let list = out;
    if (method) list = list.filter((r) => r.method === method);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) =>
        `${r.refNo} ${r.supplier} ${r.reference ?? ''} ${r.user}`.toLowerCase().includes(t),
      );
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [purchases, range, branch, q, method]);

  const summary = useMemo(() => {
    // Prefer backend by-method totals; detail rows still come from the store.
    if (backend && bePayments) {
      const map = new Map<string, { count: number; amount: number }>();
      for (const m of bePayments.byMethod) {
        map.set(m.method, { count: m.cnt, amount: m.amount });
      }
      return {
        methods: Array.from(map.entries()).sort((a, b) => b[1].amount - a[1].amount),
        total: bePayments.total,
        count: bePayments.byMethod.reduce((a, m) => a + m.cnt, 0),
      };
    }
    // On a real backend error, do NOT fall back to mock totals — zero out.
    if (backend && error) {
      return {
        methods: [] as [string, { count: number; amount: number }][],
        total: 0,
        count: 0,
      };
    }
    const map = new Map<string, { count: number; amount: number }>();
    for (const r of rows) {
      const e = map.get(r.method) ?? { count: 0, amount: 0 };
      e.count += 1;
      e.amount += r.amount;
      map.set(r.method, e);
    }
    const total = rows.reduce((a, r) => a + r.amount, 0);
    return {
      methods: Array.from(map.entries()).sort((a, b) => b[1].amount - a[1].amount),
      total,
      count: rows.length,
    };
  }, [rows, backend, bePayments, error]);

  const allMethods = ['Cash', 'bKash', 'Nagad', 'Card', 'Bank', 'Cheque'];

  return (
    <div>
      <ReportToolbar
        title="Purchase Payment Report"
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
                  <div className="h-full bg-warning" style={{ width: `${Math.min(100, pct)}%` }} />
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
              placeholder="Search ref, supplier, reference…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_1.2fr_1.5fr_0.9fr_1fr_1fr_0.8fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            <div>Date</div>
            <div>Ref No</div>
            <div>Supplier</div>
            <div>Method</div>
            <div>Reference</div>
            <div className="text-right">Amount</div>
            <div>By</div>
          </div>
          {rows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {backend && loading ? 'Loading…' : backend && error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No payments in this range.'}
            </div>
          )}
          {rows.map((r, i) => {
            const Icon = METHOD_ICON[r.method];
            return (
              <div
                key={r.purchaseId + i}
                className="grid grid-cols-[1fr_1.2fr_1.5fr_0.9fr_1fr_1fr_0.8fr] gap-2 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer text-sm"
                onClick={() => alert(`Drill: open purchase ${r.refNo}`)}
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
                <div className="font-mono text-xs">{r.refNo}</div>
                <div className="truncate">{r.supplier}</div>
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
              <div className="text-right text-muted-foreground">Total</div>
              <div className="tabular text-right">{formatBDT(summary.total)}</div>
              <div />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
