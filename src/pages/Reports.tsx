import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
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
  Tag,
  HandCoins,
  Package,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tile {
  to: string;
  label: string;
  desc: string;
  icon: any;
  tone: 'primary' | 'info' | 'success' | 'warning' | 'destructive';
  group: 'overview' | 'sales' | 'purchases' | 'stock' | 'people' | 'ops';
}

const tiles: Tile[] = [
  // Overview
  { group: 'overview', to: '/reports/profit-loss', label: 'Profit / Loss', desc: 'Revenue vs cost vs expenses', icon: TrendingUp, tone: 'primary' },
  { group: 'overview', to: '/reports/activity-log', label: 'Activity Log', desc: 'Who did what, when', icon: Activity, tone: 'info' },
  { group: 'overview', to: '/cash-register/report', label: 'Register Report', desc: 'Shifts history with X / Z reports', icon: Tag, tone: 'primary' },
  // Sales
  { group: 'sales', to: '/reports/product-sell', label: 'Product Sell Report', desc: 'Items sold per product', icon: ShoppingCart, tone: 'info' },
  { group: 'sales', to: '/reports/sell-payment', label: 'Sell Payment Report', desc: 'Money collected per method', icon: Banknote, tone: 'success' },
  { group: 'sales', to: '/reports/trending', label: 'Trending Products', desc: 'Top movers vs prior period', icon: TrendingUp, tone: 'primary' },
  { group: 'sales', to: '/reports/sales-rep', label: 'Sales Rep Report', desc: 'Commission agent breakdown', icon: HandCoins, tone: 'info' },
  { group: 'sales', to: '/reports/customer-group', label: 'Customer Group Report', desc: 'Sales per price group', icon: Users, tone: 'info' },
  // Purchases
  { group: 'purchases', to: '/reports/product-purchase', label: 'Product Purchase Report', desc: 'Items purchased per product', icon: ShoppingBag, tone: 'info' },
  { group: 'purchases', to: '/reports/purchase-payment', label: 'Purchase Payment Report', desc: 'Money paid per method', icon: Banknote, tone: 'success' },
  { group: 'purchases', to: '/reports/tax', label: 'Tax Report', desc: 'Sales VAT and purchase VAT', icon: Percent, tone: 'info' },
  // Stock
  { group: 'stock', to: '/reports/stock', label: 'Stock Report', desc: 'Current stock + value', icon: Boxes, tone: 'info' },
  { group: 'stock', to: '/reports/stock-alert', label: 'Stock Alert', desc: 'Low / out-of-stock items', icon: AlertTriangle, tone: 'warning' },
  { group: 'stock', to: '/reports/stock-adjustment', label: 'Stock Adjustment', desc: 'Damage, theft, sample, recount', icon: Sliders, tone: 'warning' },
  { group: 'stock', to: '/reports/stock-transfers', label: 'Stock Transfers', desc: 'Inter-branch movements', icon: ArrowLeftRight, tone: 'info' },
  // People
  { group: 'people', to: '/reports/contacts', label: 'Customer / Supplier', desc: 'Statements + ledgers', icon: UserCog, tone: 'info' },
  // Ops
  { group: 'ops', to: '/reports/items', label: 'Items Report', desc: 'Catalog snapshot', icon: Package, tone: 'info' },
];

const tones: Record<Tile['tone'], string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-accent/10 text-accent',
};

const GROUP_TITLES: Record<Tile['group'], { label: string; icon: any }> = {
  overview: { label: 'Overview', icon: BarChart3 },
  sales: { label: 'Sales', icon: ShoppingCart },
  purchases: { label: 'Purchases', icon: ShoppingBag },
  stock: { label: 'Stock', icon: Boxes },
  people: { label: 'People', icon: Users },
  ops: { label: 'Operations', icon: Activity },
};

export default function Reports() {
  return (
    <div>
      <PageHeader title="Reports" subtitle="Insights into sales, stock, money, and people" />
      <div className="p-6 space-y-6 max-w-6xl">
        {(Object.keys(GROUP_TITLES) as Tile['group'][]).map((g) => {
          const list = tiles.filter((t) => t.group === g);
          if (list.length === 0) return null;
          const Icon = GROUP_TITLES[g].icon;
          return (
            <section key={g}>
              <div className="flex items-center gap-2 mb-2 text-[11px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                <Icon className="size-3.5" />
                {GROUP_TITLES[g].label}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {list.map((t) => {
                  const I = t.icon;
                  return (
                    <Link key={t.to} to={t.to}>
                      <Card className="p-4 hover:shadow-md hover:border-primary transition cursor-pointer h-full">
                        <div className="flex items-start gap-3">
                          <div className={cn('size-10 rounded-lg grid place-items-center', tones[t.tone])}>
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
            </section>
          );
        })}
      </div>
    </div>
  );
}
