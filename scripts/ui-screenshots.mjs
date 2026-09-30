#!/usr/bin/env node
/**
 * UI SCREENSHOTS — every screen of the app, on a throwaway demo database.
 *
 * For UI/UX review work. It starts a SECOND Electron instance with its own user
 * data folder (so the real `~/.config/pos/pos.db` is never touched), seeds it
 * with the demo year (`POS_SEED=demo`), finishes first-run setup through the
 * real `setup.complete` channel, then visits every route and saves a PNG.
 *
 * Needs the renderer served — `npm run build` then `npx vite preview --port 4173`
 * (preview does not start a second Electron) — or the dev server, with
 * VITE_DEV_SERVER_URL pointing at it; and the native module on the Electron ABI
 * (`npm run rebuild:electron`).
 *
 *   node scripts/ui-screenshots.mjs [outDir] [--size=1366x768] [--lang=en|bn]
 *        [--theme=dark|light] [--only=/pos,/sales] [--probe] [--scale=1|1.15|1.3|1.45]
 *
 * Output: <outDir>/<nn>-<route>.png (default outDir: /tmp/hk-ui-shots).
 * `--probe` also writes <outDir>/probe.json: per route, whether the page scrolls
 * sideways, controls pushed past the window edge, and buttons/labels whose text
 * spills out of their box — the usual breakage after a size or language change.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const outDir = path.resolve(args.find((a) => !a.startsWith('--')) ?? '/tmp/hk-ui-shots');
const [width, height] = opt('size', '1366x768').split('x').map(Number);
const lang = opt('lang', 'en');
const theme = opt('theme', 'dark');
const only = opt('only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const probe = args.includes('--probe');
// Text size (Settings → Appearance / titlebar A− A+): 1, 1.15, 1.3 or 1.45.
// Written to the demo database on every run so results are reproducible.
const scale = Number(opt('scale', '1'));
const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:4173';
const port = 9333;
const dataDir = path.join(os.tmpdir(), 'hk-ui-userdata');
const homeDir = path.join(os.tmpdir(), 'hk-ui-home');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(homeDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ electron
const electronBin = path.resolve('node_modules/.bin/electron');
// --no-sandbox: Ubuntu's AppArmor setup refuses Electron's SUID sandbox helper
// (the same flag the dev run and the AppImage launcher use on Linux).
const child = spawn(electronBin, ['.', '--no-sandbox', `--user-data-dir=${dataDir}`, `--remote-debugging-port=${port}`], {
  // HOME is a throwaway folder too: the app writes its daily backup and invoice
  // PDFs under Documents/, and a demo snapshot must never land in (or prune!)
  // the real backup folder.
  env: { ...process.env, HOME: homeDir, VITE_DEV_SERVER_URL: devUrl, POS_SEED: 'demo' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (d) => process.stdout.write(`[electron] ${d}`));
child.stderr.on('data', (d) => {
  const s = String(d);
  if (!/gl_surface|GetVSyncParameters|dbus|Fontconfig/.test(s)) process.stderr.write(`[electron] ${s}`);
});
const stop = () => {
  try {
    child.kill('SIGTERM');
  } catch {
    /* already gone */
  }
};
process.on('exit', stop);

async function pageTarget() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.url.startsWith(devUrl));
      if (page) return page;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error('The app window never appeared on the debugging port.');
}

// ----------------------------------------------------------------------- cdp
const target = await pageTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.onopen = r;
  ws.onerror = j;
});
let seq = 0;
const waiting = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && waiting.has(msg.id)) {
    const { resolve, reject } = waiting.get(msg.id);
    waiting.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate failed');
  return r.result.value;
};
const invoke = (channel, payload) =>
  evaluate(`window.api.db.invoke(${JSON.stringify(channel)}, ${JSON.stringify(payload ?? null)})`);

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

// Wait for the renderer + the demo seed (a year of sales takes a few seconds).
for (let i = 0; i < 120; i++) {
  const ready = await evaluate('!!(window.api && window.api.db)').catch(() => false);
  if (ready) break;
  await sleep(500);
}

// ------------------------------------------------------------ setup + sign in
const status = await invoke('setup.status');
if (!status?.data?.complete) {
  const r = await invoke('setup.complete', {
    shop: { name: 'Demo Hardware', tagline: 'Built for the shop floor', phonePrimary: '01711-000001', address: 'Mirpur 10, Dhaka', currencySymbol: '৳' },
    branch: { name: 'Main Branch', address: 'Mirpur 10, Dhaka' },
    admin: { name: 'Owner', username: 'owner', pin: '1234' },
    printer: null,
    cloud: false,
  });
  if (!r?.ok) throw new Error(`setup.complete failed: ${r?.error}`);
} else {
  // Same payload the login screen sends (src/stores/auth.ts → electron/ipc.ts).
  const users = await invoke('users.list', {});
  const owner = (users?.data ?? []).find((u) => u.username === 'owner');
  if (!owner) throw new Error('No "owner" account in the demo database.');
  const r = await invoke('session.login', { mode: 'pin', userId: owner.id, secret: '1234' });
  if (!r?.ok) throw new Error(`session.login failed: ${r?.error}`);
}
// Never shoot the login screen by accident: the main process must hold a session.
const who = await invoke('session.current');
if (!who?.data?.user) throw new Error('Not signed in after setup/login — refusing to take screenshots.');

// Preferences the review wants (language/theme) live in the renderer's persisted stores.
// The language lives in the renderer's persisted `pos-lang` store (src/lib/i18n.ts).
await evaluate(
  `(localStorage.setItem('pos-lang', JSON.stringify({ state: { lang: ${JSON.stringify(lang)} }, version: 0 })), true)`,
);
{
  const cur = await invoke('settings.get', { key: 'appearance' });
  const appearance = { themeMode: 'dark', accentHue: 243, density: 'comfortable', ...(cur?.data ?? {}), fontScale: scale };
  const r = await invoke('settings.set', { key: 'appearance', value: appearance });
  if (!r?.ok) throw new Error(`could not set the text size: ${r?.error}`);
}
await send('Page.reload');
await sleep(4000);

const setLangTheme = `(() => {
  const html = document.documentElement;
  html.classList.toggle('dark', ${JSON.stringify(theme)} === 'dark');
  return true;
})()`;
await evaluate(setLangTheme);

// ---------------------------------------------------------------- the routes
const firstId = async (channel, payload = {}) => {
  const r = await invoke(channel, payload);
  const rows = Array.isArray(r?.data) ? r.data : r?.data?.rows ?? [];
  return rows[0]?.id;
};
const productId = await firstId('products.list');
const saleId = await firstId('sales.listPage', { page: 1, pageSize: 5, statuses: ['final'] });
const purchaseId = await firstId('purchases.list');

const routes = [
  '/dashboard',
  '/pos',
  '/sales',
  '/sales/new',
  saleId && `/sales/${saleId}/edit`,
  '/sales/drafts',
  '/sales/quotations',
  '/sales/returns',
  '/sales/shipments',
  '/purchases',
  '/purchases/new',
  purchaseId && `/purchases/${purchaseId}/edit`,
  '/purchases/returns',
  '/products',
  '/products/new',
  productId && `/products/${productId}`,
  '/products/categories',
  '/products/brands',
  '/products/units',
  '/products/barcodes',
  '/products/price-update',
  '/products/price-groups',
  '/products/warranties',
  '/stock',
  '/stock/alerts',
  '/stock/transfers',
  '/stock/transfers/new',
  '/stock/adjustments',
  '/stock/adjustments/new',
  '/contacts/customers',
  '/contacts/customers/cu2',
  '/contacts/suppliers',
  '/contacts/suppliers/sp1',
  '/contacts/customer-groups',
  '/contacts/dues',
  '/expenses',
  '/expenses/categories',
  '/import',
  '/cash-register',
  '/cash-register/report',
  '/reports',
  '/reports/profit-loss',
  '/reports/activity-log',
  '/reports/product-sell',
  '/reports/sell-payment',
  '/reports/trending',
  '/reports/sales-rep',
  '/reports/customer-group',
  '/reports/product-purchase',
  '/reports/purchase-payment',
  '/reports/tax',
  '/reports/stock',
  '/reports/stock-alert',
  '/reports/stock-adjustment',
  '/reports/stock-transfers',
  '/reports/contacts',
  '/reports/items',
  '/settings',
  '/settings/business',
  '/settings/branches',
  '/settings/tax-rates',
  '/settings/invoice-schemes',
  '/settings/receipt-template',
  '/settings/barcode',
  '/settings/printers',
  '/settings/appearance',
  '/settings/pos',
  '/settings/cash-register',
  '/settings/shortcuts',
  '/settings/users',
  '/settings/roles',
  '/settings/sales-agents',
  '/settings/backup',
  '/settings/updates',
  '/settings/performance',
].filter(Boolean);

const wanted = only.length ? routes.filter((r) => only.some((o) => r === o || r.startsWith(o + '/'))) : routes;
const slug = (r) => r.replace(/^\//, '').replace(/[/:]+/g, '_') || 'root';

// Layout probe (--probe). Runs in the page; reports only things that are wrong
// on sight: sideways page scroll, controls beyond the window's right edge (not
// inside a deliberately scrolling box), and button/label text wider or taller
// than its box (ellipsis truncation is deliberate and skipped).
const PROBE = `(() => {
  const vw = window.innerWidth;
  const main = document.querySelector('main');
  const txt = (el) => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || '').replace(/\\s+/g, ' ').trim().slice(0, 60);
  const cls = (el) => String(typeof el.className === 'string' ? el.className : '').slice(0, 100);
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return null;
    return r;
  };
  const clippedByAncestor = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p === main) return false;
      const o = getComputedStyle(p).overflowX;
      if (o !== 'visible') return true;
    }
    return false;
  };
  // No <main> means the app shell is not up (login / lock screen): say so
  // instead of reporting a clean page.
  if (!main) return { error: 'app shell not shown (login or lock screen?)' };
  const out = { pageOverflowX: Math.max(0, main.scrollWidth - main.clientWidth), sticksOut: [], spills: [] };
  const sel = 'button, a, input, select, textarea, label, [role="radio"], [role="switch"], [role="tab"], td, th, h1, h2, h3, p, span';
  for (const el of document.querySelectorAll(sel)) {
    const r = shown(el);
    if (!r) continue;
    if (r.right > vw + 1 && !clippedByAncestor(el) && out.sticksOut.length < 8)
      out.sticksOut.push({ tag: el.tagName.toLowerCase(), text: txt(el), right: Math.round(r.right), cls: cls(el) });
    if (/^(BUTTON|A|LABEL)$/.test(el.tagName) || el.getAttribute('role')) {
      if (el.clientWidth === 0 || getComputedStyle(el).textOverflow === 'ellipsis') continue;
      const dx = el.scrollWidth - el.clientWidth;
      const dy = el.scrollHeight - el.clientHeight;
      if ((dx > 2 || dy > 3) && out.spills.length < 12)
        out.spills.push({ tag: el.tagName.toLowerCase(), text: txt(el), w: el.clientWidth, sw: el.scrollWidth, h: el.clientHeight, sh: el.scrollHeight, cls: cls(el) });
    }
  }
  return out;
})()`;
const findings = [];

if (probe) {
  // Self-test: plant one control wider than the window and one button whose
  // text spills out of its box; the probe must report both or the run stops.
  await evaluate(`(location.hash = '#/dashboard', true)`);
  await sleep(2500);
  const selfTest = await evaluate(`(() => {
    const main = document.querySelector('main');
    if (!main) return { error: 'no app shell' };
    const box = document.createElement('div');
    box.id = '__probe_selftest';
    box.innerHTML = '<button style="width:40px;height:20px;white-space:nowrap;overflow:hidden">A very long spilling label</button>'
      + '<input style="position:relative;left:3000px;width:100px" placeholder="probe-far-right">';
    main.prepend(box);
    const r = ${PROBE};
    box.remove();
    return r;
  })()`);
  const caughtSpill = selfTest?.spills?.some((s) => s.text.includes('spilling'));
  const caughtWide = (selfTest?.pageOverflowX ?? 0) > 0;
  if (!caughtSpill || !caughtWide) {
    throw new Error(`Probe self-test failed: ${JSON.stringify({ caughtSpill, caughtWide, selfTest })}`);
  }
  console.log('probe self-test: ok (planted spill and sideways overflow both caught)');
}

let n = 0;
for (const route of wanted) {
  n += 1;
  await evaluate(`(location.hash = ${JSON.stringify('#' + route)}, true)`);
  await sleep(route.startsWith('/reports') || route === '/dashboard' ? 3500 : 2200);
  await evaluate(setLangTheme);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(outDir, `${String(n).padStart(2, '0')}-${slug(route)}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log(`saved ${file}`);
  if (probe) {
    const f = await evaluate(PROBE).catch((e) => ({ error: String(e) }));
    findings.push({ route, ...f });
  }
}

if (probe) {
  fs.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(findings, null, 2));
  const bad = findings.filter((f) => f.error || f.pageOverflowX > 0 || f.sticksOut?.length || f.spills?.length);
  console.log(`probe: ${bad.length} of ${findings.length} routes with findings → ${path.join(outDir, 'probe.json')}`);
}

ws.close();
stop();
console.log(`\n${n} screens in ${outDir} (${width}x${height}, ${theme}, ${lang})`);
process.exit(0);
