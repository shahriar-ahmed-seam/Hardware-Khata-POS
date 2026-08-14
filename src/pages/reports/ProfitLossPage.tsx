import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PnLRow {
  label: string;
  /** `null` = no backend source for this figure yet; renders '—' and is NOT summed. */
  amount: number | null;
  hint?: string;
}

interface PnLBlock {
  title: string;
  rows: PnLRow[];
}

/** Shape returned by the `reports.profitLoss` channel (see backend/services/reports.ts). */
interface BackendProfitLoss {
  moneyIn: {
    totalSalesExclTaxDisc: number;
    sellShipping: number;
    sellOther: number;
    purchaseReturns: number;
  };
  moneyOut: { cogs: number; sellReturns: number; expenses: number; stockAdjustment: number };
  tax: { salesTaxCollected: number; purchaseTaxPaid: number; netVat: number };
  grossProfit: number;
  marginPct: number;
  netProfit: number;
  totalPurchases: number;
}

const EMPTY_PNL = {
  totalSalesExclTax: 0,
  totalSellShipping: 0,
  totalSellOther: 0,
  totalSellTax: 0,
  totalPurchaseReturn: 0,
  totalCOGS: 0,
  totalPurchases: 0,
  totalPurchaseTax: 0,
  totalSellReturn: 0,
  totalExpense: 0,
  stockAdjustment: 0,
  grossProfit: 0,
  marginPct: 0,
  netProfit: 0,
};

export default function ProfitLossPage() {
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');

  // Backend wiring: pass the DateRange straight through (preset names + shape
  // match the backend RangeInput) and resolve the branch name → id.
  const branchId = useBranchId(branch);
  const { data: be, loading, error } = useReport<BackendProfitLoss>(
    'reports.profitLoss',
    hasBackend() ? { range, branchId } : null,
    [range, branchId],
  );

  // Backend-only figures. Until the query resolves (or if it fails) every number
  // is an explicit zero — never an invented or client-recomputed value.
  const pnl = be
    ? {
        totalSalesExclTax: be.moneyIn.totalSalesExclTaxDisc,
        totalSellShipping: be.moneyIn.sellShipping,
        totalSellOther: be.moneyIn.sellOther,
        totalSellTax: be.tax.salesTaxCollected,
        totalPurchaseReturn: be.moneyIn.purchaseReturns,
        totalCOGS: be.moneyOut.cogs,
        totalPurchases: be.totalPurchases,
        totalPurchaseTax: be.tax.purchaseTaxPaid,
        totalSellReturn: be.moneyOut.sellReturns,
        totalExpense: be.moneyOut.expenses,
        stockAdjustment: be.moneyOut.stockAdjustment,
        grossProfit: be.grossProfit,
        marginPct: be.marginPct,
        netProfit: be.netProfit,
      }
    : EMPTY_PNL;

  // Every displayed row comes from `reports.profitLoss`. The opening/closing
  // stock-valuation snapshots have NO backend source (the nightly stock
  // valuation job is deferred), so they render '—' and carry `amount: null` so
  // they are excluded from the block totals rather than fabricated.
  // BACKEND WORK NEEDED: a nightly stock-valuation snapshot table (value at
  // purchase cost + at sell price, per branch per day) exposed on
  // `reports.profitLoss`.
  const moneyIn: PnLBlock = {
    title: 'Money in',
    rows: [
      { label: 'Total sales (excl. tax & disc.)', amount: pnl.totalSalesExclTax },
      { label: 'Sell shipping recovered', amount: pnl.totalSellShipping },
      { label: 'Other charges', amount: pnl.totalSellOther },
      { label: 'Purchase returns', amount: pnl.totalPurchaseReturn },
      {
        label: 'Closing stock (by sell price)',
        amount: null,
        hint: 'No stock-valuation snapshot yet — excluded from the total',
      },
    ],
  };
  const moneyOut: PnLBlock = {
    title: 'Money out',
    rows: [
      { label: 'Cost of goods sold (COGS)', amount: pnl.totalCOGS },
      { label: 'Sell returns', amount: pnl.totalSellReturn },
      { label: 'Expenses', amount: pnl.totalExpense },
      // Signed: a stock loss (negative adjustment) increases money-out.
      { label: 'Stock adjustments (loss)', amount: -pnl.stockAdjustment },
      {
        label: 'Opening stock (by purchase price)',
        amount: null,
        hint: 'No stock-valuation snapshot yet — excluded from the total',
      },
    ],
  };

  return (
    <div>
      <ReportToolbar
        title="Profit / Loss"
        subtitle="Net profit calculation across the selected period"
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
      />

      <div className="p-6 space-y-6 max-w-5xl">
        {loading && !be && <div className="text-sm text-muted-foreground">Loading…</div>}
        {error && (
          <div className="text-sm text-muted-foreground">
            Couldn’t load — backend error. Check connection and retry.
          </div>
        )}
        {!loading && !error && !be && (
          <div className="text-sm text-muted-foreground">No data in this range.</div>
        )}
        {/* Hero KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <KpiCard
            label="Net profit"
            value={pnl.netProfit}
            tone={pnl.netProfit >= 0 ? 'success' : 'destructive'}
            big
          />
          <KpiCard label="Gross profit" value={pnl.grossProfit} tone="primary" />
          <KpiCard
            label="Margin"
            value={pnl.marginPct}
            suffix="%"
            tone="info"
            isPercent
          />
          <KpiCard label="Total expenses" value={pnl.totalExpense} tone="warning" />
        </div>

        {/* Two-column breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <BlockCard block={moneyIn} tone="success" />
          <BlockCard block={moneyOut} tone="destructive" />
        </div>

        {/* Formula card */}
        <Card className="p-5 bg-secondary/30">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-2">
            How net profit is calculated
          </div>
          <div className="font-mono text-[12px] leading-6 text-muted-foreground">
            <span className="text-success">money in</span>{' '}
            <span className="text-foreground">−</span>{' '}
            <span className="text-destructive">money out</span>{' '}
            <span className="text-foreground">=</span>{' '}
            <span className="font-semibold text-foreground">
              {formatBDT(pnl.netProfit)}
            </span>
          </div>
          <div className="text-[12px] text-muted-foreground mt-2">
            Cost of goods sold uses the unit cost recorded at sale time (not the current cost).
            Opening/closing stock-valuation snapshots are not available yet (nightly job pending),
            so those rows show '—' and are excluded from the totals above.
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Tax breakdown</div>
            <div className="text-xs text-muted-foreground">Net VAT position over the period</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MiniRow label="Sales VAT collected" value={pnl.totalSellTax} positive />
            <MiniRow label="Purchase VAT paid" value={pnl.totalPurchaseTax} />
            <MiniRow
              label="Net VAT payable"
              value={pnl.totalSellTax - pnl.totalPurchaseTax}
              positive
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
  big,
  isPercent,
  suffix,
}: {
  label: string;
  value: number;
  tone: 'primary' | 'success' | 'warning' | 'info' | 'destructive';
  big?: boolean;
  isPercent?: boolean;
  suffix?: string;
}) {
  const tones: Record<typeof tone, string> = {
    primary: 'border-primary/30',
    success: 'border-success/30',
    warning: 'border-warning/30',
    info: 'border-accent/30',
    destructive: 'border-destructive/30',
  };
  const valueColor: Record<typeof tone, string> = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    info: 'text-foreground',
    destructive: 'text-destructive',
  };
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <Card className={cn('p-4 border-l-4', tones[tone])}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
          {label}
        </div>
        <Icon className={cn('size-3.5', valueColor[tone])} />
      </div>
      <div
        className={cn(
          'tabular font-bold mt-1.5',
          big ? 'text-2xl' : 'text-lg',
          valueColor[tone],
        )}
      >
        {isPercent ? `${value.toFixed(1)}${suffix ?? ''}` : formatBDT(value)}
      </div>
    </Card>
  );
}

function BlockCard({
  block,
  tone,
}: {
  block: PnLBlock;
  tone: 'success' | 'destructive';
}) {
  // Rows without a backend source (amount === null) never contribute to the total.
  const total = block.rows.reduce((acc, r) => acc + (r.amount ?? 0), 0);
  const arrow = tone === 'success' ? ArrowUpRight : ArrowDownRight;
  const Arrow = arrow;
  return (
    <Card className="overflow-hidden">
      <div
        className={cn(
          'px-4 py-2.5 border-b border-border flex items-center justify-between',
          tone === 'success' ? 'bg-success/5' : 'bg-destructive/5',
        )}
      >
        <div className="flex items-center gap-2">
          <Arrow
            className={cn('size-4', tone === 'success' ? 'text-success' : 'text-destructive')}
          />
          <span className="font-semibold text-sm">{block.title}</span>
        </div>
        <div
          className={cn(
            'tabular font-bold text-sm',
            tone === 'success' ? 'text-success' : 'text-destructive',
          )}
        >
          {formatBDT(total)}
        </div>
      </div>
      <div className="divide-y divide-border">
        {block.rows.map((row) => (
          // Presentational row. It used to be a <button> that popped an
          // "wires up at backend stage" alert: nothing to drill into, and the
          // native alert left the window without keyboard focus.
          <div
            key={row.label}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left"
          >
            <div>
              <div className="text-sm">{row.label}</div>
              {row.hint && <div className="text-[11px] text-muted-foreground">{row.hint}</div>}
            </div>
            <div
              className={cn(
                'tabular font-medium text-sm',
                row.amount === null && 'text-muted-foreground',
              )}
            >
              {row.amount === null ? '—' : formatBDT(row.amount)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MiniRow({
  label,
  value,
  positive,
}: {
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label}
      </div>
      <div
        className={cn(
          'tabular font-bold mt-1',
          positive && value >= 0 ? 'text-success' : value < 0 ? 'text-destructive' : '',
        )}
      >
        {formatBDT(value)}
      </div>
    </div>
  );
}
