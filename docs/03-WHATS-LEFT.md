# What's Left — Prioritized

Status legend: 🔴 not started · 🟡 partial · 🟢 done

## 🟢 Done

- **Frontend**: all 15 task-modules built.
- **Backend data layer**: schema, calculation core, services, synthetic data — proven.
- **Electron bridge**: bundler-safe schema, `buildApi()` facade (132 channels), DB
  lifecycle + generic IPC + preload + renderer `api()` client, native ABI scripts.
- **All 9 data slices wired** to the real backend with a `hasBackend()` mock fallback:
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
- **Verification**: **611 checks** pass (`npm run backend:verify:all`).

> Per-slice detail (what changed, deferrals) for the wiring + auth + setup work has been
> consolidated; see `05-CONTEXT-AND-HISTORY.md` for the full blow-by-blow and every deferral.

## 🟢 POS Checkout wiring — DONE

`src/pages/POS.tsx` now persists through the backend (mock fallback preserved):
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
  warns if cash is taken with no open shift. **Backend checks still pass (now 611 with E2E + closed deferrals).**
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
ways, no negative stock, FK clean). **68 E2E checks; grand total now 611**, all green. The
E2E found **no bugs** — every identity reconciled on the first clean run.

A manual GUI smoke-test checklist for the owner lives in `docs/06-E2E-AND-SMOKE-TEST.md`
(covers the parts a script can't click, including the cashier permission gate).

## 🔴 Packaging (final phase)

- electron-builder config (Windows NSIS installer; app icon from `build/icon.svg` → `.ico`).
- **Native rebuild at package time**: ensure `better-sqlite3` is rebuilt for the bundled
  Electron (electron-builder `npmRebuild`/`afterPack`/`beforeBuild`). This is the #1
  packaging risk. `bcryptjs` is pure JS — no rebuild needed.
- Splash should wait for DB-ready.
- Decide packaged seed (`clean` → first-run wizard) and confirm the wizard flow on a fresh
  `userData/pos.db`.
- Code signing (optional/future).

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
- **Cloud sync**: `sync_outbox` table exists; needs an online detector + provider adapter
  (Supabase/S3/Google Drive) + conflict resolution (last-write-wins per row + version).
- **Thermal printing**: ESC/POS rendering for receipts + Z-reports; cash-drawer kick.
- **Nightly stock valuation snapshot job** for exact opening/closing stock in P/L (currently
  those rows are labeled placeholders; live aggregates are used elsewhere).
- **Recurring expense automation** (background job; flags are stored).
- **Per-user prefs in DB** (column visibility, dashboard layout, shortcuts) — currently
  localStorage / app-wide `settings_kv`.
- **Barcode/QR real rendering** (Code128/EAN-13 SVG) for labels + receipts.
- **Multi-branch context**: a real branch switcher feeding `branchId` everywhere (today the
  app assumes `br_mp` / single branch in writes).
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
