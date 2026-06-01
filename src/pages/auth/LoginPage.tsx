import { useState } from 'react';
import { Hammer, Delete, KeyRound, User as UserIcon, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { useUsers } from '@/stores/users';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

type Mode = 'pin' | 'password';

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
  const users = useUsers((s) => s.users).filter((u) => u.status === 'active');
  const loginWithPin = useAuth((s) => s.loginWithPin);
  const loginWithPassword = useAuth((s) => s.loginWithPassword);

  const [mode, setMode] = useState<Mode>('pin');
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id ?? '');
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setPin('');
  };

  const submitPin = (value: string) => {
    void loginWithPin(selectedUserId, value).then((r) => {
      if (!r.ok) fail(r.error ?? 'Login failed');
      else toast.success(`Welcome back, ${selectedUser?.name.split(' ')[0] ?? ''}`);
    });
  };

  const pressDigit = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === (selectedUser?.pin?.length ?? 4)) {
      // auto-submit when reaching the expected length
      setTimeout(() => submitPin(next), 120);
    }
  };

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
        <div className="relative z-10 text-white/50 text-xs">
          {business.address ?? 'Mirpur, Dhaka'} · Offline-first
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
              {/* User chooser */}
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
                      'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition',
                      selectedUserId === u.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-secondary',
                    )}
                  >
                    <div className="size-7 rounded-full bg-primary/15 text-primary grid place-items-center text-[11px] font-bold">
                      {initials(u.name)}
                    </div>
                    <span className="text-sm font-medium">{u.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              {/* PIN dots */}
              <div className={cn('flex items-center justify-center gap-3 mb-5', shake && 'animate-[wiggle_0.4s]')}>
                {Array.from({ length: selectedUser?.pin?.length ?? 4 }).map((_, i) => (
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

              <div className="text-center mt-4 text-[11px] text-muted-foreground">
                Demo PINs: Seam <span className="font-mono">1234</span> · Rana{' '}
                <span className="font-mono">1111</span>
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
              <div className="text-center text-[11px] text-muted-foreground">
                Demo: username <span className="font-mono">seam</span> · password{' '}
                <span className="font-mono">admin123</span>
              </div>
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
                <span className="font-semibold text-foreground">Settings → Users</span>. If you're
                the owner and locked out, restore from a backup or contact support with your license
                key. (Backend will add a secure offline reset code.)
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
