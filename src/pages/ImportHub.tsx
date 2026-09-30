import { Link } from 'react-router-dom';
import {
  Receipt,
  ShoppingBag,
  Package,
  Boxes,
  Users,
  UserCog,
  Wallet,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';

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
    instead: { to: '/products/new', label: 'Add a product instead' },
  },
  {
    to: '/products/import-stock',
    icon: Boxes,
    label: 'Import Opening Stock',
    desc: 'Set starting quantities for every product',
    instead: { to: '/products/new', label: 'Enter opening stock when you add the product' },
  },
  {
    to: '/contacts/customers/import',
    icon: Users,
    label: 'Import Customers',
    desc: 'Bring in your customer list with dues',
    instead: { to: '/contacts/customers', label: 'Add customers, with their opening due' },
  },
  {
    to: '/contacts/suppliers/import',
    icon: UserCog,
    label: 'Import Suppliers',
    desc: 'Bring in your supplier list with balances',
    instead: { to: '/contacts/suppliers', label: 'Add suppliers, with their opening balance' },
  },
  {
    to: '/sales/import',
    icon: Receipt,
    label: 'Import Sales',
    desc: 'Load past invoices, one row per line item',
    instead: { to: '/sales/new', label: 'Enter a sale instead' },
  },
  {
    to: '/purchases/import',
    icon: ShoppingBag,
    label: 'Import Purchases',
    desc: 'Load past purchase bills from a supplier',
    instead: { to: '/purchases/new', label: 'Enter a purchase instead' },
  },
  {
    to: '/expenses/import',
    icon: Wallet,
    label: 'Import Expenses',
    desc: 'Load recorded shop expenses in bulk',
    instead: { to: '/expenses', label: 'Add expenses instead' },
  },
];

/**
 * IMPORTING IS SWITCHED OFF (audit R1).
 *
 * The seven importer screens behind these cards never read the file: they
 * showed made-up counts ("24 rows, 22 valid") and said "Import complete"
 * while nothing reached the database. An owner who believed that would have
 * lost the records he thought he had brought in. Until real importers exist
 * (R2), the cards are shown as not available and every import route lands
 * here. Each card says how to enter the same records by hand today.
 */
export default function ImportHub() {
  return (
    <div className="min-h-full">
      <PageHeader
        title="Data & Import"
        subtitle="Bringing records in from a spreadsheet is not available yet."
      />

      <div className="px-6 pt-6">
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <Info className="size-5 shrink-0 text-warning mt-0.5" aria-hidden="true" />
          <div>
            <div className="font-semibold">Spreadsheet import is not ready yet</div>
            <p className="text-muted-foreground mt-1">
              These importers are switched off so nothing can look imported when it was not saved.
              Until they are ready, add records on their own screens. Exports work: use Export all on
              Sales, Purchases, Customers, Suppliers and Expenses, or Settings → Backup.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {IMPORTS.map(({ to, icon: Icon, label, desc, instead }) => (
          <div
            key={to}
            aria-disabled="true"
            className="flex items-center gap-4 rounded-lg border border-dashed border-border bg-card p-4 opacity-80"
          >
            <div className="grid place-items-center size-11 shrink-0 rounded-md bg-muted text-muted-foreground">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">{label}</span>
                <Badge variant="outline">Not available yet</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
              <Link to={instead.to} className="text-xs text-primary hover:underline mt-1 inline-block focus-ring rounded">
                {instead.label}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
