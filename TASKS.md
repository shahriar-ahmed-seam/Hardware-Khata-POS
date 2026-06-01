# POS Frontend — Task Checklist

> Status legend
>
> - [ ] not started
>
> - [~] partial / first draft
>
> - [X] locked (approved by user)

---

## Task 1 — Foundation & Window Shell  [x]

- [X] Electron + React + TS + Vite scaffold
- [X] Tailwind + theme tokens (light / dark / system)
- [X] Frameless borderless window with rounded corners
- [X] Custom titlebar (drag region, window controls)
- [X] Brand block + branch switcher in titlebar
- [X] Smart global search with `#scope:term` filters (invoice, product, sku, customer, supplier, barcode), Ctrl+K, keyboard nav
- [X] Status pills (shift, sync)
- [X] Theme toggle (light/dark only in titlebar; system option moved to Settings)
- [X] Profile menu (visual only)
- [X] Sidebar with collapsible groups (accordion behavior)
- [X] Sidebar follows theme (light/dark)
- [X] Notification bell removed
- [X] Language switch EN ↔ BN with i18n stub (titlebar + nav strings)
- [X] Splash screen on app launch (gradient + loading bar, min 1.6s)
- [X] App icon SVG generated (`build/icon.svg`)
- [X] Window position & size persisted across launches
- [X] Single instance lock (focuses existing window if reopened)
- [x] Density toggle (compact / comfortable) — done in Task 14 (global polish)
- [ ] Convert SVG icon → `.ico` for Windows installer (done at packaging time via electron-builder)
- [ ] Final logo / shop name come from Settings (backend later)

---

## Task 2 — Dashboard  [x]

- [~] KPI cards (sales, transactions, items, customers)
- [~] Hourly sales chart
- [~] Top selling items list
- [~] Recent sales table
- [~] Low stock card
- [~] Customer dues card

- [X] Date range selector (today / week / month / custom)
- [ ] Branch-aware data (when multi-branch)
- [ ] Quick action shortcuts (configurable)
- [ ] Cashier-vs-Owner dashboard variants
- [ ] Decide final widget set + order

---

## Task 3 — POS / Checkout (hero screen)  [~] *temp-locked, revisit*

### Layout

- [x] Cart 65% / Products 35% default; resizable splitter (drag, double-click reset)
- [x] Swap left ↔ right toggle (in cart toolbar)
- [x] Layout (orientation + ratio) persisted per user

### Product picker (left side)

- [x] Search by name / SKU / barcode (auto-focus, F2)
- [x] Category chips with emojis
- [x] Product grid with stock + price

- [x] Barcode scan integration (Enter-to-add)
- [x] Variations as separate SKUs (paint 1L/4L/20L) — no modal picker
- [x] List view toggle (grid vs compact list)
- [x] Brand filter
- [x] OOS shown/hidden toggle (greyed)
- [x] Negative stock allow toggle
- [x] Empty / no-results state
- [x] Scan button (clears + focuses search)
- [ ] Product image upload + thumbnails (placeholder for now)
- [ ] Recently scanned strip
- [ ] Price preview tooltips

### Cart (right side)

- [x] Customer card with due preview + over-credit-limit warning
- [x] Cart lines (qty steppers, line discount, remove, thumbnail, badge)
- [x] Labelled fields: Quantity, Unit, Markup %, Disc %, Disc ৳
- [x] Subtotal, line discount, order discount, tax, total
- [x] Tabular currency numerals everywhere
- [x] Native number-input arrows hidden globally

- [ ] Notes per line
- [ ] Notes for invoice
- [ ] Custom tax override per line
- [ ] Tax inclusive vs exclusive toggle
- [ ] Service charge / packaging charge (use "Other" field for now)

### Carts & flow

- [x] Parked carts (multi-tab) at top
- [x] Hold (F9) → suspend active cart, replace with fresh
- [x] Save as Draft (F6) — held with `[Draft]` prefix (UI; backend will split into proper tables)
- [x] Save as Quotation (F7) — held with `[Quote]` prefix
- [x] Recall Held / Drafts list (F5 modal with search, Resume, Discard)
- [ ] Convert Quotation → Sale (button on Quotation row in held list)

### Customer

- [x] Quick customer pick (F3 modal: search, list)
- [x] Add new customer inline (name + phone + group → save & select)
- [x] Default customer = Walk-in
- [x] Switch price group from cart toolbar
- [x] Show outstanding due summary (badge in customer chip)
- [x] Credit limit warning when due ≥ limit
- [ ] Per-customer default price group on pick (auto-switch)

### Payment

- [x] Payment method tiles in cart (Cash, bKash, Nagad, Card, Bank, Credit)
- [x] **Pay (F8)** opens Payment modal — Cash default
- [x] Single mode + Quick tender chips (100, 200, 500, 1000, 2000, Exact)
- [x] Split payment dialog (multiple lines)
- [x] Tendered + change calculation
- [x] Reference / TxID field for bKash / Nagad / Card / Bank
- [x] Credit-line check vs customer credit limit
- [x] Save sale + open receipt preview
- [ ] Email / SMS receipt option
- [ ] Card terminal integration (placeholder for hardware later)

### Misc

- [x] Keyboard shortcuts (F2, F3, F5, F6, F7, F8, F9, F10, Ctrl+P, Esc, ?)
- [x] Shortcuts help overlay (?)
- [x] Receipt preview modal before print (BD invoice format with amount-in-words)
- [x] Re-print last receipt (Ctrl+P)
- [ ] F4 = focus order discount input
- [ ] Cancel / void sale (with permission)
- [ ] Big-button mode (moved to Settings → POS preferences)
- [ ] Returns from POS (using separate Returns screen — Sales module)

---

## Task 4 — Sales Module  [x]

### All Sales

- [x] List with **customizable columns** (15 options, 10 visible by default)
- [x] Filters: search, date range, customer, cashier, payment method, status (paid/partial/due/voided)
- [x] KPI strip (sales count, revenue, paid, due, tax, discount)
- [x] Row click opens **Sale Detail drawer**; "Open full page" link to `/sales/:id`

### Sale Detail (drawer)

- [x] Status pills (Paid / Partial / Due / Voided / Draft / Quotation)
- [x] Customer header with total due
- [x] Items table, totals breakdown, payments list
- [x] **Audit log** (created / edited / paid / voided / returned / shipped)
- [x] Footer actions: Print · Re-print · Add Payment · Create Return · Create Shipment · Edit · Void / Delete

### Add / Edit Sale form

- [x] Full-page form at `/sales/new` and `/sales/:id/edit`
- [x] Save as Final / Draft / Quotation (with valid-until for quotations)
- [x] Items table with inline qty/price/disc% edit + product search
- [x] Order charges sidebar (Disc %, Disc ৳, VAT %, Shipping, Other)
- [x] Sticky totals card with live total
- [x] Customer existing-due warning

### Drafts

- [x] Drafts list with search, view, convert-to-sale, delete

### Quotations

- [x] Quotations list with valid-until + expired badge
- [x] Convert to Sale (opens edit form)

### Sell Returns

- [x] Returns list (search, refund method badge, total)
- [x] **Create Return modal** from any final sale: pick lines + qty, choose reason, choose refund method (Cash, CreditAdjust, StoreCredit, bKash, Nagad, Card, Bank), notes
- [x] Reason dropdown: damaged / wrong-item / changed-mind / defective / warranty / other

### Shipments

- [x] Shipments list with status filter (pending / in-transit / delivered / failed)
- [x] **Create Shipment modal** (driver, vehicle, tracking, address, target date, status, notes)
- [x] Inline status edit on each row

### Add Payment to existing sale

- [x] **Add Payment modal** (method tiles, tendered + reference field for non-cash, full-due / half quick buttons)

### Edit / Void / Delete

- [x] Drafts and Quotations: deletable
- [x] Final sales: **Void only** (with reason prompt) — keeps record in audit
- [x] Audit log written on every state change

### Import Sales

- [x] CSV download template + upload + review + import
- [x] Documented column contract that round-trips with export

### Pending

- [ ] `/sales/:id` full-page detail view (currently drawer + edit form)
- [ ] Edit pre-fill from existing sale (currently the form starts blank — needs to load by id)
- [ ] Convert quotation → final via dedicated button (currently routes through edit)
- [ ] Discount rules screen (deferred per recommendation)
- [ ] Print delivery slip template (different from invoice)
- [ ] Email / SMS receipt + delivery slip
- [ ] Real Print buttons (currently no-ops; reuse Receipt from Task 3)

---

## Task 5 — Purchases Module  [~]

- [x] **All Purchases list** with customizable columns (15 options, 10 default)
- [x] Filters: search, supplier, payment status pills, status pills (received / ordered / in-transit / cancelled)
- [x] KPI strip (count, value, paid, payable, tax, discount)
- [x] **Pay Bill** modal — supplier picker, auto-allocate (oldest first) or pick bills manually, full method tile set + reference
- [x] **Add Purchase page** matching the BD reference layout: Supplier (with auto-fill address) · Reference No (auto if blank) · Business Location · Purchase Date · Pay Term · Purchase Status · Attach Document · IMEI/Serial column on lines · Unit Cost (Before Disc) · Discount % · Unit Cost (Before Tax, computed) · Line Total · **Profit Margin %** color-coded · **Unit Selling Price (Inc.)** editable
- [x] Bottom: Discount Type (flat/percent) · Discount Amount · Purchase Tax % · Shipping + Shipping Details · Other · Additional Notes
- [x] **Save Unpaid** + **Save & Pay** (opens Supply Payment modal)
- [x] **Supply Payment modal** (Advance Balance, Amount, Paid On, Payment Method tiles, reference)
- [x] **Purchase Detail drawer** — status pills, supplier card, line table with S/N, totals, payments, audit, footer actions (Print · Re-print · Add Payment · Create Return · Edit · Cancel/Delete)
- [x] Edit / cancel / delete policy mirrors Sales
- [x] **Purchase Returns list** + **Create Purchase Return modal** (pick lines+qty, reasons, refund methods inc. CreditAdjust)
- [x] **Import Purchases** (CSV: 21 headers, one row per line item, multiple payments via repeated rows)
- [x] Margin warning: lines with margin < 10% flagged with `AlertTriangle`, save-time confirm
- [x] Sidebar entries: All / Add / Returns / Import

### Pending

- [ ] Edit pre-fill from existing record (currently inserts new)
- [ ] Cross-module handoff: Stock Alerts → Add Purchase prefill
- [ ] Print GRN / delivery note template
- [ ] Card / online terminal integration for supplier payments

---

## Task 6 — Products Module  [x]

### Products list

- [x] All Products list with **table ↔ grid** toggle
- [x] **Customizable columns** — show/hide + reorder via Settings panel
- [x] Default columns: image, name, sku, category, brand, price, stock, status
- [x] Available extra columns: barcode, unit, cost, wholesale, contractor, reorder, tax, warranty, updatedAt
- [x] Filters: search (name/sku/barcode), category, brand, stock state, price range
- [x] **Bulk select bar** with delete, export, barcode print, bulk update
- [x] Row hover actions: edit, more (open editor / duplicate / delete)
- [x] KPI strip (total products, stock value, retail value, low stock count)

### Add / Edit Product

- [x] **Quick-edit drawer** (right slide-over, same form)
- [x] **Full-page editor** at `/products/new` and `/products/:id`
- [x] Sections: Image, Status, Basic Info, Pricing, Units, Stock, Description
- [x] Required: Name, SKU, Sell price, Category, Brand
- [x] **Auto-generate SKU** (CAT-BRAND-NN) and **barcode** (BD 880-prefixed pseudo-EAN)
- [x] Single image upload with preview + remove
- [x] **Category-based emoji placeholder** when no image
- [x] Pricing: cost / SPR / wholesale / contractor + auto **margin %** display
- [x] **Multi-unit** with per-unit conversion factors (1 dz = 12 pc, etc.)
- [x] Tax % per product (default 0; default POS VAT also 0)
- [x] Stock + reorder level
- [x] Description (textarea)
- [x] Settings toggles: track stock, allow negative sale, allow discount, show in POS, not for sale

### Pending

- [ ] Variations builder (kept "separate SKUs" approach per Task 3 — this is for templates that spawn many SKUs at once)
- [ ] Multi-warehouse stock view
- [ ] Warranty link picker (waits for Warranties CRUD)
- [ ] Multi-image gallery (single image for now per Q8)

### Master data (sub-screens)

- [x] Categories CRUD with optional one-level subcategories + emoji icon picker
- [x] Brands CRUD (name only — BD shops won't upload logos for every brand)
- [x] Units CRUD with type (count/weight/length/volume/pack) + conversion to base
- [x] Warranties CRUD (name, duration in months, description)
- [x] Selling Price Groups CRUD (custom groups, default group locked from delete)
- [ ] Variation templates — **skipped per user (using separate SKUs)**

### Bulk operations

- [x] **Bulk Price Update** — filter + select + apply (flat ±, percent ±, set =, with rounding)
- [x] **Barcode Print** — pick + copies + label size (50×30 / A4 grid) + show toggles + print preview
- [x] **Import Products** (CSV download template, upload, validate, review, import)
- [x] **Import Opening Stock** (CSV: sku, branch, qty, unit, cost)

---

## Task 7 — Stock Module  [x]

- [x] **Stock Report** with customizable columns (14 options, 8 default), filters (search, category, brand, stock state), KPI strip (products, units, value @ cost, value @ retail, low, out)
- [x] **Stock Alerts** with Low / Out tabs, suggested order qty per row (`reorder × 2 − current`), bulk select → "Create Purchase ({n})" with cost estimate
- [x] **Stock Transfers list** with filters (search, status pills incl. Inbound shortcut), columns (ref, from→to, items, value, by, status), inline cancel + Receive button
- [x] **Receive Transfer modal** — confirm received qty per line, variance preview, auto-adjustment hint
- [x] **Add Stock Transfer page** — from/to branch with arrow, status (pending / in-transit / received), date, items search, line table, summary card
- [x] **Stock Adjustments list** with type filter (damage / theft / sample / recount / other), columns (ref, type, lines, net qty, net value, by, reason)
- [x] **Add Adjustment page** — type, branch, items with **signed qty** (negative for damage/theft, positive for found), live net value summary, default sign by type

### Pending

- [ ] Per-product "Stock Movements" history page
- [ ] Real multi-branch context wiring
- [ ] Bulk purchase creation from alerts (waits for Task 5)
- [ ] Print transfer slip + adjustment voucher templates

---

## Task 8 — Contacts Module  [x]

### Customers

- [x] List with **table ↔ grid toggle** + customizable columns (14 options, 8 default)
- [x] Filters: search, group, tags, due-status (All / Has Due / No Due / Over Limit)
- [x] KPI strip (count, sales, paid, outstanding)
- [x] Bulk select bar (Send SMS · Export · Delete)
- [x] **Add / Edit Customer** — drawer (quick) + drawer-based form with sections (Basic, Credit & balances, Tags & notes)
- [x] **Customer Detail page** at `/contacts/customers/:id` with tabs: Overview, Ledger, Sales History, Returns, Notes
- [x] Header card with credit usage progress bar + over-limit warning
- [x] **Ledger** with running balance (opening / sale / return / payment events)
- [x] **Receive Payment modal** — auto-allocate (oldest-first) or pick invoices manually toggle, with method tiles + reference field
- [x] Sales History tab (click row → SaleDetail drawer)
- [x] Returns tab + Notes tab (auto-saves)
- [x] **Customer Dues page** with aging buckets (0-30 / 30-60 / 60-90 / 90+), bulk reminder, individual Receive
- [x] **Customer Groups** = Selling Price Groups (single entity), with default credit limit / default discount % / tax exempt
- [x] **Import Customers** (CSV: name, phone, alt_phone, email, address, group, credit_limit, opening_balance, dob, tags, notes)

### Suppliers

- [x] List with table ↔ grid toggle + customizable columns
- [x] KPI strip (count, purchase, paid, payable)
- [x] **Add / Edit Supplier** with sections (Basic, Trade & finance, Notes)
- [x] **Supplier Detail page** with tabs: Overview, Ledger (placeholder), Purchases (placeholder), Notes
- [x] **Pay Supplier modal** with method tiles
- [x] **Import Suppliers** (CSV: name, company, contact_person, phone, …, tax_id, bank_account, lead_time_days, payment_terms, opening_balance, tags, notes)

### Pending

- [ ] Auto-switch cart price group when customer is picked (cross-module wire)
- [ ] Bulk SMS reminder (waits for Task 12 SMS module)
- [ ] Print Customer / Supplier statement PDF
- [ ] Supplier ledger + Purchases tab (waits for Task 5)
- [ ] Pay Supplier auto-allocate against open purchase invoices (waits for Task 5)

---

## Task 9 — Cash Register / Shift  [x]

- [x] Active shift dashboard (`/cash-register`) — shift status card, KPIs (Opening / In / Out), big "Expected in drawer" card with formula tooltip
- [x] Live cash movements list with filter (All / In / Out)
- [x] **Open Shift modal** (auto-opens when no shift active, with opening cash + note)
- [x] **Cash In / Cash Out modal** (direction toggle, amount, reason dropdown, note)
- [x] **Close Shift wizard** — 4-step flow: Count denominations · Variance check · Notes (required if variance) + Carry-over float · Confirm
- [x] Variance soft warn (100 BDT) and hard block (1000 BDT) thresholds
- [x] **X-Report modal** (mid-shift snapshot)
- [x] **Z-Report modal** (after close, same component variant)
- [x] **Register Report page** (`/cash-register/report`) — history, filters (date range, status, search), row click → ShiftReport modal
- [x] Titlebar shift pill wired to current shift, clickable → opens Cash Register

### Pending

- [ ] Manager PIN override for variance block (currently confirm-prompt placeholder)
- [ ] Bank deposit tracking screen (carry-over excess earmarked)
- [ ] Multi-branch shift context (currently hard-coded to "Mirpur Branch")
- [ ] Auto-write cash movements from POS / payments / expenses (waits for backend)
- [ ] Thermal printer formatted X/Z report

---

## Task 10 — Expenses  [x]

- [x] **Expenses list** with customizable columns (11 options, 8 default)
- [x] Filters: search · category · payment method · date range pills · min/max amount
- [x] **KPI strip** (count, total, cash, non-cash, this month, this year)
- [x] **Bulk actions** (Export / Delete) when rows selected
- [x] **Add Expense drawer** with: amount, date, category (with inline `+` to add new), payment method tiles, reference for non-cash, description, branch, attachment, **recurring toggle** with frequency (daily/weekly/monthly/yearly) + optional end date
- [x] **Edit Expense** (same drawer with prefilled values + Delete button)
- [x] **Expense Categories page** with hierarchical view (parent + subcategories), monthly budget per category, expense count + this-month spend with over-budget highlight
- [x] **New / Edit Expense Category modal** (name, parent, emoji icon picker, monthly budget)
- [x] **Import Expenses** (CSV: date, category, subcategory, amount, payment_method, reference, note, branch, user, attachment_url)
- [x] Sidebar: All / Categories / Import

### Pending

- [ ] Recurring expense automation (waits for backend job)
- [ ] Budget alerts when over-budget (waits for SMS module)
- [ ] Receipt OCR for auto-fill from uploaded image (future)

---

## Task 11 — Reports  [x]

- [x] Reports landing grid (grouped: Overview / Sales / Purchases / Stock / People / Operations)
- [x] Standard report toolbar (date presets, custom range, branch picker, per-report filters, Excel/PDF/Print buttons)

### Overview
- [x] Profit / Loss (hero KPIs + money-in/money-out blocks + tax breakdown + drill stubs)
- [x] Activity Log (search, user/action/entity filters, day grouping, action-typed icons)
- [x] Register Report (links to existing Cash Register history)

### Sales
- [x] Product Sell Report (units sold per product, profit, margin, sortable)
- [x] Sell Payment Report (payments listed, method breakdown chips with progress)
- [x] Trending Products (top 50 by units/revenue, sparklines, vs prior period delta)
- [x] Sales Rep Report (commission agents with gross/returns/net/earned/pending)
- [x] Customer Group Report (per group: customers, sales, avg ticket, due)

### Purchases
- [x] Product Purchase Report (units purchased per product, avg cost, suppliers)
- [x] Purchase Payment Report (parallel to sell payment)
- [x] Tax Report (sales VAT vs purchase VAT, net position, by-rate breakdown)

### Stock
- [x] Stock Report (catalog with stock + value @ cost + value @ retail + state badges)
- [x] Stock Alert (low + out tabs, suggested order qty, est. cost)
- [x] Stock Adjustment (by-type breakdown, signed qty/value)
- [x] Stock Transfers (status filters, from→to display, value totals)

### People
- [x] Customer / Supplier (toggle, per-contact summary with sales/paid/due, drill into ledger)

### Operations
- [x] Items Report (catalog snapshot with cost/price/margin/tax/POS visibility)

### Pending
- [ ] Real Excel/PDF export at backend stage (currently shows alert)
- [ ] Drill-down clicks (currently show alert; will route to entity drawer/page when permission layer lands)
- [ ] Real commission agent → sale assignment (currently mock-distributed evenly)
- [ ] Saved report templates (user can save filter combinations)
- [ ] Scheduled reports (email PDF on schedule — needs backend scheduler)
- [ ] Permission gating on per-report basis (`reports.view`, `reports.export`, profit-hide for cashier role)

---

## Task 12 — SMS Module  [x] *frontend complete; gateway wiring deferred*

- [x] SMS landing dashboard (credit balance, sent/last-7-days/failed KPIs, section tiles, gateway status banner)
- [x] **Send SMS** screen — three modes (single customer search, group blast, manual numbers), template picker, variable inserter, live preview, char/parts/encoding meters, cost summary, send-disabled guards
- [x] **Templates CRUD** — name, category (sale/payment/reminder/promotion/greeting/other), language (en/bn), body with variable buttons, parts/encoding badge per template, copy button, active toggle
- [x] **Groups CRUD** — name, description, customer multi-select with search, manual numbers list, send-from-card shortcut
- [x] **History** — KPIs by status, search + status filter, table with status badge, retry button on failed rows, view-detail modal with full body
- [x] **Gateway settings** — provider picker (None / SSL Wireless / BulkSMSBD / Zaman IT / BanglaTrac / Custom HTTP), API user + key (masked, eye toggle), Sender ID, custom URL field, test send, defaults (language/Unicode mode/max parts), 4 auto-send triggers (sale/payment/due/birthday)
- [x] **Buy SMS** — current balance card with purchased/spent breakdown, 6 pre-set packs with bonus credits, custom amount input, payment method tiles, sticky order summary

### Pending (backend phase)
- [ ] Real BD provider HTTP integrations (SSL Wireless, BulkSMSBD, etc.)
- [ ] Webhook receiver for delivery reports (DLR) to update sent → delivered status
- [ ] Auto-send job runner (sale/payment/due/birthday triggers)
- [ ] Real payment gateway integration for credit top-ups
- [ ] BTRC compliance (rate-limit promotional SMS during 9pm-9am)
- [ ] Sender ID approval workflow tracking

---

## Task 13 — Settings  [x]

- [x] Settings landing grid (grouped: Shop / People / Documents / Devices / Application / System)

### Shop
- [x] Business Info (logo, name, address, phone, email, currency, timezone, fiscal year, language)
- [x] Branches CRUD (with default badge, set-default, code, manager)
- [x] Tax Rates CRUD (name, %, scope, default)

### People
- [x] Users CRUD with role assignment, branch assignment, status, PIN
- [x] Roles & Permissions matrix (system roles: Admin / Manager / Cashier / Stock Keeper + custom)
- [x] Sales Commission Agents (placeholder — minimal CRUD; wires into Add Sale later)

### Documents
- [x] Invoice Schemes (numbering format per doc type, prefix, year, padding, reset rule, live preview)
- [x] Receipt template editor (paper size, header/footer text, field toggles, live preview)

### Devices
- [x] Barcode Settings (default label size, fields shown, default copies, code type)
- [x] Receipt Printer profiles (USB/Network/Bluetooth, model, IP/port, paper width, encoding, test print, set default)

### Application
- [x] POS Preferences (default markup, default tax, default & visible payment methods, behavior toggles)
- [x] Cash Register prefs (variance warn/block, default float, manager-PIN-on-variance, threshold preview)
- [x] Theme & Appearance (light/dark/system, accent hue picker + slider, density, font scale, live preview)
- [x] Keyboard Shortcuts editor (11 shortcuts, click-to-record, conflict detection, reset)

### System
- [x] Backup & Sync (local backup with auto-backup schedule, restore, cloud provider connect with sync history, data export per entity)

### Pending
- [ ] Real cloud provider OAuth (Supabase / S3 / Google Drive)
- [ ] Receipt printer test print over real ESC/POS connection
- [ ] User PIN change flow + password set/reset (waits for Task 15 Login)
- [ ] First-run wizard creates initial Business Info + Branch + Admin user (waits for Task 15)
- [ ] Per-user settings layer (user prefs vs shop prefs) — currently all global

---

## Task 14 — Global Polish  [x]

- [x] Command palette (Ctrl+Shift+P) — action registry (navigate / create / preferences / quick jumps), fuzzy filter, keyboard nav, grouped results
- [x] Global keyboard shortcut map (palette open, ESC close, Ctrl+P print in PrintFrame)
- [x] Toast / notification system — `toast.success/error/info/warning/loading/promise`, stacked top-right, auto-dismiss, action button, Zustand-backed (usable outside React)
- [x] Confirmation dialog primitive — promise-based `confirm({ title, message, variant })`, destructive variant, Enter/Esc keys
- [x] Modal primitive (extended with scale-in motion)
- [x] Drawer / Sheet primitive (extended with slide-in motion)
- [x] Empty state component (`EmptyState`)
- [x] Skeleton loader component (`Skeleton`, `SkeletonTable`, `SkeletonCards`, `SkeletonKpis`)
- [x] Error boundary (app-level, wraps main content, reload + copy-details)
- [x] Loading overlay (`LoadingOverlay`, full-screen or contained)
- [x] Print preview component (`PrintFrame` with paper sizes + print stylesheet)
- [x] Density toggle wired in titlebar (compact ↔ comfortable)
- [x] Persisted UI state (via Zustand persist — already in place)
- [x] Subtle motion (fade/scale/slide animations on modals, drawers, toasts, palette)
- [x] Replaced `alert()` / `window.confirm()` across SMS + Settings modules with toast + confirm dialog

### Pending
- [ ] Replace remaining `alert()`/`window.confirm()` in older modules (Sales/Purchases/Products/Stock/Contacts/Cash/Expenses) — mechanical sweep
- [ ] Wire EmptyState/Skeleton into list pages' loading + no-data states (currently inline)
- [ ] Reduced-motion preference (respect `prefers-reduced-motion`)
- [ ] Command palette: recent commands + customer/product quick-search results

---

## Task 15 — Login & First Run  [ ]

- [ ] Login screen (username + password OR PIN)
- [ ] Lock screen (auto-lock during open shift, quick PIN unlock)
- [ ] Forgot password flow (offline-friendly)
- [ ] First-run setup wizard
  - [ ] Shop info
  - [ ] Currency / tax
  - [ ] Admin user
  - [ ] Branch
  - [ ] Printer test
  - [ ] Cloud link (optional)

---

## Backend Phase — Part 1: Build + Verify in Isolation  [x]

Built the full offline-first data layer under `backend/` (SQLite via better-sqlite3),
proven correct in plain Node *before* any frontend wiring. Verification grew from 122
base checks to **382** as all store slices were wired + a wiring-cleanup pass (catalog/units
CRUD, full-page product editor, stock transfers/adjustments persistence, toast-on-write-reject).
See `backend/README.md`.

- [x] DB foundation — connection, pragmas (WAL, FK on), migrations, transactions
- [x] Schema — every entity (business, branches, roles, users, products, stock_movements,
      sales, purchases, payments, returns, transfers, adjustments, expenses, cash shifts,
      customers, suppliers, settings, activity log, snapshots, outbox) + indexes + FTS5
- [x] Pure calculation core — line/order totals, COGS, profit, purchase math, cash,
      margin, amount-in-words (BD lakh/crore), date-range presets
- [x] Services with correct side-effects — sales (stock-out, COGS, cash, audit),
      purchases (stock-in, supplier), returns (sell+purchase), transfers, adjustments,
      expenses, cash shifts, derived ledgers, activity log, atomic ref numbering
- [x] Aggregations — dashboard KPIs + widgets, all reports (P/L, product sell/purchase,
      payments, tax, trending, sales rep, customer group, stock, items)
- [x] Synthetic data generator — deterministic 1-year shop simulation (3,252 sales,
      71 purchases, 18 returns, 90 expenses, 341 shifts) through the real services
- [x] Rigorous verification — **56 identity checks + 36 scenario tests + determinism +
      persistent-file smoke = 102 checks, all passing**
- [x] npm scripts: `backend:typecheck`, `backend:verify`, `backend:scenarios`, `backend:verify:all`

### Pending (Backend Phase — Part 2: Wiring)
- [ ] Electron IPC layer exposing services to the renderer
- [ ] Permission enforcement at the IPC boundary (role catalog from Settings)
- [ ] Replace frontend Zustand mock stores with TanStack Query → IPC
- [ ] `electron-rebuild` better-sqlite3 for the Electron ABI at package time
- [ ] bcrypt PIN/password hashing (currently plain in mock auth)
- [ ] Nightly stock valuation snapshot job (for exact opening/closing in P/L)
- [ ] Sync outbox worker + cloud adapter (when cloud phase starts)
- [ ] SMS provider adapters (deferred — needs external gateway)

---

## Working agreement

When you say "start Task X":

1. I list screens / components in that task and ask design questions.
2. You answer (or say "your call").
3. I build → you review → iterate → you say "lock it."
4. Move to the next task.

Suggested order: **1 → 3 → 6 → 4 → 8 → 9 → 7 → 5 → 10 → 11 → 13 → 12 → 14 → 15 → 2** (loop dashboard last so KPIs match what real screens produce).
