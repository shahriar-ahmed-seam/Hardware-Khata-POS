# Continue Here — Session Handoff

> **New session? Read this file first, then `04-AGENT-HANDOFF.md` for the rules.**
> This captures the state as of the end of the packaging/PDF session so work can
> resume without re-discovering anything.

---

## 1. Prove the state before touching anything

```bash
npm install                        # if node_modules is missing
npm run backend:verify:all         # must print 962 checks across SEVEN suites
npx tsc --noEmit -p tsconfig.json  # frontend typecheck — clean
npx tsc --noEmit -p tsconfig.backend.json
npm run build                      # renderer + main + preload
npm run i18n:check                 # 32 checks, 2,252 Bangla phrases
npm run rebuild:electron           # LEAVE IT ON THE ELECTRON ABI (see §6)
```

> `npm run lint` does NOT work — eslint is not in devDependencies. `tsc` is the
> only static gate. Don't chase the failure; either install eslint deliberately
> or leave it.

Expected per-suite counts:

| Suite | Checks | Covers |
|-------|-------:|--------|
| `all.ts` | 378 | scenarios + determinism + file-DB smoke + identities |
| `api.ts` | 209 | the `buildApi()` facade — **150 channels** |
| `run.ts` | 56 | identities on a 365-day dataset |
| `e2e.ts` | 68 | one full shop day |
| `paging.ts` | 80 | paginated list reads |
| `backup.ts` | 120 | backup, cloud, CSV export, invoice PDFs, **pendrive copies** |
| `costing.ts` | 51 | **purchase-price history** + schema-migration head |
| **total** | **962** | |

Single suites: `backend:verify`, `backend:scenarios`, `backend:e2e`,
`backend:paging`, `backend:backup`, `backend:costing`.

---

## 2. Where the product is right now

Shippable and installed. `release/HardwareKhataPOS-Setup-0.1.0.exe` (82 MB, x64,
NSIS, per-user) is built and **installed on the owner's PC** at
`C:\Users\Seam\AppData\Local\Programs\Hardware Khata POS\`.

The owner's live database is at `%APPDATA%\pos\pos.db` — **schema v4** — with one
active account: `u_admin`, name **Seam**, username `owner`, PIN set, no password.
Their backup folder is already `C:\Users\Seam\OneDrive\HardwareKhataPOS\Backups`,
so snapshots *and* invoice PDFs cloud-sync via OneDrive.

⚠️ **165 files are uncommitted on `main`.** Nothing from this session has been
committed. Ask the owner before committing — do not commit unprompted.

---

## 3. What landed this session (and why, where it matters)

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

## 4. Known gaps — pick up here

**Real, worth doing:**

0. **No screen lists ARCHIVED products.** The backend is complete —
   `products.archive` / `products.unarchive` / `products.usage`, and
   `listProducts({ archivedOnly: true })` — and all of it is covered by checks,
   but the Products page has no "Archived" filter or Restore button yet. So an
   archived product is currently only recoverable by someone who knows the
   channel exists. **This is the first thing to finish**; archiving is offered to
   the owner today.
1. **Re-save/print an OLD invoice.** Print and Save as PDF only exist on the
   receipt popup right after a sale. `SaleDetail` (Sales → row) holds a backend
   sale shape, not a `ParkedCart`, so `Receipt` needs a small adapter. The owner
   has been told this is missing. (Its Print / Re-print buttons are still inert.)
1b. **Editing a sale cannot change its PAYMENTS.** `AddSale` has no payment
   editor, so `updateSale` re-applies the payments already on the invoice
   verbatim. Correcting a wrongly-keyed *amount tendered* still needs Void +
   re-create. The backend supports it — the form does not.
2. **Two dead receipt toggles.** `showLineDiscount` and `showLineTax` exist in
   settings and in `ReceiptTemplatePage` but **nothing in `Receipt.tsx` reads
   them** — same class as the QR toggle already removed. Either implement or
   remove; a switch that does nothing is a defect.
3. **Purchases don't feed the cost history.** Only the manual entry does. Wiring
   `createPurchase` in would be valuable and correct, but it touches verified
   money paths — do it deliberately, with checks.
4. **Reports reading paginated stores.** `CustomerGroupPage` was silently capped
   at 50 customers because it merged figures from a store that became paginated.
   That is a *class* of bug: audit any report/derived figure that reads a
   paginated store's `items`. Aggregate in SQL instead.
5. **Manual GUI smoke test** — `docs/06-E2E-AND-SMOKE-TEST.md`, human-only.

6. **Pendrive detection is Windows-only and shells out to PowerShell.** Node
   cannot tell a removable drive from a fixed one. If PowerShell is disabled by
   policy on the owner's PC, `listUsbDrives()` returns an empty list and the
   button reports "No pendrive found" — which would be a lie. Not yet seen on
   their machine; worth a fallback (or a "choose the folder yourself" escape
   hatch) if it ever happens.

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

**Bangla:** append-only `Object.assign(BN, {…})` blocks in `src/lib/bn/dict.ts`.
Never reorder or delete. Duplicate keys across blocks **must agree** —
`i18n:check` parses the source and fails otherwise (it has caught this twice).
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
