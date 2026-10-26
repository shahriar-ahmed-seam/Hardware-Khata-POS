import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingCart,
  ShoppingBag,
  Banknote,
  Boxes,
  AlertTriangle,
  Sliders,
  Percent,
  Activity,
  Users,
  UserCog,
  ArrowLeftRight,
  HandCoins,
  ChevronDown,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { useIsMultiBranch } from '@/components/stock/hooks';
import { useReportQuery } from '@/components/reports/useReportQuery';
import { formatBDT, formatNumber, cn } from '@/lib/utils';

interface Tile {
  to: string;
  label: string;
  desc: string;
  icon: any;
  warn?: boolean;
}

/** The five everyday questions, in the order the owner asks them. */
const LEAD: Tile[] = [
  { to: '/reports/sell-payment?preset=today', label: 'Money collected', desc: 'Cash, bKash and card taken today', icon: Banknote },
  { to: '/reports/profit-loss', label: 'Profit / Loss', desc: 'Sales, costs and net profit this month', icon: TrendingUp },
  { to: '/reports/stock-alert', label: 'Low stock', desc: 'What to reorder', icon: AlertTriangle, warn: true },
  { to: '/reports/contacts', label: 'Customer & supplier balances', desc: 'Who owes you, whom you owe', icon: UserCog },
  { to: '/reports/product-sell', label: 'Sales by product', desc: 'Best sellers, units and profit', icon: ShoppingCart },
];

// Trending is folded into Sales by product, Items into Stock (owner decision 7);
// the Register report lives under Cash Register.
const GROUPS: { label: string; icon: any; tiles: Tile[] }[] = [
  {
    label: 'Sales',
    icon: ShoppingCart,
    tiles: [
      { to: '/reports/sales-rep', label: 'Sales agents', desc: 'Commission per agent', icon: HandCoins },
      { to: '/reports/customer-group', label: 'Customer groups', desc: 'Sales per price group', icon: Users },
    ],
  },
  {
    label: 'Purchases',
    icon: ShoppingBag,
    tiles: [
      { to: '/reports/product-purchase', label: 'Purchases by product', desc: 'What you bought, per product', icon: ShoppingBag },
      { to: '/reports/purchase-payment', label: 'Money paid to suppliers', desc: 'Supplier payments by method', icon: Banknote },
      { to: '/reports/tax', label: 'VAT report', desc: 'Sales VAT and purchase VAT', icon: Percent },
    ],
  },
  {
    label: 'Stock',
    icon: Boxes,
    tiles: [
      { to: '/reports/stock', label: 'Stock report', desc: 'Current stock and its value', icon: Boxes },
      { to: '/reports/stock-adjustment', label: 'Stock adjustments', desc: 'Damage, theft, samples, recounts', icon: Sliders },
      { to: '/reports/stock-transfers', label: 'Stock transfers', desc: 'Between branches', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Records',
    icon: Activity,
    tiles: [{ to: '/reports/activity-log', label: 'Activity log', desc: 'Who did what, when', icon: Activity }],
  },
];

const OPEN_KEY = 'hk.reports.allOpen';

export default function Reports() {
  // Stock transfers only mean something with 2+ branches (owner decision 5).
  const multiBranch = useIsMultiBranch();
  const [allOpen, setAllOpen] = useState(() => localStorage.getItem(OPEN_KEY) === '1');
  useEffect(() => localStorage.setItem(OPEN_KEY, allOpen ? '1' : '0'), [allOpen]);

  // One live figure on three lead tiles, from the channels those reports use.
  const today = useReportQuery<{ total: number }>('reports.sellPayments', { range: { preset: 'today' } }, []);
  const pnl = useReportQuery<{ netProfit: number }>('reports.profitLoss', { range: { preset: 'thisMonth' } }, []);
  const low = useReportQuery<unknown[]>('dashboard.lowStock', { limit: 200 }, []);
  const figure: Record<string, { label: string; value: string; bad?: boolean } | undefined> = {
    [LEAD[0].to]: today.data ? { label: 'Today', value: formatBDT(today.data.total) } : undefined,
    [LEAD[1].to]: pnl.data
      ? { label: 'Net profit', value: formatBDT(pnl.data.netProfit), bad: pnl.data.netProfit < 0 }
      : undefined,
    [LEAD[2].to]: low.data ? { label: 'Items to reorder', value: formatNumber(low.data.length) } : undefined,
  };

  return (
    <div>
      <PageHeader title="Reports" />
      <div className="p-6 pt-2 space-y-6 max-w-6xl">
        <section aria-labelledby="rep-most-used">
          <h2 id="rep-most-used" className="text-base font-semibold mb-3">
            Most used
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {LEAD.map((t) => {
              const I = t.icon;
              const f = figure[t.to];
              return (
                <Link key={t.to} to={t.to} className="rounded-xl focus-ring">
                  <Card className="p-5 hover:shadow-md hover:border-primary transition h-full">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'size-10 rounded-lg grid place-items-center shrink-0',
                          t.warn ? 'bg-warning/15 text-warning' : 'bg-secondary text-foreground',
                        )}
                      >
                        <I className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-base">{t.label}</div>
                        <div className="text-sm text-muted-foreground mt-0.5">{t.desc}</div>
                        {f && (
                          <div className="text-sm mt-2">
                            <span className="text-muted-foreground">{f.label}</span>{' '}
                            <span className={cn('font-semibold tabular', f.bad && 'text-destructive')}>{f.value}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <button
            type="button"
            aria-expanded={allOpen}
            onClick={() => setAllOpen((o) => !o)}
            className="inline-flex items-center gap-2 h-10 px-3 -ml-3 rounded-md text-base font-semibold hover:bg-secondary focus-ring"
          >
            <ChevronDown className={cn('size-5 transition-transform', !allOpen && '-rotate-90')} />
            All reports
          </button>
          {allOpen && (
            <div className="mt-3 space-y-5">
              {GROUPS.map((g) => {
                const list = g.tiles.filter((t) => multiBranch || t.to !== '/reports/stock-transfers');
                const GI = g.icon;
                return (
                  <div key={g.label}>
                    <h3 className="flex items-center gap-2 mb-2 text-sm font-semibold text-foreground">
                      <GI className="size-4 text-muted-foreground" />
                      {g.label}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {list.map((t) => {
                        const I = t.icon;
                        return (
                          <Link key={t.to} to={t.to} className="rounded-xl focus-ring">
                            <Card className="p-4 hover:shadow-md hover:border-primary transition h-full">
                              <div className="flex items-start gap-3">
                                <div className="size-10 rounded-lg grid place-items-center shrink-0 bg-secondary text-foreground">
                                  <I className="size-5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-sm">{t.label}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                                </div>
                              </div>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
