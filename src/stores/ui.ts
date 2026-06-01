import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  density: 'compact' | 'comfortable';
  toggleSidebar: () => void;
  setDensity: (d: 'compact' | 'comfortable') => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      density: 'comfortable',
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setDensity: (density) => set({ density }),
    }),
    { name: 'pos-ui' },
  ),
);
