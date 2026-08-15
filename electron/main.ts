import { app, BrowserWindow, ipcMain, nativeTheme, shell, screen } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { initDb, closeDb } from './db.ts';
import { registerIpc } from './ipc.ts';
import { initBackupDefaults, startAutoBackup, stopAutoBackup } from './backup.ts';
import { initInvoicePdfDefaults } from './invoicePdf.ts';
import { initUpdater } from './updater.ts';
import { applyPerfFlagsBeforeReady } from './perf.ts';

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

  // Fallback: if not copied, fall back to source path
  if (!fs.existsSync(splashHtml)) {
    splashWindow.loadFile(path.join(process.cwd(), 'electron/splash.html'));
  } else {
    splashWindow.loadFile(splashHtml);
  }

  splashWindow.once('ready-to-show', () => splashWindow?.show());
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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

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

app.whenReady().then(() => {
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
  }
  registerIpc();
  createSplash();
  createWindow();
  // In-app updates. Reads the owner's preference from the database, so it must
  // run after initDb(). Deliberately last and self-contained: initUpdater never
  // throws, because a failing update check must not stop the shop trading.
  initUpdater();
});

app.on('window-all-closed', () => {
  stopAutoBackup();
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
