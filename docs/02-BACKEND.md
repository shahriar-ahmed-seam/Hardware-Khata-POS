# Backend — Complete Reference

Offline-first SQLite data layer. Pure, synchronous, fully tested in plain Node, and
wired into Electron via a generic IPC bridge with permission enforcement. See also
`backend/README.md`.

## Folder map (`backend/`)

```
db/
  connection.ts   openDatabase / migrate / tx / resetDatabase + pragmas (WAL, FK on)
                  openDatabase(file, { readonly:true }) skips the WAL/synchronous pragmas
  schema.ts       SCHEMA_SQL + FTS_SQL as TS strings (bundler-safe) ← used at runtime
  schema.sql      same schema as a .sql file (reference / external tooling only)
  fts.sql         FTS5 reference
core/             PURE functions, NO db access — the calculation truth
  money.ts        round2, sum2, moneyEq, EPSILON (1 paisa)
  calc.ts         sale/purchase line + order totals, COGS, profit, cash, margin
  words.ts        amount-in-words (BD lakh/crore)
  ids.ts          newId(prefix), formatRef(...)
  dates.ts        resolveRange(preset) — matches frontend ReportToolbar
services/         operations WITH side-effects (all funnel through core/)
  stock.ts        recordMovement, stockOnHand, stockLevels, weightedAvgCost, valuation
  sales.ts        createSale, addSalePayment, voidSale, deleteSale
  purchases.ts    createPurchase, addPurchasePayment, cancelPurchase, deletePurchase
  returns.ts      createSellReturn, createPurchaseReturn
  stockOps.ts     createTransfer, receiveTransfer, createAdjustment
  expenses.ts     createExpense, updateExpense, voidExpense, deleteExpense, *ExpenseCategory
  cash.ts         openShift, closeShift, recordCashMovement, shiftTotals, getOpenShift
  catalog.ts      product + category + brand + UNIT CRUD (FTS sync, delete guards)
  contacts.ts     customer + supplier CRUD + paySupplier (oldest-first allocation)
  settings.ts     business update, branch/taxRate/user/role/agent CRUD, settings_kv get/set
  setup.ts        completeSetup (run-once first-run), setupStatus, isSetupComplete
  auth.ts         hashSecret/verifySecret (bcryptjs), authenticate, setUserSecret, verifyUserPin
  ledger.ts       customerDue, supplierDue, customer/supplierTotals, customerLedger
  activity.ts     logActivity
  sequences.ts    nextRef(docType) — atomic invoice/PO/etc numbering
  dashboard.ts    getStats + widget queries (topCustomers, recentPurchases, salesVsPurchaseVsExpense, ...)
  reports.ts      profitLoss, productSell/Purchase, payments, tax, trending, salesRep, ...
  queries.ts      read-side list/detail getters + globalSearch (FTS5) + listAgents
  paged.ts        server-side paged list reads: sales, purchases, products, customers,
                  suppliers, expenses ({rows,total,page,pageSize}; pageSize clamped to 200)
  backup.ts       verified VACUUM INTO snapshots, retention, integrity verify, CSV export
                  (pure SQLite+fs, so the Node harness can verify all of it)
seed/
  master.ts       deterministic reference data (branches, users w/ bcrypt pins, products, ...)
  rng.ts          seeded PRNG (mulberry32) — reproducible
  simulate.ts     1 coherent year of activity via the REAL services
verify/
  assert.ts       tiny Suite assertion harness
  run.ts          56 identity checks on a 365-day simulated dataset
  scenarios.ts    targeted exact-value operation tests (incl. auth, settings, setup, stockops)
  api.ts          checks exercising the buildApi() facade (the IPC surface)
  all.ts          scenarios + determinism + persistent-file smoke + identities
  e2e.ts          one full shop day through buildApi() from a clean first-run DB
  paging.ts       paged list reads == unpaged truth, clamping, filters, partitions
  backup.ts       snapshot/verify/retention/export behaviour on real files
api.ts            buildApi(): flat { channel -> handler(db, payload) } — 152 channels
README.md         architecture deep-dive
```

## Database schema (head: v7)

> Migrations live in `db/connection.ts` and are all **additive and idempotent** —
> v2 price-group columns, v3 shipments, v4 cost history, v5 `products.archived_at`,
> v6 clearing dead `blob:` image URLs, v7 the cost-history retraction columns.
> No migration has ever rewritten existing shop data.

~30 tables. Highlights (full DDL in `db/schema.ts`):

- **Identity/config**: `business_info` (singleton), `branches`, `roles`, `users`
  (`pin_hash`/`password_hash` are bcrypt), `commission_agents`, `settings_kv`, `tax_rates`,
  `invoice_schemes`, `printer_profiles`.
- **Catalog**: `categories`, `brands`, `units`, `warranties`, `price_groups`, `products`,
  `product_units`.
- **Stock**: `stock_movements` (the source of truth), `stock_transfers(+lines)`,
  `stock_adjustments(+lines)`, `stock_valuation_snapshots`.
- **Sales**: `sales`, `sale_lines`, `sale_payments`, `sale_audit`, `sell_returns(+lines)`.
- **Purchases**: `purchases`, `purchase_lines`, `purchase_payments`, `purchase_audit`,
  `purchase_returns(+lines)`.
- **Money/ops**: `expenses`, `expense_categories`, `cash_shifts`, `cash_movements`,
  `activity_log`.
- **Sync**: `sync_outbox` — reserved for a future hosted sync layer. The shipping
  Backup & Cloud path does not use it: it copies the whole database file (see below).

Conventions: IDs are TEXT, money is REAL (rounded to 2dp at every boundary), timestamps
are ISO-8601 TEXT, booleans are INTEGER 0/1, JSON arrays stored as TEXT.

## The calculation core (where "perfect math" lives)

Everything monetary funnels through `core/calc.ts` so POS, Sales, Purchases, Reports,
and the seeder agree:
- `computeSaleLine` → unit price (spr×(1+markup)), line subtotal (after %/flat disc, ≥0)
- `computeSaleTotals` → subtotal, order discount, taxable base (≥0), tax, total
- `computeCogs` / `computeSaleProfit`
- `computePurchaseLine` / `computePurchaseTotals`
- `computeExpectedCash` / `computeVariance`
- `marginPct`

> The frontend POS cart math in `src/components/pos/types.ts` (`computeTotals`) mirrors
> these semantics. When wiring POS checkout, send the line inputs and let the backend be
> the source of truth; compare the backend's returned total to the cart total within the
> 1-paisa epsilon.

## Side-effect rules (enforced by services + verified)

- **Final sale**: reduces stock (signed movement), records COGS from weighted-avg cost,
  routes cash payments to the open shift, writes audit + activity + FTS. Drafts/quotations
  touch nothing. `deleteSale` only removes drafts/quotations (final → use void).
- **Void**: reverses stock, reverses cash collected in cash, flips status, audits.
- **Purchase (received)**: increases stock, routes cash out to shift, and records each line's
  unit cost through `setProductCost` (never a raw `UPDATE`). `cancelPurchase` reverses
  stock-in + cash (idempotent) **and retracts the buying prices the purchase recorded** —
  marked, not deleted, so `cost`/`avg_cost` recompute without them while the audit row
  survives. `deletePurchase` guards received purchases.
- **Sell return**: restores stock; Cash→drawer out, StoreCredit→customer credit,
  CreditAdjust→reduces due via ledger. Inherits customer from the source sale.
- **Purchase return**: reduces stock; CashRefund→drawer in, CreditAdjust→reduces payable.
- **Transfer**: stock leaves source on dispatch, enters destination on receive (total
  conserved across branches).
- **Adjustment**: signed movement (negative=loss, positive=found).
- **Expense (cash)**: drawer out. Void/delete/amount-or-method edit of a cash expense posts
  a compensating movement so the derived drawer stays exact.
- **paySupplier**: auto-allocates oldest-first across open bills (reuses addPurchasePayment).
- **Due** (customer/supplier): derived = opening ± activity, never negative.

## API facade (`backend/api.ts`)

`buildApi()` returns `{ channel: (db, payload) => result }`. **152 channels** grouped:
reads (`*.list`, `*.get`, `*.listPage`, `search.global`), writes (`sales.create`,
`purchases.create`, `*.void`, `cash.openShift`, catalog/contacts/settings CRUD, ...),
aggregations (`dashboard.*`, `reports.*`), backup (`backup.status/run/configure/export/
verify`), and auth helpers (`auth.authenticate`, `auth.verifyPin`, `auth.setSecret`,
`setup.complete`, `setup.status`). This is the surface IPC forwards to.

> A handful of backup channels are **Electron-only** and therefore live in `electron/ipc.ts`
> instead of `buildApi()` — they need `dialog`/`app`/`relaunch`, which do not exist in the
> Node harness: `backup.folderOptions`, `backup.chooseFolder`, `backup.setFolder`,
> `backup.reveal`, `backup.restore`. They are permission-gated like any other write.

> The verify harness calls these handlers **directly** (no IPC), so it is unaffected by
> permission enforcement. That separation is deliberate and must be preserved.

## Auth + permissions (the security model)

- **Hashing** (`services/auth.ts`): `bcryptjs` (pure JS — chosen over native `bcrypt` to
  avoid a second ABI-specific native module). `hashSecret`/`verifySecret`; `verifySecret`
  has a one-time legacy path that upgrades any pre-bcrypt plaintext to a hash on first
  successful login. `authenticate(db, {mode,userId?,username?,secret})` returns the
  sanitized user (NO hashes) + the role's permission array.
- **Enforcement lives ONLY at the IPC boundary** (`electron/ipc.ts` + `electron/permissions.ts`),
  never in the services or `buildApi()`:
  - The session (`{userId, roleId, permissions:Set}`) lives in **main-process memory** and
    is NOT persisted — after a real app restart the user signs in again (secure by design).
  - `session.login/logout/current/unlock` and `auth.*` and `setup.*` are handled before the
    gate (they're how you sign in / bootstrap).
  - `electron/permissions.ts` maps each WRITE channel → a required permission id (matching
    `ALL_PERMISSIONS` in `src/stores/users.ts`). Reads are open. Admin (ALL_PERMISSIONS)
    passes everything. Denials return `{ok:false, error:'Permission denied: <perm>'}` (never
    throw). Writes before any login return "Not signed in".
- **First-run** (`services/setup.ts` + ipc): `setup.complete` is a run-once channel allowed
  pre-session only while the `settings_kv 'setup_complete'` flag is unset. It configures the
  seeded `u_admin`/`br_mp`/`role_admin` in one tx (hashing the chosen PIN), sets the flag,
  and establishes the owner session. Replaying it throws.

## Backup & Cloud saving

Split deliberately in two, along the line of "what can the Node harness prove?":

**`backend/services/backup.ts` — pure SQLite + `fs`, fully verified.**
- A backup is a **`VACUUM INTO` snapshot of the whole database**. `VACUUM INTO` is consistent
  while the app is live (no "copy a file mid-write" tearing), compact, and produces a
  standalone file that does not depend on the `-wal`/`-shm` sidecars.
- **Verify before it counts.** Every snapshot is reopened **READ-ONLY** and must pass
  `PRAGMA integrity_check` plus a readable-core-tables check before the run is reported as
  successful. A snapshot that fails verification is **deleted** — an unverifiable file must
  never be sitting there waiting to be restored by mistake.
- Filenames are `pos-backup-YYYYMMDD-HHMMSS.sqlite3` in **local** time, chosen so plain
  string sort == chronological order. **Retention keys off the FILENAME, not the file
  mtime**, because a cloud sync client rewrites mtime on upload/download and would otherwise
  scramble "newest".
- **Retention**: keep the newest N (7 / 14 / 30 / 90, default 14). It runs **only after a
  verified success**, so a failed backup can never be the reason the last good one was
  deleted. Files in the folder that are not our snapshots are **never** touched.
- **CSV export** (`backup.export`): sales, purchases, products, customers, suppliers, stock,
  written to an `exports/` subfolder next to the snapshots (so a cloud folder carries them
  off the machine too). UTF-8 **with a BOM** so Excel on Windows renders Bangla and ৳
  correctly. Stock on-hand in the export is DERIVED from `stock_movements` — never a stored
  column, same rule as everywhere else.
- `SyncTarget` is the documented seam for a hosted provider later. Nothing behind it is
  stubbed or faked today.

**`electron/backup.ts` — the parts that need Electron** and therefore cannot be covered by
the Node harness: resolving Documents via `app.getPath`, detecting cloud folders, the native
folder/file pickers, RESTORE, and the automatic-backup timer.

- **"Cloud" means a folder the owner's own OneDrive / Google Drive / Dropbox desktop client
  already syncs.** The app makes **no outbound network request of its own**, stores no
  third-party credentials, and needs no account. It still works with no internet: the
  snapshot always succeeds locally and the sync client uploads it later. Cloud roots are
  **detected** — a location is only offered if that folder actually exists on the machine,
  never assumed.
- **RESTORE is the most destructive operation in the app**, so it: verifies the chosen file
  first; shows a native confirmation naming the snapshot, its date and its row counts, with
  **Cancel as the default**; takes a `VACUUM INTO` safety copy of the CURRENT database to
  `pre-restore-<timestamp>.sqlite3` before overwriting; **deletes the `-wal`/`-shm`
  sidecars** — a stale WAL would let SQLite replay the OLD pages over the restored file,
  which is silent corruption; then relaunches the app.
- **Schedules**: `off`, `daily`, `on-shift-close` (recommended). `daily` is a "no verified
  snapshot yet today, and it's past 02:00" check on a 10-minute tick, **not a 02:00 alarm** —
  a shop PC is usually switched off overnight and an alarm would silently never fire.
  `on-shift-close` is triggered in `electron/ipc.ts` right after a successful
  `cash.closeShift`, which keeps scheduling and IO policy out of the backend services.

**`openDatabase()` bug found and fixed while building this** (`db/connection.ts`): it created
the handle and then applied pragmas, so if a pragma threw (e.g. the file is not a database —
exactly what a corrupt snapshot does) the OS file handle **leaked** and the file stayed locked
for the rest of the process. It now closes the handle and rethrows. It also accepts
`{ readonly: true }`, which skips the WAL/synchronous pragmas: switching a file to WAL creates
`-wal`/`-shm` sidecars next to it, and that must never happen to a snapshot sitting in a
cloud-synced folder.

> The backup settings blob is owned **solely** by the backend service and read in the renderer
> via `src/stores/backup.ts`. It used to also live in the renderer settings store, which meant
> TWO writers to the same `settings_kv` 'backup' key — saving an appearance preference could
> silently wipe the backup folder path.

## Reports — aggregate in SQL, not on the client

`reports.customerGroup` now computes per-group **customer counts AND outstanding due in SQL**.
It used to merge those two figures in from the customers store on the frontend; once that store
became paginated (one 50-row page) the report silently under-counted every shop with more than
50 customers. Two more corrections came with it:

- Group rows are the **UNION** of "had sales in the range" and "has customers", so a group
  carrying a balance but no sales in the range is no longer invisible.
- Each customer's due is **rounded to 2dp before summing**, so a group total matches the
  Customers screen to the cent.

Sales figures stay range + branch scoped while counts and dues are lifetime / all-branch, and
the page says so — mixing the two silently is how a report starts lying.

## Electron wiring

- `electron/db.ts` — `initDb()` opens `userData/pos.db`, migrates, seeds on first run
  (`POS_SEED`: `demo`/`clean`/`none`; packaged default `clean`).
- `electron/ipc.ts` — registers `api:invoke` (session control + permission gate + forward to
  `buildApi()`, returns `{ok,data}`/`{ok,error}`) and `api:channels`.
- `electron/backup.ts` — the Electron-only half of Backup & Cloud (paths, cloud-folder
  detection, pickers, restore, the schedule tick). Handled + gated in `electron/ipc.ts`.
- `electron/permissions.ts` — the channel→permission map (the gate's policy). The backup
  writes sit behind `settings.backup`; `backup.status` is an open read.
- `electron/main.ts` — calls `initDb()` + `registerIpc()` before the window opens; `closeDb()`
  on quit.
- `electron/preload.ts` — exposes `window.api.db.invoke / .channels` (generic; session.* ride
  the same channel).
- `vite.config.ts` — main bundle externalizes `better-sqlite3`.

## Native module ABI (READ THIS)

`better-sqlite3` is native and ABI-specific. Two runtimes need two builds:
- **Node** (verify harness/CI) — Node ABI
- **Electron** (the app) — Electron ABI

Scripts handle it:
- `npm run rebuild:electron` (= `electron-rebuild -f -w better-sqlite3`) — before dev/pack.
  `npm run dev` runs it automatically. **Run this last every session.**
- `npm run rebuild:node` (= `npm rebuild better-sqlite3`) — before tests.
  `backend:verify*` run it automatically.

Symptom of wrong ABI: `ERR_DLOPEN_FAILED`. Fix: run the matching rebuild script.
`bcryptjs` is pure JS and needs NO rebuild — only `better-sqlite3` does.

## Verification — what's proven

Run `npm run backend:verify:all` → **eight suites, 1,108 checks** (grew from 122 as slices
were wired):

| Suite | Checks | What it covers |
|-------|-------:|----------------|
| `all.ts` | 395 | scenarios + determinism + file-DB smoke + identities |
| `api.ts` | 216 | the `buildApi()` facade |
| `run.ts` | 105 | identities on a 365-day dataset, date ranges, payment detail rows |
| `e2e.ts` | 68 | one full shop day |
| `paging.ts` | 91 | paginated list reads |
| `backup.ts` | 120 | backup, cloud, CSV export, invoice PDFs, pendrive copies |
| `costing.ts` | 93 | purchase-price history, incl. retraction on a cancelled purchase |
| `mirror.ts` | 20 | the renderer's money math vs the calculation core, over randomised inputs |

- **68 E2E** (e2e.ts) — a full shop day through the `buildApi()` facade from a clean
  first-run DB, reconciling every cross-module number (see `docs/06-E2E-AND-SMOKE-TEST.md`).
- **identities** (run.ts) on a 365-day dataset: per-sale total/due/subtotal/profit/cogs;
  per-purchase due + stock-in; stock never negative; ledger formulas; cash reconciliation;
  ref uniqueness; dashboard==raw; report consistency; FK integrity; FTS coverage. Plus two
  range rules that used to differ between screens: a custom range is INCLUSIVE and on the
  local clock, and **a week starts on Saturday** — asserted for all seven weekdays, because
  the Sales and Purchases lists once computed a Monday start client-side.
- **scenarios** (scenarios.ts): exact expected values for WAC, COGS, payments, returns,
  transfers, adjustments, cash drawer, drafts, void, catalog CRUD + archive/restore, purchase
  cancel/delete, sale delete, **correcting a finalized invoice including its payments**,
  contacts CRUD + supplier-pay, expense void/delete/edit drawer reversal, settings CRUD,
  auth (hash/verify/legacy-upgrade), setup (run-once).
- **216 API checks** (api.ts) across **152 registered channels**: the buildApi() facade
  end-to-end incl. write-then-read, per slice (api-catalog/purchases/sales/contacts/cash/
  expenses/dashboard-extra/reports-extra/settings/auth/setup/stockops/warranties/
  price-groups/shipments).
- **91 paging checks** (paging.ts) across all six server-paged channels: paged derived values
  equal the unpaged ones product-by-product and customer-by-customer (stock from movements,
  customer/supplier dues), the three product stock states partition the catalogue, paged
  expenses exclude voided rows, and every channel clamps `pageSize` to 200 and `page` to ≥1.
- **120 backup checks** (backup.ts) — snapshot, integrity verification, the delete-on-failed-
  verify rule, filename-based retention, and CSV export, on real files.
- **83 costing checks** (costing.ts) — the history table is the source of truth and the three
  product columns are a cache that cannot drift from it; a received purchase moves both the
  current and the average buying price; an ordered purchase moves neither; and **cancelling a
  purchase retracts the price it recorded** without deleting the row (schema v7).
- **+ combined** (all.ts, 395 checks): scenarios + identities + determinism (same
  seed→same data) + persistent-file smoke.

Single suites: `npm run backend:verify` (identities), `backend:scenarios`, `backend:e2e`,
`backend:paging`, `backend:backup`.

A failing identity check is a real correctness bug. Add a check for every new invariant.

## Synthetic data

`simulate(db, {days, seed})` drives a year through the real services: opening stock,
weekly restocks, daily shifts with mixed-payment sales (respecting stock), occasional
returns/transfers/adjustments, expenses, shift closes. ~3,000 sales / year. Deterministic.
