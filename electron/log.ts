import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { format } from 'node:util';

/**
 * THE APP'S LOG FILE (R72).
 *
 * Every diagnostic used to go to `console`, and a packaged Windows build has no
 * console: when something failed at the shop there was nothing to read
 * afterwards. Everything the main process prints now also lands in
 * `<logs>/main.log` (`app.getPath('logs')`, on Windows
 * `%APPDATA%\Hardware Khata POS\logs`), with the time and the level.
 *
 * The file is written synchronously, a line at a time, so the last thing that
 * happened before a crash is on disk. It rotates at 1 MB and keeps three older
 * files (main.1.log … main.3.log), so it can never fill the disk of an old PC.
 */

const MAX_BYTES = 1024 * 1024;
const KEEP = 3;

let file: string | null = null;
let bytes = 0;
let installed = false;

export function logFolder(): string {
  try {
    return app.getPath('logs');
  } catch {
    // Some builds only resolve 'logs' after setAppLogsPath; userData always works.
    return path.join(app.getPath('userData'), 'logs');
  }
}

function rotate(): void {
  if (!file) return;
  try {
    for (let i = KEEP - 1; i >= 1; i--) {
      const from = `${file.slice(0, -4)}.${i}.log`;
      const to = `${file.slice(0, -4)}.${i + 1}.log`;
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }
    if (fs.existsSync(file)) fs.renameSync(file, `${file.slice(0, -4)}.1.log`);
  } catch {
    /* a locked file is not worth stopping for; keep appending */
  }
  bytes = 0;
}

/** Append one line. Never throws: logging must not be what breaks the app. */
export function writeLog(level: 'info' | 'warn' | 'error', ...args: unknown[]): void {
  if (!file) return;
  try {
    const line = `${new Date().toISOString()} [${level}] ${format(...args)}\n`;
    if (bytes + line.length > MAX_BYTES) rotate();
    fs.appendFileSync(file, line, 'utf-8');
    bytes += Buffer.byteLength(line);
  } catch {
    /* the disk said no; the console still has it */
  }
}

/**
 * Open the log and send `console.log/warn/error` to it as well. Called first
 * thing in main.ts; `app.getPath('logs')` works before the app is ready.
 */
export function initLog(): void {
  if (installed) return;
  installed = true;
  try {
    const dir = logFolder();
    fs.mkdirSync(dir, { recursive: true });
    file = path.join(dir, 'main.log');
    bytes = fs.existsSync(file) ? fs.statSync(file).size : 0;
  } catch {
    file = null;
    return;
  }
  const original = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...a: unknown[]) => {
    original.log(...a);
    writeLog('info', ...a);
  };
  console.warn = (...a: unknown[]) => {
    original.warn(...a);
    writeLog('warn', ...a);
  };
  console.error = (...a: unknown[]) => {
    original.error(...a);
    writeLog('error', ...a);
  };
  writeLog('info', `---- Hardware Khata POS ${app.getVersion()} starting (${process.platform} ${process.arch}, Electron ${process.versions.electron}) ----`);
}
