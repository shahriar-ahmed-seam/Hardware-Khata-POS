import { useEffect, useState, type ReactNode } from 'react';
import {
  Minus,
  Square,
  Copy,
  X,
  Wifi,
  CloudOff,
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
  const [online] = useState(true);
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
    <div className="titlebar-drag flex h-12 items-center gap-2 border-b border-border bg-card/80 backdrop-blur px-3 select-none">
      {/* Brand */}
      <div className="titlebar-no-drag flex items-center gap-2 pr-3">
        <div className="grid place-items-center size-7 rounded-md bg-gradient-to-br from-primary via-purple-500 to-accent text-primary-foreground font-bold text-sm shadow-sm">
          <BrandMark />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">{businessName}</div>
          <div className="text-[10px] text-muted-foreground -mt-0.5">
            {lang === 'bn' ? `অফলাইন · ${branchName}` : `Offline · ${branchName}`}
          </div>
        </div>
      </div>

      {/* Branch switcher */}
      <button className="titlebar-no-drag flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-secondary text-xs font-medium">
        <Store className="size-3.5" />
        {branchName}
        <ChevronDown className="size-3" />
      </button>

      {/* Search */}
      <GlobalSearch />

      {/* Status pills */}
      <div className="titlebar-no-drag flex items-center gap-1.5">
        <button
          onClick={() => nav('/cash-register')}
          title="Open Cash Register"
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition',
            shift
              ? 'bg-success/10 text-success hover:bg-success/15'
              : 'bg-warning/10 text-warning hover:bg-warning/15',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              shift ? 'bg-success animate-pulse' : 'bg-warning',
            )}
          />
          {shift
            ? `${t('titlebar.shift.open')} · #${shift.shiftNo}`
            : 'No active shift'}
        </button>
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium',
            online ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning',
          )}
        >
          {online ? <Wifi className="size-3" /> : <CloudOff className="size-3" />}
          {online ? `${t('titlebar.synced')} · 2m` : t('titlebar.offline')}
        </div>
      </div>

      <div className="titlebar-no-drag flex items-center gap-0.5">
        {/* Density toggle */}
        <IconBtn
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
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-secondary"
          >
            <div className="grid place-items-center size-6 rounded-full bg-gradient-to-br from-primary to-accent text-[10px] font-bold text-white">
              {currentUser ? initials(currentUser.name) : 'SM'}
            </div>
            <div className="leading-tight text-left">
              <div className="text-[11px] font-semibold">{currentUser?.name ?? 'Guest'}</div>
              <div className="text-[9px] text-muted-foreground -mt-0.5">
                {currentRoleName}
              </div>
            </div>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-40 w-44 bg-card border border-border rounded-md shadow-lg py-1 animate-scale-in">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    nav('/settings/users');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-left"
                >
                  <Store className="size-3.5" /> Manage users
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    lock();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-left"
                >
                  <Lock className="size-3.5" /> Lock screen
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    toast.info('Signed out');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-destructive/10 hover:text-destructive text-left"
                >
                  <LogOut className="size-3.5" /> Sign out
                </button>
              </div>
            </>
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
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="relative size-8 grid place-items-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition"
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
