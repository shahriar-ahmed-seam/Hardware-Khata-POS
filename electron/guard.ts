/**
 * ============================================================================
 *  THE IPC GATE'S DECISIONS, AS PURE FUNCTIONS
 * ============================================================================
 *
 * `electron/ipc.ts` is the only place permissions are enforced, but it imports
 * Electron, so the Node verify harness cannot load it. Every DECISION the gate
 * makes therefore lives here instead — no Electron, no database, no clock — and
 * `backend/verify/security.ts` asserts them directly. `ipc.ts` only wires these
 * into `ipcMain`.
 *
 * Three holes this module exists to keep closed:
 *
 *  1. `auth.*` used to skip the gate entirely, and `auth.setSecret` is a WRITE:
 *     with nobody signed in, the renderer could set the owner's PIN and then log
 *     in as the owner. The `auth.*` handlers stay in `buildApi()` (the session
 *     channels call them, and the harness tests them) but the renderer can never
 *     reach them.
 *  2. `settings.set` took ANY key. `settings_kv` also holds the first-run latch
 *     (`setup_complete`), the backup configuration, the update preference and
 *     the invoice-number counters (`seq_*`). Resetting the latch re-opened the
 *     first-run wizard, which hands out an owner session; resetting a counter
 *     re-issues invoice numbers the shop has already printed. Only the UI
 *     preference blobs the renderer really writes are accepted now.
 *  3. A locked screen was a renderer-only overlay — the main-process session
 *     stayed live behind it, so every write still went through. A locked
 *     session now refuses writes until the PIN is entered again.
 */
import path from 'node:path';
import { CHANNEL_PERMISSIONS } from './permissions.ts';

export interface GateSession {
  userId: string;
  roleId: string;
  permissions: Set<string>;
  /** True while the lock screen is up. Writes are refused until unlock. */
  locked: boolean;
}

/**
 * Channels the renderer may never call directly. `session.login`/`unlock` call
 * the auth handlers inside the main process; nothing else needs them.
 */
export function isInternalOnlyChannel(channel: string): boolean {
  return channel.startsWith('auth.');
}

/**
 * The only `settings_kv` keys `settings.set` will write: the device/UI
 * preference blobs owned by `src/stores/settings.ts` (`writePref`). Everything
 * else in that table belongs to a backend service and has its own channel.
 */
export const SETTINGS_SET_KEYS: ReadonlySet<string> = new Set([
  'appearance',
  'pos',
  'cashRegister',
  'shortcuts',
  'barcode',
  'receipt',
  'printers',
  'schemes',
]);

/** Null when the write is allowed, else the error to return. */
export function settingsSetError(payload: unknown): string | null {
  const key = (payload as { key?: unknown } | null | undefined)?.key;
  if (typeof key !== 'string' || !SETTINGS_SET_KEYS.has(key)) {
    return `The setting "${String(key)}" cannot be changed from here.`;
  }
  return null;
}

export const NOT_SIGNED_IN = 'Not signed in — please sign in to perform this action.';
export const SCREEN_LOCKED = 'The screen is locked. Unlock it to continue.';

/**
 * Decide whether `channel` may run for this session.
 * Returns null when allowed, or the error string when denied.
 *
 * A channel that is not in CHANNEL_PERMISSIONS is an OPEN read.
 */
export function permissionError(channel: string, session: GateSession | null): string | null {
  const required = CHANNEL_PERMISSIONS[channel];
  if (!required) return null;
  if (!session) return NOT_SIGNED_IN;
  if (session.locked) return SCREEN_LOCKED;
  if (!session.permissions.has(required)) return `Permission denied: ${required}`;
  return null;
}

// ---------------------------------------------------------------- PIN throttle

export interface ThrottleOptions {
  /** Wrong attempts allowed before the first wait. */
  freeAttempts: number;
  /** The first wait; each further wrong attempt doubles it. */
  baseLockMs: number;
  /** The longest wait. */
  maxLockMs: number;
}

export const DEFAULT_THROTTLE: ThrottleOptions = {
  freeAttempts: 5,
  baseLockMs: 30_000,
  maxLockMs: 15 * 60_000,
};

export const TOO_MANY_ATTEMPTS = 'Too many wrong attempts. Please wait and try again.';

/**
 * Slows down PIN guessing.
 *
 * A PIN is 4–6 digits and nothing limited how fast they could be tried: 10,000
 * guesses sweep a 4-digit PIN in minutes. After `freeAttempts` wrong answers for
 * the same account, the next attempt must wait, and every further wrong answer
 * doubles the wait up to `maxLockMs`. A correct answer clears the record.
 *
 * In memory only, like the session. Restarting the app clears it, which costs an
 * attacker a restart per five guesses — far slower than the sweep it replaces,
 * and it can never lock the owner out of their own shop for good.
 *
 * The clock is passed in so the harness can drive it.
 */
export class AttemptThrottle {
  private readonly state = new Map<string, { failures: number; lockedUntil: number }>();

  constructor(private readonly opts: ThrottleOptions = DEFAULT_THROTTLE) {}

  /** Whether an attempt may be made now, and if not, how long to wait. */
  check(key: string, now: number): { allowed: boolean; retryInMs: number } {
    const s = this.state.get(key);
    if (!s || s.lockedUntil <= now) return { allowed: true, retryInMs: 0 };
    return { allowed: false, retryInMs: s.lockedUntil - now };
  }

  fail(key: string, now: number): void {
    const s = this.state.get(key) ?? { failures: 0, lockedUntil: 0 };
    s.failures += 1;
    const over = s.failures - this.opts.freeAttempts;
    if (over >= 0) {
      const wait = Math.min(this.opts.maxLockMs, this.opts.baseLockMs * 2 ** over);
      s.lockedUntil = now + wait;
    }
    this.state.set(key, s);
  }

  succeed(key: string): void {
    this.state.delete(key);
  }

  failures(key: string): number {
    return this.state.get(key)?.failures ?? 0;
  }
}

/** The throttle key for a login attempt: per account, per credential type. */
export function loginThrottleKey(payload: unknown): string {
  const p = (payload ?? {}) as { mode?: string; userId?: string; username?: string };
  if (p.mode === 'password') return `pw:${String(p.username ?? '').trim().toLowerCase()}`;
  return `pin:${String(p.userId ?? '')}`;
}

// ------------------------------------------------------- files and URLs

/**
 * Whether `file` resolves to somewhere inside one of `dirs`.
 * `..` segments and a sibling folder that merely shares a prefix
 * (`/shop/Invoices-old` vs `/shop/Invoices`) are both outside.
 */
export function isPathInside(file: string, dirs: string[]): boolean {
  const target = path.resolve(file);
  return dirs.some((d) => {
    const rel = path.relative(path.resolve(d), target);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  });
}

/**
 * Null when `file` may be opened as a saved invoice, else the reason not.
 *
 * `invoice.openPdf` hands the path to the operating system's "open" action, and
 * it used to accept ANY path from the renderer — on Windows that runs an .exe or
 * a .bat as readily as it shows a PDF. Only a .pdf inside one of the invoice
 * folders is opened now.
 */
export function pdfOpenError(file: unknown, dirs: string[]): string | null {
  if (typeof file !== 'string' || !file) return 'No file given';
  if (path.extname(file).toLowerCase() !== '.pdf') return 'Only saved invoice PDFs can be opened.';
  if (!isPathInside(file, dirs)) return 'Only saved invoice PDFs can be opened.';
  return null;
}

/** Links that may be handed to the system browser / mail client. */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:';
  } catch {
    return false;
  }
}

/**
 * Whether a navigation of the main window stays inside the app.
 *
 * The router is a HashRouter, so moving between screens never navigates the
 * page at all. A real navigation means something else happened — a stray
 * `<a href>`, a dropped file or URL — and it would replace the app with that
 * page while the preload bridge stayed attached to it. Only a reload of the
 * app itself is allowed: the same file in production, the same origin in dev.
 */
export function isAppNavigation(target: string, appUrl: string): boolean {
  try {
    const t = new URL(target);
    const a = new URL(appUrl);
    if (a.protocol === 'file:') return t.protocol === 'file:' && t.pathname === a.pathname;
    return t.origin === a.origin;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------- who did it

/**
 * Where each write channel's payload names the person doing it.
 *
 * The renderer used to fill these in itself, and it filled in constants: the
 * stores sent `'u_admin'` and several screens sent the demo owner's NAME,
 * `'Seam'`. So a cashier's void, a manager's purchase return and a stock
 * adjustment were all recorded as the owner's, in an audit trail whose whole
 * point is to say who did what. The main process knows who is signed in; it
 * writes that into the payload and whatever the renderer sent is ignored.
 *
 * Paths are dotted (`input.userId` for `sales.update`). Only fields the
 * handler actually reads are listed — a field meaning some OTHER user (e.g. the
 * target of `users.update`) must never be here.
 */
export const ACTOR_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'sales.create': ['userId'],
  'sales.update': ['input.userId'],
  'sales.convert': ['input.userId'],
  'sales.addPayment': ['userId'],
  'sales.void': ['userId'],
  'sellReturns.create': ['userId'],
  'shipments.create': ['userId'],
  'purchases.create': ['userId'],
  'purchases.addPayment': ['userId'],
  'purchases.cancel': ['userId'],
  'purchases.update': ['input.userId'],
  'purchases.receive': ['userId'],
  'purchaseReturns.create': ['userId'],
  'suppliers.pay': ['userId'],
  'customers.pay': ['userId'],
  'transfers.create': ['createdBy'],
  'transfers.receive': ['userId'],
  'transfers.cancel': ['userId'],
  'adjustments.create': ['createdBy'],
  'expenses.create': ['userId'],
  'expenses.void': ['userId'],
  'expenses.update': ['patch.userId'],
  // Staff and roles: who gave whom which rights.
  'users.create': ['actorId'],
  'users.update': ['actorId'],
  'users.delete': ['actorId'],
  'roles.create': ['actorId'],
  'roles.update': ['actorId'],
  'roles.delete': ['actorId'],
  'expenses.delete': ['userId'],
  'cash.openShift': ['userId'],
  'cash.closeShift': ['closedBy'],
  'cash.move': ['userId'],
  'products.create': ['userId'],
  // A changed buying price on the product screen becomes a cost-history entry,
  // which records who set it.
  'products.update': ['patch.userId'],
  'products.archive': ['userId'],
  'products.unarchive': ['userId'],
  'products.setCost': ['userId'],
  'customers.create': ['userId'],
  'suppliers.create': ['userId'],
  // Contact edits and deletes: the log used to take the name from the screen.
  'customers.update': ['patch.userId'],
  'suppliers.update': ['patch.userId'],
  'customers.delete': ['userId'],
  'suppliers.delete': ['userId'],
};

/**
 * Return `payload` with every actor field for `channel` set to `userId`.
 * A copy is returned; the original is never mutated. Payloads that are not
 * objects (or channels with no actor field) pass through unchanged. An
 * intermediate object that is missing (`sales.update` with no `input`) is left
 * missing — the handler reports that, not this.
 */
export function stampActor(channel: string, payload: unknown, userId: string): unknown {
  const fields = ACTOR_FIELDS[channel];
  if (!fields || payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  const out: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
  for (const f of fields) {
    const parts = f.split('.');
    let node: Record<string, unknown> = out;
    let ok = true;
    for (let i = 0; i < parts.length - 1; i++) {
      const child = node[parts[i]];
      if (child === null || typeof child !== 'object' || Array.isArray(child)) {
        ok = false;
        break;
      }
      const copy = { ...(child as Record<string, unknown>) };
      node[parts[i]] = copy;
      node = copy;
    }
    if (ok) node[parts[parts.length - 1]] = userId;
  }
  return out;
}

// ------------------------------------------------ closing a shift that is out

/** Who may close a shift whose count is past the hard variance limit. */
export const VARIANCE_OVERRIDE_PERMISSION = 'sales.void';

export const VARIANCE_BLOCKED =
  'The count is over the variance limit. Only the owner or a manager can close this shift.';

/**
 * Null when this close may go ahead, else the reason not.
 *
 * Settings → Cash Register has a hard variance limit and a "manager must
 * approve" switch, and the Close Shift screen showed a warning about both — but
 * its gate read `!overBlock || confirm`, where `confirm` was the browser's own
 * function (always truthy), so nothing was ever blocked. The decision is made
 * here now, from the same saved preference, and enforced in the main process.
 *
 * The approver is whoever holds VARIANCE_OVERRIDE_PERMISSION — the permission
 * to void a sale, which is already the owner's and the manager's and never a
 * cashier's. A new permission would be missing from every role already saved
 * in a shop's database, owner included.
 */
export function varianceGateError(opts: {
  variance: number;
  prefs: unknown;
  permissions: Set<string>;
}): string | null {
  const p = (opts.prefs ?? {}) as { varianceBlock?: unknown; requireManagerPinOnVariance?: unknown };
  const block = Number(p.varianceBlock);
  const limit = Number.isFinite(block) && block > 0 ? block : 1000;
  const required = p.requireManagerPinOnVariance !== false;
  if (!required) return null;
  if (Math.abs(opts.variance) < limit) return null;
  if (opts.permissions.has(VARIANCE_OVERRIDE_PERMISSION)) return null;
  return VARIANCE_BLOCKED;
}

// ------------------------------------------ what a contact owes, by hand

/**
 * Owner-and-manager powers without a permission of their own use the right to
 * void a sale — see VARIANCE_OVERRIDE_PERMISSION for why not a new permission.
 */
export const MANAGER_PERMISSION = VARIANCE_OVERRIDE_PERMISSION;

/**
 * The counter's price rights, checked by backend/services/saleRules.ts from
 * the IPC boundary (R16). Every role that could sell was given both by the v12
 * migration, so the owner takes them away per role in Roles.
 */
export const DISCOUNT_PERMISSION = 'pos.discount';
export const PRICE_OVERRIDE_PERMISSION = 'pos.priceOverride';

export const BALANCE_EDIT_BLOCKED =
  'Only the owner or a manager can change an opening balance or a credit limit.';

/**
 * Null when this contact edit may go ahead, else the reason not.
 *
 * `contacts.editCustomers` is a cashier right (fixing a phone number at the
 * counter), and it also let a cashier rewrite a customer's opening balance —
 * i.e. write off what they owe — with nothing but "Updated customer" in the
 * log. The money fields now need the manager right; everything else on the
 * form stays open. A value sent unchanged (the form always sends the whole
 * record) is not a change.
 */
export function contactBalanceGateError(opts: {
  current: { opening_balance: number; credit_limit?: number | null } | undefined;
  patch: unknown;
  permissions: Set<string>;
}): string | null {
  if (!opts.current || opts.permissions.has(MANAGER_PERMISSION)) return null;
  const p = (opts.patch ?? {}) as { openingBalance?: unknown; creditLimit?: unknown };
  if ('openingBalance' in p) {
    const next = Number(p.openingBalance ?? 0);
    if (!Number.isFinite(next) || Math.abs(next - opts.current.opening_balance) > 0.004) {
      return BALANCE_EDIT_BLOCKED;
    }
  }
  if ('creditLimit' in p && opts.current.credit_limit !== undefined) {
    const raw = p.creditLimit;
    const next = raw === undefined || raw === null || raw === '' ? null : Number(raw);
    const old = opts.current.credit_limit ?? null;
    if (next === null ? old !== null : old === null || !Number.isFinite(next) || Math.abs(next - old) > 0.004) {
      return BALANCE_EDIT_BLOCKED;
    }
  }
  return null;
}

// ------------------------------------------------------ rights are live

/**
 * The session's rights as they are NOW. Permissions used to be copied once at
 * sign-in, so a user who was deactivated, demoted or deleted — or whose role
 * lost a right — kept everything until they signed out (R17). Pure: the caller
 * reads the user row and the role's permissions and passes them in.
 *
 * Returns null when the session must end (user gone or no longer active).
 */
export function refreshedSession(
  session: GateSession,
  user: { status: string; role_id: string } | undefined,
  rolePermissions: (roleId: string) => string[],
): GateSession | null {
  if (!user || user.status !== 'active') return null;
  return { ...session, roleId: user.role_id, permissions: new Set(rolePermissions(user.role_id)) };
}
