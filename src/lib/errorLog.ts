import { api, hasBackend } from '@/lib/api';

/**
 * Send a screen error to the app's log file (electron/log.ts). The installed
 * app has no console, so an error at the counter used to leave nothing to read
 * afterwards. Never throws and never waits: logging must not break a screen.
 */
export function logScreenError(where: string, error: unknown): void {
  if (!hasBackend()) return;
  const e = error instanceof Error ? error : new Error(String(error));
  void api('app.logError', { where, message: `${e.name}: ${e.message}`, stack: e.stack ?? '' }).catch(
    () => {},
  );
}

let installed = false;

/** Errors nothing else caught: a thrown handler, a rejected promise nobody awaited. */
export function installScreenErrorLog(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (ev) => {
    logScreenError(`window ${ev.filename ?? ''}:${ev.lineno ?? ''}`, ev.error ?? ev.message);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    logScreenError('unhandled promise', ev.reason);
  });
}
