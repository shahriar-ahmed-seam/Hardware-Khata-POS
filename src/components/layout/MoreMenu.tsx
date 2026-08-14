import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Settings as Gear, TrendingUp, Wallet, ListTree, Upload, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * THE "MORE & SETTINGS" MENU, IN THE TOP BAR.
 *
 * These five destinations used to be an accordion group at the bottom of the
 * sidebar. They are the low-frequency ones — nobody opens Expense Categories
 * mid-sale — so they were taking up permanent room in the main nav and pushing
 * the everyday items (POS, Sales, Products) further from the top.
 *
 * Now they live behind one gear in the titlebar and open as BOXES: big targets
 * with an icon, a name and a line saying what the screen is for. That reads far
 * better for the shop owner than a list of bare words, and it matches the tile
 * grid the Settings screen itself already uses, so the pattern is familiar.
 *
 * PORTALLED TO <body>, like the account menu next to it. The titlebar is a
 * `-webkit-app-region: drag` surface with its own stacking context; a panel
 * rendered inside it would be trapped behind the sidebar and page content, and
 * clicks on it would be swallowed as window drags. `titlebar-no-drag` on the
 * portal root is what makes the tiles clickable at all.
 */

interface Tile {
  label: string;
  desc: string;
  to: string;
  icon: typeof Gear;
}

const TILES: Tile[] = [
  { label: 'Reports', desc: 'Sales, stock, profit and tax', to: '/reports', icon: TrendingUp },
  { label: 'All Expenses', desc: 'What the shop has spent', to: '/expenses', icon: Wallet },
  {
    label: 'Expense Categories',
    desc: 'Group your spending',
    to: '/expenses/categories',
    icon: ListTree,
  },
  { label: 'Data & Import', desc: 'Bring in lists from Excel', to: '/import', icon: Upload },
  { label: 'Settings', desc: 'Shop, users, printers, backup', to: '/settings', icon: Settings },
];

export function MoreMenu() {
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState({ top: 48, right: 8 });

  // Highlight the gear while one of its screens is on show, so the owner can see
  // where they are — the sidebar used to do this for the group.
  const active = TILES.some((t) => location.pathname.startsWith(t.to));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // Re-measuring on resize is not worth it; close instead so the panel can
    // never sit detached from the gear.
    const onResize = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const go = (to: string) => {
    setOpen(false);
    nav(to);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => {
          const r = btnRef.current?.getBoundingClientRect();
          if (r) setRect({ top: r.bottom + 4, right: window.innerWidth - r.right });
          setOpen((o) => !o);
        }}
        title="More & Settings"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1.5 px-2 h-8 rounded-md transition',
          active || open
            ? 'bg-primary/15 text-primary'
            : 'hover:bg-secondary text-muted-foreground hover:text-foreground',
        )}
      >
        <Gear className="size-4 shrink-0" />
        <span className="hidden lg:inline text-[11px] font-semibold whitespace-nowrap">
          More &amp; Settings
        </span>
      </button>

      {open &&
        createPortal(
          <div className="titlebar-no-drag print:hidden" data-overlay="true">
            {/* Click-away. `mousedown` rather than `click` so the panel closes
                before the underlying control reacts. */}
            <div className="fixed inset-0 z-[90]" onMouseDown={() => setOpen(false)} />
            <div
              role="menu"
              style={{ position: 'fixed', top: rect.top, right: rect.right }}
              className="z-[100] w-[min(30rem,calc(100vw-1rem))] bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl p-3 animate-scale-in"
            >
              <div className="px-1 pb-2 text-[11px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                More &amp; Settings
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TILES.map((t) => {
                  const Icon = t.icon;
                  const isHere = location.pathname.startsWith(t.to);
                  return (
                    <button
                      key={t.to}
                      role="menuitem"
                      onClick={() => go(t.to)}
                      className={cn(
                        'flex items-start gap-2.5 rounded-lg border p-3 text-left transition',
                        isHere
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary hover:bg-secondary/50',
                      )}
                    >
                      <div
                        className={cn(
                          'size-9 rounded-md grid place-items-center shrink-0',
                          isHere ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        <Icon className="size-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold leading-tight">{t.label}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          {t.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
