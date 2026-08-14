import { Link } from 'react-router-dom';
import {
  Receipt,
  ShoppingBag,
  Package,
  Boxes,
  Users,
  UserCog,
  Wallet,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

/**
 * DATA & IMPORT HUB
 *
 * The sidebar used to carry seven separate "Import …" rows — one inside almost
 * every group — which was the single most repeated idea in the navigation.
 * They all live here now, so the sidebar stays short and bulk data entry is one
 * predictable place instead of six.
 */
const IMPORTS = [
  {
    to: '/products/import',
    icon: Package,
    label: 'Import Products',
    desc: 'Add your catalogue in bulk from a spreadsheet',
  },
  {
    to: '/products/import-stock',
    icon: Boxes,
    label: 'Import Opening Stock',
    desc: 'Set starting quantities for every product',
  },
  {
    to: '/contacts/customers/import',
    icon: Users,
    label: 'Import Customers',
    desc: 'Bring in your customer list with dues',
  },
  {
    to: '/contacts/suppliers/import',
    icon: UserCog,
    label: 'Import Suppliers',
    desc: 'Bring in your supplier list with balances',
  },
  {
    to: '/sales/import',
    icon: Receipt,
    label: 'Import Sales',
    desc: 'Load past invoices, one row per line item',
  },
  {
    to: '/purchases/import',
    icon: ShoppingBag,
    label: 'Import Purchases',
    desc: 'Load past purchase bills from a supplier',
  },
  {
    to: '/expenses/import',
    icon: Wallet,
    label: 'Import Expenses',
    desc: 'Load recorded shop expenses in bulk',
  },
];

export default function ImportHub() {
  return (
    <div className="min-h-full">
      <PageHeader
        title="Data & Import"
        subtitle="Bring existing shop records in from a spreadsheet. Every importer shows a downloadable template first."
      />

      <div className="p-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {IMPORTS.map(({ to, icon: Icon, label, desc }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition hover:border-primary hover:bg-secondary focus-ring"
          >
            <div className="grid place-items-center size-11 shrink-0 rounded-md bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </div>
  );
}
