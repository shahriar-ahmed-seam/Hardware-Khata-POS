import { ReactNode, useEffect, useRef } from 'react';
import { useAuth } from '@/stores/auth';
import LoginPage from '@/pages/auth/LoginPage';
import LockScreen from '@/pages/auth/LockScreen';
import FirstRunWizard from '@/pages/auth/FirstRunWizard';

/**
 * Decides what to render based on the auth phase:
 *   first-run → wizard, logged-out → login, locked → lock screen, active → app.
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

  const timerRef = useRef<number | null>(null);

  const phase = !setupComplete
    ? 'first-run'
    : !currentUserId
      ? 'logged-out'
      : locked
        ? 'locked'
        : 'active';

  // Idle auto-lock — only while active and a positive timeout is set.
  useEffect(() => {
    if (phase !== 'active' || autoLockMinutes <= 0) return;

    const resetTimer = () => {
      touch();
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(
        () => lock(),
        autoLockMinutes * 60_000,
      );
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [phase, autoLockMinutes, lock, touch]);

  if (phase === 'first-run') return <FirstRunWizard />;
  if (phase === 'logged-out') return <LoginPage />;
  if (phase === 'locked') return <LockScreen />;
  return <>{children}</>;
}
