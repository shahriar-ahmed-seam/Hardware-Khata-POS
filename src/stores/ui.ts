import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  density: 'compact' | 'comfortable';
  toggleSidebar: () => void;
  /** Explicit set — used by the responsive auto-collapse in AppShell. */
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDensity: (d: 'compact' | 'comfortable') => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      density: 'comfortable',
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setDensity: (density) => set({ density }),
    }),
    {
      name: 'pos-ui',
      // The collapsed state is derived from window width on every boot, so
      // persisting it would fight the responsive rule.
      partialize: (s) => ({ density: s.density }),
    },
  ),
);
