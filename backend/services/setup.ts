import type { DB } from '../db/connection.ts';
import { tx } from '../db/connection.ts';
import { logActivity } from './activity.ts';
import { authenticate, setUserSecret, type SanitizedUser } from './auth.ts';
import {
  updateBusinessInfo,
  updateBranch,
  setDefaultBranch,
  updateTaxRate,
  updateUser,
  setSetting,
  getSetting,
} from './settings.ts';

/**
 * First-run SETUP service — the single, run-once write-through for the
 * First-Run Wizard.
 *
 * WHY THIS EXISTS (the ordering problem):
 *   The First-Run Wizard runs BEFORE any login. Its writes (business info,
 *   branch, admin user) are permission-gated channels, but there is no IPC
 *   session during first-run, so calling those gated channels directly would be
 *   denied ("Not signed in"). Instead the wizard calls ONE dedicated channel —
 *   `setup.complete` — which the IPC layer allows pre-session ONLY while setup
 *   has not yet completed. This module performs ALL first-run writes in a single
 *   transaction and returns the sanitized admin + permissions so the IPC layer
 *   can establish the owner session.
 *
 * RUN-ONCE / SELF-DISABLING:
 *   The `settings_kv` key `setup_complete` is the latch. Once it is `true`,
 *   `completeSetup` THROWS — it can never be replayed as a privilege-escalation
 *   path. The IPC layer reads the same flag to refuse the channel after setup.
 *
 * SEED CONTRACT:
 *   Both 'demo' and 'clean' seeds insert business_info + the default branch
 *   (br_mp) + the owner user (u_admin / role_admin). So first-run CONFIGURES
 *   those seeded rows rather than creating new ones — keeping ids stable.
 *
 * ENFORCEMENT NOTE: like the rest of the backend services, this module is
 * enforcement-free (no Electron, no IPC) so the Node verify harness can call it
 * directly. The pre-session gate lives at the Electron IPC boundary.
 */

/** The seeded owner account + default branch that first-run configures. */
const ADMIN_USER_ID = 'u_admin';
const ADMIN_ROLE_ID = 'role_admin';
const DEFAULT_BRANCH_ID = 'br_mp';

/** The settings_kv latch key. */
const SETUP_COMPLETE_KEY = 'setup_complete';

export interface SetupInput {
  shop: {
    name: string;
    tagline?: string;
    phonePrimary?: string;
    address?: string;
    currencySymbol?: string;
  };
  defaultTaxId?: string;
  branch: {
    name: string;
    address?: string;
  };
  admin: {
    name: string;
    username: string;
    pin: string;
  };
  printer?: { name: string; paperWidth: 50 | 58 | 80 | 210 } | null;
  cloud?: boolean;
}

export interface SetupResult {
  ok: true;
  adminUserId: string;
  user: SanitizedUser;
  permissions: string[];
}

/** Read the run-once latch. Returns true once setup has completed. */
export function isSetupComplete(db: DB): boolean {
  return getSetting(db, SETUP_COMPLETE_KEY) === true;
}

/** Read handler for `setup.status` → whether the wizard has already run. */
export function setupStatus(db: DB): { complete: boolean } {
  return { complete: isSetupComplete(db) };
}

/**
 * Perform ALL first-run writes in a single transaction, then return the
 * sanitized admin + permissions so the caller (IPC layer) can open the session.
 *
 * THROWS 'Setup already completed' if the latch is already set — this is what
 * makes the channel run-once and impossible to replay for escalation.
 */
export function completeSetup(db: DB, input: SetupInput): SetupResult {
  // Guard OUTSIDE the tx first for a fast, clear rejection…
  if (isSetupComplete(db)) {
    throw new Error('Setup already completed');
  }

  return tx(db, () => {
    // …and re-check INSIDE the tx so two racing callers can't both pass.
    if (isSetupComplete(db)) {
      throw new Error('Setup already completed');
    }

    const now = new Date().toISOString();

    // 1) Business info — name/tagline/phone/address/currency + default branch.
    updateBusinessInfo(db, {
      name: input.shop.name,
      tagline: input.shop.tagline,
      phonePrimary: input.shop.phonePrimary,
      address: input.shop.address,
      currencySymbol: input.shop.currencySymbol,
      defaultBranchId: DEFAULT_BRANCH_ID,
      userId: ADMIN_USER_ID,
    });

    // 2) Default branch — reuse the seeded br_mp; set name/address + is_default.
    updateBranch(db, DEFAULT_BRANCH_ID, {
      name: input.branch.name,
      address: input.branch.address,
      isDefault: true,
    });
    // Ensure the single-default invariant (also demotes any other default).
    setDefaultBranch(db, DEFAULT_BRANCH_ID);

    // 3) Default tax rate (optional) — mark chosen one default, clear the rest.
    if (input.defaultTaxId) {
      updateTaxRate(db, input.defaultTaxId, { isDefault: true });
    }

    // 4) Admin user — configure the seeded owner (u_admin) and hash the PIN.
    updateUser(db, ADMIN_USER_ID, {
      name: input.admin.name,
      username: input.admin.username.trim().toLowerCase(),
      status: 'active',
    });
    setUserSecret(db, ADMIN_USER_ID, { pin: input.admin.pin });

    // 5) Printer (optional) — persist a default printer profile in settings_kv
    //    so the Settings slice hydrates it via kv.printers.
    if (input.printer) {
      const profile = {
        id: 'pr_' + Date.now(),
        name: input.printer.name,
        connection: 'USB' as const,
        paperWidth: input.printer.paperWidth,
        encoding: 'UTF-8' as const,
        isDefault: true,
      };
      setSetting(db, 'printers', [profile]);
    }

    // 6) Cloud backup (optional) — persist the backup preference blob.
    if (input.cloud) {
      setSetting(db, 'backup', {
        cloudProvider: 'supabase',
        autoBackup: 'on-shift-close',
        cloudConnected: false,
      });
    }

    // 7) Latch — set the run-once flag LAST so a throw above never marks done.
    setSetting(db, SETUP_COMPLETE_KEY, true);

    logActivity(db, {
      by: ADMIN_USER_ID,
      action: 'edited',
      entity: 'business',
      entityId: '1',
      message: 'Completed first-run setup',
      at: now,
    });

    // Resolve the sanitized admin + permissions by re-using the auth service.
    // Authenticating with the freshly-set PIN both verifies the write AND
    // returns the exact sanitized shape (NO hashes) + resolved role permissions.
    const auth = authenticate(db, { mode: 'pin', userId: ADMIN_USER_ID, secret: input.admin.pin });
    if (!auth.ok || !auth.user) {
      // Should never happen — we just set the PIN. Throw to roll the tx back.
      throw new Error('Setup failed: could not establish the admin session');
    }

    return {
      ok: true as const,
      adminUserId: ADMIN_USER_ID,
      user: auth.user,
      permissions: auth.permissions ?? [],
    };
  });
}

// Re-export the admin role id so callers/tests can reference it without
// reaching into seed internals.
export { ADMIN_ROLE_ID };
