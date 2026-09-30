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
  Lock,
  LogOut,
} from 'lucide-react';
import { useTheme } from '@/stores/theme';
import { useLang, useT } from '@/lib/i18n';
import { useCashRegister } from '@/stores/cashRegister';
import { useAuth } from '@/stores/auth';
import { useUsers } from '@/stores/users';
import { FONT_SCALE_STEPS, snapFontScale, useSettings } from '@/stores/settings';
import { useBranches } from '@/stores/branches';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';
import { GlobalSearch } from './GlobalSearch';
import { MoreMenu } from './MoreMenu';
import { useNavigate } from 'react-router-dom';

export function Titlebar() {
  const { mode, resolved, setMode } = useTheme();
  const { lang, setLang } = useLang();
  const { t } = useT();
  const fontScale = useSettings((s) => snapFontScale(s.appearance.fontScale));
  const setAppearance = useSettings((s) => s.setAppearance);
  const fontIdx = FONT_SCALE_STEPS.indexOf(fontScale);
  const stepFont = (dir: -1 | 1) => {
    const next = FONT_SCALE_STEPS[fontIdx + dir];
    if (next !== undefined) setAppearance({ fontScale: next });
  };
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
    <div className="titlebar-drag relative z-40 flex h-12 items-center gap-2 border-b border-border bg-card px-3 select-none [container-type:inline-size]">
      {/* Brand — the text half is hidden on narrow windows so the search box
          and the shift pill keep their room (the mark stays as an anchor).
          The fold points are CONTAINER queries in rem, not screen breakpoints:
          rem grows with the A− / A+ text size, so at 130–145% the labels fold
          earlier and the search box is never squeezed to nothing. At 100% they
          match the old md / lg screen breakpoints (48 / 64rem); the shift label
          and user name fold at 72rem (1152px at 100%, so they still show at 115%
          on a 1366px screen). */}
      <div className="titlebar-no-drag flex items-center gap-2 pr-1 lg:pr-3 shrink-0">
        <div className="grid place-items-center size-7 rounded-md bg-gradient-to-br from-primary via-purple-500 to-accent text-primary-foreground font-bold text-sm shadow-sm">
          <BrandMark />
        </div>
        {/* Shop name + the one place the branch is named. The old separate
            branch-switcher button repeated this same name and had no action
            wired to it, so it is gone. */}
        <div className="leading-tight hidden [@container_(min-width:48rem)]:block min-w-0 max-w-[220px]">
          <div className="text-sm font-semibold truncate" data-no-i18n>
            {businessName}
          </div>
          <div className="text-xs text-muted-foreground -mt-0.5 flex items-center gap-1">
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
            'flex items-center gap-1.5 px-2 lg:px-2.5 h-9 rounded-md text-sm font-semibold transition',
            shift
              ? 'bg-success/15 text-success hover:bg-success/25'
              : 'bg-secondary text-muted-foreground hover:bg-secondary/80',
          )}
        >
          <span
            className={cn(
              'size-2 rounded-full shrink-0',
              shift ? 'bg-success animate-pulse' : 'bg-muted-foreground/60',
            )}
          />
          {/* Narrow windows keep the coloured dot as the signal and drop the label */}
          <span className="hidden [@container_(min-width:72rem)]:inline whitespace-nowrap">
            {/* No shift is not a problem any more: the drawer opens itself with
                the next cash entry (backend/services/cash.ts). */}
            {shift ? `${t('titlebar.shift.open')} · #${shift.shiftNo}` : 'Drawer ready'}
          </span>
          <span className="[@container_(min-width:72rem)]:hidden whitespace-nowrap">{shift ? `#${shift.shiftNo}` : '—'}</span>
        </button>
      </div>

      <div className="titlebar-no-drag flex items-center gap-0.5 shrink-0">
        {/* Reports / Expenses / Import / Settings. Moved out of the sidebar so the
            main nav only holds what is used during a sale. */}
        <MoreMenu />

        <div className="w-px h-5 bg-border mx-1" />

        {/* Text size A− / A+ — the same four steps as Settings → Appearance.
            (The one-click density toggle that used to sit here is gone: it
            changed nothing on screen except the Appearance preview.) */}
        <div className="flex items-center" role="group" aria-label="Text size">
          <IconBtn
            onClick={() => stepFont(-1)}
            disabled={fontIdx <= 0}
            title="Smaller text"
          >
            <span className="text-sm font-bold leading-none" aria-hidden>
              A−
            </span>
          </IconBtn>
          <IconBtn
            onClick={() => stepFont(1)}
            disabled={fontIdx >= FONT_SCALE_STEPS.length - 1}
            title="Larger text"
          >
            <span className="text-base font-bold leading-none" aria-hidden>
              A+
            </span>
          </IconBtn>
        </div>

        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
          title={lang === 'en' ? 'Switch to Bangla' : 'ইংরেজিতে পরিবর্তন করুন'}
          className="flex items-center gap-1.5 px-2.5 h-9 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition"
        >
          <Languages className="size-4" />
          <span className="text-sm font-semibold">{lang === 'en' ? 'EN' : 'বাং'}</span>
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
            title={`${currentUser?.name ?? 'Guest'} · ${currentRoleName}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 pl-1 pr-2 h-9 rounded-md hover:bg-secondary"
          >
            <div className="grid place-items-center size-7 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-white">
              {currentUser ? initials(currentUser.name) : '—'}
            </div>
            {/* Name/role collapse into the avatar on narrow windows */}
            <div
              className="text-left hidden [@container_(min-width:72rem)]:block min-w-0 max-w-[120px] text-sm font-semibold truncate"
              data-no-i18n
            >
              {currentUser?.name ?? 'Guest'}
            </div>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
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
        <WinBtn label="Minimize" onClick={() => window.api?.window.minimize()}>
          <Minus className="size-3.5" />
        </WinBtn>
        <WinBtn
          label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => window.api?.window.toggleMaximize()}
        >
          {maximized ? <Copy className="size-3 rotate-180" /> : <Square className="size-3" />}
        </WinBtn>
        <WinBtn label="Close" onClick={() => window.api?.window.close()} danger>
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
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  title: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        'relative size-9 grid place-items-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition disabled:opacity-40 disabled:pointer-events-none',
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
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'h-12 w-11 grid place-items-center text-muted-foreground hover:text-foreground transition',
        danger ? 'hover:bg-destructive hover:text-destructive-foreground' : 'hover:bg-secondary',
      )}
    >
      {children}
    </button>
  );
}
