import { ReactNode, useEffect } from 'react';
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

  // Auto-collapse when the window gets narrow, and restore when it grows again.
  // Only reacts to the breakpoint crossing, so a manual toggle is preserved
  // while the width stays in the same band.
  useEffect(() => {
    setCollapsed(belowLg);
  }, [belowLg, setCollapsed]);

  const overlay = belowMd && !collapsed;

  return (
    <div className="app-shell flex flex-col bg-background">
      <Titlebar />
      <div className="relative flex flex-1 min-h-0">
        {/* Below md the sidebar floats above the content instead of squeezing it */}
        <div className={cn(overlay && 'absolute inset-y-0 left-0 z-40 shadow-2xl')}>
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
