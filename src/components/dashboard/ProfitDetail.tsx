import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Receipt, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { apiSafe } from '@/lib/api';
import { useDashboard } from '@/stores/dashboard';
import { DASHBOARD_BRANCH, toRangeInput, useDashboardData } from '@/hooks/useDashboardData';
import { cn, formatBDT } from '@/lib/utils';
import { useRange } from './range';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Subset of `reports.profitLoss` this modal reads (see backend/services/reports.ts). */
interface ProfitLossReport {
  moneyIn: { totalSalesExclTaxDisc: number };
  moneyOut: { cogs: number; sellReturns: number };
}

/**
 * Profit for the dashboard's range, as one short sum the owner can follow:
 * sales, cost of goods, gross profit, expenses, net profit, margin.
 *
 * It used to be an 18-row two-column accountant's sheet in a wide modal, half
 * of it permanently "—" (no backend source), with Gross and Net each shown
 * twice and closing-stock rows that are not profit at all. Rows with no figure
 * are now left out. Headline figures come from the backend unchanged.
 */
export function ProfitDetail({ open, onClose }: Props) {
  const range = useDashboard((s) => s.range);
  const customRange = useDashboard((s) => s.customRange);
  const { label: period } = useRange();
  const { data: bundle } = useDashboardData();

  const [report, setReport] = useState<ProfitLossReport | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const res = await apiSafe<ProfitLossReport>('reports.profitLoss', {
        range: toRangeInput(range, customRange),
        branchId: DASHBOARD_BRANCH,
      });
      if (!cancelled) setReport(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, range, customRange]);

  const p = bundle?.stats.profit ?? null;
  const sales = report?.moneyIn.totalSalesExclTaxDisc;
  const cogs = report?.moneyOut.cogs;
  const returns = report?.moneyOut.sellReturns;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-lg"
      title="Profit"
      subtitle={period}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Link to="/expenses" onClick={onClose}>
            <Button variant="outline">
              <Wallet className="size-4" /> Expenses
            </Button>
          </Link>
          <Link to="/reports/profit-loss" onClick={onClose}>
            <Button>
              <Receipt className="size-4" /> Profit / Loss Report <ChevronRight className="size-4" />
            </Button>
          </Link>
        </div>
      }
    >
      <div className="p-5">
        <div className="divide-y divide-border rounded-lg border border-border">
          {typeof sales === 'number' && <Line label="Sales" value={formatBDT(sales)} />}
          {typeof cogs === 'number' && <Line label="Cost of goods sold" value={`− ${formatBDT(cogs)}`} />}
          {typeof returns === 'number' && returns > 0 && (
            <Line label="Sales returns" value={`− ${formatBDT(returns)}`} />
          )}
          {p && <Line label="Gross profit" value={formatBDT(p.grossProfit)} strong />}
          {p && <Line label="Expenses" value={`− ${formatBDT(p.expenses)}`} tone="warning" />}
          {p && (
            <div className="flex items-baseline justify-between gap-3 px-4 py-3 bg-success/5">
              <span className="text-base font-semibold">Net profit</span>
              <span
                className={cn(
                  'text-2xl font-bold tabular',
                  p.netProfit >= 0 ? 'text-success' : 'text-destructive',
                )}
              >
                {formatBDT(p.netProfit)}
              </span>
            </div>
          )}
          {p && <Line label="Margin" value={`${p.marginPct.toFixed(2)}%`} />}
        </div>
        {!p && !report && (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        )}
      </div>
    </Modal>
  );
}

function Line({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'warning';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <span className={cn('text-sm', strong ? 'font-semibold' : 'text-muted-foreground')}>{label}</span>
      <span
        className={cn(
          'text-sm tabular whitespace-nowrap',
          strong && 'text-base font-semibold',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </span>
    </div>
  );
}
