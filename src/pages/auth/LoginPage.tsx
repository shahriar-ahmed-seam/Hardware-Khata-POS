import { useEffect, useState } from 'react';
import { Hammer, Delete, KeyRound, User as UserIcon, ArrowRight, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { useUsers } from '@/stores/users';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

type Mode = 'pin' | 'password';

/** PIN bounds accepted by the first-run wizard and Settings → Users. */
const MIN_PIN = 4;
const MAX_PIN = 6;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function LoginPage() {
  const business = useSettings((s) => s.business);
  const allUsers = useUsers((s) => s.users);
  const usersLoading = useUsers((s) => s.loading);
  const users = allUsers.filter((u) => u.status === 'active');
  const loginWithPin = useAuth((s) => s.loginWithPin);
  const loginWithPassword = useAuth((s) => s.loginWithPassword);

  const [mode, setMode] = useState<Mode>('pin');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  /**
   * LOAD THE ACCOUNT LIST HERE.
   *
   * This screen used to render whatever happened to be in the users store, and
   * nothing hydrated that store before login — `hydrate()` was only called from
   * the first-run wizard and from pages that live BEHIND the login. So on a
   * normal launch (and on a freshly installed copy) the account list was empty,
   * no account buttons rendered, `selectedUserId` stayed '' and there was
   * literally no way to sign in. The login screen has to be self-sufficient.
   */
  useEffect(() => {
    void useUsers.getState().hydrate();
  }, []);

  /**
   * Select the first account once the list actually arrives. The initial state
   * above cannot do this: `users` is empty on the first render, and a `useState`
   * initialiser never re-runs.
   */
  useEffect(() => {
    if (selectedUserId && users.some((u) => u.id === selectedUserId)) return;
    if (users.length > 0) setSelectedUserId(users[0].id);
  }, [users, selectedUserId]);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const canSubmitPin = !!selectedUserId && pin.length >= MIN_PIN && !busy;

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setPin('');
  };

  const submitPin = () => {
    if (!canSubmitPin) return;
    setBusy(true);
    void loginWithPin(selectedUserId, pin)
      .then((r) => {
        if (!r.ok) fail(r.error ?? 'Login failed');
        else toast.success(`Welcome back, ${selectedUser?.name.split(' ')[0] ?? ''}`);
      })
      .finally(() => setBusy(false));
  };

  /**
   * NOTE: there is deliberately no "auto-submit at N digits" any more.
   *
   * It used to fire at `selectedUser?.pin?.length ?? 4`, but `users.list`
   * returns sanitized rows — the PIN is bcrypt-hashed in the database and is
   * never sent to the renderer — so that expression was ALWAYS 4. Anyone whose
   * PIN was 5 or 6 digits (the wizard accepts up to 6) got a failed login fired
   * at the 4th digit, which also cleared the field: their PIN could never be
   * entered at all. Submitting is now explicit.
   */
  const pressDigit = (d: string) => {
    if (pin.length >= MAX_PIN) return;
    setPin((p) => p + d);
    setError('');
  };

  // A shop counter has a real keyboard and a numeric keypad; typing should work
  // without hunting for the on-screen buttons.
  useEffect(() => {
    if (mode !== 'pin') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        pressDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin((p) => p.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submitPin();
      } else if (e.key === 'Escape') {
        setPin('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pin, selectedUserId, canSubmitPin]);

  const submitPassword = () => {
    void loginWithPassword(username, password).then((r) => {
      if (!r.ok) {
        setError(r.error ?? 'Login failed');
        setShake(true);
        setTimeout(() => setShake(false), 400);
      } else {
        toast.success('Signed in');
      }
    });
  };

  return (
    <div className="h-screen w-screen flex bg-background">
      {/* LEFT brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] bg-gradient-to-br from-primary via-purple-600 to-accent p-10 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-grain opacity-20" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="size-11 rounded-xl bg-white/15 backdrop-blur grid place-items-center">
            <Hammer className="size-6" />
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">{business.name}</div>
            <div className="text-white/70 text-xs">{business.tagline ?? 'Point of Sale'}</div>
          </div>
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold leading-tight">
            Run your shop,
            <br />
            even offline.
          </h1>
          <p className="text-white/70 mt-3 max-w-sm text-sm">
            Fast checkout, stock control, dues tracking, and reports — built for the Bangladeshi
            hardware trade.
          </p>
        </div>
        {/* No invented address fallback — an unset field prints nothing. */}
        <div className="relative z-10 text-white/50 text-xs">
          {business.address ? `${business.address} · ` : ''}Offline-first
        </div>
      </div>

      {/* RIGHT login panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-6">
            <div className="size-9 rounded-lg bg-gradient-to-br from-primary to-accent text-white grid place-items-center">
              <Hammer className="size-5" />
            </div>
            <div className="font-bold">{business.name}</div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Choose your account and enter your PIN.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-md w-fit mb-5">
            <button
              onClick={() => {
                setMode('pin');
                setError('');
              }}
              className={cn(
                'h-8 px-3 rounded text-sm font-medium inline-flex items-center gap-1.5 transition',
                mode === 'pin' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground',
              )}
            >
              <KeyRound className="size-3.5" /> PIN
            </button>
            <button
              onClick={() => {
                setMode('password');
                setError('');
              }}
              className={cn(
                'h-8 px-3 rounded text-sm font-medium inline-flex items-center gap-1.5 transition',
                mode === 'password' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground',
              )}
            >
              <Lock className="size-3.5" /> Password
            </button>
          </div>

          {mode === 'pin' ? (
            <>
              {/* Account chooser — with real loading and empty states, so an
                  empty list can never present a dead PIN pad again. */}
              {usersLoading && users.length === 0 ? (
                <div className="mb-5 text-sm text-muted-foreground">Loading accounts…</div>
              ) : users.length === 0 ? (
                <div className="mb-5 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  <div className="flex items-start gap-2 text-destructive">
                    <AlertCircle className="size-4 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">No accounts found on this computer</div>
                      <div className="mt-1 text-foreground/80">
                        If you set a password for your account, sign in with that. Otherwise
                        restore a backup from Settings on a working copy.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMode('password');
                      setError('');
                    }}
                    className="mt-2.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                  >
                    Use password instead
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap mb-5">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUserId(u.id);
                        setPin('');
                        setError('');
                      }}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border transition',
                        selectedUserId === u.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-secondary',
                      )}
                    >
                      <div className="size-8 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-bold">
                        {initials(u.name)}
                      </div>
                      <span className="text-sm font-medium">{u.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* PIN dots. The dot count follows what has been TYPED (min 4), not
                  the stored PIN length — the renderer never receives that. */}
              <div className={cn('flex items-center justify-center gap-3 mb-5', shake && 'animate-[wiggle_0.4s]')}>
                {Array.from({ length: Math.max(MIN_PIN, pin.length) }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'size-3.5 rounded-full border-2 transition',
                      i < pin.length ? 'bg-primary border-primary' : 'border-muted-foreground/40',
                    )}
                  />
                ))}
              </div>

              {error && (
                <div className="text-center text-sm text-destructive mb-3">{error}</div>
              )}

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <PadButton key={d} onClick={() => pressDigit(d)}>
                    {d}
                  </PadButton>
                ))}
                <PadButton onClick={() => setPin('')} subtle>
                  Clear
                </PadButton>
                <PadButton onClick={() => pressDigit('0')}>0</PadButton>
                <PadButton onClick={() => setPin((p) => p.slice(0, -1))} subtle>
                  <Delete className="size-5" />
                </PadButton>
              </div>

              {/* Explicit submit. A 5- or 6-digit PIN was impossible to enter
                  while submitting depended on guessing the PIN's length. */}
              <button
                onClick={submitPin}
                disabled={!canSubmitPin}
                className="mt-4 h-12 w-full max-w-[260px] mx-auto rounded-lg bg-primary text-primary-foreground text-base font-semibold inline-flex items-center justify-center gap-2 transition hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
              >
                {busy ? 'Signing in…' : 'Sign in'} <ArrowRight className="size-4" />
              </button>
              <div className="text-center text-xs text-muted-foreground mt-2">
                Enter your 4 to 6 digit PIN, then press Sign in.
              </div>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitPassword();
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. seam"
                    className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>
              </div>
              {error && <div className="text-sm text-destructive">{error}</div>}
              <button
                type="submit"
                className="h-10 w-full rounded-md bg-primary text-primary-foreground font-medium inline-flex items-center justify-center gap-2 hover:bg-primary/90 transition"
              >
                Sign in <ArrowRight className="size-4" />
              </button>
            </form>
          )}

          <div className="text-center mt-6">
            <button
              onClick={() => setForgotOpen((o) => !o)}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Forgot PIN / password?
            </button>
            {forgotOpen && (
              <div className="mt-3 text-left text-[12px] text-muted-foreground bg-secondary/40 rounded-md p-3 border border-border">
                Offline recovery: PINs are reset by the shop owner from{' '}
                <span className="font-semibold text-foreground">Settings → Users</span>. If you are
                the owner and locked out, restore from a backup.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PadButton({
  children,
  onClick,
  subtle,
}: {
  children: React.ReactNode;
  onClick: () => void;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-14 rounded-xl text-xl font-semibold grid place-items-center transition active:scale-95',
        subtle
          ? 'text-muted-foreground hover:bg-secondary text-sm font-medium'
          : 'bg-secondary/60 hover:bg-secondary text-foreground',
      )}
    >
      {children}
    </button>
  );
}
