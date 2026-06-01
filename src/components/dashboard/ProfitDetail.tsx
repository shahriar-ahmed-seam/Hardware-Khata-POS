import { Link } from 'react-router-dom';
import { TrendingUp, ChevronRight, Receipt, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { dashboardMock } from '@/mocks/data';
import { formatBDT } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProfitDetail({ open, onClose }: Props) {
  const d = dashboardMock.todayProfitDetail;
  const p = dashboardMock.todayProfit;

  // Net profit calc per UltimatePOS formula:
  // Gross = (Closing stock by sale + Total sales) − (Opening stock by purchase + Total purchase + …)
  // Simplified: we already have grossProfit & netProfit pre-computed in mock.

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
            Margin <span className="font-mono font-semibold text-success">{p.marginPct.toFixed(2)}%</span>
            <span className="mx-2">·</span>
            vs yesterday <span className="font-mono font-semibold text-success">+{p.deltaVsYesterday}%</span>
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
            value={formatBDT(p.grossProfit)}
            sub="Total sale price − Total purchase price"
            tone="primary"
          />
          <SummaryStat
            label="Total Expenses"
            value={formatBDT(p.expenses)}
            sub="Sum of all expenses today"
            tone="warning"
          />
          <SummaryStat
            label="Net Profit"
            value={formatBDT(p.netProfit)}
            sub="Gross profit − Expenses"
            tone="success"
            highlight
          />
        </div>

        {/* Two-column breakdown — mirrors UltimatePOS layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1 border-t border-border pt-5">
          {/* LEFT */}
          <div className="space-y-3">
            <Row
              label="Opening Stock"
              sub="(By purchase price)"
              value={formatBDT(d.openingStockByPurchase)}
            />
            <Row
              label="Opening Stock"
              sub="(By sale price)"
              value={formatBDT(d.openingStockBySale)}
              muted
            />
            <Row
              label="Total purchase"
              sub="(Exc. tax, Discount)"
              value={formatBDT(d.totalPurchaseExclTaxDisc)}
            />
            <Row label="Total Stock Adjustment" value={formatBDT(d.totalStockAdjustment)} />
            <Row label="Total Expense" value={formatBDT(d.totalExpense)} tone="warning" />
            <Row label="Total purchase shipping charge" value={formatBDT(d.totalPurchaseShipping)} />
            <Row label="Total transfer shipping charge" value={formatBDT(d.totalTransferShipping)} />
            <Row label="Total Sell discount" value={formatBDT(d.totalSellDiscount)} />
            <Row label="Total customer reward" value={formatBDT(d.totalCustomerReward)} />
            <Row label="Total Sell Return" value={formatBDT(d.totalSellReturn)} tone="warning" />
          </div>

          {/* RIGHT */}
          <div className="space-y-3">
            <Row
              label="Closing stock"
              sub="(By purchase price)"
              value={formatBDT(d.closingStockByPurchase)}
            />
            <Row
              label="Closing stock"
              sub="(By sale price)"
              value={formatBDT(d.closingStockBySale)}
              muted
            />
            <Row
              label="Total Sales"
              sub="(Exc. tax, Discount)"
              value={formatBDT(d.totalSalesExclTaxDisc)}
              tone="success"
            />
            <Row label="Total sell shipping charge" value={formatBDT(d.totalSellShipping)} />
            <Row label="Total Stock Recovered" value={formatBDT(d.totalStockRecovered)} />
            <Row label="Total Purchase Return" value={formatBDT(d.totalPurchaseReturn)} />
            <Row label="Total Purchase discount" value={formatBDT(d.totalPurchaseDiscount)} />
            <Row label="Total sell round off" value={formatBDT(d.totalSellRoundOff)} />
          </div>
        </div>

        {/* Bottom big numbers — like the screenshot */}
        <div className="border-t border-border pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <BigStat
            label="Gross Profit"
            value={formatBDT(p.grossProfit)}
            sub="Total sell price − Total purchase price"
            tone="primary"
          />
          <BigStat
            label="Net Profit"
            value={formatBDT(p.netProfit)}
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
