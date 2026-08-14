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
0%. It must keep selling with no internet; off-machine safety is handled by verified database
snapshots written into a folder the owner's own cloud client syncs (Backup & Cloud, §2.14), and
hosted multi-device sync stays an optional later layer. The owner
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

9. **Rigorous whole-app audit + closing the deferrals.** A foolproof-pass audit caught a
   real money bug (PayBillModal double-counted supplier payments under the backend) and 15
   smaller mock leaks; all fixed. Then the three documented deferrals were closed:
   AddSale/AddPurchase create-forms now use real master data; Warranties + Price Groups got
   backend CRUD (v2 migration); Shipments got a real table + service + channels (v3
   migration, touching no stock/cash). Verification 533 → 577 → **611**.

10. **Feature-complete and mock-free under Electron.** The repo went up on GitHub
    (`shahriar-ahmed-seam/Hardware-Khata-POS`). Packaging was named as the next step.

11. **Owner-requested UX round: Bangla, legibility, decluttering, mock removal, responsive.**
    A dictionary-based DOM translation layer (never JSX edits, exact matches only, so shop DATA
    can't be rewritten), a font/contrast pass for an elderly user, redundant chrome removed, and
    `src/mocks/data.ts` deleted outright — no fallback, no fabricated numbers, `'—'` where there
    is no backend source. Full detail in `03-WHATS-LEFT.md`.

12. **The N+1 that froze the app, and then pagination everywhere.** Opening Sales made one IPC
    call per row (3,252 round-trips of synchronous SQLite on the main process). `paged.ts` fixed
    it with ~5 statements per page; that grew to **six server-side paged channels** (sales,
    purchases, products, customers, suppliers, expenses), and the slower-growing list tabs
    (SellReturns, PurchaseReturns, StockTransfers, StockAdjustments, Shipments) got client-side
    pagination — their list channels are header-only and they hold every filtered row, so their
    KPI strips still cover the full filtered set while the server-paged screens say "(this
    page)". `backend/verify/paging.ts` grew **33 → 80 checks**, now asserting that paged derived
    values equal the unpaged ones product-by-product and customer-by-customer.

13. **A report bug that pagination exposed.** `reports.customerGroup` used to merge per-group
    customer counts and outstanding due in from the customers store on the frontend. Once that
    store held a single 50-row page, the report silently under-counted every shop with more than
    50 customers. Both figures are computed in SQL now, group rows are the UNION of "had sales
    in the range" and "has customers" (so a group with a balance but no sales in the range is no
    longer invisible), and each customer's due is rounded to 2dp before summing so a group total
    matches the Customers screen to the cent. The lesson worth keeping: **when a list becomes
    paginated, every figure derived from that list in the renderer becomes a bug.**

14. **Backup & Cloud saving — the deferred "cloud sync" item, solved differently.** It had been
    sitting in the deferred list waiting on a Supabase/S3/Drive provider adapter. What shipped
    needs no account, no subscription and no internet: `backend/services/backup.ts` takes a
    **verified `VACUUM INTO` snapshot of the whole database** (consistent while the app is live,
    compact, independent of the `-wal`/`-shm` sidecars), reopens it READ-ONLY and requires
    `PRAGMA integrity_check` plus readable core tables **before** the run counts as successful —
    and deletes a snapshot that fails, so it can never be restored by mistake. "Cloud" means the
    snapshot folder is one the owner's OneDrive / Google Drive / Dropbox client already syncs:
    the app makes **no outbound request of its own**, holds no third-party credentials, and still
    works offline because the snapshot always succeeds locally and the sync client uploads later.
    Cloud roots are detected, never assumed. `SyncTarget` is the seam if a hosted provider is
    ever added; nothing is stubbed.

    Deliberate design choices worth knowing before touching it:
    - Snapshots are named `pos-backup-YYYYMMDD-HHMMSS.sqlite3` in local time so string sort ==
      chronological, and **retention reads the filename, not mtime** — a cloud client rewrites
      mtime. Retention keeps the newest N (default 14) and runs **only after a verified
      success**, so a failed backup can never delete the last good one. Foreign files in the
      folder are never touched.
    - The split between `backend/services/backup.ts` (pure SQLite + `fs`) and
      `electron/backup.ts` (Documents path, cloud detection, pickers, restore, timer) exists so
      the Node harness can prove everything provable: **68 checks** in
      `backend/verify/backup.ts`, plus a standalone `npm run backend:backup`.
    - **Restore** is the most destructive operation in the app: verify first, native confirm
      naming the snapshot/date/row counts with Cancel as the default, a `VACUUM INTO` safety
      copy of the CURRENT database to `pre-restore-<timestamp>.sqlite3`, delete the
      `-wal`/`-shm` sidecars (a stale WAL replays OLD pages over the restored file — silent
      corruption), then relaunch.
    - `daily` is a "no verified snapshot today and it's past 02:00" check on a 10-minute tick,
      **not a 02:00 alarm**: a shop PC is usually off overnight, and an alarm would silently
      never fire. `on-shift-close` (the recommended schedule) fires in `electron/ipc.ts` after a
      successful `cash.closeShift`, keeping scheduling and IO policy out of backend services.
    - CSV export (sales, purchases, products, customers, suppliers, stock) lands in an
      `exports/` subfolder next to the snapshots so a cloud folder carries it off the machine
      too, UTF-8 **with a BOM** so Excel on Windows renders Bangla and ৳. Stock on-hand there is
      derived from `stock_movements`, same rule as everywhere else.

    Two real bugs fell out of building it. `openDatabase()` created the handle and *then* applied
    pragmas, so a throwing pragma (e.g. "file is not a database" — exactly what a corrupt
    snapshot gives you) **leaked the OS file handle** and kept the file locked for the rest of
    the process; it now closes and rethrows, and accepts `{ readonly: true }` to skip the
    WAL/synchronous pragmas, because WAL-ing a snapshot would spray `-wal`/`-shm` sidecars into
    a cloud-synced folder. And the backup settings blob had **two writers** — the backend service
    and the renderer settings store, on the same `settings_kv` 'backup' key — so saving an
    appearance preference could silently wipe the backup folder path. The backend owns it now;
    the renderer reads it via `src/stores/backup.ts`. `Settings → Backup & Sync` became
    **Backup & Cloud**, fully real (every value read back from the backend after each action, no
    mocked provider buttons, no fake sync history), and the First-Run Wizard's cloud step now
    sets the schedule, points the folder at a detected cloud root and takes the FIRST snapshot
    immediately after `setup.complete` (which is what creates the owner session, so the gated
    backup channels are callable) — a brand-new shop is never "backup configured but no backup
    exists". The wizard also lost its last "MOCK PATH (no backend)" branch: outside the desktop
    app it refuses with a clear message instead of producing a shop that looks configured with no
    database behind it, and its prefilled identity placeholders are blank because those strings
    print on customer receipts.

15. **You are here.** **860 verification checks** across seven suites, **146 channels**. Remaining:
    **packaging** (electron-builder Windows installer, `better-sqlite3` rebuilt for the bundled
    Electron at package time) and the manual GUI smoke test.

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

- **Backend-aware stores with a `hasBackend()` fallback — then no fallback at all.** Rather
  than rip out Zustand, each store first gained a `hydrate()` + API-write path guarded by
  `hasBackend()`, keeping the mock path for browser dev; that let us wire incrementally with
  the app runnable everywhere. Once every slice was on the backend the owner required a clean
  product, so the fallback and `src/mocks/` were deleted (§2.11). `hasBackend()` now survives
  only as the "don't fire this query outside Electron" gate on `useReport`.

- **Permission enforcement at the IPC boundary.** The session lives in main-process memory
  (renderer can't spoof it per call); `electron/permissions.ts` maps WRITE channels →
  required permission ids; reads are open. This keeps the security layer entirely outside the
  proven backend, so the verify harness is unaffected.

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
wired, cleanup pass, auth + IPC permissions, first-run wizard, POS checkout, final E2E,
whole-app foolproof audit, the three closed deferrals (AddSale/AddPurchase real master
data, Warranties + Price Groups CRUD, Shipments table/service/channels), mock removal,
Bangla UI (2,105 phrases), pagination on every list tab, and Backup & Cloud saving.
**860 verification checks pass** across seven suites; **146 channels** registered;
`npm run build` clean; both native ABIs work; the repo is on GitHub.

**Left (in priority order):**
1. **Packaging** — electron-builder Windows installer; rebuild `better-sqlite3` for the
   bundled Electron at package time (the #1 packaging risk); icon `.svg`→`.ico`; splash waits
   for DB-ready; confirm first-run on a clean `userData/pos.db`.
2. **Manual GUI smoke test** — click every screen against the real DB; confirm a full POS
   sale flows into Sales/Dashboard/Reports/Cash; test edge cases + permission denials
   (`docs/06-E2E-AND-SMOKE-TEST.md`).

**Deferred / external (post-MVP):** SMS gateway, hosted multi-device sync (`sync_outbox` and
the `SyncTarget` seam exist; off-machine safety is already covered by Backup & Cloud),
thermal/ESC-POS printing, nightly stock-valuation snapshots, recurring-expense job, per-user
DB prefs, real barcode/QR rendering, multi-branch context, transfer cancel/reversal handler,
offline PIN-reset code.

## 5. The repo at a glance

```
electron/      main.ts, preload.ts, db.ts (lifecycle+seed), ipc.ts (gate+forward), permissions.ts
src/
  pages/       one folder/file per module (+ pages/reports/*, pages/settings/*, pages/auth/*)
  components/  layout/, ui/ (primitives), and per-module component folders
  stores/      backend-aware data stores + pure-UI stores
  hooks/       adapters + data hooks (useProducts, useReport, useDashboardData, *Adapter)
  lib/         api.ts (renderer client), utils.ts (formatBDT, etc.), i18n, bn/ (dict+translate)
  types/       domain.ts — the shared domain types (they used to live inside src/mocks/)
               NOTE: src/mocks/ is DELETED. There is no mock data path.
backend/
  db/ core/ services/ seed/ verify/   + api.ts (buildApi, 146 channels)
docs/          00–06 (this set)
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
- **Paginating a list invalidates anything derived from it in the renderer** — that's exactly
  how the Customer Group report started under-counting. Aggregate in SQL.
- **Never open a snapshot with the WAL pragmas** (`openDatabase(file, { readonly: true })`), and
  never switch retention to `mtime` — a cloud sync client rewrites mtime.
- **One writer per `settings_kv` key.** Two writers on the 'backup' key silently wiped a folder
  path once already.

## 7. How to verify you haven't broken anything (run before AND after your change)

```bash
npm run backend:typecheck
npx tsc --noEmit -p tsconfig.json
npm run backend:verify:all      # expect 860+ (seven suites; your new tests raise it)
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
  sync."** Honor it by: enforcement at the IPC layer (harness stays green), verifying every
  slice end-to-end, and treating a failing check as a real bug.
- Build incrementally, verify after each step, and report what changed + the new check count.
- The POS hero screen gets a careful, deep pass — it's the owner's priority; don't rush it.
- Larger/destructive changes: explain and confirm. Small reversible ones: just do them.
