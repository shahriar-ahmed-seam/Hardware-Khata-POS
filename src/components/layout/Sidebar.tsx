import { useMemo, useState } from 'react';
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
  BarChart3,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUI } from '@/stores/ui';
import { useBranches } from '@/stores/branches';

type Item = { label: string; to: string; icon: any; badge?: string };
type Group = { label: string; icon: any; items: Item[] };
type Entry = { kind: 'item'; item: Item } | { kind: 'group'; group: Group };

/**
 * NAVIGATION
 *
 * Trimmed deliberately for an elderly shop owner:
 *  - The seven per-module "Import …" rows collapsed into one "Data & Import"
 *    hub (`/import`) instead of repeating the same idea in six groups.
 *  - "Variations" removed — it only ever rendered a Placeholder page.
 *  - Expenses, Data & Import and Settings live in the gear menu in the
 *    titlebar (MoreMenu.tsx). Reports is in both places: the owner looks at it
 *    daily and could not find it behind the gear.
 *  - Stock Transfers only shows once the shop has a second branch.
 *  - No fabricated counters (the old hard-coded "4" stock-alert badge is gone).
 */
const nav: Entry[] = [
  { kind: 'item', item: { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard } },
  // No shortcut badge: 'Ctrl+N' was never actually wired to anything, and it
  // squeezed the Bangla label ('বিক্রয় কাউন্টার') until it was unreadable.
  // Real POS shortcuts live in the F1 shortcuts overlay.
  { kind: 'item', item: { label: 'POS', to: '/pos', icon: ScanBarcode } },
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
        { label: 'Bulk Price Update', to: '/products/price-update', icon: Tag },
        { label: 'Barcode Print', to: '/products/barcodes', icon: Barcode },
        { label: 'Warranties', to: '/products/warranties', icon: Award },
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
        { label: 'Stock Alerts', to: '/stock/alerts', icon: AlertTriangle },
        // Hidden while the shop has one branch (see `visibleNav`).
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
  { kind: 'item', item: { label: 'Reports', to: '/reports', icon: BarChart3 } },
  // "More & Settings" (Reports · All Expenses · Expense Categories ·
  // Data & Import · Settings) lives in the titlebar gear — see
  // components/layout/MoreMenu.tsx. Apart from Reports (above), none of those is
  // used daily, so they do not spend permanent sidebar room.
  //
  // SMS is gone entirely: it had no backend at all (gateway, credit balance and
  // send history were local placeholder state), so every number it showed was
  // invented. The pages still exist on disk if a real BD gateway is ever wired up.
];

/** Drop entries that do not apply to this shop (Transfers needs 2+ branches). */
function visibleNav(branchCount: number): Entry[] {
  if (branchCount > 1) return nav;
  return nav.map((e) =>
    e.kind === 'group'
      ? {
          kind: 'group',
          group: {
            ...e.group,
            items: e.group.items.filter((i) => !i.to.startsWith('/stock/transfers')),
          },
        }
      : e,
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useUI();
  const location = useLocation();
  const branchCount = useBranches((s) => s.items.length);
  const entries = useMemo(() => visibleNav(branchCount), [branchCount]);

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
        // `print:hidden` — the nav is app chrome and must never reach the printer.
        'shrink-0 bg-sidebar text-sidebar-foreground border-r border-border flex flex-col transition-[width] duration-200 print:hidden',
        sidebarCollapsed ? 'w-[68px]' : 'w-[248px]',
      )}
    >
      {/* No header row: the shop mark, name and branch already sit in the
          titlebar right above, so the old logo row only repeated them and
          pushed every link 48px down. The collapse control is at the bottom. */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {entries.map((entry, i) =>
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
              onExpand={() => {
                setOpenGroup(entry.group.label);
                setSidebarCollapsed(false);
              }}
            />
          ),
        )}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
          aria-label={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
          aria-expanded={!sidebarCollapsed}
          className={cn(
            'w-full h-10 flex items-center gap-2.5 rounded-md text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-hover hover:text-sidebar-foreground transition',
            sidebarCollapsed ? 'justify-center' : 'px-2.5',
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="size-[18px] shrink-0" />
          ) : (
            <>
              <ChevronLeft className="size-[18px] shrink-0" />
              <span className="truncate">Collapse menu</span>
            </>
          )}
        </button>
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
          'group relative flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-sm font-semibold transition',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-sidebar-foreground hover:bg-sidebar-hover',
        )
      }
    >
      <Icon className="size-[18px] shrink-0" />
      {!collapsed && <span className="flex-1 min-w-0 truncate">{item.label}</span>}
      {/* Badges stay compact and never steal room from a longer (Bangla) label */}
      {!collapsed && item.badge && (
        <span className="text-xs font-mono px-1 py-0.5 rounded bg-sidebar-hover shrink-0">
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
  onExpand,
}: {
  group: Group;
  collapsed: boolean;
  currentPath: string;
  isOpen: boolean;
  onToggle: () => void;
  /** Folded menu only: unfold it and open this group. */
  onExpand: () => void;
}) {
  const hasActive = group.items.some((i) => currentPath.startsWith(i.to));
  const Icon = group.icon;
  const open = isOpen;

  if (collapsed) {
    // Folded menu (POS folds it): one click on a group's icon opens the menu
    // with that group expanded, so the next page is one more click away.
    // There used to be a hover flyout here, but the menu's scroll area clipped
    // it, so it never showed and the only way out was the button at the bottom.
    return (
      <button
        type="button"
        onClick={onExpand}
        title={group.label}
        aria-label={group.label}
        className={cn(
          'w-full flex items-center justify-center h-11 rounded-md transition',
          hasActive
            ? 'text-primary bg-primary/10'
            : 'text-sidebar-foreground hover:bg-sidebar-hover',
        )}
      >
        <Icon className="size-[18px]" />
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-sm font-semibold transition',
          hasActive
            ? 'text-primary bg-primary/10'
            : 'text-sidebar-foreground hover:bg-sidebar-hover',
        )}
      >
        <Icon className="size-[18px] shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown className={cn('size-4 opacity-70 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="ml-3 pl-3 border-l border-sidebar-border mt-1 space-y-0.5">
          {group.items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition',
                  isActive
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-sidebar-foreground/90 hover:bg-sidebar-hover hover:text-sidebar-foreground',
                )
              }
            >
              <it.icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{it.label}</span>
              {it.badge && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-warning/20 text-warning">
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
