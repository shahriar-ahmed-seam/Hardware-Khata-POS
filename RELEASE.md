# Hardware Khata POS — Releasing & Updating

**Current version: 0.4.0** · Windows x64 · NSIS installer, per-user (no admin needed)
Installer: `release/HardwareKhataPOS-Setup-0.4.0.exe` (~82 MB)

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
#    package.json → "version": "0.4.0"

# 2. prove it still works
npm run backend:verify:all          # 999 checks, seven suites
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

- Schema is at **v6**; migrations run automatically on launch and are additive.
  **0.4.0 adds no migration at all**, so upgrading to it cannot touch your data.
- Backups: Settings → Backup & Cloud writes verified `VACUUM INTO` snapshots
  (`pos-backup-YYYYMMDD-HHMMSS.sqlite3`) and keeps the newest N (default 14).
  Point the folder at OneDrive/Drive/Dropbox and the copy leaves the shop.
- **Pendrive copy:** the dashboard has a *Backup to Pendrive* button, plus a card
  in Settings → Backup. That is the copy that survives a stolen or dead PC.

---

## 2a. What's in 0.4.0

> **Upgrading is enough — do NOT reinstall.** There is **no schema change** in
> this release, so `%APPDATA%\pos\pos.db` is untouched: every product, customer,
> sale, purchase, balance and photo stays exactly as it is. Settings → Updates →
> Download, then Restart and install.

**The average purchase price now actually moves when you buy.** This was the
reported bug. Recording a purchase wrote the product's buying price with a direct
column write, and *only* if you also typed a new selling price on that line. So
buying the same item at a higher price changed nothing at all — and even when it
did fire, it skipped the price-history table that the average is calculated from,
so the average never budged. Every received purchase line is now recorded in the
price history, and both the current and the average buying price are recalculated
from it.
**Note:** this applies to purchases recorded from 0.4.0 onward. Purchases you
entered before this were never written into the price history, so the average will
start moving from your next purchase — it cannot be back-filled from data that was
never captured.

**Buttons that did nothing, now working.** Print and Re-print on a sale, on the
sales list, on a purchase and on the purchases list had no action attached at all.
They now show the stored invoice (or the goods received note for a purchase) ready
to print or save as PDF — the original document, with its original date, not a
re-creation. Export writes the CSV. "Add new product" on the New Purchase screen
works. Two "Open full page" links that led to a Not Found page are gone.

**Paid / Partial / Due filters were only searching the page you were looking at.**
On a shop with history, clicking "Due" searched the newest 50 invoices and told you
"No sales match" while unpaid invoices sat further back — and the totals disagreed
with the rows on screen. They now search the whole book.

**Custom date range was dropping its last day.** Choosing 1st to 10th reported
nine days. Fixed, and the range now starts and ends on your clock rather than UTC.

**Add a category, brand, customer or product without losing what you were typing.**
A `+` beside Category and Brand on the product form, a `+` beside Customer on the
sale form, and "Add new product" on both the purchase and sale screens. Everything
is saved for good and selected straight away. A product added from a purchase has
its opening stock locked to 0 on purpose — the quantity arrives on the purchase
line, and entering it twice would double your stock.

**You can change a selling price in the POS cart.** For that sale only: the
product's price in your catalogue does not change, and the typed price survives a
price-group switch and an app restart. An Undo puts it back.

**The screen lock now appears when it locks.** It was locking correctly — which is
why nothing was clickable — but the window was not repainting, so you only saw the
lock screen after minimising and restoring. The idle timer was also rearmed
wrongly and could leave the shop unlocked for longer than the setting said.

**Roomier purchase and sale screens.** The item table now uses the full width
instead of two-thirds, so a whole line is visible without scrolling sideways; the
summary and order charges moved underneath.

**Voided sales and cancelled purchases are hidden** behind a small "Show voided" /
"Show cancelled" button. Nothing is deleted — they are still there when you ask.

**Dashboard.** The shortcut buttons are a fixed two-row grid, so they no longer
re-flow or slide under the sidebar when the window is narrowed. New panel showing
**who owes you and who you owe**, with phone numbers you can copy. The date line
showed a hard-coded "Tuesday, May 26, 2026 · Mirpur Branch"; it shows today and
your real branch. Several shortcuts opened a list instead of the thing they named.

**Wrong branch names removed.** The expense form offered three branches that do not
exist on your shop, and the Cash Register screen and Z-report printed "Mirpur
Branch" and "Seam" regardless of who was signed in.

Also: customer and supplier phone numbers on unpaid documents, with a Copy button
(a desktop PC usually has nothing to dial `tel:` links with, so copying is the
honest option), and +47 Bangla phrases (2,353 total).

---

## 2b. What's in 0.3.0

**Product photos and the shop logo no longer disappear.** They were being saved
as `URL.createObjectURL(file)` — a `blob:` handle into the *current window's*
memory — and that string went straight into the database. So a photo died on the
next app start, not just on reinstall, and the shop logo printed broken on every
receipt.

Pictures are now shrunk and stored **inside the shop database**, which is exactly
what makes them safe: backups are whole-database snapshots, so every photo is
already carried by the snapshot, pendrive and cloud copies. Nothing extra to sync,
no separate folder, no paths to go stale when the database moves to another PC.

- Product photos are capped at 256 px, the logo at 320 px (~10–20 KB each). That
  is not stinginess: `products.list` returns every column for every product, so
  each stored byte travels over IPC on every catalogue read. 256 px is still
  bigger than the ~170 px POS tile, which is the largest a photo is ever drawn.
- The logo keeps transparency; product photos re-encode to JPEG.
- Writing a `blob:` URL is now **refused** by the backend, so this cannot come
  back through any caller.
- **Schema v6** clears the dead `blob:` values already in an upgraded database.
  They are unrecoverable — the picture was never copied anywhere — so affected
  products fall back to the category placeholder. **Any photo added before 0.3.0
  must be re-added once.** It will then stay for good.

Also in 0.3.0: **More & Settings moved to a gear in the top bar** and opens as
boxes (Reports · All Expenses · Expense Categories · Data & Import · Settings),
so the sidebar only holds what is used during a sale. **POS cart numbers are
positional** — tabs always read Cart 1…N instead of climbing forever. And the
Updates screen no longer reports "nothing published yet" as a red error blaming
the internet.

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

999 checks across seven suites, all green:

| Suite | Checks |
|---|---:|
| `all.ts` | 385 |
| `api.ts` | 209 (150 channels) |
| `run.ts` | 65 |
| `e2e.ts` | 68 |
| `paging.ts` | 91 |
| `backup.ts` | 120 |
| `costing.ts` | 61 |

Plus `npm run i18n:check` — 32 checks, 2,353 Bangla phrases.
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
