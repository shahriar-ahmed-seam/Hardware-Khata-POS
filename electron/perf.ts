import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

/**
 * PERFORMANCE FLAGS FOR OLD HARDWARE
 * ==================================
 *
 * The shop's second PC is a low-end Windows 7 machine. Two knobs make a real
 * difference there, and BOTH have to be decided before Electron creates a
 * renderer — `app.disableHardwareAcceleration()` throws if called after the app
 * is ready. That is why these live in a small JSON file next to the database
 * instead of in `settings_kv`: the database is opened inside `app.whenReady()`,
 * which is already too late.
 *
 * DEFAULTS ARE "CHANGE NOTHING".
 * Both flags default to false, so an existing install behaves exactly as it did
 * before this file existed. They are opt-in switches the owner can try when a
 * particular machine misbehaves, not a guess applied to everyone.
 *
 * WHY DISABLING GPU ACCELERATION HELPS A WEAK MACHINE
 * Chromium composites the window on the GPU. On old Intel integrated graphics
 * with the original Windows 7 drivers that path is frequently both slower than
 * software rendering AND unstable — it is the usual explanation for a machine
 * that stutters and occasionally takes the whole system down, because a
 * renderer bug cannot blue-screen Windows but a graphics driver can. Turning it
 * off costs a little CPU on animations and buys stability.
 */

export interface PerfFlags {
  /** Render on the CPU instead of the GPU. Needs a restart. */
  disableHardwareAcceleration: boolean;
  /**
   * Strip UI animations and transitions. Applied by the renderer as a class on
   * <html>, so it takes effect immediately and needs no restart.
   */
  reduceAnimations: boolean;
}

const DEFAULTS: PerfFlags = {
  disableHardwareAcceleration: false,
  reduceAnimations: false,
};

/**
 * `app.getPath('userData')` is available BEFORE the ready event, which is the
 * whole reason this works.
 */
function perfFilePath(): string {
  return path.join(app.getPath('userData'), 'perf.json');
}

export function readPerfFlags(): PerfFlags {
  try {
    const raw = fs.readFileSync(perfFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      disableHardwareAcceleration: parsed.disableHardwareAcceleration === true,
      reduceAnimations: parsed.reduceAnimations === true,
    };
  } catch {
    // Missing or corrupt file → defaults. A perf preference is never worth
    // failing a launch over.
    return { ...DEFAULTS };
  }
}

export function writePerfFlags(patch: Partial<PerfFlags>): PerfFlags {
  const next: PerfFlags = { ...readPerfFlags(), ...patch };
  try {
    fs.mkdirSync(path.dirname(perfFilePath()), { recursive: true });
    fs.writeFileSync(perfFilePath(), JSON.stringify(next, null, 2), 'utf8');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[perf] could not save flags:', e);
  }
  return readPerfFlags();
}

/**
 * MUST be called at the very top of main.ts, at module scope — before
 * `app.whenReady()`. Calling `disableHardwareAcceleration()` after the app is
 * ready throws, and switching it on a running renderer is not possible at all.
 */
export function applyPerfFlagsBeforeReady(): PerfFlags {
  const flags = readPerfFlags();
  try {
    if (flags.disableHardwareAcceleration) {
      app.disableHardwareAcceleration();
      // eslint-disable-next-line no-console
      console.log('[perf] hardware acceleration disabled by preference');
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[perf] could not apply flags:', e);
  }
  return flags;
}
