# Hardware Shop POS — Project Overview

> **One-line:** An offline-first desktop Point-of-Sale + lightweight ERP for a
> Bangladeshi hardware shop, built with Electron + React + SQLite.

This is the top-level map. Read this first, then dive into the focused docs:

| Doc | What it covers |
|-----|----------------|
| `00-OVERVIEW.md` | This file — the big picture, stack, status |
| `01-FRONTEND.md` | Every UI module, store, component, conventions |
| `02-BACKEND.md` | DB schema, services, calculations, verification |
| `03-WHATS-LEFT.md` | Remaining work, prioritized |
| `04-AGENT-HANDOFF.md` | How a new agent/dev picks this up and continues |
| `05-CONTEXT-AND-HISTORY.md` | Full narrative: how we got here, every decision, the working agreement |
| `07-CONTINUE-HERE.md` | ⭐ Resume point: current state, last session's changes, open gaps, gotchas |

Also at the repo root:
- `TASKS.md` — the running task checklist (frontend tasks 1–15 + backend phases)
- `BACKEND_NOTES.md` — the accumulated backend spec written during frontend design
- `backend/README.md` — backend architecture deep-dive

---

## What the product is

A shop-floor POS for a hardware store (cement, rebar, tools, paint, plumbing,
electrical, fasteners, safety gear). It runs **offline-first** as a desktop app —
the shop must keep selling even with no internet. Off-machine safety is handled by
**Backup & Cloud**: the app writes verified database snapshots into a folder the owner's
own OneDrive / Google Drive / Dropbox client already syncs, so the copy leaves the shop
without this app ever making a network request, holding credentials, or requiring an
account. A hosted multi-device sync layer remains a later, optional idea.

Target user: Bangladeshi hardware shops. Currency is BDT (৳). UI supports English
and Bangla. Invoices use the South-Asian lakh/crore numbering. Default tax is 0%
(most local shops sell tax-inclusive).

## Tech stack

**Frontend (renderer)**
- Electron (frameless custom-titlebar window)
- React 18 + TypeScript + Vite
- Tailwind CSS (custom HSL design tokens, light/dark/system)
- Zustand (state) + `persist` middleware (localStorage) — **backend-only**; there is no mock
  data path (see "No mock data" below)
- TanStack Query for the products/catalog read+mutation hooks
- react-router-dom (HashRouter)
- Recharts (charts), lucide-react (icons)

**Backend (main process)**
- SQLite via `better-sqlite3` (synchronous, native)
- Pure TypeScript service layer under `backend/`
- Generic IPC bridge between main and renderer with permission enforcement
- `bcryptjs` for PIN/password hashing (pure JS — no second native module)
- All money REAL/BDT, all timestamps ISO-8601 TEXT, IDs are TEXT keys

## Where things stand (current status — keep this honest)

```
FRONTEND          ████████████████████ 100%  (15 task-modules built)
BACKEND DATA      ████████████████████ 100%  (DB + services + calcs + sim + verification)
STORE WIRING      ████████████████████ 100%  (all data slices on the real backend)
AUTH + PERMISSIONS████████████████████ 100%  (bcrypt + IPC-boundary enforcement)
FIRST-RUN WIZARD  ████████████████████ 100%  (writes a real shop, run-once)
POS CHECKOUT      ████████████████████ 100%  (persists via sales.create)
FINAL E2E TEST    ████████████████████ 100%  (860 checks: seven suites incl. E2E, paging, backup)
LIST PERFORMANCE  ████████████████████ 100%  (N+1 removed; ~74× faster; every list tab paginated)
BACKUP & CLOUD    ████████████████████ 100%  (verified snapshots + retention + restore + CSV export)
BANGLA UI         ████████████████████ 100%  (2,105-phrase dictionary + DOM layer, EN/বাং toggle)
LEGIBILITY        ████████████████████ 100%  (bigger type + higher contrast for an elderly user)
MOCK REMOVAL      ████████████████████ 100%  (src/mocks deleted; no fallback, no fake numbers)
RESPONSIVE SHELL  ████████████████████ 100%  (sidebar/titlebar/POS adapt; min window 900×600)
PACKAGING         ░░░░░░░░░░░░░░░░░░░░░   0%  (installer not built yet — NEXT)
```

> **No mock data.** `src/mocks/data.ts` is deleted and there is no `hasBackend()` data
> fallback anywhere. Domain types live in `src/types/domain.ts`. A figure with no backend
> source renders `'—'` rather than an invented number. See `03-WHATS-LEFT.md`.

- **Frontend**: all modules built and visually complete.
- **Backend data layer**: full data layer built and proven in isolation, then grown as
  each slice was wired — **860 automated verification checks pass** (accounting identities,
  stock invariants, ledgers, cash, reports, auth, settings, determinism, persistence, paged
  reads, backup snapshots) across **146 registered channels**.
- **Store wiring**: every data-bearing Zustand store (products/stock, purchases, sales,
  contacts, cash, expenses, dashboard, reports, settings, branches, users, backup) reads and
  writes the real SQLite backend through `src/lib/api.ts`. There is no second data source.
- **Auth + permissions**: PINs/passwords are bcrypt-hashed; login/unlock are verified in the
  main process; the session lives in main-process memory; every WRITE channel is gated at the
  IPC boundary against the signed-in user's role permissions. Reads are open.
- **First-run wizard**: writes the real business/branch/admin/tax through a single run-once
  `setup.complete` channel and establishes the owner session.
- **POS checkout (the hero screen)**: persists through `sales.create`. A sale reduces stock,
  records COGS, routes cash to the open shift, and appears in Sales/Dashboard/Reports/Cash.
  F6/F7 save drafts/quotations through the same channel.
- **Backup & Cloud**: verified `VACUUM INTO` snapshots with retention, guarded restore and CSV
  export, written into a folder the owner's own cloud client syncs.

## The two big architectural truths (do not break these)

1. **Stock is never a stored column.** On-hand = `SUM(qty)` of `stock_movements` for a
   (product, branch). Every change is a signed, reasoned, referenced movement.
2. **Balances are derived, never running columns.** Customer due, supplier due, and cash
   drawer expected are computed from the underlying sales/purchases/payments/returns/
   movements — not stored and incremented.

These keep the data auditable and self-correcting, and the verification suite enforces
them. A failing identity check is a real correctness bug, not a flaky test.

## How to run

```bash
# install
npm install

# DEV (auto-rebuilds better-sqlite3 for Electron, then launches Vite + Electron)
npm run dev

# BACKEND VERIFICATION (auto-rebuilds for Node, runs 860 checks across seven suites)
npm run backend:verify:all

# ONE SUITE AT A TIME (same rebuild, faster loop)
npm run backend:verify | backend:scenarios | backend:e2e | backend:paging | backend:backup

# PRODUCTION BUILD (renderer + main + preload bundles)
npm run build
```

> ⚠️ **Native ABI gotcha:** `better-sqlite3` must be built for the right runtime.
> `npm run dev` rebuilds for Electron; `npm run backend:verify*` rebuilds for Node.
> If you see `ERR_DLOPEN_FAILED`, you're on the wrong ABI — run the matching rebuild
> script. ALWAYS finish a session with `npm run rebuild:electron` so `npm run dev` works.
> See `02-BACKEND.md` → "Native module ABI".

## Seed modes (POS_SEED env) — what a fresh install contains

The data on screen (KPIs, widgets, products, dues, customers) is **real data read from the
SQLite DB through the backend channels**. There is no fallback data source at all — outside
Electron the screens are simply empty. What differs by mode is how the DB was first populated:

- `clean` — **the default everywhere now**, dev included. Calls
  `seedMaster(db, { referenceOnly: true })`: roles, tax rates, invoice schemes,
  categories/brands/units, expense categories, ONE neutral "Main Branch", ONE owner account and
  the Walk-in customer. **No products, customers, suppliers, agents or transactions**, and a
  blank business identity for the first-run wizard to fill. Your real shop starts from an empty
  ledger with nothing invented in it.
- `demo` — **evaluation only**, opt in with `POS_SEED=demo npm run dev`. Seeds a full synthetic
  year via `simulate()` (~3,000 sales plus purchases/returns/expenses/shifts) through the REAL
  services, so the numbers are real DB rows flowing through the real pipeline — just generated.
  This is also the fixture the verification harness drives.
- `none` — truly empty (no reference data either).

Seeding happens on FIRST RUN ONLY. An existing `userData/pos.db` is never reseeded, so to see
the clean install delete `userData/pos.db` (plus `-wal`/`-shm`) and relaunch.

## Workspace path

`c:\Users\Seam\Desktop\APPS\POS\`
