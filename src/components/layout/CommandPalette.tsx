import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Command as CommandIcon,
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Boxes,
  Users,
  Wallet,
  TrendingUp,
  MessageSquare,
  Settings as SettingsIcon,
  Plus,
  Sun,
  Moon,
  Rows3,
  Rows2,
  Printer,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { useTheme } from '@/stores/theme';
import { useUI } from '@/stores/ui';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigate' | 'Create' | 'Preferences' | 'Quick';
  icon: any;
  keywords?: string;
  run: (ctx: CommandContext) => void;
}

interface CommandContext {
  navigate: (to: string) => void;
  toggleTheme: () => void;
  setDensity: (d: 'compact' | 'comfortable') => void;
  density: 'compact' | 'comfortable';
}

const ACTIONS: CommandAction[] = [
  // Navigate
  { id: 'nav-dashboard', label: 'Go to Dashboard', group: 'Navigate', icon: LayoutDashboard, run: (c) => c.navigate('/dashboard') },
  { id: 'nav-pos', label: 'Go to POS', group: 'Navigate', icon: ShoppingCart, keywords: 'checkout sell', run: (c) => c.navigate('/pos') },
  { id: 'nav-sales', label: 'Go to Sales', group: 'Navigate', icon: Receipt, run: (c) => c.navigate('/sales') },
  { id: 'nav-purchases', label: 'Go to Purchases', group: 'Navigate', icon: ShoppingCart, run: (c) => c.navigate('/purchases') },
  { id: 'nav-products', label: 'Go to Products', group: 'Navigate', icon: Package, run: (c) => c.navigate('/products') },
  { id: 'nav-stock', label: 'Go to Stock', group: 'Navigate', icon: Boxes, run: (c) => c.navigate('/stock') },
  { id: 'nav-contacts', label: 'Go to Customers', group: 'Navigate', icon: Users, run: (c) => c.navigate('/contacts/customers') },
  { id: 'nav-suppliers', label: 'Go to Suppliers', group: 'Navigate', icon: Users, run: (c) => c.navigate('/contacts/suppliers') },
  { id: 'nav-cash', label: 'Go to Cash Register', group: 'Navigate', icon: Wallet, run: (c) => c.navigate('/cash-register') },
  { id: 'nav-expenses', label: 'Go to Expenses', group: 'Navigate', icon: Wallet, run: (c) => c.navigate('/expenses') },
  { id: 'nav-reports', label: 'Go to Reports', group: 'Navigate', icon: TrendingUp, run: (c) => c.navigate('/reports') },
  { id: 'nav-sms', label: 'Go to SMS', group: 'Navigate', icon: MessageSquare, run: (c) => c.navigate('/sms') },
  { id: 'nav-settings', label: 'Go to Settings', group: 'Navigate', icon: SettingsIcon, run: (c) => c.navigate('/settings') },
  // Quick jumps
  { id: 'nav-stock-alerts', label: 'Open Stock Alerts', group: 'Quick', icon: AlertTriangle, keywords: 'low out reorder', run: (c) => c.navigate('/stock/alerts') },
  { id: 'nav-dues', label: 'Open Customer Dues', group: 'Quick', icon: Wallet, keywords: 'receivable outstanding', run: (c) => c.navigate('/contacts/dues') },
  { id: 'nav-profit', label: 'Open Profit / Loss report', group: 'Quick', icon: TrendingUp, run: (c) => c.navigate('/reports/profit-loss') },
  { id: 'nav-activity', label: 'Open Activity Log', group: 'Quick', icon: FileText, run: (c) => c.navigate('/reports/activity-log') },
  // Create
  { id: 'new-sale', label: 'New Sale', group: 'Create', icon: Plus, keywords: 'add invoice', run: (c) => c.navigate('/sales/new') },
  { id: 'new-purchase', label: 'New Purchase', group: 'Create', icon: Plus, run: (c) => c.navigate('/purchases/new') },
  { id: 'new-product', label: 'New Product', group: 'Create', icon: Plus, run: (c) => c.navigate('/products/new') },
  { id: 'new-transfer', label: 'New Stock Transfer', group: 'Create', icon: Plus, run: (c) => c.navigate('/stock/transfers/new') },
  { id: 'new-adjustment', label: 'New Stock Adjustment', group: 'Create', icon: Plus, run: (c) => c.navigate('/stock/adjustments/new') },
  { id: 'new-sms', label: 'Send SMS', group: 'Create', icon: MessageSquare, run: (c) => c.navigate('/sms/send') },
  // Preferences
  {
    id: 'pref-theme',
    label: 'Toggle dark / light mode',
    group: 'Preferences',
    icon: Sun,
    keywords: 'theme appearance',
    run: (c) => {
      c.toggleTheme();
      toast.info('Theme toggled');
    },
  },
  {
    id: 'pref-density',
    label: 'Toggle compact / comfortable density',
    group: 'Preferences',
    icon: Rows3,
    keywords: 'spacing rows',
    run: (c) => {
      const next = c.density === 'compact' ? 'comfortable' : 'compact';
      c.setDensity(next);
      toast.info(`Density: ${next}`);
    },
  },
  { id: 'pref-appearance', label: 'Open Appearance settings', group: 'Preferences', icon: Moon, run: (c) => c.navigate('/settings/appearance') },
  { id: 'pref-printers', label: 'Open Printer settings', group: 'Preferences', icon: Printer, run: (c) => c.navigate('/settings/printers') },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const { resolved, setMode } = useTheme();
  const density = useUI((s) => s.density);
  const setDensity = useUI((s) => s.setDensity);

  const ctx: CommandContext = useMemo(
    () => ({
      navigate,
      toggleTheme: () => setMode(resolved === 'dark' ? 'light' : 'dark'),
      setDensity,
      density,
    }),
    [navigate, setMode, resolved, setDensity, density],
  );

  // Open with Ctrl+Shift+P; also support Cmd+Shift+P
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ACTIONS;
    return ACTIONS.filter((a) =>
      `${a.label} ${a.group} ${a.keywords ?? ''}`.toLowerCase().includes(q),
    );
  }, [query]);

  // Group results preserving order
  const grouped = useMemo(() => {
    const map = new Map<string, CommandAction[]>();
    filtered.forEach((a) => {
      if (!map.has(a.group)) map.set(a.group, []);
      map.get(a.group)!.push(a);
    });
    // Flatten to a list with index markers for keyboard nav
    const flat: CommandAction[] = [];
    map.forEach((items) => items.forEach((i) => flat.push(i)));
    return { groups: Array.from(map.entries()), flat };
  }, [filtered]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const run = (a: CommandAction) => {
    setOpen(false);
    a.run(ctx);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(grouped.flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const a = grouped.flat[activeIndex];
      if (a) run(a);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-cmd-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  let runningIndex = -1;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-[12vh] px-4 animate-fade-in">
      <button className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-label="Close" />
      <div className="relative w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command or search…"
            className="flex-1 h-12 bg-transparent outline-none text-sm"
          />
          <kbd className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-auto py-2">
          {grouped.flat.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No commands match "{query}"
            </div>
          )}
          {grouped.groups.map(([group, items]) => (
            <div key={group} className="mb-1">
              <div className="px-4 py-1 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                {group}
              </div>
              {items.map((a) => {
                runningIndex += 1;
                const idx = runningIndex;
                const active = idx === activeIndex;
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    data-cmd-index={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => run(a)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-left transition',
                      active ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/40',
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="flex-1 text-sm">{a.label}</span>
                    {active && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-border bg-secondary/30 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="size-3" />
            <ArrowDown className="size-3" /> navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="size-3" /> select
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <CommandIcon className="size-3" /> Ctrl+Shift+P
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
