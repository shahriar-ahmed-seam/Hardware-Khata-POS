import { api, hasBackend } from '@/lib/api';

/**
 * RENDERER SIDE OF THE PERFORMANCE FLAGS
 *
 * Only one of the two flags is a renderer concern: "reduce animations" is applied
 * as a class on <html> and read by one rule in globals.css. The other one
 * (graphics acceleration) is decided in the main process before a renderer even
 * exists — see electron/perf.ts.
 */

const CLASS = 'reduce-motion';

export function applyReduceAnimations(on: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle(CLASS, on);
}

/**
 * Read the saved preference on boot and apply it.
 *
 * Deliberately silent on failure: `perf.get` is permission-gated, so a cashier
 * signing in would otherwise get an error toast on every launch for a setting
 * they cannot see. Falls back to "animations on", which is the previous
 * behaviour of the app.
 */
export async function initReduceAnimations(): Promise<void> {
  if (!hasBackend()) return;
  try {
    const flags = await api<{ reduceAnimations: boolean }>('perf.get', {});
    applyReduceAnimations(flags.reduceAnimations);
  } catch {
    applyReduceAnimations(false);
  }
}
