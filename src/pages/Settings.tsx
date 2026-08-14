import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import {
  Building2,
  MapPin,
  FileText,
  Barcode,
  Printer,
  Percent,
  Users,
  CloudUpload,
  Palette,
  Keyboard,
  ShoppingCart,
  Lock,
  HandCoins,
  RefreshCw,
  Gauge,
} from 'lucide-react';
import { useCanAll } from '@/hooks/useCan';
import { cn } from '@/lib/utils';

interface Tile {
  to: string;
  icon: any;
  label: string;
  desc: string;
  group: 'shop' | 'people' | 'docs' | 'devices' | 'app' | 'system';
  /**
   * Permission needed to do anything useful on that screen. Tiles without one
   * are personal preferences (theme, shortcuts) that anyone may change for
   * themselves. A tile whose every write would be refused at the IPC boundary is
   * hidden instead of shown: leading a cashier to a screen that rejects each of
   * their saves is worse than not offering it.
   */
  needs?: string;
}

const tiles: Tile[] = [
  // Shop
  { group: 'shop', to: '/settings/business',     icon: Building2,  label: 'Business Info',          desc: 'Shop name, logo, address, currency, fiscal year', needs: 'settings.business' },
  { group: 'shop', to: '/settings/branches',     icon: MapPin,     label: 'Branches',               desc: 'Add and manage shop branches', needs: 'settings.business' },
  { group: 'shop', to: '/settings/tax-rates',    icon: Percent,    label: 'Tax Rates',              desc: 'VAT and other tax rates', needs: 'settings.business' },
  // People
  { group: 'people', to: '/settings/users',          icon: Users,      label: 'Users',                  desc: 'Cashiers, managers, admin accounts', needs: 'settings.users' },
  { group: 'people', to: '/settings/roles',          icon: Users,      label: 'Roles & Permissions',    desc: 'What each role can do', needs: 'settings.roles' },
  { group: 'people', to: '/settings/sales-agents',   icon: HandCoins,  label: 'Sales Commission Agents', desc: 'Commission tracking (optional)', needs: 'settings.business' },
  // Docs
  { group: 'docs', to: '/settings/invoice-schemes',  icon: FileText,   label: 'Invoice Schemes',        desc: 'Numbering format per document type', needs: 'settings.business' },
  { group: 'docs', to: '/settings/receipt-template', icon: Printer,    label: 'Receipt Template',       desc: 'Header, footer, fields shown on print', needs: 'settings.business' },
  // Devices
  { group: 'devices', to: '/settings/barcode',       icon: Barcode,    label: 'Barcode Settings',       desc: 'Label sizes and printed fields', needs: 'settings.business' },
  { group: 'devices', to: '/settings/printers',      icon: Printer,    label: 'Receipt Printers',       desc: 'Thermal printer setup, test print', needs: 'settings.business' },
  // App — POS/cash prefs are shop policy; theme and shortcuts are personal.
  { group: 'app', to: '/settings/pos',              icon: ShoppingCart, label: 'POS Preferences',        desc: 'Default markup, payment methods, big-button mode', needs: 'settings.business' },
  { group: 'app', to: '/settings/cash-register',    icon: Lock,         label: 'Cash Register',          desc: 'Variance thresholds, default float', needs: 'settings.business' },
  { group: 'app', to: '/settings/appearance',       icon: Palette,      label: 'Theme & Appearance',     desc: 'Light/dark, accent color, density' },
  { group: 'app', to: '/settings/shortcuts',        icon: Keyboard,     label: 'Keyboard Shortcuts',     desc: 'Customize F-keys and combos' },
  // System
  { group: 'system', to: '/settings/backup',        icon: CloudUpload,  label: 'Backup & Cloud',         desc: 'Save a copy, restore, export CSV', needs: 'settings.backup' },
  { group: 'system', to: '/settings/updates',       icon: RefreshCw,    label: 'Updates',                desc: 'Get the newest version of this app', needs: 'settings.business' },
  { group: 'system', to: '/settings/performance',   icon: Gauge,        label: 'Performance',            desc: 'Settings for an older or slower computer', needs: 'settings.business' },
];

/** Every distinct permission the tiles above reference. */
const REQUIRED_PERMISSIONS = [
  'settings.business',
  'settings.users',
  'settings.roles',
  'settings.backup',
] as const;

const GROUP_TITLES: Record<Tile['group'], string> = {
  shop: 'Shop',
  people: 'People',
  docs: 'Documents',
  devices: 'Devices',
  app: 'Application',
  system: 'System',
};

export default function Settings() {
  const allowed = useCanAll(REQUIRED_PERMISSIONS);
  const visible = tiles.filter((t) => !t.needs || allowed[t.needs as (typeof REQUIRED_PERMISSIONS)[number]]);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure your shop, devices, and preferences" />
      <div className="p-6 space-y-6 max-w-6xl">
        {(Object.keys(GROUP_TITLES) as Tile['group'][])
          .filter((g) => visible.some((t) => t.group === g))
          .map((g) => (
          <section key={g}>
            <h2 className="text-[11px] uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-2">
              {GROUP_TITLES[g]}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {visible
                .filter((t) => t.group === g)
                .map((it) => {
                  const Icon = it.icon;
                  return (
                    <Link key={it.to} to={it.to}>
                      <Card className="p-4 hover:shadow-md hover:border-primary transition cursor-pointer h-full">
                        <div className="flex items-start gap-3">
                          <div className={cn('size-10 rounded-lg grid place-items-center bg-secondary text-muted-foreground')}>
                            <Icon className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm">{it.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{it.desc}</div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
