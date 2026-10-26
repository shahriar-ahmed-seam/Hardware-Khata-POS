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
      <PageHeader title="Data & Import" />
      <div className="p-6 max-w-2xl space-y-5">
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <Info className="size-5 shrink-0 text-warning mt-0.5" aria-hidden="true" />
          <p>
            Importing from Excel is coming later. For now, add records on their own screens. To take
            data out, use Export all on each list or Settings → Backup.
          </p>
        </div>

        {/* One message, said once: a plain list of where to add each kind of record. */}
        <section>
          <h2 className="text-sm font-semibold mb-2">Add records by hand</h2>
          <ul className="rounded-lg border border-border bg-card divide-y divide-border">
            {IMPORTS.map(({ to, icon: Icon, instead }) => (
              <li key={to}>
                <Link
                  to={instead.to}
                  className="flex items-center gap-3 h-11 px-4 text-sm hover:bg-secondary/50 focus-ring"
                >
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1">{instead.label}</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
