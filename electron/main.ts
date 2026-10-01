import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell, screen } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { initDb, closeDb } from './db.ts';
import { registerIpc } from './ipc.ts';
import { isAppNavigation, isSafeExternalUrl } from './guard.ts';
import { initBackupDefaults, startAutoBackup, stopAutoBackup } from './backup.ts';
import { initInvoicePdfDefaults } from './invoicePdf.ts';
import { initUpdater } from './updater.ts';
import { applyPerfFlagsBeforeReady } from './perf.ts';
import { initLog, logFolder } from './log.ts';

// The log file first, so everything after it — including a failure to start —
// is written down (electron/log.ts). A packaged Windows build has no console.
initLog();

/**
 * NOTHING FAILS SILENTLY IN THE MAIN PROCESS (R72). An error nobody caught used
 * to go to a console that does not exist in the installed app. It is logged,
 * and the app keeps the till open: every database write is its own
 * transaction, so a stray error in one request cannot leave half a sale.
 */
process.on('uncaughtException', (err) => {
  console.error('[crash] uncaught exception in the main process:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[crash] unhandled promise rejection in the main process:', reason);
});

// MODULE SCOPE, ON PURPOSE. `app.disableHardwareAcceleration()` throws once the
// app is ready, so the owner's performance preference has to be read and applied
// before anything else happens — including before the database is opened, which
// is why the flags live in their own JSON file. See electron/perf.ts.
applyPerfFlagsBeforeReady();

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

// ---------- Single Instance Lock ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ---------- Window State Persistence ----------
type WinState = { x?: number; y?: number; width: number; height: number; maximized?: boolean };
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState(): WinState {
  const defaults: WinState = { width: 1440, height: 920 };
  try {
    if (fs.existsSync(stateFile())) {
      const data = JSON.parse(fs.readFileSync(stateFile(), 'utf-8')) as WinState;
      // sanity-check against current display bounds
      const display = screen.getPrimaryDisplay().workArea;
      if (
        typeof data.x === 'number' &&
        typeof data.y === 'number' &&
        data.x >= display.x - 50 &&
        data.y >= display.y - 50 &&
        data.x + data.width <= display.x + display.width + 50 &&
        data.y + data.height <= display.y + display.height + 50
      ) {
        return data;
      }
      return { ...defaults, maximized: data.maximized };
    }
  } catch {}
  return defaults;
}

function saveWindowState() {
  if (!mainWindow) return;
  const isMax = mainWindow.isMaximized();
  const bounds = mainWindow.getBounds();
  const state: WinState = isMax
    ? { ...(loadWindowState()), maximized: true }
    : { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, maximized: false };
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(state));
  } catch {}
}

// ---------- Splash ----------
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // Splash html lives in electron/ in dev, dist-electron/ in prod
  const splashHtml = isDev
    ? path.join(__dirname, '../electron/splash.html')
    : path.join(__dirname, 'splash.html');

  // The page reads its version from the query string (it used to say v0.1.0
  // whatever was installed).
  const query = { v: app.getVersion() };
  // Fallback: if not copied, fall back to source path
  if (!fs.existsSync(splashHtml)) {
    splashWindow.loadFile(path.join(process.cwd(), 'electron/splash.html'), { query });
  } else {
    splashWindow.loadFile(splashHtml, { query });
  }

  splashWindow.once('ready-to-show', () => splashWindow?.show());
}

/**
 * The window's own icon, for Linux (the taskbar and Alt+Tab under X11, and any
 * dev run). Windows takes the icon from the .exe, so it is left alone there.
 * build/icon.png is packed into the app by electron-builder.json `files`.
 */
function windowIcon(): string | undefined {
  if (process.platform === 'win32') return undefined;
  const file = path.join(__dirname, '../build/icon.png');
  return fs.existsSync(file) ? file : undefined;
}

// ---------- Main Window ----------
function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    // Lowered from 1100×700: the shell is now responsive (sidebar auto-collapses
    // below lg and becomes an overlay below md, POS stacks its two panels), so
    // the app stays usable on a small counter monitor or a resized window.
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0b0d10',
    icon: windowIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (state.maximized) mainWindow.maximize();

  // Track minimum splash duration so users see the brand briefly
  const startedAt = Date.now();
  const MIN_SPLASH_MS = 1600;

  const showMainAndCloseSplash = () => {
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
    setTimeout(() => {
      mainWindow?.show();
      splashWindow?.close();
      splashWindow = null;
    }, wait);
  };

  mainWindow.once('ready-to-show', showMainAndCloseSplash);

  // The always-on-top splash only ever closed on `ready-to-show`. If the page
  // failed to load (the dev server on another port, a missing dist/) it sat on
  // top of everything for good. Show the window anyway so the failure is seen.
  let shown = false;
  mainWindow.once('show', () => {
    shown = true;
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    // eslint-disable-next-line no-console
    console.error(`[window] failed to load ${url}: ${desc} (${code})`);
    if (!shown) showMainAndCloseSplash();
  });
  setTimeout(() => {
    if (!shown) showMainAndCloseSplash();
  }, 20_000).unref?.();

  if (isDev) {
    // vite-plugin-electron sets this to wherever Vite actually started — 5173
    // is only the first choice, and Vite moves on if the port is taken.
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // New windows never open inside the app. A web link goes to the system
  // browser, and only if it is an ordinary web or mail link — the renderer's
  // URL used to be passed to the OS unchecked.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // The router is a HashRouter, so screens never navigate the page. A real
  // navigation (a stray <a href>, a file or link dropped on the window) would
  // replace the app with that page while the preload bridge stayed attached.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appUrl = mainWindow?.webContents.getURL() ?? '';
    if (isAppNavigation(url, appUrl)) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
  });
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());

  /**
   * THE SCREEN STOPPED (R72): the renderer crashed or was killed (out of memory
   * on an old PC, a GPU driver fault). The window used to stay blank. It is
   * reloaded — the sign-in lives in this process and carts are saved, so the
   * cashier carries on — and if it keeps happening the owner is told where the
   * log is instead of the app looping.
   */
  const crashes: number[] = [];
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error(`[window] the screen stopped: ${details.reason} (exit code ${details.exitCode})`);
    if (details.reason === 'clean-exit' || !mainWindow || mainWindow.isDestroyed()) return;
    const now = Date.now();
    while (crashes.length && now - crashes[0] > 60_000) crashes.shift();
    crashes.push(now);
    if (crashes.length <= 2) {
      mainWindow.webContents.reload();
      return;
    }
    void dialog
      .showMessageBox(mainWindow, {
        type: 'error',
        title: 'The screen keeps stopping',
        message: 'The app screen stopped several times. Sales that were saved are safe.',
        detail: `The log file is in:\n${logFolder()}`,
        buttons: ['Try again', 'Close the app'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0 && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
        else app.quit();
      });
  });
  mainWindow.on('unresponsive', () => console.warn('[window] the screen is not responding'));
  mainWindow.on('responsive', () => console.warn('[window] the screen is responding again'));

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false));

  mainWindow.on('close', saveWindowState);
}

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:toggleMaximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

/**
 * FORCE A FULL REPAINT OF THE WINDOW.
 *
 * The reported symptom: after the idle timeout the app stopped responding to
 * clicks but the lock screen was NOT on screen; minimising and restoring the
 * window revealed it. That is a compositing bug, not a React one. The lock screen
 * really had mounted (which is why clicks went nowhere: it covers everything),
 * but nothing new was painted, so the stale frame stayed on the glass.
 *
 * It happens because the DOM change came from a timer after minutes of no input
 * at all. Chromium had nothing to draw for a long time, and on Windows the frame
 * it eventually produces can be dropped; minimise/restore forces the OS to
 * invalidate the window, which is exactly what fixes it — so we do that
 * deliberately instead of leaving the shopkeeper to discover the trick.
 *
 * `webContents.invalidate()` schedules a full repaint of the window the contents
 * are in. It is cheap, and it is only called when locking.
 */
ipcMain.handle('window:repaint', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  try {
    // A window the user has minimised is a normal case (the lock fired while they
    // were away); restoring it would yank focus off whatever they are using now.
    // Left alone deliberately — the repaint below still applies when they return.
    mainWindow.webContents.invalidate();
    return true;
  } catch {
    // Older Electron builds may not expose invalidate(). The renderer has its own
    // fallback nudge, so a failure here is not fatal.
    return false;
  }
});

ipcMain.handle('theme:set', (_e, mode: 'light' | 'dark' | 'system') => {
  nativeTheme.themeSource = mode;
  return nativeTheme.shouldUseDarkColors;
});
ipcMain.handle('theme:get', () => ({
  source: nativeTheme.themeSource,
  dark: nativeTheme.shouldUseDarkColors,
}));

// Only the instance holding the lock goes any further. `app.quit()` above is
// asynchronous, so the losing instance used to reach `whenReady` too — opening
// the SAME database, running its migrations and starting a second backup timer
// alongside the running app.
if (gotLock) app.whenReady().then(() => {
  // DB + IPC must be ready before the renderer can call the backend.
  try {
    const info = initDb();
    // eslint-disable-next-line no-console
    console.log(`[db] ready (firstRun=${info.firstRun}, seed=${info.mode})`);
    // Backups need a folder before they can run. Resolve the default
    // (Documents/HardwareKhataPOS/Backups) once, without overwriting a folder
    // the owner has already chosen, then start the daily check.
    initBackupDefaults();
    initInvoicePdfDefaults();
    startAutoBackup();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[db] init failed:', e);
    /**
     * Say so, and stop. This used to be a console line only: the window opened
     * anyway and every screen failed with "Database not initialized", which looks
     * like the shop's data is gone. Nothing has been changed on disk.
     */
    const detail = e instanceof Error ? e.message : String(e);
    dialog.showErrorBox(
      'The shop database could not be opened',
      `Nothing has been changed. Close other copies of the app and try again.\n\n${detail}` +
        (isDev ? '\n\nIn development this is usually the native module ABI: run npm run rebuild:electron.' : ''),
    );
    app.exit(1);
    return;
  }
  registerIpc();
  // The window is frameless, so the default menu is never SEEN — but its
  // shortcuts still work: Ctrl+Shift+I opened DevTools (a console straight into
  // the IPC bridge) and Ctrl+R reloaded mid-sale. The app draws its own
  // controls and handles its own keys; in development the menu stays for
  // debugging. Copy/paste in text fields is Chromium's, not the menu's.
  if (!isDev) Menu.setApplicationMenu(null);
  createSplash();
  createWindow();
  // In-app updates. Reads the owner's preference from the database, so it must
  // run after initDb(). Deliberately last and self-contained: initUpdater never
  // throws, because a failing update check must not stop the shop trading.
  initUpdater();
}).catch((e) => {
  // Starting up failed after the database opened (a window that could not be
  // created, …). This used to be an unhandled rejection and a silent exit.
  console.error('[app] could not start:', e);
  dialog.showErrorBox(
    'The app could not start',
    `${e instanceof Error ? e.message : String(e)}\n\nThe log file is in:\n${logFolder()}`,
  );
  app.exit(1);
});

// A helper process that died (the GPU process on an old graphics driver, …).
app.on('child-process-gone', (_e, details) => {
  console.error(`[app] a helper process stopped: ${details.type} ${details.reason} (exit code ${details.exitCode})`);
});

app.on('window-all-closed', () => {
  stopAutoBackup();
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});

// Every other way out (an update's quit-and-install, a quit from the OS, a
// signal) closes the database too. It was only closed when the last window
// closed. closeDb is idempotent.
app.on('will-quit', () => {
  stopAutoBackup();
  closeDb();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
