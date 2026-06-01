# Backend — Complete Reference

Offline-first SQLite data layer. Pure, synchronous, fully tested in plain Node, and
wired into Electron via a generic IPC bridge with permission enforcement. See also
`backend/README.md`.

## Folder map (`backend/`)

```
db/
  connection.ts   openDatabase / migrate / tx / resetDatabase + pragmas (WAL, FK on)
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
api.ts            buildApi(): flat { channel -> handler(db, payload) } — 132 channels
README.md         architecture deep-dive
```

## Database schema (v1)

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
- **Sync**: `sync_outbox` (for the future cloud layer).

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
- **Purchase (received)**: increases stock, routes cash out to shift. `cancelPurchase`
  reverses stock-in + cash (idempotent); `deletePurchase` guards received purchases.
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

`buildApi()` returns `{ channel: (db, payload) => result }`. **132 channels** grouped:
reads (`*.list`, `*.get`, `search.global`), writes (`sales.create`, `purchases.create`,
`*.void`, `cash.openShift`, catalog/contacts/settings CRUD, ...), aggregations
(`dashboard.*`, `reports.*`), and auth helpers (`auth.authenticate`, `auth.verifyPin`,
`auth.setSecret`, `setup.complete`, `setup.status`). This is the surface IPC forwards to.

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

## Electron wiring

- `electron/db.ts` — `initDb()` opens `userData/pos.db`, migrates, seeds on first run
  (`POS_SEED`: `demo`/`clean`/`none`; packaged default `clean`).
- `electron/ipc.ts` — registers `api:invoke` (session control + permission gate + forward to
  `buildApi()`, returns `{ok,data}`/`{ok,error}`) and `api:channels`.
- `electron/permissions.ts` — the channel→permission map (the gate's policy).
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

Run `npm run backend:verify:all` → **611 checks** (grew from 122 as slices were wired):
- **68 E2E** (e2e.ts) — a full shop day through the `buildApi()` facade from a clean
  first-run DB, reconciling every cross-module number (see `docs/06-E2E-AND-SMOKE-TEST.md`).
- **56 identities** (run.ts) on a 365-day dataset: per-sale total/due/subtotal/profit/cogs;
  per-purchase due + stock-in; stock never negative; ledger formulas; cash reconciliation;
  ref uniqueness; dashboard==raw; report consistency; FK integrity; FTS coverage.
- **scenarios** (scenarios.ts): exact expected values for WAC, COGS, payments, returns,
  transfers, adjustments, cash drawer, drafts, void, catalog CRUD, purchase cancel/delete,
  sale delete, contacts CRUD + supplier-pay, expense void/delete/edit drawer reversal,
  settings CRUD, auth (hash/verify/legacy-upgrade), setup (run-once).
- **193 API checks** (api.ts) across **132 registered channels**: the buildApi() facade
  end-to-end incl. write-then-read, per slice (api-catalog/purchases/sales/contacts/cash/
  expenses/dashboard-extra/reports-extra/settings/auth/setup/stockops/warranties/
  price-groups/shipments).
- **+ combined** (all.ts, 294 checks): scenarios + identities + determinism (same
  seed→same data) + persistent-file smoke.

A failing identity check is a real correctness bug. Add a check for every new invariant.

## Synthetic data

`simulate(db, {days, seed})` drives a year through the real services: opening stock,
weekly restocks, daily shifts with mixed-payment sales (respecting stock), occasional
returns/transfers/adjustments, expenses, shift closes. ~3,000 sales / year. Deterministic.
