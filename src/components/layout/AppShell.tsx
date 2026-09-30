import { ReactNode, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useUI } from '@/stores/ui';
import { useBelow } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';

/**
 * The Ctrl+Shift+P command palette was removed here: its only job was
 * "Go to <page>", which is exactly what the always-visible sidebar does, and a
 * hidden keyboard-only overlay is not something this shop's owner will use.
 * Data lookup still lives in the titlebar search (Ctrl+K).
 *
 * RESPONSIVE BEHAVIOUR
 * The window is resizable and shop machines are often 1366×768. Below `lg` the
 * sidebar auto-collapses to icons so the content keeps its width; below `md` it
 * becomes an overlay drawer (with a scrim) so narrow windows are still usable.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const setCollapsed = useUI((s) => s.setSidebarCollapsed);
  const belowLg = useBelow('lg');
  const belowMd = useBelow('md');
  const { pathname } = useLocation();
  const onPos = pathname === '/pos' || pathname.startsWith('/pos/');
  const onPosRef = useRef(onPos);
  onPosRef.current = onPos;
  // The menu state to go back to when leaving POS (null = not on POS).
  const beforePos = useRef<boolean | null>(null);

  // Auto-collapse when the window gets narrow, and restore when it grows again.
  // Only reacts to the breakpoint crossing, so a manual toggle is preserved
  // while the width stays in the same band. On POS the crossing only changes
  // what is restored on the way out.
  useEffect(() => {
    if (onPosRef.current) {
      beforePos.current = belowLg;
      return;
    }
    setCollapsed(belowLg);
  }, [belowLg, setCollapsed]);

  // POS gets the sidebar's width (+180px for the cart and product grid): the
  // menu folds to icons on the way in and comes back as it was on the way out.
  // A manual toggle while on POS still works.
  useEffect(() => {
    const ui = useUI.getState();
    if (onPos) {
      if (beforePos.current === null) beforePos.current = ui.sidebarCollapsed;
      ui.setSidebarCollapsed(true);
    } else if (beforePos.current !== null) {
      ui.setSidebarCollapsed(beforePos.current);
      beforePos.current = null;
    }
  }, [onPos]);

  const overlay = belowMd && !collapsed;

  return (
    <div className="app-shell flex flex-col bg-background">
      <Titlebar />
      <div className="relative flex flex-1 min-h-0">
        {/* Below md the sidebar floats above the content instead of squeezing it.
            `flex` so the sidebar stretches to the full height: in a plain block
            it was only as tall as its links, leaving a bare strip under them,
            and a menu taller than the window could not scroll. */}
        <div className={cn('flex min-h-0', overlay && 'absolute inset-y-0 left-0 z-40 shadow-2xl')}>
          <Sidebar />
        </div>

        {overlay && (
          <button
            aria-label="Close menu"
            onClick={() => setCollapsed(true)}
            className="absolute inset-0 z-30 bg-black/40 animate-fade-in print:hidden"
          />
        )}

        <main className="flex-1 min-w-0 overflow-auto bg-background">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
