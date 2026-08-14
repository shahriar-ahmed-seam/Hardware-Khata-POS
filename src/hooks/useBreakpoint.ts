import { useEffect, useState } from 'react';

/**
 * Window-width breakpoints for the desktop shell.
 *
 * The app runs in a resizable Electron window, and shop machines are often
 * 1366×768 laptops or a small counter monitor. These match the Tailwind scale
 * so class-based rules and JS-driven layout decisions agree.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/** Subscribe to a media query. SSR-safe and listener-cleaned. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True when the viewport is NARROWER than the given breakpoint. */
export function useBelow(bp: Breakpoint): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS[bp] - 1}px)`);
}

/** True when the viewport is AT LEAST the given breakpoint. */
export function useAtLeast(bp: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[bp]}px)`);
}
