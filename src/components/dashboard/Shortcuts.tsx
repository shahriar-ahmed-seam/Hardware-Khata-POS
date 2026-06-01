import { Link } from 'react-router-dom';
import {
  Zap,
  ScanBarcode,
  ShoppingBag,
  Receipt,
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

// Pinned / default shortcuts shown at the top of the menu.
const pinned = [
  { to: '/pos',   icon: ScanBarcode, label: 'POS',             desc: 'Counter sale (fast)' },
  { to: '/sales', icon: Receipt,     label: "New Sale",         desc: 'Form-based sale (credit, B2B)' },
  { kind: 'profit' as const, icon: TrendingUp, label: "Today's Profit", desc: 'View profit breakdown' },
];

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
            Pinned
          </div>
          {pinned.map((it) => {
            const Icon = it.icon;
            const content = (
              <>
                <div className="size-8 rounded-md bg-primary/10 text-primary grid place-items-center">
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{it.label}</div>
                  <div className="text-[10px] text-muted-foreground">{it.desc}</div>
                </div>
              </>
            );
            if ('kind' in it && it.kind === 'profit') {
              return (
                <button
                  key={it.label}
                  onClick={() => {
                    close();
                    onOpenProfit();
                  }}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-secondary w-full text-left"
                >
                  {content}
                </button>
              );
            }
            return (
              <Link
                key={it.label}
                to={(it as { to: string }).to}
                onClick={close}
                className="flex items-center gap-3 px-3 py-2 hover:bg-secondary"
              >
                {content}
              </Link>
            );
          })}

          <div className="border-t border-border my-1" />
          <div className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
            More
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
