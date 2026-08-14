import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Minus,
  Square,
  Copy,
  X,
  Sun,
  Moon,
  ChevronDown,
  Store,
  Languages,
  Rows2,
  Rows3,
  Lock,
  LogOut,
} from 'lucide-react';
import { useTheme } from '@/stores/theme';
import { useLang, useT } from '@/lib/i18n';
import { useCashRegister } from '@/stores/cashRegister';
import { useUI } from '@/stores/ui';
import { useAuth } from '@/stores/auth';
import { useUsers } from '@/stores/users';
import { useSettings } from '@/stores/settings';
import { useBranches } from '@/stores/branches';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';
import { GlobalSearch } from './GlobalSearch';
import { useNavigate } from 'react-router-dom';

export function Titlebar() {
  const { mode, resolved, setMode } = useTheme();
  const { lang, setLang } = useLang();
  const { t } = useT();
  const density = useUI((s) => s.density);
  const setDensity = useUI((s) => s.setDensity);
  const [maximized, setMaximized] = useState(false);
  // Real business identity + branch from the settings/branches stores.
  const business = useSettings((s) => s.business);
  const branches = useBranches((s) => s.items);
  // Prefer the explicitly-default branch, then the first active one, then any.
  const activeBranch =
    branches.find((b) => b.isDefault) ?? branches.find((b) => b.active) ?? branches[0];
  const branchName = activeBranch?.name ?? business.defaultBranch ?? 'Main Branch';
  const businessName = business.name?.trim() || 'Hardware POS';
  const shift = useCashRegister((s) => s.getCurrentShift(branchName));
  const nav = useNavigate();
  const currentUserId = useAuth((s) => s.currentUserId);
  const lock = useAuth((s) => s.lock);
  const logout = useAuth((s) => s.logout);
  const users = useUsers((s) => s.users);
  const roles = useUsers((s) => s.roles);
  const currentUser = users.find((u) => u.id === currentUserId) ?? null;
  const currentRoleName = roles.find((r) => r.id === currentUser?.roleId)?.name ?? 'User';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  // Viewport coords for the portalled account menu (see the portal comment below).
  const [menuRect, setMenuRect] = useState({ top: 48, right: 8 });

  // Close the account menu on Escape or when the window is resized, so it can
  // never linger detached from its (re-measured) trigger.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onResize = () => setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [menuOpen]);

  useEffect(() => {
    window.api?.window.isMaximized().then(setMaximized);
    const off = window.api?.window.onMaximizeChange(setMaximized);
    return () => off?.();
  }, []);

  // Hydrate the cash store on mount so the shift pill reflects the DB.
  // Cheap no-op without a backend (running outside Electron).
  useEffect(() => {
    void useCashRegister.getState().hydrate();
  }, []);

  // Hydrate settings + branches on mount so the brand/branch reflect the DB.
  // Cheap no-op without a backend (mirrors the cash hydrate effect above).
  useEffect(() => {
    void useSettings.getState().hydrate();
    void useBranches.getState().hydrate();
  }, []);

  // Simple light/dark switch in titlebar; "system" preference lives in Settings.
  const toggleTheme = () => {
    setMode(resolved === 'dark' ? 'light' : 'dark');
  };

  return (
    // `relative z-40` keeps the bar itself above the sidebar/content that follow
    // it in the DOM; the account menu is still portalled (see below).
    //
    // NO `backdrop-blur` HERE ANY MORE — it was `bg-card/80 backdrop-blur`.
    // A `backdrop-filter` on an element that is on screen 100% of the time forces
    // Chromium to keep compositing everything underneath it on the GPU, every
    // frame, forever. On the shop's low-end Windows 7 machine (old Intel
    // integrated graphics) that is a permanent tax for an effect nobody asked
    // for. The bar is now simply opaque, which also means the titlebar no longer
    // creates a backdrop-filter stacking context.
    <div className="titlebar-drag relative z-40 flex h-12 items-center gap-2 border-b border-border bg-card px-3 select-none">
      {/* Brand — the text half is hidden on narrow windows so the search box
          and the shift pill keep their room (the mark stays as an anchor). */}
      <div className="titlebar-no-drag flex items-center gap-2 pr-1 lg:pr-3 shrink-0">
        <div className="grid place-items-center size-7 rounded-md bg-gradient-to-br from-primary via-purple-500 to-accent text-primary-foreground font-bold text-sm shadow-sm">
          <BrandMark />
        </div>
        {/* Shop name + the one place the branch is named. The old separate
            branch-switcher button repeated this same name and had no action
            wired to it, so it is gone. */}
        <div className="leading-tight hidden md:block min-w-0 max-w-[220px]">
          <div className="text-sm font-semibold truncate" data-no-i18n>
            {businessName}
          </div>
          <div className="text-[11px] text-muted-foreground -mt-0.5 flex items-center gap-1">
            <Store className="size-3 shrink-0" />
            <span className="truncate" data-no-i18n>
              {branchName}
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <GlobalSearch />

      {/* Shift state — the only live status indicator. The old "Synced · 2m"
          pill was hard-coded (there is no sync layer yet), so it was removed
          rather than left showing a number nobody can trust. */}
      <div className="titlebar-no-drag flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => nav('/cash-register')}
          title="Open Cash Register"
          className={cn(
            'flex items-center gap-1.5 px-2 lg:px-2.5 py-1.5 rounded-md text-xs font-semibold transition',
            shift
              ? 'bg-success/15 text-success hover:bg-success/25'
              : 'bg-warning/15 text-warning hover:bg-warning/25',
          )}
        >
          <span
            className={cn(
              'size-2 rounded-full shrink-0',
              shift ? 'bg-success animate-pulse' : 'bg-warning',
            )}
          />
          {/* Narrow windows keep the coloured dot as the signal and drop the label */}
          <span className="hidden xl:inline whitespace-nowrap">
            {shift ? `${t('titlebar.shift.open')} · #${shift.shiftNo}` : 'No active shift'}
          </span>
          <span className="xl:hidden whitespace-nowrap">{shift ? `#${shift.shiftNo}` : '—'}</span>
        </button>
      </div>

      <div className="titlebar-no-drag flex items-center gap-0.5 shrink-0">
        {/* Density toggle — least essential control, so it is the first to go */}
        <IconBtn
          className="hidden lg:grid"
          onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
          title={density === 'compact' ? 'Comfortable density' : 'Compact density'}
        >
          {density === 'compact' ? <Rows2 className="size-4" /> : <Rows3 className="size-4" />}
        </IconBtn>

        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
          title={lang === 'en' ? 'Switch to Bangla' : 'ইংরেজিতে পরিবর্তন করুন'}
          className="flex items-center gap-1 px-2 h-8 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition"
        >
          <Languages className="size-3.5" />
          <span className="text-[11px] font-semibold">{lang === 'en' ? 'EN' : 'বাং'}</span>
        </button>

        {/* Theme toggle (light/dark only — system lives in Settings) */}
        <IconBtn onClick={toggleTheme} title={resolved === 'dark' ? 'Light mode' : 'Dark mode'}>
          {resolved === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </IconBtn>

        <div className="w-px h-5 bg-border mx-1" />

        <div className="relative">
          <button
            ref={menuBtnRef}
            onClick={() => {
              // Measure the trigger so the portalled menu can anchor to it.
              const r = menuBtnRef.current?.getBoundingClientRect();
              if (r) setMenuRect({ top: r.bottom + 4, right: window.innerWidth - r.right });
              setMenuOpen((o) => !o);
            }}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-secondary"
          >
            <div className="grid place-items-center size-7 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent text-[10px] font-bold text-white">
              {currentUser ? initials(currentUser.name) : '—'}
            </div>
            {/* Name/role collapse into the avatar on narrow windows */}
            <div className="leading-tight text-left hidden xl:block min-w-0 max-w-[120px]">
              <div className="text-[11px] font-semibold truncate" data-no-i18n>
                {currentUser?.name ?? 'Guest'}
              </div>
              <div className="text-[9px] text-muted-foreground -mt-0.5 truncate">
                {currentRoleName}
              </div>
            </div>
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          </button>

          {menuOpen && (
            /**
             * PORTALLED ON PURPOSE.
             *
             * The titlebar uses `backdrop-blur`, and any element with a
             * backdrop-filter creates its own stacking context. An absolutely
             * positioned menu inside it is therefore TRAPPED behind the sidebar
             * and page content below (they are later siblings), which is why the
             * menu appeared underneath other UI and its items could not be
             * clicked. Rendering into document.body with fixed coordinates takes
             * it out of that stacking context entirely.
             *
             * `titlebar-no-drag` is required too: without it the menu sits over
             * the OS drag region and swallows clicks as window drags.
             */
            createPortal(
              // `print:hidden` — this menu is portalled to <body>, i.e. outside
              // the #root that print hides, so it needs marking explicitly.
              <div className="titlebar-no-drag print:hidden">
                <div
                  className="fixed inset-0 z-[90]"
                  onMouseDown={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  style={{ position: 'fixed', top: menuRect.top, right: menuRect.right }}
                  className="z-[100] w-52 bg-popover text-popover-foreground border border-border rounded-md shadow-2xl py-1 animate-scale-in"
                >
                  <MenuItem
                    icon={Store}
                    onClick={() => {
                      setMenuOpen(false);
                      nav('/settings/users');
                    }}
                  >
                    Manage users
                  </MenuItem>
                  <MenuItem
                    icon={Lock}
                    onClick={() => {
                      setMenuOpen(false);
                      lock();
                    }}
                  >
                    Lock screen
                  </MenuItem>
                  <MenuItem
                    icon={LogOut}
                    danger
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                      toast.info('Signed out');
                    }}
                  >
                    Sign out
                  </MenuItem>
                </div>
              </div>,
              document.body,
            )
          )}
        </div>
      </div>

      {/* Window controls */}
      <div className="titlebar-no-drag flex items-center -mr-3">
        <WinBtn onClick={() => window.api?.window.minimize()}>
          <Minus className="size-3.5" />
        </WinBtn>
        <WinBtn onClick={() => window.api?.window.toggleMaximize()}>
          {maximized ? <Copy className="size-3 rotate-180" /> : <Square className="size-3" />}
        </WinBtn>
        <WinBtn onClick={() => window.api?.window.close()} danger>
          <X className="size-3.5" />
        </WinBtn>
      </div>
    </div>
  );
}

/** One row of the account menu. Generous height — this is a touch target. */
function MenuItem({
  icon: Icon,
  children,
  onClick,
  danger,
}: {
  icon: any;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition',
        danger ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-secondary',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {children}
    </button>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function BrandMark() {
  // Simplified hammer mark inline so titlebar logo always renders without an asset.
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 14.5 6 23l-3-3 8.5-8.5" />
      <path d="m13 13 6-6" />
      <path d="m16 4 4 4-4 4-4-4z" />
    </svg>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'relative size-8 grid place-items-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition',
        className,
      )}
    >
      {children}
    </button>
  );
}

function WinBtn({
  children,
  onClick,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-12 w-11 grid place-items-center text-muted-foreground hover:text-foreground transition',
        danger ? 'hover:bg-destructive hover:text-destructive-foreground' : 'hover:bg-secondary',
      )}
    >
      {children}
    </button>
  );
}
