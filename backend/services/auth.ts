import bcrypt from 'bcryptjs';
import type { DB } from '../db/connection.ts';

/**
 * Auth service — credential hashing + backend-verified login.
 *
 * This module is PURE (no Electron, no IPC) so the Node verification harness can
 * exercise it directly. It hashes PINs/passwords with bcryptjs (pure JS, no
 * native build) and verifies them on login/unlock.
 *
 * SECURITY NOTE: permission ENFORCEMENT does NOT live here. The backend handlers
 * and this service stay enforcement-free so the verify harness keeps calling them
 * directly. Enforcement is bolted on at the Electron IPC boundary (electron/ipc.ts
 * + electron/permissions.ts), which the renderer cannot bypass.
 */

/** bcrypt work factor. 10 is the bcryptjs default — fast enough for a desktop POS. */
const BCRYPT_COST = 10;

/** A real bcrypt hash always starts with `$2` (e.g. `$2a$`, `$2b$`, `$2y$`). */
function isBcryptHash(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('$2');
}

/** Hash a plaintext secret (PIN or password) with bcrypt. */
export function hashSecret(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

export interface VerifyResult {
  /** True when `plain` matches the stored hash (or the legacy plaintext value). */
  match: boolean;
  /**
   * True when the match came from a LEGACY plaintext value (not a bcrypt hash).
   * The caller should re-hash and persist the value so it migrates on first use.
   */
  legacy: boolean;
}

/**
 * Verify a plaintext secret against a stored value.
 *  - empty/null stored value → no match
 *  - bcrypt hash ($2…)        → bcrypt.compareSync
 *  - anything else            → one-time LEGACY path: treat as a match iff the
 *    stored plaintext equals `plain`, flagging `legacy` so the caller upgrades it
 *    to a bcrypt hash (migrates the seed's plaintext pins on first login).
 */
export function verifySecret(plain: string, hash: string | null | undefined): VerifyResult {
  if (!hash) return { match: false, legacy: false };
  if (isBcryptHash(hash)) {
    return { match: bcrypt.compareSync(plain, hash), legacy: false };
  }
  // Legacy plaintext (pre-bcrypt seed/migration). Constant value compare.
  return { match: hash === plain, legacy: hash === plain };
}

// ---------- internal row helpers ----------

interface UserRow {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  email: string | null;
  pin_hash: string | null;
  password_hash: string | null;
  role_id: string;
  branch_ids: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
}

/** The sanitized user the auth layer returns — NEVER includes hashes. */
export interface SanitizedUser {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  email: string | null;
  role_id: string;
  branch_ids: string;
  status: string;
  last_login_at: string | null;
}

function sanitize(u: UserRow): SanitizedUser {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    phone: u.phone,
    email: u.email,
    role_id: u.role_id,
    branch_ids: u.branch_ids,
    status: u.status,
    last_login_at: u.last_login_at,
  };
}

/** Resolve a role's permission id array from its JSON column. */
function rolePermissions(db: DB, roleId: string): string[] {
  const row = db.prepare('SELECT permissions FROM roles WHERE id = ?').get(roleId) as
    | { permissions: string }
    | undefined;
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.permissions);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// ---------- authenticate ----------

export interface AuthenticateInput {
  mode: 'pin' | 'password';
  userId?: string;
  username?: string;
  secret: string;
}

export interface AuthenticateResult {
  ok: boolean;
  error?: string;
  user?: SanitizedUser;
  permissions?: string[];
}

/**
 * Verify credentials and (on success) return the sanitized user + resolved
 * permission array. Updates last_login_at, and re-hashes a legacy plaintext
 * secret in place so it migrates to bcrypt on first successful login.
 */
export function authenticate(db: DB, input: AuthenticateInput): AuthenticateResult {
  const { mode, secret } = input;

  // Look up the user by id (pin mode) or username, case-insensitive (password mode).
  let row: UserRow | undefined;
  if (mode === 'pin') {
    if (!input.userId) return { ok: false, error: 'No user selected' };
    row = db.prepare('SELECT * FROM users WHERE id = ?').get(input.userId) as UserRow | undefined;
  } else {
    if (!input.username) return { ok: false, error: 'Username required' };
    row = db
      .prepare('SELECT * FROM users WHERE lower(username) = lower(?)')
      .get(input.username.trim()) as UserRow | undefined;
  }

  if (!row) return { ok: false, error: 'User not found' };
  if (row.status !== 'active') return { ok: false, error: 'Account is not active' };

  const stored = mode === 'pin' ? row.pin_hash : row.password_hash;
  const column = mode === 'pin' ? 'pin_hash' : 'password_hash';
  const result = verifySecret(secret, stored);
  if (!result.match) {
    return { ok: false, error: mode === 'pin' ? 'Incorrect PIN' : 'Incorrect password' };
  }

  // Migrate a legacy plaintext value to a bcrypt hash on first successful login.
  if (result.legacy) {
    db.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).run(hashSecret(secret), row.id);
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, row.id);

  return {
    ok: true,
    user: { ...sanitize(row), last_login_at: now },
    permissions: rolePermissions(db, row.role_id),
  };
}

// ---------- secret management ----------

export interface SecretInput {
  pin?: string;
  password?: string;
}

/**
 * Hash and store a user's PIN and/or password. Used by settings.createUser /
 * updateUser, the first-run wizard, and PIN-change flows. Only the provided
 * fields are written (so updating a name never wipes the PIN).
 */
export function setUserSecret(db: DB, userId: string, secrets: SecretInput): { id: string } {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id: userId };
  if (secrets.pin !== undefined && secrets.pin !== null && secrets.pin !== '') {
    sets.push('pin_hash = @pinHash');
    params.pinHash = hashSecret(secrets.pin);
  }
  if (secrets.password !== undefined && secrets.password !== null && secrets.password !== '') {
    sets.push('password_hash = @passwordHash');
    params.passwordHash = hashSecret(secrets.password);
  }
  if (sets.length > 0) {
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`).run(params);
  }
  return { id: userId };
}

/**
 * Verify a PIN for a specific user. Used for screen unlock and manager-PIN
 * overrides. Migrates a legacy plaintext PIN to a bcrypt hash on success.
 */
export function verifyUserPin(db: DB, userId: string, pin: string): boolean {
  const row = db.prepare('SELECT id, pin_hash, status FROM users WHERE id = ?').get(userId) as
    | { id: string; pin_hash: string | null; status: string }
    | undefined;
  if (!row) return false;
  if (row.status !== 'active') return false;
  const result = verifySecret(pin, row.pin_hash);
  if (result.match && result.legacy) {
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashSecret(pin), userId);
  }
  return result.match;
}
