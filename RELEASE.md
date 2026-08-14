# Hardware Khata POS — Releasing & Updating

**Current version: 0.2.0** · Windows x64 · NSIS installer, per-user (no admin needed)
Installer: `release/HardwareKhataPOS-Setup-0.2.0.exe` (~82 MB)

---

## 1. How updating works now

From 0.2.0 onward **the app updates itself**. No copying installers between PCs.

```
you: npm run release:win
        │
        ├── builds the app + installer
        └── uploads installer + latest.yml to a GitHub Release
                                │
shop PC: opens the app ─────────┘
        ├── checks GitHub a few seconds after launch
        ├── tells the owner "Version X is available"
        └── they press Download, then Restart and install
```

- **Where it looks:** GitHub Releases of
  `shahriar-ahmed-seam/Hardware-Khata-POS`. The repo is **public**, so the app
  carries no token and needs no login.
- **What decides "newer":** the `version` in `package.json`, compared against
  `latest.yml` in the newest published release. **Bump the version or nothing
  updates.**
- **Never automatic:** the app downloads only when the owner presses the button
  (their internet is unreliable and may be metered, and swapping the binary
  mid-sale is not acceptable). Auto-*check* can be switched off in
  Settings → Updates, after which the app makes no network request at all.
- **The only outbound request in the whole product.** It sends nothing about the
  shop — no sales, customers, names or telemetry.
- Code: `electron/updater.ts` (main), `src/stores/updates.ts` +
  `src/pages/settings/UpdatesPage.tsx` (UI). Version pinned to
  **electron-updater 6.x** — v7 needs Node ≥ 22 and would break Electron 22,
  which is the last version that supports Windows 7.

### Publishing a new version

```powershell
# 1. bump the version (this is what clients compare against)
#    package.json → "version": "0.3.0"

# 2. prove it still works
npm run backend:verify:all          # 962 checks, seven suites
npx tsc --noEmit -p tsconfig.json
npm run i18n:check
npm run rebuild:electron            # leave the native module on the Electron ABI

# 3. build AND upload
$env:GH_TOKEN = gh auth token
npm run release:win
```

Then open the release on GitHub and **publish** it (electron-builder uploads it
as a draft). Draft releases are invisible to clients, so a half-uploaded
installer is never offered to the shop.

`npm run build:win` builds the installer **without** uploading (`--publish never`).

### If in-app update ever fails
Settings → Updates has an **Open downloads page** button, and the installer can
always be run by hand — it upgrades in place and never touches the database.

---

## 2. Where the shop's data lives

`%APPDATA%\pos\pos.db` — **outside** the install folder, so installing,
upgrading and uninstalling never touch it.

- Schema is at **v5**; migrations run automatically on launch and are additive.
- Backups: Settings → Backup & Cloud writes verified `VACUUM INTO` snapshots
  (`pos-backup-YYYYMMDD-HHMMSS.sqlite3`) and keeps the newest N (default 14).
  Point the folder at OneDrive/Drive/Dropbox and the copy leaves the shop.
- **Pendrive copy:** the dashboard has a *Backup to Pendrive* button, plus a card
  in Settings → Backup. That is the copy that survives a stolen or dead PC.

---

## 3. What's in 0.2.0

- **Fixed:** text boxes across the app could stop accepting the cursor. Cause was
  the native browser dialogs (`confirm`/`alert`/`prompt`) losing the window's
  keyboard focus on Windows; all 24 call sites replaced.
- **Sale editing.** A finalized invoice can be corrected in place, keeping its
  invoice number. Reverses the original stock and cash and re-applies the
  corrected figures in one transaction. A reason is required and recorded.
  **Admin only.**
- **Product archiving.** A product that has been sold can't be deleted (that
  would rewrite history), so it is archived instead — gone from the catalogue and
  the POS, past invoices intact, reversible. Delete still works for never-traded
  products.
- **Roles enforced in the UI.** Staff no longer see Edit/Void/Delete or the
  owner-only settings screens.
- **POS:** each cart line shows buying / average buying / selling price,
  colour-coded. Product list view puts brand under the code and keeps
  price/stock visible when the divider is dragged narrow.
- **In-app updates** and a **Performance** screen (see below).
- **SMS removed** from the menu — it had no backend, so every figure it showed
  was invented.

### Performance work (for the slow Windows 7 PC)
- Removed `backdrop-blur` from the always-visible titlebar — it forced continuous
  GPU compositing of the whole window, every frame.
- Startup JavaScript cut from ~1,688 KB to ~1,128 KB: reports, settings screens
  and the chart widgets now load on demand, so the charting library is no longer
  parsed before the dashboard can appear.
- The dashboard's 30-second auto-refresh pauses while the window is hidden.
- **Settings → Performance** adds two opt-in switches (both default OFF, stored
  per computer): *turn off graphics acceleration* — often smoother and more
  stable on old Intel graphics drivers, needs a restart — and *reduce
  animations*, which takes effect immediately.

---

## 4. Verification

962 checks across seven suites, all green:

| Suite | Checks |
|---|---:|
| `all.ts` | 378 |
| `api.ts` | 209 (150 channels) |
| `run.ts` | 56 |
| `e2e.ts` | 68 |
| `paging.ts` | 80 |
| `backup.ts` | 120 |
| `costing.ts` | 51 |

Plus `npm run i18n:check` — 32 checks, 2,290 Bangla phrases.
`npm run lint` does **not** work (eslint is not installed); `tsc` is the gate.

---

## 5. Stack

- React 18 · TypeScript · Vite · Tailwind · Zustand · TanStack Query
- Electron **22** — deliberately: the last release supporting **Windows 7**
- better-sqlite3 (SQLite 3, FTS5 search)
- electron-builder (NSIS) + electron-updater 6.x

> **Native module ABI:** the verify suites need a **Node** build of
> better-sqlite3, the app needs an **Electron** one. Always finish a session with
> `npm run rebuild:electron`. A running app locks the `.node` file, so close the
> app before rebuilding.

---

## 6. Not implemented

- **Code signing** — installers are unsigned, so Windows SmartScreen warns on a
  new PC ("More info" → "Run anyway"). Needs a bought certificate.
- Thermal/ESC-POS direct printing and cash-drawer kick.
- Live multi-device sync (backups cover off-machine safety).
- Multi-branch writes assume the single default branch.
- SMS sending (needs a Bangladeshi gateway account).

---

## 7. Docs

`docs/` — `00-OVERVIEW` · `01-FRONTEND` · `02-BACKEND` · `03-WHATS-LEFT` ·
`04-AGENT-HANDOFF` · `05-CONTEXT-AND-HISTORY` · `06-E2E-AND-SMOKE-TEST` ·
`07-CONTINUE-HERE` (start here) · **`08-FRONTEND-MAP`** (which file draws what)

Repo: https://github.com/shahriar-ahmed-seam/Hardware-Khata-POS
