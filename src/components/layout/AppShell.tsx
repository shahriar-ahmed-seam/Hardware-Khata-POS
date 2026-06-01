import { ReactNode } from 'react';
import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { CommandPalette } from '@/components/layout/CommandPalette';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell flex flex-col bg-background">
      <Titlebar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-auto bg-background">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>

      {/* Command palette only inside the authenticated app */}
      <CommandPalette />
    </div>
  );
}
