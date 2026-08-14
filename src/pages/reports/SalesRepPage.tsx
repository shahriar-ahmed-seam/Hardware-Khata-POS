import { useMemo, useState } from 'react';
import { HandCoins, Search } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AgentRow {
  id: string;
  name: string;
  commissionPct: number;
  saleCount: number;
  grossSales: number;
  returns: number;
  netSales: number;
  commissionEarned: number;
  /**
   * Commission actually paid out. There is NO payout ledger in the backend, so
   * this has no source and is rendered as '—' (never a fabricated split).
   * BACKEND WORK NEEDED: a commission_payouts table + a `reports.salesRep`
   * per-agent paid total, which would then make `pending = earned − paid`.
   */
  paid: null;
  /** With no payout records, the whole earned amount is outstanding. */
  pending: number;
}

/** One `reports.salesRep` row. */
interface BackendRepRow {
  id: string;
  name: string;
  commissionPct: number;
  saleCount: number;
  grossSales: number;
  returns: number;
  netSales: number;
  commissionEarned: number;
}

const GRID = 'grid grid-cols-[1.6fr_0.5fr_0.5fr_1fr_1fr_1fr_1fr_0.7fr_1fr] gap-2';

export default function SalesRepPage() {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');

  // Backend wiring: `reports.salesRep` reads real agent_id-attributed sales and
  // returns one row per ACTIVE commission agent (zeros when nothing is
  // attributed). NOTE: seed data has few/no agent_id on sales, so backed numbers
  // may be small or zero — that's expected (commission attribution is sparse).
  const branchId = useBranchId(branch);
  const { data: beRows, loading, error } = useReport<BackendRepRow[]>(
    'reports.salesRep',
    hasBackend() ? { range, branchId } : null,
    [range, branchId],
  );

  // Map backend rows. The backend tracks real commission earned but has NO
  // payout records, so we must NOT fabricate a paid/pending split: nothing is
  // recorded as paid, and the full commission earned is pending.
  const backendRows: AgentRow[] | null = useMemo(() => {
    if (!beRows) return null;
    let list: AgentRow[] = beRows.map((r) => ({
      id: r.id,
      name: r.name,
      commissionPct: r.commissionPct,
      saleCount: r.saleCount,
      grossSales: r.grossSales,
      returns: r.returns,
      netSales: r.netSales,
      commissionEarned: r.commissionEarned,
      paid: null,
      pending: r.commissionEarned,
    }));
    list.sort((a, b) => b.netSales - a.netSales);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(t));
    }
    return list;
  }, [beRows, q]);

  const rows: AgentRow[] = backendRows ?? [];

  // The backend returns a row per active agent, so an empty (unfiltered) result
  // means no commission agents are configured at all.
  const noAgentsConfigured = !loading && !error && !!beRows && beRows.length === 0;

  const totals = useMemo(
    () => ({
      saleCount: rows.reduce((a, r) => a + r.saleCount, 0),
      grossSales: rows.reduce((a, r) => a + r.grossSales, 0),
      netSales: rows.reduce((a, r) => a + r.netSales, 0),
      commission: rows.reduce((a, r) => a + r.commissionEarned, 0),
      pending: rows.reduce((a, r) => a + r.pending, 0),
    }),
    [rows],
  );

  return (
    <div>
      <ReportToolbar
        title="Sales Rep Report"
        subtitle={`${rows.length} agents · ${formatBDT(totals.commission)} commission earned`}
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
      />

      <div className="p-6 space-y-4 max-w-6xl">
        {noAgentsConfigured ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            <HandCoins className="size-6 mx-auto mb-2 opacity-50" />
            No commission agents configured.{' '}
            <a className="underline text-primary" href="/settings/sales-agents">
              Add agents
            </a>{' '}
            to start tracking.
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Sales count" value={formatNumber(totals.saleCount)} />
              <Kpi label="Net sales" value={formatBDT(totals.netSales)} tone="primary" />
              <Kpi label="Commission earned" value={formatBDT(totals.commission)} tone="success" />
              <Kpi label="Pending payout" value={formatBDT(totals.pending)} tone="warning" />
            </div>

            <Card className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search agent…"
                  className="pl-9"
                />
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div
                className={cn(
                  GRID,
                  'px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]',
                )}
              >
                <div>Agent</div>
                <div className="text-right">%</div>
                <div className="text-right">Sales</div>
                <div className="text-right">Gross</div>
                <div className="text-right">Returns</div>
                <div className="text-right">Net</div>
                <div className="text-right">Commission</div>
                <div className="text-right">Paid</div>
                <div className="text-right">Pending</div>
              </div>
              {rows.length === 0 && (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {loading
                    ? 'Loading…'
                    : error
                      ? 'Couldn’t load — backend error. Check connection and retry.'
                      : 'No data in this range.'}
                </div>
              )}
              {rows.map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    GRID,
                    'px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/30 text-sm',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-8 rounded-full bg-accent/15 text-accent grid place-items-center text-xs font-bold">
                      {r.name
                        .split(/\s+/)
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                    </div>
                  </div>
                  <div className="tabular text-right">{r.commissionPct}%</div>
                  <div className="tabular text-right">{formatNumber(r.saleCount)}</div>
                  <div className="tabular text-right">{formatBDT(r.grossSales)}</div>
                  <div className="tabular text-right text-muted-foreground">
                    {r.returns > 0 ? `−${formatBDT(r.returns)}` : '—'}
                  </div>
                  <div className="tabular text-right font-medium">{formatBDT(r.netSales)}</div>
                  <div className="tabular text-right font-semibold text-success">
                    {formatBDT(r.commissionEarned)}
                  </div>
                  {/* No payout ledger in the backend — never invent a paid amount. */}
                  <div className="tabular text-right text-muted-foreground">—</div>
                  <div className="tabular text-right text-warning">{formatBDT(r.pending)}</div>
                </div>
              ))}
              {rows.length > 0 && (
                <div
                  className={cn(
                    GRID,
                    'px-4 py-2.5 border-t-2 border-border bg-secondary/40 text-sm font-semibold',
                  )}
                >
                  <div>Total</div>
                  <div />
                  <div className="tabular text-right">{formatNumber(totals.saleCount)}</div>
                  <div className="tabular text-right">{formatBDT(totals.grossSales)}</div>
                  <div />
                  <div className="tabular text-right">{formatBDT(totals.netSales)}</div>
                  <div className="tabular text-right text-success">
                    {formatBDT(totals.commission)}
                  </div>
                  <div className="tabular text-right text-muted-foreground">—</div>
                  <div className="tabular text-right text-warning">{formatBDT(totals.pending)}</div>
                </div>
              )}
            </Card>

            <Card className="p-3 bg-secondary/30 text-[12px] text-muted-foreground">
              Commission is calculated as <span className="font-mono">net sales × commission %</span>.
              Returns within the period reduce net sales. There is no payout ledger yet, so Paid
              shows '—' and all earned commission is reported as pending.
            </Card>
          </>
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
