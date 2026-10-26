import { Link } from 'react-router-dom';
import { ScanBarcode, Receipt, ShoppingBag, Wallet, HandCoins } from 'lucide-react';
import { PendriveBackup } from './PendriveBackup';
import { tileClass } from './tile';
import { cn } from '@/lib/utils';

/**
 * DASHBOARD QUICK ACTIONS — the daily jobs, one row.
 *
 * A fixed grid (it used to re-flow under the sidebar inside the header). The
 * tiles are calm surfaces with a tinted icon; only POS is filled, as the one
 * primary action. Profit, New product and New customer were dropped: the profit
 * KPI opens the same breakdown, and the other two have Add buttons on their
 * list pages. Auto-fill columns, so a hidden Backup tile leaves no hole.
 */
export function QuickActions() {
  return (
    <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
      <Tile to="/pos" icon={ScanBarcode} label="POS" hint="Sell at the counter" primary />
      <Tile to="/sales/new" icon={Receipt} label="New sale" hint="Invoice with a form" chip="bg-sky-500/15 text-sky-500" />
      <Tile
        to="/contacts/dues"
        icon={HandCoins}
        label="Receive payment"
        hint="A customer pays their due"
        chip="bg-emerald-500/15 text-emerald-500"
      />
      <Tile
        to="/purchases/new"
        icon={ShoppingBag}
        label="New purchase"
        hint="Goods received"
        chip="bg-violet-500/15 text-violet-500"
      />
      <Tile to="/expenses" icon={Wallet} label="Expenses" hint="Rent, salary, transport" chip="bg-rose-500/15 text-rose-500" />
      {/* Renders nothing without `settings.backup`; owns drive detection. */}
      <PendriveBackup variant="tile" />
    </div>
  );
}

function Tile({
  to,
  icon: Icon,
  label,
  hint,
  chip,
  primary,
}: {
  to: string;
  icon: typeof ScanBarcode;
  label: string;
  hint: string;
  chip?: string;
  primary?: boolean;
}) {
  return (
    <Link to={to} className="block w-full rounded-lg focus-ring" title={label}>
      <div className={tileClass(primary)}>
        <span
          className={cn(
            'size-9 rounded-md grid place-items-center shrink-0',
            primary ? 'bg-white/15' : chip,
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          {/* Each label is one complete text node so the Bangla layer can match it. */}
          <div className="text-sm font-semibold leading-tight truncate">{label}</div>
          <div
            className={cn(
              'text-xs leading-tight truncate',
              primary ? 'text-primary-foreground/85' : 'text-muted-foreground',
            )}
          >
            {hint}
          </div>
        </div>
      </div>
    </Link>
  );
}
