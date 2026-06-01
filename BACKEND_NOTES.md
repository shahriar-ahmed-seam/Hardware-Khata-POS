# Backend Notes — things to remember when we build the backend

This file collects everything that came up during frontend design but must be handled
properly on the backend / Electron-main side later.

## Identity / Branding
- Shop name, tagline, logo are placeholders in the UI. Backend must provide:
  - `business.name`, `business.tagline`, `business.logoUrl` (uploaded from Settings → Business Info).
  - Logo upload should accept PNG/SVG up to ~1MB, store under `userData/uploads/`.
- App icon ships with installer; in-app branding is dynamic (driven by business profile).

## Branches
- Multi-branch supported. User adds branches in Settings → Branches.
- Branch switcher in titlebar must be branch-aware (filters all queries by selected branch).
- Last selected branch persisted per user.

## Internationalization (i18n)
- Two languages: **English (en)** and **Bangla (bn)**.
- Frontend has an i18n stub at `src/lib/i18n.ts` with `t(key)` and a Zustand language store.
- Backend must:
  - Persist user language preference to local DB (per user).
  - Receipt/invoice template renderer must support both languages (font: Bangla needs
    a Unicode-safe Bangla font like Kalpurush or SolaimanLipi for thermal printers).
  - SMS templates must support Bangla (Unicode SMS).
  - Number formatting: keep Western digits; date formats may follow language.
  - Currency symbol stays "৳" (BDT) regardless of language.

## Single Instance Lock
- Implemented in `electron/main.ts` via `app.requestSingleInstanceLock()`.
- Backend implication: if a second instance is launched, focus the existing window
  (already wired). Useful when user double-clicks the icon.

## Window State Persistence
- Implemented: window position, size, maximized state are saved to
  `userData/window-state.json` and restored on launch.

## Splash Screen
- Implemented: loads first, hides when main window finishes loading.
- Backend implication: splash should also wait for "DB ready" event once SQLite is wired.
  Currently shows for fixed minimum duration. Replace with: `splash.close()` after both
  (a) main window `did-finish-load` and (b) DB migrations complete.

## Global Search
- Frontend supports tag-prefix queries:
  - `#invoice:INV-2026-0451`
  - `#product:cement` or `#sku:BM-CMNT-OPC`
  - `#customer:rahim`
  - `#supplier:bsrm`
  - `#barcode:8801001000017`
- Plain text falls back to multi-entity search.
- Backend must implement a `globalSearch(query, scope?)` IPC that returns grouped results:
  `{ products: [], invoices: [], customers: [], suppliers: [] }`.
- Use SQLite FTS5 for fast indexed search on product name/SKU/barcode and customer/supplier name/phone.

## Theme
- Three modes: light, dark, system. Frontend persists in `localStorage`.
- Backend already syncs OS theme via `nativeTheme.themeSource`.
- No additional backend work.

## Auth (future)
- PIN-based login for cashiers, full password for admins.
- Lock screen kicks in after N minutes idle (configurable in Settings).
- Backend stores hashed PIN/password in local DB; cloud sync uses separate API token.

## Sync (future)
- Outbox table per write operation (sale, purchase, payment, stock adjust).
- Online detector pings cloud endpoint every 30s.
- Conflict resolution: last-write-wins per row with version column.
- Sync status pill in titlebar reads from a Zustand store fed by sync worker.

## Hardware (future)
- Thermal printer (ESC/POS) via `electron-pos-printer` or `node-thermal-printer`.
- Barcode scanner: HID keyboard mode, no driver. Frontend just listens for fast keystrokes
  ending in Enter. Already designed into POS search input.
- Cash drawer: kicked via printer's `0x1B 0x70` open-drawer command.

## SMS (future)
- BD providers: SSL Wireless, BulkSMSBD, Zaman IT, etc.
- Adapter pattern: configurable provider in Settings → SMS Settings.
- Credit balance synced periodically.

## Backups
- Local backup: zip SQLite DB + `uploads/` to `userData/backups/` daily at shop close.
- Cloud backup: same zip uploaded to user's chosen target (Supabase Storage / S3 / Google Drive).
- Restore wizard from Settings → Backup & Sync.

---

When backend phase starts, this file is the master checklist.


---

# Task 2 — Dashboard

## Persistence
- Dashboard layout (which KPIs/widgets are visible and their order) is persisted in
  `localStorage` via Zustand (`pos-dashboard`). Backend should:
  - Move this to local SQLite (`user_dashboard_layout` table) so it survives reinstalls.
  - Sync per-user, per-branch (a manager can have a different layout from a cashier).

## Data sources for KPIs
All KPIs are currently mock. Backend must expose a single IPC `dashboard.getStats(range, branchId)`
that returns:
```ts
{
  range: { from: ISO, to: ISO },
  sales: { total, deltaPct },
  profit: { revenue, cogs, grossProfit, marginPct, expenses, netProfit, deltaPct },
  transactions: { count, deltaPct },
  itemsSold: { count, deltaPct },
  newCustomers: { count, deltaPct },
  cashInDrawer: number,         // computed from open shift
  customerDuesTotal: number,
  supplierDuesTotal: number,
  lowStockCount: number,
  outOfStockCount: number,
  todayExpenses: number,
  todayPurchases: number,
  returnsToday: number,
}
```

## Data sources for widgets
Each widget reads from a small dedicated query so we can refresh independently:
- `dashboard.hourlySales(range, branchId)`
- `dashboard.salesTrend(days, branchId)`
- `dashboard.monthlyCompare(months, branchId)`
- `dashboard.topProducts(range, branchId, limit)`
- `dashboard.topCustomers(range, branchId, limit)`
- `dashboard.recentSales(branchId, limit)`
- `dashboard.recentPurchases(branchId, limit)`
- `dashboard.lowStock(branchId)`
- `dashboard.customerDues(branchId, limit)`
- `dashboard.supplierDues(branchId, limit)`
- `dashboard.expenseBreakdown(range, branchId)`
- `dashboard.paymentMethodBreakdown(range, branchId)`
- `dashboard.activityFeed(branchId, limit)`
- `dashboard.birthdays(daysAhead)`

## Time range handling
- Frontend stores `range: 'today'|'yesterday'|'week'|'month'|'lastMonth'|'custom'` plus
  optional `customRange { from, to }`. Backend must resolve these to ISO date ranges using
  business timezone (set in Settings → Business Info).
- Branch-aware: if no branch is selected globally (multi-branch), pass `branchId: 'all'`.

## Auto-refresh
- Frontend polls every 30s (currently a counter tick — when wired, swap to `useQuery` with
  `refetchInterval: 30000`).
- Backend should support cheap incremental queries (don't re-aggregate full month every 30s).
  Cache hourly aggregates in a `daily_stats` table updated on sale write.

## Profit / Loss popover
- Needs accurate **COGS** per sale (cost at time of sale, not current cost). Sale line items
  must store `unit_cost_at_sale`. This is a critical schema decision.

## Activity feed
- Pulls from a single `activity_log` table written by triggers/handlers on each event:
  sale, purchase, payment, expense, stock-adjust, shift open/close, low-stock-detected.
- Schema: `id, branch_id, user_id, type, ref_id, ref_no, amount, message, created_at`.

## Birthday list
- Customer table needs `dob` (DATE NULLABLE).
- Query: customers whose `(month, day)` falls in the next N days (default 7).

## Dashboard customization
- "Edit Layout" mode is purely UI — moves are persisted client-side only.
- Owner-level "manage default layouts" (in Settings → Dashboard) is for setting org-wide
  defaults that new users start with. Backend table: `dashboard_default_layouts`.

## Permissions
- Some KPIs/widgets show sensitive data (profit, dues totals).
- Backend must enforce role-based filtering: a cashier role gets `null` for `profit`,
  `customerDuesTotal`, etc., and the frontend simply hides those KPIs if the value is `null`.


## Task 2 — Profit modal additional fields

The Profit detail modal (clicked from Profit KPI or Shortcuts) needs the full UltimatePOS-style breakdown:

```ts
todayProfitDetail: {
  // Stock snapshots (computed)
  openingStockByPurchase: number;
  openingStockBySale: number;
  closingStockByPurchase: number;
  closingStockBySale: number;

  // Money in
  totalSalesExclTaxDisc: number;
  totalSellShipping: number;
  totalStockRecovered: number;
  totalPurchaseReturn: number;
  totalPurchaseDiscount: number;
  totalSellRoundOff: number;

  // Money out
  totalPurchaseExclTaxDisc: number;
  totalStockAdjustment: number;
  totalExpense: number;
  totalPurchaseShipping: number;
  totalTransferShipping: number;
  totalSellDiscount: number;
  totalCustomerReward: number;
  totalSellReturn: number;
}
```

These come from aggregates over the chosen `range`. Stock snapshots are expensive — store
nightly stock-value snapshots in `stock_valuation_snapshots(date, branch_id, by_purchase, by_sale)`
and compute "opening" / "closing" by reading the bracket dates.

Net profit formula (UltimatePOS):
`net_profit = (closing_stock_by_sale + total_sales_excl_tax_disc + total_sell_shipping + total_stock_recovered + total_purchase_return + total_purchase_discount + total_sell_round_off)
            − (opening_stock_by_purchase + total_purchase_excl_tax_disc + total_stock_adjustment + total_expense + total_purchase_shipping + total_transfer_shipping + total_sell_discount + total_customer_reward + total_sell_return)`


---

# Task 3 — POS / Checkout (in progress)

## Layout & UX preferences (persist per user in DB)
Currently in `localStorage` via Zustand `pos-layout`. Move to user table:
- `orientation: 'cart-left' | 'cart-right'` (default cart-left)
- `cart_ratio: number 0..1` (default 0.65)
- `product_view: 'grid' | 'list'` (default grid)
- `show_out_of_stock: boolean` (default true; greys out OOS products)
- `allow_negative_stock: boolean` (default false; needs role permission)
- `default_price_markup_pct: number` (default 0; sets line markupPct on add)
- `default_order_tax_pct: number` (default 15 for BD VAT)

## Product data needed for POS
Schema requirements that show up on the POS screen:
- `products.available_units: string[]` — alternate units selectable per cart line
  (e.g. ['pc','dz','hali','box']). Base unit is `products.unit`.
- `products.image_url` — currently a placeholder Tag icon; backend should serve from
  `userData/uploads/products/{id}.jpg`.
- `categories.emoji` (or icon) — for chips in POS.
- `products.tax_pct` — line tax (separate from order VAT).
- Variations are **separate SKUs** per product (e.g. PN-WHITE-1L, PN-WHITE-4L, PN-WHITE-20L)
  per the user's call. No variations table needed for POS.

## Pricing model (CRITICAL — read carefully)
Per cart line we store and display:
1. **SPR** (Selling Price Reference) — base price at the moment the line was added,
   chosen from `price`, `wholesale_price`, or `contractor_price` based on the cart's
   `price_group`. This is the immutable reference.
2. **markupPct** — optional positive percentage applied on top of SPR to get unit price.
   Cashier can adjust per line. Default markup comes from `default_price_markup_pct`.
3. **discountPct** — line discount %.
4. **discountFlat** — line discount in BDT.
5. **unit_price = SPR × (1 + markupPct/100)**
6. **line_subtotal = max(0, (unit_price × qty) × (1 - discountPct/100) - discountFlat)**

Backend must persist on the sale record:
- `unit_cost_at_sale` (for COGS)
- `spr_at_sale`
- `markup_pct`
- `discount_pct`, `discount_flat`
- `final_unit_price`, `line_subtotal`
- `unit_used` (so receipt prints "5 hali" not "20 pc")

## Order-level charges & discounts
Per cart:
- `order_discount_pct` and `order_discount_flat` — applied AFTER line totals.
- `order_tax_pct` — VAT, default from settings (15% in BD).
- `shipping_charge` — flat amount.
- `other_charge` — flat amount (packaging, service, etc.).

Total formula:
```
afterLineDiscount = sum(line_subtotal)
orderDiscount = afterLineDiscount * orderDiscountPct/100 + orderDiscountFlat
taxableBase = max(0, afterLineDiscount - orderDiscount)
tax = taxableBase * orderTaxPct / 100
total = taxableBase + tax + shippingCharge + otherCharge
```
Backend must store all components separately so reports can recompute and audit.

## Search behavior (currently)
- Auto-focus on POS open.
- Global keystroke listener forwards printable chars to search input (barcode-scanner
  friendly — scanners type the barcode then press Enter).
- F2 always focuses search.
- Pressing Enter while search has text → adds best match to cart and clears search.
  Best match = exact barcode → exact SKU → first name/SKU contains.
- Backend `productSearch(query)` should return ranked results (FTS5 with weighted
  fields: barcode > sku > name).

## Out-of-stock & negative stock
- `show_out_of_stock = true` → OOS products appear greyed; can't be added unless
  `allow_negative_stock = true`.
- Negative stock requires owner permission. Frontend toggles this on user request,
  but on save the backend must check the permission and reject if user lacks it.
- All "negative stock" sales must write to `stock_movements` with `reason='negative_sale'`.

## Resizable splitter
- Pure UI; saves `cart_ratio` to user prefs.
- No backend implication beyond persistence.

## Multi-tab parked carts
- Currently in component state. Should be persisted to DB so:
  - Carts survive app crash / restart
  - A held cart is visible from the "Held Sales" list (Sales module)
  - Cashier can hand off a parked cart between shifts
- Schema: `parked_carts(id, branch_id, user_id, label, customer_id, price_group,
  order_discount_pct, order_discount_flat, order_tax_pct, shipping, other,
  created_at, updated_at)` + `parked_cart_lines(...)`.

## Pending (still to wire in Task 3)
- Add Customer inline modal
- Multi-pay modal with tendered + change calc
- Suspend / Credit Sale flows
- Save as Draft / Quotation from POS
- Recall held / drafts
- Receipt preview + print
- Big-button mode toggle
- F-key shortcuts (F3 customer, F4 discount, F5 held, F6 draft, F7 quotation, F8 pay, F9 hold, F10 new tab, Ctrl+P reprint, "?" overlay)
- POS settings panel (markup default, VAT default, allow negative, etc.)


## Task 3 — Final session additions (Q12–Q30)

### Customer picker
- Frontend: F3 opens modal, search by name/phone, "Add new" inline form (name, phone, group).
- Backend must:
  - Persist new customer immediately (offline-friendly via outbox).
  - Default group from settings (most BD shops default Retail).
  - Validate phone format (BD: starts with `01`, 11 digits) but don't block save — just warn.
  - When picking a customer, auto-switch the cart's `price_group` to the customer's
    default group (Retail/Wholesale/Contractor). Frontend does NOT do this yet.

### Credit limit
- New field on `customers`: `credit_limit DECIMAL(12,2) NULL` (NULL = no credit allowed).
- Frontend warns when `due >= credit_limit` (red badge, payment modal blocked).
- Backend must enforce on save: if any payment line uses `Credit` and resulting due > limit,
  reject unless user has `override_credit_limit` permission. Log the override.

### Payment modal
- Single mode: choose method tile, type tendered, optional reference.
- Split mode: multiple `payment_lines`, each with method/amount/reference.
- Quick tenders (100, 200, 500, 1000, 2000, Exact) — UI only.
- Backend `sales.create()` accepts an array of payment lines; Cash needs no reference,
  bKash/Nagad/Card/Bank need a non-empty reference (validate per method).
- For Card, future hardware integration: ACI/SSL gateway emits a TxID we set as reference.
- Tendered/change: store `tendered_cash` and `change_due` separately for cash-drawer
  reconciliation.

### Hold / Drafts / Quotations
- Currently the held list is in component state. Backend must split into three tables:
  - `parked_carts` — held carts (just suspended for later checkout)
  - `sale_drafts` — explicitly saved drafts (separate workflow)
  - `quotations` — saved quotations (can be converted to a sale; carries an expiry)
- Frontend currently labels them with `[Draft]` / `[Quote]` prefixes. We'll wire the
  proper sources when those screens are built (Task 4 — Sales).

### Receipt
- Format approved: header strip (date / POS), centered shop block (name, line2, mobiles),
  Invoice header strip with No / Date / Customer, items table (#, Product+SKU, Qty+unit,
  Unit Price, Subtotal), totals (subtotal, order disc, VAT, shipping, other, total payable
  with amount-in-words), payment summary, barcode of invoice no, footer.
- Frontend renders a print-friendly white receipt (820px) using browser `window.print()`.
- Backend should:
  - Provide ESC/POS thermal printer rendering (separate from preview HTML).
  - Provide "amount in words" service in EN/BN with proper BD numbering (lakh, crore).
    Frontend has a tiny inline helper for now — replace with backend formatter.
  - Generate Code128/QR barcodes server-side (deliver SVG to renderer).
  - Logo from business profile inserted into header.

### Shortcuts
- All F-keys handled inside POS scope only (`useEffect` in POS page).
- Keys: F2 search, F3 customer, F5 held, F6 draft, F7 quotation, F8 pay, F9 hold,
  F10 new tab, Ctrl+P reprint, ? help, Esc close.
- Backend not involved; `Settings → Keyboard Shortcuts` will let users remap (Task 14).

### POS preferences (defer to Settings → POS)
- Big-button mode (Q25)
- Default price markup % (currently 0)
- Default order VAT % (currently 15)
- Default payment method (currently Cash; could be "remember last used per cashier")
- Show/hide specific payment methods
- Auto-print on save (Q19) vs preview-then-print
- Receipt template selection (50mm, 80mm, A4)
- Email / SMS receipt option (Q19/20)


---

# Task 6 — Products Module (in progress)

## Schema additions on `products`
```ts
description: TEXT NULL
warranty_id: TEXT NULL              // FK → warranties
manage_stock: BOOLEAN DEFAULT TRUE
allow_negative_sale: BOOLEAN DEFAULT FALSE
allow_discount: BOOLEAN DEFAULT TRUE
show_in_pos: BOOLEAN DEFAULT TRUE
not_for_sale: BOOLEAN DEFAULT FALSE
created_at: TIMESTAMP
updated_at: TIMESTAMP
image_url: TEXT NULL                // path under userData/uploads/products/
```

## Unit conversions
- `products.unit` is the **base unit** short code (pc, kg, m, …).
- `product_units` join table:
  ```
  product_id, unit_short, factor
  ```
  factor is "1 unit = factor × base_unit". For pc as base: 1 dz = 12 pc → factor 12.
- Backend must accept the alternate units list and conversions on save and update.
- POS line stores `unit_used` and `unit_factor` so totals/cost are accurate even if
  conversions change later.

## Auto-generate
- SKU pattern recommended: `{CAT2}-{BRAND3}-{NN}` (e.g. `HT-STN-01`).
  - Backend should ensure uniqueness; if collision, append a suffix.
- Barcode: 13-digit pseudo-EAN starting `880` (Bangladesh GS1 prefix), simple checksum.
  Frontend currently generates one; backend should validate uniqueness, not enforce real EAN-13.

## Default tax = 0
- Per Q12, default product `tax` is 0.
- POS `default_order_tax_pct` also flipped to 0 (was 15). Users who need VAT can set it
  globally in Settings → Tax Rates.

## Image upload
- Frontend uses `URL.createObjectURL(file)` for preview only.
- Backend must:
  - Save the file to `userData/uploads/products/{id}.{ext}` (compress if > 500KB).
  - Set `products.image_url` to the relative path.
  - Sync to cloud storage as part of the outbox.

## Default image fallback
- When `image_url` is empty, frontend uses category-based emoji placeholder.
- No backend change needed — purely UI.

## Customizable columns
- Persisted in `localStorage` via Zustand (`pos-products-ui`). Backend should move this
  into the user prefs table later for cross-device persistence.
- Default visible columns: image, name, sku, category, brand, price, stock, status.
- All available columns: image, sku, barcode, name, category, brand, unit, cost, price,
  wholesalePrice, contractorPrice, stock, reorderLevel, tax, warranty, status, updatedAt.

## Filters
- Search: name OR sku OR barcode (FTS5).
- Category, brand, stock status (in/low/out), price range.
- Backend `productSearch({ q, categoryId, brandId, stockStatus, priceMin, priceMax,
  hasVariations, taxPct, dateFrom, dateTo, page, pageSize })`.

## Bulk actions (UI present)
- Bulk delete (with confirm)
- Bulk barcode print
- Bulk export
- Bulk price/cost update (drawer with %/flat ± and apply)
- Bulk category/brand change
Backend must support batch endpoints for each.

## CRUD wiring (front-end mock currently)
- Currently mutates the `seed` array in memory (won't survive reload of HMR).
- Backend will wrap with TanStack Query mutations (`useUpdateProduct`,
  `useCreateProduct`, `useDeleteProducts`) hitting Electron IPC.

## Quick-edit drawer vs full page
- Quick edit (right-side drawer) opens on row Edit click — same form, asDrawer mode.
- Full page editor lives at `/products/new` and `/products/:id`.
- Both share the same `ProductForm` component to avoid drift.


## Task 6 — Master data + bulk operations (final session)

### Categories with optional subcategories (Q14)
- Schema: `categories(id, name, emoji, parent_id NULLABLE)`.
- Single-level nesting only (parent_id ⇒ top-level category). No deep trees.
- Deleting a parent **detaches** children (sets their parent_id to NULL) instead of cascading delete.
- Frontend already handles this. Backend should mirror behaviour.
- When deleting, warn if `count(products WHERE category_id = X) > 0`.

### Brands (Q15)
- Schema: `brands(id, name)`. Just name for BD shops — no logo upload.
- Backend should still keep `logo_url TEXT NULL` column for future, but UI doesn't expose it.
- Same delete-warning: count products using it.

### Units (Q16)
- Schema: `units(id, name, short, type ENUM[count|weight|length|volume|pack], to_base_factor)`.
- `type` lets us validate compatible conversions later (don't convert kg → m).
- `to_base_factor`: factor against the BASE unit of that type. UI seeds:
  - count: pc=1, dz=12, hali=4
  - pack: box=1, bag=1
  - weight: kg=1
  - length: m=1, ft=0.3048
  - volume: L=1
- Per-product alternate units already covered earlier (`product_units` join).

### Variation templates (Q17)
- **Skipped** — user chose separate SKUs per Task 3 (Q6) and Task 6 (Q17).
- Route `/products/variations` shows a placeholder so the sidebar entry doesn't 404.
- We can drop the link from the sidebar later; leaving it there in case behaviour changes.

### Warranties (Q18)
- Schema: `warranties(id, name, duration_months, description)`.
- Linked from `products.warranty_id` (already noted earlier).

### Selling Price Groups (Q19)
- Schema: `price_groups(id, name, is_default, notes)`.
- Default groups seeded: Retail (default), Wholesale, Contractor.
- Cannot delete the default group; backend must enforce.
- Owners can add new groups freely (e.g. VIP, Member).
- Customer record stores `default_price_group_id` (already needed for Task 3 auto-switch).
- Product table has corresponding price columns. **Open question for backend**: when an
  owner adds a new group, do we add a column to products, or move pricing into
  `product_prices(product_id, price_group_id, price)`? The latter is cleaner. **Recommended:
  use `product_prices` table** even though current frontend uses fixed columns
  (price/wholesalePrice/contractorPrice). When migrating, frontend keeps reading flat fields
  for the 3 defaults but pulls from the table for custom groups.

### Bulk Price Update (Q20)
- Filter (search/category/brand) → select rows → choose:
  - field: price | cost | wholesalePrice | contractorPrice
  - mode: flat ± / percent ± / set =
  - direction: increase | decrease (for flat/percent)
  - rounding: none | nearest taka | up | down
- Live preview shows "After" column for each selected row.
- Apply → confirmation → updates all selected.
- Backend endpoint `productsBulkUpdatePrice({ ids, field, mode, amount, direction, round })`.
- Should write an audit log entry per product (old → new value) so we can roll back.

### Barcode Print (Q21)
- Pick products → set copies → choose label size (50×30mm single, A4 grid 3×10) →
  toggle: show name / SKU / price → print preview → `window.print()`.
- Schema: nothing — purely UI today. Backend should provide:
  - Real Code128/EAN-13 SVG renderer (current preview uses a placeholder striped pattern).
  - Logo / shop name option in label (from business profile).
  - Persistable label templates (Settings → Barcode Settings, Task 13).

### Import Products (Q22)
- CSV template provided via download. Columns:
  `name, sku, barcode, category, brand, unit, cost, price, wholesale_price,
   contractor_price, opening_stock, reorder_level, tax, description`.
- 3-stage flow: idle → review → done.
- Backend must:
  - Parse CSV (handle BOM, mixed line endings).
  - Validate row by row; report errors with row #.
  - Auto-create missing brands/categories (warn in preview).
  - Match unit by short code; reject unknown units.
  - Detect duplicate SKU/barcode and either skip or update (user choice — add toggle later).
  - Run inside a transaction; on user confirm, commit.

### Import Opening Stock (Q23)
- Separate flow with simpler CSV: `sku, branch, quantity, unit, unit_cost`.
- Backend must:
  - Match SKU and branch (by name) and create stock movements with reason `opening_stock`.
  - Reject if sku unknown or branch unknown.
  - Idempotency: if a sku already has opening_stock for that branch, ask to overwrite or skip.

### Quick row actions (Q24)
- Edit (drawer), Open full editor, Duplicate, Delete.
- Pending: Adjust stock (links to Stock module), View movements (links to stock history).
  Will wire when Task 7 (Stock) is built.

### Mock data note
- All master data lives in Zustand stores (`useBrands`, `useCategories`, `useUnits`,
  `useWarranties`, `usePriceGroups`). Mutations are in-memory only; backend will replace
  with TanStack Query against IPC.


---

# Task 4 — Sales Module

## Sale lifecycle (one record, status transitions)
- `final` — completed sale, recorded; reduces stock; updates customer due
- `draft` — saved but not finalized; no stock or due impact
- `quotation` — sent to customer with `valid_until`; no stock or due impact
- `void` — voided final sale; reverses stock + due; **kept** for audit

Status flow allowed:
- draft → final (or quotation → final via "Convert")
- final → void (irreversible)
- draft → delete (allowed)
- quotation → delete (allowed)
- final → delete is **forbidden** (must use Void)

## Schema (sales)
```ts
sales (
  id PK,
  invoice_no UNIQUE,
  status ENUM(final|draft|quotation|void) DEFAULT 'final',
  date TIMESTAMP,
  customer_id FK,
  branch_id FK,
  user_id FK,
  subtotal, total_line_discount, order_discount_pct, order_discount_flat,
  order_discount, tax_pct, tax, shipping, other, total,
  paid, due,
  valid_until DATE NULL,             -- for quotations
  source_quotation_id FK NULL,       -- when converted
  notes TEXT NULL,
  voided_at TIMESTAMP NULL,
  voided_by FK NULL,
  void_reason TEXT NULL,
  created_at, updated_at
)

sale_lines (
  id PK,
  sale_id FK,
  product_id FK,
  name_at_sale TEXT,
  sku_at_sale TEXT,
  qty, unit_used, unit_factor,        -- factor against base unit
  unit_price, spr_at_sale, markup_pct,
  unit_cost_at_sale,                  -- for COGS / profit
  discount_pct, discount_flat, tax_pct,
  line_subtotal
)

sale_payments (
  id PK, sale_id FK,
  method ENUM(Cash|bKash|Nagad|Card|Bank|Credit),
  amount,
  reference TEXT NULL,
  paid_at TIMESTAMP,
  by_user_id FK
)

sale_audit (
  id PK, sale_id FK,
  at TIMESTAMP, by_user_id FK,
  action ENUM(created|edited|voided|paid|returned|shipped),
  note TEXT NULL,
  changes JSON                        -- diff for "edited"
)
```

## Edit window (Q6)
- Allow full edit (lines, prices, customer, payment) within **N minutes** after creation.
- After window: edits require permission `sales.edit_after_window`.
- Each save writes a `sale_audit` row with `action='edited'` and the diff.
- UI must show an "Edited" badge on sales that have any edited audit entry.

## Void vs Delete (Q7)
- Final sales: **Void only** (UI hides delete; backend rejects delete).
- Drafts and quotations: Delete allowed; no stock/due impact to reverse.
- Voided sales: stock returned to inventory, customer due reduced. All within a single transaction.

## Add Payment to existing sale (Q8)
- Endpoint `sales.addPayment(saleId, { method, amount, reference, paid_at, user_id })`.
- Updates `sales.paid` and `sales.due` atomically.
- Writes `sale_audit` with `action='paid'`.
- Updates customer balance.

## Returns (sell_returns) (Q12-14)
```ts
sell_returns (
  id PK, ref_no UNIQUE,
  sale_id FK NULL,                 -- null when manual return
  customer_id FK,
  date TIMESTAMP,
  user_id FK,
  reason ENUM(damaged|wrong-item|changed-mind|defective|warranty|other),
  refund_method ENUM(Cash|Card|bKash|Nagad|Bank|CreditAdjust|StoreCredit),
  total,
  notes,
  manual BOOLEAN DEFAULT false
)
sell_return_lines (
  id PK, return_id FK,
  product_id FK, name_at_return, sku_at_return,
  qty, unit, unit_price, refund_amount
)
```
- **Refund methods**:
  - **Cash** → cash drawer subtraction (Cash In/Out movement type `refund`).
  - **CreditAdjust** → reduce `customers.due` by refund amount (no cash movement).
  - **StoreCredit** → add to `customers.store_credit_balance` (new column).
  - **bKash/Nagad/Card/Bank** → record reference of reversal; no automatic provider call.
- **Manual returns** (no source invoice): create `sell_return` with `sale_id = NULL` and `manual=true`. Backend permission required.
- Restocks the returned items (writes to `stock_movements` with reason `return`).

## Shipments (Q15)
```ts
shipments (
  id PK, ref_no UNIQUE, sale_id FK,
  driver, vehicle_no, tracking_no,
  status ENUM(pending|in-transit|delivered|failed),
  address, target_date, delivered_at,
  notes, created_at
)
```
- Print delivery slip = different template from invoice (no prices, focuses on items + signatures + addresses).
- Backend should provide a separate `printDeliverySlip(shipmentId)` endpoint distinct from `printInvoice`.
- Status transitions tracked in `shipment_status_log(shipment_id, status, at, by_user_id, note)` for audit.

## Discount rules (Q17)
- **Deferred.** No table needed yet.
- When built later: `discount_rules(id, name, type ENUM[percent|flat], value, scope ENUM[order|line], criteria JSON, valid_from, valid_to, active)`.

## Import Sales CSV (Q18) — IMPORTANT contract
Frontend offers a **Download template** that exports this exact format. Parser must accept it back losslessly.

**Headers (in this order)**:
```
invoice_no, date, customer_phone, customer_name, branch, sku, quantity,
unit, unit_price, line_discount_pct, line_discount_flat,
order_discount_pct, order_discount_flat, tax_pct, shipping, other,
payment_method, paid_amount, reference, cashier, notes
```

**Rules**:
- One row per **line item**. Same `invoice_no` groups rows into one sale.
- Order-level fields (`order_discount_*`, `tax_pct`, `shipping`, `other`) MUST be identical across rows of the same invoice — backend validates.
- Payment can be split: repeat invoice rows with different `payment_method` + `paid_amount`. Backend de-duplicates by (invoice_no, payment_method, reference).
- `customer_phone` is the join key. If not found, create new customer with `customer_name`.
- `sku` must match an existing product; unknown → reject with row error.
- `unit` must match an alternate unit of the product (or its base unit).
- `date` format: `YYYY-MM-DD HH:mm` (24h).
- Encoding: UTF-8 with optional BOM. Backend strips BOM.
- Newlines: LF or CRLF. Both accepted.
- Quoting: standard CSV. Fields containing commas must be double-quoted.

**Output (Export)**:
Same headers, one row per line item. Each row also includes the order-level fields (repeated). This guarantees export → import roundtrip works without errors.

## Sales list customizable columns
- Persisted via Zustand `pos-sales-ui` (localStorage). Backend will move to user prefs.
- Default visible: date, invoice, customer, items, total, paid, due, paymentStatus, paymentMethod, cashier.
- Available: + subtotal, discount, tax, branch, profit, type.
- `profit` column requires `unit_cost_at_sale` per line and is permission-gated (owner only).

## Sale Detail UX (Q4 = both)
- Drawer is the default open mode (from list rows).
- "Open full page" link in the drawer goes to `/sales/:id`.
- `/sales/:id/edit` opens the AddSale form with the existing record pre-filled.
- Both views read from the same `useSales` store; backend will replace with TanStack Query.

## What's still to wire
- Drawer "Edit" button → currently navigates to `/sales/:id/edit`; needs round-tripping to update the existing record (currently just adds a new one).
- Sale Detail's full-page route at `/sales/:id` (currently the drawer's "Open full page" link routes there but no page handler exists yet — that's a follow-up).
- Print buttons just toast for now; real print uses Receipt component (already built in Task 3).


## Numeric input contract (cross-cutting)

Frontend uses a `NumberField` component (`src/components/ui/NumberField.tsx`) that
allows free typing of `0`, decimals (`5.5`, `0.5`, `5.`), blanks, etc. It always
emits a finite number to its `onChangeNumber` callback.

Backend implication:
- IPC and DB columns for any user-entered numeric value must accept floats and zero
  cleanly. Use `REAL` (SQLite) / `DECIMAL(p,s)` for prices/quantities. Avoid
  `INTEGER` for fields where users may enter fractional units (kg, ft, m).
- Validation: reject `NaN` and `Infinity`; clamp to non-negative for prices/qty;
  allow zero (e.g. promotional 0-cost item, complimentary line).


---

# Task 8 — Contacts Module

## Customer schema additions
```ts
customers (
  id PK,
  name NOT NULL,
  phone NOT NULL,
  alt_phone TEXT NULL,
  email TEXT NULL,
  address TEXT NULL,
  group_id FK → customer_groups,        -- replaces flat 'group' string
  credit_limit DECIMAL(12,2) NULL,
  opening_balance DECIMAL(12,2) DEFAULT 0,
  due DECIMAL(12,2) DEFAULT 0,
  total_purchase DECIMAL(14,2) DEFAULT 0,
  total_paid DECIMAL(14,2) DEFAULT 0,
  dob DATE NULL,
  tags TEXT NULL,                       -- semicolon separated, OR a join table
  notes TEXT NULL,
  joined DATE,
  last_sale_at TIMESTAMP NULL,
  created_at, updated_at
)
```

Index `customers(phone)` UNIQUE — phone is the de-dupe key for import.

## Supplier schema additions
```ts
suppliers (
  id PK,
  name NOT NULL,
  company TEXT NULL,
  contact_person TEXT NULL,
  phone NOT NULL,
  alt_phone TEXT NULL,
  email TEXT NULL,
  address TEXT NULL,
  tax_id TEXT NULL,
  bank_account TEXT NULL,
  lead_time_days INT NULL,
  payment_terms ENUM(Cash|Net7|Net15|Net30|Net60) DEFAULT 'Cash',
  opening_balance DECIMAL(12,2) DEFAULT 0,
  due DECIMAL(12,2) DEFAULT 0,
  total_purchase DECIMAL(14,2) DEFAULT 0,
  total_paid DECIMAL(14,2) DEFAULT 0,
  tags TEXT NULL,
  notes TEXT NULL,
  last_purchase_at TIMESTAMP NULL,
  created_at, updated_at
)
```

## Customer Groups = Selling Price Groups (Q10)
- Single entity: `customer_groups`. The Customer Groups page and Selling Price Groups
  page (Task 6) read/write the same store (`usePriceGroups`) — backend uses one table.
- Adds these fields beyond the basic price-group definition:
  ```ts
  default_credit_limit DECIMAL(12,2) NULL
  default_discount_pct DECIMAL(5,2) NULL
  tax_exempt BOOLEAN DEFAULT false
  ```
- When a customer is added to a group, frontend should auto-populate
  `credit_limit = group.default_credit_limit` (if customer's own value is empty).
- When customer is selected in POS / Add Sale, auto-switch the cart's price group
  to match the customer's group.

## Customer ledger
- The CustomerDetail page builds a ledger by joining sales + payments + returns +
  opening balance, sorted by date with running balance.
- Backend should expose a single IPC `customers.ledger(customerId, dateFrom?, dateTo?)`
  returning the same shape:
  ```ts
  { entries: { date, type, reference, debit, credit, saleId? }[], openingBalance, closingBalance }
  ```
- Recommended: store a flat `customer_ledger` view (materialized or live SQL view)
  derived from sales / sale_payments / sell_returns / customer_adjustments tables.
- Adjustments table for manual corrections: `customer_adjustments(customer_id, date,
  type ENUM[debit|credit], amount, reason, created_by)`.

## Receive Payment (Q9 — both modes)
- **Auto-allocate**: backend takes a single payment and applies it oldest-first to
  outstanding invoices. Returns the resulting allocation list.
- **Manual pick**: frontend sends `[{ saleId, amount }]` allocations explicitly.
- Either way, each allocation creates one `sale_payments` row AND one
  `customer_ledger` entry credit.
- If amount > total due → excess becomes a positive `customer_credit_balance` (advance).
  Frontend must show "applied as advance" notification when this happens.

## Customer Dues page (Q12, Q13)
- Aging buckets: 0–30, 30–60, 60–90, 90+ days based on the **oldest unpaid invoice**.
- Backend query needs the oldest unpaid invoice per customer and its age in days.
- Bulk SMS reminder: select customers → opens SMS template picker → sends.
  Template variables: `{{name}}`, `{{phone}}`, `{{due}}`, `{{oldest_invoice}}`,
  `{{oldest_age_days}}`, `{{shop_name}}`.

## Pay Supplier
- Mirror of Receive Payment, simpler (no auto-allocate to specific purchases yet —
  add when Purchases module gets returns/aging treatment in Task 5).

## Customizable columns
- Persisted in Zustand `pos-contacts-ui` (localStorage). Backend will move to user prefs.
- Customer default columns: avatar, name, phone, group, totalPurchase, due, creditLimit, lastSale.
- Supplier default columns: avatar, name, company, phone, paymentTerms, totalPurchase, due.

## Import contracts (Q16, Q17)

### Customers CSV
```
name, phone, alt_phone, email, address, group, credit_limit,
opening_balance, dob, tags, notes
```
- Required: `name`, `phone`
- `group`: matches a customer_group by name (case-insensitive); creates if missing
- `tags`: `;` separated
- `dob`: `YYYY-MM-DD`
- De-dupe by phone (UPSERT)
- `opening_balance > 0` → customer owes you that amount (debit ledger entry "opening")

### Suppliers CSV
```
name, company, contact_person, phone, alt_phone, email, address,
tax_id, bank_account, lead_time_days, payment_terms,
opening_balance, tags, notes
```
- Required: `name`, `phone`
- `payment_terms`: Cash / Net7 / Net15 / Net30 / Net60 (default Cash)
- De-dupe by phone (UPSERT)

### Output
Export Customers / Suppliers must use the same headers so the file round-trips
through import without errors.

## Cross-module hooks
- POS / AddSale: when user picks a customer, frontend auto-switches `priceGroup` based on
  the customer's group. Currently NOT auto-switching — backend should signal this on
  customer pick (or frontend reads `customer.group` and maps to price-group on selection).
- Customer credit limit warning is already wired in PaymentModal. Backend must enforce
  on save.

## Permissions (future)
- Cashier: read-only on customer/supplier dues; can record payments only on POS flow
- Manager: full Receive Payment / Pay Supplier
- Owner: edit customers/suppliers, change credit limits, void payments

## Pending after this task
- SMS templates and gateway (Task 12)
- Print Statement (PDF generator) — placeholder button only for now
- Bulk SMS from list — UI present, awaits SMS module
- Supplier ledger view (waits for Purchases module fully wired)
- Pay Supplier "auto-allocate" against unpaid purchases (waits for Purchases)


---

# Task 9 — Cash Register / Shift

## Schema
```ts
shifts (
  id PK,
  shift_no INT UNIQUE,                 -- monotonically increasing per branch
  branch_id FK,
  status ENUM(open|closed) DEFAULT 'open',
  opened_by FK → users,
  opened_at TIMESTAMP,
  opening_cash DECIMAL(12,2),
  opening_note TEXT,
  closed_by FK → users NULL,
  closed_at TIMESTAMP NULL,
  counted_total DECIMAL(12,2) NULL,
  variance DECIMAL(12,2) NULL,
  carried_float DECIMAL(12,2) NULL,
  closing_note TEXT NULL,
  -- denomination breakdown stored as JSON or join table:
  counted_denominations JSON NULL,     -- {"d1000":N,"d500":N,...}
  -- aggregate snapshot (filled at close)
  total_cash_in DECIMAL(12,2),
  total_cash_out DECIMAL(12,2),
  expected DECIMAL(12,2),
  sales_count INT,
  sales_total DECIMAL(14,2),
  by_method JSON                       -- { "Cash": amt, "bKash": amt, ... }
)

cash_movements (
  id PK,
  shift_id FK,
  type ENUM(sale_cash|payment_received|manual_in|refund|supplier_paid|expense|manual_out),
  amount DECIMAL(12,2),
  reference TEXT NULL,                 -- invoice no, supplier ref, expense ref
  note TEXT NULL,
  reason ENUM(Petty cash|Float top-up|Bank deposit|Personal use|Other) NULL,
  cashier FK → users,
  at TIMESTAMP
)
```
- Index `cash_movements(shift_id, at)` for fast shift queries.
- Constraint: only one shift per `(branch_id, status='open')`. Backend rejects opening
  a second shift on the same branch until the current one is closed.

## Shift policy (Q2)
- **One open shift per branch**, any cashier can record movements while the shift is open.
- Each movement has its own `cashier` FK so we can later report "who handled what".
- A future "personal till" mode can be added per cashier; out of scope now.

## Required-shift writes (Q3)
On the backend, all of these MUST validate that an open shift exists before saving:
- Sale create (any payment method)
- Customer payment received
- Supplier payment
- Expense
- Sell return (refund out)

If no open shift exists, reject with `SHIFT_REQUIRED`. The frontend then prompts the
user to open a shift via the OpenShiftModal.

## Cash movement triggers (auto-write from elsewhere)
The frontend currently shows mock movements; backend should auto-write to
`cash_movements` from these flows:
- **POS sale**: any line in `sale_payments` with `method='Cash'` → `sale_cash` movement
  with reference = `sales.invoice_no`. Non-cash payments are NOT cash movements.
- **Customer payment received** (Cash method only) → `payment_received`.
- **Supplier paid** (Cash method only) → `supplier_paid`.
- **Expense** (paid in Cash) → `expense`.
- **Sell return refund** in Cash → `refund` (negative direction).
- **Manual in/out** from CashMoveModal → `manual_in` or `manual_out` with reason.

For non-cash payments (bKash, Card, Bank), we still record them as `sale_payments` and
they appear in the Z-Report's `by_method` summary, but they don't move the cash drawer.

## Variance thresholds (Q14)
- `varianceWarnThreshold` (default 100 BDT) — soft warn, can close anyway.
- `varianceBlockThreshold` (default 1000 BDT) — hard block, requires manager override
  permission `cashRegister.overrideVariance`.
- Both configurable in Settings → Cash Register (Task 13).
- Backend logs the override + the manager's user id when used.

## Carry-over (Q9)
- At close, cashier picks `carried_float` (defaults to current threshold or 5000).
- Backend creates `bank_deposit_pending` entry for `counted_total - carried_float`
  (a separate tracking table or just a tag in cash_movements).
- The next opened shift takes `carried_float` as its `opening_cash` (UI preselects).

## Reports
- **X-Report** (Q7): exact same content as Z but shift remains `open`. Just a UI label —
  no backend write. Can be re-printed any time.
- **Z-Report** (Q10): generated automatically at close. Stored snapshot is the
  authoritative version (all aggregates frozen at close-time).
- Both rendered using the same `ShiftReport` component.
- For thermal printers, generate a 50/80mm-friendly format separately; the on-screen
  HTML is for desktop / A4 printing.

## Register Report (Q11)
- IPC `cashRegister.listShifts({ branchId, dateFrom, dateTo, cashierId, status, page,
  pageSize })` returns shifts with their snapshot totals.
- Click any row → open `ShiftReport` modal.
- Export CSV/PDF — backend renders.

## Permissions (Q13)
- `cashRegister.openShift` — cashier+
- `cashRegister.closeOwnShift` — cashier+ (only the shift they opened)
- `cashRegister.closeAnyShift` — manager+
- `cashRegister.overrideVariance` — manager+
- `cashRegister.deleteShift` — owner only (audit-flagged; very rare)
- `cashRegister.viewAllReports` — manager+

## Active shift visibility (Q15)
- Titlebar pill is now wired to `/cash-register` and reads live state from the store.
- Pill colour: success green when open, warning amber when no shift active.
- Shift # is live (`#${shift.shiftNo}`) — backend sends shift number with each open.

## Pending after this task
- Manager-override prompt for variance block (currently uses a simple confirm; later
  needs a PIN entry from a manager user)
- Email/SMS to owner when block threshold breached
- Bank deposit tracking screen (the "to deposit" amount from each close)
- Multi-branch: when titlebar branch context switches, current shift updates accordingly


---

# Task 7 — Stock Module

## Single source of truth: `stock_movements`
Every stock-changing event writes a row here. Per-product per-branch stock is derived
by `SUM(qty)` (or maintained via materialized totals on the products table for speed).

```ts
stock_movements (
  id PK,
  product_id FK,
  branch_id FK,
  reason ENUM(
    sale, sale_return, purchase, purchase_return,
    transfer_out, transfer_in,
    damage, theft, sample, recount,
    opening_stock, other
  ),
  qty DECIMAL(12,3),                  -- signed: + adds, - removes (use REAL/DECIMAL for fractional kg/m/ft)
  unit TEXT,                          -- unit at time of move
  unit_cost DECIMAL(12,2),            -- cost basis at time of move
  reference TEXT,                     -- sale_id / purchase_id / transfer_id / adjustment_id
  reference_type TEXT,                -- 'sale' | 'purchase' | 'transfer' | 'adjustment'
  note TEXT,
  user_id FK,
  at TIMESTAMP
)
```
Index `(product_id, branch_id, at)` for fast queries.

## Stock value formula (Q11)
- **At cost** = `qty × cost_at_last_purchase`. Backend should expose `last_purchase_cost`
  per `(product_id, branch_id)` (or derive from latest `purchase_lines` join).
- **At retail** = `qty × current_sell_price` (live from `products.price`).
- Reports use the at-cost figure for valuation; retail value is shown for reference.

## Stock Transfers
```ts
stock_transfers (
  id PK, ref_no UNIQUE,
  date TIMESTAMP,
  from_branch_id FK, to_branch_id FK,
  status ENUM(pending|in-transit|received|cancelled),
  notes TEXT,
  created_by FK,
  received_by FK NULL, received_at TIMESTAMP NULL, receive_note TEXT NULL
)
stock_transfer_lines (
  id PK, transfer_id FK,
  product_id FK,
  qty DECIMAL,            -- sent qty
  unit, unit_cost,
  received_qty DECIMAL NULL
)
```
Stock movement effects:
- On status `pending` → no movement yet
- On `in-transit` → write `transfer_out` movement at from_branch (− qty)
- On `received` → write `transfer_in` movement at to_branch (+ received_qty)
  - If `received_qty < qty` → write a `damage` adjustment for the diff at to_branch (auto)
- On `cancelled` (only if pending/in-transit, with permission) → reverse any out-movement

The frontend's `Receive Transfer` modal already presents the variance and warns the user.

## Stock Adjustments
```ts
stock_adjustments (
  id PK, ref_no UNIQUE,
  date TIMESTAMP,
  branch_id FK,
  type ENUM(damage|theft|sample|recount|other),
  reason TEXT,
  created_by FK
)
stock_adjustment_lines (
  id PK, adjustment_id FK,
  product_id FK,
  qty DECIMAL,            -- signed; negative for damage/theft, positive for found
  unit, unit_cost
)
```
On save: write `stock_movements` row per line with `reason` matching the adjustment type.

## Stock Alerts
- Pure derived view of `products` where `stock <= reorder_level`.
- "Suggested order qty" formula: `max(reorder_level * 2 - stock, reorder_level)`.
- Bulk "Create Purchase" handoff: navigates to Purchases module with selected products
  prefilled (open question — Task 5 will define the URL contract; current placeholder
  uses `?from=alerts`).

## Multi-branch (Q12)
- Pages currently hard-code `Mirpur Branch`. When the global branch context exists
  (titlebar branch switcher), wire all stock pages to read it.
- "All branches" filter: aggregate `SUM(qty)` across all `branch_id` for the selected
  product. Some columns (last_received, last_sold) need per-branch resolution.

## Permissions
- `stock.view` — everyone
- `stock.transfer.create` — manager+
- `stock.transfer.receive` — manager+ (or cashier of receiving branch with permission)
- `stock.transfer.cancel` — manager+
- `stock.adjustment.create` — manager+ (because adjustments can hide loss)
- `stock.adjustment.delete` — owner only (audit-flagged)

## Print/Export (Q14)
- Stock Report → CSV / PDF; columns match the visible columns config.
- Transfer slip → simple A4/thermal layout with from/to branches, items, signatures.
- Adjustment voucher → simple printout with reason, items, signatures.
- Templates configurable in Settings → Receipt Printers / Templates (Task 13).

## Customizable columns
- Persisted via Zustand `pos-stock-ui` (localStorage). Backend will move to user prefs.
- Default: image, name, sku, category, stock, reorder, valueCost, status.
- Available extras: barcode, brand, unit, valueRetail, lastSold, lastReceived.

## Pending after this task
- Per-product "Stock Movements" history page (linked from Products row "View movements")
- Real branch context (titlebar)
- Bulk purchase creation from Stock Alerts (waits for Task 5)
- Receipt of transfers from a different branch's perspective (multi-user / multi-branch)


---

# Task 5 — Purchases Module

## Schema
```ts
purchases (
  id PK,
  ref_no UNIQUE,
  status ENUM(received|ordered|in-transit|cancelled) DEFAULT 'received',
  date TIMESTAMP,
  supplier_id FK,
  supplier_address_snapshot TEXT,    -- denormalized at create
  branch_id FK,
  user_id FK,
  pay_terms TEXT NULL,               -- copied from supplier or overridden
  attachment_url TEXT NULL,          -- pdf / image of vendor invoice
  subtotal, total_line_discount,
  order_discount_type ENUM(flat|percent),
  order_discount_value DECIMAL(12,2),
  order_discount DECIMAL(12,2),
  tax_pct, tax,
  shipping, shipping_details TEXT NULL,
  other,
  total, paid, due,
  notes TEXT NULL,
  cancelled_at TIMESTAMP NULL, cancelled_by FK NULL, cancel_reason TEXT NULL,
  created_at, updated_at
)

purchase_lines (
  id PK,
  purchase_id FK,
  product_id FK,
  name_at_purchase, sku_at_purchase,
  qty DECIMAL,
  unit, unit_factor,                  -- vs base unit
  imei TEXT NULL,                     -- serial / IMEI for tracked items
  unit_cost_before_disc DECIMAL,
  discount_pct, discount_flat,
  unit_cost_before_tax DECIMAL,        -- computed
  tax_pct,
  line_total DECIMAL,                  -- computed
  new_sell_price DECIMAL NULL,         -- if user updates sell price after purchase
  margin_pct DECIMAL NULL              -- snapshot at save
)

purchase_payments (
  id PK, purchase_id FK,
  method ENUM(Cash|bKash|Nagad|Card|Bank|Cheque),
  amount DECIMAL,
  reference TEXT NULL,
  paid_at TIMESTAMP,
  by_user_id FK
)

purchase_audit (
  id PK, purchase_id FK,
  at TIMESTAMP, by_user_id FK,
  action ENUM(created|edited|cancelled|paid|returned),
  note TEXT, changes JSON
)

purchase_returns (
  id PK, ref_no UNIQUE,
  purchase_id FK, supplier_id FK,
  date TIMESTAMP,
  user_id FK,
  reason ENUM(damaged|wrong-item|expired|short-shipped|other),
  refund_method ENUM(CashRefund|CreditAdjust|Bank|bKash|Nagad),
  total, notes TEXT NULL
)
purchase_return_lines (
  id PK, return_id FK,
  product_id FK,
  qty, unit, unit_cost, refund_amount
)
```

## Lifecycle (Q4)
- Default flow: **received** (instant). Stock moves immediately on save.
- Optional: **ordered → in-transit → received → cancelled** for shops with PO process.
- Status transitions allowed:
  - ordered → in-transit → received
  - any → cancelled (with permission)
- Stock effects:
  - On `received` save → write `stock_movements(reason='purchase', qty=+lineQty)`
  - On status change to `received` later → same write at that point
  - On `cancelled` from `received` → reverse stock + reverse supplier due/payments
  - On `cancelled` from `ordered`/`in-transit` → no stock effect (no movement was ever written)

## Required behaviour at save (Q13)
1. Validate supplier, lines, branch, status
2. Insert purchase + lines + payments
3. If status = `received`: insert one `stock_movements` row per line (reason='purchase')
4. Update supplier `due` and `total_purchase` totals
5. Write `purchase_audit` entry `created`
6. If any line has `new_sell_price` set, update product `price` (with audit log entry on
   `products`)

## Margin warning (Q14)
- Frontend warns on save when ≥1 line has `marginPct < 10`. Configurable threshold in
  Settings → Purchases (default 10%).
- Backend: store a `low_margin_flag` per line for reports.
- Allow override; log it in `purchase_audit.note`.

## Pay Bill (Q17)
- Top-level button on Purchases list.
- Modal lets user pick a supplier with outstanding payable, choose **auto-allocate
  (oldest first)** or **pick bills manually**, choose payment method, optional reference.
- Backend allocates payment across multiple `purchase_payments` rows + reduces
  `suppliers.due`.
- Excess (over total payable) becomes supplier **advance balance** (new column on
  `suppliers.advance_balance` or a separate `supplier_advances` table).

## Add Payment to existing purchase (Q16)
- Same as Sales `addPayment` IPC.
- Updates `purchases.paid` and `purchases.due` atomically.

## Edit / Cancel (Q11)
- Same window-policy as Sales: editable for N minutes after creation; after that
  requires permission `purchases.edit_after_window`.
- `received` purchases use **Cancel** (audit-flagged, reverses stock + supplier due
  + payments). Only `ordered` and `cancelled` records can be deleted outright.

## Profit margin (Q6, Q8)
- Margin formula at line level:
  `(new_sell_price - unit_cost_before_tax) / unit_cost_before_tax × 100`
- Updated live in the Add Purchase form.
- Color coding: < 10% destructive, 10–30% warning, > 30% success.

## Sell price update prompt (Q7)
- Frontend already exposes a "Sell Price (Inc.)" column in the Add Purchase form. If
  user changes it, on save we update `products.price` for that product.
- Backend should also write a `product_price_history` row so reports can trace price
  changes.

## Pay Bill / Add Payment cash drawer impact
- Cash payments to suppliers must write a `cash_movements` row of type `supplier_paid`
  to the currently open shift (Task 9 contract). Reject if no shift is open.
- Non-cash methods (bKash / Bank etc.) do not touch the cash drawer.

## Stock movements on purchase return (Q12)
- Each return line writes `stock_movements(reason='purchase_return', qty=-returnQty)`.
- Refund methods semantics:
  - **CashRefund** → cash movement `manual_in` (we get cash back from supplier)
  - **CreditAdjust** → reduces `suppliers.due`
  - **Bank / bKash / Nagad** → record reference; no cash drawer effect

## Import contract (Q15)
Headers (row order matters for export round-trip):
```
ref_no, date, supplier_phone, supplier_name, branch, sku, quantity,
unit, unit_cost, line_discount_pct, line_discount_flat,
order_discount_type, order_discount_value, tax_pct, shipping, other,
payment_method, paid_amount, reference, user, notes
```
- One row per **line item**. Same `ref_no` groups rows.
- Order-level fields must be identical across rows of the same purchase (validate).
- Multiple payment methods: repeat invoice rows with different `payment_method` +
  `paid_amount`. De-dup by (ref_no, payment_method, reference).
- `supplier_phone` joins by phone; if not found, create with `supplier_name`.
- `sku` must match an existing product; unknown → row error.
- `date` format: `YYYY-MM-DD HH:mm`.
- Encoding: UTF-8 with optional BOM.

## Cross-module hooks
- **Stock alerts → Create Purchase**: Stock Alerts page already navigates with
  `?from=alerts` query. Backend should accept a query like `?ids=p1,p9,p13` and
  prefill the Add Purchase items table with suggested order qty.
- **Supplier auto-fill**: address and pay terms auto-populate from the picked
  supplier (already done in frontend).

## Customizable columns
- Persisted in Zustand `pos-purchases-ui` (localStorage). Move to user prefs DB later.
- Default: date, ref, supplier, items, total, paid, due, paymentStatus, status, user.
- Available extras: branch, subtotal, discount, tax, shipping.

## Pending
- Cross-module handoff from Stock Alerts to Add Purchase prefill (UI present, awaits
  backend/router glue)
- Edit existing purchase: form opens but doesn't pre-fill from existing record yet
  (saves as new record); requires same fix as Sales edit
- Print delivery note / GRN voucher template (Settings → Templates)
- Card terminal integration for non-cash supplier payments (future)


## Task 5 — Inline supplier add (addendum)
- Add Purchase page now has a `+` button next to the Supplier dropdown.
- Opens a modal capturing: name, company, contact_person, phone, email, address,
  payment_terms, opening_balance.
- Backend should:
  - Treat phone as UPSERT key (same as bulk import) — if phone already exists, return
    the existing supplier id instead of creating a duplicate.
  - Apply the same validation rules as the Supplier form (phone format, required fields).
  - Return the saved record so the frontend can select it immediately.
- Same pattern is used for the Customer "+ New customer" inline action in POS — share
  the upsert endpoint between both flows where possible.


---

# Task 10 — Expenses

## Schema
```ts
expense_categories (
  id PK,
  name NOT NULL,
  parent_id FK NULL,                  -- single-level hierarchy
  emoji TEXT NULL,
  monthly_budget DECIMAL(12,2) NULL,
  created_at, updated_at
)

expenses (
  id PK,
  ref_no UNIQUE,                      -- auto-generated `EXP-####`
  date TIMESTAMP,
  category_id FK,
  amount DECIMAL(12,2),
  payment_method ENUM(Cash|bKash|Nagad|Card|Bank|Cheque),
  reference TEXT NULL,                -- TxID for non-cash
  note TEXT NULL,
  branch_id FK,
  user_id FK,
  attachment_url TEXT NULL,           -- receipt PDF/image
  recurring BOOLEAN DEFAULT false,
  frequency ENUM(daily|weekly|monthly|yearly) NULL,
  recurring_end DATE NULL,
  recurring_parent_id FK NULL,        -- when this row is auto-created from a recurring template
  voided BOOLEAN DEFAULT false,
  void_reason TEXT NULL,
  created_at, updated_at
)
```

## Cash drawer impact
- When `payment_method = 'Cash'` and a shift is open, write `cash_movements(reason='expense', qty=-amount)` to the active shift.
- Reject expense save with `SHIFT_REQUIRED` if cash payment and no shift open.
- Non-cash methods (bKash, Card, Bank, Cheque) do not touch the cash drawer.

## Recurring engine
- Each "template" expense has `recurring=true` and a `frequency`.
- A scheduled job (Electron main side) runs daily and creates a new `expenses` row from
  each active recurring template when the next due date arrives.
- New rows reference the template via `recurring_parent_id`.
- Pause/resume by toggling `recurring` on the template.
- Optional `recurring_end` stops generation after that date.
- Notification (SMS / in-app) on creation can be added later (Task 12 SMS module).

## Categories — single-level hierarchy
- Same pattern as Product Categories: optional `parent_id`, only one level deep.
- Delete detaches children (sets their `parent_id` to NULL) instead of cascading.
- Track `monthly_budget` per category for budget vs actual reporting.

## Customizable columns
- Persisted in Zustand `pos-expenses-ui` (localStorage). Move to user prefs DB later.
- Default: date, category, note, amount, method, branch, user, attachment.
- Available extras: ref, reference, recurring.

## Filters
- Search: note OR reference OR ref_no.
- Date range: today / week / month / custom.
- Category, payment method, branch, user, min/max amount.

## Bulk actions
- Bulk select → Export, Delete (soft-delete via `voided=true` for audit; backend should
  also support hard-delete for owner-only).

## Edit / Void policy
- Same window-based policy as Sales/Purchases:
  - Edit window (e.g. 30 minutes) — full edit allowed
  - After window — requires `expenses.edit_after_window` permission
- Void: set `voided=true` with reason; if cash, reverse the `cash_movements` entry.
- Hard-delete: only `expenses.delete` permission (owner).

## Import contract (Q13)
Headers (export round-trip):
```
date, category, subcategory, amount, payment_method, reference,
note, branch, user, attachment_url
```
- Required: date, category, amount, payment_method.
- `category` matches existing top-level category by name; auto-created if missing.
- `subcategory` matches existing under that parent; auto-created.
- `payment_method` ∈ Cash / bKash / Nagad / Card / Bank / Cheque.
- `attachment_url` is a relative path to a previously-uploaded file; on import that
  doesn't fetch external URLs (security) — backend should validate paths inside
  `userData/uploads/expenses/`.
- `branch` and `user` matched by name; default to current branch / user when missing.

## Cross-module hooks
- Expense Report (Task 11) reads from this table.
- Cash drawer (Task 9) gets `expense` movements automatically.
- Dashboard (Task 2) Expense Breakdown widget aggregates by category.

## Permissions
- `expenses.create` — cashier+
- `expenses.edit_after_window` — manager+
- `expenses.void` — manager+
- `expenses.delete` — owner only
- `expenses.import` — manager+

## Pending
- Recurring expense automation (background job)
- Budget vs actual report card on the Categories page
- Per-category color (frontend uses emoji icons; could add color too)
- Receipt OCR (future) — auto-fill from uploaded receipt image


---

# Task 13 — Settings

The Settings module became the source of truth for all shop-wide configuration. Frontend
keeps it in a single Zustand store (`pos-settings`) plus two side stores (`pos-branches`,
`pos-users`). Backend will normalize this into proper tables with user/branch scoping.

## Stores → tables mapping
- `pos-settings` (Zustand) → split into:
  - `business_info` (singleton row)
  - `tax_rates`
  - `invoice_schemes`
  - `receipt_template` (singleton or per-printer override)
  - `barcode_settings` (singleton)
  - `printer_profiles`
  - `appearance_prefs` (per-user)
  - `pos_prefs` (per-shop, with optional per-user override)
  - `cash_register_prefs`
  - `keyboard_shortcuts` (per-user)
  - `backup_settings`
- `pos-branches` → `branches` (already drafted in Task 1 notes)
- `pos-users` → `users`, `roles`, `commission_agents`

## Business Info (Settings → Business Info)
```ts
business_info (
  id PK,
  name TEXT NOT NULL,
  tagline TEXT NULL,
  logo_url TEXT NULL,                 -- stored under userData/uploads/business/
  address TEXT NULL,
  phone_primary TEXT NULL,
  phone_alt TEXT NULL,
  email TEXT NULL,
  website TEXT NULL,
  vat_tin TEXT NULL,
  bin_no TEXT NULL,                   -- BD Business Identification Number
  trade_license_no TEXT NULL,
  currency_symbol TEXT DEFAULT '৳',
  currency_position ENUM(before|after) DEFAULT 'before',
  decimal_places INT DEFAULT 2,
  thousand_separator TEXT DEFAULT ',',
  timezone TEXT DEFAULT 'Asia/Dhaka',
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  fiscal_year_start INT DEFAULT 7,    -- BD norm = July
  default_language ENUM(en|bn) DEFAULT 'en',
  default_branch_id FK NULL,
  updated_at TIMESTAMP
)
```
- Singleton row (id = 1). Backend exposes `business.get()` / `business.update(patch)`.
- `logo_url` upload: same pattern as products — save under `userData/uploads/business/logo.{ext}`.
- All UI elements (titlebar brand, receipt header, invoice header) read from this row at runtime.
- Receipt amount-in-words must respect `default_language`.

## Branches (Settings → Branches)
- See Task 1 notes for the full branches schema.
- `is_default` is a soft flag; backend should enforce only one default at a time.
- Cannot delete the default branch; UI already enforces this.
- `active=false` excludes a branch from POS branch switcher and reports.

## Tax Rates (Settings → Tax Rates)
```ts
tax_rates (
  id PK,
  name TEXT NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  scope ENUM(product|sale|purchase|all) DEFAULT 'all',
  active BOOLEAN DEFAULT TRUE
)
```
- Default tax for new products / sales is whichever row has `is_default=true`.
- Defaults seeded: VAT 15%, VAT 5%, No Tax 0% (No Tax is default per user instruction).
- POS reads `tax_rates WHERE scope IN ('sale','all')` for the order tax dropdown.

## Invoice Schemes (Settings → Invoice Schemes)
```ts
invoice_schemes (
  id PK,
  name TEXT,
  doc_type ENUM(sale|pos|quotation|draft|purchase|return|shipment),
  prefix TEXT NOT NULL,
  year_format ENUM(none|YY|YYYY),
  separator TEXT DEFAULT '-',
  counter_padding INT DEFAULT 4,
  reset_rule ENUM(never|yearly|monthly),
  start_number INT DEFAULT 1,
  current_counter INT DEFAULT 0,
  is_default BOOLEAN
)
```
- One default per `doc_type`. Backend enforces.
- Sale create flow asks for the next number from the default scheme of the relevant doc type:
  - Compute `yearStr` based on `year_format`
  - `padded = lpad(current_counter + 1, counter_padding, '0')`
  - `invoice_no = prefix + sep + yearStr + sep + padded`
  - Increment `current_counter` atomically
  - Reset based on `reset_rule` (clear at year/month boundary)
- Frontend has a `previewSchemeNumber()` helper for the live preview only — it always shows
  the pattern, not the actual next number.

## Receipt Template (Settings → Receipt Template)
```ts
receipt_template (
  id PK,
  paper_size ENUM('50mm'|'80mm'|'A4') DEFAULT '80mm',
  show_logo BOOLEAN DEFAULT TRUE,
  header_lines TEXT[],                -- JSON array
  footer_lines TEXT[],
  show_cashier BOOLEAN,
  show_customer_phone BOOLEAN,
  show_customer_address BOOLEAN,
  show_line_discount BOOLEAN,
  show_line_tax BOOLEAN,
  show_payment_ref BOOLEAN,
  show_barcode BOOLEAN,
  show_qr_code BOOLEAN,
  show_amount_in_words BOOLEAN
)
```
- The Receipt component (`src/components/pos/Receipt.tsx`) currently renders all fields.
  Backend must pass these toggles to the renderer (web preview + ESC/POS) and skip blocks
  accordingly.
- Header/footer text: free-form lines, one per row in UI textarea, joined with newlines.
- QR code (when enabled) should encode an invoice URL like `pos://invoice/{invoice_no}`
  for offline workflows; later we can switch to a public URL when the cloud sync is on.

## Barcode Settings (Settings → Barcode Settings)
```ts
barcode_settings (
  id PK,
  default_label ENUM('50x30'|'A4-grid'),
  show_name BOOLEAN, show_sku BOOLEAN, show_barcode BOOLEAN,
  show_price BOOLEAN, show_brand BOOLEAN, show_mrp BOOLEAN,
  default_copies INT DEFAULT 1,
  code_type ENUM(Code128|EAN-13)
)
```
- Drives defaults on the Barcode Print page (Task 6). Per-job overrides remain on that page.
- Real Code128 / EAN-13 SVG generation must happen in the Electron main process (or a worker)
  using `bwip-js` or similar.

## Printer Profiles (Settings → Receipt Printers)
```ts
printer_profiles (
  id PK,
  name TEXT NOT NULL,
  branch_id FK NULL,                  -- null = any branch
  connection ENUM(USB|Network|Bluetooth),
  model TEXT,
  ip_or_port TEXT,                    -- 192.168.x.x for Network, COM3 / /dev/usb/lp0 for USB
  paper_width INT (50|58|80|210),
  encoding ENUM(UTF-8|GB18030|CP437) DEFAULT 'UTF-8',
  is_default BOOLEAN
)
```
- Test print: send a small ESC/POS ping job; show "OK" or printer error.
- Default printer is per branch (when `branch_id` is set) and global fallback (when null).
- Encoding hint: most BD shops need `UTF-8` for Bangla. CP437/GB18030 only for legacy
  thermal printers that ship without UTF-8 fonts.

## Appearance Prefs (Settings → Theme & Appearance)
```ts
appearance_prefs (
  user_id FK PRIMARY KEY,
  theme_mode ENUM(light|dark|system),
  accent_hue INT (0..360),
  density ENUM(compact|comfortable),
  font_scale DECIMAL(2,1)              -- 0.9 / 1.0 / 1.1 / 1.2
)
```
- **Per-user**, not per-shop. Each cashier may prefer different density / font scale.
- Frontend applies hue by overriding `--primary`, `--ring`, `--sidebar-accent` CSS vars at
  `:root`. Lightness/saturation kept fixed (`75% 58%`) so the UI stays consistent.
- Font scale applied via root `font-size`. Tailwind's `rem`-based sizing carries it through.
- App.tsx reapplies appearance on every load so values survive reloads.

## POS Preferences (Settings → POS Preferences)
```ts
pos_prefs (
  shop_id PK,                         -- single row for now
  default_price_markup_pct DECIMAL(5,2) DEFAULT 0,
  default_order_tax_pct DECIMAL(5,2) DEFAULT 0,
  default_payment_method TEXT DEFAULT 'Cash',
  visible_payment_methods TEXT[] DEFAULT ['Cash','bKash','Nagad','Card','Bank','Credit'],
  auto_print_on_save BOOLEAN DEFAULT FALSE,
  big_button_mode BOOLEAN DEFAULT FALSE,
  allow_negative_stock_default BOOLEAN DEFAULT FALSE,
  reset_customer_per_cart BOOLEAN DEFAULT TRUE
)
```
- Frontend reads these defaults when a new cart is created (Task 3).
- The default method is always present in `visible_payment_methods` — backend should enforce
  this invariant on save (the frontend already does).

## Cash Register Prefs (Settings → Cash Register)
```ts
cash_register_prefs (
  shop_id PK,
  variance_warn DECIMAL(12,2) DEFAULT 100,
  variance_block DECIMAL(12,2) DEFAULT 1000,
  default_carried_float DECIMAL(12,2) DEFAULT 5000,
  require_manager_pin_on_variance BOOLEAN DEFAULT TRUE
)
```
- Used by the Close Shift wizard (Task 9). Below warn = silent. warn..block = yellow.
  ≥ block = red, manager PIN required when toggle is on.
- Default carried float pre-fills the Open Shift modal.

## Keyboard Shortcuts (Settings → Keyboard Shortcuts)
```ts
keyboard_shortcuts (
  user_id FK PRIMARY KEY,
  search TEXT DEFAULT 'F2',
  customer TEXT DEFAULT 'F3',
  order_discount TEXT DEFAULT 'F4',
  held_carts TEXT DEFAULT 'F5',
  save_draft TEXT DEFAULT 'F6',
  save_quotation TEXT DEFAULT 'F7',
  pay TEXT DEFAULT 'F8',
  hold TEXT DEFAULT 'F9',
  new_cart TEXT DEFAULT 'F10',
  reprint_last TEXT DEFAULT 'Ctrl+P',
  show_help TEXT DEFAULT '?'
)
```
- **Per-user**, not per-shop.
- The frontend captures real keystrokes and stores them as strings like `Ctrl+Shift+P` or
  `F8`. POS hotkey listeners parse this format on press.
- Conflict detection on save: if a new combo matches another field, the other field is
  cleared (UI does this, backend should too on direct edits).
- Reset action restores defaults; backend should expose `shortcuts.reset(user_id)`.

## Backup Settings (Settings → Backup & Sync)
```ts
backup_settings (
  shop_id PK,
  auto_backup ENUM(off|daily|on-shift-close),
  cloud_provider ENUM(none|supabase|s3|google-drive),
  cloud_connected BOOLEAN,
  cloud_account TEXT NULL,
  last_local_backup_at TIMESTAMP NULL,
  last_cloud_sync_at TIMESTAMP NULL
)

backup_history (
  id PK,
  kind ENUM(local|cloud),
  status ENUM(ok|failed),
  size_bytes BIGINT,
  ran_at TIMESTAMP,
  error TEXT NULL
)
```
- **Local backup**: zip SQLite + `userData/uploads/` to `userData/backups/{ISO}.pos-backup`.
- **Cloud sync**: provider adapter pattern. Three adapters initially:
  - `supabase` — direct REST API; user logs in with email + password, API key stored in
    macOS Keychain / Windows Credential Manager (NEVER in `pos-settings` localStorage).
  - `s3` — AWS / Wasabi / Backblaze / MinIO via S3 SDK; user provides access key + secret
    key + region + bucket name, stored in OS keychain.
  - `google-drive` — OAuth flow opening a system browser, refresh token stored in keychain.
- Auto-backup `daily` runs at 02:00 local time via Electron main scheduler.
- `on-shift-close` runs after Z-Report is generated (Task 9 ties into this).
- Restore flow: pause writes, replace SQLite file, reload app. UI says "Shop will close
  for ~30s" — backend must enforce this.
- Data export (per-entity CSV) is separate from backups — these are CSV downloads suitable
  for accounting / migration, NOT a complete restore-able snapshot.

## Users (Settings → Users)
```ts
users (
  id PK,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  phone TEXT NULL,
  email TEXT NULL,
  pin_hash TEXT NULL,                  -- bcrypt of 4-6 digit PIN
  password_hash TEXT NULL,
  role_id FK NOT NULL,
  branch_ids TEXT[],                   -- empty array = all branches
  status ENUM(active|inactive|suspended) DEFAULT 'active',
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```
- The owner account (`u_admin` seed in frontend) cannot be deleted; backend must enforce
  by checking whether the user has the Admin role and whether they're the only admin.
- Frontend currently lets the user enter a PIN as plaintext — backend must hash on save
  (`bcrypt(pin, cost=10)` is enough for a local-first app; can bump later).
- `passwordSet` boolean in frontend is a UI-only flag. Backend can derive this from
  `password_hash IS NOT NULL`.
- `branch_ids` empty array = "all branches". Backend should treat empty/null the same.
- `last_login_at` updated by the auth flow (Task 15).

## Roles & Permissions (Settings → Roles & Permissions)
```ts
roles (
  id PK,
  name TEXT NOT NULL,
  description TEXT NULL,
  is_system BOOLEAN DEFAULT FALSE,    -- built-in roles (cannot be deleted)
  permissions TEXT[]                  -- list of permission action ids
)
```
- System roles seeded (frontend): Admin, Manager, Cashier, Stock Keeper.
- Permission groups + actions are defined in `src/stores/users.ts` `PERMISSION_GROUPS`.
  Backend should read the same list (move it to a shared package later, or duplicate it
  with a sync test). Groups: pos / sales / purchases / products / stock / contacts /
  expenses / cash / reports / settings.
- Backend must enforce permissions at the IPC layer:
  - Every IPC handler receives the calling user from the auth context.
  - Wraps with `requirePermission(['sales.create'])` etc.
  - Returns 403 + readable error on miss.
- Cannot delete a system role. Frontend hides delete button; backend rejects regardless.
- Cannot delete a role that has users assigned. Frontend warns; backend must reject.
- Quick "Grant all / Revoke all" actions write the full permission list / empty list.
  Group-level toggle either grants all actions in the group or revokes all (UI already
  does this; backend just stores the resulting array).

## Sales Commission Agents (Settings → Sales Commission Agents)
```ts
commission_agents (
  id PK,
  name TEXT NOT NULL,
  phone TEXT NULL,
  commission_pct DECIMAL(5,2) DEFAULT 0,
  active BOOLEAN DEFAULT TRUE
)
```
- Optional feature. When agents exist, the Add Sale form (Task 4) gets an optional
  "Sales agent" picker, and the Sales Rep Report (Task 11) shows breakdown by agent.
- Commission % is per agent; we may add per-product or per-category overrides later.

## Permissions catalog (canonical list)
This is the source-of-truth list of permission action ids the frontend ships with.
Backend must accept this set verbatim (or a superset) for role assignments.
```
pos.use, pos.discount, pos.priceOverride, pos.holdCart, pos.reprint
sales.view, sales.create, sales.edit, sales.void, sales.return, sales.payment, sales.import
purchases.view, purchases.create, purchases.edit, purchases.return, purchases.payBill
products.view, products.create, products.edit, products.delete, products.bulkPrice
stock.view, stock.transfer, stock.adjustment
contacts.viewCustomers, contacts.editCustomers, contacts.viewSuppliers, contacts.editSuppliers
expenses.view, expenses.create, expenses.delete
cash.openShift, cash.closeShift, cash.move, cash.zReport
reports.view, reports.export
settings.business, settings.users, settings.roles, settings.devices, settings.backup
```
Total: 41 actions across 10 groups.

## Per-user vs per-shop scope
- **Per-user**: appearance_prefs, keyboard_shortcuts, default_branch (last selected).
- **Per-shop**: business_info, tax_rates, invoice_schemes, receipt_template,
  barcode_settings, printer_profiles, pos_prefs, cash_register_prefs, backup_settings.
- **Per-user with shop default**: a user can override pos_prefs (e.g. cashier prefers
  big-button mode). Schema keeps a separate `pos_prefs_user_overrides(user_id, ...)`
  with nullable columns; resolved by coalescing user override > shop pref > hard default.
  This is a future enhancement; v1 stores everything global.

## Cross-module hooks
- **Receipt template ⇄ Receipt component (Task 3)**: any new toggle added here must be
  honored by the renderer and the ESC/POS printer template.
- **POS prefs ⇄ POS screen (Task 3)**: defaults pulled at cart-creation time.
- **Cash register prefs ⇄ Close Shift wizard (Task 9)**: thresholds + PIN gate.
- **Branches ⇄ Titlebar branch switcher**: branch list lives here; the switcher reads it.
- **Tax Rates ⇄ Add Sale / Add Purchase / Product form**: dropdown options come from here.
- **Invoice Schemes ⇄ Sale/Purchase/etc. create**: next-number generator reads from here
  and increments atomically inside the create transaction.
- **Users ⇄ Auth (Task 15)**: login screen authenticates against this table.

## Pending
- Real cloud OAuth flows for Supabase / S3 / Google Drive (currently mocked toggle).
- Receipt printer test print over a real ESC/POS connection.
- User PIN change & password set/reset flows (waits for Task 15 Login).
- First-run wizard creates the initial Business Info row, default Branch, and Admin user
  (waits for Task 15).
- Per-user override layer for `pos_prefs` (current implementation is global only).
- Audit log on settings changes (who changed what, when) — useful for shops with multiple
  managers; not in v1.


---

# Task 11 — Reports

The Reports module is read-only. Every page is a dedicated route under `/reports/*` that
renders a `ReportToolbar` (shared primitive) plus filters, KPIs, optional chart, and a
detail table. All data currently aggregates client-side from the existing mock stores —
backend will replace these `useMemo` aggregations with cached server-side queries.

## Shared toolbar contract
`src/components/reports/ReportToolbar.tsx` provides the consistent header/filter row.

```ts
interface ReportToolbarProps {
  title: string;
  subtitle?: string;
  range: DateRange;                 // { preset, from?, to? }
  onRangeChange: (r: DateRange) => void;
  branch?: string;
  onBranchChange?: (b: string) => void;
  filters?: ReactNode;              // slot for per-report filters
  hideExport?: boolean;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  onPrint?: () => void;
  backTo?: string;
}
```

Date presets resolved by `resolveRange()`: today, yesterday, thisWeek (Saturday-start
to match BD norm), thisMonth, lastMonth, thisYear, custom. Backend should expose the
same preset → date-pair resolver in shop timezone.

`isInRange(iso, range)` is a small helper — the live aggregation today filters in JS;
backend will accept `{ from, to }` ISO directly.

## Report routes
```
/reports                            — landing
/reports/profit-loss                — Profit / Loss page
/reports/activity-log               — Activity Log
/reports/product-sell               — Product Sell Report
/reports/sell-payment               — Sell Payment Report
/reports/trending                   — Trending Products
/reports/sales-rep                  — Sales Rep Report
/reports/customer-group             — Customer Group Report
/reports/product-purchase           — Product Purchase Report
/reports/purchase-payment           — Purchase Payment Report
/reports/tax                        — Tax Report (Sales VAT / Purchase VAT / Combined)
/reports/stock                      — Stock Report (deep)
/reports/stock-alert                — Stock Alert
/reports/stock-adjustment           — Stock Adjustment
/reports/stock-transfers            — Stock Transfers
/reports/contacts                   — Customer / Supplier (toggle)
/reports/items                      — Items Report (catalog)
/cash-register/report               — Register Report (existing, linked from landing)
```

## Profit / Loss
The hero KPIs and money-in / money-out lists are composed from existing tables. Net
profit formula here is simplified for the mock:
```
net = gross_profit + sell_shipping + sell_other + purchase_returns − expenses
gross_profit = sales_excl_tax_disc − COGS − sell_returns
```
The fuller Task 2 Profit modal formula stays the source-of-truth for backend; this
report's drill-down rows are stubs that will route to underlying transactions.

Backend endpoints needed:
- `reports.profitLoss(range, branchId)` returning the same row set the UI displays.
- Both **gross profit** (using `unit_cost_at_sale`) and **net profit** (after expenses).
- Stock snapshots (`opening_stock_by_purchase`, `closing_stock_by_sale`, etc.) come from
  `stock_valuation_snapshots` (Task 2 note); they are mocked here.

## Activity Log
Pulls from the new `pos-activity` Zustand store seeded with 19 events spanning the last
10 days. Backend will replace with a single `activity_log` table written by triggers
on every meaningful mutation (sales/purchases/expenses/shifts/transfers/etc.).

```ts
activity_log (
  id PK,
  at TIMESTAMP,
  by_user_id FK,
  branch_id FK NULL,
  action ENUM(created|edited|voided|paid|returned|shipped|opened|closed|transferred|adjusted|login|logout|deleted|imported),
  entity ENUM(sale|purchase|return|shipment|product|customer|supplier|expense|shift|transfer|adjustment|user|settings),
  entity_id TEXT NULL,
  entity_ref TEXT NULL,            -- human ref like "INV-2026-0451"
  message TEXT,
  amount DECIMAL(12,2) NULL
)
```

Action enums and entity enums must match `src/stores/activity.ts` so the UI keeps
working without changes.

Filters: user, action, entity, branch, date range, free-text search across `message`,
`entity_ref`, `by`. Group-by-day rendering done client-side.

## Product Sell Report / Product Purchase Report
Aggregations:
```
GROUP BY product_id
COUNT(DISTINCT invoice_no/ref_no) AS invoices/bills
SUM(qty)                          AS qty
SUM(line_total) — line_disc        AS revenue/spend
SUM(qty × unit_cost_at_sale)       AS cost   (sell only)
revenue − cost                    AS profit (sell only)
profit / revenue                  AS margin (sell only)
```
Sell version supports sort by name/qty/revenue/profit/invoices and color-coded margin
column (green ≥20%, amber ≥10%, red <10%).

Filters: search (name/sku), category. Future: brand, supplier (purchase only).

## Sell Payment / Purchase Payment Reports
Flatten payment lines from sales / purchases that fall in range, group by method for the
chip summary, list with Date / Doc / Counterparty / Method / Reference / Amount / By.

## Tax Report
Group sales (or purchases) by `tax_pct`. Display per-rate row: invoices, taxable
amount (subtotal − order_discount), tax collected/paid. Net VAT position = sales tax −
purchase tax. Toggle between Sales VAT / Purchase VAT / Combined.

For NBR filing, expose backend endpoint:
```
reports.taxReport(range, branchId)
  returns {
    sales_by_rate: [{ rate, invoices, taxable, tax_collected }],
    purchase_by_rate: [{ rate, bills, taxable, tax_paid }],
    net_position
  }
```

## Trending Products
Compares two equal-length periods: current = selected range; previous = same length
immediately before. Top 50 ranked by chosen metric (units OR revenue). 14-bucket
sparkline of current period derived from per-line timestamps.

Backend implementation:
- Cache hourly aggregates in a table; trending becomes a fast double-window query.
- For sparklines, return 14 evenly-spaced buckets sized to the period length.

## Sales Rep Report
Reads `commission_agents` from the users store. For each agent: gross sales, returns,
net sales, commission earned (= net × commissionPct/100). Paid vs pending mocked at
60/40 in the UI.

Backend schema additions:
```ts
sale_assignments (
  sale_id FK,
  agent_id FK,
  role ENUM(primary|assist) DEFAULT 'primary'
)
agent_commission_payouts (
  id PK,
  agent_id FK,
  amount DECIMAL(12,2),
  paid_at TIMESTAMP,
  reference TEXT
)
```

The Add Sale form (Task 4) gets an optional Sales Agent picker once agents exist;
agent_id flows into `sale_assignments`. Reports compute commission per agent from this
join.

## Customer Group Report
Groups customers and sales by `customer.group` field (Retail / Wholesale / Contractor +
custom from price_groups). Shows customer count, sale count, gross/net, avg ticket,
total due. Color-coded card per group (green = Retail, blue = Wholesale, amber =
Contractor).

## Stock Reports family
All four read directly from `useStock` (transfers, adjustments) and the products mock.
Behaviour mirrors the live Stock module pages but with date filtering and aggregation:

- **Stock Report** — current snapshot. Date range is mostly UI for now; backend will
  resolve to "as-of" using stock_valuation_snapshots.
- **Stock Alert** — Low (`stock <= reorder AND stock > 0`) + Out (`stock <= 0`) tabs,
  suggested order qty (`reorder × 2 − stock`), aggregated estimated reorder spend.
- **Stock Adjustment** — by-type breakdown (damage/theft/sample/recount/other) with
  signed qty/value per adjustment. Net loss vs found.
- **Stock Transfers** — table with from→to flow, line count, value, status. Filters
  for status.

Backend endpoints (one per page) should accept the same filters as the UI.

## Customer / Supplier Report
Per-contact rollup over the chosen range. Customer mode: `customer.id → { sales,
collected, transactions, current_due }`. Supplier mode: `supplier.id → { spend, paid,
bills, current_due }`. ExternalLink chevron drills into the existing CustomerDetail /
SupplierDetail page.

## Items Report
Pure catalog snapshot — no transaction aggregation. Useful as a printable export of
the product catalog with cost/price/margin/tax/POS-visibility per row.

## Export (Excel / PDF / Print)
Currently the toolbar buttons show alerts. Backend integration plan:
- **Excel**: server-side generation using `exceljs` or similar; column set matches the
  visible UI columns (NOT all available columns); honors active filters; downloads a
  `.xlsx` with a `Report — {title} — {date}` filename.
- **PDF**: server-side PDF rendered from the same dataset using a Handlebars template
  — header (shop info from business_info), filter summary, table, totals, page footer
  with page numbers.
- **Print**: client-side `window.print()` of the on-screen view, with a print-specific
  CSS stylesheet that hides toolbar/sidebar/buttons and tightens row padding.

For all three, the contract is "what's on screen is what gets exported" — same rows,
same totals, same active filters.

## Permissions
- Gate the entire `/reports/*` namespace behind `reports.view`.
- Gate Export buttons behind `reports.export`.
- Profit/Loss page additionally gated; cashier role should see "—" for profit/margin
  values (backend returns null, UI renders dash).
- Sales Rep / Customer Group reports require `reports.view` + manager+ implicit (mostly
  not for cashier eyes). Settings → Roles & Permissions catalog already includes
  `reports.view` and `reports.export`.

## Caching strategy
Reports run frequently; caching is essential.
- Hourly aggregates per (branch, date_hour, metric) for sales/purchases/expenses/payments
  rolled up nightly into daily, monthly, yearly.
- Stock snapshots once per night.
- Dashboard already plans for `daily_stats`; reports reuse the same cache.
- Invalidate on write: a sale/purchase/expense triggers an "incremental update" to its
  hour bucket; nightly job rebuilds full month from raw to correct any drift.

## Pending
- Real Excel/PDF generation (currently alert).
- Drill-down navigation (currently alert; will route to entity drawer/page).
- Real commission agent → sale assignment (currently mock-distributed evenly).
- Saved report templates (user saves common filter combinations).
- Scheduled reports — email PDF on schedule via backend scheduler.
- Per-role profit hiding (cashier).
- Multi-branch comparison view (compare same report side-by-side per branch).
- Inventory turnover, days-of-supply derived metrics.


---

# Task 12 — SMS Module (frontend only)

The SMS module is fully built on the frontend with mock data and a single Zustand store
(`pos-sms`). User chose to defer real wiring; this section captures everything backend
must implement when it's switched on.

## Routes
```
/sms                 — landing dashboard
/sms/send            — send (single / group / manual)
/sms/templates       — templates CRUD
/sms/groups          — groups CRUD
/sms/history         — sent / delivered / failed log
/sms/gateway         — provider setup
/sms/buy             — credit top-up
```

## Schema

### Templates
```ts
sms_templates (
  id PK,
  name TEXT NOT NULL,
  category ENUM(sale|payment|reminder|promotion|greeting|other),
  body TEXT NOT NULL,                  -- supports {variable} placeholders
  language ENUM(en|bn) DEFAULT 'en',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```
Variable catalog: `{shop_name}`, `{customer_name}`, `{phone}`, `{invoice_no}`,
`{amount}`, `{due}`, `{date}`, `{branch}`, `{discount}`. Backend MUST resolve these
against the actual context at send time (not at template-save time).

### Groups
```ts
sms_groups (
  id PK,
  name TEXT NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP
)
sms_group_members (
  group_id FK,
  customer_id FK,                      -- one of customer_id OR manual_phone
  manual_phone TEXT NULL,
  PRIMARY KEY (group_id, customer_id, manual_phone)
)
```
Auto-built groups (e.g. "All Retail Customers", "Customers with Due") should be
materialized views or stored queries that re-evaluate on send. The frontend currently
treats them as static seed groups.

### History
```ts
sms_history (
  id PK,
  to_name TEXT NULL,
  to_phone TEXT NOT NULL,
  body TEXT NOT NULL,                  -- final personalized body, not template ref
  template_id FK NULL,
  group_id FK NULL,
  status ENUM(queued|sent|delivered|failed),
  cost DECIMAL(8,4),                   -- in BDT
  parts INT,                           -- 1 per 160 GSM-7 / 70 Unicode chars
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP NULL,
  by_user_id FK,
  error_reason TEXT NULL,
  provider_message_id TEXT NULL,       -- for DLR matching
  retried_from_id FK NULL              -- if this is a retry of a failed send
)
```

### Gateway settings
```ts
sms_gateway (
  shop_id PK,                          -- singleton
  provider ENUM(none|ssl-wireless|bulksmsbd|zaman-it|banglatrac|custom),
  api_user TEXT NULL,
  api_key TEXT NULL,                   -- stored encrypted in OS keychain
  sender_id TEXT NULL,                 -- BTRC pre-approved alphabetic ID, max 11 chars
  api_url TEXT NULL,                   -- only for custom provider
  default_language ENUM(en|bn) DEFAULT 'en',
  unicode_mode ENUM(auto|always|never) DEFAULT 'auto',
  max_parts_per_message INT DEFAULT 3,
  test_phone_number TEXT NULL,
  send_on_sale BOOLEAN DEFAULT FALSE,
  send_on_payment BOOLEAN DEFAULT FALSE,
  send_on_due BOOLEAN DEFAULT FALSE,
  send_on_birthday BOOLEAN DEFAULT FALSE,
  connected BOOLEAN DEFAULT FALSE,
  last_tested_at TIMESTAMP NULL,
  updated_at TIMESTAMP
)
```
**Critical**: API key is sensitive. Backend MUST store via OS keychain
(`safeStorage` in Electron / Keychain on macOS / Credential Manager on Windows). Never
plaintext to disk.

### Credit
```ts
sms_credit (
  shop_id PK,
  balance DECIMAL(12,4) DEFAULT 0,
  sms_rate DECIMAL(8,4) DEFAULT 0.40,  -- BDT per 1-part SMS
  total_purchased DECIMAL(12,4) DEFAULT 0,
  total_spent DECIMAL(12,4) DEFAULT 0
)
sms_credit_transactions (
  id PK,
  shop_id FK,
  delta DECIMAL(12,4),                 -- + on purchase, − on send
  reason TEXT,                         -- "topup-bkash", "send-sms", etc.
  reference TEXT NULL,
  at TIMESTAMP
)
```
Each send debits `balance` by `parts × sms_rate`. Each purchase credits.
Reconciliation: at any time `balance == total_purchased − total_spent`.

## Provider adapters
Pattern: each provider is an adapter implementing:
```ts
interface SmsProviderAdapter {
  send(opts: { to: string; body: string; senderId: string }): Promise<{
    providerMessageId: string;
    cost?: number;
    parts: number;
  }>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
  receiveDeliveryReport(payload: unknown): { providerMessageId: string; status: SmsStatus };
}
```
Adapters to implement initially:
- **SSL Wireless** — `https://sms.sslwireless.com/pushapi/dynamic/server.php`
- **BulkSMSBD** — `https://bulksmsbd.net/api/smsapi`
- **Zaman IT** — `https://www.smsinbd.com/smsapi`
- **BanglaTrac** — `https://api.mobireach.com.bd/SendTextMessage`
- **Custom HTTP** — generic POST adapter using user-provided URL + body template

## Helpers (already in `src/stores/sms.ts`)
- `estimateParts(body, unicode)` — char-count → parts (160 GSM-7 / 70 Unicode for first
  part, 153/67 for concatenated parts).
- `isUnicode(body)` — detect non-ASCII chars (Bangla characters force Unicode mode).
- `renderTemplate(body, ctx)` — replace `{variables}` with context values.

Backend should mirror this logic to ensure quoted cost matches actual cost.

## Send pipeline
```
[user clicks Send]
  → validate balance, parts ≤ max, body present, recipients ≥ 1
  → for each recipient:
       resolve template variables with per-recipient context
       call provider.send(...)
       insert sms_history row (status='sent')
       deduct credit balance
  → return summary { sent, queued, failed }
```

## Delivery Report (DLR) handling
Most BD providers POST a webhook when delivery state changes. Backend exposes:
```
POST /api/sms/dlr/:provider
  body: provider-specific payload
  → adapter.receiveDeliveryReport(payload) → { providerMessageId, status }
  → UPDATE sms_history SET status = ?, delivered_at = NOW() WHERE provider_message_id = ?
```

For the Electron app (no public webhook), provider polling is the fallback: every 60s
ask the provider for status of recent `status='sent'` rows.

## Auto-send triggers
Cron-like jobs in Electron main:
- **on-sale** — listen to `sales.create` event; if `send_on_sale` enabled, render the
  default `sale` template and send. Skip if customer has no phone or opted out.
- **on-payment** — listen to `sales.payment` and `purchases.payment`; render `payment`
  template; send.
- **on-due (weekly reminder)** — Monday 09:00 local time; query customers with
  `due > 0`; send `reminder` template; respect `last_reminder_sent_at` (no more than
  one per week).
- **on-birthday** — daily 09:00 local time; query customers whose `dob` falls today;
  send `greeting` template.

All triggers must:
1. Check `send_on_X` toggle before doing anything.
2. Check shop-level rate limit (BTRC allows roughly 10 SMS/sec per sender ID).
3. Check 9pm-9am quiet hours for promotions.
4. Skip if `customer.opted_out_of_sms == true` (add this column on `customers` table).

## Customer opt-out
New column on `customers`:
```
opted_out_of_sms BOOLEAN DEFAULT FALSE
opt_out_reason TEXT NULL
opt_out_at TIMESTAMP NULL
```
Frontend: add a toggle in Customer detail edit drawer. Auto-set `opted_out_of_sms=true`
if any send returns "user replied STOP" reply (provider-dependent).

## Cost formula
```
total_cost = recipients × parts × sms_rate
```
Where `parts` is computed at send time using the rendered body (after variable
substitution, since variables can change part count).

## Permissions
- `sms.send` — manager+ can send (cashier blocked for now).
- `sms.templates` — manager+ can edit templates.
- `sms.gateway` — owner only.
- `sms.history` — manager+ to view; cashier sees only own sends.
- `sms.buy` — owner only.

## Pending
- Real BD provider HTTP integrations (currently mock; `testGateway` simulates 600ms).
- Webhook receiver for delivery reports.
- Auto-send job runner.
- Real payment gateway for credit top-ups (currently calls `buyCredit()` directly).
- BTRC quiet-hours compliance.
- Sender ID approval workflow tracking.
- Per-customer opt-out column + UI toggle.
- Group rules engine (auto-grouping based on filters: due > 0, group = X, etc.).


---

# Task 14 — Global Polish

Mostly frontend primitives — minimal backend impact. Notable points:

## Toast system
- `src/stores/toast.ts` — Zustand store + imperative `toast.*` API usable anywhere
  (including non-React code like IPC handlers later).
- `toast.promise(p, { loading, success, error })` for async ops — wire backend mutations
  through this for instant feedback.
- Backend mutations (sale save, payment, etc.) should resolve/reject so the UI can show
  success/error toasts. No persistence needed for toasts.

## Confirmation dialog
- `src/stores/confirm.ts` — promise-based `confirm()`; mounted once via `ConfirmDialog`
  in AppShell. Replaces native `window.confirm`. Destructive actions pass
  `variant: 'destructive'`.
- For permission-gated destructive actions, backend still must enforce; the dialog is UX
  only.

## Error boundary
- `src/components/ui/ErrorBoundary.tsx` wraps the main content area. In production it
  should log caught errors to a local crash log file (`userData/logs/crash.log`) and
  optionally to the cloud when sync is on. Currently `console.error` only.

## Command palette
- `src/components/layout/CommandPalette.tsx` — Ctrl+Shift+P. Static action registry today.
- Future: merge in dynamic results (recent customers, products by name) from the same
  `globalSearch()` IPC that the titlebar search will use. Add "recent commands" persisted
  per user.

## Print preview
- `src/components/ui/PrintFrame.tsx` + print stylesheet in globals.css. Uses
  `window.print()`. For thermal printers, backend ESC/POS rendering is separate (see
  Task 3 / Task 13 receipt notes) — PrintFrame is for browser/PDF/A4 printing.

## Density + appearance
- Density (`compact`/`comfortable`) lives in `pos-ui` (Zustand persist) and is toggled
  from the titlebar + command palette + Appearance settings. All three write the same
  store value. Per-user persistence moves to DB later (already noted in Task 13).

## Motion
- Tailwind keyframes added: scale-in (modals), slide-in (drawers), toast-in, shimmer
  (skeletons), fade-in. No backend impact.
- TODO: respect `prefers-reduced-motion` — gate animations behind a media query.

## alert()/confirm() migration
- SMS + Settings modules fully migrated to toast + confirm dialog.
- Remaining older modules (Sales/Purchases/Products/Stock/Contacts/Cash/Expenses) still
  use some native `alert`/`confirm` — mechanical sweep pending. Not a backend concern.


---

# Task 15 — Login & First Run

Frontend auth scaffolding with mock credential checks. Backend replaces the credential
comparison and adds real sessions.

## Auth store (`src/stores/auth.ts`)
Persisted fields: `setupComplete`, `currentUserId`, `locked`, `autoLockMinutes`.
Phases resolved in `AuthGate`:
```
!setupComplete            → first-run  (FirstRunWizard)
setupComplete & no user   → logged-out (LoginPage)
user & locked             → locked     (LockScreen)
user & !locked            → active     (app)
```

## Credential checks (MOCK — replace)
- `loginWithPin(userId, pin)` — compares `user.pin` in plaintext.
- `loginWithPassword(username, password)` — accepts the user's PIN as password OR the dev
  password `admin123`.
- `unlockWithPin(pin)` — same plaintext compare against the current user.

Backend MUST:
- Store `pin_hash` and `password_hash` (bcrypt, cost ≥ 10) — never plaintext (see Task 13
  users schema).
- Verify hashes server-side (Electron main) and return only a session token to the
  renderer.
- Update `last_login_at` on success (frontend already calls `updateUser`).

## Session
- Frontend "session" is just `currentUserId` in localStorage. Replace with a signed
  session token in OS keychain + in-memory; expire on logout/lock/timeout.
- Permission checks: every IPC handler resolves the calling user from the session and
  enforces the permission catalog (Task 13). Frontend gating is UX only.

## Idle auto-lock
- `AuthGate` listens to mousemove/keydown/etc. and resets a timer; locks after
  `autoLockMinutes` of inactivity (0 = never). Configurable in Settings → Users.
- Backend can additionally force-lock on system sleep/resume (Electron `powerMonitor`).

## First-Run Wizard
- Writes directly to the existing stores:
  - `useSettings.setBusiness(...)` — name, tagline, phone, address, currency, default branch
  - `useSettings.updateTaxRate(...)` — sets the chosen default tax rate
  - `useBranches.update(seedBranch, ...)` — renames the first seed branch as the main/default
  - `useUsers.updateUser('u_admin', ...)` — repurposes the seed admin as the owner (name,
    username, pin, active)
  - `useSettings.addPrinter(...)` — optional printer
  - `useSettings.setBackup(...)` — optional cloud enable
  - `useAuth.completeSetup(adminUserId)` — flips `setupComplete`, logs admin in
- Backend first-run should run inside a transaction; if any step fails, roll back so the
  wizard can retry cleanly. Consider an optional "seed sample data" vs "start clean"
  choice (frontend currently keeps existing mock seeds).

## Forgot password (offline)
- Currently shows static help text: owner resets PINs from Settings → Users; restore from
  backup if owner is locked out.
- Backend: generate a one-time offline reset code derived from the license key +
  install ID, redeemable on the login screen. Document the algorithm separately.

## Reset / dev
- `useAuth.resetAll()` clears setup + session (returns to first-run). Useful for QA. Not
  exposed in the UI — call from devtools (`useAuth.getState().resetAll()`) to re-trigger
  the wizard.

## Pending
- bcrypt hashing + server-side verification.
- Session token + IPC permission enforcement.
- Failed-attempt throttling / lockout after N wrong PINs.
- Secure offline reset code.
- Remember-last-user + quick switch-user screen.
- Force-lock on OS sleep.


---

# Backend Phase — Part 2: Wiring (in progress)

## What's wired so far (infrastructure)

The backend (Part 1) is now connected to Electron and reachable from the renderer:

- **Bundler-safe schema**: `backend/db/schema.ts` exports `SCHEMA_SQL` + `FTS_SQL` as
  strings; `connection.ts` uses them (no `fs`/`__dirname` reads that break after
  bundling). `schema.sql` / `fts.sql` kept for reference + external tooling.
- **Read-side queries**: `backend/services/queries.ts` — list/detail getters for every
  module (products, sales, purchases, returns, customers, suppliers, expenses, transfers,
  adjustments, shifts, master data) + `globalSearch` over FTS5.
- **API facade**: `backend/api.ts` exposes a flat `channel -> handler(db, payload)` map
  (`buildApi()`), 63 channels. Transport-agnostic so tests call it directly.
- **Electron DB lifecycle**: `electron/db.ts` — opens `userData/pos.db`, migrates,
  seeds on first run. Seed mode via `POS_SEED` env: `demo` (full synthetic year, default
  in dev), `clean` (master data only → first-run wizard), `none` (empty). Packaged
  default is `clean`.
- **IPC bridge**: `electron/ipc.ts` registers one generic `api:invoke` channel that
  forwards to `buildApi()`, returning `{ ok, data }` / `{ ok, error }` so the renderer
  never crashes on a backend error. `api:channels` lists available channels.
- **preload**: exposes `window.api.db.invoke(channel, payload)` + `.channels()`.
- **Renderer client**: `src/lib/api.ts` — `api(channel, payload)` throws `ApiError` on
  failure; `apiSafe` swallows; `hasBackend()` guards browser-only dev.
- **Vite**: main-process bundle externalizes `better-sqlite3` (native, loaded via require).

## Native module ABI — IMPORTANT

`better-sqlite3` is native and ABI-specific:
- **Plain Node** (verification harness, CI) needs the Node ABI build.
- **Electron** needs the Electron ABI build (Electron bundles its own Node).

Scripts manage the switch:
- `npm run rebuild:electron` → `electron-rebuild` (run before `npm run dev` / packaging).
  `npm run dev` does this automatically.
- `npm run rebuild:node` → `npm rebuild better-sqlite3` (run before tests).
  `backend:verify` / `backend:verify:all` do this automatically.

Confirmed working on BOTH ABIs:
- Node ABI: 122 verification checks pass (`backend:verify:all`).
- Electron ABI: headless smoke confirmed sqlite 3.53.1 + read/write + FTS5 load in-process.

At packaging time, `electron-builder` must rebuild native deps for the target
(`npmRebuild: true` or a `beforeBuild` hook); document in the packaging task.

## Next slices (store-by-store swap)

Replace each Zustand mock store with TanStack Query hooks calling `api()`:
1. Products + Stock (read-heavy, good first slice)
2. Purchases
3. Sales (+ POS later)
4. Contacts (customers/suppliers + ledgers)
5. Cash register
6. Expenses
7. Dashboard
8. Reports
9. Settings (business, branches, users, roles, tax, schemes)

Each slice: wire reads first (lists/detail), then writes (create/update/void), verify the
screen against the seeded demo data, then move on. Auth + permissions enforced at the IPC
boundary in a later slice.
