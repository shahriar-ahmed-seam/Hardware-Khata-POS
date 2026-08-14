import { Link } from 'react-router-dom';
import {
  Zap,
  ShoppingBag,
  Package,
  Users,
  Wallet,
  HandCoins,
  TrendingUp,
} from 'lucide-react';
import { Popover } from '@/components/ui/Popover';
import { Button } from '@/components/ui/Button';

interface Props {
  onOpenProfit: () => void;
}

// More shortcuts shown in the dropdown menu
const more = [
  { to: '/purchases',          icon: ShoppingBag, label: 'New Purchase',     desc: 'Goods received from supplier' },
  { to: '/products',           icon: Package,     label: 'New Product',      desc: 'Add to inventory' },
  { to: '/contacts/customers', icon: Users,       label: 'New Customer',     desc: 'Walk-in or contractor' },
  { to: '/expenses',           icon: Wallet,      label: 'New Expense',      desc: 'Rent, salary, transport…' },
  { to: '/contacts/dues',      icon: HandCoins,   label: 'Receive Payment',  desc: 'Collect against dues' },
  { to: '/reports',            icon: TrendingUp,  label: 'Profit / Loss Report', desc: 'View detailed report' },
];

export function Shortcuts({ onOpenProfit }: Props) {
  return (
    <Popover
      width="w-72"
      align="right"
      trigger={(_o, set) => (
        <Button onClick={() => set(true)}>
          <Zap className="size-4" /> Shortcuts
        </Button>
      )}
    >
      {(close) => (
        <div className="py-2">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
            Quick Actions
          </div>
          {more.map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.label}
                to={it.to}
                onClick={close}
                className="flex items-center gap-3 px-3 py-2 hover:bg-secondary"
              >
                <div className="size-8 rounded-md bg-secondary grid place-items-center">
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{it.label}</div>
                  <div className="text-[10px] text-muted-foreground">{it.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
