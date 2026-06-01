import { useMemo, useState } from 'react';
import { Percent, ArrowUpRight, ArrowDownRight, Calculator } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  isInRange,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { useSales } from '@/stores/sales';
import { usePurchases } from '@/stores/purchases';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

type Mode = 'sales' | 'purchase' | 'combined';

interface TaxRow {
  rate: number; // percentage
  invoices: number;
  taxableAmount: number;
  taxCollected: number;
}

/** Shape returned by the `reports.tax` channel. */
interface BackendTax {
  salesByRate: { rate: number; invoices: number; taxable: number; tax: number }[];
  purchaseByRate: { rate: number; bills: number; taxable: number; tax: number }[];
  salesTotal: number;
  purchaseTotal: number;
  net: number;
}

export default function TaxReportPage() {
  const sales = useSales((s) => s.sales);
  const purchases = usePurchases((s) => s.purchases);
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [mode, setMode] = useState<Mode>('sales');

  // Backend wiring: pass DateRange + resolved branch id straight through.
  const branchId = useBranchId(branch);
  const { data: beTax, loading, backend, error } = useReport<BackendTax>(
    'reports.tax',
    hasBackend() ? { range, branchId } : null,
    [range, branchId],
  );

  const mockData = useMemo(() => {
    const salesByRate = new Map<number, TaxRow>();
    const purchaseByRate = new Map<number, TaxRow>();

    for (const s of sales) {
      if (s.status !== 'final') continue;
      if (!isInRange(s.date, range)) continue;
      if (branch && s.branch !== branch) continue;
      const rate = Math.round(s.taxPct * 10) / 10;
      const taxable = Math.max(0, s.subtotal - s.orderDiscount);
      const e = salesByRate.get(rate) ?? {
        rate,
        invoices: 0,
        taxableAmount: 0,
        taxCollected: 0,
      };
      e.invoices += 1;
      e.taxableAmount += taxable;
      e.taxCollected += s.tax;
      salesByRate.set(rate, e);
    }

    for (const p of purchases) {
      if (p.status === 'cancelled') continue;
      if (!isInRange(p.date, range)) continue;
      if (branch && p.branch !== branch) continue;
      const rate = Math.round(p.taxPct * 10) / 10;
      const taxable = Math.max(0, p.subtotal - p.orderDiscount);
      const e = purchaseByRate.get(rate) ?? {
        rate,
        invoices: 0,
        taxableAmount: 0,
        taxCollected: 0,
      };
      e.invoices += 1;
      e.taxableAmount += taxable;
      e.taxCollected += p.tax;
      purchaseByRate.set(rate, e);
    }

    const salesRows = Array.from(salesByRate.values()).sort((a, b) => b.rate - a.rate);
    const purchaseRows = Array.from(purchaseByRate.values()).sort((a, b) => b.rate - a.rate);
    const salesTotal = salesRows.reduce((acc, r) => acc + r.taxCollected, 0);
    const purchaseTotal = purchaseRows.reduce((acc, r) => acc + r.taxCollected, 0);
    return {
      salesRows,
      purchaseRows,
      salesTotal,
      purchaseTotal,
      net: salesTotal - purchaseTotal,
      salesInvoices: salesRows.reduce((a, r) => a + r.invoices, 0),
      purchaseInvoices: purchaseRows.reduce((a, r) => a + r.invoices, 0),
    };
  }, [sales, purchases, range, branch]);

  // Prefer backend aggregation when available; otherwise keep mock computation.
  const data = useMemo(() => {
    if (backend && beTax) {
      const salesRows: TaxRow[] = beTax.salesByRate.map((r) => ({
        rate: r.rate,
        invoices: r.invoices,
        taxableAmount: r.taxable,
        taxCollected: r.tax,
      }));
      const purchaseRows: TaxRow[] = beTax.purchaseByRate.map((r) => ({
        rate: r.rate,
        invoices: r.bills,
        taxableAmount: r.taxable,
        taxCollected: r.tax,
      }));
      return {
        salesRows,
        purchaseRows,
        salesTotal: beTax.salesTotal,
        purchaseTotal: beTax.purchaseTotal,
        net: beTax.net,
        salesInvoices: salesRows.reduce((a, r) => a + r.invoices, 0),
        purchaseInvoices: purchaseRows.reduce((a, r) => a + r.invoices, 0),
      };
    }
    // On a real backend error, show an empty/zeroed report instead of mock.
    if (backend && error) {
      return {
        salesRows: [] as TaxRow[],
        purchaseRows: [] as TaxRow[],
        salesTotal: 0,
        purchaseTotal: 0,
        net: 0,
        salesInvoices: 0,
        purchaseInvoices: 0,
      };
    }
    return mockData;
  }, [backend, beTax, mockData, error]);

  return (
    <div>
      <ReportToolbar
        title="Tax Report"
        subtitle="Sales VAT collected, purchase VAT paid, and net position"
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
      />

      <div className="p-6 space-y-4 max-w-5xl">
        {backend && loading && !beTax && (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}
        {backend && error && (
          <div className="text-sm text-muted-foreground">
            Couldn’t load — backend error. Check connection and retry.
          </div>
        )}
        {/* Hero KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="p-4 border-l-4 border-success">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                Sales VAT collected
              </div>
              <ArrowUpRight className="size-3.5 text-success" />
            </div>
            <div className="tabular font-bold text-xl mt-1.5 text-success">
              {formatBDT(data.salesTotal)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              from {formatNumber(data.salesInvoices)} invoices
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-warning">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                Purchase VAT paid
              </div>
              <ArrowDownRight className="size-3.5 text-warning" />
            </div>
            <div className="tabular font-bold text-xl mt-1.5 text-warning">
              {formatBDT(data.purchaseTotal)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              from {formatNumber(data.purchaseInvoices)} bills
            </div>
          </Card>
          <Card
            className={cn(
              'p-4 border-l-4',
              data.net >= 0 ? 'border-primary' : 'border-destructive',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                Net VAT position
              </div>
              <Calculator className="size-3.5 text-primary" />
            </div>
            <div
              className={cn(
                'tabular font-bold text-xl mt-1.5',
                data.net >= 0 ? 'text-primary' : 'text-destructive',
              )}
            >
              {formatBDT(data.net)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {data.net >= 0 ? 'Owed to government' : 'Refundable'}
            </div>
          </Card>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-md w-fit">
          {(['sales', 'purchase', 'combined'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'h-8 px-3 rounded text-sm font-medium capitalize transition',
                mode === m
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'sales' ? 'Sales VAT' : m === 'purchase' ? 'Purchase VAT' : 'Combined'}
            </button>
          ))}
        </div>

        {(mode === 'sales' || mode === 'combined') && (
          <Section
            title="Sales VAT — by tax rate"
            tone="success"
            rows={data.salesRows}
            total={data.salesTotal}
            totalLabel="Tax collected"
            invoiceLabel="Invoices"
          />
        )}
        {(mode === 'purchase' || mode === 'combined') && (
          <Section
            title="Purchase VAT — by tax rate"
            tone="warning"
            rows={data.purchaseRows}
            total={data.purchaseTotal}
            totalLabel="Tax paid"
            invoiceLabel="Bills"
          />
        )}

        <Card className="p-4 bg-secondary/30">
          <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
            <Percent className="size-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-foreground mb-0.5">For VAT filing</div>
              Use Sales VAT collected as your output VAT, and Purchase VAT paid as your input VAT.
              The Net VAT position is what you owe (or are refundable) before any tax credits or
              rebates. Verify with your accountant before submitting to NBR.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  rows,
  total,
  totalLabel,
  invoiceLabel,
}: {
  title: string;
  tone: 'success' | 'warning';
  rows: TaxRow[];
  total: number;
  totalLabel: string;
  invoiceLabel: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div
        className={cn(
          'px-4 py-2.5 border-b border-border',
          tone === 'success' ? 'bg-success/5' : 'bg-warning/5',
        )}
      >
        <div className="font-semibold text-sm">{title}</div>
      </div>
      <div className="grid grid-cols-[0.8fr_1fr_1.2fr_1.2fr] gap-2 px-4 py-2 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        <div>Rate</div>
        <div className="text-right">{invoiceLabel}</div>
        <div className="text-right">Taxable amount</div>
        <div className="text-right">{totalLabel}</div>
      </div>
      {rows.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No data in this range.
        </div>
      )}
      {rows.map((r) => (
        <div
          key={r.rate}
          className="grid grid-cols-[0.8fr_1fr_1.2fr_1.2fr] gap-2 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30"
        >
          <div className="text-sm font-semibold tabular">{r.rate.toFixed(1)}%</div>
          <div className="text-sm tabular text-right">{formatNumber(r.invoices)}</div>
          <div className="text-sm tabular text-right">{formatBDT(r.taxableAmount)}</div>
          <div
            className={cn(
              'text-sm tabular text-right font-semibold',
              tone === 'success' ? 'text-success' : 'text-warning',
            )}
          >
            {formatBDT(r.taxCollected)}
          </div>
        </div>
      ))}
      {rows.length > 0 && (
        <div className="grid grid-cols-[0.8fr_1fr_1.2fr_1.2fr] gap-2 px-4 py-2.5 border-t-2 border-border bg-secondary/40 text-sm font-semibold">
          <div>Total</div>
          <div />
          <div />
          <div className="tabular text-right">{formatBDT(total)}</div>
        </div>
      )}
    </Card>
  );
}
