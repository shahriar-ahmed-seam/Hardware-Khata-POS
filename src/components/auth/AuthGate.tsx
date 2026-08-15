import { ReactNode, useEffect, useRef } from 'react';
import { useAuth } from '@/stores/auth';
import LoginPage from '@/pages/auth/LoginPage';
import LockScreen from '@/pages/auth/LockScreen';
import FirstRunWizard from '@/pages/auth/FirstRunWizard';

/**
 * Decides what to render based on the auth phase:
 *   first-run -> wizard, logged-out -> login, locked -> lock screen, active -> app.
 * Also wires idle auto-lock based on settings.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  // Subscribe to the primitive fields so re-render happens on change.
  const setupComplete = useAuth((s) => s.setupComplete);
  const currentUserId = useAuth((s) => s.currentUserId);
  const locked = useAuth((s) => s.locked);
  const autoLockMinutes = useAuth((s) => s.autoLockMinutes);
  const lock = useAuth((s) => s.lock);
  const touch = useAuth((s) => s.touch);

  const lastActivityRef = useRef<number>(Date.now());

  const phase = !setupComplete
    ? 'first-run'
    : !currentUserId
      ? 'logged-out'
      : locked
        ? 'locked'
        : 'active';

  /**
   * IDLE AUTO-LOCK.
   *
   * Two things were wrong with the previous version, and the second one is what
   * the owner saw.
   *
   * 1. It called `touch()` on EVERY mousemove. That is a Zustand `set()` per
   *    mouse event, waking every subscriber of the auth store dozens of times a
   *    second on a low-end PC, purely to store a timestamp nothing rendered.
   *    Activity is tracked in a ref now, and the store is touched only when the
   *    idle check runs.
   *
   * 2. It armed ONE long `setTimeout` for the whole timeout. A single timer that
   *    has to survive 15 minutes is exactly the thing Windows and Chromium
   *    throttle or coalesce while a window sits untouched, and if the machine
   *    sleeps, the timer's remaining time does not reflect wall-clock time at
   *    all: the shop could be unattended and unlocked for far longer than the
   *    setting says. It is a 15-second poll against a real timestamp now, so the
   *    lock is judged on elapsed wall-clock time and cannot overshoot by more
   *    than one tick.
   *
   * `visibilitychange` runs the check immediately, so coming back to a window
   * that was hidden past its timeout locks at once rather than after a tick.
   */
  useEffect(() => {
    if (phase !== 'active' || autoLockMinutes <= 0) return;

    const limitMs = autoLockMinutes * 60_000;
    lastActivityRef.current = Date.now();

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };

    const check = () => {
      if (Date.now() - lastActivityRef.current < limitMs) return;
      // Record the last known activity in the store before locking, so the
      // lock screen and any audit reading it agree with what happened.
      touch();
      lock();
      forceRepaint();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll'];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    const id = window.setInterval(check, 15_000);
    document.addEventListener('visibilitychange', check);

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive));
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [phase, autoLockMinutes, lock, touch]);

  /**
   * The lock screen must actually APPEAR when it mounts.
   *
   * The reported bug: after the idle timeout the app took no clicks but showed no
   * lock screen; minimising and restoring revealed it. The lock screen HAD
   * mounted (hence the dead clicks - it covers the window); the window just never
   * painted the new frame, because the change came from a timer after minutes of
   * no input, and that is a frame Windows can drop.
   *
   * So the repaint is requested explicitly whenever the locked screen appears,
   * not left to chance. Belt and braces, in order of preference:
   *   - the main process schedules a real window repaint (webContents.invalidate)
   *   - and the renderer nudges the compositor on the next two frames, which also
   *     covers running in a plain browser where there is no main process.
   */
  useEffect(() => {
    if (phase !== 'locked') return;
    forceRepaint();
  }, [phase]);

  if (phase === 'first-run') return <FirstRunWizard />;
  if (phase === 'logged-out') return <LoginPage />;
  if (phase === 'locked') return <LockScreen />;
  return <>{children}</>;
}

/**
 * Make the window draw a fresh frame right now.
 *
 * `void`-ed and try/caught throughout: this is a display nudge, and it must never
 * be able to take the app down or block the lock from engaging.
 */
function forceRepaint(): void {
  try {
    void window.api?.window?.repaint?.();
  } catch {
    // Older preload without the channel. The DOM nudge below still runs.
  }
  // Touching a layout-affecting property forces a style recalculation and a new
  // frame even if the compositor thought nothing had changed. Reverted on the
  // following frame so nothing is left behind.
  try {
    requestAnimationFrame(() => {
      const el = document.documentElement;
      const previous = el.style.transform;
      el.style.transform = 'translateZ(0)';
      requestAnimationFrame(() => {
        el.style.transform = previous;
      });
    });
  } catch {
    // No rAF (never in Electron) - nothing more to try.
  }
}
