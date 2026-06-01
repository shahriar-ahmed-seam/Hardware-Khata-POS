# Full Context & History

> This document is the "memory" of the project for any agent or developer (including a
> friend's AI agent) who needs to continue. It explains **how we got here, why each
> decision was made, what was built in what order, and exactly what to do next** — in
> plain narrative, not just bullet status. Read it alongside `04-AGENT-HANDOFF.md`.

---

## 1. What this project is, in one paragraph

An offline-first Windows desktop POS + light ERP for a Bangladeshi hardware shop (cement,
rebar, tools, paint, plumbing, electrical, fasteners, safety gear). Electron shell, React
18 + TS + Vite + Tailwind renderer, SQLite (`better-sqlite3`) backend running inside the
Electron main process. Currency BDT (৳), EN/BN i18n, lakh/crore number words, default tax
0%. It must keep selling with no internet; cloud sync is an optional later layer. The owner
is "Seam" (the admin user is `u_admin`, name often shown as "Seam").

## 2. The order things were built (the real timeline)

1. **Frontend first (Tasks 1–15).** The entire UI was designed and built against **mock
   Zustand stores** (localStorage), module by module, with the owner reviewing and saying
   "lock it" before moving on. By the end, all 15 task-modules were visually complete and
   navigable on synthetic data. The POS checkout screen (Task 3) was intentionally
   "temp-locked" — built but deliberately left for a deep pass once the backend existed,
   because it's the owner's most important screen.

2. **Backend Part 1 — build + verify in isolation.** Before wiring anything, the full
   SQLite data layer was built under `backend/` and proven correct in **plain Node** with a
   verification harness — 122 checks at first. The rule was: prove the math and invariants
   in isolation before touching the frontend. This is where the "two architectural truths"
   (derived stock, derived balances) were enforced and tested.

3. **Backend Part 2 — the Electron bridge.** A generic IPC bridge was built so the renderer
   can call backend channels (`api:invoke` → `buildApi()[channel]`). The schema was inlined
   as a TS string (`backend/db/schema.ts`) because reading a `.sql` file via `fs` breaks
   after bundling. Native-ABI rebuild scripts were added (the recurring footgun — see §6).

4. **Store-by-store wiring (9 data slices).** Each mock Zustand store was made
   "backend-aware": under Electron it hydrates from / writes to the backend; in browser dev
   it falls back to mock. Order chosen low-risk → high-risk:
   **Products+Stock → Purchases → Sales → Contacts → Cash Register → Expenses → Dashboard →
   Reports → Settings.** Each slice followed the same pattern (adapter + hydrate + writes +
   tests) and was verified end-to-end before the next. Verification grew 122 → 362 here.

5. **Wiring cleanup pass.** A thorough audit found gaps inside "done" slices: catalog
   management (categories/brands/units) and the full-page ProductEdit still wrote to mock;
   stock transfers/adjustments didn't persist; store write-failures were silent. All four
   were fixed (units got new backend CRUD), and a toast-on-write-reject was added to every
   store. Verification 362 → 382.

6. **Auth + permissions.** `bcryptjs` hashing, backend-verified login/unlock, a
   main-process session, and **permission enforcement at the IPC boundary** (not in the
   handlers, so the verify harness stays green). Verification 382 → 425.

7. **First-run wizard write-through.** A run-once `setup.complete` channel that configures
   the seeded admin/branch/business in one transaction (hashing the chosen PIN) and
   establishes the owner session — allowed pre-session only until setup completes (so it
   can't be replayed for privilege escalation). Verification 425 → 465.

8. **POS checkout wired + final E2E.** The POS hero screen now persists via `sales.create`
   (mock fallback kept); a full-shop-day E2E (`backend/verify/e2e.ts`) drives the API facade
   from a clean first-run DB and reconciles every cross-module number. Verification 465 → 533.

9. **You are here.** Next is **packaging** (electron-builder Windows installer, native rebuild
   at package time), then any optional/deferred polish.

## 3. The decisions that matter (and why)

- **Derived stock & balances (never stored running columns).** On-hand is always
  `SUM(stock_movements.qty)`; dues and the cash drawer are computed from transactions. This
  makes the data auditable and self-correcting, and the verify suite enforces it. Adding a
  stored stock/balance column is the fastest way to corrupt the system — don't.

- **All money through `backend/core/`.** One calculation core (line/order totals, COGS,
  profit, cash, margin) is shared by POS, Sales, Purchases, Reports, and the seeder, so they
  can never disagree. Compare money within a 1-paisa epsilon.

- **Verify in isolation, in plain Node, before wiring.** The backend was proven correct
  before the UI touched it, and every slice added more checks. The harness calls handlers
  **directly** — which is exactly why permission enforcement must NOT live in the handlers.

- **Backend-aware stores with a `hasBackend()` fallback.** Rather than rip out Zustand, each
  store gained a `hydrate()` + API-write path guarded by `hasBackend()`, keeping the mock
  path for browser dev. This let us wire incrementally and keep the app runnable everywhere.

- **Permission enforcement at the IPC boundary.** The session lives in main-process memory
  (renderer can't spoof it per call); `electron/permissions.ts` maps WRITE channels →
  required permission ids; reads are open. This keeps the security layer entirely outside the
  proven backend, so the 465-check harness is unaffected.

- **`bcryptjs` (pure JS) over native `bcrypt`.** A second native module would mean a second
  per-ABI rebuild — exactly the footgun we already manage with `better-sqlite3`. For a local
  single-shop app, pure-JS bcrypt in the main process is the pragmatic, safe choice.

- **Run-once first-run channel.** `setup.complete` is gated by a `settings_kv` flag and is
  allowed pre-session only while setup is incomplete; replaying it throws. It configures the
  already-seeded `u_admin`/`br_mp` rather than creating duplicates.

- **Single-branch assumption (for now).** Writes use `br_mp` / `u_admin` constants. A real
  multi-branch context (branch switcher feeding `branchId` everywhere) is deferred.

## 4. What's DONE vs what's LEFT (honest snapshot)

**Done:** frontend (all modules), backend data layer, Electron bridge, all 9 data slices
wired, cleanup pass, auth + IPC permissions, first-run wizard, POS checkout, final E2E.
**533 verification checks pass**; 120 channels registered; `npm run build` clean; both
native ABIs work.

**Left (in priority order):**
1. **POS checkout wiring** — the hero screen still uses mock products/customers and a local
   invoice counter; `handleConfirmPayment` doesn't call `sales.create`. This is the next and
   most important task. Full step list in `03-WHATS-LEFT.md`.
2. **Packaging** — electron-builder Windows installer; rebuild `better-sqlite3` for the
   bundled Electron at package time (the #1 packaging risk); icon `.svg`→`.ico`; splash waits
   for DB-ready; confirm first-run on a clean `userData/pos.db`.
3. **Final end-to-end test** — click every screen against the real DB; confirm a full POS
   sale flows into Sales/Dashboard/Reports/Cash; test edge cases + permission denials.

**Smaller follow-ups:** AddSale/AddPurchase create-forms (still mock master data),
Shipments (no backend table), transfer cancel/reversal (no handler), Warranties/PriceGroups
management (mock), return detail lines (header-only). See `03-WHATS-LEFT.md`.

**Deferred / external:** SMS gateway, cloud sync (`sync_outbox` exists), thermal/ESC-POS
printing, nightly stock-valuation snapshots, recurring-expense job, per-user DB prefs,
real barcode/QR rendering, multi-branch context, offline PIN-reset code.

## 5. The repo at a glance

```
electron/      main.ts, preload.ts, db.ts (lifecycle+seed), ipc.ts (gate+forward), permissions.ts
src/
  pages/       one folder/file per module (+ pages/reports/*, pages/settings/*, pages/auth/*)
  components/  layout/, ui/ (primitives), and per-module component folders
  stores/      backend-aware data stores + pure-UI stores
  hooks/       adapters + data hooks (useProducts, useReport, useDashboardData, *Adapter)
  lib/         api.ts (renderer client), utils.ts (formatBDT, etc.), i18n
  mocks/       data.ts — the synthetic seed used as the !hasBackend() fallback
backend/
  db/ core/ services/ seed/ verify/   + api.ts (buildApi, 120 channels)
docs/          00–05 (this set)
TASKS.md       running checklist (frontend 1–15 + backend phases)
BACKEND_NOTES.md   the spec accumulated during frontend design (the "why")
```

## 6. Hard-won gotchas (please don't relearn these the hard way)

- **Native ABI is the recurring footgun.** `better-sqlite3` needs a Node build for the
  verify harness and an Electron build for the app. `ERR_DLOPEN_FAILED` = wrong ABI.
  `backend:verify*` auto-rebuilds for Node; `dev` auto-rebuilds for Electron. **Always finish
  a session with `npm run rebuild:electron`** or the next `npm run dev` will crash.
- **Don't move permission checks into the backend** — it breaks the Node harness. IPC only.
- **Don't add stored stock/balance columns** — the verify suite will (correctly) fail.
- **`due` clamps at 0**; overpayment never goes negative.
- **Branch name↔id** — resolve before any backend write.
- **Session isn't persisted** — re-login after restart is intended/secure.
- **Stores must `.catch(toast.error)` on writes** — a silent failure (e.g. a delete-guard or
  permission denial) is a UX bug; the row reappearing on rehydrate with no message confuses
  the user.

## 7. How to verify you haven't broken anything (run before AND after your change)

```bash
npm run backend:typecheck
npx tsc --noEmit -p tsconfig.json
npm run backend:verify:all      # expect 533+ (your new tests raise it)
npm run build
npm run rebuild:electron        # leave it dev-ready
```

If `backend:verify:all` drops below the baseline or a named identity check fails, you've
introduced a correctness regression — fix it before moving on.

## 8. The working agreement (so you match the owner's expectations)

- The owner says "start X" / "do as recommended" / "do what you recommend, full". When they
  say "do as recommended," apply sensible BD-hardware-shop defaults (mirror UltimatePOS /
  Glorious POS behavior) and proceed without over-asking.
- The owner's explicit hard line: **"don't ruin the data input, output, calculations, and
  sync."** Honor it by: enforcement at the IPC layer (harness stays green), keeping the mock
  fallback, verifying every slice end-to-end, and treating a failing check as a real bug.
- Build incrementally, verify after each step, and report what changed + the new check count.
- The POS hero screen gets a careful, deep pass — it's the owner's priority; don't rush it.
- Larger/destructive changes: explain and confirm. Small reversible ones: just do them.
