import { Link } from 'react-router-dom';
import {
  ScanBarcode,
  Receipt,
  ShoppingBag,
  TrendingUp,
  PackagePlus,
  UserPlus,
  Wallet,
  HandCoins,
} from 'lucide-react';
import { PendriveBackup } from './PendriveBackup';
import { cn } from '@/lib/utils';

/**
 * DASHBOARD QUICK ACTIONS - A FIXED TWO-ROW GRID.
 *
 * These used to live in the PageHeader's action row alongside the range picker,
 * refresh, edit-layout and customise buttons. That row is `flex-wrap`, so the
 * buttons re-flowed on every window resize and, at narrower widths, the leftmost
 * ones ended up underneath the sidebar. The owner's complaint was exactly that:
 * "some buttons get cut by side bar" and they never stay put.
 *
 * A grid fixes both problems at once. FOUR columns, TWO rows, always - the tiles
 * get narrower as the window does, but each one keeps its position, so muscle
 * memory works and nothing can slide under the sidebar. Eight tiles is not a
 * coincidence: it is what fills two rows of four exactly, with no ragged gap.
 *
 * Every destination is a route that exists (checked against App.tsx). Several of
 * these previously pointed at LIST pages rather than the create form - "New Sale"
 * opened the sales list, so the button did not do what it said.
 */

interface Props {
  onOpenProfit: () => void;
}

export function QuickActions({ onOpenProfit }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Tile
        to="/pos"
        icon={ScanBarcode}
        label="POS"
        hint="Sell at the counter"
        tone="bg-emerald-600 hover:bg-emerald-700"
      />
      <Tile
        to="/sales/new"
        icon={Receipt}
        label="New Sale"
        hint="Form-based invoice"
        tone="bg-sky-600 hover:bg-sky-700"
      />
      <Tile
        to="/purchases/new"
        icon={ShoppingBag}
        label="New Purchase"
        hint="Goods received"
        tone="bg-violet-600 hover:bg-violet-700"
      />
      <Tile
        onClick={onOpenProfit}
        icon={TrendingUp}
        label="Today's Profit"
        hint="Breakdown"
        tone="bg-orange-600 hover:bg-orange-700"
      />
      <Tile
        to="/products/new"
        icon={PackagePlus}
        label="New Product"
        hint="Add to catalogue"
        tone="bg-teal-600 hover:bg-teal-700"
      />
      <Tile
        to="/contacts/customers"
        icon={UserPlus}
        label="New Customer"
        hint="Walk-in or contractor"
        tone="bg-indigo-600 hover:bg-indigo-700"
      />
      <Tile
        to="/expenses"
        icon={Wallet}
        label="New Expense"
        hint="Rent, salary, transport"
        tone="bg-rose-600 hover:bg-rose-700"
      />
      {/*
        Pendrive backup keeps its own component: it renders NOTHING for a user
        without `settings.backup`, and it owns the drive detection and the busy
        state. `variant="tile"` makes it match the seven tiles above.
      */}
      <PendriveBackup variant="tile" />
    </div>
  );
}

function Tile({
  to,
  onClick,
  icon: Icon,
  label,
  hint,
  tone,
}: {
  to?: string;
  onClick?: () => void;
  icon: typeof ScanBarcode;
  label: string;
  hint: string;
  tone: string;
}) {
  const body = (
    <div
      className={cn(
        'h-full min-h-[3.25rem] w-full rounded-lg px-3 py-2 flex items-center gap-2.5 text-left text-white transition shadow-sm',
        tone,
      )}
    >
      <Icon className="size-5 shrink-0" />
      <div className="min-w-0">
        {/* Each label is one complete text node so the Bangla layer can match it. */}
        <div className="text-sm font-semibold leading-tight truncate">{label}</div>
        <div className="text-[10px] opacity-80 leading-tight truncate">{hint}</div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="block w-full" title={label}>
        {body}
      </button>
    );
  }
  return (
    <Link to={to ?? '#'} className="block w-full" title={label}>
      {body}
    </Link>
  );
}
