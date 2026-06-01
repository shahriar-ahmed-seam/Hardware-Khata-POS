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

Also at the repo root:
- `TASKS.md` — the running task checklist (frontend tasks 1–15 + backend phases)
- `BACKEND_NOTES.md` — the accumulated backend spec written during frontend design
- `backend/README.md` — backend architecture deep-dive

---

## What the product is

A shop-floor POS for a hardware store (cement, rebar, tools, paint, plumbing,
electrical, fasteners, safety gear). It runs **offline-first** as a desktop app —
the shop must keep selling even with no internet. Cloud sync is a later, optional
layer.

Target user: Bangladeshi hardware shops. Currency is BDT (৳). UI supports English
and Bangla. Invoices use the South-Asian lakh/crore numbering. Default tax is 0%
(most local shops sell tax-inclusive).

## Tech stack

**Frontend (renderer)**
- Electron (frameless custom-titlebar window)
- React 18 + TypeScript + Vite
- Tailwind CSS (custom HSL design tokens, light/dark/system)
- Zustand (state) + `persist` middleware (localStorage) — now **backend-aware** with a
  `hasBackend()` mock fallback for browser dev
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
STORE WIRING      ████████████████████ 100%  (all 9 data slices on the real backend)
AUTH + PERMISSIONS████████████████████ 100%  (bcrypt + IPC-boundary enforcement)
FIRST-RUN WIZARD  ████████████████████ 100%  (writes a real shop, run-once)
POS CHECKOUT      ████████████████████ 100%  (persists via sales.create; mock fallback kept)
FINAL E2E TEST    ████████████████████ 100%  (611 checks incl. full-shop-day E2E)
PACKAGING         ░░░░░░░░░░░░░░░░░░░░░   0%  (installer not built yet — NEXT)
```

- **Frontend**: all modules built and visually complete.
- **Backend data layer**: full data layer built and proven in isolation, then grown as
  each slice was wired — **611 automated verification checks pass** (accounting identities,
  stock invariants, ledgers, cash, reports, auth, settings, determinism, persistence).
- **Store wiring**: every data-bearing Zustand store (products/stock, purchases, sales,
  contacts, cash, expenses, dashboard, reports, settings, branches, users) now reads/writes
  the real SQLite backend through `src/lib/api.ts`, with a clean `hasBackend()` fallback to
  mock data for browser dev.
- **Auth + permissions**: PINs/passwords are bcrypt-hashed; login/unlock are verified in the
  main process; the session lives in main-process memory; every WRITE channel is gated at the
  IPC boundary against the signed-in user's role permissions. Reads are open.
- **First-run wizard**: writes the real business/branch/admin/tax through a single run-once
  `setup.complete` channel and establishes the owner session.
- **POS checkout (the hero screen)**: still runs entirely on mock data with a local invoice
  counter — it does NOT yet call `sales.create`. This is the next and most important task.

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

# BACKEND VERIFICATION (auto-rebuilds for Node, runs 611 checks)
npm run backend:verify:all

# PRODUCTION BUILD (renderer + main + preload bundles)
npm run build
```

> ⚠️ **Native ABI gotcha:** `better-sqlite3` must be built for the right runtime.
> `npm run dev` rebuilds for Electron; `npm run backend:verify*` rebuilds for Node.
> If you see `ERR_DLOPEN_FAILED`, you're on the wrong ABI — run the matching rebuild
> script. ALWAYS finish a session with `npm run rebuild:electron` so `npm run dev` works.
> See `02-BACKEND.md` → "Native module ABI".

## Seed modes (POS_SEED env)

- `demo` — full synthetic year (dev default; dashboards/reports populated).
- `clean` — master/reference data only (packaged default; first-run wizard takes over).
- `none` — truly empty.

## Workspace path

`c:\Users\Seam\Desktop\APPS\ERP_2\POS\`
