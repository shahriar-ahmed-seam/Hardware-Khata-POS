import { useState, useEffect } from 'react';
import { Lock, Delete, LogOut } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { useUsers } from '@/stores/users';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function LockScreen() {
  const currentUserId = useAuth((s) => s.currentUserId);
  const users = useUsers((s) => s.users);
  const user = users.find((u) => u.id === currentUserId) ?? null;
  const unlock = useAuth((s) => s.unlockWithPin);
  const logout = useAuth((s) => s.logout);
  const business = useSettings((s) => s.business);

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /**
   * PIN bounds, NOT the stored PIN's length.
   *
   * This used to be `user?.pin?.length ?? 4` and auto-unlock when the typed
   * length matched. But the PIN is bcrypt-hashed in the database and is never
   * sent to the renderer, so that value was always 4: a 5- or 6-digit PIN fired
   * a failed unlock on the 4th digit, which also cleared the field, and the user
   * could never get in. Unlocking is explicit now.
   */
  const MIN_PIN = 4;
  const MAX_PIN = 6;
  const dots = Math.max(MIN_PIN, pin.length);
  const canSubmit = pin.length >= MIN_PIN && !busy;

  const tryUnlock = () => {
    if (!canSubmit) return;
    setBusy(true);
    void unlock(pin)
      .then((r) => {
        if (!r.ok) {
          setError(r.error ?? 'Incorrect PIN');
          setShake(true);
          setTimeout(() => setShake(false), 400);
          setPin('');
        } else {
          toast.success('Unlocked');
        }
      })
      .finally(() => setBusy(false));
  };

  const press = (d: string) => {
    if (pin.length >= MAX_PIN) return;
    setPin((p) => p + d);
    setError('');
  };

  // Allow physical keyboard entry
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
      else if (e.key === 'Enter') tryUnlock();
      else if (e.key === 'Escape') setPin('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, canSubmit]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-secondary/40 relative">
      <div className="absolute top-6 left-0 right-0 text-center">
        <div className="text-4xl font-bold tabular tracking-tight">
          {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {now.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="size-20 rounded-full bg-primary/15 text-primary grid place-items-center text-2xl font-bold mb-3 relative">
          {user ? initials(user.name) : <Lock className="size-8" />}
          <div className="absolute -bottom-1 -right-1 size-7 rounded-full bg-card border border-border grid place-items-center">
            <Lock className="size-3.5 text-muted-foreground" />
          </div>
        </div>
        <div className="font-semibold text-lg">{user?.name ?? 'Locked'}</div>
        <div className="text-xs text-muted-foreground mb-5">
          {business.name} · Screen locked
        </div>

        <div className={cn('flex items-center justify-center gap-3 mb-5', shake && 'animate-[wiggle_0.4s]')}>
          {Array.from({ length: dots }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'size-3.5 rounded-full border-2 transition',
                i < pin.length ? 'bg-primary border-primary' : 'border-muted-foreground/40',
              )}
            />
          ))}
        </div>

        {error && <div className="text-center text-sm text-destructive mb-3">{error}</div>}

        <div className="grid grid-cols-3 gap-2.5 w-[260px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => press(d)}
              className="h-14 rounded-xl text-xl font-semibold grid place-items-center bg-secondary/60 hover:bg-secondary transition active:scale-95"
            >
              {d}
            </button>
          ))}
          <button
            onClick={() => {
              logout();
              toast.info('Signed out');
            }}
            className="h-14 rounded-xl grid place-items-center text-muted-foreground hover:bg-secondary transition text-xs font-medium"
            title="Sign out"
          >
            <LogOut className="size-5" />
          </button>
          <button
            onClick={() => press('0')}
            className="h-14 rounded-xl text-xl font-semibold grid place-items-center bg-secondary/60 hover:bg-secondary transition active:scale-95"
          >
            0
          </button>
          <button
            onClick={() => setPin((p) => p.slice(0, -1))}
            className="h-14 rounded-xl grid place-items-center text-muted-foreground hover:bg-secondary transition"
          >
            <Delete className="size-5" />
          </button>
        </div>

        {/* Explicit unlock — see the note on MIN_PIN above. */}
        <button
          onClick={tryUnlock}
          disabled={!canSubmit}
          className="mt-4 h-12 w-[260px] rounded-lg bg-primary text-primary-foreground text-base font-semibold transition hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>

        <div className="mt-4 text-xs text-muted-foreground">
          Enter your 4 to 6 digit PIN · or sign out to switch user
        </div>
      </div>
    </div>
  );
}
