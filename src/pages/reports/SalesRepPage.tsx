import { useMemo, useState } from 'react';
import { HandCoins, Search } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  isInRange,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useSales } from '@/stores/sales';
import { useUsers } from '@/stores/users';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AgentRow {
  id: string;
  name: string;
  active: boolean;
  commissionPct: number;
  saleCount: number;
  grossSales: number;
  returns: number;
  netSales: number;
  commissionEarned: number;
  paid: number;
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

export default function SalesRepPage() {
  const sales = useSales((s) => s.sales);
  const returns = useSales((s) => s.returns);
  const agents = useUsers((s) => s.agents);

  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');

  // Backend wiring: `reports.salesRep` reads real agent_id-attributed sales.
  // NOTE: seed data has few/no agent_id on sales, so backed numbers may be
  // small or zero — that's expected (commission attribution is sparse).
  const branchId = useBranchId(branch);
  const { data: beRows, loading, backend, error } = useReport<BackendRepRow[]>(
    'reports.salesRep',
    hasBackend() ? { range, branchId } : null,
    [range, branchId],
  );

  // Mock assignment: distribute sales evenly across active agents (real backend would have agent_id on sales).
  const mockRows: AgentRow[] = useMemo(() => {
    const fSales = sales.filter(
      (s) => s.status === 'final' && isInRange(s.date, range) && (!branch || s.branch === branch),
    );
    const activeAgents = agents.filter((a) => a.active !== false);
    if (activeAgents.length === 0) {
      return [];
    }
    const buckets = new Map<string, AgentRow>();
    activeAgents.forEach((a) =>
      buckets.set(a.id, {
        id: a.id,
        name: a.name,
        active: a.active !== false,
        commissionPct: a.commissionPct,
        saleCount: 0,
        grossSales: 0,
        returns: 0,
        netSales: 0,
        commissionEarned: 0,
        paid: 0,
        pending: 0,
      }),
    );

    fSales.forEach((s, i) => {
      const agent = activeAgents[i % activeAgents.length];
      const r = buckets.get(agent.id)!;
      r.saleCount += 1;
      r.grossSales += s.subtotal - s.orderDiscount;
    });

    returns.forEach((rt, i) => {
      if (!isInRange(rt.date, range)) return;
      const agent = activeAgents[i % activeAgents.length];
      const r = buckets.get(agent.id);
      if (!r) return;
      r.returns += rt.total;
    });

    const list = Array.from(buckets.values());
    list.forEach((r) => {
      r.netSales = r.grossSales - r.returns;
      r.commissionEarned = (r.netSales * r.commissionPct) / 100;
      // Mock: 60% paid, 40% pending
      r.paid = r.commissionEarned * 0.6;
      r.pending = r.commissionEarned - r.paid;
    });
    list.sort((a, b) => b.netSales - a.netSales);
    if (q) {
      const t = q.toLowerCase();
      return list.filter((r) => r.name.toLowerCase().includes(t));
    }
    return list;
  }, [sales, returns, agents, range, branch, q]);

  // Map backend rows. The backend tracks real commission but not the payout
  // (paid/pending) split yet, so we keep the mocked 60/40 split — DEFERRED.
  const backendRows: AgentRow[] | null = useMemo(() => {
    if (!backend || !beRows) return null;
    let list = beRows.map((r) => {
      const paid = r.commissionEarned * 0.6;
      return {
        id: r.id,
        name: r.name,
        active: true,
        commissionPct: r.commissionPct,
        saleCount: r.saleCount,
        grossSales: r.grossSales,
        returns: r.returns,
        netSales: r.netSales,
        commissionEarned: r.commissionEarned,
        paid,
        pending: r.commissionEarned - paid,
      };
    });
    list.sort((a, b) => b.netSales - a.netSales);
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(t));
    }
    return list;
  }, [backend, beRows, q]);

  const rows: AgentRow[] = backend && error ? [] : (backendRows ?? mockRows);

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
        {agents.length === 0 ? (
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
              <div className="grid grid-cols-[1.6fr_0.6fr_0.6fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                <div>Agent</div>
                <div className="text-right">%</div>
                <div className="text-right">Sales</div>
                <div className="text-right">Gross</div>
                <div className="text-right">Returns</div>
                <div className="text-right">Net</div>
                <div className="text-right">Commission</div>
                <div className="text-right">Pending</div>
              </div>
              {rows.length === 0 && (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {backend && loading ? 'Loading…' : backend && error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No data in this range.'}
                </div>
              )}
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1.6fr_0.6fr_0.6fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/30 text-sm"
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
                      {!r.active && <Badge variant="destructive">Inactive</Badge>}
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
                  <div className="tabular text-right text-warning">{formatBDT(r.pending)}</div>
                </div>
              ))}
              {rows.length > 0 && (
                <div className="grid grid-cols-[1.6fr_0.6fr_0.6fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 border-t-2 border-border bg-secondary/40 text-sm font-semibold">
                  <div>Total</div>
                  <div />
                  <div className="tabular text-right">{formatNumber(totals.saleCount)}</div>
                  <div className="tabular text-right">{formatBDT(totals.grossSales)}</div>
                  <div />
                  <div className="tabular text-right">{formatBDT(totals.netSales)}</div>
                  <div className="tabular text-right text-success">{formatBDT(totals.commission)}</div>
                  <div className="tabular text-right text-warning">{formatBDT(totals.pending)}</div>
                </div>
              )}
            </Card>

            <Card className="p-3 bg-secondary/30 text-[12px] text-muted-foreground">
              Commission is calculated as <span className="font-mono">net sales × commission %</span>.
              Returns within the period reduce net sales. Paid vs pending split is mocked here —
              backend will track payout entries per agent.
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
