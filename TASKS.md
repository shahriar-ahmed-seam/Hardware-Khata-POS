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
- [x] Convert SVG icon → `.ico` for Windows installer (done at packaging time via electron-builder, from build/icon.png)
- [x] Final logo / shop name come from Settings (backend later)

---

## Task 2 — Dashboard  [x]

- [x] KPI cards (sales, transactions, items, customers)
- [x] Hourly sales chart
- [x] Top selling items list
- [x] Recent sales table
- [x] Low stock card
- [x] Customer dues card

- [X] Date range selector (today / week / month / custom)
- [ ] Branch-aware data (when multi-branch)
- [ ] Quick action shortcuts (configurable) → R92
- [ ] Cashier-vs-Owner dashboard variants → R92
- [x] Decide final widget set + order (the owner customises it: CustomizePanel)

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
- [x] Product image upload + thumbnails (lib/imageFile.ts, ProductImage)
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
- ~~Custom tax override per line~~ — dropped: VAT is order-level only (lib/money.ts); see R40
- [ ] Tax inclusive vs exclusive toggle
- [ ] Service charge / packaging charge (use "Other" field for now)

### Carts & flow

- [x] Parked carts (multi-tab) at top
- [x] Hold (F9) → suspend active cart, replace with fresh
- [x] Save as Draft (F6) — held with `[Draft]` prefix (UI; backend will split into proper tables)
- [x] Save as Quotation (F7) — held with `[Quote]` prefix
- [x] Recall Held / Drafts list (F5 modal with search, Resume, Discard)
- ~~Convert Quotation → Sale (button on Quotation row in held list)~~ — quotations are now saved to the backend and converted from the Quotations page (F15, `sales.convert`)

### Customer

- [x] Quick customer pick (F3 modal: search, list)
- [x] Add new customer inline (name + phone + group → save & select)
- [x] Default customer = Walk-in
- [x] Switch price group from cart toolbar
- [x] Show outstanding due summary (badge in customer chip)
- [x] Credit limit warning when due ≥ limit
- [x] Per-customer default price group on pick (auto-switch, POS.tsx onPickCustomer)

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
- [x] F4 = focus order discount input
- [ ] Cancel / void sale (with permission) → R92 (void exists in Sales only)
- [ ] Big-button mode (moved to Settings → POS preferences) → R81 (the toggle is saved but nothing reads it)
- ~~Returns from POS~~ — handled by the Sales → Returns screen

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

- [ ] CSV download template + upload + review + import — **the upload is a mock and nothing is written** (R1/R2)
- [x] Documented column contract that round-trips with export

### Pending

- [ ] `/sales/:id` full-page detail view (currently drawer + edit form) → R107
- [x] Edit pre-fill from existing sale (AddSale loads by id, F13)
- [x] Convert quotation → final via dedicated button (`sales.convert`, F15)
- [ ] Discount rules screen (deferred per recommendation) → R112
- [ ] Print delivery slip template (different from invoice) → R82/R105 (the button has no handler)
- [ ] Email / SMS receipt + delivery slip → R112
- [x] Real Print buttons (InvoicePrintModal + PrintSheet, Save as PDF)

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
- [ ] **Import Purchases** (CSV: 21 headers, one row per line item, multiple payments via repeated rows) — **mock, writes nothing** (R1/R2)
- [x] Margin warning: lines with margin < 10% flagged with `AlertTriangle`, save-time confirm
- [x] Sidebar entries: All / Add / Returns / Import

### Pending

- ~~Edit pre-fill from existing record~~ — there is no `purchases.update`; `/purchases/:id/edit` explains cancel-and-re-enter (F13). Owner decision, with R51.
- [x] Cross-module handoff: Stock Alerts → Add Purchase prefill (lib/purchasePrefill.ts)
- [x] Print GRN / delivery note template (PurchasePrintModal)
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
- [~] **Barcode Print** — pick + copies + label size (50×30 / A4 grid) + show toggles + print preview; the "barcode" is a decorative stripe, not scannable (R13)
- [ ] **Import Products** (CSV download template, upload, validate, review, import) — **mock, writes nothing** (R1/R2)
- [ ] **Import Opening Stock** (CSV: sku, branch, qty, unit, cost) — **mock, writes nothing** (R1/R2, R53)

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

- [ ] Per-product "Stock Movements" history page → R104
- [ ] Real multi-branch context wiring → owner decision (see Audit round 2)
- [x] Bulk purchase creation from alerts (StockAlerts → `/purchases/new?prefill=alerts`)
- [ ] Print transfer slip + adjustment voucher templates → R105

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
- [ ] **Import Customers** (CSV: name, phone, alt_phone, email, address, group, credit_limit, opening_balance, dob, tags, notes) — **mock, writes nothing** (R1/R2)

### Suppliers

- [x] List with table ↔ grid toggle + customizable columns
- [x] KPI strip (count, purchase, paid, payable)
- [x] **Add / Edit Supplier** with sections (Basic, Trade & finance, Notes)
- [x] **Supplier Detail page** with tabs: Overview, Ledger (placeholder), Purchases (placeholder), Notes
- [x] **Pay Supplier modal** with method tiles
- [ ] **Import Suppliers** (CSV: name, company, contact_person, phone, …, tax_id, bank_account, lead_time_days, payment_terms, opening_balance, tags, notes) — **mock, writes nothing** (R1/R2)

### Pending

- [x] Auto-switch cart price group when customer is picked (POS.tsx)
- [ ] Bulk SMS reminder (waits for Task 12 SMS module) → owner decision (SMS gateway)
- [ ] Print Customer / Supplier statement PDF → R105
- [x] Supplier ledger + Purchases tab (SupplierDetail)
- [x] Pay Supplier auto-allocate against open purchase invoices (`suppliers.pay`, oldest first; opening balance still ignored → R30)

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

- [~] Manager PIN override for variance block — the block is enforced in main and the owner or a manager signs in to close (F11); no approver is recorded (R27)
- [ ] Bank deposit tracking screen (carry-over excess earmarked) → R110
- [~] Multi-branch shift context — the "Mirpur Branch" name is gone (lib/branch.ts); still single-branch (owner decision)
- [x] Auto-write cash movements from POS / payments / expenses (`postCashToOpenShift`; dropped silently with no open shift → R6)
- [ ] Thermal printer formatted X/Z report → owner decision (thermal printing)

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
- [ ] **Import Expenses** (CSV: date, category, subcategory, amount, payment_method, reference, note, branch, user, attachment_url) — **mock, writes nothing** (R1/R2)
- [x] Sidebar: All / Categories / Import

### Pending

- [ ] Recurring expense automation (waits for backend job) → R108
- [ ] Budget alerts when over-budget (in-app first; SMS later) → R108
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
- [ ] Real Excel/PDF export (no page passes a handler, so the toolbar hides both buttons) → R105
- [ ] Drill-down clicks (rows are presentational now) → R105
- [ ] Real commission agent → sale assignment (the report reads `sales.agent_id`, but no screen sets it) → R56
- [ ] Saved report templates (user can save filter combinations)
- [ ] Scheduled reports (email PDF on schedule — needs backend scheduler)
- [ ] Permission gating on per-report basis (`reports.view`, `reports.export`, profit-hide for cashier role) → R14/R15

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
- [~] Business Info (logo, name, address, phone, email, currency, timezone, fiscal year, language) — currency format, date format, fiscal year and language are saved but never applied (R81)
- [x] Branches CRUD (with default badge, set-default, code, manager)
- [x] Tax Rates CRUD (name, %, scope, default)

### People
- [x] Users CRUD with role assignment, branch assignment, status, PIN
- [x] Roles & Permissions matrix (system roles: Admin / Manager / Cashier / Stock Keeper + custom)
- [x] Sales Commission Agents (placeholder — minimal CRUD; wires into Add Sale later)

### Documents
- [~] Invoice Schemes (numbering format per doc type, prefix, year, padding, reset rule, live preview) — saved to settings_kv; real numbers come from the `invoice_schemes` table, so edits change nothing (R12)
- [~] Receipt template editor (paper size, header/footer text, field toggles, live preview) — paper size only affects the preview; the printer profile's width is what prints (R81)

### Devices
- [~] Barcode Settings (default label size, fields shown, default copies, code type) — Barcode Print never reads them (R81)
- [~] Receipt Printer profiles (USB/Network/Bluetooth, model, IP/port, paper width, encoding, test print, set default) — only paper width and default are used; "Test print" is a toast (R81)

### Application
- [~] POS Preferences (default markup, default tax, default & visible payment methods, behavior toggles) — only markup and tax are read; the other six do nothing (R81)
- [~] Cash Register prefs (variance warn/block, default float, manager-PIN-on-variance, threshold preview) — the variance gate works (F11); default float is never read (R81)
- [x] Theme & Appearance (light/dark/system, accent hue picker + slider, density, font scale, live preview)
- [~] Keyboard Shortcuts editor (11 shortcuts, click-to-record, conflict detection, reset) — saved, but POS hard-codes its keys (R81)

### System
- [x] Backup & Sync (local backup with auto-backup schedule, restore, cloud provider connect with sync history, data export per entity)

### Pending
- ~~Real cloud provider OAuth (Supabase / S3 / Google Drive)~~ — replaced by backups into a folder the owner's OneDrive/Drive/Dropbox client syncs
- [ ] Receipt printer test print over real ESC/POS connection → owner decision (thermal printing); today "Test print" is a toast (R81)
- [~] User PIN change flow + password set/reset — an admin can set a PIN in Users; no self-service change → R109
- [x] First-run wizard creates initial Business Info + Branch + Admin user (waits for Task 15)
- [ ] Per-user settings layer (user prefs vs shop prefs) — currently all global

---

## Task 14 — Global Polish  [x]

- ~~Command palette (Ctrl+Shift+P)~~ — removed later (AppShell.tsx); the sidebar and Ctrl+K search cover it
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
- [x] Replace remaining `alert()`/`window.confirm()` in older modules — none left in src (rule 9)
- [~] Wire EmptyState/Skeleton into list pages' loading + no-data states — 13 of 48 pages → R95
- [ ] Reduced-motion preference (respect `prefers-reduced-motion`) → R95
- ~~Command palette: recent commands + customer/product quick-search results~~ — palette removed

---

## Task 15 — Login & First Run  [x]

- [x] Login screen (username + password OR PIN) — pages/auth/LoginPage.tsx
- [x] Lock screen (auto-lock during open shift, quick PIN unlock) — main-process lock since F3; idle-timer gaps → R91
- [x] Forgot password flow (offline-friendly)
- [x] First-run setup wizard (FirstRunWizard.tsx; input validation → R19)
  - [x] Shop info
  - [x] Currency / tax
  - [x] Admin user
  - [x] Branch
  - [x] Printer test (a sample print, not ESC/POS)
  - [x] Cloud link (optional — a synced backup folder)

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
- [x] Electron IPC layer exposing services to the renderer (electron/ipc.ts, preload.ts)
- [~] Permission enforcement at the IPC boundary — writes are gated; reads are open with no session (R14)
- [~] Replace frontend Zustand mock stores with IPC — every store hydrates over IPC; TanStack Query only for catalogue reads; the SMS store is still local (unrouted)
- [x] `electron-rebuild` better-sqlite3 for the Electron ABI at package time (`npmRebuild: true`)
- [x] bcrypt PIN/password hashing (bcryptjs, backend/services/auth.ts)
- [ ] Nightly stock valuation snapshot job (for exact opening/closing in P/L) → R38 (stock-at-date from movements may replace it)
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

---

## Fix pass — September 2026 (Linux run + whole-repo audit)  [x]

Found by running the app on Ubuntu 24.04 and a read-through of backend/, electron/ and src/.
Worked top to bottom. Every backend rule change gets a check in `backend/verify/`.

### Security
- [x] F1. Close the `auth.*` bypass (renderer could call `auth.setSecret` with no session and reset the admin PIN); refuse `session.login` before first-run setup; throttle wrong PINs on login/unlock
- [x] F2. `settings.set` accepts only the UI preference keys (it could reset `setup_complete`, the backup config, invoice sequences)
- [x] F3. Lock screen locks the main-process session too (writes refused while locked)
- [x] F4. Electron hardening: `invoice.openPdf` only opens PDFs in the PDF folders; `openExternal` only for http(s)/tel/mailto; block in-window navigation; no default menu (DevTools/reload) in production
- [x] F5. Renderer writes stop hard-coding who did it (`'Seam'`, `'u_admin'`) — use the signed-in user

### Stock and money (backend)
- [x] F6. Returns: only against a final sale / received purchase, qty > 0, never more than was sold/bought minus earlier returns, refund capped at the line's value, pack sizes converted, purchase return inherits the supplier and writes `purchase_audit`
- [x] F7. Void / cancel / delete / pay guards: no void or cancel after returns, no delete of a purchase with payments or returns, no payments on void/cancelled/draft documents, `updateSale` keeps pack size + cost and cannot turn a final sale back into a draft
- [x] F8. Customer and supplier balances only count returns against live documents
- [x] F9. Purchases get `credited` (schema v10) so a CreditAdjust purchase return reduces the bill's due
- [x] F10. Transfers: cannot be received twice, received qty clamped, same-branch refused, in-transit transfers can be cancelled (`transfers.cancel`)

### Screens
- [x] F11. Close Shift: in-app confirm instead of `window.confirm`; the over-limit gate actually gates
- [x] F12. Return modals: refund from the line's net value via `lib/money.ts`, one row per line, capped at what is still returnable
- [x] F13. `/sales/:id/edit` and `/purchases/:id/edit` load the record by id and can never save a duplicate (purchases: no `purchases.update` exists, so the route explains cancel-and-re-enter instead of faking an edit)
- [x] F14. Sell/purchase returns: real customer name, purchase-return list loads, detail view with lines, dead buttons removed
- [x] F15. Drafts/quotations: real Convert to Sale (new invoice number, `source_quotation_id`), print titled Quotation/Draft, customer sales history shows final/void only
- [x] F16. SaleDetail line subtotal via `lib/money.ts`; dead return/shipment checks wired or removed; dead links fixed

### Reports
- [x] F17. Profit & Loss treats returns correctly; COGS average ignores cancelled purchases; dashboard buckets use shop-local time; search tolerates `-`, `(`, `:` etc.

### Electron lifecycle + Linux
- [x] F18. Second instance never opens the DB; DB closed on quit; DB-init failure is shown; restore is atomic and reopens on failure; first auto-backup check soon after launch; `backup.configure` accepts only config fields
- [x] F19. Linux: removable-drive detection via `lsblk`, window icon, `build:linux` target (AppImage + deb)
- [x] F20. Cosmetic: sidebar fills the height, 0-vs-0 deltas show `—`, splash shows the real version, README counts

### Wrap-up
- [x] F21. All gates green (typecheck ×2, 1,433 checks, i18n, build), Bangla for new strings, docs 03/07 updated, left on the Electron ABI

### Needs an owner decision (not started)
- Non-cash refunds (Bank/bKash/Nagad/Card) have no ledger — add one, or stop offering them
- Store credit accumulates and is never spent or shown
- `purchases.update` (editing a received purchase in place)
- Linux builds: releases carry no `latest-linux.yml`, so the in-app update check errors on Linux — publish Linux artifacts or disable checks there
- Multi-branch switcher (the `'br_mp'` literals), SMS gateway, thermal printing, code signing

---

## Audit round 2 — September 2026 (full re-check after the fix pass)  [ ]

Six parallel read-throughs (electron + build, backend writes, backend reads + DB,
screens, stores/hooks/lib, docs + this checklist) followed by spot checks in the code.
Items fixed since are ticked with a **Done (Sep 2026)** note. IDs are `R1…`; the fix pass above used `F1…`.

Priority: **P0** the books or the screen can be wrong today · **P1** security, audit
trail, or likely to bite · **P2** edge cases, performance, incomplete · **P3** polish
and tech debt. Every backend rule change still gets a check in `backend/verify/`.

Checklist corrections made while writing this: the seven importers in Tasks 4–10 were
ticked but write nothing (un-ticked, see R1); items verified as done were ticked in
place; superseded items are struck through with the reason.

### P0 — the books or the screen can be wrong today

- [ ] R1. **The seven importers are fake.** `src/pages/Import{Products,OpeningStock,Customers,Suppliers,Sales,Purchases,Expenses}.tsx`: `handleFile` never reads the file and sets `{ rows: 24, valid: 22, errors: 2 }` after a timeout ("Mock parse"); **Import** only sets the stage to `done`, which says "Import complete · N imported". Nothing reaches the database. → Hide them from the Import Hub now (or say "not available yet"), then R2. **Partly done (Sep 2026):** The importers are switched off: every import route lands on the hub, which says "Not available yet" and links to the manual screen; the Import buttons are gone. Real importers are R2.
- [ ] R2. Real importers: one backend `import.<kind>` channel per kind that parses the CSV, validates every row (SKU unique, numbers finite, unit/category/brand/branch exist), writes in ONE transaction, syncs FTS and returns per-row errors; permission-gated; verify checks. Order: products → opening stock → customers → suppliers; sales/purchases/expenses last (they move stock and cash).
- [x] R3. Validate sale and purchase LINES in the backend. A sale line with qty −5 puts 5 INTO stock (`writeSaleBody` moves `-baseQty`, and `computeSaleLine` clamps the subtotal to 0); a negative purchase qty takes stock out; NaN/Infinity pass. → one shared validator: qty > 0 and finite, price/cost ≥ 0, discount % 0–100, flat discount ≤ line gross, product exists and is not archived, customer and branch exist. **Done (Sep 2026):** backend/core/validate.ts `assertDocumentLines` (qty > 0 and finite, prices ≥ 0, discount 0–100 %, flat ≤ gross), products must exist and not be archived (a correction may keep an archived line), customer/branch/supplier must exist. chain `chain-input-checks`.
- [x] R4. Validate order totals. `computeSaleTotals` / `computePurchaseTotals` (core/calc.ts) never bound the order discount (above the subtotal it is stored and drives profit negative; negative it raises the price), tax %, round-off, shipping or other. → 0 ≤ discount ≤ subtotal, 0 ≤ tax ≤ 100, |round-off| < 1, shipping/other ≥ 0. **Done (Sep 2026):** `assertOrderCharges` + `assertDiscountWithinSubtotal`: 0 ≤ order discount ≤ subtotal, 0 ≤ tax ≤ 100, shipping/other ≥ 0, |round-off| ≤ 10 (`MAX_ROUND_OFF`; ৳1 was too tight for the round-to-10 the counter uses).
- [x] R5. Cancelling an ORDERED purchase loses its cash advance. The cash reversal is inside `if (pur.status === 'received')` in `cancelPurchase`, but `paid` is zeroed for every status: the advance left the drawer and is on no bill and no payable. → reverse cash for any status; record a non-cash advance as owed back by the supplier. **Done (Sep 2026):** `cancelPurchase` reverses the cash for any status; non-cash money on a cancelled bill stays with the supplier as a credit (`heldBySupplier`).
- [x] R6. Cash is dropped silently when no shift is open. `postCashToOpenShift` returns null (cash.ts) and no caller checks it: cash sales, due collections, refunds, expenses, supplier payments and every void/edit/cancel reversal miss the drawer. → refuse a Cash movement with no open shift (the screen offers to open one) and check it in chain.ts. **Done (Sep 2026):** Owner decision: no Open Shift step. The drawer opens itself on the first cash event (`ensureOpenShift`), carrying forward the last shift's float/count/expected; `postCashToOpenShift` never drops a movement. chain `chain-drawer-opens-itself`.
- [x] R7. Refunds can exceed what was paid. `createSellReturn` pays a Cash refund out of the drawer without looking at `sales.paid`, so an unpaid credit invoice can be "refunded" in cash (same for `CashRefund` on an unpaid bill). A CreditAdjust above the remaining due clamps the invoice at 0 while `customerDue` subtracts all of it — a hidden negative balance. → cap cash at paid − cash already refunded, cap CreditAdjust at the remaining due, offer the rest by the other method. **Done (Sep 2026):** `assertRefundWithinSettlement`: money back ≤ paid − earlier money refunds; CreditAdjust ≤ the remaining due (sell and purchase side). chain `chain-refund-within-settlement`.
- [x] R8. Returns with no source document skip every guard (`docLines` is filled only when `saleId` is given, returns.ts): any qty goes back on the shelf, any amount leaves the drawer. → require a document, or put "manual return" behind a permission with a price ceiling and a required reason. **Done (Sep 2026):** Option 1: a return needs its sale / purchase (`returns.ts`).
- [x] R9. The backend accepts credit on a walk-in and accepts overpayment. `createSale` stores `due > 0` with no customer (rule 22 lives only in PaymentModal/AddSale); `createSale`, `addSalePayment` and `addPurchasePayment` never cap payments at the due, so khata balances go negative. → refuse both in the services. **Done (Sep 2026):** `assertSaleSettlement` / `assertPurchaseSettlement`: a walk-in cannot owe or overpay; a named customer may pay ahead (an advance, shown as a negative due); overpaying a bill needs a supplier.
- [ ] R10. The POS unit picker is only a label. `CartLineRow` offers "dz"/"box", but the price stays per piece and POS never sends `unitFactor` (POS.tsx, "DEFERRAL"), so "2 dz" sells and deducts 2 pieces. → hide the picker, or price per pack and send the factor. Before any path sends a factor > 1, fix `computeCogs` in `computeSaleBody` (sale-unit qty × per-piece cost) and Product Sell's `SUM(qty × unit_cost_at_sale)`. **Partly done (Sep 2026):** The COGS half is fixed (qty × unit factor × base cost). The POS picker itself still needs the owner decision.
- [x] R11. AddSale can lose a sale: `addSale` is fire-and-forget (stores/sales.ts) and AddSale leaves the page straight after (AddSale.tsx `addSale(rec); goToList(...)`), so a refused sale toasts after the form is gone. → return `Promise<boolean>`; leave only on success. **Done (Sep 2026):** `addSale` resolves `{id, invoiceNo} | null`; AddSale leaves only on success.
- [ ] R12. Invoice Schemes changes nothing. The page saves a `schemes` blob in settings_kv; numbers come from the `invoice_schemes` table (backend/services/sequences.ts), so prefix/padding/reset edits and the preview are fiction. → a channel over `invoice_schemes` (or remove the page); make `nextRef` honour `reset_rule`, `start_number` and the document's date.
- [ ] R13. Barcode labels print a decorative stripe, not a barcode (BarcodePrint.tsx, the same `repeating-linear-gradient` on every label). → a small pure Code128/EAN-13 encoder drawing `p.barcode`, or call the screen "price tags" and drop the stripe.

### P1 — security and access

- [ ] R14. Reads answer anyone, signed out or locked. `permissionError` returns null for any channel missing from `CHANNEL_PERMISSIONS` before it looks at the session (electron/guard.ts), so P&L, costs, customers, users and settings answer at the sign-in and lock screens; 18 permission ids (`reports.view`, `products.view`, `contacts.viewCustomers`, `cash.zReport`, …) are enforced nowhere. → require an unlocked session for everything except `session.*`, `setup.status`, `update.state`; map reads to their `*.view` permission; security.ts checks.
- [ ] R15. No route guards in the renderer: only 5 files call `useCan`, so a cashier can open Reports (profit), Settings, Users and Roles. → route-level guard and menu hiding by permission (IPC stays the real gate).
- [ ] R16. Discount and price-override rights are UI-only: `pos.discount` / `pos.priceOverride` are never checked; `sales.create/update/convert` need only `sales.create`/`sales.edit`. → a pure guard.ts check comparing line prices and discounts with the catalogue.
- [ ] R17. A session keeps the rights it signed in with. `handleLogin` copies permissions once (ipc.ts); deactivating, demoting or deleting the user, or editing the role, leaves a live session untouched (a deleted user even looks signed out while main still accepts writes). → re-read status and role on each gated call, or drop the session after `users.*`/`roles.*` writes.
- [ ] R18. The owner can be locked out: `updateUser` can deactivate or demote the last active admin or yourself, `deleteUser` counts inactive admins, and `role_admin`'s permissions are editable. → always one ACTIVE admin, no self-demotion/deactivation, frozen system roles.
- [ ] R19. No PIN/password rules: any non-empty string is accepted, `updateUser({ pin: '' })` clears the PIN, setup doesn't validate shop name, username or PIN. → one validator (4–6 digit PIN, minimum password length) for setSecret, createUser, updateUser and completeSetup.
- [ ] R20. `cash.move` is the raw writer (`recordCashMovement`): any `shiftId` including a closed, Z-reported one, any `direction`, the sign dropped by `Math.abs`, no activity row. → resolve the open shift in the backend, accept only manual_in/manual_out with amount > 0 and a note, log it.
- [ ] R21. Electron hardening left over from F4: no CSP, `sandbox: false` (the preload only needs `electron`), no `senderFrame` check on `api:invoke`, no permission-request handler. Matters more because Electron 22 (pinned for Windows 7) gets no security fixes. → add all four.
- [ ] R22. With no preload bridge anyone is admin: `loginWithPin` / `loginWithPassword` / `unlockWithPin` succeed with `['*']` when `!hasBackend()` (stores/auth.ts). → gate on `browserPreview()` (DEV only), fail otherwise.
- [ ] R23. Seeds: `POS_SEED` is honoured in a packaged build (electron/db.ts) and can run `simulate()` over an existing file with empty business info; the clean seed creates `u_admin` with PIN 1234 until the wizard replaces it (seed/master.ts), so an early backup carries that hash. → ignore POS_SEED when packaged; seed the owner with no secret.

### P1 — money, stock and the audit trail (backend)

- [x] R24. `updateSale` rewrites payment history: every `sale_payments` row is deleted and rebuilt from the input, so an omitted list deletes bKash/card payments and rebuilt rows lose `paid_at` and `by_user`. It can also finalise a draft/quotation in place, keeping its DRF-/QTN- number (only final → non-final is refused). → keep payment rows unless explicitly edited; refuse non-final → final and point to `sales.convert`. **Done (Sep 2026):** An edit with no payment list keeps the rows (date and who took them); a sent list keeps `by_user` for unchanged rows; non-final → final is refused unless it comes from `sales.convert`.
- [x] R25. `products.update` writes `cost` directly (`updateProduct` colMap in catalog.ts), bypassing `setProductCost` (rule 12), so the history and `avg_cost` drift. → drop `cost` from the patch; route it through `setProductCost`. **Done (Sep 2026):** `updateProduct` no longer writes `cost`; a changed cost goes through `setProductCost` (source manual, the editor recorded). costing `costing-product-edit-records-history`.
- [ ] R26. A customer or supplier with a balance can be deleted (`deleteCustomer`/`deleteSupplier` check documents only): an opening balance or store credit disappears, unlogged. → refuse when the derived due ≠ 0 or store credit > 0; log deletes.
- [ ] R27. Closing a shift records nobody: `CloseShiftInput` has no user, `cash.closeShift` isn't in `ACTOR_FIELDS`, `cash_shifts` has no `closed_by`, so an over-limit close approved by the owner or a manager has no approver on record. `toShift` shows the opener as the closer and invents `salesCount: 0` and `byMethod`; counted denominations are not stored. → `closed_by` (v11), stamp it, '—' for figures the backend lacks, optionally persist denominations. **Partly done (Sep 2026):** `cash_shifts.closed_by` (v11), stamped from the session, logged; the Z-report shows the closer. Still open: `toShift` invents `salesCount`/`byMethod`; denominations are not stored.
- [ ] R28. Credit notes can land on the wrong customer: a return may name a different customer from its sale, and `updateSale` can change the customer of a sale with credited returns. → force the sale's customer; refuse a customer change after a return.
- [ ] R29. The credit limit is only a UI warning; `createSale`/`updateSale` never read `credit_limit`. → refuse (or require an owner/manager override) when the due would pass it.
- [x] R30. No backend customer-payment allocation: ReceivePaymentModal loops un-awaited `sales.addPayment` calls (not atomic; an opening balance can't be collected); `paySupplier` ignores the supplier's opening balance and drops the remainder. → `customers.pay` (opening balance first, then oldest final invoice, one transaction); fix `paySupplier` the same way. **Done (Sep 2026):** backend/services/accounts.ts: `customers.pay` / `suppliers.pay` in one transaction — opening balance, then oldest documents (or the picked ones), the rest kept as an advance in `account_payments` (v11). Balances, both khatas (new `supplierLedger`), the customer-group and payment reports include it. Receive Payment / Pay Bill / Pay Supplier make one call. chain `chain-account-payments`.
- [ ] R31. Audit gaps: no activity row for purchase payments, shift open/close, `cash.move`, transfer receive, contact deletes, catalog/tax/agent/role/branch CRUD, user delete, PIN changes or settings writes; `deleteSale` logs `by: 'system'`; expense edits/deletes are credited to the creator (`expenses.update/delete` not in ACTOR_FIELDS). → pass the actor to every write and log it.
- [ ] R32. Opening balances can be edited in place with only "Updated customer" logged. → record before/after with a required reason, or make it an adjustment entry.

### P1 — database and migrations

- [x] R33. Migrations are not transactional and hide failures: each step runs outside a transaction, and `backfillSaleCredited` / `backfillPurchaseCredited` swallow every error while the version is still recorded (connection.ts). → one transaction per step including its `schema_migrations` row; let real errors throw; `VACUUM INTO` a pre-migration copy first. **Done (Sep 2026):** Each step and its version row run in one transaction; backfills throw; a `VACUUM INTO` copy is taken beside the file before an upgrade. chain `chain-migrations`.
- [x] R34. The v10 block runs on `applied < CURRENT_VERSION`; bumping the constant to 11 re-runs it on every v10 database. → `applied < 10`. **Done (Sep 2026):** Steps run by what is MISSING from `schema_migrations`, so v10 never re-runs.
- [x] R35. No downgrade guard: an older build opens a newer database (and would write `due` ignoring `credited`); restore checks integrity and row counts but not the snapshot's schema version. → refuse `applied > CURRENT_VERSION` on open and on restore, with a clear message. **Done (Sep 2026):** `migrate` refuses a newer database before writing; `verifySnapshot` refuses a newer backup (`newerSchemaMessage`).

### P1 — reports that disagree

- [ ] R36. Dashboard vs P&L: the dashboard's net profit is gross − expenses while P&L adds shipping, other and stock adjustments; the profit delta compares the stored `sales.profit`, not the return-adjusted figure on screen; "returns today" counts returns on voided sales. → one shared helper; a run.ts check that the two nets agree.
- [ ] R37. The tax report never takes VAT back on sell or purchase returns (`taxReport`), so net VAT is overstated. → subtract the tax share of returns, by rate.
- [ ] R38. P&L stock: opening stock shows '—' and "closing stock" is TODAY's stock for any range (ProfitDetail uses `stockValueAtCost`); `stock_valuation_snapshots` is never written. → stock-at-date from movements (`SUM(qty × unit_cost) WHERE at <= bound`) returned by `profitLoss`.
- [ ] R39. Three cost bases for stock: valuation, the stock report and the stock CSV use `products.cost` (latest price), COGS uses the lifetime weighted average, `avg_cost` is a plain mean; negative stock subtracts from the total. → one method (weighted average from movements) everywhere; report negative stock separately.
- [ ] R40. Line tax is half built: purchase line tax goes into `line_total` but not into the bill's `tax`/`total` (`computePurchaseTotals`); sale line `tax_pct` is stored but never charged. The screens send 0 today; an import or API caller would not. → apply it in the core, or refuse non-zero line tax.

### P2 — backend edge cases

- [ ] R41. Cancelling a purchase keeps the new SELL price it set (raw `UPDATE products SET price`, no history, never reverted). → record the old price and restore it on cancel.
- [ ] R42. Returns come back at the wrong cost: sell returns restock at today's weighted average, not the line's `unit_cost_at_sale`; purchase returns take the caller's `unitCost`. → use the source line's stored cost.
- [ ] R43. A short-received transfer loses the difference: `receiveTransfer` records `received_qty` but no movement for sent − received. → a `transfer_loss` (or back-to-source) movement with a reason.
- [ ] R44. Stock adjustments need no reason and accept qty 0/NaN, no lines, and unknown types. → validate; require a reason.
- [ ] R45. `manage_stock = 0` and `allow_negative_sale = 1` are stored but ignored by `recordMovement`, so service or labour items can't be sold at zero stock. → honour both.
- [ ] R46. `weightedAvgCost` rounds to 2 dp, bringing back the paisa drift rule 28 forbids. → return it unrounded; round totals only.
- [ ] R47. Shifts: `openShift` isn't a transaction, `shift_no = MAX + 1` can race, amounts aren't validated, and a shift can stay open for days taking posts. → transaction, validation, a warning on a shift older than N hours.
- [ ] R48. Expenses: a voided expense can be edited, a negative amount becomes cash-out through `Math.abs`, reversals use reason `refund` (inflating refund totals), and hard delete works on expenses from closed shifts. → validate, an `expense_reversal` reason, void instead of delete.
- [ ] R49. Shipments: free-text status with no transitions (delivered → pending keeps `delivered_at`), allowed on draft/void/unknown sales, left live when the sale is voided, actor wrong on update/delete. → an enum with transitions, final sales only, cancel on void.
- [ ] R50. Price groups: default discount, tax-exempt and default credit limit are stored but never applied; customers link to a group by NAME, so a rename orphans them and defeats the delete guard. → link by id; apply in `computeSaleBody`.
- [ ] R51. An ordered or in-transit purchase can never be received (no `purchases.receive`), yet `supplierDue` counts it as payable and `paySupplier` allocates to it. → `receivePurchase` (stock in + `setProductCost`, one transaction); leave non-received bills out of payables until then. **Partly done (Sep 2026):** `purchases.receive` + `purchases.update` done, with a "Mark received" button. Still open: non-received bills still count as payable.
- [ ] R52. Catalog and settings deletes: category/brand deletes run outside a transaction and set products to NULL instead of `cat_none`/`b_none`; renaming a unit's short code orphans products; the default tax rate can be deleted; deleting an expense category wipes its history; `deleteBranch` misses expenses, transfers, returns, user assignments and the default branch; `unarchiveProduct` forces `show_in_pos = 1`. → guard, reassign, transaction.
- [ ] R53. Opening stock exists only on product create and is dropped silently when there is no branch; nothing sets opening stock for an existing product. → require a branch; add an `opening_stock` adjustment type (feeds R2). **Partly done (Sep 2026):** Opening stock with no branch now goes to the default branch instead of being dropped. Still open: opening stock for an existing product.
- [ ] R54. Unvalidated enums and dates: payment/refund methods are case-sensitive strings (`'cash'` skips the drawer), and dates accept any string, including the future. → enums and date bounds. **Partly done (Sep 2026):** Payment methods are canonicalised (`canonicalMethod`: `cash` posts to the drawer). Still open: date validation.
- [ ] R55. No UNIQUE index on `invoice_no` / `ref_no` as a backstop. → add in v11 after checking for duplicates.

### P2 — reports and dashboard

- [ ] R56. Sales-rep report: the returns query ignores the branch and the sale's status; there is no commission-paid record; and no screen sets `agent_id`, so the report is always empty. → scope the query, add an agent picker to AddSale/POS, record payouts before showing "paid".
- [ ] R57. Trending still invents "100%" and "0%" when there is no previous figure (rule 36). → use `deltaPct()`.
- [ ] R58. Archived products count in the stock report, the low/out-of-stock KPIs and the low-stock list. → `archived_at IS NULL`.
- [ ] R59. Product Sell revenue is before order discount and returns, so it never matches P&L. → allocate the order discount pro rata and net out returns, or label it "gross line value".
- [ ] R60. P&L: the sales discount is queried and then dropped (the screen shows '—'); the purchase-returns figure includes returns on cancelled bills. → return `salesDiscount`; scope the query.
- [ ] R61. Dashboard details: `newCustomers` ignores the branch filter; birthdays just after New Year are missed (backend) or shown as "Today" (dashboardAdapter parses bare dates). → label it all-branch; roll into next year; parse Y-M-D parts.
- [ ] R62. CSV export: Due = total − paid (ignores `credited`); voided/cancelled/draft rows export with totals; archived products are unflagged; only 6 kinds (no lines, payments, returns, expenses, movements, shifts, cost history). → export stored `due`/`credited` and status; add the missing kinds. **Partly done (Sep 2026):** an `expenses` export kind was added, and Customers / Suppliers / Expenses got a working "Export all".
- [ ] R63. Search: `fts_invoices.customer_name` goes stale when a customer is renamed; void/draft/quotation invoices come back with no status; no rebuild path; purchases, returns and expenses aren't searchable. → resync on rename, carry status, a `rebuildFts()` maintenance action.
- [ ] R64. Day bounds follow the OS clock, not `business_info.timezone`, so a PC with the wrong timezone shifts every report. → warn in Settings when they differ.

### P2 — performance (low-end PC, growing database)

- [x] R65. Missing indexes (v11): `purchase_payments(purchase_id)`, `sale_payments(paid_at)`, `purchase_payments(paid_at)`, `sale_audit(sale_id)`, `purchase_audit(purchase_id)`, `sell_returns(customer_id)`, `sell_return_lines(return_id)`, `purchase_returns(purchase_id)`, `(supplier_id)`, `(date)`, `purchase_return_lines(return_id)`, `stock_movements(ref_no)`, `(ref_id)`, `(branch_id, product_id)`, `stock_transfer_lines(transfer_id)`, `stock_adjustment_lines(adjustment_id)`, `stock_adjustments(date)`, `customers(created_at)`, `sales(agent_id)`, `expenses(branch_id)`, `activity_log(branch_id, at)`, plus `sales(status, date)` and `sales(branch_id, date)`. → then EXPLAIN QUERY PLAN the hot queries. **Done (Sep 2026):** v11 adds the listed indexes (EXPLAIN QUERY PLAN pass still to do).
- [ ] R66. Dashboard N+1: `getStats` calls `customerDue`/`supplierDue` for every contact (4 queries each), and the dashboard also loads the unpaged `customers.list`/`suppliers.list` every 30 s. → one SQL aggregate, and a `dashboard.dues` channel with a LIMIT.
- [ ] R67. Unbounded lists: `sales.list` called with `{}` (ReceivePaymentModal); customers/suppliers lists with per-row totals; returns, expenses, shifts, shipments and products lists; transfers/adjustments with one lines query per row; the cash register's hydrate makes up to 33 IPC calls. → paged or batched queries, a `shifts.listWithTotals`.
- [ ] R68. The products page aggregates the whole movement table on every page; `stockValuation` runs one price query per product; `getStats` scans movements three times. → levels for the page's ids only; one JOIN.
- [ ] R69. Backups freeze the app: `VACUUM INTO` + `integrity_check` run on the main thread, and the shift-close snapshot runs before `cash.closeShift` replies. → reply first; snapshot in a worker with its own connection, or `db.backup()`.
- [ ] R70. No database upkeep: no `wal_checkpoint`, `journal_size_limit`, `PRAGMA optimize` or `ANALYZE`. → on close and daily.
- [ ] R71. The Bangla MutationObserver walks every ancestor of every text node on each 50-row page swap and dashboard refresh. → prune skipped subtrees in the TreeWalker, cache the skip state, batch.

### P1/P2 — Electron, updates and shipping

- [ ] R72. No crash handling and no log file: no `uncaughtException` / `unhandledRejection` / `render-process-gone` / `child-process-gone` handlers, `whenReady().then` has no catch, and every diagnostic goes to `console`, which a packaged Windows build doesn't have. → rotating file log in `app.getPath('logs')`, process handlers, reload or a dialog on a renderer crash, "Open log folder" in Settings.
- [ ] R73. A downloaded update installs on ANY quit (`autoInstallOnAppQuit = true`), including a Windows shutdown at closing time or with a shift open. → turn it off; install only from the button; refuse (or confirm in-app) while a shift is open or carts are held.
- [ ] R74. Updater edges: the deferred `quitAndInstall` can throw outside its try; a silent launch check leaves the previous error in state; there is one check per launch only. → try/catch inside the deferred call, clear the error on a silent failure, re-check every ~6 h.
- [ ] R75. "Save as PDF" prints whatever the focused window shows (`printToPDF` on the current page), has no timeout, and overwrites files in place. → render from a hidden window loaded by sale id, add a timeout, write `.tmp` then rename.
- [ ] R76. Pendrive detection fails on a stock Windows 7 PC: `Get-CimInstance` / `ConvertTo-Json` need PowerShell 3.0 and Windows 7 SP1 ships 2.0; the message then blames group policy. → fall back to `Get-WmiObject Win32_LogicalDisk -Filter "DriveType=2"`.
- [ ] R77. Window state: saved bounds are checked against the primary monitor only; the 1440×920 default isn't clamped to a 1366×768 screen; when maximized the old bounds are re-saved; it saves only on close. → `getDisplayMatching`, clamp, `getNormalBounds()`, a debounced save.
- [ ] R78. CI runs only on a tag and only on Windows: nothing on push or PR, no Linux build, the Electron cache is restored after `npm ci` needs it, and a release goes live with no launch test. → a push/PR workflow (tsc ×2, verify, build, i18n) with an ubuntu job running `build:linux`; publish as a draft, smoke-launch the artifact, then promote.
- [ ] R79. Tests run on Node 22, the app on Electron 22's Node 16; `@types/node` is 25; nearly every dependency is a caret range; better-sqlite3 12 declares Node ≥ 20. → run the suites under `ELECTRON_RUN_AS_NODE`, pin `@types/node` to 16, pin electron / better-sqlite3 / electron-builder / vite-plugin-electron exactly.
- [ ] R80. Tooling: `tsc -b` emits a `vite.config.js` that shadows the `.ts` in dev; `npm run lint` calls an eslint that isn't installed, so rule 24 (hooks before early returns) has no automated check. → `noEmit` for tsconfig.node; eslint + react-hooks, pinned, with a CI step.

### P1/P2 — screens and stores

- [ ] R81. Settings that do nothing (rule 16 — wire each one or remove it):
  - POS Preferences: default payment method (F8 always opens Cash), visible methods, auto-print on save, big-button mode, negative-stock default, reset customer per cart.
  - Keyboard Shortcuts: saved, but POS hard-codes its keys; F4 is listed.
  - Barcode Settings: BarcodePrint keeps its own defaults; brand, MRP, code type and default copies are unused.
  - Printers: "Test print" is only a toast; connection, IP/COM and encoding are unused; Receipt Template `paperSize` duplicates the printer's `paperWidth`.
  - Business Info: currency position, decimals, separator, date format, fiscal-year start and default language are never applied (`formatBDT` hard-codes ৳, 2 dp, en-IN).
  - Cash Register: default carried float.
  - Five "Saved" buttons that only toast (POS Preferences, Cash Register, Barcode, Shortcuts, Appearance).
- [ ] R82. Dead controls: the Shipments row's "Print delivery slip" and "View" buttons have no handler; `/products/variations` routes to a placeholder. → wire them (a delivery-slip template) or remove them.
- [x] R83. Store writes that pretend: `openShift` swallows every error and returns `sh_pending`; `addExpense` returns `e_pending` on refusal; `useSuppliers.add` returns `'sp_' + Date.now()`, which NewSupplierModal passes into `purchases.create`; `voidSale`, `deleteSale`, `addPayment`, `addShipment`, `updateShipment` are fire-and-forget; lock/logout IPC failures are ignored. → every write resolves success (or the real id) and the screen acts on it. **Done (Sep 2026):** Every store write listed resolves the backend's answer (sales, purchases, expenses, contacts with the real id, stock); lock/logout retry once and then warn.
- [ ] R84. Screens go stale after writes: zustand writes never invalidate TanStack `['products']` / `['customers']` (stock in the pickers, the customer's due in POS); sale, refund and supplier-payment writes don't refresh the cash drawer; sales writes don't refresh customer dues; contact `options` aren't reloaded after an add. → a shared QueryClient and an `afterWrite(kind)` helper.
- [ ] R85. Invented document numbers on screen: `nextInvoiceNo`, `nextReturnNo`, `nextShipmentNo`, `nextTransferRef`, `nextAdjustmentRef`, `nextExpenseRef` and `nextPurchaseRef` (restarts at 42) show numbers the backend never issues; a typed purchase reference / supplier bill number is thrown away. → show '—' until saved; store the supplier's bill number in its own column.
- [ ] R86. Adapters: `unit_factor`, `unit_cost_at_sale` and `line_subtotal` are dropped (a "5 dozen" purchase reads back as 5 pieces); cash movement types are mislabelled (a due collection shows as "Cash sale", sale edits and supplier refunds as "Manual"); raw ids are shown for cashier, user and reference; the users adapter invents `passwordSet` and `createdAt`. → map the fields; join names in SQL.
- [ ] R87. Branch defaults: AddStockTransfer and AddStockAdjustment start on "Mirpur Branch" if branches haven't loaded, the import pages hard-code it, and `branchIdOf` accepts any unknown `br_` id and falls back to the default. → start empty and require a pick; resolve only known ids and names.
- [ ] R88. Money outside lib/money.ts (rule 20): AddSale paid/overpaid, CashRegister totals, `denominationsTotal`, ProductForm profit, footers on Sales, CustomerDues, ExpenseCategories, BulkPriceUpdate, StockAdjustments, Sell/Purchase Payment, SalesRep, ContactsReport, ProductSell, ProductPurchase, StockReport, CustomerGroup, StockAlertReport; `toFixed` on Receipt lines, PurchasePrintModal and CartLineRow. → `sum2` / `computeDue` / `formatBDT`, or totals from the backend.
- [ ] R89. Logout leaves the last user's data in memory, and persisted stores have no `partialize` (users, cash register, branches, settings — including the logo data URL in localStorage). → reset data stores on logout; persist UI preferences only.
- [ ] R90. Settings writes don't roll back when refused (`writePref`), and `setBusiness` can send `defaultBranchId: null`. → restore the previous value on error; leave out fields that can't be resolved.
- [ ] R91. Auto-lock: the minutes live per machine and can be set to "never" with no permission; the main session has no idle expiry; the idle lock stores the lock time as the last activity. → keep it in settings_kv (gated) and enforce an idle timeout in main.
- [ ] R92. Role-aware everyday screens (older Task 2/3 items): void from the POS, a cashier dashboard without profit, configurable quick actions.

### P2/P3 — Bangla and accessibility

- [ ] R93. The Bangla layer rewrites shop data: any text node without `data-no-i18n` that equals a phrase is translated (a product or customer called "Cash", "Other" or "Paid"), and switching back to English runs a `REVERSE` fallback that turns Bangla names and notes into English. → `data-no-i18n` on data cells, names and the receipt; restrict REVERSE to DEV.
- [ ] R94. Copy Bangla can't translate: interpolated confirm titles and plurals (Categories, ExpenseCategories, Products, ProductEdit, BulkPriceUpdate, Expenses, Customers, ~20 `Delete "${name}"?` titles), the POS total-mismatch warning, the variance threshold preview, dashboard "3d ago" / "in N days" / activity sentences, interpolated toasts and raw backend errors; `alt`, `value` and `document.title` aren't covered; digits are always Latin. → static phrases with values in their own nodes; map backend errors to phrases.
- [ ] R95. Accessibility: settings labels not tied to their inputs (POS Preferences, Cash Register), no `prefers-reduced-motion`, EmptyState/Skeleton on only 13 of 48 pages. → htmlFor/aria-label, a reduced-motion rule, empty and loading states.

### P3 — tech debt

- [ ] R96. Remove dead code: `usePurchases.updatePurchase` (local-only, invents an audit entry), `useStock.movements`, the duplicate variance thresholds in the cash store, the Appearance preview's made-up prices, the drifted `backend/db/schema.sql`, `sync_outbox` and `stock_valuation_snapshots` (unless R38 uses one), the SMS store's fake delivery and gateway-test results, the POS key handler's disabled dependency list.
- [ ] R97. `browserMock` carries money and stock fields and a `cu_walkin` id, beyond the catalogue-only exception in rule 5. → zero them; use `cu1`.
- [ ] R98. Pagination isn't clamped after deleting the last row on a page; the theme `matchMedia` listener is added on every `init`. → reload the last page; init once.
- [ ] R99. Split the largest components before changing them further: Products (1,201 lines), AddSale (1,127), AddPurchase (979), ProductForm (822), POS (753), Customers (709), CustomerDetail (703).

### Tests and docs

- [ ] R100. Every P0/P1 fix above gets a check (chain.ts, security.ts or run.ts), per rule 6.
- [ ] R101. Channels no suite touches: `dashboard.recentSales`, `lowStock`, `expenseBreakdown`, `activityFeed`, `birthdays`; `reports.stock`; `transfers.list`, `adjustments.list`, `shifts.list`, `shifts.movements`; `sellReturns.list`, `purchaseReturns.list`, `purchaseReturns.getReturnedQty`; `backup.verify`; `categories.update/delete`, `brands.update/delete`. Wired but never called through the API: `sales.convert`, `transfers.cancel`, `purchases.addPayment`, `purchaseReturns.create`, `expenses.delete`, and the users/roles/branches/taxRates/agents update and delete channels.
- [ ] R102. Untested layers: ipc.ts wiring (stampActor, the variance gate, Electron-only channels), updater, invoicePdf, restore; every renderer store and adapter; `lib/datetime`, `lib/search`, `lib/branch`; `translatePhrase` / `startBanglaUI` / `stopBanglaUI` (check-bn.mts only loads the dictionary); `saleLineGross` in the mirror. → Vitest for the renderer's pure code, and an Electron smoke test (launch, wizard, one sale, one return, close shift).
- [ ] R103. Stale docs:
  - RELEASE.md: 1,078 checks / 7 suites, schema v9, a 0.7.1 example below the current 0.8.0, a PowerShell-only recipe, "updates itself" on Linux.
  - docs/00: 1,161 / 8, `%APPDATA%` only, "no fallback data".
  - docs/01: CommandPalette, SMS "complete", mock fallback.
  - docs/02: 152 channels, v9, 446 checks, "~30 tables" (there are 45).
  - docs/04: 1,161 / 8 / 152.
  - docs/05: "you are here" at 860 checks.
  - docs/06: 68 checks, what verify:all runs.
  - BACKEND_NOTES: 63 channels, Mirpur Branch, alert-based exports, SMS routes.
  - backend/README: "IPC is the next phase", v1, 12 services, 56 checks.
  - docs/07 §1: "Version is now 0.2.0".
  → Update all of them, and add a Linux release section.

### Features still to build (older open items, re-checked)

- [ ] R104. Per-product stock movement history (needs a `stock.movements` channel) and a per-branch stock view.
- [ ] R105. Printed documents: customer/supplier statement (PDF), delivery slip (R82), transfer slip, adjustment voucher; Excel/PDF export on reports (the toolbar hides those buttons today); drill-down from report rows.
- [ ] R106. POS: line notes, invoice notes, tax-inclusive pricing, a recently-scanned strip, price tooltips in the picker.
- [ ] R107. Sales: a `/sales/:id` full page; a commission agent on a sale (R56).
- [ ] R108. Expenses: the recurring-expense job; over-budget alerts.
- [ ] R109. People: self-service PIN change, an offline owner PIN-reset code, per-user preferences.
- [ ] R110. Cash: bank deposit tracking; stored denominations (R27).
- [ ] R111. Products: warranty picker on the product form; multiple images.
- [ ] R112. Later: saved and scheduled reports, discount rules, email/SMS receipts, card terminal, receipt OCR.

### Owner decisions (September 2026)

- **No "Open Shift" step.** *(Done.)* An elderly owner will forget it, and no money may go unrecorded. The drawer opens itself on the first cash event, carrying forward the last counted or expected cash; closing and counting stays available and optional (R6).
- **Stay on Windows 7**, so Electron 22 stays. The R21 hardening (CSP, sandbox, sender checks) and the Windows 7 PowerShell 2.0 fallback (R76) matter more because of it.
- **One branch for now.** *(Done: `backend/services/branch.ts` `shopBranchId` resolves a missing branch to the default; returns and shipments follow their document's branch; `markDefaultBranch` keeps `branches.is_default` and `business_info.default_branch_id` in step.)* Every write uses the shop's default branch (no `'br_mp'` literal); branches can still be added in Settings, and the multi-branch setup (branch switcher, per-branch POS/stock) is done when branching is switched on.
- **The admin can edit purchases** *(Done.)* and the other documents that may need correcting: `purchases.update` (gated by `purchases.edit`), including receiving an ordered purchase (R51).

### Still needs an owner decision

- Non-cash refunds (Bank/bKash/Nagad/Card) are recorded nowhere; store credit is never spent or shown (R7 stops it growing by accident).
- Linux updates: publish Linux artifacts with each release, or turn update checks off on Linux.
- Pack units at the POS (R10): sell by the dozen/box, or hide the picker.
- SMS gateway, thermal/ESC-POS printing, code signing.
- A 32-bit (ia32) Windows installer, if a shop PC needs one.
