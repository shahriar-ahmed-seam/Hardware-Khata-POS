import { app, BrowserWindow, shell } from 'electron';
import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { getSetting, setSetting } from '../backend/services/settings.ts';
import { getDb } from './db.ts';

/**
 * IN-APP UPDATES
 * ==============
 *
 * The shop has ONE counter PC and the owner is not going to copy an installer
 * from a pen drive every time something is fixed. So the app checks GitHub
 * Releases for a newer version and installs it in place.
 *
 * HOW IT WORKS
 * `electron-builder` publishes the NSIS installer plus a `latest.yml` manifest to
 * a GitHub Release. `electron-updater` reads that manifest, compares versions,
 * downloads the installer and runs it. The repo is PUBLIC, so no token is
 * embedded in the app and nothing has to be authenticated.
 *
 * THIS IS THE ONLY OUTBOUND REQUEST THE APP MAKES.
 * Everything else in this product is deliberately offline — see
 * backend/services/backup.ts. The update check contacts
 * `api.github.com` / `objects.githubusercontent.com` and sends nothing about the
 * shop: no data, no telemetry, no identifiers. It is also switchable OFF
 * (Settings → Updates), and when off nothing is ever contacted.
 *
 * WHY autoDownload IS FALSE
 * The shop's internet is unreliable and may be metered. Silently pulling ~85 MB
 * in the middle of a trading day is not acceptable, and an update that swaps the
 * binary under a half-finished sale is worse. So: check quietly, TELL the owner,
 * and let them press Download and then Restart when the counter is free.
 *
 * VERSION 6.x IS PINNED ON PURPOSE
 * electron-updater 7 migrated to native ESM and requires Node >= 22.12. This app
 * runs Electron 22 (Node 16) because that is the last Electron with Windows 7
 * support, which the owner's second PC needs. Do not "upgrade" it.
 */

/** settings_kv key for the update preferences. */
const UPDATE_KEY = 'updates';

export interface UpdatePrefs {
  /** Check GitHub shortly after launch. When false, NOTHING is contacted. */
  autoCheck: boolean;
}

const DEFAULT_PREFS: UpdatePrefs = { autoCheck: true };

export function getUpdatePrefs(): UpdatePrefs {
  try {
    const raw = (getSetting(getDb(), UPDATE_KEY) ?? {}) as Record<string, unknown>;
    return { autoCheck: raw.autoCheck !== false };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setUpdatePrefs(patch: Partial<UpdatePrefs>): UpdatePrefs {
  const next = { ...getUpdatePrefs(), ...patch };
  try {
    setSetting(getDb(), UPDATE_KEY, next);
  } catch {
    // Non-fatal — the preference simply won't persist.
  }
  return getUpdatePrefs();
}

/** Everything the Updates screen needs to render, in one shape. */
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error'
  | 'unsupported';

/**
 * WHY a failure needs a kind, not just a message.
 *
 * "No published versions on GitHub" is not a fault: it is the honest answer
 * whenever the newest build has not been released yet, and telling the owner to
 * check their internet in that case sends them chasing a problem that does not
 * exist. The UI needs to tell those two cases apart.
 */
export type UpdateErrorKind = 'no-releases' | 'network' | 'other';

export interface UpdateState {
  phase: UpdatePhase;
  currentVersion: string;
  /** Version found on GitHub, when there is one. */
  newVersion?: string;
  releaseNotes?: string;
  releaseDate?: string;
  /** 0..100 while downloading. */
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  error?: string;
  errorKind?: UpdateErrorKind;
  /** When the last successful check finished. */
  lastCheckedAt?: string;
  autoCheck: boolean;
}

/** Classify an updater failure so the UI can explain it truthfully. */
function classify(message: string): UpdateErrorKind {
  const m = message.toLowerCase();
  if (m.includes('no published versions')) return 'no-releases';
  if (
    m.includes('enotfound') ||
    m.includes('econnrefused') ||
    m.includes('etimedout') ||
    m.includes('econnreset') ||
    m.includes('getaddrinfo') ||
    m.includes('net::') ||
    m.includes('socket')
  ) {
    return 'network';
  }
  return 'other';
}

let state: UpdateState = {
  phase: 'idle',
  currentVersion: app.getVersion(),
  autoCheck: true,
};

/** Broadcast to every open window so the Updates screen is always live. */
function publish(patch: Partial<UpdateState>): void {
  state = { ...state, ...patch, autoCheck: getUpdatePrefs().autoCheck };
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:state', state);
  }
}

export function updateState(): UpdateState {
  return { ...state, autoCheck: getUpdatePrefs().autoCheck, currentVersion: app.getVersion() };
}

/**
 * True when this build can actually update itself.
 *
 * A dev run (`npm run dev`) has no `app-update.yml` beside it, and
 * electron-updater throws in that case. Reporting 'unsupported' up front is
 * honest; letting it throw would look like a broken update server.
 */
function canUpdate(): boolean {
  return app.isPackaged;
}

let wired = false;

function wire(): void {
  if (wired) return;
  wired = true;

  // We drive the download ourselves — see the note at the top.
  autoUpdater.autoDownload = false;
  // If an update was downloaded and the owner just closes the app instead of
  // pressing Restart, install it on quit rather than throwing the work away.
  autoUpdater.autoInstallOnAppQuit = true;
  // electron-updater's own logging is noisy; route it to the console we already
  // read in packaged runs and nothing else.
  autoUpdater.logger = {
    info: (m: unknown) => console.log('[update]', m),
    warn: (m: unknown) => console.warn('[update]', m),
    error: (m: unknown) => console.error('[update]', m),
    debug: () => {},
  };

  autoUpdater.on('checking-for-update', () => publish({ phase: 'checking', error: undefined }));

  autoUpdater.on('update-available', (info: UpdateInfo) =>
    publish({
      phase: 'available',
      newVersion: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      releaseDate: info.releaseDate,
      lastCheckedAt: new Date().toISOString(),
      error: undefined,
    }),
  );

  autoUpdater.on('update-not-available', () =>
    publish({
      phase: 'up-to-date',
      newVersion: undefined,
      lastCheckedAt: new Date().toISOString(),
      error: undefined,
    }),
  );

  autoUpdater.on('download-progress', (p) =>
    publish({
      phase: 'downloading',
      percent: Math.round(p.percent),
      bytesPerSecond: p.bytesPerSecond,
      transferred: p.transferred,
      total: p.total,
    }),
  );

  autoUpdater.on('update-downloaded', (info: UpdateInfo) =>
    publish({ phase: 'downloaded', newVersion: info.version, percent: 100 }),
  );

  autoUpdater.on('error', (err: Error) => {
    // The raw error is often a stack or a bare status code; keep the message.
    const message = err?.message ? err.message : String(err);
    publish({ phase: 'error', error: message, errorKind: classify(message) });
  });
}

/**
 * Check GitHub for a newer version.
 *
 * `silent` is used for the automatic check at launch: a failure there must not
 * put a red error on the owner's dashboard, because the usual cause is simply
 * that the shop's internet is down — which is the normal state of affairs and
 * not something they need to act on.
 */
export async function checkForUpdates(opts: { silent?: boolean } = {}): Promise<UpdateState> {
  if (!canUpdate()) {
    publish({ phase: 'unsupported' });
    return updateState();
  }
  wire();
  try {
    await autoUpdater.checkForUpdates();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (opts.silent) {
      // Leave the phase alone; just record that the check did not get through.
      console.warn('[update] background check failed:', message);
      publish({ phase: 'idle' });
    } else {
      publish({ phase: 'error', error: message, errorKind: classify(message) });
    }
  }
  return updateState();
}

/** Download the update the owner has been told about. */
export async function downloadUpdate(): Promise<UpdateState> {
  if (!canUpdate()) {
    publish({ phase: 'unsupported' });
    return updateState();
  }
  wire();
  try {
    publish({ phase: 'downloading', percent: 0, error: undefined });
    await autoUpdater.downloadUpdate();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    publish({ phase: 'error', error: message, errorKind: classify(message) });
  }
  return updateState();
}

/**
 * Close the app and run the downloaded installer.
 *
 * `isSilent: false` deliberately: the NSIS installer is NOT code signed, so
 * Windows may show a prompt. Hiding the installer UI would leave the owner
 * staring at a closed app with no idea whether anything is happening.
 */
export function quitAndInstall(): { ok: boolean; error?: string } {
  if (!canUpdate()) return { ok: false, error: 'Updates only work in the installed app.' };
  if (state.phase !== 'downloaded') {
    return { ok: false, error: 'No update has been downloaded yet.' };
  }
  try {
    // Give the DB a chance to close cleanly; the quit handlers in main.ts do the
    // rest (stopAutoBackup + closeDb).
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Open the Releases page — the manual escape hatch when updating fails. */
export async function openReleasesPage(): Promise<void> {
  await shell.openExternal('https://github.com/shahriar-ahmed-seam/Hardware-Khata-POS/releases');
}

/**
 * Called once from `app.whenReady()`. Never throws: a broken updater must not
 * stop the shop from opening its till.
 */
export function initUpdater(): void {
  try {
    state = { ...state, currentVersion: app.getVersion(), autoCheck: getUpdatePrefs().autoCheck };
    if (!canUpdate()) {
      state.phase = 'unsupported';
      return;
    }
    if (!getUpdatePrefs().autoCheck) return;
    // Delayed: the first seconds after launch belong to painting the UI and
    // opening the database, not to a network round-trip.
    setTimeout(() => void checkForUpdates({ silent: true }), 12_000);
  } catch (e) {
    console.error('[update] init failed:', e);
  }
}
