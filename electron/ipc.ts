import { ipcMain } from 'electron';
import { buildApi, API_CHANNELS } from '../backend/api.ts';
import { CHANNEL_PERMISSIONS } from './permissions.ts';
import { getDb } from './db.ts';
import {
  applyFolder,
  applyPdfFolder,
  backupFolderOptions,
  backupToUsb,
  chooseBackupFolder,
  listUsbDrives,
  onShiftClosed,
  restoreFromSnapshot,
  revealBackupFolder,
} from './backup.ts';
import {
  listArchivedInvoices,
  openPdf,
  revealPdfFolder,
  saveInvoicePdf,
} from './invoicePdf.ts';
import {
  checkForUpdates,
  downloadUpdate,
  openReleasesPage,
  quitAndInstall,
  setUpdatePrefs,
  updateState,
} from './updater.ts';
import { readPerfFlags, writePerfFlags, type PerfFlags } from './perf.ts';

const api = buildApi();

/**
 * Backup channels handled in THIS file rather than by buildApi(), because each
 * needs a native dialog, Explorer, or an app relaunch. See electron/backup.ts.
 */
const ELECTRON_BACKUP_CHANNELS = new Set([
  'backup.folderOptions',
  'backup.chooseFolder',
  'backup.setFolder',
  'backup.setPdfFolder',
  'backup.reveal',
  'backup.revealPdfFolder',
  'backup.restore',
  // Removable media. Detecting whether a drive is a pendrive needs Windows
  // (WMI via PowerShell), so it cannot live in buildApi() either.
  'backup.usbDrives',
  'backup.toUsb',
]);

/**
 * Invoice → PDF. Also Electron-only: rendering the PDF needs Chromium's
 * `printToPDF`, and opening a file needs the shell.
 */
const ELECTRON_INVOICE_CHANNELS = new Set([
  'invoice.savePdf',
  'invoice.listPdfs',
  'invoice.openPdf',
]);

/**
 * In-app updates. Electron-only by nature: this talks to GitHub Releases,
 * downloads an installer and relaunches the app. See electron/updater.ts.
 */
const ELECTRON_UPDATE_CHANNELS = new Set([
  'update.state',
  'update.check',
  'update.download',
  'update.install',
  'update.setPrefs',
  'update.openReleases',
]);

/**
 * Performance flags for old hardware. Electron-only because they are decided
 * before the app is ready and live outside the database — see electron/perf.ts.
 */
const ELECTRON_PERF_CHANNELS = new Set(['perf.get', 'perf.set']);

/**
 * SESSION + PERMISSION ENFORCEMENT (the IPC boundary)
 *
 * This is the ONLY place permissions are enforced. The backend services and
 * buildApi() stay enforcement-free so the Node verify harness can call handlers
 * directly (it never goes through IPC) — that keeps the 382-check baseline intact.
 *
 * The session lives in MAIN-PROCESS memory. The renderer cannot read or spoof it
 * per-call: it can only ask to log in (verified against bcrypt hashes by the
 * backend auth service) and then every subsequent `api:invoke` is gated here
 * against the permissions resolved from the user's role at login time.
 *
 * Session is intentionally NOT persisted: it resets when the app process exits,
 * so after a real restart the user must sign in again. That is the secure
 * behavior — the renderer's persisted "setupComplete / autoLockMinutes" are UI
 * conveniences only and never grant access here.
 *
 * MANUAL VERIFICATION (Electron-only; not reachable from the Node harness):
 *   1. Boot the app (seed=demo). Default demo login is u_admin (Admin =
 *      ALL_PERMISSIONS) → every write succeeds.
 *   2. Sign in as a cashier (e.g. Rana / 1111). Attempting an admin-only write
 *      such as `users.create` or `products.delete` returns
 *      { ok:false, error:'Permission denied: settings.users' } and the write
 *      never reaches the handler.
 *   3. Reads (products.list, dashboard.*, reports.*) succeed for any signed-in
 *      user, and even before login (so the app can boot and render).
 *   4. Writes before any login return { ok:false, error:'Not signed in …' }.
 */

interface Session {
  userId: string;
  roleId: string;
  permissions: Set<string>;
}

// Module-level session — main-process memory only. Null until the renderer logs in.
let session: Session | null = null;

interface SanitizedSessionUser {
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

/** Shape returned to the renderer for session.* channels. */
function currentSessionPayload(user: SanitizedSessionUser | null) {
  if (!session || !user) return null;
  return { user, permissions: [...session.permissions] };
}

/** Whether the channel is a mutating/write channel (i.e. it is gated). */
function isWriteChannel(channel: string): boolean {
  return channel in CHANNEL_PERMISSIONS;
}

/**
 * Decide whether `channel` may run given the current session.
 * Returns null when allowed, or an error string when denied.
 * (auth.* / session.* are handled before this is ever called.)
 */
function permissionError(channel: string): string | null {
  const required = CHANNEL_PERMISSIONS[channel];
  if (!required) {
    // Not in the map → OPEN read. Allowed even with no session so the app can
    // boot and render data before the renderer wires up login.
    return null;
  }
  // A write channel: there must be a session, and it must hold the permission.
  if (!session) {
    return 'Not signed in — please sign in to perform this action.';
  }
  if (!session.permissions.has(required)) {
    return `Permission denied: ${required}`;
  }
  return null;
}

export function registerIpc(): void {
  ipcMain.handle('api:invoke', (_e, channel: string, payload: unknown) => {
    // ---- 1. Session-control channels (handled BEFORE the buildApi lookup) ----
    // These bypass the permission gate themselves — they are how a user signs in.
    if (channel === 'session.login') {
      return handleLogin(payload);
    }
    if (channel === 'session.logout') {
      session = null;
      return { ok: true, data: null };
    }
    if (channel === 'session.current') {
      if (!session) return { ok: true, data: null };
      const user = readSessionUser(session.userId);
      return { ok: true, data: currentSessionPayload(user) };
    }
    if (channel === 'session.unlock') {
      return handleUnlock(payload);
    }

    // ---- 1b. First-run SETUP channels (the ONE bootstrap exception) ----
    // The First-Run Wizard runs BEFORE any login, so its writes cannot go
    // through the normal gated channels (there is no session yet → they'd be
    // denied with "Not signed in"). `setup.complete` is therefore allowed
    // PRE-SESSION, but ONLY while setup has not yet completed. It is SELF-
    // DISABLING: once the run-once latch is set, the channel is refused here and
    // the backend handler also throws — so it can never be replayed to escalate
    // privileges. On success it establishes the owner session in main memory
    // (same shape as session.login) so every subsequent write is authorized.
    if (channel === 'setup.status') {
      return handleSetupStatus();
    }
    if (channel === 'setup.complete') {
      return handleSetupComplete(payload);
    }

    // ---- 1c. Backup channels that CANNOT live in buildApi() ----
    // These need a native dialog, Explorer, or an app relaunch, so they are not
    // callable from the Node verify harness and therefore stay out of
    // backend/api.ts. They ARE still permission-gated: each is listed in
    // CHANNEL_PERMISSIONS under 'settings.backup', and we run the same gate
    // explicitly here because this block short-circuits the generic lookup.
    if (channel.startsWith('backup.') && ELECTRON_BACKUP_CHANNELS.has(channel)) {
      const denied = permissionError(channel);
      if (denied) return { ok: false, error: denied };
      return handleElectronBackup(channel, payload);
    }

    if (channel.startsWith('invoice.') && ELECTRON_INVOICE_CHANNELS.has(channel)) {
      const denied = permissionError(channel);
      if (denied) return { ok: false, error: denied };
      return handleElectronInvoice(channel, payload);
    }

    if (channel.startsWith('update.') && ELECTRON_UPDATE_CHANNELS.has(channel)) {
      const denied = permissionError(channel);
      if (denied) return { ok: false, error: denied };
      return handleElectronUpdate(channel, payload);
    }

    if (channel.startsWith('perf.') && ELECTRON_PERF_CHANNELS.has(channel)) {
      const denied = permissionError(channel);
      if (denied) return { ok: false, error: denied };
      if (channel === 'perf.get') return { ok: true, data: readPerfFlags() };
      return {
        ok: true,
        data: writePerfFlags((payload ?? {}) as Partial<PerfFlags>),
      };
    }

    // ---- 2. Generic backend channels (gated) ----
    const handler = api[channel];
    if (!handler) {
      return { ok: false, error: `Unknown API channel: ${channel}` };
    }

    // auth.* channels are always allowed (credential verification helpers). They
    // never appear in CHANNEL_PERMISSIONS, so this is mostly documentation, but
    // we keep it explicit so future auth.* additions are never accidentally gated.
    if (!channel.startsWith('auth.')) {
      const denied = permissionError(channel);
      if (denied) {
        // Return a structured error (do NOT throw) so the renderer can toast it.
        return { ok: false, error: denied };
      }
    }

    try {
      const data = handler(getDb(), payload);

      // Automatic backup trigger. A shift close is the end of the trading day,
      // so it is the recommended moment to capture a snapshot. Done HERE rather
      // than in the cash service so the backend stays free of scheduling/IO
      // policy, and so it cannot fire inside the verify harness.
      if (channel === 'cash.closeShift') onShiftClosed();

      return { ok: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error(`[ipc] ${channel} failed:`, message);
      return { ok: false, error: message };
    }
  });

  // expose the channel list for debugging / renderer validation
  ipcMain.handle('api:channels', () => API_CHANNELS);
}

// ---------- session helpers ----------

interface AuthResult {
  ok: boolean;
  error?: string;
  user?: SanitizedSessionUser;
  permissions?: string[];
}

/** session.login → verify via the backend auth handler, then set the session. */
function handleLogin(payload: unknown) {
  try {
    const result = api['auth.authenticate'](getDb(), payload) as AuthResult;
    if (!result.ok || !result.user) {
      return { ok: false, error: result.error ?? 'Login failed' };
    }
    session = {
      userId: result.user.id,
      roleId: result.user.role_id,
      permissions: new Set(result.permissions ?? []),
    };
    return { ok: true, data: { user: result.user, permissions: result.permissions ?? [] } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/** session.unlock → verify the current session user's PIN (no session change). */
function handleUnlock(payload: unknown) {
  if (!session) return { ok: false, error: 'No active session' };
  const pin = (payload as { pin?: string } | undefined)?.pin ?? '';
  try {
    const okPin = api['auth.verifyPin'](getDb(), { userId: session.userId, pin }) as boolean;
    if (!okPin) return { ok: false, error: 'Incorrect PIN' };
    return { ok: true, data: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

interface SetupCompleteResult {
  ok: true;
  adminUserId: string;
  user: SanitizedSessionUser;
  permissions: string[];
}

/** setup.status → always allowed; reports the run-once latch from the kv flag. */
function handleSetupStatus() {
  try {
    const data = api['setup.status'](getDb(), undefined) as { complete: boolean };
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * setup.complete → the single, run-once bootstrap write-through.
 *
 * Allowed PRE-SESSION only while setup has not completed. If setup is already
 * complete AND there is no admin session, refuse (the channel is self-disabling
 * and must never be replayable for privilege escalation). On success, establish
 * the owner session in main-process memory from the returned adminUserId +
 * permissions — identical to session.login — so subsequent writes are authorized
 * as the owner.
 */
function handleSetupComplete(payload: unknown) {
  try {
    // Refuse a replay: if setup is already done and no admin is signed in, this
    // is not a legitimate first-run. (When an admin IS signed in, the backend
    // handler still throws 'Setup already completed', so nothing is re-written.)
    const status = api['setup.status'](getDb(), undefined) as { complete: boolean };
    if (status.complete && !session) {
      return { ok: false, error: 'Setup already completed' };
    }

    const result = api['setup.complete'](getDb(), payload) as SetupCompleteResult;

    // Establish the owner session (same shape as session.login).
    session = {
      userId: result.adminUserId,
      roleId: result.user.role_id,
      permissions: new Set(result.permissions ?? []),
    };
    return { ok: true, data: { user: result.user, permissions: result.permissions ?? [] } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ---------- backup helpers (Electron-only channels) ----------

/**
 * Dispatch the backup channels that need Electron. Returns the same
 * `{ ok, data } | { ok:false, error }` envelope as every other channel, so the
 * renderer's `api()` client needs no special case.
 *
 * `chooseFolder` and `restore` open native dialogs, so they resolve
 * asynchronously; `ipcMain.handle` forwards the promise transparently.
 */
async function handleElectronBackup(channel: string, payload: unknown) {
  try {
    switch (channel) {
      case 'backup.folderOptions':
        return { ok: true, data: backupFolderOptions() };

      case 'backup.chooseFolder': {
        const p = payload as { folder?: string; target?: 'backup' | 'pdf' } | undefined;
        return { ok: true, data: await chooseBackupFolder(p?.folder, p?.target ?? 'backup') };
      }

      case 'backup.setFolder': {
        const folder = (payload as { folder?: string } | undefined)?.folder;
        if (!folder) return { ok: false, error: 'No folder given' };
        return { ok: true, data: applyFolder(folder) };
      }

      case 'backup.setPdfFolder': {
        const folder = (payload as { folder?: string } | undefined)?.folder;
        if (!folder) return { ok: false, error: 'No folder given' };
        return { ok: true, data: applyPdfFolder(folder) };
      }

      case 'backup.reveal':
        return { ok: true, data: revealBackupFolder() };

      case 'backup.revealPdfFolder':
        return { ok: true, data: revealPdfFolder() };

      case 'backup.restore': {
        const file = (payload as { file?: string } | undefined)?.file;
        return { ok: true, data: await restoreFromSnapshot({ file }) };
      }

      case 'backup.usbDrives':
        return { ok: true, data: await listUsbDrives() };

      case 'backup.toUsb': {
        const drive = (payload as { drive?: string } | undefined)?.drive;
        return { ok: true, data: await backupToUsb(drive) };
      }

      default:
        return { ok: false, error: `Unknown API channel: ${channel}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[ipc] ${channel} failed:`, message);
    return { ok: false, error: message };
  }
}

/**
 * In-app update channels. `update.state` is a plain read so the Updates screen
 * can always render; the three that touch the network, the disk or the running
 * app are gated (see CHANNEL_PERMISSIONS).
 */
async function handleElectronUpdate(channel: string, payload: unknown) {
  try {
    switch (channel) {
      case 'update.state':
        return { ok: true, data: updateState() };

      case 'update.check':
        return { ok: true, data: await checkForUpdates({ silent: false }) };

      case 'update.download':
        return { ok: true, data: await downloadUpdate() };

      case 'update.install':
        return { ok: true, data: quitAndInstall() };

      case 'update.setPrefs': {
        const autoCheck = (payload as { autoCheck?: boolean } | undefined)?.autoCheck;
        const prefs = setUpdatePrefs(
          typeof autoCheck === 'boolean' ? { autoCheck } : {},
        );
        return { ok: true, data: { ...updateState(), autoCheck: prefs.autoCheck } };
      }

      case 'update.openReleases':
        await openReleasesPage();
        return { ok: true, data: null };

      default:
        return { ok: false, error: `Unknown API channel: ${channel}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[ipc] ${channel} failed:`, message);
    return { ok: false, error: message };
  }
}

/**
 * Invoice → PDF channels. Rendering needs Chromium's `printToPDF` and opening a
 * saved file needs the shell, so none of this can live in `buildApi()`.
 */
async function handleElectronInvoice(channel: string, payload: unknown) {
  try {
    switch (channel) {
      case 'invoice.savePdf': {
        const invoiceNo = (payload as { invoiceNo?: string } | undefined)?.invoiceNo;
        return { ok: true, data: await saveInvoicePdf({ invoiceNo }) };
      }

      case 'invoice.listPdfs': {
        const limit = (payload as { limit?: number } | undefined)?.limit;
        return { ok: true, data: listArchivedInvoices(limit) };
      }

      case 'invoice.openPdf': {
        const file = (payload as { file?: string } | undefined)?.file;
        return { ok: true, data: openPdf(file ?? '') };
      }

      default:
        return { ok: false, error: `Unknown API channel: ${channel}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[ipc] ${channel} failed:`, message);
    return { ok: false, error: message };
  }
}

/** Read the sanitized (no-hash) row for the session user, or null. */
function readSessionUser(userId: string): SanitizedSessionUser | null {
  try {
    const row = getDb()
      .prepare(
        'SELECT id, name, username, phone, email, role_id, branch_ids, status, last_login_at FROM users WHERE id = ?',
      )
      .get(userId) as SanitizedSessionUser | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}
