import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Receipt, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { apiSafe } from '@/lib/api';
import { useDashboard } from '@/stores/dashboard';
import { DEFAULT_BRANCH, toRangeInput, useDashboardData } from '@/hooks/useDashboardData';
import { formatBDT } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Subset of `reports.profitLoss` this modal reads (see backend/services/reports.ts). */
interface ProfitLossReport {
  moneyIn: {
    totalSalesExclTaxDisc: number;
    sellShipping: number;
    sellOther: number;
    purchaseReturns: number;
  };
  moneyOut: {
    cogs: number;
    sellReturns: number;
    expenses: number;
    stockAdjustment: number;
  };
  grossProfit: number;
  marginPct: number;
  netProfit: number;
  totalPurchases: number;
}

/** Neutral placeholder for a row the backend does not expose yet. */
const NA = '—';
const money = (v: number | null | undefined) => (typeof v === 'number' ? formatBDT(v) : NA);

export function ProfitDetail({ open, onClose }: Props) {
  const range = useDashboard((s) => s.range);
  const customRange = useDashboard((s) => s.customRange);
  const { data: bundle } = useDashboardData();

  // Net profit calc per UltimatePOS formula:
  // Gross = (Closing stock by sale + Total sales) − (Opening stock by purchase + Total purchase + …)
  // The numbers below are NOT recomputed here: grossProfit / marginPct / netProfit
  // come straight from the backend (dashboard.stats + reports.profitLoss).

  // Backend-only: the mock `todayProfitDetail` / `todayProfit` blocks were
  // removed. Headline figures come from the dashboard bundle; the line-item
  // breakdown comes from `reports.profitLoss` for the selected range, fetched
  // when the modal opens. Anything the backend does not expose renders as '—'
  // instead of a fabricated number.
  const [report, setReport] = useState<ProfitLossReport | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const res = await apiSafe<ProfitLossReport>('reports.profitLoss', {
        range: toRangeInput(range, customRange),
        branchId: DEFAULT_BRANCH,
      });
      if (!cancelled) setReport(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, range, customRange]);

  const p = bundle?.stats.profit ?? null;
  const stats = bundle?.stats ?? null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-4xl"
      title="Today's Profit"
      subtitle="Detailed profit breakdown for the current day"
      footer={
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Margin{' '}
            <span className="font-mono font-semibold text-success">
              {p ? `${p.marginPct.toFixed(2)}%` : NA}
            </span>
            <span className="mx-2">·</span>
            vs yesterday{' '}
            <span
              className={`font-mono font-semibold ${
                (p?.deltaPct ?? 0) >= 0 ? 'text-success' : 'text-destructive'
              }`}
            >
              {p ? `${p.deltaPct >= 0 ? '+' : ''}${p.deltaPct}%` : NA}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/expenses" onClick={onClose}>
              <Button variant="outline" size="sm">
                <Wallet className="size-3.5" /> Expenses
              </Button>
            </Link>
            <Link to="/reports" onClick={onClose}>
              <Button size="sm">
                <Receipt className="size-3.5" /> Profit / Loss Report <ChevronRight className="size-3" />
              </Button>
            </Link>
          </div>
        </div>
      }
    >
      <div className="p-6 space-y-6">
        {/* Top summary banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryStat
            label="Gross Profit"
            value={money(p?.grossProfit)}
            sub="Total sale price − Total purchase price"
            tone="primary"
          />
          <SummaryStat
            label="Total Expenses"
            value={money(p?.expenses)}
            sub="Sum of all expenses today"
            tone="warning"
          />
          <SummaryStat
            label="Net Profit"
            value={money(p?.netProfit)}
            sub="Gross profit − Expenses"
            tone="success"
            highlight
          />
        </div>

        {/* Two-column breakdown — mirrors UltimatePOS layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1 border-t border-border pt-5">
          {/* LEFT */}
          <div className="space-y-3">
            {/* Opening stock is not exposed by the backend — shown as '—'. */}
            <Row label="Opening Stock" sub="(By purchase price)" value={NA} />
            <Row label="Opening Stock" sub="(By sale price)" value={NA} muted />
            <Row
              label="Total purchase"
              sub="(Exc. tax, Discount)"
              value={money(report?.totalPurchases)}
            />
            <Row label="Total Stock Adjustment" value={money(report?.moneyOut.stockAdjustment)} />
            <Row label="Total Expense" value={money(report?.moneyOut.expenses)} tone="warning" />
            {/* Purchase / transfer shipping, sell discount and customer reward
                totals have no backend source yet — shown as '—'. */}
            <Row label="Total purchase shipping charge" value={NA} />
            <Row label="Total transfer shipping charge" value={NA} />
            <Row label="Total Sell discount" value={NA} />
            <Row label="Total customer reward" value={NA} />
            <Row label="Total Sell Return" value={money(report?.moneyOut.sellReturns)} tone="warning" />
          </div>

          {/* RIGHT */}
          <div className="space-y-3">
            {/* Closing stock = current stock valuation from dashboard.stats. */}
            <Row
              label="Closing stock"
              sub="(By purchase price)"
              value={money(stats?.stockValueAtCost)}
            />
            <Row
              label="Closing stock"
              sub="(By sale price)"
              value={money(stats?.stockValueAtRetail)}
              muted
            />
            <Row
              label="Total Sales"
              sub="(Exc. tax, Discount)"
              value={money(report?.moneyIn.totalSalesExclTaxDisc)}
              tone="success"
            />
            <Row label="Total sell shipping charge" value={money(report?.moneyIn.sellShipping)} />
            {/* Stock recovered, purchase discount and sell round-off totals have
                no backend source yet — shown as '—'. */}
            <Row label="Total Stock Recovered" value={NA} />
            <Row label="Total Purchase Return" value={money(report?.moneyIn.purchaseReturns)} />
            <Row label="Total Purchase discount" value={NA} />
            <Row label="Total sell round off" value={NA} />
          </div>
        </div>

        {/* Bottom big numbers — like the screenshot */}
        <div className="border-t border-border pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <BigStat
            label="Gross Profit"
            value={money(p?.grossProfit)}
            sub="Total sell price − Total purchase price"
            tone="primary"
          />
          <BigStat
            label="Net Profit"
            value={money(p?.netProfit)}
            sub="Gross profit − Total expenses + …"
            tone="success"
          />
        </div>
      </div>
    </Modal>
  );
}

function Row({
  label,
  sub,
  value,
  muted,
  tone,
}: {
  label: string;
  sub?: string;
  value: string;
  muted?: boolean;
  tone?: 'success' | 'warning' | 'destructive';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <div className={muted ? 'text-sm text-muted-foreground' : 'text-sm font-medium'}>{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground -mt-0.5">{sub}</div>}
      </div>
      <div
        className={`font-mono text-sm whitespace-nowrap ${
          tone === 'success'
            ? 'text-success'
            : tone === 'warning'
              ? 'text-warning'
              : tone === 'destructive'
                ? 'text-destructive'
                : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  sub,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: 'primary' | 'success' | 'warning';
  highlight?: boolean;
}) {
  const toneCls = {
    primary: 'from-primary/15 to-primary/5 text-primary',
    success: 'from-success/20 to-success/5 text-success',
    warning: 'from-warning/15 to-warning/5 text-warning',
  };
  return (
    <div
      className={`relative rounded-xl border bg-gradient-to-br p-4 ${toneCls[tone]} ${
        highlight ? 'border-success/40 ring-1 ring-success/20' : 'border-border'
      }`}
    >
      <div className="text-[11px] font-medium opacity-80">{label}</div>
      <div className="text-2xl font-bold font-mono mt-1 tracking-tight">{value}</div>
      {sub && <div className="text-[10px] opacity-70 mt-1">{sub}</div>}
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: 'primary' | 'success';
}) {
  return (
    <div className="rounded-xl border border-border p-5 bg-card">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div
        className={`text-3xl font-bold font-mono mt-1 tracking-tight ${
          tone === 'success' ? 'text-success' : 'text-primary'
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1.5">{sub}</div>}
    </div>
  );
}
