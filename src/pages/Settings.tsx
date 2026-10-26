import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import {
  Building2,
  MapPin,
  Barcode,
  Printer,
  ReceiptText,
  Percent,
  Users,
  ShieldCheck,
  CloudUpload,
  Type,
  Keyboard,
  ShoppingCart,
  Lock,
  HandCoins,
  RefreshCw,
  Gauge,
  ChevronDown,
} from 'lucide-react';
import { useCanAll } from '@/hooks/useCan';
import { BackupStatusLine } from '@/components/settings/BackupStatus';
import { cn } from '@/lib/utils';

type Group = 'everyday' | 'selling' | 'advanced';

interface Tile {
  to: string;
  icon: any;
  label: string;
  desc: string;
  group: Group;
  /**
   * Permission needed to do anything useful on that screen. Tiles without one
   * are personal preferences (theme, shortcuts) that anyone may change for
   * themselves. A tile whose every write would be refused at the IPC boundary is
   * hidden instead of shown: leading a cashier to a screen that rejects each of
   * their saves is worse than not offering it.
   */
  needs?: string;
}

/**
 * Grouped by how often the owner comes here, not by developer category.
 * Invoice Schemes is not listed: nothing reads those prefs yet (R12), so the
 * tile would promise numbering changes that never happen. The route stays.
 */
const tiles: Tile[] = [
  // Everyday — the four things an owner actually opens.
  { group: 'everyday', to: '/settings/backup',     icon: CloudUpload, label: 'Backup',              desc: 'Save a copy of your data, restore', needs: 'settings.backup' },
  { group: 'everyday', to: '/settings/appearance', icon: Type,        label: 'Text size & theme',   desc: 'Make text bigger, light or dark' },
  { group: 'everyday', to: '/settings/business',   icon: Building2,   label: 'Shop details',        desc: 'Name, logo, address and phone on receipts', needs: 'settings.business' },
  { group: 'everyday', to: '/settings/users',      icon: Users,       label: 'Users & PINs',        desc: 'Cashiers, managers, admin accounts', needs: 'settings.users' },
  // Selling & printing
  { group: 'selling', to: '/settings/receipt-template', icon: ReceiptText,  label: 'Receipt Template', desc: 'Header, footer, fields shown on print', needs: 'settings.business' },
  { group: 'selling', to: '/settings/printers',         icon: Printer,      label: 'Receipt Printers', desc: 'Thermal printer setup, test print', needs: 'settings.business' },
  { group: 'selling', to: '/settings/pos',              icon: ShoppingCart, label: 'POS Preferences',  desc: 'Default markup, payment methods, big-button mode', needs: 'settings.business' },
  { group: 'selling', to: '/settings/cash-register',    icon: Lock,         label: 'Cash Register',    desc: 'Variance thresholds, default float', needs: 'settings.business' },
  { group: 'selling', to: '/settings/tax-rates',        icon: Percent,      label: 'Tax Rates',        desc: 'VAT and other tax rates', needs: 'settings.business' },
  { group: 'selling', to: '/settings/barcode',          icon: Barcode,      label: 'Barcode labels',   desc: 'Label sizes and printed fields', needs: 'settings.business' },
  // Advanced — one-time technical setup, collapsed by default.
  { group: 'advanced', to: '/settings/roles',        icon: ShieldCheck, label: 'Roles & Permissions', desc: 'What each role can do', needs: 'settings.roles' },
  { group: 'advanced', to: '/settings/branches',     icon: MapPin,      label: 'Branches',            desc: 'Add and manage shop branches', needs: 'settings.business' },
  { group: 'advanced', to: '/settings/sales-agents', icon: HandCoins,   label: 'Commission agents',   desc: 'Commission tracking (optional)', needs: 'settings.business' },
  { group: 'advanced', to: '/settings/shortcuts',    icon: Keyboard,    label: 'Keyboard Shortcuts',  desc: 'Customize F-keys and combos' },
  { group: 'advanced', to: '/settings/performance',  icon: Gauge,       label: 'Performance',         desc: 'Settings for an older or slower computer', needs: 'settings.business' },
  { group: 'advanced', to: '/settings/updates',      icon: RefreshCw,   label: 'Updates',             desc: 'Get the newest version of this app', needs: 'settings.business' },
];

/** Every distinct permission the tiles above reference. */
const REQUIRED_PERMISSIONS = [
  'settings.business',
  'settings.users',
  'settings.roles',
  'settings.backup',
] as const;

const ADVANCED_KEY = 'settings-hub-advanced-open';

export default function Settings() {
  const allowed = useCanAll(REQUIRED_PERMISSIONS);
  const visible = tiles.filter((t) => !t.needs || allowed[t.needs as (typeof REQUIRED_PERMISSIONS)[number]]);
  const of = (g: Group) => visible.filter((t) => t.group === g);
  // Remembered per computer; closed by default.
  const [advancedOpen, setAdvancedOpen] = useState(() => localStorage.getItem(ADVANCED_KEY) === '1');
  useEffect(() => {
    localStorage.setItem(ADVANCED_KEY, advancedOpen ? '1' : '0');
  }, [advancedOpen]);

  const everyday = of('everyday');
  const selling = of('selling');
  const advanced = of('advanced');

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="p-6 space-y-6 max-w-6xl">
        {everyday.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-2">Everyday</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {everyday.map((it) => (
                <TileCard key={it.to} tile={it} primary />
              ))}
            </div>
          </section>
        )}

        {selling.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-2">Selling & printing</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {selling.map((it) => (
                <TileCard key={it.to} tile={it} />
              ))}
            </div>
          </section>
        )}

        {advanced.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
              className="inline-flex items-center gap-2 h-10 px-3 -ml-3 rounded-md text-sm font-semibold hover:bg-secondary focus-ring"
            >
              <ChevronDown className={cn('size-4 transition-transform', !advancedOpen && '-rotate-90')} />
              <span>Advanced settings</span>
              <span className="text-muted-foreground font-normal tabular">({advanced.length})</span>
            </button>
            {advancedOpen && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-2">
                {advanced.map((it) => (
                  <TileCard key={it.to} tile={it} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function TileCard({ tile, primary }: { tile: Tile; primary?: boolean }) {
  const Icon = tile.icon;
  return (
    <Link to={tile.to} className="block focus-ring rounded-lg">
      <Card className={cn('hover:shadow-md hover:border-primary transition cursor-pointer h-full', primary ? 'p-5' : 'p-4')}>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'rounded-lg grid place-items-center shrink-0 bg-secondary text-muted-foreground',
              primary ? 'size-12' : 'size-10',
            )}
          >
            <Icon className={primary ? 'size-6' : 'size-5'} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm">{tile.label}</div>
            <div className="text-xs text-foreground/75 mt-0.5">{tile.desc}</div>
            {tile.to === '/settings/backup' && <BackupStatusLine className="mt-2" />}
          </div>
        </div>
      </Card>
    </Link>
  );
}
