import { Link } from 'react-router-dom';
import { TrendingUp, ArrowUpRight, ChevronRight } from 'lucide-react';
import { dashboardMock } from '@/mocks/data';
import { formatBDT } from '@/lib/utils';

export function ProfitPopover() {
  const p = dashboardMock.todayProfit;
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="size-9 rounded-lg bg-success/10 text-success grid place-items-center">
          <TrendingUp className="size-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Today's Profit</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono">{formatBDT(p.netProfit)}</span>
            <span className="text-[11px] text-success font-medium inline-flex items-center gap-0.5">
              <ArrowUpRight className="size-3" /> {p.deltaVsYesterday}%
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 text-sm border-t border-border pt-3">
        <Row label="Revenue" value={formatBDT(p.revenue)} />
        <Row label="Cost of goods sold" value={`− ${formatBDT(p.cogs)}`} muted />
        <Row label="Gross Profit" value={formatBDT(p.grossProfit)} bold />
        <Row label={`Margin`} value={`${p.marginPct.toFixed(1)}%`} muted />
        <div className="border-t border-border my-2" />
        <Row label="Expenses today" value={`− ${formatBDT(p.expenses)}`} muted />
        <div className="border-t border-border my-2" />
        <Row label="Net Profit" value={formatBDT(p.netProfit)} bold tone="success" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to="/reports"
          className="flex items-center justify-between px-3 py-2 rounded-md bg-secondary hover:bg-secondary/70 text-xs font-medium"
        >
          P/L Report <ChevronRight className="size-3" />
        </Link>
        <Link
          to="/expenses"
          className="flex items-center justify-between px-3 py-2 rounded-md bg-secondary hover:bg-secondary/70 text-xs font-medium"
        >
          Expenses <ChevronRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  tone?: 'success';
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-muted-foreground text-xs' : 'text-sm'}>{label}</span>
      <span
        className={`font-mono ${bold ? 'font-bold' : ''} ${tone === 'success' ? 'text-success' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
