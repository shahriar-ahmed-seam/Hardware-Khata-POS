<div align="center">

# Hardware Khata POS

**An offline-first desktop point-of-sale and lightweight ERP, built for a Bangladeshi hardware shop.**

Runs on the counter PC with no internet, no account and no subscription.
Sells cement, rebar, tools, paint, plumbing, electrical, fasteners and safety gear —
in English or Bangla, in taka, with lakh/crore numbering on the invoice.

[![Windows](https://img.shields.io/badge/Windows-7%20%7C%208%20%7C%2010%20%7C%2011-0078D6?logo=windows&logoColor=white)](#install)
[![Electron](https://img.shields.io/badge/Electron-22-47848F?logo=electron&logoColor=white)](#stack)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](#stack)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](#stack)
[![SQLite](https://img.shields.io/badge/SQLite-local%20file-003B57?logo=sqlite&logoColor=white)](#your-data-stays-yours)
[![Checks](https://img.shields.io/badge/verification-1%2C078%20checks-brightgreen)](#verification)

[Install](#install) · [What it does](#what-it-does) · [Your data](#your-data-stays-yours) · [Build from source](#build-from-source) · [Architecture](#architecture) · [Docs](#documentation)

</div>

---

## Why it exists

A hardware shop cannot stop selling because the internet is down, and it cannot afford a
monthly fee per till. So this is a **desktop application with a local database**: every sale,
purchase, payment and stock movement is written to a SQLite file on the shop's own machine, and
the app never needs a network to work.

The only outbound request it ever makes is an update check against GitHub Releases, which the
owner can switch off. Nothing about the shop — no sales, customers, names, balances or
telemetry — is sent anywhere, ever.

It is built for one real shop and one real shopkeeper: an elderly, Bangla-first owner. That
constraint shaped the whole product. Large touch targets, high-contrast type, the primary
action impossible to miss, expert controls tucked away, and **a figure with no source in the
database renders `—` rather than a guess**.

---

## Install

**Download the latest installer from [Releases](https://github.com/shahriar-ahmed-seam/Hardware-Khata-POS/releases/latest)** —
`HardwareKhataPOS-Setup-x.y.z.exe`, Windows x64.

- **Per-user install, so it needs no administrator rights.**
- The installer is **not code-signed**, so Windows SmartScreen will warn on a new PC.
  Choose *More info* → *Run anyway*.
- Your database lives outside the install folder, so installing, upgrading and uninstalling
  never touch it.

### It updates itself

From 0.2.0 onward the app checks GitHub Releases a few seconds after launch and tells the owner
when a newer version exists. It **downloads only when they press the button** — shop internet is
often metered and unreliable, and swapping the binary mid-sale is not acceptable. Auto-checking
can be turned off entirely in **Settings → Updates**, after which the app makes no network
request at all.

### First run

A short wizard asks for the shop's name, address and phone, creates the owner account with a
PIN, and optionally points backups at a cloud-synced folder and takes the first snapshot. A
fresh install contains **no invented data** — no sample products, customers or sales. Just an
empty ledger and the reference lists (units, categories, tax rates) a shop needs to start.

---

## What it does

### Selling
- **POS screen** built for speed at the counter: keyboard-first (F2–F10), barcode scan, product
  grid or list, multiple parked carts, split payments (cash / bKash / Nagad / card / bank /
  credit), and a printed or PDF receipt.
- Each cart line shows **buying price, average buying price and selling price** side by side, so
  the cashier can see the margin while agreeing a price.
- **The counter bargains, so the price is editable** — for that sale only. It survives a
  price-group switch and an app restart, and it never rewrites the catalogue price.
- Form-based sales, quotations and drafts for when a customer is not standing there.
- **A finalized invoice can be corrected in place, keeping its number** — including its
  payments. Admin only, a reason is required, and the whole correction is recorded.

### Buying and stock
- Purchases / goods-received notes that put stock in, pay suppliers and **record what was
  actually paid**, so the average buying price moves on its own.
- Purchase returns, sell returns, branch transfers and signed stock adjustments (damage, loss,
  recount) — every one of them a reasoned, referenced movement.
- Low-stock alerts, bulk price updates, barcode label printing.
- A product that has been traded is **archived, never deleted**: it leaves the catalogue, the
  POS and search, every past invoice still resolves, and it can be restored.

### Money and people
- Customers and suppliers with derived dues, credit limits, ledgers and payment collection
  (oldest-invoice-first allocation).
- Cash register with shift open/close, counted denominations, variance and a Z-report.
- Expenses with categories, budgets and recurring flags.
- Dashboard KPIs plus **16 reports** — profit & loss, product sell/purchase, payments, tax,
  trending, stock valuation, sales rep, customer group, activity log.

### Trust
- **Role-based access.** PINs and passwords are bcrypt-hashed and verified in the main process;
  every write is checked against the signed-in user's role at the process boundary. A cashier
  cannot void a sale, edit a finalized invoice or reach the owner-only settings.
- **Full audit trail.** Nothing is silently deleted: a sale is voided, a purchase cancelled, a
  product archived, a buying price retracted — each with who, when and why.
- **Bangla throughout** — a 2,420-phrase dictionary, toggled from the title bar. It translates
  only the interface: product names, invoice numbers and amounts are your data and are never
  rewritten.

---

## Your data stays yours

The shop's database is a single SQLite file at **`%APPDATA%\pos\pos.db`**.

### Backup & Cloud

The app writes **verified snapshots** into a folder you choose — and if you point that folder
inside OneDrive, Google Drive or Dropbox, your own sync client carries the copy off the machine.
There is no account, no third-party credential and no outbound request from this app.

- A backup is a `VACUUM INTO` snapshot: consistent while the app is running, compact, and a
  standalone file.
- **Nothing counts as a backup until it is verified.** Every snapshot is reopened read-only and
  must pass an integrity check before the run reports success. One that fails is deleted, so a
  corrupt file can never be sitting there waiting to be restored by mistake.
- Retention keeps the newest N (default 14) and runs **only after a verified success**, so a
  failed backup can never be the reason your last good one was deleted.
- **Restore** verifies the file first, names it and its row counts in a confirmation that
  defaults to *Cancel*, and takes a safety copy of the current database before overwriting.
- **Backup to Pendrive** is one button on the dashboard. That is the copy that survives a stolen
  or dead PC. If Windows will not report which drives are removable, the app says so instead of
  claiming there is no pendrive, and lets you pick the folder yourself.
- CSV export of sales, purchases, products, customers, suppliers and stock — UTF-8 with a BOM,
  so Excel on Windows renders ৳ and Bangla correctly.

---

## Two rules the whole system is built on

These are not implementation details. They are why the numbers can be trusted, and every one of
the 1,161 automated checks exists to defend them.

**1. Stock is never a stored number.** On-hand quantity is always
`SUM(qty)` of the stock movements for that product and branch. Every change is a signed,
reasoned, referenced row. Stock can therefore always be reconstructed and audited, and it can
never silently drift away from its own history.

**2. Balances are derived, never running totals.** Customer due, supplier due and expected cash
in the drawer are computed from the underlying sales, purchases, payments, returns and
movements — not stored and incremented. A balance cannot be wrong without the transactions
behind it being wrong too.

A third rule earns its place alongside them: **caches are recomputed, never adjusted.** The
average buying price is derived from an append-only price history on every write, and the
verification suite asserts the identity directly.

---

## Verification

```bash
npm run backend:verify:all
```

**1,161 automated checks across eight suites**, run against real SQLite databases — including a
full simulated trading year and a complete shop day driven end to end through the same API the
user interface uses.

| Suite | Checks | What it proves |
|---|---:|---|
| `all.ts` | 395 | Exact expected values for every operation, plus determinism and a real-file smoke test |
| `api.ts` | 216 | The 152-channel API surface, end to end, write-then-read |
| `run.ts` | 105 | Accounting identities over a 365-day dataset; date ranges; report totals match their detail rows |
| `e2e.ts` | 68 | One full shop day from a clean install, reconciling every cross-module number |
| `paging.ts` | 91 | Paged list reads equal the unpaged truth, product by product and customer by customer |
| `backup.ts` | 120 | Snapshots, integrity verification, retention, restore, CSV export, invoice PDFs |
| `costing.ts` | 83 | The buying-price history and the cache that can never drift from it |

These are not smoke tests. They assert things like *gross profit equals revenue minus COGS*,
*stock is never negative*, *the dashboard total equals the raw SQL sum*, *money conserves across
a void*, and *a paged customer's due equals the unpaged one*. **A failing check is a real
correctness bug, not a flaky test.**

Money is compared within a one-paisa epsilon and every monetary value passes through a single
pure calculation core, so the POS, the sales module, the reports and the data generator cannot
disagree about arithmetic.

---

## Architecture

```
┌─ Renderer (React 18 + TypeScript) ─────────────────────────────┐
│  pages/ · components/ · stores/ (Zustand) · hooks/ (TanStack)  │
└───────────────────────────┬────────────────────────────────────┘
                            │  api('channel', payload)
                            ▼
┌─ Preload (contextIsolated bridge) ─────────────────────────────┐
└───────────────────────────┬────────────────────────────────────┘
                            ▼
┌─ Main process ─────────────────────────────────────────────────┐
│  electron/ipc.ts   session + PERMISSION GATE (the only gate)   │
│         │                                                       │
│         ▼                                                       │
│  backend/api.ts    buildApi() — 152 channels                    │
│         ▼                                                       │
│  backend/services/ operations with side effects                 │
│         ▼                                                       │
│  backend/core/     PURE money / date / id functions             │
│         ▼                                                       │
│  SQLite (better-sqlite3, WAL, FTS5) — ~30 tables, schema v7     │
└────────────────────────────────────────────────────────────────┘
```

Three deliberate seams:

- **`backend/` has no idea Electron exists.** It is plain synchronous TypeScript over SQLite,
  which is exactly why the verification suite can drive all of it in Node with no window open.
- **Permissions are enforced in one place**, at the process boundary. Never in the services —
  that would make the test harness unable to exercise them.
- **`backend/core/` is pure.** No database, no clock, no IO. It is the arithmetic truth, and it
  is where every money figure in the app comes from.

### Performance, on the hardware it actually runs on

The target machine is a low-end Windows PC, so this got measured rather than assumed:

- **List reads went from 813 ms to 11 ms** on a year of history (3,252 sales) — from 13,009 SQL
  statements per screen to 5 — by replacing a per-row query burst with batched, server-side
  paging. The old version froze the whole window; synchronous SQLite on the main process is
  unforgiving.
- **Startup JavaScript cut from ~1,688 KB to ~1,128 KB** by loading the reports, settings
  screens and chart widgets on demand, so the charting library is no longer parsed before the
  dashboard can appear.
- No `backdrop-filter` on anything permanently on screen; no webfonts downloaded; the
  dashboard's auto-refresh pauses while the window is hidden.
- **Settings → Performance** offers *reduce animations* and *turn off graphics acceleration*,
  both off by default and stored per computer, for old Intel graphics drivers.

---

## Build from source

```bash
git clone https://github.com/shahriar-ahmed-seam/Hardware-Khata-POS.git
cd Hardware-Khata-POS
npm install

npm run dev                  # launch the app (rebuilds native deps for Electron first)
npm run backend:verify:all   # 1,161 checks (rebuilds native deps for Node first)
npm run build                # production bundles
npm run build:win            # Windows installer, no upload
```

Two things will bite you, and they bite everyone once:

> **npm 11 blocks install scripts.** A plain `npm install` reports success but skips every
> postinstall, leaving `better-sqlite3` with no compiled binary, `electron` with no
> `electron.exe` and `esbuild` with no platform binary — so nothing runs. `package.json` carries
> an `allowScripts` allow-list for those three. If you still see `npm warn allow-scripts`, run
> `npm approve-scripts --allow-scripts-pending` and install again.

> **`better-sqlite3` is native, and Node and Electron need different builds of it.**
> `npm run dev` rebuilds for Electron; `npm run backend:verify*` rebuilds for Node.
> `ERR_DLOPEN_FAILED` means you are on the wrong one — run the matching `rebuild:*` script, and
> finish every session with `npm run rebuild:electron`.

### Every script

| Command | What it does |
|---|---|
| `npm run dev` | Vite + Electron with hot reload |
| `npm run build` | Renderer + main + preload production bundles |
| `npm run build:win` | Build the NSIS installer locally (never uploads) |
| `npm run release:win` | Build **and** publish to GitHub Releases (needs `GH_TOKEN`) |
| `npm run backend:verify:all` | All seven verification suites |
| `npm run backend:verify` \| `:scenarios` \| `:e2e` \| `:paging` \| `:backup` \| `:costing` | One suite at a time |
| `npm run backend:typecheck` | `tsc` over the backend only |
| `npm run i18n:check` | 32 assertions over the Bangla dictionary, incl. a full round trip |
| `npm run i18n:extract` | List interface strings that are still untranslated |
| `npm run icon` | Rasterise `build/icon.svg` into the app icon |
| `npm run rebuild:electron` \| `rebuild:node` | Switch the native module's ABI |

`npm run lint` does not work — eslint is not installed. `tsc` is the static gate.

### Layout

```
electron/    main process: window, DB lifecycle, IPC + permission gate, backup, updater
backend/     the data layer — core/ (pure) · services/ · db/ · seed/ · verify/ · api.ts
src/         renderer — pages/ · components/ · stores/ · hooks/ · lib/ · styles/
docs/        handoff documentation (start at 07-CONTINUE-HERE.md)
```

### Sample data for evaluation

```bash
POS_SEED=demo npm run dev
```

Generates a coherent simulated year — roughly 3,000 sales plus purchases, returns, expenses and
shifts — **through the real services**, so every figure on screen is a real database row that
went through the real pipeline. `POS_SEED` defaults to `clean` everywhere, including
development: a real shop must never start with invented numbers in its books.

---

## Stack

| | |
|---|---|
| **Shell** | Electron 22 — deliberately: the last release that supports Windows 7 |
| **UI** | React 18, TypeScript 5.5, Vite 5, Tailwind CSS, Recharts, lucide-react |
| **State** | Zustand (application state + writes), TanStack Query (catalogue reads) |
| **Data** | SQLite via `better-sqlite3` — WAL journal, foreign keys on, FTS5 search |
| **Auth** | `bcryptjs` — pure JavaScript, deliberately, to avoid a second native module |
| **Packaging** | electron-builder (NSIS) + electron-updater 6.x |

Money is `REAL` rounded to two decimals at every boundary, timestamps are ISO-8601 UTC text,
identifiers are text keys.

---

## Documentation

The `docs/` folder is a genuine handoff, written to be picked up cold — including the mistakes,
because the reasoning behind a decision is worth more than the decision.

| Document | Read it for |
|---|---|
| **[`07-CONTINUE-HERE.md`](docs/07-CONTINUE-HERE.md)** | ⭐ **Start here.** Current state, what changed last, open gaps, the rules, and every environment footgun |
| [`00-OVERVIEW.md`](docs/00-OVERVIEW.md) | The big picture and an honest status board |
| [`01-FRONTEND.md`](docs/01-FRONTEND.md) | Every UI module, store and convention |
| [`02-BACKEND.md`](docs/02-BACKEND.md) | Schema, services, the calculation core, what is proven |
| [`03-WHATS-LEFT.md`](docs/03-WHATS-LEFT.md) | The work queue, prioritised |
| [`04-AGENT-HANDOFF.md`](docs/04-AGENT-HANDOFF.md) | How to continue without breaking what works |
| [`05-CONTEXT-AND-HISTORY.md`](docs/05-CONTEXT-AND-HISTORY.md) | The full narrative and every decision |
| [`06-E2E-AND-SMOKE-TEST.md`](docs/06-E2E-AND-SMOKE-TEST.md) | The automated end-to-end run, plus the human-only checklist |
| [`08-FRONTEND-MAP.md`](docs/08-FRONTEND-MAP.md) | Which file draws what — read this before any visual change |
| [`RELEASE.md`](RELEASE.md) | How to publish a version, and what changed in each one |

---

## Not implemented

Stated plainly, because a roadmap that reads like a feature list is a lie:

- **Code signing.** Installers are unsigned, so SmartScreen warns on a new PC. Needs a bought
  certificate.
- **Live multi-device sync.** Off-machine safety is covered by backups; row-level sync between
  machines is not built. The seam for it is documented.
- **Multi-branch writes.** The data model is branch-aware throughout and transfers work, but the
  write paths still assume the single default branch. A real branch switcher is the remaining
  piece.
- **SMS.** Needs a Bangladeshi gateway account. The screens were removed from the menu rather
  than left showing invented delivery figures.
- **Thermal / ESC-POS direct printing** and cash-drawer kick. Printing goes through the normal
  Windows print path today.
- **Barcode and QR rendering** as real Code128 / EAN-13 vectors.

---

## Contributing

This is built for one shop, so there is no formal contribution process — but if you are reading
the code and something looks wrong, an issue is welcome. If you do send a change:

1. `npm run backend:verify:all` must stay green, and **a new rule needs a new check.**
2. `npx tsc --noEmit` on both `tsconfig.json` and `tsconfig.backend.json` must be clean.
3. `npm run i18n:check` must pass if you touched interface text.
4. Read the non-negotiable rules in [`docs/07-CONTINUE-HERE.md`](docs/07-CONTINUE-HERE.md) §5
   first. They are short, and each one is there because something broke.

---

## Licence

No licence has been chosen yet, so the default applies: **all rights reserved.** The code is
public to read; it is not licensed for reuse or redistribution. If you want to use any of it,
open an issue and ask.

<div align="center">

Built for a real hardware shop in Bangladesh. 🇧🇩

</div>
