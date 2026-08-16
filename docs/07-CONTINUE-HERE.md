# Continue Here — Session Handoff

> **New session? Read this file first, then `04-AGENT-HANDOFF.md` for the rules.**
> The most recent work is **§3d** (the gap-clearing session); §3, §3b and §3c are
> earlier sessions, newest first. §4 is the gap list — every numbered gap in it is
> now closed, and §4a records the one judgement call that needed deciding rather
> than just fixing.

---

## 1. Prove the state before touching anything

> **Version is now 0.2.0 and the app UPDATES ITSELF** from GitHub Releases.
> Bump `package.json` version + `npm run release:win` to ship — see `RELEASE.md`.
> Editing the frontend? `docs/08-FRONTEND-MAP.md` says which file draws what.

```bash
npm install                        # if node_modules is missing — READ THE NPM NOTE BELOW
npm run backend:verify:all         # must print 1,078 checks across SEVEN suites
npx tsc --noEmit -p tsconfig.json  # frontend typecheck — clean
npx tsc --noEmit -p tsconfig.backend.json
npm run build                      # renderer + main + preload
npm run i18n:check                 # 32 checks, 2,385 Bangla phrases
npm run rebuild:electron           # LEAVE IT ON THE ELECTRON ABI (see §6)
```

> **npm 11 blocks install scripts.** On npm ≥ 11.17 a plain `npm install` finishes
> "successfully" but skips every postinstall, so `better-sqlite3` has no compiled
> binary, `electron` has no `electron.exe` and `esbuild` has no platform binary —
> nothing runs. `package.json` therefore carries an `allowScripts` block for those
> three (all direct dependencies). If a fresh clone still reports
> `npm warn allow-scripts`, run `npm approve-scripts --allow-scripts-pending` and
> then `npm install` again.

> `npm run lint` does NOT work — eslint is not in devDependencies. `tsc` is the
> only static gate. Don't chase the failure; either install eslint deliberately
> or leave it.

Expected per-suite counts:

| Suite | Checks | Covers |
|-------|-------:|--------|
| `all.ts` | 395 | scenarios + determinism + file-DB smoke + identities, incl. **correcting an invoice's payments** |
| `api.ts` | 216 | the `buildApi()` facade — **152 channels** |
| `run.ts` | 105 | identities on a 365-day dataset, custom date ranges, **Saturday week start**, **payment detail rows == report total** |
| `e2e.ts` | 68 | one full shop day |
| `paging.ts` | 91 | paginated list reads + Paid/Partial/Due filtering |
| `backup.ts` | 120 | backup, cloud, CSV export, invoice PDFs, pendrive copies |
| `costing.ts` | 83 | purchase-price history, purchases feeding it, **a cancelled purchase retracting its price**, migration head (**v7**) |
| **total** | **1,078** | |

Single suites: `backend:verify`, `backend:scenarios`, `backend:e2e`,
`backend:paging`, `backend:backup`, `backend:costing`.

---

## 2. Where the product is right now

Shipping, installed, and self-updating. The last published release is **0.6.0**
(NSIS, x64, per-user, ~82 MB) and the app updates itself from GitHub Releases —
bump `package.json` and `npm run release:win`, see `RELEASE.md`.

0.6.0 is the gap-clearing session's work (§3d), committed and tagged `v0.6.0` on
`main`.

The owner's live database is at `%APPDATA%\pos\pos.db`. The schema HEAD is now
**v7**; migrations are additive and run on launch, so their database upgrades in
place. One active account: `u_admin`, name **Seam**, username `owner`, PIN set, no
password.
Their backup folder is already `C:\Users\Seam\OneDrive\HardwareKhataPOS\Backups`,
so snapshots *and* invoice PDFs cloud-sync via OneDrive.

The working tree is clean at `v0.6.0`. **Do not commit unprompted** — ask the owner
first, as always.

---

## 3d. What landed in the gap-clearing session (the most recent work)

Every numbered gap in §4 closed. The suite went **999 → 1,078** checks, the channel
count 150 → 152, and the schema to **v7**. Each gap looked small on the surface and
most had a real bug underneath; §4 has the details. The short version:

- Archived products got a screen (**Active / Archived** on the Products page, with
  Restore) — and `ProductEdit` stopped rendering an archived product as a blank
  "new product" form, which is what it did before.
- **One** branch resolver (`src/lib/branch.ts`) replaced five, two of which held the
  demo fixture's `'Mirpur Branch'`. Two write paths that could stamp a row with the
  wrong branch id — or a null one — now refuse rather than guess.
- **One** definition of a week (Saturday), and the renderer's custom-range parser
  stopped reading a bare `YYYY-MM-DD` as UTC.
- `showLineDiscount` implemented; `showLineTax` removed because it could not be made
  honest. The receipt's line subtotal now uses the shared `lineSubtotal()`, which
  restored a missing `max(0, …)` clamp.
- The two payment reports aggregate their detail rows in SQL
  (`reports.sellPaymentRows` / `reports.purchasePaymentRows`) instead of over one page
  of a store, so the footer total and the rows above it finally agree.
- A finalized invoice's **payments** can be corrected in place.
- Pendrive backup distinguishes "no drive" from "could not look", and offers
  `backup.toFolder` when Windows will not answer.
- A cancelled purchase **retracts** the buying price it recorded — see §4a.
- The browser-preview sample data is now a documented, dev-only, money-free
  exception that Vite drops from production builds.
- `package.json` gained an `allowScripts` block: npm 11 blocks install scripts, and
  without it `better-sqlite3`, `electron` and `esbuild` install with no binaries at
  all, so nothing runs (see §1).

---

## 3. What landed in the packaging/PDF session (older)

**Packaging.** Two competing electron-builder configs existed (`electron-builder.json`
silently won over the `build` block in package.json) — the package.json block is
now deleted. Target was `["x64","ia32"]`, which would have shipped a broken
native module; x64 only now. Icon is generated from `build/icon.svg` by
`npm run icon` (`scripts/make-icon.cjs` rasterises it with Electron itself,
because no image converter is installed and electron-builder will not take SVG).

**Google Fonts removed.** It was the app's only outbound request, blocked first
paint on an offline counter PC, and correlated with repeated
`Network service crashed` in the packaged build. The font stacks now fall back to
what Windows ships (Segoe UI / Consolas / Nirmala UI for Bangla).

**Login lockout — two separate bugs, both fixed.** `LoginPage` rendered accounts
from a store nothing hydrated before login, so the account list was empty and
there was no way in. AND the PIN pad auto-submitted at
`selectedUser?.pin?.length ?? 4` — but `users.list` is sanitised and never returns
a PIN, so that was *always* 4: any 5–6 digit PIN fired a failed login on the 4th
digit and cleared the field. Both screens (`LoginPage`, `LockScreen`) now hydrate
themselves, have explicit **Sign in** / **Unlock** buttons, and no length guessing.
Guarded by 5 checks in `scenarios.ts`.

**Printing was completely broken.** `@media print` hid every child of `.app-shell`
keyed on a `print-frame-root` class **nothing ever applied**, and `PrintFrame` was
imported by nobody. Every receipt printed a blank page. Now `PrintSheet` portals
outside `#root`, prints black-on-white regardless of theme, and follows the paper
width from Settings → Printers.

**POS screen.** Product grid sizes columns from the *panel* width
(`auto-fill minmax(170px)`) — viewport breakpoints were the bug, `2xl:` fired on a
wide window and crammed 4 columns into a ~600px panel. Real images via
`ProductImage`. Bottom bar rebuilt in flexbox (the `⋯` was `col-span-1` of 12 ≈ 40px).
Carts persist via `src/stores/posCart.ts` and are **revalidated against the live
catalogue on restore**. Fixed a money bug: switching price group never re-priced
lines already in the cart.

**Purchase-price history** (`backend/services/costing.ts`, schema v4). Append-only
`product_cost_history` is the source of truth; `products.cost` / `avg_cost` /
`cost_updated_at` are a cache **recomputed from it on every write**. Split
Buying/Selling boxes in Update Price & Stock, history popup, avg column in the
product list. Migration backfills `avg_cost` from `cost` for pre-existing rows.

**Invoice → PDF.** Save as PDF in the receipt popup writes the same file to three
places (chosen folder, next to the DB, backup folder) with per-target failure
isolation. Settings → Backup & Cloud → Invoice PDF location, plus an in-app
archive list.

---

---

## 3b. What landed in the NEXT session (dialogs, roles, sale edit, pendrive)

**The "text boxes stop working" bug — found and fixed.** It was the native
`window.confirm` / `alert` / `prompt`, still called from **24 files**. Chromium
renders those outside the page, and on Windows Electron frequently fails to hand
keyboard focus back to the `webContents` afterwards: the window looks active,
clicks land, but no caret ever appears and typing goes nowhere. That is exactly
why it was *global* (focus is per-window) and *intermittent* (only after one of
those three ran). Every call site now uses the in-app `confirm()`
(`src/stores/confirm.ts`), the new `promptText()` (`src/stores/prompt.ts` +
`components/ui/PromptDialog.tsx`), or `toast.*`. **Nothing in `src/` may call the
native three again.**
Three further layers, because a dead text box is invisible to the shopkeeper:
- `hooks/useFocusRescue.ts` — mounted in `App.tsx`. On mouse-down over a text
  field it checks on the next frame whether focus actually landed, and only
  re-focuses when focus went **nowhere** (activeElement is `<body>`/`<html>`).
  It never fights deliberate focus moves.
- `components/ui/Splitter.tsx` rewritten to use **pointer capture**. Releasing
  the mouse outside a frameless window never delivered `mouseup`, so the drag
  flag stayed true and `user-select: none` stayed on `<body>` forever.
- Overlays now carry `data-overlay="true"` (Modal, Drawer, ConfirmDialog,
  PromptDialog, QuickUpdateModal). `ProductPanel`'s `isOverlayOpen` sniffed
  hard-coded z-index classes and missed any modal on a different layer, so the
  POS search box stole the caret mid-typing.

**Dead controls removed rather than left lying.** The report "Drill: open …"
alerts are gone: product rows now really navigate to `/products/:id`, payment
rows are no longer fake-clickable, and `ReportToolbar`'s Excel/PDF buttons only
render when a handler is actually passed.

**SMS removed from the nav.** It had no backend at all — gateway, credit balance
and delivery history were local placeholder state, so every number it showed was
invented. Nav entry, routes and the dead "Send SMS"/"Send Reminder" buttons are
gone; `src/pages/sms/*` and `src/stores/sms.ts` remain on disk for whenever a
real BD gateway is wired up.

**Editing a finalized sale — `sales.update` (schema-safe, Admin-only).**
`backend/services/sales.ts` gained `updateSale`, which keeps the sale's id **and
invoice number** (the customer is holding that number) and, in ONE transaction:
reverses each line's stock with a dedicated `sale_edit` reason — *not*
`sale_return`, which would make a correction look like a customer bringing goods
back — posts the collected cash back out, deletes the old lines/payments, then
re-applies the corrected ones. Net effect on stock and the drawer is exactly the
difference, and it arrives as appended movements, so
`stock = SUM(stock_movements.qty)` still holds.
`createSale` and `updateSale` now share `computeSaleBody` + `writeSaleBody` **on
purpose** — separate arithmetic in each is how a corrected invoice silently stops
agreeing with the original. The whole 962-check suite passing is what proves the
refactor preserved `createSale`.
A **reason is mandatory** and lands in `sale_audit` with the old→new total.
Refused: editing a void sale, emptying a sale, and using the edit to void.
Gated behind a new `sales.edit` permission, held by Admin only (removed from
Manager in both `SYSTEM_ROLES` and `backend/seed/master.ts`).

**Deleting a product — archive is the real answer (schema v5).**
`sale_lines`/`purchase_lines`/… declare `product_id REFERENCES products(id)` with
**no ON DELETE clause**, so SQLite itself refuses to delete a traded product —
and it should, since deleting would rewrite the shop's history. So:
- `products.archived_at` (v5, additive + nullable, `addProductArchiveColumn`).
  Archiving hides the product from the catalogue, the POS and the FTS index while
  every past document still resolves. **Distinct from `not_for_sale`**, which
  means "we stock it but never sell it" — do not conflate them.
- `products.usage` (open read) tells the UI what a product is tied to, so
  Products/ProductEdit **ask before offering** Delete vs Archive instead of
  firing a delete and surfacing "Cannot delete: product has sales history".
- `deleteProduct(db, id, { force })` — `force` overrides ONLY the "still has
  stock" prompt (it deletes those movements anyway). It can **never** override the
  document guard.
- `listProducts` / `listProductsPage` exclude archived rows **by default**, with
  `includeArchived` / `archivedOnly` opt-ins.

**Role-aware UI (`hooks/useCan.ts`).** `useCan` / `useCanAll` hide what a user
cannot do, rather than showing buttons that the IPC gate will refuse. Applied to
sale Edit/Void/Delete, purchase Edit/Cancel/Delete, product
Create/Edit/Duplicate/Delete, and the Settings tiles (Users, Roles, Backup and
the business-settings screens). Theme and Shortcuts stay open — they are personal
preferences. **This is not security**; `electron/ipc.ts` is still the only gate.

**Pendrive backup.** `snapshotTo()` in the backend writes one verified snapshot
into any folder **without** touching the configured backup folder, `lastBackupAt`
or retention — `runBackup` does all three, which would repoint the shop's backups
at a stick about to be unplugged and prune an archive off it. `electron/backup.ts`
adds `listUsbDrives()` (WMI `Win32_LogicalDisk DriveType=2` via PowerShell —
`wmic` is being removed from Windows) and `backupToUsb()`, which refuses on no
drive, asks when several are plugged in, and checks free space before writing.
Surfaced as a **dashboard button** (`components/dashboard/PendriveBackup.tsx`) and
a card on Settings → Backup. Gated on `settings.backup`: a snapshot is the whole
shop walking out of the building.

**POS screen.** Each cart line now shows **Buying price / Avg. buying price /
Selling price**, colour-coded (amber = paid out, blue = average paid, green =
coming in), with `'—'` when the catalogue has not loaded. The costs are looked up
live via a `costOf` prop, **not** copied onto `CartLine` — carts persist to
localStorage and a stored cost would go stale the moment a new buying price is
recorded. In the product LIST view, brand moved onto its own line under the code,
and Price/Stock got `table-fixed` + fixed widths so narrowing the splitter no
longer makes the two numbers the cashier needs disappear first.

**Bangla:** +47 phrases (2,252 total), one append-only block at the end of
`dict.ts`.

---

---

## 3c. What landed in THIS session (dead buttons, real averages, inline create)

**A purchase now moves the average buying price — the reported bug.**
`createPurchase` wrote `products.cost` with a raw `UPDATE`, and only when the line
carried a NEW SELL PRICE. So buying the same item at a higher price without
retyping its sell price changed nothing at all, and when it did fire it bypassed
`product_cost_history` — which `avg_cost` is recomputed *from*, so the average
never moved and the cache silently stopped agreeing with its own source of truth.
Each received line now goes through `setProductCost(…, source: 'purchase')`
(nested `tx()` = SAVEPOINT, so it joins the same transaction). `CostSource` gained
`'purchase'`; the column has no CHECK constraint, so **no migration**. The sell
price stays opt-in. Activity logging is skipped for purchase-sourced entries —
otherwise every GRN buries the feed under one line per item. +10 checks.

**Paid / Partial / Due were a trap, not a filter.** Both list screens filtered
them in JavaScript over the rows of the loaded page. On a shop with history,
clicking "Due" filtered the newest 50 and rendered "No sales match these filters"
while thirty unpaid invoices sat on page four — and the pager and page totals
disagreed with the rows on screen. `PageQuery.payment` is SQL now, shared by sales
and purchases through one `paymentStateSql()` helper (compared on a 1-paisa
epsilon; `due` is REAL). +11 checks asserting the three states **partition** the
document set. **The stores are shared**, so Drafts/Quotations must keep clearing
`payment` or a draft list silently inherits "unpaid only".

**Custom date ranges dropped their last day.** `resolveRange`'s custom branch used
`new Date('2026-01-10')`, which JS parses as **UTC** midnight: 1st–10th returned
nine days, and the bounds sat on a different clock from every preset (six hours out
in UTC+6). A bare `YYYY-MM-DD` is anchored to the local day now and the `to` end
stretched to 23:59:59.999, so it is inclusive as this module documents. Reversed
dates are swapped rather than returning an empty range that reads as "the shop
sold nothing". +9 checks.

**Dead buttons, removed or wired.** Print / Re-print on the sale drawer, the sale
list, the purchase drawer and the purchase list had **no onClick at all**. They
were never wired because `Receipt` draws a `ParkedCart` and a stored sale is a
`SaleRecord`; `InvoicePrintModal` (`saleToCart` / `saleToPayment`) is that adapter
and is deliberately the ONLY one, so an old invoice cannot drift from the copy the
customer holds. `Receipt` gained `dateISO` — it stamped `new Date()`, so a reprint
put today's date on last week's invoice. Purchases get their own
`PurchasePrintModal` (a GRN, not the receipt with different words). "Export" now
calls the same `backup.export` channel Settings uses, labelled **Export all**
because it is the whole table, not the page. Both drawers' "Open full page" links
pointed at `/sales/:id` and `/purchases/:id`, **neither of which is routed** — gone.
`birthdayList` pointed at `/sms`, which was removed with the SMS feature. Three
Shortcuts entries opened list pages while claiming to create something.

**Inline create, so a half-filled form is never abandoned.** `+` beside
Category/Brand in the product form (`QuickCatalogModal`, de-dupes case-insensitively
and selects the existing record instead of making a twin), `+` beside Customer on
the sale form (reuses `CustomerPicker` with a new `startInAdd`), and **Add new
product** on both documents via `NewProductDrawer` — the real `ProductForm` in a
drawer, so there is one product editor, not two that drift. It passes
`lockStock`: opening stock is forced to 0 and shown read-only, because the quantity
arrives on the purchase line and typing it here too would put the same delivery
into stock **twice**. `onCreated` hands back the saved product **with its id**, so
the line is added immediately instead of waiting for the catalogue to refetch.

**POS: the selling price is editable, for one sale only.** The counter bargains.
`CartLine.priceOverride` is what makes it stick: both places that re-price a cart
(switching price group, and revalidating a cart restored from disk) skip an
overridden line, or an agreed price would snap back to the list price and charge
the customer the wrong amount. Nothing is written to `products.price` — POS already
sends `spr` per line.

**The idle lock that locked but never appeared.** Two bugs. It called `touch()` on
every `mousemove` — a Zustand `set()` per mouse event for a timestamp nothing
rendered. And it armed ONE `setTimeout` for the whole timeout, which Windows
throttles and which does not track wall-clock across sleep, so the shop could sit
unlocked for far longer than the setting said. Now a 15s poll against a real
timestamp. The visible symptom (dead clicks, no lock screen, fixed by
minimise/restore) was **compositing**: the lock screen had mounted, the window just
never painted the frame. `window:repaint` → `webContents.invalidate()`, plus a
renderer rAF nudge for the browser case. A minimised window is left alone
deliberately.

**Layout: the item table gets the width.** Both document forms were 2/3 + 1/3 with
a sticky summary rail, leaving eleven columns of prices in ~60% of the window, so
entering a purchase meant scrolling sideways with the product name off screen. One
column now, table full width (`min-w` 1100px → 860px), summary and charges at the
bottom. The dashboard's shortcuts moved out of the header's `flex-wrap` action row
— which is what let them slide under the sidebar — into a fixed 4×2 grid
(`QuickActions`). Voided sales and cancelled purchases are hidden by default
behind a small toggle; nothing is deleted, since the reversal history is what makes
a void auditable.

**Invented data on screen, removed.** The dashboard subtitle was the literal
`"Tuesday, May 26, 2026 · Mirpur Branch"` — a date wrong every day after it was
typed and a branch no clean install has ("Main Branch"). `AddExpenseDrawer` offered
a hard-coded `['Mirpur Branch','Uttara Branch','Dhanmondi Branch']`, so a real shop
filed expenses against branches it does not have. `CashRegister` printed
`'Mirpur Branch'` / `'Seam'` on the screen and the Z-report. All read from the real
branch/user lists now. **`DuesPanel`** puts who-owes-us and who-we-owe on the
dashboard with phone numbers, from the derived balances (never stored totals), and
sale/purchase drawers show a callable number — on a due invoice that is the reason
the screen was opened.

**Bangla:** +45 phrases (2,351 total), one append-only block. `i18n:check` caught
five duplicate keys with conflicting translations, which is exactly what it is for.

**Build history:** `release/` was 4 installers + `win-unpacked` (~250 MB of stale
artefacts). Only `HardwareKhataPOS-Setup-0.3.0.exe` and `latest.yml` remain —
`latest.yml` is what the in-app updater reads, so it must not be deleted.

---

## 4. Known gaps — pick up here

### Closed in the gap-clearing session (all of §4's "real, worth doing" list)

Every numbered gap that stood here is done. What each turned out to be:

- **Archived products had no screen** (gap 0). `Products.tsx` has an
  **Active / Archived** toggle, a Restore row action and a bulk Restore; the
  status column reads `p.archivedAt` so a retired product is labelled wherever it
  renders. A real bug came out of it: `ProductEdit` found its product by scanning
  `useProducts()`, which **excludes archived rows**, so opening an archived
  product's page silently rendered the blank "new product" form. It fetches by id
  through the new `useProduct(id)` hook now, and shows a Restore banner.
- **`'Mirpur Branch'` hard-coded in the adapters** (gap -1). There were **five**
  copies of the id↔name translation, two of them the demo fixture's literal.
  `src/lib/branch.ts` is now the only one. Two write-path bugs fell out: the stock
  store resolved branches with the REPORT-FILTER resolver, whose contract returns
  `undefined` for "all branches", so an unresolvable branch wrote a transfer with a
  **null branch id** (stock leaving nowhere and arriving nowhere); and `cash.move`
  stamped every movement with `br_mp` instead of the branch of the shift it was
  posted to. Both refuse now rather than guess. `StockTransfers`' Inbound tab was
  filtering on the literal, so on a real shop it always read "nothing on the way".
- **"This week" meant two things** (gap 4b). The backend starts the week on
  Saturday; the Sales and Purchases presets computed a Monday start, so on a
  Saturday Reports showed the week's takings and the Sales list showed nothing.
  One definition lives in `lib/datetime.ts` (`startOfBusinessWeek`) and
  `ReportToolbar` was rebuilt on it — which also fixed its `custom` branch parsing
  a bare `YYYY-MM-DD` as **UTC**, the same bug the backend had already fixed.
- **Two dead receipt toggles** (gap 2). `showLineDiscount` is **implemented**
  (prints what each line was discounted by, derived from the same two numbers the
  total is). `showLineTax` was **removed**: VAT is applied at ORDER level and
  neither `computeTotals` nor `computeSaleTotals` reads a line's `taxPct`, so a
  per-line tax figure would be a number in no total the customer pays. On the way,
  the receipt's inline line-subtotal arithmetic was replaced with `lineSubtotal()` —
  the copy here omitted its `max(0, …)` clamp, so a flat discount larger than the
  line printed a **negative** subtotal while the footer counted it as zero.
- **Derived figures over one page** (gap 4). The remaining offenders were the two
  payment reports: their detail tables were built by walking the sales/purchases
  store (one page = the newest 50 documents) underneath a footer total computed in
  SQL over the whole range, so the footer and the rows disagreed with nothing on
  screen to explain it. New `reports.sellPaymentRows` / `reports.purchasePaymentRows`
  use the **identical filter** to the aggregates, and the suite asserts the rows
  sum to the headline total. Audited the rest: the Expenses / Products / Sales /
  Purchases KPI strips are explicitly labelled "(this page)", and
  `ReceivePaymentModal` already read the unpaged list.
- **A sale's PAYMENTS could not be corrected** (gap 1b). `AddSale` now has a
  payment editor, shown only when editing a finalized invoice, so a mistyped
  *amount tendered* is fixed in place instead of voiding the number the customer is
  holding. `Credit` is excluded from the methods on purpose — it is the unpaid
  remainder, not money received.
- **A cancelled purchase's buying price** (gap 3) — the decision is written up in
  §4a below. It is **retracted** now, not left in the average.
- **Pendrive detection had no fallback** (gap 6). "There is no pendrive" and "we
  could not look" were the same empty array, so a PC with PowerShell blocked
  reported *No pendrive found* with a stick plugged in. `probeUsbDrives()` reports
  which it is, and the new `backup.toFolder` channel lets the owner point at the
  drive themselves.

### 4a. The decision on a cancelled purchase's buying price

Cancelling a purchase already reversed its stock and its cash. The price it had
recorded stayed in `product_cost_history` for ever — and `avg_cost` is the mean of
those entries — so a purchase keyed at the wrong price and cancelled a minute later
moved the shop's average buying price permanently, with no way to undo it.

**Decided: if the delivery never arrived, the shop never paid that price**, so the
entry must stop counting. It is **retracted, never deleted** (schema **v7**:
`product_cost_history.ref_type/ref_id/retracted_at/retract_reason`). The row stays,
because the history is the audit record of what was entered and when — an owner
staring at a surprising average most needs to see that the price *was* entered
once and no longer counts. `cost` and `avg_cost` are recomputed ignoring retracted
rows, so cancelling also rolls the CURRENT buying price back. The history popup
shows them struck through, labelled "Cancelled — not counted".

Nothing is back-filled: purchases cancelled before v7 never recorded which history
rows they created, and guessing from timestamps could retract a price the owner
typed by hand.

### Still open

5. **Manual GUI smoke test** — `docs/06-E2E-AND-SMOKE-TEST.md`, human-only. This
   is now the only unticked item in the definition of done.

7. **Single-branch writes still assume `br_mp`.** This is NOT the gap -1 that was
   just closed (that was the branch *name* and the resolvers). About fifteen call
   sites still pass the literal id `'br_mp'` where they mean "the shop's default
   branch": `POS.tsx`, `AddSale`, `AddPurchase`, `ProductPanel`, `QuickUpdateModal`,
   `NewProductDrawer`, `StockAlerts`, `useDashboardData`, and the sell-return /
   purchase-return / shipment / supplier-payment writes in `stores/{sales,purchases,contacts}.ts`.
   It is harmless today — the seed always creates `br_mp` as the default branch —
   and it is the **deliberately deferred** "multi-branch context needs a real branch
   switcher" item in `03-WHATS-LEFT.md`. `defaultBranchId()` in `src/lib/branch.ts`
   is the helper to switch them to when that work is picked up; doing it piecemeal
   would leave a confusing half-state.

**Deliberately deferred (ask before doing):**

- **Virtualising the POS product grid.** Capped at 200 rendered rows with a
  "keep typing" notice. Waiting on the owner to say how many products the shop
  really carries — may be wasted effort.
- **QR code on receipts.** Toggle removed; needs a real encoder, no library present.
- **Program Files install.** Currently per-user (no elevation). Switching to
  `perMachine: true` needs admin on every install.
- **Code signing.** Not signed → SmartScreen warns on other PCs. Needs a bought cert.
- **`app.disableHardwareAcceleration()`.** The owner's low-end PC blue-screened.
  Diagnosed as a **kernel/driver** fault (a renderer bug cannot BSOD Windows) —
  most likely GPU driver. Offered as a one-line safe default or a Settings
  toggle; not implemented. Ask them for the Event Viewer stop code first.

---

## 5. Non-negotiable rules (full list in `04-AGENT-HANDOFF.md`)

1. **Stock is `SUM(stock_movements.qty)`** per (product, branch). Never a column.
2. **Balances are derived** from transactions, never stored running totals.
3. **All money through `backend/core/`**; compare within a 1-paisa epsilon.
4. **Permission enforcement ONLY at the IPC boundary** (`electron/ipc.ts` +
   `electron/permissions.ts`). Putting it in services breaks the Node harness.
5. **No mock data, ever.** `src/mocks/` is deleted. No backend source → render
   `'—'` and exclude from totals. Never invent or estimate a number.
   **The one bounded exception** is `src/lib/browserMock.ts`, which lets the UI be
   opened in a plain browser for visual work. It is gated on `browserPreview()`
   = `import.meta.env.DEV && !hasBackend()`, so Vite drops it from a production
   build entirely (verified by grepping `dist/` for its sample names), and it is
   limited to catalogue reference data — products, customers, categories, brands,
   units. **It must never grow to cover money**: no sales, payments, dues, stock
   movements, KPIs or report rows. To see money without a real shop, use
   `POS_SEED=demo npm run dev`, which generates a year through the real services.
6. **Add a check for every new invariant.** A failing check is a real bug.
7. **The two averages are different figures and must stay separate:**
   `avg_cost` (simple mean of buying prices, owner-facing) vs `weightedAvgCost()`
   (qty-weighted, drives COGS and valuation — verified money math).
8. **Caches must be recomputed, never incremented**, and the identity asserted
   (see `costing.ts` and the `backup` config cache).

9. **Never call `window.confirm` / `alert` / `prompt`.** They cost the Electron
   window its keyboard focus on Windows and were the "text boxes don't work"
   bug. Use `confirm()` (`stores/confirm`), `promptText()` (`stores/prompt`) or
   `toast.*`. New full-screen overlays must carry `data-overlay="true"`.
10. **A product that appears on any document is ARCHIVED, never deleted.** The
   document tables reference `products(id)` with no ON DELETE clause. `force` on
   `deleteProduct` overrides the stock prompt only, and must stay that way.
11. **A finalized sale keeps its invoice number when corrected.** `updateSale`
   reverses and re-applies inside one transaction; it must always go through the
   shared `computeSaleBody`/`writeSaleBody` that `createSale` uses, and it must
   always record a reason in `sale_audit`.
12. **Buying prices are only ever written through `setProductCost`.** Never
   `UPDATE products SET cost = …`. The history table is the source of truth and
   `cost` / `avg_cost` / `cost_updated_at` are recomputed from it; a raw write
   leaves the cache disagreeing with its own source, which is precisely the bug
   that made the average purchase price look frozen.
13. **A derived figure must never be filtered or summed over one PAGE of a
   paginated store.** It reads as a confident answer and is wrong past page one.
   Push it into SQL (`PageQuery.payment` is the worked example) and assert that the
   filtered `total` is the TRUE count.
14. **A price the cashier typed by hand outranks the catalogue.** Anything that
   re-prices a cart must skip `priceOverride` lines. It is a price agreed with a
   customer, and the catalogue moving is not a reason to charge them differently.
15. **A control with no handler is a defect, not a placeholder.** Wire it or delete
   it — including `Link`s to routes that do not exist in `App.tsx`.
16. **A setting that cannot be implemented honestly must be REMOVED, not faked.**
   `showLineTax` was deleted rather than wired up, because the only figure it could
   have printed is not part of any total the customer pays. A toggle is a promise
   about what the app does with the money.
17. **There is ONE branch resolver: `src/lib/branch.ts`.** `branchNameOf` for
   display, `requireBranchId` on a write path (it throws rather than guess — a row
   stamped with the wrong or a null branch id drops out of every branch-scoped
   figure for ever). Never add another map, and never fall back to a literal id.
   `resolveBranchId` in `hooks/useReport.ts` is a *different contract* for report
   filters, where `''` means "all branches" and `undefined` is the right answer.
18. **A date range has ONE definition, and it is the backend's.** The week starts
   **Saturday**. The renderer's half lives in `src/lib/datetime.ts`, mirroring
   `backend/core/dates.ts`; never re-derive a preset inline in a screen. And never
   parse a bare `YYYY-MM-DD` with `new Date()` — that is UTC, and it has silently
   dropped the last day of a range twice now.
19. **A cost-history entry is retracted, never deleted** (`retractCostEntries`).
   Cancelling the document that recorded a price stops it counting towards
   `cost`/`avg_cost`; the row stays, because it is the audit record of what was
   entered. Same principle as voiding rather than deleting a sale.

**Bangla:** append-only `Object.assign(BN, {…})` blocks in `src/lib/bn/dict.ts`.
Never reorder or delete. Duplicate keys across blocks **must agree** —
`i18n:check` parses the source and fails otherwise (it has now caught this three
times, most recently a second `'Restore failed'` that disagreed with the first).
New copy must be a **complete static phrase in its own text node**; the layer
matches whole nodes, so a value interpolated mid-sentence can never be translated.

**Elderly owner, Bangla-first:** big touch targets, readable type, the primary
action must be impossible to miss, expert controls tucked away.

---

## 6. Environment gotchas (all hit this session)

- **Native ABI is the recurring footgun.** `better-sqlite3` needs a **Node** build
  for the verify harness and an **Electron** build for the app.
  `ERR_DLOPEN_FAILED` = wrong ABI. **Always finish with `npm run rebuild:electron`.**
- **A running dev app locks `better_sqlite3.node`** → the rebuild fails with
  `EBUSY`/`EPERM` and the *next* suite fails with a confusing error (it once
  looked like a UNIQUE constraint bug in `paging.ts`). Kill
  `Hardware Khata POS` / `electron` processes before rebuilding.
- **The shell reports as `cmd` but is PowerShell.** Use `;` not `&&`.
- **NEVER rewrite files with `Get-Content`/`Set-Content`** — it has corrupted
  UTF-8 (`৳`, `—`, `·`) twice. Use editor tools. If a bulk edit is unavoidable use
  `[System.IO.File]::ReadAllText/WriteAllText` with `UTF8Encoding($false)` and
  then grep for `â€` / `Ã`.
- **Reused background terminals show stale output.** A "stuck" build was actually
  a finished one with a cached log. Prefer a fresh terminal for packaging.
- **`$args` is reserved in PowerShell functions** — it silently arrives empty.
- **Packaged app shares `%APPDATA%\pos` with dev mode**, because Electron derives
  userData from package.json `name` (`pos`), not `productName`. Harmless, but it
  is why the packaged build saw the dev shop and showed Login instead of the
  wizard. Renaming it would orphan the owner's data — left alone deliberately.
- **`printToPDF` depends on the print CSS**, so a mounted `<PrintSheet>` is what
  makes the PDF contain only the receipt. Don't "simplify" that coupling.
- **No backticks inside `SCHEMA_SQL`** — it is a `String.raw` template literal and
  a backtick in an SQL comment terminates it.

---

## 7. Working agreement with the owner

- Ships fast, wants rigorous verification — **run the suites, don't assure**.
- Says "do it fast" often; still expects correctness and honesty about gaps.
- Corrections are welcome: tell them plainly when something they asked for is
  blocked by a bug, and fix the bug rather than working around it.
- They ask questions mid-stream ("why does my low-end PC crash?") — answer the
  question, don't start coding unless asked.
- End every packaging request with the installer path **and** confirm it launches.
