import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { newId } from '../core/ids.ts';
import { logActivity } from './activity.ts';
import { hashSecret } from './auth.ts';
import { assertPassword, assertPin, USER_STATUSES } from '../core/validate.ts';
import { markDefaultBranch } from './branch.ts';

/**
 * Settings service — the write-side for the Settings slice.
 *
 * TWO KINDS of settings live here:
 *   A. Shared business ENTITIES with real dedicated tables: business_info,
 *      branches, tax_rates, commission_agents, users, roles. These get proper
 *      colMap partial-update + delete-guard handlers (mirrors catalog.ts /
 *      contacts.ts).
 *   B. Device/UI PREFERENCES with no dedicated table: appearance, pos,
 *      cashRegister, shortcuts, barcode, receipt, printers, invoice schemes,
 *      backup. These are persisted app-wide as JSON blobs in settings_kv via the
 *      generic getSetting / setSetting / getAllSettings helpers.
 *
 * ARCHITECTURE NOTES
 *  - Multi-statement writes are tx()-wrapped (auto rollback on throw).
 *  - Delete-guards keep historical documents intact: an entity referenced by
 *    sales/purchases/etc. is never hard-deleted (block or soft-deactivate).
 *
 * AUTH:
 *  - PIN/password are hashed with bcrypt (via auth.hashSecret) before storage.
 *    `pin` -> pin_hash and `password` -> password_hash are NEVER stored in
 *    plaintext. Reads never return pin_hash / password_hash (see
 *    queries.listUsers). Login/unlock verification lives in services/auth.ts.
 *  - IPC permission enforcement is NOT added here — it lives at the Electron IPC
 *    boundary (electron/ipc.ts) so the Node verify harness can call these
 *    handlers directly. Roles/permissions are stored and editable here.
 */

// ============================================================
//  A. Business info (single row id = 1)
// ============================================================

export interface BusinessInfoPatch {
  name?: string;
  tagline?: string;
  logoUrl?: string;
  address?: string;
  phonePrimary?: string;
  phoneAlt?: string;
  email?: string;
  website?: string;
  vatTin?: string;
  binNo?: string;
  tradeLicenseNo?: string;
  currencySymbol?: string;
  currencyPosition?: 'before' | 'after';
  decimalPlaces?: number;
  thousandSeparator?: string;
  timezone?: string;
  dateFormat?: string;
  fiscalYearStart?: number;
  defaultLanguage?: string;
  defaultBranchId?: string | null;
  userId?: string;
}

export function updateBusinessInfo(db: DB, patch: BusinessInfoPatch) {
  return tx(db, () => {
    // A `blob:` URL is scoped to one browser window, so storing it means the logo
    // is dead on the next restart AND prints broken on every receipt. That is
    // exactly what an earlier build did; refuse it loudly instead of repeating it.
    if (typeof patch.logoUrl === 'string' && patch.logoUrl.startsWith('blob:')) {
      throw new Error(
        'Cannot store this logo: it is a temporary browser reference that would be lost on restart.',
      );
    }
    const existing = db.prepare('SELECT id FROM business_info WHERE id = 1').get();
    if (!existing) throw new Error('Business info not initialised');
    const now = new Date().toISOString();

    const colMap: Record<string, string> = {
      name: 'name',
      tagline: 'tagline',
      logoUrl: 'logo_url',
      address: 'address',
      phonePrimary: 'phone_primary',
      phoneAlt: 'phone_alt',
      email: 'email',
      website: 'website',
      vatTin: 'vat_tin',
      binNo: 'bin_no',
      tradeLicenseNo: 'trade_license_no',
      currencySymbol: 'currency_symbol',
      currencyPosition: 'currency_position',
      decimalPlaces: 'decimal_places',
      thousandSeparator: 'thousand_separator',
      timezone: 'timezone',
      dateFormat: 'date_format',
      fiscalYearStart: 'fiscal_year_start',
      defaultLanguage: 'default_language',
      defaultBranchId: 'default_branch_id',
    };
    const sets: string[] = [];
    const params: Record<string, unknown> = { now };
    for (const [k, col] of Object.entries(colMap)) {
      if (k in patch) {
        sets.push(`${col} = @${k}`);
        params[k] = (patch as Record<string, unknown>)[k] ?? null;
      }
    }
    sets.push('updated_at = @now');
    db.prepare(`UPDATE business_info SET ${sets.join(', ')} WHERE id = 1`).run(params);
    // Choosing the default branch here also moves the branch list's default flag,
    // so the screens and the writes agree on one default (services/branch.ts).
    if (patch.defaultBranchId) markDefaultBranch(db, patch.defaultBranchId);

    logActivity(db, {
      by: patch.userId,
      action: 'edited',
      entity: 'business',
      entityId: '1',
      message: 'Updated business info',
      at: now,
    });
    return { id: 1 };
  });
}

// ============================================================
//  Branches
// ============================================================

export interface BranchInput {
  id?: string;
  name: string;
  code?: string;
  address?: string;
  phonePrimary?: string;
  phoneAlt?: string;
  manager?: string;
  isDefault?: boolean;
  active?: boolean;
  userId?: string;
}

export function createBranch(db: DB, input: BranchInput) {
  return tx(db, () => {
    const id = input.id ?? newId('br');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO branches (id, name, code, address, phone_primary, phone_alt, manager, is_default, active, created_at)
       VALUES (@id, @name, @code, @address, @phonePrimary, @phoneAlt, @manager, @isDefault, @active, @now)`,
    ).run({
      id,
      name: input.name,
      code: input.code ?? null,
      address: input.address ?? null,
      phonePrimary: input.phonePrimary ?? null,
      phoneAlt: input.phoneAlt ?? null,
      manager: input.manager ?? null,
      isDefault: input.isDefault ? 1 : 0,
      active: input.active === false ? 0 : 1,
      now,
    });
    // If created as default, it becomes THE default everywhere (one default only).
    if (input.isDefault) markDefaultBranch(db, id);
    logActivity(db, {
      by: input.userId,
      action: 'created',
      entity: 'branch',
      entityId: id,
      entityRef: input.code ?? undefined,
      message: `New branch: ${input.name}`,
      at: now,
    });
    return { id };
  });
}

export function updateBranch(db: DB, id: string, patch: Partial<BranchInput>) {
  return tx(db, () => {
    const existing = db.prepare('SELECT id FROM branches WHERE id = ?').get(id);
    if (!existing) throw new Error('Branch not found');

    const colMap: Record<string, string> = {
      name: 'name',
      code: 'code',
      address: 'address',
      phonePrimary: 'phone_primary',
      phoneAlt: 'phone_alt',
      manager: 'manager',
    };
    const boolMap: Record<string, string> = { active: 'active', isDefault: 'is_default' };
    const sets: string[] = [];
    const params: Record<string, unknown> = { id };
    for (const [k, col] of Object.entries(colMap)) {
      if (k in patch) {
        sets.push(`${col} = @${k}`);
        params[k] = (patch as Record<string, unknown>)[k] ?? null;
      }
    }
    for (const [k, col] of Object.entries(boolMap)) {
      if (k in patch) {
        sets.push(`${col} = @${k}`);
        params[k] = (patch as Record<string, unknown>)[k] ? 1 : 0;
      }
    }
    if (sets.length > 0) {
      db.prepare(`UPDATE branches SET ${sets.join(', ')} WHERE id = @id`).run(params);
    }
    // Keep the single-default invariant if this update set the branch as default.
    if (patch.isDefault) markDefaultBranch(db, id);
    return { id };
  });
}

export function setDefaultBranch(db: DB, id: string) {
  return tx(db, () => {
    const existing = db.prepare('SELECT id FROM branches WHERE id = ?').get(id);
    if (!existing) throw new Error('Branch not found');
    markDefaultBranch(db, id);
    return { id };
  });
}

export function deleteBranch(db: DB, id: string) {
  return tx(db, () => {
    // Guard: a branch with any transaction history can't be deleted — keeps
    // sales/purchase/stock/cash documents referentially intact.
    const refs = [
      ['sales', 'sales'],
      ['purchases', 'purchases'],
      ['stock_movements', 'stock movements'],
      ['cash_shifts', 'cash shifts'],
    ] as const;
    for (const [table, label] of refs) {
      const c = db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE branch_id = ?`).get(id) as { c: number };
      if (c.c > 0) {
        throw new Error(`Cannot delete: branch has ${label}. Branches with transaction history can't be deleted.`);
      }
    }
    db.prepare('DELETE FROM branches WHERE id = ?').run(id);
    return { id };
  });
}

// ============================================================
//  Tax rates
// ============================================================

export interface TaxRateInput {
  id?: string;
  name: string;
  percentage: number;
  isDefault?: boolean;
  scope?: string;
  active?: boolean;
}

export function createTaxRate(db: DB, input: TaxRateInput) {
  return tx(db, () => {
    const id = input.id ?? newId('tx');
    db.prepare(
      `INSERT INTO tax_rates (id, name, percentage, is_default, scope, active)
       VALUES (@id, @name, @percentage, @isDefault, @scope, @active)`,
    ).run({
      id,
      name: input.name,
      percentage: input.percentage,
      isDefault: input.isDefault ? 1 : 0,
      scope: input.scope ?? 'all',
      active: input.active === false ? 0 : 1,
    });
    if (input.isDefault) {
      db.prepare('UPDATE tax_rates SET is_default = 0 WHERE id != ?').run(id);
    }
    return { id };
  });
}

export function updateTaxRate(db: DB, id: string, patch: Partial<TaxRateInput>) {
  return tx(db, () => {
    const existing = db.prepare('SELECT id FROM tax_rates WHERE id = ?').get(id);
    if (!existing) throw new Error('Tax rate not found');

    const colMap: Record<string, string> = {
      name: 'name',
      percentage: 'percentage',
      scope: 'scope',
    };
    const boolMap: Record<string, string> = { isDefault: 'is_default', active: 'active' };
    const sets: string[] = [];
    const params: Record<string, unknown> = { id };
    for (const [k, col] of Object.entries(colMap)) {
      if (k in patch) {
        sets.push(`${col} = @${k}`);
        params[k] = (patch as Record<string, unknown>)[k] ?? null;
      }
    }
    for (const [k, col] of Object.entries(boolMap)) {
      if (k in patch) {
        sets.push(`${col} = @${k}`);
        params[k] = (patch as Record<string, unknown>)[k] ? 1 : 0;
      }
    }
    if (sets.length > 0) {
      db.prepare(`UPDATE tax_rates SET ${sets.join(', ')} WHERE id = @id`).run(params);
    }
    if (patch.isDefault) {
      db.prepare('UPDATE tax_rates SET is_default = 0 WHERE id != ?').run(id);
    }
    return { id };
  });
}

export function deleteTaxRate(db: DB, id: string) {
  db.prepare('DELETE FROM tax_rates WHERE id = ?').run(id);
  return { id };
}

// ============================================================
//  Commission agents
// ============================================================

export interface AgentInput {
  id?: string;
  name: string;
  phone?: string;
  commissionPct?: number;
  active?: boolean;
}

export function createAgent(db: DB, input: AgentInput) {
  const id = input.id ?? newId('ag');
  db.prepare(
    `INSERT INTO commission_agents (id, name, phone, commission_pct, active)
     VALUES (@id, @name, @phone, @commissionPct, @active)`,
  ).run({
    id,
    name: input.name,
    phone: input.phone ?? null,
    commissionPct: input.commissionPct ?? 0,
    active: input.active === false ? 0 : 1,
  });
  return { id };
}

export function updateAgent(db: DB, id: string, patch: Partial<AgentInput>) {
  const existing = db.prepare('SELECT id FROM commission_agents WHERE id = ?').get(id);
  if (!existing) throw new Error('Agent not found');

  const colMap: Record<string, string> = {
    name: 'name',
    phone: 'phone',
    commissionPct: 'commission_pct',
  };
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  for (const [k, col] of Object.entries(colMap)) {
    if (k in patch) {
      sets.push(`${col} = @${k}`);
      params[k] = (patch as Record<string, unknown>)[k] ?? null;
    }
  }
  if ('active' in patch) {
    sets.push('active = @active');
    params.active = patch.active ? 1 : 0;
  }
  if (sets.length > 0) {
    db.prepare(`UPDATE commission_agents SET ${sets.join(', ')} WHERE id = @id`).run(params);
  }
  return { id };
}

export function deleteAgent(db: DB, id: string) {
  return tx(db, () => {
    // Guard: an agent referenced by a sale (commission history) is soft-
    // deactivated rather than deleted so the sale's agent_id stays valid.
    const refs = db.prepare('SELECT COUNT(*) c FROM sales WHERE agent_id = ?').get(id) as { c: number };
    if (refs.c > 0) {
      db.prepare('UPDATE commission_agents SET active = 0 WHERE id = ?').run(id);
      return { id, deactivated: true };
    }
    db.prepare('DELETE FROM commission_agents WHERE id = ?').run(id);
    return { id, deactivated: false };
  });
}

// ============================================================
//  Users
// ============================================================

export interface UserInput {
  id?: string;
  name: string;
  username: string;
  phone?: string;
  email?: string;
  // Hashed with bcrypt (auth.hashSecret) before storage — never stored plaintext.
  pin?: string;
  password?: string;
  roleId: string;
  branchIds?: string[];
  status?: string;
  lastLoginAt?: string;
}

/** Treat the seeded system Admin role as the "admin" role for last-admin guards. */
const ADMIN_ROLE_ID = 'role_admin';

function friendlyUserWrite<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE/i.test(msg) && /username/i.test(msg)) {
      throw new Error('That username is already taken. Pick a different one.');
    }
    throw err;
  }
}

/** Active users holding the Admin role, optionally not counting one of them. */
function activeAdmins(db: DB, exceptId?: string): number {
  return (
    db
      .prepare("SELECT COUNT(*) c FROM users WHERE role_id = ? AND status = 'active' AND id != ?")
      .get(ADMIN_ROLE_ID, exceptId ?? '') as { c: number }
  ).c;
}

function checkStatus(v: unknown): string {
  const st = String(v ?? 'active');
  if (!(USER_STATUSES as readonly string[]).includes(st)) {
    throw new Error(`"${st}" is not a user status. Use active, inactive or suspended.`);
  }
  return st;
}

export function createUser(db: DB, input: UserInput & { actorId?: string }) {
  return friendlyUserWrite(() =>
    tx(db, () => {
      if (!input.name?.trim()) throw new Error('A user needs a name.');
      if (!input.username?.trim()) throw new Error('A user needs a username.');
      // Someone who can never sign in is not a user; and a guessable PIN is one
      // guess away from their rights (R19).
      const pin = input.pin ? assertPin(input.pin) : undefined;
      const password = input.password ? assertPassword(input.password) : undefined;
      if (!pin && !password) throw new Error('Give the user a PIN (4 to 6 digits) or a password.');
      const status = checkStatus(input.status);
      const id = input.id ?? newId('u');
      const now = new Date().toISOString();
      // PIN/password are bcrypt-hashed before storage (never plaintext).
      db.prepare(
        `INSERT INTO users (id, name, username, phone, email, pin_hash, password_hash, role_id, branch_ids, status, last_login_at, created_at)
         VALUES (@id, @name, @username, @phone, @email, @pinHash, @passwordHash, @roleId, @branchIds, @status, @lastLoginAt, @now)`,
      ).run({
        id,
        name: input.name.trim(),
        username: input.username.trim().toLowerCase(),
        phone: input.phone ?? null,
        email: input.email ?? null,
        pinHash: pin ? hashSecret(pin) : null,
        passwordHash: password ? hashSecret(password) : null,
        roleId: input.roleId,
        branchIds: JSON.stringify(input.branchIds ?? []),
        status,
        lastLoginAt: input.lastLoginAt ?? null,
        now,
      });
      logActivity(db, {
        by: input.actorId,
        action: 'created',
        entity: 'user',
        entityId: id,
        entityRef: input.username,
        message: `New user: ${input.name} (${roleName(db, input.roleId)})`,
        at: now,
      });
      return { id };
    }),
  );
}

function roleName(db: DB, roleId: string): string {
  return (db.prepare('SELECT name FROM roles WHERE id = ?').get(roleId) as { name: string } | undefined)?.name ?? roleId;
}

export function updateUser(db: DB, id: string, patch: Partial<UserInput> & { actorId?: string }) {
  return friendlyUserWrite(() =>
    tx(db, () => {
      const existing = db.prepare('SELECT id, name, username, role_id, status FROM users WHERE id = ?').get(id) as
        | { id: string; name: string; username: string; role_id: string; status: string }
        | undefined;
      if (!existing) throw new Error('User not found');
      const now = new Date().toISOString();

      // An empty PIN/password field means "not changing it". It used to CLEAR
      // it: the users screen sends the whole form, so editing someone's phone
      // number without retyping their PIN wiped the PIN.
      const pin = patch.pin ? assertPin(patch.pin) : undefined;
      const password = patch.password ? assertPassword(patch.password) : undefined;
      const nextStatus = 'status' in patch && patch.status !== undefined ? checkStatus(patch.status) : existing.status;
      const nextRole = patch.roleId ?? existing.role_id;

      // Nobody locks themselves out, and the shop always keeps an admin (R18).
      if (patch.actorId && patch.actorId === id) {
        if (nextStatus !== 'active') throw new Error('You cannot deactivate your own account. Ask another admin.');
        if (nextRole !== existing.role_id) throw new Error('You cannot change your own role. Ask another admin.');
      }
      const stillAdmin = nextRole === ADMIN_ROLE_ID && nextStatus === 'active';
      if (!stillAdmin && existing.role_id === ADMIN_ROLE_ID && activeAdmins(db, id) === 0) {
        throw new Error('This is the last active admin. Make another user an admin first.');
      }

      const colMap: Record<string, string> = {
        name: 'name',
        username: 'username',
        phone: 'phone',
        email: 'email',
        roleId: 'role_id',
        status: 'status',
        lastLoginAt: 'last_login_at',
      };
      const sets: string[] = [];
      const params: Record<string, unknown> = { id };
      for (const [k, col] of Object.entries(colMap)) {
        const v = (patch as Record<string, unknown>)[k];
        // Undefined = not sent. A required column is never blanked by a form.
        if (v === undefined) continue;
        if ((k === 'name' || k === 'username' || k === 'roleId') && !String(v).trim()) continue;
        sets.push(`${col} = @${k}`);
        params[k] = k === 'username' ? String(v).trim().toLowerCase() : k === 'status' ? nextStatus : v;
      }
      if ('branchIds' in patch && patch.branchIds !== undefined) {
        sets.push('branch_ids = @branchIds');
        params.branchIds = JSON.stringify(patch.branchIds ?? []);
      }
      if (pin) {
        sets.push('pin_hash = @pinHash');
        params.pinHash = hashSecret(pin);
      }
      if (password) {
        sets.push('password_hash = @passwordHash');
        params.passwordHash = hashSecret(password);
      }
      if (sets.length > 0) {
        db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`).run(params);
      }
      const changes: string[] = [];
      if (nextRole !== existing.role_id) changes.push(`role ${roleName(db, existing.role_id)} → ${roleName(db, nextRole)}`);
      if (nextStatus !== existing.status) changes.push(`status ${existing.status} → ${nextStatus}`);
      if (pin) changes.push('PIN changed');
      if (password) changes.push('password changed');
      logActivity(db, {
        by: patch.actorId,
        action: 'edited',
        entity: 'user',
        entityId: id,
        entityRef: existing.username,
        message: changes.length ? `Updated user ${existing.name}: ${changes.join('; ')}` : `Updated user ${existing.name}`,
        at: now,
      });
      return { id };
    }),
  );
}

export function deleteUser(db: DB, id: string, actorId?: string) {
  return tx(db, () => {
    const user = db.prepare('SELECT id, role_id, name, username, status FROM users WHERE id = ?').get(id) as
      | { id: string; role_id: string; name: string; username: string; status: string }
      | undefined;
    if (!user) throw new Error('User not found');

    // Guard 1: never delete the seeded owner account.
    if (id === 'u_admin') {
      throw new Error('Cannot delete the owner account (u_admin).');
    }
    if (actorId && actorId === id) throw new Error('You cannot delete your own account.');
    // Guard 2: there must always be one ACTIVE admin left — an inactive one
    // cannot sign in, so counting it could leave the shop with no admin at all.
    if (user.role_id === ADMIN_ROLE_ID && activeAdmins(db, id) === 0) {
      throw new Error('Cannot delete the last active admin user.');
    }

    // Guard 3: a user referenced by transaction history is soft-deactivated
    // (status = inactive) rather than hard-deleted, so user_id stays valid.
    const refs = [
      ['sales', 'user_id'],
      ['purchases', 'user_id'],
      ['cash_shifts', 'user_id'],
      ['expenses', 'user_id'],
      ['stock_movements', 'user_id'],
    ] as const;
    let referenced = false;
    for (const [table, col] of refs) {
      const c = db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE ${col} = ?`).get(id) as { c: number };
      if (c.c > 0) {
        referenced = true;
        break;
      }
    }
    if (referenced) {
      db.prepare("UPDATE users SET status = 'inactive' WHERE id = ?").run(id);
    } else {
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    }
    logActivity(db, {
      by: actorId,
      action: referenced ? 'deactivated' : 'deleted',
      entity: 'user',
      entityId: id,
      entityRef: user.username,
      message: referenced
        ? `User ${user.name} deactivated (kept: they are on past records)`
        : `Deleted user ${user.name}`,
    });
    return { id, deactivated: referenced };
  });
}

// ============================================================
//  Roles
// ============================================================

export interface RoleInput {
  id?: string;
  name: string;
  description?: string;
  permissions?: string[];
  isSystem?: boolean;
}

export function createRole(db: DB, input: RoleInput & { actorId?: string }) {
  if (!input.name?.trim()) throw new Error('A role needs a name.');
  const id = input.id ?? newId('role');
  db.prepare(
    `INSERT INTO roles (id, name, description, is_system, permissions)
     VALUES (@id, @name, @description, @isSystem, @permissions)`,
  ).run({
    id,
    name: input.name.trim(),
    description: input.description ?? null,
    // Built-in roles come from the seed only; a role made here is never "system".
    isSystem: 0,
    permissions: JSON.stringify(input.permissions ?? []),
  });
  logActivity(db, {
    by: input.actorId,
    action: 'created',
    entity: 'role',
    entityId: id,
    entityRef: input.name,
    message: `New role: ${input.name} (${(input.permissions ?? []).length} rights)`,
  });
  return { id };
}

export function updateRole(db: DB, id: string, patch: Partial<RoleInput> & { actorId?: string }) {
  const existing = db.prepare('SELECT id, name, permissions FROM roles WHERE id = ?').get(id) as
    | { id: string; name: string; permissions: string }
    | undefined;
  if (!existing) throw new Error('Role not found');
  let before: string[] = [];
  try {
    before = JSON.parse(existing.permissions) as string[];
  } catch {
    before = [];
  }
  // The Admin role always has every right: "Revoke all" on it used to leave the
  // owner locked out of Users, Roles and Backup with nobody able to undo it (B9).
  if (id === ADMIN_ROLE_ID && 'permissions' in patch) {
    const next = new Set(patch.permissions ?? []);
    if (before.some((p) => !next.has(p))) {
      throw new Error('The Admin role always keeps every right. Make a new role to limit someone.');
    }
  }

  const colMap: Record<string, string> = {
    name: 'name',
    description: 'description',
  };
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  for (const [k, col] of Object.entries(colMap)) {
    if (k in patch && (patch as Record<string, unknown>)[k] !== undefined) {
      sets.push(`${col} = @${k}`);
      params[k] = (patch as Record<string, unknown>)[k] ?? null;
    }
  }
  // permissions array <-> JSON TEXT
  if ('permissions' in patch && patch.permissions !== undefined) {
    sets.push('permissions = @permissions');
    params.permissions = JSON.stringify(patch.permissions ?? []);
  }
  if (sets.length > 0) {
    db.prepare(`UPDATE roles SET ${sets.join(', ')} WHERE id = @id`).run(params);
  }
  const after = patch.permissions ?? before;
  const added = after.filter((p) => !before.includes(p));
  const removed = before.filter((p) => !after.includes(p));
  const parts: string[] = [];
  if (added.length) parts.push(`added ${added.join(', ')}`);
  if (removed.length) parts.push(`removed ${removed.join(', ')}`);
  logActivity(db, {
    by: patch.actorId,
    action: 'edited',
    entity: 'role',
    entityId: id,
    entityRef: existing.name,
    message: parts.length ? `Role ${existing.name}: ${parts.join('; ')}` : `Updated role ${existing.name}`,
  });
  return { id };
}

export function deleteRole(db: DB, id: string, actorId?: string) {
  return tx(db, () => {
    const role = db.prepare('SELECT id, name, is_system FROM roles WHERE id = ?').get(id) as
      | { id: string; name: string; is_system: number }
      | undefined;
    if (!role) throw new Error('Role not found');
    // Guard: system roles are built-in and cannot be deleted.
    if (role.is_system) {
      throw new Error('Cannot delete a built-in system role.');
    }
    // Guard: a role still assigned to users cannot be deleted.
    const assigned = db.prepare('SELECT COUNT(*) c FROM users WHERE role_id = ?').get(id) as { c: number };
    if (assigned.c > 0) {
      throw new Error(`Cannot delete: ${assigned.c} user(s) are assigned to this role.`);
    }
    db.prepare('DELETE FROM roles WHERE id = ?').run(id);
    logActivity(db, { by: actorId, action: 'deleted', entity: 'role', entityId: id, entityRef: role.name, message: `Deleted role ${role.name}` });
    return { id };
  });
}

// ============================================================
//  B. Generic key-value preferences (settings_kv)
// ============================================================

/** Read a single KV preference. Returns the parsed JSON value, or null if absent. */
export function getSetting(db: DB, key: string): unknown {
  const row = db.prepare('SELECT value FROM settings_kv WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

/** Upsert a single KV preference (value is JSON.stringify'd). */
export function setSetting(db: DB, key: string, value: unknown) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO settings_kv (key, value, updated_at) VALUES (@key, @value, @now)
     ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = @now`,
  ).run({ key, value: JSON.stringify(value ?? null), now });
  return { key };
}

/** One-shot hydrate: every KV pair, parsed, as a plain object keyed by name. */
export function getAllSettings(db: DB): Record<string, unknown> {
  const rows = db.prepare('SELECT key, value FROM settings_kv').all() as { key: string; value: string }[];
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = null;
    }
  }
  return out;
}
