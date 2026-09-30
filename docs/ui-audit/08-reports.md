# Findings — Reports (hub, shared shell, 16 report pages)

Scope: `/reports` hub, the shared report shell (`ReportToolbar` + `useReport`), and every page in
`src/pages/reports/`. Screenshots viewed: 41, 42, 44, 45, 46, 52 (English, dark). Other pages judged from code.

---

## 1. Reports hub

### Reports hub — `/reports` (screenshot 41)
**Purpose:** pick a report.

**What the owner will really use (lead with these, in this order):**
1. **Money collected today** — Sell Payment (`/reports/sell-payment`, open with preset `today`): cash vs bKash vs card vs "on credit" for the day. This is the end-of-day question.
2. **Profit this month** — Profit / Loss (`/reports/profit-loss`, default `thisMonth` already).
3. **Low stock / what to reorder** — Stock Alert (`/reports/stock-alert`).
4. **Who owes me / whom I owe** — Customer / Supplier (`/reports/contacts`).
5. **Best sellers** — Product Sell (sorted by revenue; see §3 for folding Trending into it).

Everything else (Sales rep, Customer group, Product purchase, Purchase payment, Tax, Stock adjustment, Stock transfers, Items, Activity log) is occasional or accountant work and should sit below, collapsed.

**Works well:**
- Whole tile is the link (≈80px tall, full card), so the targets are large.
- Every tile has a one-line plain description.
- Grouping by topic exists; only the ordering and weight are wrong.

**Problems:**
1. [High] Reports is not in the sidebar. It is reachable only through "More & Settings" (`src/components/layout/MoreMenu.tsx:35`), a menu whose label says *settings*. The owner who checks profit daily has to know it is hidden there. Fix: add a "Reports" item to the sidebar below Cash Register (same icon `TrendingUp`), and keep the More-menu entry.
2. [High] 17 tiles, all the same size and weight, in six groups; nothing tells the owner where to start, and at 1366×768 the last row (Customer / Supplier, Items) is below the fold — Customer / Supplier is one of the five he needs (screenshot 41, bottom cut at "Stock"). Fix: a first section "Most used" with the five reports above as larger tiles (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, `p-5`, title `text-base font-semibold`, desc `text-sm`), then a `<details>`/toggle "All reports" that holds the remaining groups (open state remembered in localStorage). Optional, frontend-only: show one live figure on each lead tile from the channel the report already calls (e.g. `reports.profitLoss` → "Net profit this month ৳3,48,968"), which turns the hub into a one-glance summary.
3. [Med] "Stock Transfers — Inter-branch movements" (Reports.tsx:52) is shown to a shop with ONE branch. Fix: filter the tile out when `useBranches().items.length <= 1`.
4. [Med] Duplicate/overlapping tiles: "Register Report" (Reports.tsx:39) is the Cash Register page already in the sidebar (`/cash-register/report`); "Trending Products" overlaps "Product Sell Report"; "Items Report — Catalog snapshot" overlaps "Stock Report — Current stock + value"; "Tax Report" repeats the Tax breakdown card on Profit / Loss. Fix: drop Register Report from the hub; move Items, Tax, Trending into the collapsed "All reports" (merges proposed in §3).
5. [Med] Group headings are `text-[11px] uppercase font-semibold tracking-[0.06em]` muted (Reports.tsx:95), 14px caps that read as noise and mean nothing in Bangla. Fix: `text-sm font-semibold text-foreground` sentence case, icon `size-4`.
6. [Med] Two groups hold a single tile each — "People" (Customer / Supplier) and "Operations" (Items Report) (Reports.tsx:55-58, :72-73) — each costs a heading row. Fix: Customer / Supplier goes to "Most used"; Items goes into Stock; delete the `people` and `ops` groups.
7. [Low] Titles repeat "Report" on a page titled Reports and use internal words ("Sell Payment Report", "Product Sell Report", "Stock Alert"). Plain-language titles: "Money collected", "Sales by product", "Best sellers", "Low stock", "Customer & supplier balances", "Money paid to suppliers", "Purchases by product". Needs new keys in `src/lib/bn/dict.ts` (same text must be used as the ReportToolbar `title` so hub and page match).
8. [Low] Six icon colours (`tones`, Reports.tsx:62-68) with no meaning — Sales Rep orange, Trending purple, Tax orange. Fix: one neutral icon chip (`bg-secondary text-foreground`) for all; keep `warning` only for Low stock.
9. [Low] Subtitle "Insights into sales, stock, money, and people" (Reports.tsx:84) says nothing. Fix: drop it, or "Most-used reports are at the top."

**Remove / merge:** Register Report tile (lives under Cash Register); Stock Transfers tile when one branch; "People" and "Operations" group headings; tile colour variety; the subtitle.
**Resize:** group heading `text-[11px] uppercase` → `text-sm font-semibold`; lead tiles `p-4` → `p-5`, title `text-sm` → `text-base`, desc `text-xs` → `text-sm`; other tiles unchanged (title 16px / desc 14px are already on-standard).
**Popups on this screen:** none.
**Bangla:** Bangla screenshot not viewed (scope limit). From code: all titles/descriptions have dict entries (e.g. `Reports` → "হিসাব", `Register Report` → "ক্যাশ রিপোর্ট"); `uppercase` on group labels has no effect in Bangla, so the headings become 14px muted words that barely stand out — another reason for fix 5. New plain-language titles (fix 7) need dict entries or they will stay English.

---

## 2. The shared report shell

### Report shell — `ReportToolbar` + `useReport` + the per-page KPI/table copies (screenshots 42, 44)
**Purpose:** the frame every report sits in: back link, title, print, date range, filters, KPI chips, table.

Facts from code: all 16 pages render `<ReportToolbar>` and all 16 pass `onBranchChange`; none passes `onExportExcel`/`onExportPDF`/`onPrint`, so the only export anywhere is Print → `window.print()`. KPI chips and tables are NOT shared: 11 pages define their own local `Kpi`/`KpiCard`/`Stat`, and tables are hand-built CSS-grid `<div>`s with copied header classes. So the shell fixes below must include extracting two components (`ReportKpi`, `ReportTable`) or the per-page fixes in §3 have to be done 16 times.

**Works well:**
- Date presets match the backend exactly (`resolveRange` mirrors `backend/core/dates.ts`; BD week starts Saturday; reversed custom dates are swapped rather than showing "nothing sold").
- The resolved range is always spelled out ("01 Sept 2026 – 30 Sept 2026") and survives printing; chrome is `print:hidden`, and dead Excel/PDF buttons were already removed.
- `useReport` is last-write-wins and never shows fabricated numbers on error.

**Problems:**
1. [High] Branch picker on every report for a one-branch shop: "🏢 Branch [All branches ▾]" (ReportToolbar.tsx:233-252; screenshots 42, 44). It is a meaningless choice and costs ~200px of the filter row, which is what pushes page filters onto a second line. Fix, once in the toolbar: render the divider + label + select only when `branches.length > 1`; otherwise render nothing (pages keep passing the prop).
2. [High] Filter controls are 28px, 14px: presets `px-2.5 h-7 text-xs` (:199, :214), custom date inputs `h-7 text-xs` (:231, :239), branch select `h-7 text-xs` (:240), and page filters copy the same (`ProductSellPage.tsx:164` etc.). Fix: presets as one segmented group `h-10 px-3 text-sm font-medium` (joined borders, active = `bg-primary text-primary-foreground`, not the faint `bg-primary/10` outline which is hard to spot in screenshot 42); date inputs `h-10 px-3 text-sm`; publish a `ReportSelect` (`h-10 text-sm`) for page filters.
3. [High] At 1366×768 the data starts at ~y=450 and Product Sell shows only 4 rows (screenshot 44): header bar (≈85px) + filter Card (≈90px, two rows) + KPI row (≈86px) + a separate search Card (≈62px, ProductSellPage.tsx:185-195) + table header (≈60px, "MARGIN ON SALES" wraps). Fix: (a) drop the filter Card wrapper — presets sit directly under the title in the header bar; (b) add a `search` slot to `ReportToolbar` so search joins the page filters on the same row (removes every per-page search Card); (c) KPI cards `p-4` → `px-4 py-3`; (d) single-line headers (see 7). Target: first table row at ≤ y=330.
4. [Med] The resolved range is `text-[11px] text-muted-foreground` pushed with `ml-auto` (:269-271), so it wraps onto its own line (screenshots 42, 44 bottom-right of the filter card) and is the smallest text on the page though it answers "what am I looking at". Also formatted with `toLocaleDateString('en-GB', {month:'short'})` (:152), so "Sept" stays English in Bangla mode (the node is not in the dict). Fix: move it into the header subtitle slot as `text-sm text-foreground` using numeric `dd/mm/yyyy – dd/mm/yyyy` (legible in both languages); page subtitles that only repeat KPI numbers are dropped (see 6).
5. [Med] Print is `Button size="sm"` (h-7) (:176-178) and prints without the shop name or a title block — the paper shows the report title and range but not whose shop. Fix: `size="md"`; add a `hidden print:block` line above the body: shop name · report title · range · "Printed dd/mm/yyyy hh:mm".
6. [Med] The same number is shown three times. Product Sell: subtitle "18 products · 1,915 units sold" (ProductSellPage.tsx:157) = KPI "Products sold 18" + "Units sold 1,915" = table Total row (screenshot 44). Profit / Loss: "Money in − Money out" header totals + the formula card repeat Net profit. Rule for the shell: KPI row holds the headline numbers (max 4, first = the answer); the table's total row stays (it is what prints); subtitles never repeat KPI numbers. These interpolated subtitles are also untranslatable (stay English in Bangla): ProductSell:157, ProductPurchase:127, StockReport:153, Trending:111.
7. [Med] Table styling (every page; ProductSellPage.tsx:196-265 as the model): header `text-[10px] uppercase font-semibold tracking-[0.06em]` (13px caps) incl. the sort buttons (:313); built from `div` grids, so no `<th>` semantics and no sticky header on long lists; SKU sub-line `text-[11px] font-mono` (:221); every Profit cell green and every Margin cell coloured by thresholds 20/10 (:233-248), so on normal data the whole column is orange (screenshot 44: 19.0, 17.6, 19.6, 16.3). Fix: shared `ReportTable` = real `<table>`, `thead sticky top-0 bg-card`, `th text-xs font-medium text-muted-foreground` normal case single line, `td text-sm py-3`, money `text-right tabular`, bold `tfoot` total row; sub-lines `text-xs` (not mono); money cells in foreground colour, red only when negative.
8. [Med] KPI chips (P&L `KpiCard` ProfitLossPage.tsx:248-296; Product Sell `Kpi` :279-302; 9 more copies): label `text-[10px] uppercase tracking` muted; each card a different colour (screenshot 42: green, indigo, white, orange, each with a coloured `border-l-4`); P&L adds a `TrendingUp` icon whenever value ≥ 0 (:271), so "Total expenses" wears an orange up-arrow that reads "expenses are rising" — the icon compares to nothing. Fix: one `ReportKpi` in `src/components/reports/`: label `text-xs font-medium` sentence case, value `text-xl font-semibold tabular` (hero variant `text-2xl`), neutral border; colour only for money-state (profit ≥ 0 green / < 0 red, dues red); no trend icons unless there is a real prior-period comparison.
9. [Med] Body width differs from the toolbar: bodies are `max-w-5xl` (P&L:167) or `max-w-6xl` (Product Sell:176) while the toolbar spans the page, so the KPI row ends ~85px short of the filter card on the right (screenshot 42). Fix: one width for all report bodies (drop `max-w-*`, or apply the same `max-w-6xl` to the toolbar).
10. [Med] Loading / error / empty is re-implemented per page and inconsistent. P&L shows the text "Loading…" above KPI cards that already display "৳0.00" (EMPTY_PNL, P&L:58-73, :168-176), so zeros flash as if real. Error copy "Couldn’t load — backend error. Check connection and retry." is developer wording with no retry control, and `useReport` also toasts the same error (useReport.ts:73-76) — two messages, zero actions. Fix: add `reload()` to `useReport` (bump a counter in deps) and a shared `<ReportState loading error empty onRetry>`; KPI values show a skeleton while `loading && !data`; error text "This report could not be loaded." + `Button size="md"` "Try again"; drop the toast when the page shows the inline error; empty "No sales in this period. Try another date range."
11. [Low] Labels "📅 Date" and "🏢 Branch" (:187-189, :235-237) are muted 14px with 14px icons, and the Custom button silently sets from=to=today and reveals two small native inputs joined by "→" (:204-244). Fix: drop the "Date" label (the presets explain themselves); when Custom is active show "From [ ] To [ ]" with visible labels.

**Remove / merge:** branch picker when one branch; the filter Card wrapper; per-page search Cards (→ toolbar slot); trend icons on KPIs; subtitle stats that repeat KPIs; the `useReport` error toast when the page shows its own error; 11 local `Kpi` copies → `ReportKpi`; hand-built grid tables → `ReportTable`.
**Resize:** presets `h-7 text-xs` → `h-10 text-sm`; date inputs/branch/page selects `h-7 text-xs` → `h-10 text-sm`; Print `size="sm"` → `md`; range `text-[11px]` → `text-sm`; KPI label `text-[10px] uppercase` → `text-xs font-medium`; KPI value `text-lg font-bold` → `text-xl font-semibold`; th `text-[10px] uppercase` → `text-xs font-medium`; SKU `text-[11px] font-mono` → `text-xs`; row `py-2.5` → `py-3`.
**Popups on this screen:** none in the shell (native `<select>`/date pickers only).
**Bangla:** preset labels all have dict entries (Today "আজ", Yesterday "গতকাল", This month "এই মাস"…). Stays English: the resolved range ("Sept"), and every interpolated subtitle listed in problem 6. Bangla screenshots not viewed (scope limit); the 7 presets at `h-10 text-sm` need ≈700px — they fit at 1366 once the branch picker is gone, which is another reason for problem 1.

---

## 3. Per-report notes (only what differs from the shell)

### Profit / Loss — `/reports/profit-loss` (screenshot 42) · `ProfitLossPage.tsx`
- [High] "Stock adjustments (loss) ৳ -0.00" (screenshot 42, Money out row 4): `amount: -pnl.stockAdjustment` (:141) turns 0 into −0. Fix: `amount: pnl.stockAdjustment ? -pnl.stockAdjustment : 0`.
- [High] Developer notes on the owner's screen: "Opening stock / Closing stock … No stock-valuation snapshot yet — excluded from the total" with "—" (:125-129, :142-146), "Purchase returns (cash back, not profit)" whose money sits in the grey hint while the amount column shows "—" (:119-123), and the whole "How net profit is calculated" card with `font-mono text-[12px]` and "nightly job pending" (:199-219). Fix: delete the two stock-snapshot rows until the data exists; delete the formula card; show one line under the Net profit KPI: "Sales & income ৳27,33,171 − Costs ৳23,84,203" (`text-xs`); hide rows whose amount is 0 (Sell shipping, Other charges) behind "Show all lines".
- [Med] "Money in / Money out" (Bangla "যা এসেছে / যা গেছে") reads as cash in the drawer, but it includes credit sales. Rename "Sales & income" / "Costs" (dict "আয়" / "খরচ"). Drop the "Total expenses" KPI (it is row 3 of Costs); keep Net profit (hero, `text-2xl`), Gross profit, Margin on sales.
- [Med] Same range, different sales total: P&L "Total sales" ৳27,33,171.40 / gross profit ৳5,31,791.31 vs Product Sell "Revenue" ৳27,36,811.40 / "Profit" ৳5,39,690.31 (screenshots 42 vs 44). Not verified why (likely invoice-level discount or returns). The owner will see two "sales this month" figures; label the Product Sell one for what it is (e.g. "Sales before invoice discounts") once the cause is confirmed.
- [Low] "Tax breakdown" card (:221-236) repeats the Tax report and uses `text-[10px] uppercase` MiniRow labels (:360). Collapse it into a "VAT" line with a link "Open tax report".

### Sell Payment — `/reports/sell-payment` (screenshot 45) · `SellPaymentPage.tsx`
- [High] The "Credit ৳0.00 · 0 pmts" card (hard-coded `allMethods`, :160, :182-208) is always shown; `Credit` translates to "বাকি" (dict.ts:243), so in Bangla it reads "Due ৳0.00" — as if nothing was sold on credit this month. Fix: render only methods with `count > 0` (the six-card grid then shrinks to what the shop actually uses); never show a "Credit" payment card. Also "Cash" → "নগদ" sits next to the brand "Nagad" (untranslated), which in Bangla is also written নগদ — label the brand "Nagad (নগদ ওয়ালেট)" or keep the Latin "Nagad" deliberately via a dict entry.
- [Med] Default range is This month, but the owner's question here is "what came in today". Fix: default `{ preset: 'today' }` on this page (or accept `?preset=` from the hub tile).
- [Med] Amount (right-aligned) is immediately followed by left-aligned Cashier, so the numbers touch the names ("৳ 879.80 Rana Ahmed", screenshot 45). Fix: make Amount the last column; merge Reference as a `text-xs` sub-line under Method (it is "—" for cash) and drop the Reference column → 6 columns. Invoice `font-mono` → normal `text-sm`.
- [Med] Card footers `text-[10px]` "162 pmts · 65.8%" (:200-203) with an untranslatable abbreviation; the 4px progress bar is decoration. Fix: `text-xs` "162 payments", keep %, drop the bar. Time `text-[11px]` (:245) → same `text-sm` as the date; date via the shared numeric formatter (the "Sept" month stays English).
- [Low] Subtitle "279 payments · ৳27,22,151.65 total" (:166) repeats the footer Total and is untranslatable; the truncation banner (:228-233) is an interpolated sentence. Drop the subtitle; rephrase the banner as label + number ("Showing latest: 500 of 1,240").

### Trending — `/reports/trending` (screenshot 46) · `TrendingPage.tsx`
- [High] "Prior: 0 → ↗100%" (Brick 1st Class, Safety Helmet, Cement; screenshot 46) — growth from nothing is shown as +100%, and "Prior: 12 → 1583%" is shown in the same small green as "+19%". Fix: when `previous === 0` show a "New" badge instead of a %; state what "prior" means once in the header ("Compared with 01/08/2026 – 31/08/2026").
- [Med] Up to 50 cards of ≈165px (3 per row, 9 per screen) for what is a ranked list; not printable as a list. Fix: fold into Product Sell as a "Compare with previous period" toggle that adds Previous + Change columns (removes one hub tile), or render here as a `ReportTable` (Rank · Product · Units/Revenue · Previous · Change) at 44px rows.
- [Med] The Units/Revenue toggle is `h-6 px-2 text-xs` inside a `p-0.5` pill (:136-150), 24px and hard to see which is active (screenshot 46). → segmented `h-10 text-sm` like the date presets.
- [Low] Remove decoration: `Sparkline` always returns null (trend14 is all zeros, :98, :199-215); Flame icon on the top 3 (:170). Resize: SKU·category `text-[11px] font-mono` (truncates "Building Materi…") → `text-xs`; "UNITS" `text-[10px] uppercase` (:178) → `text-xs`; Prior/delta `text-[11px]` (:185, :224-235) → `text-sm`. Subtitle (:111) is interpolated English.

### Stock — `/reports/stock` (screenshot 52) · `StockReportPage.tsx`
- [High] The date presets do nothing: `reports.stock` takes only `{ branchId }` (:69-77, comment "mostly UI for now"), yet "Today" is highlighted and the card says "30 Sept 2026 – 30 Sept 2026" (screenshot 52). The owner clicking "Last month" expects last month's stock and gets today's. Same on Stock Alert, Items and Customer / Supplier (all range-independent, see below). Fix in the shell: make `range`/`onRangeChange` optional on `ReportToolbar`; when absent, hide the presets and show "Stock as of now (30/09/2026 14:30)" in the subtitle.
- [Med] Six KPIs (:201-208) with odd colours: "Value @ cost" orange (warning colour on a neutral figure), "Value @ retail" indigo, "Out 0" red even when zero; "Units 3,539" and the footer units total add pieces, boxes and kg together (screenshot 52: "103 pc", "92 box"). Fix: four KPIs — "Stock value (cost)", "Stock value (sale price)", "Low", "Out" — neutral colour, red only when Out > 0; make Low/Out clickable to set the `stockState` filter; drop Units (KPI and footer) and Products (subtitle already says it). "@" → words (it has no Bangla reading).
- [Med] 8 columns and a green "In" badge on almost every row (:268-271) — noise that hides the few Low/Out rows. Fix: show a badge only for Low/Out (`Badge` at `text-xs`), drop the Brand column (the filter stays) → 7 columns; Reorder as a `text-xs` "reorder at 10" sub-line under Stock.
- [Low] Three raw `h-7 text-xs` selects (:160-193) → `ReportSelect`; category emoji in the cell adds noise, keep it only in the dropdown.

### Stock Alert — `/reports/stock-alert` · `StockAlertReportPage.tsx` (code only)
- [High] Date presets do nothing (range `today`, never sent, :50, :118) — hide them (shell fix under Stock).
- [Med] Duplicates the Stock module's own alerts page; the button "Open in Stock Module" (`size="sm"`, :172-176) sends the owner to the same list. Fix: keep one. If this report stays, its value is the "Suggest" and "Est. cost" columns; rename them "Order qty" / "Order cost" and put the rule in the column tooltip, not in the `text-[11px]` card footnote "to bring all to 2× reorder level" (:152).
- [Med] Counts shown twice: KPI cards "Low stock 3" / "Out of stock 0" (:126-143) and the tabs "Low (3)" / "Out (0)" (:156-170). Fix: the two KPI cards ARE the tabs (click to select, selected = ring); delete the tab strip. The Status column (:237-243) repeats the tab — delete it (6 columns).
- [Low] KPI labels `text-[10px] uppercase`, footnotes `text-[11px]` → `text-xs`; `max-w-5xl` (:124) differs from the other reports.

### Customer / Supplier — `/reports/contacts` · `ContactsReportPage.tsx` (code only)
- [High] Date presets do nothing: figures are lifetime (comment :76-78, `customers.list {}`), yet "This month" is selected. Hide the presets; subtitle "All time, as of today".
- [Med] The owner opens this for "who owes me", but rows sort by total sales (:112, :131). Fix: default sort by Due desc, with an "Only with due" toggle on by default; Due in `text-destructive` when > 0 (the Customers page uses red; here it is orange `text-warning`, :255, :310).
- [Med] Row action is a 14px `ExternalLink` icon with only a `title` (:262-269, :318-325). Fix: whole row links to the khata; if an explicit action is kept, `Button size="md"` "Open khata".
- [Med] Untranslatable/English: mode toggle renders the raw keys `customers`/`suppliers` with CSS `capitalize` (:176-189); subtitle `${n} ${mode} · ${sales} sales` (:161-163); placeholder `Search ${mode}…` (:219). Fix: label map `{customers: 'Customers', suppliers: 'Suppliers'}` and fixed placeholders per mode. Headers "Sales #" / "Bills #" → "Invoices" / "Bills".
- [Low] Drop the "Total" count KPI; KPI order Outstanding first.

### Customer Group — `/reports/customer-group` · `CustomerGroupPage.tsx` (code only)
- [Med] Each group is shown twice: a coloured card per group with net sales, % and a 4px bar (:85-103) and then a table row with the same net sales (:125-135). Fix: keep the table (it prints and has the total row); drop the cards, or keep the cards and drop the table — not both.
- [Med] Mixed periods on one screen: Net sales follow the range, Customers and Outstanding due are lifetime, explained only in a `text-xs` note (:80-83). Fix: move Due out of this report (it is on Customer / Supplier) or label the column "Due (all time)"; delete the note.
- [Low] "Transactions" KPI vs "Sales" column vs "sales" in the card line — one word ("Invoices"). "Avg ticket" → "Average sale". Due in `text-warning` → `text-destructive` if kept. Card sub-lines `text-[11px]` interpolated ("12 sales · avg ৳…", :96-98) stay English.

### Items — `/reports/items` · `ItemsReportPage.tsx` (code only)
- [Med] A catalog list (`products.list {}`) with a date picker that does nothing (range `today`, :61) and 9 columns (:212-224) — above the 7-column limit and a near-copy of the Products list. Fix: hide the presets; cut to 6 columns — Product (SKU·barcode sub-line `text-xs`), Category, Cost, Price "৳520 / pc" (merge Unit), Markup on cost, Sale status (only when not normal) — drop Brand, Tax, and the "Yes" POS badge on every row. Consider removing the tile from the hub (Products already lists this).
- [Low] KPIs "Categories" and "Brands" are counts nobody acts on; drop them. Markup colour thresholds 30/15 (:246-252) paint the column — foreground, red only below 0 or a set floor.

### Product Sell — `/reports/product-sell` (screenshot 44) · `ProductSellPage.tsx`
- Shell issues cover most of it (4 rows above the fold, separate search Card, header wraps "MARGIN ON SALES", subtitle repeats KPIs). Page-specific: all Profit cells green and Margin cells orange on normal data (:233-248; screenshot 44) → foreground, red only when negative; "Products sold 18" KPI → drop (keep Units, Revenue, Profit). Revenue label vs P&L "Total sales" mismatch — see Profit / Loss.
- If Trending is folded in (see Trending), add a "Compare with previous period" toggle that adds Previous + Change columns and hides Category, keeping ≤ 7 columns.

### Product Purchase — `/reports/product-purchase` · `ProductPurchasePage.tsx` (code only)
- [Low] Mirror of Product Sell without sorting (no `SortHeader`), so the list cannot be re-ordered by spend or qty. Reuse the Product Sell table (with sort) through `ReportTable`.
- [Low] "Total spend" KPI orange `tone="warning"` (:151) on a neutral figure → foreground. "Suppliers" column is a comma list at `text-xs` truncated (:195-197) → show the first supplier + "+2" with the full list in `title`. Drop the "Products purchased" KPI (subtitle already says it — then drop the subtitle stats too).

### Purchase Payment — `/reports/purchase-payment` · `PurchasePaymentPage.tsx` (code only)
- [Med] A copy of Sell Payment (same method cards, same 7-column grid, same `text-[10px]` "pmts", same Amount-touches-"By" layout, :174-285). Fix once: extract a shared `PaymentsReport` used by both pages, so every Sell Payment fix above lands here too (show only methods with payments; Amount last; Reference as a sub-line).
- [Low] Placeholder "Search ref, supplier, reference…" says reference twice (:209) → "Search bill no., supplier or transaction ID…". Column "By" → "Paid by". Rows are inert although `purchaseId` is on each row — link the Ref No to the purchase if that route exists (not verified).

### Sales Rep — `/reports/sales-rep` · `SalesRepPage.tsx` (code only)
- [Med] 9 columns (:153-163), two of them empty by design: "Paid" is always "—" (no payout ledger, :198-199) and "Pending" therefore always equals "Commission"; the KPI "Pending payout" repeats "Commission earned". Fix: drop the Paid and Pending columns and the Pending KPI → 7 columns; drop the initials avatar (:180-188); header "%" → "Rate".
- [Low] Developer footnote card `text-[12px]` "There is no payout ledger yet, so Paid shows '—'…" (:226-230) → delete with the columns; keep one `text-xs` line "Commission = net sales × rate".
- [Low] Empty state splits one sentence across three text nodes around a Link ("No commission agents configured." / "Add agents" / "to start tracking.", :119-126) — hard to translate as a sentence. Use a heading "No sales agents yet" + `Button size="md"` "Add sales agent". Hide the hub tile when no agents exist.

### Tax — `/reports/tax` · `TaxReportPage.tsx` (code only)
- [Med] The Sales VAT / Purchase VAT / Combined toggle (:152-167) switches between showing one table, the other, or both — "Combined" already shows everything. Fix: remove the toggle; always show both sections (they are short, one row per rate).
- [Low] Same zero-flash as P&L: "Loading…" text above KPI cards that show ৳0.00 (:91-96). Decorative arrow/calculator icons in KPI headers (:103, :117, :136) → remove. "from N invoices" / "from N bills" `text-[11px]` interpolated (:108-110, :122-124) → `text-xs` "Invoices: N".
- [Low] The "For VAT filing" card (:199-208, `text-[12px]`) is useful plain guidance; keep it at `text-xs`, collapsed under an "About these numbers" disclosure.

### Stock Adjustment — `/reports/stock-adjustment` · `StockAdjustmentReportPage.tsx` (code only)
- [Med] The report never says WHAT was lost: each row shows Date · Ref · Type · "Lines 3" · Net qty · Net value · By (:194-203), and the product lines (`adj.lines`, already loaded) are never shown. Rows have `cursor-pointer` but no `onClick` (:209). Fix: make the row expand (chevron + `aria-expanded`) to list product · qty · value; or replace "Lines" with the first product name + "+2 more".
- [Med] Type is the raw lowercase key: badge `{adj.type}` (:218) and the type cards' `capitalize` label (:180) — "damage"/"theft" do not match dict keys, so they stay English in Bangla. Fix: `TYPE_LABEL = { damage: 'Damage', theft: 'Theft', sample: 'Sample', recount: 'Recount', other: 'Other' }` (same map as the filter options).
- [Low] "By type" cards `text-[10px]` uppercase label and "3 adj · 12 units" (:180-186) → `text-xs` "3 adjustments"; "Net qty" / "units" add different units together (pc + box) — drop the qty totals, keep value. Drop the "Adjustments" count KPI (subtitle already has it — and drop the subtitle stats).

### Stock Transfers — `/reports/stock-transfers` · `StockTransfersReportPage.tsx` (code only)
- [High] The shop has one branch, so this report is always empty ("No transfers in this range."). Fix: hide the hub tile (see hub fix 3) and, if the route is opened directly, show "Transfers need more than one branch." instead of an empty table and four ৳0 KPIs.
- [Low] If kept for multi-branch shops: rows `cursor-pointer` with no action (:193); status badge shows the raw key "in-transit" (:213) → label map; From → To `text-xs` (:204) → `text-sm`.

### Activity Log — `/reports/activity-log` · `ActivityLogPage.tsx` (code only)
- [High] Only the latest 500 events are fetched (`{ limit: 500 }`, :145-149) and the date range is applied client-side (:167), so "This year" / "Last month" silently show a partial or empty list with no warning. Fix (frontend): when `beActivity.length === 500`, show a `text-sm` notice above the list "Showing the latest 500 events. Older events are not listed." and disable presets that start before the oldest fetched event.
- [Med] Raw keys on screen: action filter options `{a}` (:228) and the row verb `{e.action}` (:299) print "created"/"edited" lowercase — not dict keys, so English in Bangla. Use the label from `ACTION_META`. "All entities" (:237) → "All records". Day headings use `toLocaleDateString('en-GB', {weekday:'long'…})` (:180-185) → English weekday/month in Bangla; use the shared date formatter.
- [Med] Row text is 12–14px: message `text-[12px]` (:318), ref chip `text-[11px] font-mono` (:302), amount `text-[11px]` (:306-312), time `text-[11px]` relative only ("3h ago", :319-322). Fix: message `text-sm`, ref/amount/time `text-xs`, and show the clock time ("14:32") — an audit trail needs exact times. Remove the initials avatar on the right (:326-328), it repeats the name that starts the row.
- [Low] Day heading `text-[10px] uppercase` (:285) → `text-sm font-semibold`; body `max-w-4xl` (:250) — a fourth report width.

---

## Cross-cutting patterns seen in this group
- **Branch picker for a one-branch shop** — all 16 pages pass `onBranchChange`. One fix in `ReportToolbar.tsx:233-252`: render only when `branches.length > 1`.
- **Date presets that do nothing** — Stock, Stock Alert, Items, Customer / Supplier ignore `range` (StockReportPage.tsx:69-77, StockAlertReportPage.tsx:50, ItemsReportPage.tsx:61-67, ContactsReportPage.tsx:76-78). Make `range` optional in `ReportToolbar` and show "as of now" / "All time" instead.
- **28px filter controls** — presets, date inputs, branch select in `ReportToolbar.tsx:199-240`, plus 17 hand-copied `<select className="h-7 … text-xs">` across ActivityLog, Items, ProductPurchase, ProductSell, PurchasePayment, SellPayment, StockAdjustment, Stock, StockTransfers, Trending. Publish `ReportSelect` (`h-10 text-sm`) and a segmented `ReportToggle` (also replaces the `h-6`/`h-8` pills in Trending, StockAlert, Contacts, Tax).
- **11 private KPI components** (`Kpi`/`KpiCard` in ContactsReport, CustomerGroup, Items, ProductPurchase, ProductSell, ProfitLoss, SalesRep, StockAdjustment, Stock, StockTransfers; inline cards in StockAlert, Tax, SellPayment, PurchasePayment), all with `text-[10px] uppercase tracking-[0.06em]` labels and arbitrary tone colours. Replace with one `ReportKpi` (label `text-xs`, value `text-xl`, colour only for money-state).
- **Hand-built grid tables** — every page; header `text-[10px] uppercase`, SKU `text-[11px] font-mono`, no `<th>`, no sticky header, cells coloured green/orange by default. One `ReportTable` (`<table>`, sticky `thead`, `text-xs` headers, `text-sm py-3` cells, `tfoot` total, red only for negatives).
- **Separate search Card on 9 pages** (ActivityLog, Contacts, Items, ProductPurchase, ProductSell, PurchasePayment, SalesRep, SellPayment, StockAlert, Stock) — ≈62px each. Add a `search` slot to `ReportToolbar`.
- **Same number shown 2–3 times** — interpolated subtitles repeat KPIs and totals (ProductSell:157, ProductPurchase:127, SellPayment:166, PurchasePayment:151, Stock:153, StockAlert:115, StockAdjustment:126, StockTransfers:117, CustomerGroup:66, Contacts:161, SalesRep:111, ActivityLog:193). They are also untranslatable. Drop subtitle stats; the toolbar subtitle becomes the date range.
- **Raw keys and en-GB dates on screen** — `capitalize` on raw keys (Contacts mode, StockAdjustment type, Tax mode), raw action/status keys (ActivityLog, StockTransfers), `toLocaleDateString('en-GB', {month:'short'})` in ReportToolbar:152, SellPayment:238, PurchasePayment, StockAdjustment:213, StockTransfers:197, ActivityLog:180. All stay English in Bangla. Label maps + one shared numeric date formatter.
- **Loading / error / empty re-implemented 16 times** with the developer string "Couldn’t load — backend error. Check connection and retry." and no retry; P&L and Tax flash ৳0.00 KPIs while loading. Add `reload()` to `useReport.ts` and a shared `ReportState`; drop the duplicate toast (useReport.ts:73-76).
- **Developer notes shown to the owner** — P&L formula card and "No stock-valuation snapshot yet" rows (ProfitLossPage.tsx:119-146, :199-219), Sales Rep payout footnote (SalesRepPage.tsx:226-230), always-"—" columns (SalesRep Paid). Remove until the data exists.
- **Four different body widths** — `max-w-4xl` (ActivityLog), `max-w-5xl` (P&L, CustomerGroup, StockAlert, StockAdjustment, StockTransfers, Tax), `max-w-6xl` (the rest), toolbar full width. Pick one.
- **Rows that look clickable but are not** — `cursor-pointer` without `onClick` in StockAdjustmentReportPage.tsx:209 and StockTransfersReportPage.tsx:193; 14px icon-only row links in ContactsReportPage.tsx:262, :318.
- **Duplicate reports** — Sell Payment ≈ Purchase Payment (extract `PaymentsReport`); Trending ⊂ Product Sell; Items ≈ Stock ≈ Products list; Stock Alert ≈ `/stock/alerts`; Register Report tile ≈ Cash Register sidebar entry; Tax ≈ P&L tax card. Merge per §1 and §3 to cut the hub from 17 tiles to ~12, five of them leading.
