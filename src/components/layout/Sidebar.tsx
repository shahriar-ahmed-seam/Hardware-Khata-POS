import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ScanBarcode,
  ShoppingCart,
  Receipt,
  PenSquare,
  FileText,
  Undo2,
  Truck,
  Tag,
  Package,
  Boxes,
  ListTree,
  Award,
  Ruler,
  Layers,
  Barcode,
  TrendingUp,
  Warehouse,
  ArrowLeftRight,
  AlertTriangle,
  Users,
  UserCog,
  Wallet,
  HandCoins,
  ShoppingBag,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelsTopLeft,
  BarChart3,
  MessageSquare,
  Settings,
  Hammer,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUI } from '@/stores/ui';
import { useT } from '@/lib/i18n';

type Item = { label: string; to: string; icon: any; badge?: string };
type Group = { label: string; icon: any; items: Item[] };
type Entry = { kind: 'item'; item: Item } | { kind: 'group'; group: Group };

const nav: Entry[] = [
  { kind: 'item', item: { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard } },
  { kind: 'item', item: { label: 'POS', to: '/pos', icon: ScanBarcode, badge: 'Ctrl+N' } },
  {
    kind: 'group',
    group: {
      label: 'Sales',
      icon: ShoppingCart,
      items: [
        { label: 'All Sales', to: '/sales', icon: Receipt },
        { label: 'New Sale', to: '/sales/new', icon: PenSquare },
        { label: 'Drafts', to: '/sales/drafts', icon: PenSquare },
        { label: 'Quotations', to: '/sales/quotations', icon: FileText },
        { label: 'Sell Returns', to: '/sales/returns', icon: Undo2 },
        { label: 'Shipments', to: '/sales/shipments', icon: Truck },
        { label: 'Import Sales', to: '/sales/import', icon: ListTree },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      label: 'Purchases',
      icon: ShoppingBag,
      items: [
        { label: 'All Purchases', to: '/purchases', icon: Receipt },
        { label: 'Add Purchase', to: '/purchases/new', icon: PenSquare },
        { label: 'Purchase Returns', to: '/purchases/returns', icon: Undo2 },
        { label: 'Import Purchases', to: '/purchases/import', icon: ListTree },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      label: 'Products',
      icon: Package,
      items: [
        { label: 'All Products', to: '/products', icon: Boxes },
        { label: 'Categories', to: '/products/categories', icon: ListTree },
        { label: 'Brands', to: '/products/brands', icon: Award },
        { label: 'Units', to: '/products/units', icon: Ruler },
        { label: 'Variations', to: '/products/variations', icon: Layers },
        { label: 'Bulk Price Update', to: '/products/price-update', icon: Tag },
        { label: 'Price Groups', to: '/products/price-groups', icon: Tag },
        { label: 'Barcode Print', to: '/products/barcodes', icon: Barcode },
        { label: 'Warranties', to: '/products/warranties', icon: Award },
        { label: 'Import Products', to: '/products/import', icon: ListTree },
        { label: 'Import Opening Stock', to: '/products/import-stock', icon: ListTree },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      label: 'Stock',
      icon: Warehouse,
      items: [
        { label: 'Stock Report', to: '/stock', icon: Boxes },
        { label: 'Stock Alerts', to: '/stock/alerts', icon: AlertTriangle, badge: '4' },
        { label: 'Transfers', to: '/stock/transfers', icon: ArrowLeftRight },
        { label: 'Damage / Adjustment', to: '/stock/adjustments', icon: AlertTriangle },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      label: 'Contacts',
      icon: Users,
      items: [
        { label: 'Customers', to: '/contacts/customers', icon: Users },
        { label: 'Suppliers', to: '/contacts/suppliers', icon: UserCog },
        { label: 'Customer Groups', to: '/contacts/customer-groups', icon: Users },
        { label: 'Customer Dues', to: '/contacts/dues', icon: HandCoins },
        { label: 'Import Customers', to: '/contacts/customers/import', icon: ListTree },
        { label: 'Import Suppliers', to: '/contacts/suppliers/import', icon: ListTree },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      label: 'Expenses',
      icon: Wallet,
      items: [
        { label: 'All Expenses', to: '/expenses', icon: Receipt },
        { label: 'Categories', to: '/expenses/categories', icon: ListTree },
        { label: 'Import Expenses', to: '/expenses/import', icon: ListTree },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      label: 'Cash Register',
      icon: Store,
      items: [
        { label: 'Open / Close Shift', to: '/cash-register', icon: Store },
        { label: 'Register Report', to: '/cash-register/report', icon: BarChart3 },
      ],
    },
  },
  { kind: 'item', item: { label: 'Reports', to: '/reports', icon: TrendingUp } },
  { kind: 'item', item: { label: 'SMS', to: '/sms', icon: MessageSquare } },
  { kind: 'item', item: { label: 'Settings', to: '/settings', icon: Settings } },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUI();
  const location = useLocation();
  const { t } = useT();

  // Accordion: only one group open at a time.
  // Initially open the group that contains the current route.
  const initialOpen = (() => {
    for (const e of nav) {
      if (e.kind === 'group' && e.group.items.some((i) => location.pathname.startsWith(i.to))) {
        return e.group.label;
      }
    }
    return null;
  })();
  const [openGroup, setOpenGroup] = useState<string | null>(initialOpen);

  return (
    <aside
      className={cn(
        'shrink-0 bg-sidebar text-sidebar-foreground border-r border-border flex flex-col transition-[width] duration-200',
        sidebarCollapsed ? 'w-[64px]' : 'w-[240px]',
      )}
    >
      <div className="flex items-center gap-2 px-3 h-12 border-b border-sidebar-border">
        <div className="grid place-items-center size-7 rounded-md bg-gradient-to-br from-primary to-accent text-white">
          <Hammer className="size-4" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 leading-tight">
            <div className="text-[13px] font-semibold">Hardware POS</div>
            <div className="text-[10px] opacity-60 -mt-0.5">v0.1 · Offline ready</div>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="size-7 grid place-items-center rounded-md hover:bg-sidebar-hover text-sidebar-foreground/70 hover:text-sidebar-foreground"
        >
          {sidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {nav.map((entry, i) =>
          entry.kind === 'item' ? (
            <SidebarItem key={i} item={entry.item} collapsed={sidebarCollapsed} />
          ) : (
            <SidebarGroup
              key={i}
              group={entry.group}
              collapsed={sidebarCollapsed}
              currentPath={location.pathname}
              isOpen={openGroup === entry.group.label}
              onToggle={() =>
                setOpenGroup((cur) => (cur === entry.group.label ? null : entry.group.label))
              }
            />
          ),
        )}
      </nav>

      <div className="px-3 py-2 border-t border-sidebar-border">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-2 text-[11px] opacity-70">
            <PanelsTopLeft className="size-3.5" />
            <span>{t('sidebar.shortcutsHint')}</span>
          </div>
        ) : (
          <div className="grid place-items-center text-[10px] opacity-60">F1</div>
        )}
      </div>
    </aside>
  );
}

function SidebarItem({ item, collapsed }: { item: Item; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground',
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.badge && (
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sidebar-hover">
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

function SidebarGroup({
  group,
  collapsed,
  currentPath,
  isOpen,
  onToggle,
}: {
  group: Group;
  collapsed: boolean;
  currentPath: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const hasActive = group.items.some((i) => currentPath.startsWith(i.to));
  const Icon = group.icon;
  const open = isOpen;

  if (collapsed) {
    return (
      <div className="relative group/g" title={group.label}>
        <button className="w-full flex items-center justify-center size-10 rounded-md hover:bg-sidebar-hover text-sidebar-foreground/80">
          <Icon className="size-4" />
        </button>
        <div className="hidden group-hover/g:block absolute left-full top-0 ml-2 z-30 min-w-[180px] bg-card text-card-foreground border border-border rounded-md shadow-lg py-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">{group.label}</div>
          {group.items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-secondary',
                  isActive && 'bg-secondary text-primary',
                )
              }
            >
              <it.icon className="size-3.5" /> {it.label}
            </NavLink>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition',
          hasActive
            ? 'text-sidebar-foreground'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground',
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn('size-3.5 opacity-60 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="ml-3 pl-3 border-l border-sidebar-border mt-0.5 space-y-0.5">
          {group.items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] transition',
                  isActive
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground',
                )
              }
            >
              <it.icon className="size-3.5 shrink-0" />
              <span className="flex-1 truncate">{it.label}</span>
              {it.badge && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-warning/20 text-warning">
                  {it.badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
