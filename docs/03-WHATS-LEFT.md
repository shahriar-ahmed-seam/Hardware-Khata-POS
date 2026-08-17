# What's Left — Prioritized

Status legend: 🔴 not started · 🟡 partial · 🟢 done

## 🟢 Done

- **Frontend**: all 15 task-modules built.
- **Backend data layer**: schema, calculation core, services, synthetic data — proven.
- **Electron bridge**: bundler-safe schema, `buildApi()` facade (152 channels), DB
  lifecycle + generic IPC + preload + renderer `api()` client, native ABI scripts.
- **All 9 data slices wired** to the real backend (the `hasBackend()` mock fallback they were
  wired with has since been removed — see "Mock data fully removed"):
  Products+Stock, Purchases, Sales, Contacts, Cash Register, Expenses, Dashboard, Reports,
  Settings. Plus a cleanup pass (catalog/units CRUD, full-page ProductEdit, stock
  transfers/adjustments persistence, toast-on-write-reject across all stores).
- **Auth + permissions**: `bcryptjs` hashing, backend-verified login/unlock, session in
  main-process memory, WRITE-channel permission enforcement at the IPC boundary.
- **First-run wizard**: writes a real shop via the run-once `setup.complete` channel and
  establishes the owner session; a returning user after restart sees Login, not the wizard.
- **Closed deferrals**: AddSale/AddPurchase create-forms on real master data; Warranties +
  Price Groups backend CRUD; Shipments table + service + channels. Whole-app foolproof audit
  removed every fabricated/mock-number leak under the backend and fixed edit-mode
  duplication on the sell/buy paths.
- **Pagination on every list tab**: six server-paged channels (sales, purchases, products,
  customers, suppliers, expenses) plus client-side paging on the slow-growing lists.
- **Backup & Cloud saving**: verified `VACUUM INTO` snapshots into a folder the owner's own
  cloud client syncs, filename-based retention, guarded restore, CSV export — details below.
- **Packaging + in-app updates**: NSIS x64 per-user installer; the app checks GitHub Releases
  and updates itself when the owner presses the button (`RELEASE.md`).
- **Every numbered known gap closed** — archived-products UI, the branch-name resolvers, one
  definition of a week, the dead receipt toggles, derived figures over a paginated store, a
  sale's payments being correctable, the pendrive-detection fallback, and the decision on what
  a cancelled purchase does to the recorded buying price. See `07-CONTINUE-HERE.md` §4.
- **Verification**: **1,126 checks** pass across eight suites (`npm run backend:verify:all`):
  all.ts 413 · api.ts 216 · run.ts 105 · e2e.ts 68 · paging.ts 91 · backup.ts 120 ·
  costing.ts 93 · mirror.ts 20 (the renderer's money math against the calculation core).

> Per-slice detail (what changed, deferrals) for the wiring + auth + setup work has been
> consolidated; see `05-CONTEXT-AND-HISTORY.md` for the full blow-by-blow and every deferral.

## 🟢 POS Checkout wiring — DONE

`src/pages/POS.tsx` now persists through the backend (the mock fallback mentioned below was
preserved at the time and has since been deleted outright):
- Product picker + customer picker read live backend data (`useProducts('br_mp')`,
  `useCustomersQuery`); stock badges reflect real on-hand.
- Payment confirm maps the cart → `sales.create` (`status:'final'`): lines (productId, qty,
  unitUsed, spr=basePrice, markupPct, discount %/flat, taxPct), order discount/tax/shipping/
  other, payments (Credit EXCLUDED — it's the unpaid remainder; non-credit capped at total so
  change never inflates the drawer). Walk-in (`cu1`) → no customer. Receipt uses the
  backend-returned `invoiceNo` + `due`. On success: invalidates products, rehydrates sales +
  cash. A POS sale now reduces stock, records COGS, routes cash to the open shift, and shows
  up in Sales/Dashboard/Reports/Cash.
- F6/F7 "Save as Draft/Quotation" persist via `sales.create` with `status` + no payments →
  appear in Sales → Drafts/Quotations. Park/Hold/Suspend stay client-side (multi-cart UX).
- Permission-guarded (cashier has `sales.create`); totals cross-check toasts on >0.01 drift;
  warns if cash is taken with no open shift. **Backend checks still pass (611 at that point
  with E2E + closed deferrals; the suite is 860 today).**
- _Deferred_: multi-unit `unitFactor` left at 1 (cart doesn't model packs yet); convert-
  quotation-to-sale / edit-draft are Sales-module concerns; receipt amount-in-words uses the
  frontend helper.

> Owner note: this is the hero screen and the owner wanted a deep UX pass on it. The data
> wiring is complete and correct; a dedicated UX polish round can follow whenever the owner
> wants it.

## 🟢 Final end-to-end test — DONE

`backend/verify/e2e.ts` (run via `npm run backend:e2e`, also part of `backend:verify:all`)
drives a **full shop day through the `buildApi()` facade from a clean first-run DB**
(`migrate` + `seedMaster`, no demo sim) and reconciles every cross-module number:
first-run wizard → open shift → receive purchase (stock-in + supplier due + drawer) → POS
cash sale (due 0, stock down, drawer up, in sales.list) → credit sale + customer due +
partial payment → sell return (restock + refund) → expense create+void (drawer) → stock
transfer (source/dest/conserved) → damage adjustment → close shift (variance 0) → the
money-conservation finale (dashboard==raw, P/L identity, reports.stock = Σ stock×cost two
ways, no negative stock, FK clean). **68 E2E checks; the grand total was 611 then and is 860
today**, all green. The E2E found **no bugs** — every identity reconciled on the first clean run.

A manual GUI smoke-test checklist for the owner lives in `docs/06-E2E-AND-SMOKE-TEST.md`
(covers the parts a script can't click, including the cashier permission gate).

## 🟢 Bangla UI, legibility, decluttering, mock removal, responsive — DONE

Five owner-requested changes landed after the E2E pass:

1. **Whole-UI Bangla.** `src/lib/bn/dict.ts` (now **2,105 distinct phrases**) +
   `src/lib/bn/translate.ts`, a DOM translation layer driven by the titlebar EN/বাং toggle.
   Exact-match lookup on a fixed dictionary, so shop DATA (product names, invoice numbers,
   amounts, phones) can never be rewritten.
   `npm run i18n:extract` lists remaining untranslated source strings;
   `npm run i18n:check` runs **32 assertions** including a full EN→BN→EN round trip across
   simulated React re-renders. Opt a subtree out with `data-no-i18n`.
   The newest guard exists because the dictionary is append-only via successive
   `Object.assign(BN, {…})` blocks: the same key CAN appear in more than one block and the
   last one silently wins. The check parses the SOURCE file and fails if two blocks disagree
   on a translation, so a duplicate can't quietly overwrite a reviewed phrase.
2. **Legibility (the owner is elderly).** ~600 hard-coded `text-[Npx]` utilities are
   redefined in `rem` in `globals.css` (9→12, 10→13, 11→14, 12→15, 13→16 …) so everything is
   bigger AND finally responds to the Appearance font-scale slider. Tailwind's own scale is
   +2px per step. Light-mode text pushed near-black and muted text darkened (46%→30%
   lightness); dark-mode text near-white and muted brightened (60%→80%). Low `opacity-*`
   steps lifted. Semantic colours (`primary`/`success`/`warning`/`destructive`) deliberately
   stay mid-lightness — they are used as filled button backgrounds AND as text on `/10` chips.
3. **Redundancy removed.** Dead branch-switcher button (branch name was shown twice);
   hard-coded "Synced · 2m" pill (no sync layer exists); duplicate brand block in the sidebar
   header; Ctrl+K hinted three times in one search box; the CommandPalette (its only job was
   "Go to <page>", which the sidebar does); seven per-module "Import …" sidebar rows collapsed
   into one `/import` hub; the dead "Variations" placeholder page; the fake "4" stock-alert badge.
4. **Sidebar merge.** SMS + Expenses + Reports + Settings are one **More & Settings** group.
   Top level went 12 → 9 entries, with bigger touch targets.
5. **Responsive shell.** `src/hooks/useBreakpoint.ts`; sidebar auto-collapses below `lg` and
   becomes an overlay drawer with a scrim below `md`; titlebar progressively drops the density
   toggle, shift label, shop name and user name; PageHeader wraps; POS stacks its two panels
   below `lg`. Electron `minWidth` lowered 1100→900 and `minHeight` 700→600.

## 🟢 Mock data fully removed — DONE

The app no longer contains a mock/sample data path. `src/mocks/data.ts` is **deleted**.

- Domain types (`Product`, `Customer`, `Supplier`, `Sale`, `Category`, `Brand`, `Unit`) moved
  to **`src/types/domain.ts`** — they had been living inside the mocks file, which is why the
  mock module was imported in ~80 files that only wanted a type.
- Every `hasBackend() ? backendData : mockData` fallback is gone from all stores, hooks, pages
  and components. `hasBackend()` survives ONLY as the "don't fire this query outside Electron"
  gate on `useReport`, never as a data source.
- Fabricated numbers removed: dashboard KPI deltas (12.4 / 4.1 / −2.6), CashRegisterCard's
  5000/84200/14200 and "Shift #1234", ProfitLoss's hardcoded 425000/412000 opening/closing
  stock and its `rev * 0.22` COGS guess, SalesRep's "60% paid / 40% pending" commission split,
  ProductSell's `unitPrice * 0.78` cost estimate, TrendingPage's flat sparkline.
  Anything with no backend source now renders '—' and is excluded from totals.
- Credential/identity leaks removed: the login screen no longer prints "Demo PINs: Seam 1234 ·
  Rana 1111" or "username seam · password admin123"; `settings.ts` `DEFAULT_BUSINESS` identity
  strings are blank (they printed on real receipts); `Receipt.tsx` lost its placeholder
  'HARDWARE POS' / 'Mirpur 10, Dhaka' header.
- `stores/auth.ts` no longer compares PINs/passwords in the renderer at all — a login can only
  succeed via the main-process bcrypt check.
- **The last mock path, in the First-Run Wizard, is gone.** It had a "MOCK PATH (no backend)"
  branch that wrote to local stores when `hasBackend()` was false. Outside the desktop app the
  wizard now refuses with a clear message, because the only thing that branch could produce was
  a shop that *looks* configured with no database behind it. Its prefilled placeholder identity
  values ('Hardware POS', 'Mirpur 10, Dhaka', 'Shop Owner', 'owner') are now BLANK — those
  strings print on customer receipts.
- **Seeding:** `POS_SEED` now defaults to `clean` **everywhere** (it used to default to `demo`
  in dev, seeding ~3,000 invented sales). `clean` calls `seedMaster(db, { referenceOnly: true })`,
  which seeds only roles, tax rates, invoice schemes, categories/brands/units, expense
  categories, ONE neutral "Main Branch", ONE owner account and the Walk-in customer — no
  products, customers, suppliers, agents or transactions, and a BLANK business identity for the
  wizard to fill. `POS_SEED=demo` still gives the full synthetic year for evaluation, and the
  default (non-referenceOnly) fixture is byte-identical so the verification suite is unaffected.

> ⚠️ An existing `userData/pos.db` is NOT reseeded (first-run only). To see the clean install,
> delete `userData/pos.db` (plus `-wal`/`-shm`) and relaunch.

**Verification after all of the above: every backend check still passes** (611/611 at the time,
860/860 today), frontend and backend typechecks are clean, and `npm run build` succeeds.

## 🟢 List performance — the N+1 that froze the app — FIXED

**Symptom:** opening Sales hung the whole app for seconds; nothing responded until it finished.

**Cause:** the stores loaded lists like this —

```ts
const list = await api('sales.list', {});                     // EVERY row, unbounded
await Promise.all(list.map(r => api('sales.get', { id })));   // one IPC call PER ROW
```

On a year of history that is 3,252 separate IPC round-trips, each running synchronous
better-sqlite3 **on the main process**, which is why the UI froze rather than just being slow.
`purchases` had the identical pattern, and `cashRegister` had a smaller one
(`shifts.list` → `cash.shiftTotals` per shift, ~340 calls).

**Fix:**
- New `backend/services/paged.ts`, now covering **six server-side paged channels**: sales,
  purchases, products, customers, suppliers, expenses. Each returns
  `{ rows, total, page, pageSize }` with
  lines/payments/audit already attached, using **~5 statements per page** regardless of history:
  one `COUNT(*)`, one page of headers with `LIMIT/OFFSET`, and one batched `IN (…)` query per
  child table. All filtering (status, customer, user, method, date range, free text) is pushed
  into SQL; `pageSize` is clamped to 200 so no caller can ask for the whole table.
- Stores hold ONE page: `total`, `query`, `loadPage(patch)`, and `hydrate()` re-runs the last
  query after a write. Stale responses are dropped via a request token so fast typing/paging
  can't overwrite newer rows.
- Sales / Drafts / Quotations / Purchases use `<Pagination>` (`src/components/ui/Pagination.tsx`)
  with server-side filters and a 300 ms debounce on free-text search. Drafts and Quotations own
  `statuses: ['draft'] / ['quotation']` instead of filtering a full client list.
- `SaleDetail` falls back to `sales.get` when the row isn't on the loaded page (deep links,
  search results), with loading and "not found" states.
- `cashRegister.hydrate()` bounds the derived-totals loop to the open shift plus the newest
  `SHIFT_HISTORY_LIMIT` (30) shifts.
- **Client-side pagination** covers the remaining list tabs — SellReturns, PurchaseReturns,
  StockTransfers, StockAdjustments, Shipments. Their list channels are header-only and these
  lists grow slowly, so paging them in the renderer is enough and avoids six more SQL paths.
  Their KPI strips still sum the **full filtered set** (all rows are already in memory),
  unlike the server-paged screens, which are labelled "(this page)".

**Measured on one simulated year (3,252 sales):**

| | time | SQL statements |
|---|---|---|
| old N+1 | 813 ms | 13,009 |
| new paged read | 11 ms | 5 |

≈ **74× faster to first paint**, and that 813 ms is pure in-process SQLite — the real app also
paid an IPC round-trip per call, so the practical improvement is larger.

**Covered by `backend/verify/paging.ts` (33 → 80 checks):** pageSize respected and clamped
(`pageSize` to 200, `page` to ≥1 on all six channels), `total` reflects the filter not the page,
walking every page visits each row exactly once with no duplicates, newest-first ordering, every
filter narrows correctly, out-of-range pages behave — and, critically, the **batched nested
lines/payments/audit are asserted byte-identical to `sales.get`**, since that equivalence is the
correctness risk of batching. The newer checks extend the same principle to derived values:
**paged derived figures equal the unpaged ones product-by-product and customer-by-customer**
(stock from movements, customer/supplier dues), the three product stock states partition the
catalogue with nothing double-counted or dropped, and paged expenses exclude voided rows.

Known limitation, stated in the UI: on the **server-paged** screens the KPI strips sum the
**current page** only (labelled "this page", with a pointer to Reports for full-range figures),
and the Paid/Partial/Due chips filter the current page because they are derived from
`paid`/`due` rather than a DB status column. The client-paged tabs don't have this limitation —
they hold every filtered row, so their KPIs cover the whole filtered set.

## 🟢 Dashboard polish — DONE

- **KPI colours dimmed.** They were solid saturated blocks (`bg-blue-600`, `bg-emerald-600`, …)
  with white text — a wall of colour, and white-on-amber was hard to read. Now a normal card
  surface with a soft tint, a thin accent bar and a tinted icon tile, so the **number itself is
  plain high-contrast foreground text**.
- **Empty widgets no longer reserve space.** Every list widget hardcoded `min-h-[200px]` (charts
  `h-64`, donuts `min-h-[220px]`), so an empty shop showed a page of tall blank boxes. Widgets
  now collapse to a compact note when empty and only reserve height when they have content.
  Loading still reserves height, to avoid layout jump.
- Removed the last fabricated dashboard number: the hardcoded `+12.4%` badge on the Hourly Sales
  widget.
- Bangla coverage extended to every KPI label/description, widget title/subtitle, widget empty
  state and the new pagination controls. The dictionary has since grown to **2,105 phrases**.

## 🟢 Backup & Cloud saving — DONE

This used to sit under "Deferred / later" as *cloud sync*, waiting on a Supabase/S3/Drive
provider adapter. It shipped instead as something a shop can actually rely on with no account,
no subscription and no internet: **the app writes verified snapshots of the database into a
folder the owner's own cloud client already syncs.**

- **`backend/services/backup.ts`** is pure SQLite + `fs`, deliberately, so the Node harness can
  verify all of it. A backup is a **verified `VACUUM INTO` snapshot of the whole database**:
  consistent while the app is live, compact, and independent of the `-wal`/`-shm` sidecars.
- **Nothing counts as a success until it is verified.** Each snapshot is reopened READ-ONLY and
  must pass `PRAGMA integrity_check` plus a readable-core-tables check. A snapshot that fails
  verification is **deleted**, so a corrupt file can never be restored by mistake.
- Filenames are `pos-backup-YYYYMMDD-HHMMSS.sqlite3` in **local** time and sort chronologically
  as plain strings. **Retention uses the FILENAME, not the file mtime** — a cloud sync client
  rewrites mtime, which would otherwise make "newest" meaningless.
- **Retention** keeps the newest N (7/14/30/90, default 14) and runs **only after a verified
  success**, so a failed backup can never be the reason the last good one was deleted. Files in
  the folder that aren't our snapshots are **never** deleted.
- **"Cloud" = a folder OneDrive / Google Drive / Dropbox already syncs.** The app makes **no
  outbound network request of its own**, stores no third-party credentials and needs no account.
  It works with no internet too: the snapshot always succeeds locally and the sync client
  uploads it later. Cloud roots are **detected** — only offered if the folder exists on that
  machine, never assumed. `SyncTarget` in `backup.ts` is the documented seam for a hosted
  provider later; nothing is stubbed or faked.
- **`electron/backup.ts`** holds the parts that need Electron and so can't be covered by the
  Node harness: resolving Documents via `app.getPath`, cloud-folder detection, the native
  folder/file pickers, RESTORE, and the automatic-backup timer.
- **RESTORE** is the most destructive operation in the app, so it verifies the file first; shows
  a native confirmation naming the snapshot, its date and its row counts, **defaulting to
  Cancel**; takes a `VACUUM INTO` safety copy of the CURRENT database to
  `pre-restore-<timestamp>.sqlite3` before overwriting; **deletes the `-wal`/`-shm` sidecars**
  (a stale WAL would let SQLite replay the OLD pages over the restored file — silent
  corruption); then relaunches the app.
- **Schedules**: `off`, `daily`, `on-shift-close` (recommended). `daily` is a "no verified
  snapshot yet today, and it's past 02:00" check on a 10-minute tick, **not a 02:00 alarm** — a
  shop PC is usually switched off overnight and an alarm would silently never fire.
  `on-shift-close` fires in `electron/ipc.ts` right after a successful `cash.closeShift`, which
  keeps scheduling/IO policy out of the backend services.
- **Real CSV export** (`backup.export`): sales, purchases, products, customers, suppliers,
  stock. Written to an `exports/` subfolder next to the snapshots (so a cloud folder carries
  them off the machine too), UTF-8 **with a BOM** so Excel on Windows renders Bangla and ৳
  correctly. Stock on-hand in the export is DERIVED from `stock_movements`, never a stored
  column.
- **Channels**: `backup.status` (open read) and, gated behind `settings.backup`, `backup.run`,
  `backup.configure`, `backup.export`, `backup.verify`. The Electron-only ones live in
  `electron/ipc.ts` (also gated): `backup.folderOptions`, `backup.chooseFolder`,
  `backup.setFolder`, `backup.reveal`, `backup.restore`.
- **The First-Run Wizard's cloud step is real now.** The toggle sets the schedule, and
  immediately AFTER `setup.complete` (which is what creates the owner session, so the gated
  backup channels are callable) the wizard points the folder at a detected cloud root if the
  owner asked for one and takes the FIRST snapshot — a brand-new shop is never "backup
  configured but no backup exists".
- **`Settings → Backup & Sync` is renamed `Backup & Cloud`** and the page is fully real: every
  value is read back from the backend after each action, and the old mocked provider buttons and
  fake sync history are gone.
- **A real data-loss bug closed on the way:** the backup settings blob used to live in the
  renderer settings store as well, which meant TWO writers to the same `settings_kv` 'backup'
  key — saving an appearance preference could silently wipe the backup folder path. It is now
  owned solely by the backend service and read via `src/stores/backup.ts`.
- **`openDatabase()` handle leak fixed** (`backend/db/connection.ts`): it created the handle and
  then applied pragmas, so if a pragma threw (e.g. the file is not a database — exactly what a
  corrupt snapshot does) the OS file handle leaked and the file stayed locked for the rest of
  the process. It now closes the handle and rethrows. It also accepts `{ readonly: true }`,
  which skips the WAL/synchronous pragmas: switching a file to WAL creates `-wal`/`-shm`
  sidecars next to it, and that must never happen to a snapshot in a cloud-synced folder.
- **Verified by `backend/verify/backup.ts` (68 checks)**, in `backend:verify:all` and standalone
  via `npm run backend:backup`.

## 🟢 Customer Group report under-counting — FIXED

`reports.customerGroup` now aggregates per-group **customer counts AND outstanding due in SQL**.
It used to merge those two figures in from the customers store on the frontend; when that store
became paginated (one 50-row page) the report silently under-counted every shop with more than
50 customers — a wrong number with no error, which is the worst kind.

- Group rows are now the **UNION** of "had sales in the range" and "has customers", so a group
  carrying a balance but no sales in the range is no longer invisible.
- Each customer's due is **rounded to 2dp before summing**, so a group total matches the
  Customers screen to the cent.
- Sales figures stay range + branch scoped while counts and dues are lifetime / all-branch, and
  the page says so.

## 🟢 Packaging + in-app updates — DONE

- electron-builder, Windows NSIS, **x64 only** (the earlier `["x64","ia32"]` target would have
  shipped a broken native module). Icon generated from `build/icon.svg` by `npm run icon`.
- `better-sqlite3` is rebuilt for the **bundled** Electron at package time — the #1 packaging
  risk, and it holds. `bcryptjs` is pure JS and needs no rebuild.
- Packaged seed is `clean`, so a fresh install opens the first-run wizard.
- **The app updates itself** from GitHub Releases from 0.2.0 onward — never automatically,
  only when the owner presses Download. Full procedure in `RELEASE.md`.
- Still open, and both need money rather than code: **code signing** (unsigned installers make
  SmartScreen warn on a new PC) and a **per-machine install** (currently per-user, which is why
  it needs no elevation).

## 🔴 The one remaining item: the manual GUI smoke test

`docs/06-E2E-AND-SMOKE-TEST.md`. A script cannot click, and it cannot judge whether a receipt
reads correctly on a 58mm roll or whether the Bangla layout still fits. Everything a script
*can* prove is proven — 1,126 checks.

## ✅ Final rigorous end-to-end test (DONE)

The owner's last thorough pass is complete: a foolproof audit + the 68-check full-shop-day
E2E reconcile every cross-module number against the verification suite. A whole-app audit
removed all fabricated/mock-number leaks under the backend (P/L stock-snapshot placeholders,
Sales-Rep payout split, SaleDetail/Shipment customer source) and closed two edit-mode
duplication bugs (AddSale convert/edit; AddPurchase edit). The remaining human-only step is
the manual GUI smoke test in `docs/06-E2E-AND-SMOKE-TEST.md`.

## 🟡 Smaller follow-ups (nice-to-have before or after packaging)

- **Sell-return / purchase-return detail lines**: list channels are header-only; add a
  `get`-with-lines if the return detail view needs line breakdown.
- **Transfer cancel/reversal**: no backend handler — `cancelTransfer` refuses under backend
  (it will NOT fake a status that would desync stock). Add a reversing handler if needed
  (must reverse the stock movements safely).
- **Commission payout ledger**: Sales-Rep report shows real earned commission; "paid" is 0
  and the full amount is "pending" until a payout-entry table + channel exist.

## 🟡 Deferred / later (need external pieces or are explicitly post-MVP)

- **SMS gateway**: real BD provider integration (SSL Wireless / BulkSMSBD / etc.),
  delivery-report webhooks, auto-send triggers. Needs an external account. Frontend done.
- **Hosted multi-device sync**: off-machine safety is already covered by Backup & Cloud (see
  the DONE section above). What is still absent is *live* row-level sync between machines:
  `sync_outbox` exists and `SyncTarget` in `backend/services/backup.ts` is the documented seam,
  but it would need a hosted account, an online detector and conflict resolution
  (last-write-wins per row + version). Post-MVP.
- **Thermal printing**: ESC/POS rendering for receipts + Z-reports; cash-drawer kick.
- **Nightly stock valuation snapshot job** for exact opening/closing stock in P/L (currently
  those rows are labeled placeholders; live aggregates are used elsewhere).
- **Recurring expense automation** (background job; flags are stored).
- **Per-user prefs in DB** (column visibility, dashboard layout, shortcuts) — currently
  localStorage / app-wide `settings_kv`.
- **Barcode/QR real rendering** (Code128/EAN-13 SVG) for labels + receipts.
- **Multi-branch context**: a real branch switcher feeding `branchId` everywhere. The id↔name
  translation and every branch-name literal are gone (one resolver, `src/lib/branch.ts`), but
  about fifteen WRITE call sites still pass the literal id `'br_mp'` where they mean "the
  shop's default branch" — POS, AddSale, AddPurchase, ProductPanel, QuickUpdateModal,
  NewProductDrawer, StockAlerts, useDashboardData, and the return/shipment/supplier-payment
  writes in `stores/{sales,purchases,contacts}.ts`. Harmless while the seed always creates
  `br_mp` as the default branch. `defaultBranchId()` is what they become; do it in one pass
  with the switcher, not piecemeal.
- **Offline secure PIN reset code** for the owner-locked-out case.

## Known gotchas / risks

- **Native ABI** — the recurring footgun. Always match the rebuild script to the runtime;
  finish every session with `npm run rebuild:electron`.
- **better-sqlite3 at package time** — must rebuild for the bundled Electron.
- **Money rounding** — always go through `core/money.ts`; never sum raw floats in new code.
- **Stock/balances** — never add stored running columns; keep deriving from movements/
  transactions, or the verification suite will (correctly) fail.
- **Permission gate** — enforcement lives ONLY in `electron/ipc.ts` + `electron/permissions.ts`.
  Do NOT move it into backend services (it would break the Node verify harness). Any new
  WRITE channel should get an entry in `electron/permissions.ts`.
- **Session is not persisted** — after an app restart the user re-signs-in. That's intended.
- **Never let a snapshot become a WAL database** — open snapshot files with
  `openDatabase(file, { readonly: true })`. The WAL pragma would create `-wal`/`-shm` sidecars
  next to the snapshot, and a snapshot in a cloud folder must stay a single self-contained file.
  On restore, the current DB's sidecars must be deleted or SQLite can replay old pages over the
  restored file.
- **Retention reads filenames, not mtimes** — a cloud sync client rewrites mtime. Don't
  "simplify" it back to `fs.stat`.
