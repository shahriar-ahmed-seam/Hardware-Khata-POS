import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Mode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: Mode;
  resolved: 'light' | 'dark';
  setMode: (m: Mode) => void;
  init: () => void;
}

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyClass(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolved === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      resolved: systemPrefersDark() ? 'dark' : 'light',
      setMode: (mode) => {
        const resolved: 'light' | 'dark' =
          mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;
        applyClass(resolved);
        window.api?.theme.set(mode);
        set({ mode, resolved });
      },
      init: () => {
        const { mode } = get();
        const resolved: 'light' | 'dark' =
          mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;
        applyClass(resolved);
        set({ resolved });

        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
          if (get().mode === 'system') {
            const r: 'light' | 'dark' = mq.matches ? 'dark' : 'light';
            applyClass(r);
            set({ resolved: r });
          }
        };
        mq.addEventListener('change', handler);
      },
    }),
    { name: 'pos-theme' },
  ),
);
