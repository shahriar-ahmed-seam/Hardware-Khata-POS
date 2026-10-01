/**
 * ============================================================================
 *  THE IPC GATE — what the renderer can and cannot reach
 * ============================================================================
 *
 * `electron/ipc.ts` cannot be loaded here (it imports Electron), so every
 * decision it makes lives in `electron/guard.ts` and is asserted below. Each
 * section is a hole that was open:
 *
 *   - `auth.*` skipped the gate, and `auth.setSecret` set any user's PIN with
 *     nobody signed in;
 *   - `settings.set` wrote any `settings_kv` key, including the first-run latch
 *     and the invoice-number counters;
 *   - the lock screen was an overlay only — writes still went through;
 *   - nothing slowed down PIN guessing.
 *
 * No database is needed; this suite is pure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_CHANNELS } from '../api.ts';
import { openDatabase, migrate } from '../db/connection.ts';
import { seedMaster } from '../seed/master.ts';
import { buildApi } from '../api.ts';
import { getBackupConfig } from '../services/backup.ts';
import { CHANNEL_PERMISSIONS } from '../../electron/permissions.ts';
import {
  ACTOR_FIELDS,
  AttemptThrottle,
  NOT_SIGNED_IN,
  SCREEN_LOCKED,
  SETTINGS_SET_KEYS,
  isAppNavigation,
  isInternalOnlyChannel,
  isPathInside,
  isSafeExternalUrl,
  loginThrottleKey,
  pdfOpenError,
  permissionError,
  settingsSetError,
  stampActor,
  VARIANCE_BLOCKED,
  VARIANCE_OVERRIDE_PERMISSION,
  varianceGateError,
  type GateSession,
} from '../../electron/guard.ts';
import { Suite } from './assert.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');

/** Every .ts/.tsx file under src/, for the source scans. */
function srcFiles(dir = path.join(repo, 'src')): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...srcFiles(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

export function runSecurity() {
  const s = new Suite();

  // ------------------------------------------------------------ auth.* internal
  s.section('auth channels');
  const authChannels = API_CHANNELS.filter((c) => c.startsWith('auth.'));
  s.gt('buildApi still exposes the auth handlers to the main process', authChannels.length, 0);
  s.ok(
    'every auth.* channel is internal-only (renderer cannot call it)',
    authChannels.every(isInternalOnlyChannel),
    authChannels.filter((c) => !isInternalOnlyChannel(c)).join(', '),
  );
  s.ok('auth.setSecret specifically is internal-only', isInternalOnlyChannel('auth.setSecret'));
  s.ok('session.login is not internal-only', !isInternalOnlyChannel('session.login'));
  s.ok('sales.create is not internal-only', !isInternalOnlyChannel('sales.create'));

  const authCallers = srcFiles().filter((f) => /['"`]auth\.[a-zA-Z]+['"`]/.test(fs.readFileSync(f, 'utf8')));
  s.eq(
    'no renderer file names an auth.* channel',
    authCallers.map((f) => path.relative(repo, f)).join(', '),
    '',
  );

  // ----------------------------------------------------- every write is gated
  s.section('gate coverage');
  const READ =
    /^(dashboard|reports)\.|\.(list\w*|get\w*|status|health|usage|costHistory|costInfo|global|openShiftFor|shiftTotals|carriedForward|movements)$/;
  const ungated = API_CHANNELS.filter((c) => !(c in CHANNEL_PERMISSIONS));
  const suspicious = ungated.filter(
    (c) => !READ.test(c) && !isInternalOnlyChannel(c) && !c.startsWith('setup.'),
  );
  s.eq('every ungated buildApi channel is a read, auth.* or setup.*', suspicious.join(', '), '');
  s.ok('settings.set is gated', 'settings.set' in CHANNEL_PERMISSIONS);

  // -------------------------------------------------------- permission gate
  s.section('permission gate');
  const cashier: GateSession = {
    userId: 'u_c',
    roleId: 'role_cashier',
    permissions: new Set(['sales.create']),
    locked: false,
  };
  s.eq('a write with no session is refused', permissionError('sales.create', null), NOT_SIGNED_IN);
  s.eq('an open read with no session is allowed', permissionError('sales.list', null), null);
  s.eq('a write the role holds is allowed', permissionError('sales.create', cashier), null);
  s.eq(
    'a write the role lacks is refused',
    permissionError('sales.void', cashier),
    'Permission denied: sales.void',
  );
  const locked = { ...cashier, locked: true };
  s.eq('a locked session cannot write, even with the permission', permissionError('sales.create', locked), SCREEN_LOCKED);
  s.eq('a locked session can still read', permissionError('sales.list', locked), null);

  // ------------------------------------------------------ settings.set keys
  s.section('settings.set keys');
  for (const k of SETTINGS_SET_KEYS) {
    s.eq(`preference key '${k}' is accepted`, settingsSetError({ key: k, value: {} }), null);
  }
  for (const k of ['setup_complete', 'backup', 'updates', 'seq_sale', 'seq_draft', '', 'constructor']) {
    s.ok(`backend-owned or bogus key '${k}' is refused`, settingsSetError({ key: k, value: true }) !== null);
  }
  s.ok('a missing key is refused', settingsSetError({ value: 1 }) !== null);
  s.ok('a null payload is refused', settingsSetError(null) !== null);

  // Every key the renderer really writes must be on the list, or that
  // preference would silently stop saving.
  const settingsSrc = fs.readFileSync(path.join(repo, 'src/stores/settings.ts'), 'utf8');
  const written = [...settingsSrc.matchAll(/writePref\(\s*['"]([a-zA-Z_]+)['"]/g)].map((m) => m[1]);
  s.gt('found the renderer preference writes', written.length, 0);
  const missing = [...new Set(written)].filter((k) => !SETTINGS_SET_KEYS.has(k));
  s.eq('every key src/stores/settings.ts writes is on the allow-list', missing.join(', '), '');

  // ------------------------------------------------------------- throttle
  s.section('PIN throttle');
  const t = new AttemptThrottle({ freeAttempts: 5, baseLockMs: 30_000, maxLockMs: 15 * 60_000 });
  const k = 'pin:u_admin';
  let now = 1_000_000;
  for (let i = 0; i < 4; i++) t.fail(k, now);
  s.ok('four wrong PINs: still allowed', t.check(k, now).allowed);
  t.fail(k, now);
  s.ok('the fifth wrong PIN starts a wait', !t.check(k, now).allowed);
  s.eq('the first wait is 30 s', t.check(k, now).retryInMs, 30_000);
  now += 30_000;
  s.ok('after the wait, one more attempt is allowed', t.check(k, now).allowed);
  t.fail(k, now);
  s.eq('the next wrong PIN doubles the wait', t.check(k, now).retryInMs, 60_000);
  for (let i = 0; i < 20; i++) t.fail(k, now);
  s.eq('the wait is capped at 15 minutes', t.check(k, now).retryInMs, 15 * 60_000);
  s.ok('another account is unaffected', t.check('pin:u_other', now).allowed);
  t.succeed(k);
  s.ok('a correct PIN clears the record', t.check(k, now).allowed && t.failures(k) === 0);

  s.eq('PIN key is per user', loginThrottleKey({ mode: 'pin', userId: 'u1' }), 'pin:u1');
  s.eq(
    'password key ignores case and spaces',
    loginThrottleKey({ mode: 'password', username: '  Owner ' }),
    loginThrottleKey({ mode: 'password', username: 'owner' }),
  );
  s.ok(
    'PIN and password attempts are counted separately',
    loginThrottleKey({ mode: 'pin', userId: 'owner' }) !==
      loginThrottleKey({ mode: 'password', username: 'owner' }),
  );

  // ----------------------------------------------------- opening a saved PDF
  s.section('invoice.openPdf');
  const pdfDirs = [path.resolve('/shop/Invoices'), path.resolve('/data/pos/Invoices')];
  s.eq('a PDF inside an invoice folder opens', pdfOpenError('/shop/Invoices/INV-1.pdf', pdfDirs), null);
  s.eq('upper-case .PDF opens too', pdfOpenError('/data/pos/Invoices/INV-2.PDF', pdfDirs), null);
  s.ok('a program inside the folder is refused', pdfOpenError('/shop/Invoices/evil.exe', pdfDirs) !== null);
  s.ok('a PDF outside the folders is refused', pdfOpenError('/home/x/other.pdf', pdfDirs) !== null);
  s.ok('.. cannot climb out of the folder', pdfOpenError('/shop/Invoices/../secret.pdf', pdfDirs) !== null);
  s.ok(
    'a sibling folder sharing the prefix is outside',
    pdfOpenError('/shop/Invoices-old/INV-1.pdf', pdfDirs) !== null,
  );
  s.ok('the folder itself is not a file inside it', !isPathInside('/shop/Invoices', pdfDirs));
  s.ok('an empty path is refused', pdfOpenError('', pdfDirs) !== null);
  s.ok('a non-string is refused', pdfOpenError(42, pdfDirs) !== null);

  // --------------------------------------------------------- links and pages
  s.section('links and navigation');
  s.ok('https links go to the browser', isSafeExternalUrl('https://github.com/x'));
  s.ok('mailto links go to the mail client', isSafeExternalUrl('mailto:a@b.c'));
  s.ok('file: URLs are never handed to the OS', !isSafeExternalUrl('file:///C:/Windows/system32/cmd.exe'));
  s.ok('custom protocols are refused', !isSafeExternalUrl('ms-msdt:/id PCWDiagnostic'));
  s.ok('javascript: is refused', !isSafeExternalUrl('javascript:alert(1)'));
  s.ok('garbage is refused', !isSafeExternalUrl('not a url'));

  const prodApp = 'file:///opt/pos/resources/app.asar/dist/index.html#/sales';
  s.ok(
    'production: reloading the app file is allowed',
    isAppNavigation('file:///opt/pos/resources/app.asar/dist/index.html', prodApp),
  );
  s.ok(
    'production: a stray absolute href is blocked',
    !isAppNavigation('file:///settings/sales-agents', prodApp),
  );
  s.ok('production: a dropped file is blocked', !isAppNavigation('file:///home/x/a.pdf', prodApp));
  s.ok('production: a web page is blocked', !isAppNavigation('https://example.com/', prodApp));
  const devApp = 'http://localhost:5173/#/pos';
  s.ok('dev: same origin is allowed', isAppNavigation('http://localhost:5173/', devApp));
  s.ok('dev: another origin is blocked', !isAppNavigation('http://localhost:8080/', devApp));

  // ------------------------------------------------------------ who did it
  s.section('actor stamping');
  const actorChannels = Object.keys(ACTOR_FIELDS);
  s.eq(
    'every stamped channel exists in buildApi',
    actorChannels.filter((c) => !API_CHANNELS.includes(c)).join(', '),
    '',
  );
  s.eq(
    'every stamped channel is gated, so a session always exists to stamp from',
    actorChannels.filter((c) => !(c in CHANNEL_PERMISSIONS)).join(', '),
    '',
  );
  // The TARGET user is `id`; who made the change goes in its own `actorId`.
  s.eq(
    'users.update stamps only actorId, never the target id',
    JSON.stringify(ACTOR_FIELDS['users.update'] ?? []),
    JSON.stringify(['actorId']),
  );
  const target = stampActor('users.update', { id: 'u_target', patch: { name: 'x' } }, 'u_admin') as { id: string; actorId: string };
  s.ok('the edited user stays the edited user', target.id === 'u_target' && target.actorId === 'u_admin');

  const sent = { saleId: 's1', userId: 'Seam', reason: 'x' };
  const stamped = stampActor('sales.void', sent, 'u_cashier') as typeof sent;
  s.eq('the session user replaces what the renderer sent', stamped.userId, 'u_cashier');
  s.eq('other fields are untouched', stamped.saleId, 's1');
  s.eq('the original payload is not mutated', sent.userId, 'Seam');

  const upd = { saleId: 's1', input: { userId: 'u_admin', lines: [1] } };
  const updStamped = stampActor('sales.update', upd, 'u_mgr') as typeof upd;
  s.eq('a nested actor field is stamped', updStamped.input.userId, 'u_mgr');
  s.eq('the nested original is not mutated', upd.input.userId, 'u_admin');
  s.ok('nested siblings survive', updStamped.input.lines.length === 1);

  const noInput = stampActor('sales.update', { saleId: 's1' }, 'u_mgr') as Record<string, unknown>;
  s.ok('a missing nested object is left missing', !('input' in noInput));
  s.eq(
    'createdBy is stamped on transfers',
    (stampActor('transfers.create', { createdBy: 'Seam' }, 'u_x') as { createdBy: string }).createdBy,
    'u_x',
  );
  s.eq('a channel with no actor field passes through', stampActor('sales.list', sent, 'u_x'), sent);
  s.eq('a non-object payload passes through', stampActor('sales.void', 'abc', 'u_x'), 'abc');

  // ---------------------------------------------- closing a shift that is out
  s.section('variance gate');
  const cashierPerms = new Set(['cash.closeShift']);
  const ownerPerms = new Set(['cash.closeShift', VARIANCE_OVERRIDE_PERMISSION]);
  const prefs = { varianceBlock: 1000, requireManagerPinOnVariance: true };
  s.eq('a small variance closes for a cashier', varianceGateError({ variance: -50, prefs, permissions: cashierPerms }), null);
  s.eq(
    'at the limit a cashier is stopped',
    varianceGateError({ variance: -1000, prefs, permissions: cashierPerms }),
    VARIANCE_BLOCKED,
  );
  s.eq('an over-count is stopped too', varianceGateError({ variance: 1500, prefs, permissions: cashierPerms }), VARIANCE_BLOCKED);
  s.eq('the owner or a manager can close it', varianceGateError({ variance: -5000, prefs, permissions: ownerPerms }), null);
  s.eq(
    'with approval switched off, nobody is stopped',
    varianceGateError({ variance: -5000, prefs: { ...prefs, requireManagerPinOnVariance: false }, permissions: cashierPerms }),
    null,
  );
  s.eq(
    'the limit the owner set is the one used',
    varianceGateError({ variance: -300, prefs: { varianceBlock: 250 }, permissions: cashierPerms }),
    VARIANCE_BLOCKED,
  );
  s.eq(
    'with no saved preference, the default limit (1000) applies',
    varianceGateError({ variance: -999, prefs: null, permissions: cashierPerms }),
    null,
  );
  // The approver permission must be one the seeded owner and manager hold and
  // a cashier does not — otherwise the gate would stop the wrong people.
  {
    const db = openDatabase(':memory:');
    migrate(db);
    seedMaster(db, { referenceOnly: true });
    const perms = (id: string) =>
      JSON.parse(
        (db.prepare('SELECT permissions FROM roles WHERE id = ?').get(id) as { permissions: string } | undefined)
          ?.permissions ?? '[]',
      ) as string[];
    s.ok('the seeded owner can approve a large variance', perms('role_admin').includes(VARIANCE_OVERRIDE_PERMISSION));
    s.ok('the seeded manager can approve it', perms('role_manager').includes(VARIANCE_OVERRIDE_PERMISSION));
    s.ok('the seeded cashier cannot', !perms('role_cashier').includes(VARIANCE_OVERRIDE_PERMISSION));
    db.close();
  }

  // ------------------------------------------- what backup.configure can change
  s.section('backup.configure');
  {
    const db = openDatabase(':memory:');
    migrate(db);
    seedMaster(db, { referenceOnly: true });
    const api = buildApi();
    api['backup.configure'](db, { folder: '/shop/Backups' }); // not how a folder is set…
    const before = getBackupConfig(db);
    const after = api['backup.configure'](db, {
      auto: 'off',
      keep: 30,
      folder: '/tmp/somewhere-else',
      lastBackupAt: '2099-01-01T00:00:00.000Z',
      lastError: 'x',
    }) as { auto: string; keep: number; folder: string; lastBackupAt?: string; lastError?: string };
    s.eq('the schedule can be changed', after.auto, 'off');
    s.eq('the keep count can be changed', after.keep, 30);
    s.eq('the folder cannot be redirected this way', after.folder, before.folder);
    s.eq('lastBackupAt cannot be forged (it would stop the daily backup)', after.lastBackupAt, before.lastBackupAt);
    s.eq('lastError cannot be written', after.lastError, before.lastError);
    db.close();
  }

  const rep = s.report();
  const label = 'SECURITY (IPC gate)';
  console.log(`${label}: ${rep.passed}/${rep.total} checks`);
  if (rep.failed > 0) {
    console.log(`\n${rep.failed} FAILURES:`);
    for (const f of rep.failures) console.log(`   - ${f.name}: ${f.detail ?? ''}`);
  } else {
    console.log('ALL SECURITY CHECKS PASSED');
  }
  return rep;
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('verify/security.ts');
if (isMain) {
  const r = runSecurity();
  process.exit(r.failed > 0 ? 1 : 0);
}
