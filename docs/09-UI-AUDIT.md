# UI/UX audit — every screen (September 2026)

How it was done: `scripts/ui-screenshots.mjs` starts a second Electron on a throwaway demo
database (never the real `~/.config/pos`, never the real Documents folder) and captures every
route at **1366×768** — 75 screens in English/dark, 75 in Bangla/dark, 58 in English/light.
Each group of screens was then reviewed against the standard in
[`ui-audit/00-BRIEF.md`](ui-audit/00-BRIEF.md) (who the user is, the size floor, popup rules)
together with its source files. The per-screen findings, with file:line evidence and exact
fixes, are in `docs/ui-audit/`:

| File | Screens |
|---|---|
| [01-shell-dashboard-auth.md](ui-audit/01-shell-dashboard-auth.md) | titlebar, sidebar, search, More menu, Dashboard + its popups, login, lock, first-run wizard |
| [02-pos.md](ui-audit/02-pos.md) | POS: cart header, cart lines, totals bar, product panel, Payment, Receipt, Held carts, Customer picker |
| [03-sales.md](ui-audit/03-sales.md) | All sales, Add/Edit sale, Drafts, Quotations, Sell returns, Shipments + sale popups |
| [04-purchases.md](ui-audit/04-purchases.md) | Purchases, Add/Edit purchase, Purchase returns + Pay bill, supplier/product popups |
| [05-products.md](ui-audit/05-products.md) | Products, product form, Categories/Brands/Units/Price groups/Warranties, Barcodes, Bulk price, Quick update |
| [06-stock.md](ui-audit/06-stock.md) | Stock, Alerts, Transfers, Adjustments (+ new forms) |
| [07-contacts-expenses-cash.md](ui-audit/07-contacts-expenses-cash.md) | Customers, khata, Suppliers, Customer groups, Dues, Expenses, Import hub, Cash register, Z-report + popups |
| [08-reports.md](ui-audit/08-reports.md) | Reports hub, the shared report shell, all 16 reports |
| [09-settings.md](ui-audit/09-settings.md) | Settings hub, shared settings pattern, all 17 settings pages |

131 findings are marked **[High]**. Re-take screenshots after a change:
`npm run build && npx vite preview --port 4173` (in the background), then
`node scripts/ui-screenshots.mjs /tmp/hk-ui-shots [--lang=bn] [--theme=light] [--only=/pos] [--scale=1.45] [--probe]`.
`--probe` also writes `probe.json`: routes that scroll sideways, controls pushed past the
window edge, and button/label text spilling out of its box (it self-tests first). `--scale`
sets the text size (1 / 1.15 / 1.3 / 1.45). The script refuses to run if it is not signed in,
so a login screen can never pass for a clean page.

---

## 1. Bugs found on the way (fix first — these are not taste)

These surfaced during the review. They make a screen do the wrong thing or nothing, so they go
before any restyling. Three were re-checked in the code while writing this (marked ✔).

| # | Where | What happens |
|---|---|---|
| B1 ✔ | Add Sale (`AddSale.tsx:597`, `:673`) | Choosing **Quotation** in the Status select still saves a real **final** sale (stock leaves). In edit mode the same select can turn a final invoice back into a draft. |
| B2 ✔ | Edit product (`ProductEdit.tsx` → `ProductForm.tsx:80`) | `/products/:id` renders the form before the product loads, and the form reads `initial` once → the owner sees a **blank** product. |
| B3 ✔ | POS (`PaymentModal.tsx:116`) | **Multi-Pay** opens the same screen as Pay (`startMode` is never read). |
| B4 | POS (`POS.tsx:737`) | **Re-print Last** does nothing; the "Auto-print receipt" setting is never read. |
| B5 | POS | Resuming a held cart silently **overwrites** the current cart; closing a cart tab / Clear cart delete with no confirm or undo. |
| B6 | POS cart line | A decimal quantity (2.5 kg) cannot be typed. |
| B7 | Barcode print | The printed "barcode" is a decorative stripe — **no scanner can read it**; the page ignores Settings → Barcode. |
| B8 | Bulk price update | Changing **Cost** in bulk skips the buying-price history (same class of bug as the backend R25 fix). |
| B9 | Roles | The **Admin** role can be edited down to nothing ("Revoke all") — the owner can lock himself out. |
| B10 | Users | PINs are typed in **plain visible text**, length not checked (a 1-digit PIN saves). First-run wizard: PIN visible, never confirmed. |
| B11 | Dead buttons | Products: Import/Export/Barcode + bulk Print/Export/Update; Customer & Supplier detail: **Print statement**; Shipments: Print/View; All Sales: date **Custom**; SaleDetail Return/Ship when opened from a khata; Printers **Test** (fake success); Settings "Saved" buttons (only a toast). |
| B12 | Settings → Business info | Leaving the page drops unsaved edits silently; the success toast fires before the save resolves. |
| B13 | Customer groups / forms | New groups can be created but never chosen (form + filter + POS hard-code Retail/Wholesale/Contractor). Price groups and Customer groups are two screens for one list. |
| B14 | Expenses | "Attach receipt" stores nothing; "Recurring" creates nothing. |
| B15 | Bangla | "Credit" is translated **বাকি** (= due) — the khata's *payments* column and the Sell-payment "Credit" card read the opposite in Bangla. |
| B16 ✅ | Popups everywhere | A stray click outside a Modal/Drawer closes it and **throws away what was typed** (close-shift count, payment split, forms). *Fixed in step 0.* |
| B17 ✅ | Popups everywhere (`globals.css`) | A "safety net" rule (`.animate-scale-in, .animate-slide-in-right { max-width: 100vw }`) sat after the utilities and beat every popup's own `max-w-*`, so **every Modal and Drawer was stretched to the full window** — a five-field form spread over 1366px, with no backdrop left to click. *Found and fixed in step 0 (rule moved into `@layer base`).* |

---

## 2. Foundation — fix once, every screen improves

Almost every screen repeats the same few problems. Fixing the shared pieces first means the
page-by-page work later is mostly deleting and re-arranging, not re-styling 176 files.

### Step 0 status — done (September 2026)

What changed everywhere:
- **Popups** (`Modal`, `Drawer`, `Popover`, confirm/prompt; `ui/overlayStack.ts`): dialog roles;
  a backdrop click closes only while nothing was typed (otherwise the panel shakes); Esc
  closes only the top popup; the caret lands in the first field; Tab wraps at the edges;
  40px close button. Popups now keep their own width (B17).
- **Controls:** Button `sm` 32 / `md` 40 / `lg` 48px, `icon` 40px; Input, NumberField and the
  81 hand-copied selects/inputs 40px; NumberField selects its value on focus; Badge 14px.
- **Text floor:** no pixel sizes left (602 replaced; smallest is `text-xs` = 14px, all in rem so
  they follow the text size); no uppercase micro-labels (275); money/quantities use the normal
  face with tabular digits, mono only for codes; the mono size rule no longer beats size classes.
- **Bangla font:** Noto Sans Bengali 400–700 bundled (`@fontsource/noto-sans-bengali` 5.3.0,
  OFL, loaded from disk — no network). Still to confirm on the owner's Windows 7 PC.
- **Shell:** sidebar header row gone, collapse control at the bottom, **Reports** in the
  sidebar, Stock transfers hidden (sidebar, Stock page, Reports tile) while there is one
  branch; the menu folds to icons on POS and comes back on leave; titlebar at the scale with
  **A− / A+** (100 / 115 / 130 / 145 %, old 90/110/120 % settings snap to the nearest); its
  labels fold by a rem container query so it fits at every text size; density toggle removed
  (it changed nothing). The theme toggle stays.
- **Printing is unchanged:** receipts, the goods-received note, the X/Z sheet and labels keep
  their mono amounts at the old printed size (`.print-doc`), now independent of A− / A+.

Checked: both type-checks, Bangla dictionary checks, build; all 75 routes in English and
Bangla at 100 % and 145 % with the layout probe; 11 everyday popups in both languages;
a scripted run of the popup rules, select-on-focus, the POS menu fold and A− / A+.

**Use these in the page steps** (all in `src/components/ui/` unless noted):

| Piece | Replaces | Notes |
|---|---|---|
| `FormField` | the 16 local `Field` copies | label tied to the control (`{(f) => <Input {...f} />}`), `required`, `hint`, `error`, `action` |
| `Select` | raw `<select className="h-9 …">` | 40px, same look as `Input` |
| `Segmented` | hand-made chip rows | radio group, ← → keys, `fullWidth`, `size="sm"` for toolbars |
| `IconButton` | bare `size-7` icons | `label` is required — it becomes the tooltip and the screen-reader name; `tone="danger"` |
| `Switch` / `ToggleRow` | 36×20 toggles | 44×24 with a visible Off and the words On / Off |
| `labelFor(kind, key)` (`src/lib/labels.ts`) | raw keys on screen (`retail`, `in-transit`, `CreditAdjust`) | returns English words the Bangla layer translates; unknown keys are humanised, never shown raw |
| `formatDate` / `useDateFormat()` (`src/lib/formatDate.ts`) | `toLocaleDateString('en-GB')` | follows Settings → Business → Date format and the language (Bangla month names) |

Left for the page steps on purpose: tables and lists (F5), popup titles and widths per popup,
interpolated sentences (F6), and moving each screen onto the pieces above.

Also since step 0 (user-reported): `Popover` renders into `<body>` at window coordinates, so a
row "⋯" menu can no longer open inside a table and get cut off; a folded sidebar opens with
one click on any group icon; on Linux the mouse wheel scrolls twice as far per notch
(`src/lib/wheelBoost.ts` — Chromium on Linux scrolls 53px per notch against 100px on
Windows; Windows is untouched).

**F1 · Text floor and one type scale**
- Replace every `text-[9px]` / `text-[10px]` / `text-[11px]` / `text-[12px]` with the scale
  (`text-xs` = 14px minimum). ~560 call sites; `globals.css` currently papers over them at 12–14px.
- Drop `uppercase tracking-…` micro-labels (275 sites). Sentence-case `text-xs font-medium`.
- `.font-mono { font-size: max(1em, …) }` (`globals.css:458`) is unlayered and **overrides every
  size class** on mono text — it is why the POS product card shows the SKU bigger than the name
  (visible in the screenshot), and by the same CSS order the Payment modal's large money
  figures should be rendering at ~16px (not yet seen on screen). Move it into `@layer base`.
  Money uses `tabular` digits in the normal face; mono only for SKU/barcode.
- `Badge` `text-[10px]` → `text-xs`.

**F2 · Bangla font on Windows 7**
- `globals.css` relies on Nirmala UI, which first shipped with **Windows 8** — the owner's
  Windows 7 falls back to Vrinda/Shonar Bangla. Bundle one Bangla face (e.g. Noto Sans Bengali,
  OFL, woff2 subset, offline) and put it in the body font stack. Verify on the owner's PC.

**F3 · Controls (`src/components/ui/`)**
- `Button`: `sm` 28→32px only for dense tables, `md` 36→**40px** (default everywhere), `lg` 44→48px
  for money/confirm. Every `PageHeader` action `md`.
- `Input` / new shared `Select` / `NumberField`: **40px**, `text-sm`; NumberField selects all on
  focus (typing "1000" over a prefilled "780" must not give "7801000").
- New `FormField` (label above, `htmlFor`, required mark, error text under the field) replacing
  the 16 local `Field` copies; new `Segmented` (h-10 chips) replacing ~20 hand-made chip rows;
  `IconButton` (size-9, required `aria-label` + tooltip) replacing ~80 `size-7` icons;
  `Switch` 44×24 with a visible Off state and "On/Off" text (`ToggleRow`).

**F4 · Popups (`Modal`, `Drawer`)**
- `role="dialog"`, `aria-modal`, focus trap, first field focused, Enter submits (`<form>`),
  footer always visible (primary bottom-right).
- `dirty` prop: a backdrop click does **not** close once something was typed (B16); Esc asks
  "Discard?" when dirty. Nested popups: Esc closes only the top one.
- Titles say what happens ("Receive payment from Rahim"), not a code. Widths fit content
  (several `max-w-3xl` popups hold five controls).

**F5 · Tables and lists**
- One header style (`text-xs font-medium`, normal case, sticky), cells `text-sm py-3`,
  codes/phones `whitespace-nowrap` (invoice numbers and phones currently wrap to 3 lines,
  so only 4–5 rows fit), money right-aligned tabular, ≤ 7 default columns.
- Whole row opens the record; one **labelled** row action; destructive actions apart.
- The "(this page)" stat strips on 7 list pages → one summary line (or nothing when the
  page holds the whole list).
- Shared `EmptyState` with the next step ("No drafts. Save a sale as a draft when…").

**F6 · Words (English and Bangla)**
- A `labelFor(kind, key)` map for raw keys shown on screen (statuses, reasons, types,
  groups, `CreditAdjust`, `in-transit`, `retail`, `damage` …) — today they show as codes and
  never translate.
- Interpolated sentences (`${n} customers`, `Take ৳x · give ৳y change`) → a translatable
  phrase node + a separate number node. One `formatDate()` that follows the language toggle
  (dd/mm/yyyy; today `en-GB` "Sept" everywhere, US order in date inputs).

**F7 · Shell**
- Remove the duplicate logo row at the top of the sidebar; collapse control at the bottom.
- Sidebar collapses by itself on **POS** (+180px for the cart and products).
- Titlebar text to the scale; one-click density and theme toggles move to Settings;
  **A− / A+ text size** in the titlebar; **Reports** gets a sidebar entry.

---

## 3. The page-by-page plan

One screen (or one tight group) per step: fix its bugs, apply the foundation pieces, remove
what the audit lists under *Remove / merge*, resize, then re-screenshot in English and Bangla
and compare. Order is by how much the shop uses it.

| Step | Screen(s) | Main changes (details in the file) |
|---|---|---|
| 0 ✅ | **Foundation** F1–F7 | primitives, popups, type floor, mono rule, Bangla font, shell — see *Step 0 status* above |
| 1 (part) | POS | **Done (Sep 2026, user-reported):** one-row cart lines with a column header (all fields kept; buying prices stay visible per owner decision 1), compact product cards, categories wrap, decimal quantity (B6), unit picker removed (R10, decision 8; restored carts go back to the base unit), scanned line scrolls into view. **Still to do:** held-cart count visible, confirm before closing a cart / resuming over one (B5), Enter confirms payment, B3–B4 |
| 2 | Dashboard | honest range labels, dues above the fold, calm tiles, drop the duplicate Shortcuts button, one Customize |
| 3 | All sales · Add/Edit sale | B1, sticky total/save bar, scan-to-add, 7 columns, labelled row actions |
| 4 | Customers · khata · Receive payment · Dues | khata as the default tab, plain column names (B15), printable statement, amount-first payment popup |
| 5 | Cash register · Z-report · close shift | show cash in the drawer now, one set of actions, counting clearly optional, no lost counts |
| 6 | Products · product form · quick update | B2, owner fields first / expert under "More options", popup that fits 768px |
| 7 | Purchases · Add purchase · Pay bill | line table width, sticky totals, supplier picker |
| 8 | Expenses · categories | honest form (B14), fewer columns, category buttons |
| 9 | Stock · alerts · adjustments | one-branch aware (hide transfers), readable quantities |
| 10 | Drafts · Quotations · Returns · Shipments | "Make sale" as a labelled action, plain reason/status words |
| 11 | Reports | hub leads with 5 reports, shared toolbar without the branch picker, `ReportKpi` / `ReportTable` |
| 12 | Settings | hub by use (Everyday / Selling & printing / Advanced), one save model, Backup status first, Appearance text size first, B9–B12 |
| 13 | Master data · barcodes · bulk price · login/lock/wizard | shared list layout, B7–B8, PIN safety |

---

## 4. Owner decisions (answered)

1. **Cashiers may see buying price and profit** — keep them visible; no permission or toggle. (steps 1–3)
2. **Text size steps 100 / 115 / 130 / 145 %**, 90 % dropped. *Done in step 0.*
3. **Keep all three themes** (Dark / Light / System); Reset unchanged. (step 12)
4. Price groups / Warranties — agent's call, keep it simple: hide or merge what does not
   work when steps 6 and 13 get there.
5. **Hide Stock transfers while there is one branch.** *Done in step 0* (sidebar, Stock page,
   Reports tile; the pages still exist and come back with a second branch).
6. Expenses "Attach receipt" / "Recurring" — hide them until they work. (step 8)
7. Reports — fold Trending into Product sell, drop Items. (step 11)
8. **Hide the POS unit picker** — pack pricing (a price per dozen/box) is not built. (step 1)
