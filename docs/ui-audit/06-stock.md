# E — Stock module

Scope: screens 24–29 (EN + BN dark screenshots; no light shots exist for this group), plus
the receive-transfer modal, `QuickUpdateModal`, its cost-history popup, and `ColumnsPanel`.
Context applied: the shop runs ONE branch. Nothing in these pages checks the branch count
today (no `branches.length` gating anywhere in `src/pages/Stock*.tsx` / `Add*Stock*.tsx`).

---

### Stock — `/stock` (screenshot 24)
**Purpose:** see what is on the shelf and correct one product's count or price.
**Works well:**
- Per-row "Update" opens a focused popup that turns a typed shelf count into a recount adjustment (Stock.tsx:251, QuickUpdateModal).
- Filters and paging go to SQL; any filter change resets to page 1 (Stock.tsx:79-86).
- Stock cell shows qty and unit together; status badge carries an icon and a word, so it doesn't rely on colour alone (Stock.tsx:370-388).

**Problems:**
1. [High] Six stat cards count only the loaded page, and an 11px line explains that (Stock.tsx:144-160). "Total Units" adds pc + bag + kg into one number (3,539), which means nothing. "Products 24" repeats the subtitle "24 products" and the pagination total. On a real 5,000-item catalogue every value card is wrong at a glance. Fix: delete the whole block (disclaimer + grid). If a glance row is wanted, keep only Low and Out as real whole-shop counts from `dashboard.lowStock` (already used in StockAlerts.tsx:64) and make them click to set the status filter. Full stock value belongs in Reports → Stock.
2. [High] The header has five 28px/14px controls (`size="sm"`, Stock.tsx:120-137). Three of them repeat sidebar entries (Stock Alerts, Transfers, Damage / Adjustment, Sidebar.tsx:110-114). **Export has no `onClick`** (Stock.tsx:135), so it's a dead button. The Alerts badge counts this page only (Stock.tsx:118-127), so it will disagree with the Alerts screen once there is more than one page. Fix: remove the Alerts, Transfers and Adjustments buttons and remove Export until it's wired up. Keep only the columns icon (already `h-9 w-9`).
3. [Med] The default table has 9 columns (`DEFAULT` in stockUI.ts:39 plus the action column), and SKU shows twice: under the name (Stock.tsx:334) and in its own column (screenshot: "EL-SW-1G" twice per row). Fix: `DEFAULT = ['name','category','stock','reorder','valueCost','status']` plus Update = 7 columns. Drop `image` (emoji category tiles add noise and row height) and `sku` from the defaults but keep both in the picker.
4. [Med] Table header is `text-[11px] uppercase` (Stock.tsx:221) and `sticky top-0` never sticks because it's inside `overflow-x-auto` (Stock.tsx:219). That div becomes the scroll container and never scrolls vertically, so the header scrolls away on a 50-row page. Fix: `text-xs font-medium` in normal case. With ≤7 columns, drop the `overflow-x-auto` wrapper so sticky works against page scroll.
5. [Med] Quantity and category wrap. "111 / bag" breaks onto two lines (Cement row in the screenshot) and "Building / Material" wraps, which makes rows uneven. Fix: `whitespace-nowrap` on the stock `<td>` (Stock.tsx:354) and the category `<td>` (Stock.tsx:338). Also, `{p.stock}` and `{p.reorderLevel}` are printed raw ("1000", while Alerts shows "1,742"). Use `formatNumber`.
6. [Med] The status filter is `text-xs` with `px-3 py-1`, about 26px tall (Stock.tsx:196-210), and its labels "In / Low / Out" are cryptic. Fix: `h-9 px-4 text-sm`, labels "In stock / Low / Out of stock". The two raw `<select>`s (Stock.tsx:176-195) `h-9` → `h-10`.
7. [Med] The row "Update" button is `h-8 text-xs` with a price-tag icon, and its label is `hidden xl:inline` (Stock.tsx:251-258). Below 1280px it's an unlabeled tag icon. Fix: `h-9 px-3 text-sm`, always show the label.
8. [Low] Value @ Cost prints paisa on every row ("4,005.00") because `formatBDT` forces 2 decimals (utils.ts:11). A valuation doesn't need paisa. Fix: whole taka for value columns (`formatNumber(Math.round(v))`).
9. [Low] The column picker offers "Last Sold", which actually renders `p.updatedAt` (the product edit time, Stock.tsx:367), and "Last Received", which is always "—" (Stock.tsx:369). Remove both from `ALL_STOCK_COLUMNS` until real data exists.
10. [Low] The title "Stock Report" collides with Reports → Stock report (`/reports/stock`). Rename the page and the sidebar entry to "Stock" / "Stock list". Empty state "No products match." should add a "Clear filters" button.

**Remove / merge:** stat grid and its disclaimer; Alerts/Transfers/Adjustments header buttons (sidebar has them); dead Export; the SKU column (keep the SKU sub-line); image column from the defaults; the "24 products" subtitle (pagination already says it).
**Resize:** header `Button size="sm"` → `md` for anything that stays; segmented filter `py-1 text-xs` → `h-9 text-sm`; selects `h-9` → `h-10`; row Update `h-8 text-xs` → `h-9 text-sm`; thead `text-[11px] uppercase` → `text-xs`; SKU sub-line `text-[11px]` (Stock.tsx:334) → `text-xs`; stat label `text-[11px]` (Stock.tsx:392) → `text-xs` if kept.

**Popups on this screen:**
- **QuickUpdateModal** (src/components/products/QuickUpdateModal.tsx)
  1. [High] It's opened from Stock mainly to count a shelf, but the Stock section comes last, under two price cards. Rough size from the classes (no screenshot exists): header ~75px + footer ~68px + body ~710px against `max-h-[90vh]` ≈ 691px at 768px tall. That leaves about 550px of scroll area, so the "Counted quantity" input sits at or below the fold. Fix: add a prop `focus?: 'stock' | 'price'`. From Stock.tsx:299, pass `'stock'`: render the Stock block first and autofocus Counted quantity.
  2. [Med] The product name appears twice: in the subtitle (line 153) and in a large name box (lines 166-171). Fix: remove the box. Title "Update" + name as separate nodes (e.g. "Update · Cement OPC 50kg"), SKU as subtitle. Saves about 70px.
  3. [Med] The buying-price card shows three buying numbers (current, new, average), plus a "Set on" date and a History button (lines 195-245). Fix: one line above the input, "Now ৳X · set 12 Mar 2026 · History", and show the average only inside the History popup. Remove the decorative `size-9` icon tiles (lines 181-189, 249-252, 297-300).
  4. [Med] Pressing Esc while the History popup is open closes the whole update modal, and typed prices are lost. `Modal` listens for Esc on `window` (Modal.tsx:26-31) and `CostHistoryPopup` (lines 364-457) has no Esc handler of its own. Fix: the popup handles Esc in capture phase with `stopImmediatePropagation`, or `Modal` ignores Esc when a higher `[data-overlay]` exists. Also stop backdrop-click closing once any value has changed (Modal.tsx:47).
  5. [Med] No initial focus and Enter doesn't save. Fix: autofocus the target input and wrap the body in a `<form onSubmit={save}>`.
  6. [Low] The footer uses `justify-between` (line 155), which puts Cancel far left, away from Save. Use `justify-end gap-2`. Keep the h-11 sizes.
  7. [Low] 12px `text-2xs` helper text at lines 191, 201, 240, 254, 405, 421 → `text-xs`.
  8. [Low] The success toast "↓ ৳X · ↑ ৳Y" (lines 137-139) uses arrows as labels, so ↓ reads as "went down". Use "Buying ৳X · Selling ৳Y · Stock 40 bag".
- **ColumnsPanel** (src/components/ui/ColumnsPanel.tsx)
  1. [Med] The `image` column's label is `''` (stockUI.ts:24), and `meta[id]?.label ?? id` (ColumnsPanel.tsx:62) doesn't catch an empty string, so the picker shows a checkbox row with no text. Fix: a separate picker label "Picture".
  2. [Low] The ↑/↓ move buttons are `size-7` glyphs with no `aria-label` (lines 66-79); Reset/Done are `size="sm"` (28px). There's no Esc handler, and the backdrop button has no label. Fix: `size-9` with aria-labels "Move up/down", `size="md"` buttons, Esc closes.

**Bangla:** "Alerts" stays English (no dict key). "24 products" stays English (template literal, Stock.tsx:111). Stat labels wrap to two lines ("মূল্য ক্রয়মূল্যে (এই পাতা)"). "Reorder" → "পুনরায় অর্ডার" reads as "order again"; relabel the English to "Reorder at" / "Min. stock" with a dict entry like "সর্বনিম্ন স্টক". `relativeTime` output ("3d ago") is interpolated English.

---

### Stock alerts — `/stock/alerts` (screenshot 25)
**Purpose:** see what is running out and turn it into a purchase.
**Works well:**
- Suggested qty and estimated cost per row, with a one-click hand-off to Add Purchase (StockAlerts.tsx:132-140).
- The whole row toggles selection (StockAlerts.tsx:205).
- Tab badges give counts at a glance.

**Problems:**
1. [Med] The only action is a disabled "Create Purchase (0)" at the top right. The estimated cost (`text-xs`) appears only after selecting (StockAlerts.tsx:147-160), and nothing tells the user to tick rows. Fix: remove it from the header. When `selected.size > 0`, show a sticky bottom bar: "3 items · Estimated cost ৳1,07,394 · [Create purchase]" (`h-11`). When nothing is selected, show a hint row: "Tick the items you want to reorder".
2. [Med] Native checkboxes are about 13px (StockAlerts.tsx:187, 208). Fix: `size-5 accent-[hsl(var(--primary))]` in a 44px-wide cell.
3. [Med] Two tabs split one short list, and the most urgent group (Out of stock) sits behind the second tab while the default is Low (StockAlerts.tsx:55, 164-167). Fix: one list with out-of-stock first and a per-row "Out"/"Low" badge. The tab row goes away.
4. [Med] Suggest Qty uses `text-primary` at 16px semibold (StockAlerts.tsx:231). Dark primary `243 82% 64%` on card `222 25% 11%` is about 3.4:1, below 4.5:1. Fix: `text-foreground font-semibold`.
5. [Low] The key number ("54 pc") is inside a 10px Badge (Badge.tsx:23 via StockAlerts.tsx:228). Fix: plain `text-sm tabular` text coloured warning/destructive with the word "Low"/"Out" beside it, or Badge `text-xs`.
6. [Low] Category/Brand cells are `text-xs` (StockAlerts.tsx:225-226), and Brand adds little here, so drop it (7 columns). "Reorder" is printed raw ("1000"), so use `formatNumber`. "৳ " repeats on every Est. Cost cell; move it to the header "Est. cost (৳)".
7. [Low] The search input is wrapped in its own Card (StockAlerts.tsx:170-180), which adds an extra box. Put it inline, right-aligned in the tab row, or above the table without a Card.
8. [Low] The subtitle "3 low · 0 out" repeats the tab badges and is interpolated. Remove it.

**Remove / merge:** subtitle; Low/Out tabs → one list; search Card wrapper; Brand column; header-positioned Create Purchase → sticky selection bar.
**Resize:** thead `text-[11px] uppercase` (StockAlerts.tsx:184) → `text-xs`; SKU sub-line `text-[11px]` (219) → `text-xs`; checkbox → `size-5`; stock badge `text-[10px]` → `text-sm` plain text.
**Popups on this screen:** none. It navigates to `/purchases/new?prefill=alerts`.
**Bangla:** "3 low · 0 out" stays English. "Create Purchase (0)" stays English: the text node is " Create Purchase (" (the `SUFFIX` regex in translate.ts:37 doesn't strip "("), and there's no dict key either. Fix: static "Create purchase" plus the count in its own `<span>`.

---

### Stock transfers — `/stock/transfers` (screenshot 26)
**Purpose:** move stock between branches and receive transfers coming in.
**Works well:**
- Receive appears only for transfers addressed to this branch (StockTransfers.tsx:190-192).
- The cancel confirmation explains the consequence and uses plain buttons ("Cancel transfer" / "Keep it", StockTransfers.tsx:221-228).

**Problems:**
1. [High] In a one-branch shop this module is irrelevant, but it still has a sidebar entry (Sidebar.tsx:112), a Stock header button (Stock.tsx:129) and a primary "New Transfer". Fix: a `useIsMultiBranch()` check (active branches ≥ 2). When false: hide the sidebar item and the header button. On `/stock/transfers`, render an EmptyState: "Transfers move stock between branches. This shop has one branch. Add a branch in Settings → Branches to use transfers." with a link. Show the history table only if old transfers exist.
2. [Med] Row actions are dimmed `opacity-60` until hover (StockTransfers.tsx:209), so the primary Receive button looks disabled. Cancel is an unlabeled `size-7` icon with tooltip "Cancel" (StockTransfers.tsx:235-236). Fix: remove the opacity. Receive `size="md"`. Cancel → `Button variant="ghost" size="md"` with the text "Cancel" (red on hover).
3. [Med] There's no way to see a transfer's items once received; the Eye link was removed (StockTransfers.tsx:215-218). Fix: row click opens a Drawer with a read-only lines table (item, qty + unit, cost), notes and receive note.
4. [Med] The "By" column shows the raw user id `u_admin` (StockTransfers.tsx:201; `createdBy = currentUserId()` in AddStockTransfer.tsx:106). Fix: resolve to the user's display name.
5. [Med] The filter is six lowercase values styled with CSS `capitalize` (StockTransfers.tsx:140-155), about 26px tall, and all stay English in Bangla. "Inbound" overlaps Pending/In transit. Fix: a static label map ("All", "Pending", "In Transit", "Received", "Cancelled" all have dict keys; "all"/"in transit" don't) at `h-9 text-sm`. Drop "Inbound" or rename it "Coming here".
6. [Low] The stat row (StockTransfers.tsx:124-128) repeats pagination ("Transfers 8") and sums mixed units ("Total Units 83"). Remove it, or keep only Total value.
7. [Low] The status badge prints the raw enum `t.status.replace('-', ' ')` at 10px (StockTransfers.tsx:204). Map it to the static labels at `text-xs`.
8. [Low] The "Items" column sums quantities across units. Show the line count ("3 items") instead. The "→ To" header arrow repeats the arrow drawn in every row; use "To".

**Remove / merge:** the whole page for one-branch shops (see 1); stat row; "Inbound" filter; empty w-32 action column for received rows (once 2 is done it only holds Receive/Cancel).
**Resize:** thead `text-[11px] uppercase` (167) → `text-xs`; filter segments `py-1 text-xs` → `h-9 text-sm`; Receive `sm` → `md`; Cancel `size-7` → `h-9` labelled; stat label `text-[11px]` (423) → `text-xs` if kept.

**Popups on this screen:**
- **ReceiveTransferModal** (StockTransfers.tsx:283-420)
  1. [Med] Title `Receive Transfer — ${refNo}` and subtitle `From X → Y` are template literals (lines 323-324). They lead with a code and can't be translated. Fix: title "Receive stock from" + `<span>{fromBranch}</span>`, subtitle = ref + date.
  2. [Med] The only thing the user edits, the Received input, is `h-8 w-24 text-xs` with no unit (line 381). Fix: `h-10 w-28 text-sm` with the unit after it. Autofocus the first row and let Enter submit.
  3. [Med] The footer always shows "Variance: +৳ 0.00 (creates auto-adjustment if not 0)" (lines 330-343), which is jargon and duplicates the Diff column. Fix: show it only when variance ≠ 0, with the copy "Short or extra items are saved as a stock correction." at `text-sm`.
  4. [Low] `width="max-w-3xl"` for a 4-column table → `max-w-2xl`. Line header `text-[10px] uppercase` (354) → `text-xs`. "Receive note" label `text-[10px] uppercase font-semibold` (404) → `text-xs font-medium` in sentence case with `mb-1.5`.
  5. [Low] A backdrop click discards edited counts and the note (Modal.tsx:47). Guard it when anything has changed.

**Bangla:** every filter label and every status badge stays English (lowercase text nodes; screenshot 26-bn). "u_admin" stays. The modal title/subtitle, the confirm title `Cancel transfer ${refNo}?` (line 222) and the toast `${refNo} received` (line 303) are interpolated English.

---

### New transfer — `/stock/transfers/new` (screenshot 27)
**Purpose:** build a transfer document of products from one branch to another.
**Works well:**
- From → To with an arrow reads naturally, and To excludes the From branch (AddStockTransfer.tsx:153).
- Save leaves the page only after the backend accepts, so a refusal keeps the input (AddStockTransfer.tsx:92-114).

**Problems:**
1. [High] With one branch, "To branch" renders an empty select (the filter removes the only branch, AddStockTransfer.tsx:153). Save stays disabled (`isValid`, line 88) with no explanation, so the page is a dead end. Fix: redirect to the explained empty state from Transfers #1. As a fallback, show inline under To branch: "You need a second branch to transfer stock."
2. [Med] From defaults to `branchNames[0]` (the screenshot shows "Dhanmondi Branch"), not the shop's default/current branch (lines 39-47). Fix: default to `branches.find(b => b.isDefault)`, as AddStockAdjustment.tsx:43 does.
3. [Med] The Status select exposes expert states, including "Received (instant adjustment)" (lines 169-178). Fix: hide it under "More options" and keep the "In transit" default.
4. [Med] Product search has no autofocus, no ↑/↓/Enter (a barcode scan can't add a line) and no "No product found" row. Its stock hint is `text-[10px]` with an English " · stock " node (lines 186-211). Fix: the shared ProductPicker (see cross-cutting).
5. [Med] The line qty input is `h-7 w-20 text-xs` (line 244). The trash button is `size-7` with no `title`/`aria-label` (line 257). Fix: `h-10 w-24 text-sm`; `size-9` with `aria-label="Remove line"`. Merge the Unit column into the qty cell and drop "#", which leaves 5 columns.
6. [Low] The Summary card repeats From/To from the form, and "Units" sums mixed units (lines 296-300). Meanwhile the primary Save sits top-right, far from the items. Fix: Summary = Items + Total value + `Save transfer` (`h-11 w-full`). Keep only Back in the header.
7. [Low] The local `Field` label is `text-[10px] uppercase` with no gap above the control (line 325) → `text-xs font-medium block mb-1.5` in normal case.
8. [Low] Notes has its own card (lines 271-282), pushing the page past 768px. Move it into the first card as a 2-row textarea, or behind an "Add note" link.

**Remove / merge:** From/To/Units rows in Summary; separate Notes card; "#" and Unit columns; header Save → Summary card.
**Resize:** labels `text-[10px] uppercase` → `text-xs`; selects `h-9` → `h-10`; line qty `h-7 text-xs` → `h-10 text-sm`; trash `size-7` → `size-9`; thead `text-[10px] uppercase` (217) → `text-xs`; SKU sub-line `text-[11px]` (234) → `text-xs`.
**Popups on this screen:** the product-search dropdown (inline, lines 190-212). Problems as in item 4.
**Bangla:** labels translate and fit. The date shows US format "09/30/2026, 03:12 PM" in both languages (native `datetime-local`, see cross-cutting). " · stock " in the dropdown stays English.

---

### Stock adjustments — `/stock/adjustments` (screenshot 28)
**Purpose:** history of stock corrections (damage, theft, sample, recount).
**Works well:**
- Net qty and value carry a +/− sign as well as colour (StockAdjustments.tsx:160-174).
- Search also matches item names inside each document (line 47).

**Problems:**
1. [High] The Eye "View" button has **no `onClick`** (StockAdjustments.tsx:179-185), so it's dead on every row. The list also never shows which product was adjusted, only "Lines 1". Fix: row click and the Eye button open a Drawer with lines (item, qty + unit, unit cost, impact), reason, user and date/time. Replace the "Lines" column with "Items", showing the first product name plus "+2 more".
2. [Med] The Branch column (lines 133, 154) is constant in a one-branch shop. Hide it when `!useIsMultiBranch()`.
3. [Med] "By" shows `u_admin` (line 176). Resolve it to the user's name.
4. [Med] The type filter is six lowercase segments at `text-xs py-1` (lines 102-117), and the badges are raw lowercase enums at 10px (line 158). Both stay English in Bangla. Fix: a static label map ("Damage", "Theft", "Sample", "Recount", "Other" all have dict keys), chips `h-9 text-sm`, Badge `text-xs`.
5. [Low] Reason is `text-xs` muted and truncated at 200px with no tooltip (line 177). Fix: `text-sm` and `title={a.reason}`.
6. [Low] The subtitle "5 adjustments · net impact ৳ -18,507.17" (line 83) repeats the pagination count, puts the minus after ৳ and is interpolated. Fix: drop the count. If kept, use a static label "Net loss" + value `৳18,507` in its own element.
7. [Low] The sidebar calls this "Damage / Adjustment" and uses the same AlertTriangle icon as Stock Alerts (Sidebar.tsx:111, 113), while the page says "Stock Adjustments". Use one name ("Stock corrections" / "Damage & recount") and a distinct icon (`Sliders`).

**Remove / merge:** Branch column (single branch); "Lines" → "Items" names; count in subtitle.
**Resize:** thead `text-[11px] uppercase` (128) → `text-xs`; filter `py-1 text-xs` → `h-9 text-sm`; Eye `size-7` → `size-9` (or drop it once row click works); Reason `text-xs` → `text-sm`.
**Popups on this screen:** none work today. Add the detail Drawer (`src/components/ui/Drawer.tsx`), `max-w-lg`, with a Close button bottom-right.
**Bangla:** filter chips and type badges stay English (screenshot 28-bn); the subtitle stays English; "u_admin". Reasons created by QuickUpdateModal are saved as English text (`Counted ${count} ${unit} in shop`, QuickUpdateModal.tsx:129) and will always show in English here.

---

### New adjustment — `/stock/adjustments/new` (screenshot 29)
**Purpose:** record damaged, stolen, sampled or recounted stock for one or more products.
**Works well:**
- The default branch is preselected (AddStockAdjustment.tsx:43-47).
- Per-line impact and net value update live. Save waits for the backend and keeps the input on refusal.
- The empty-state hint explains the sign rule.

**Problems:**
1. [High] Signed quantity entry is error-prone. Damage/theft/sample lines start at −1 (line 69), but the field accepts any sign (`allowNegative`, line 233). A user who selects "-1" and types "2" for two wet cement bags records **+2**, and stock goes up. Changing Type after adding lines doesn't flip existing signs. Recount makes the user work out the difference in their head. Fix: qty is always positive, and direction comes from Type. Damage/Theft/Sample → "Remove". Other → a per-line "Remove / Add" toggle. Recount → a "Counted" field showing "System 48 → Counted 45 = −3 bag" (the same model QuickUpdateModal already uses).
2. [High] A line never shows the current stock or the stock after saving (table at lines 205-214). Fix: replace "Unit Cost" with "In stock → after" (`48 → 45 bag`) and move cost into the Impact cell's tooltip.
3. [Med] The Date field is clipped to "09/30/202" in both languages (screenshot 29). `DateTimeField` (input + two 36px buttons) is squeezed into one third of the card by `md:grid-cols-3` (line 127). Fix: hide Branch for a single branch and use `md:grid-cols-2` (Type | Date). Otherwise give Date `md:col-span-3`, or use `grid-cols-[1fr_1fr_minmax(300px,1.3fr)]`.
4. [Med] Product search has no autofocus, Enter doesn't add the top match (so a scanner is useless), a product already in the list is silently ignored (line 64), and focus doesn't move to the new line. Fix: the shared ProductPicker. On a duplicate, focus and flash the existing row. After adding, focus its qty input.
5. [Med] The qty input is `h-7 w-24 text-xs` (line 232). The trash button is `size-7` with no label (line 251). Fix: `h-10 w-24 text-sm`; `size-9` with `aria-label="Remove line"`. Merge Unit into the qty cell and drop "#".
6. [Med] Type options are lowercase enums styled with `capitalize` (lines 145-152). In Bangla "Damage" stays English (screenshot 29-bn), and "Sample" is unclear to a shopkeeper. Fix: static labels "Damaged / Stolen or lost / Given as sample / Recount / Other", shown as a 5-button segmented control at `h-10` so the choice is visible.
7. [Low] Branch is a select with one option in this shop (lines 129-140). Hide it when single-branch.
8. [Low] The subtitle "Damage / theft / sample / recount" repeats the Type options (line 111). Replace it with "Record broken, lost or recounted stock." The reason placeholder mentions a forklift (line 160); use "e.g. 2 bags got wet in the rain".
9. [Low] The Summary card shows "Lines", "Net qty" (summed across units) and "+৳ 0.00" with a plus on zero (lines 270-298). Fix: keep only Net value (no sign at 0) and put `Save adjustment` (`h-11 w-full`) inside this sticky card. Keep only Back in the header.
10. [Low] Local `Field` label `text-[10px] uppercase` with no gap (line 314) → `text-xs font-medium block mb-1.5`.

**Remove / merge:** Unit Cost column → "In stock → after"; "#" and Unit columns; Lines/Net qty rows; redundant subtitle; Branch select (single branch). The empty state can also point to the faster path for one item: "Counting one product? Use Update on the Stock list."
**Resize:** labels `text-[10px] uppercase` → `text-xs`; selects `h-9` → `h-10`; line qty `h-7 text-xs` → `h-10 text-sm`; trash `size-7` → `size-9`; thead `text-[10px] uppercase` (206) → `text-xs`; dropdown hint `text-[10px]` (193) → `text-xs`; SKU sub-line `text-[11px]` (223) → `text-xs`.
**Popups on this screen:** the product-search dropdown (lines 176-201). It's the same component copy as New transfer, with the same problems (item 4).
**Bangla:** the Type select stays English; the clipped date shows in both languages; " · stock " in the dropdown stays English. The empty-state sentence translates and wraps acceptably.

---

## Cross-cutting patterns seen in this group
- **Micro text that bypasses the scale:** 21 `text-[10px]`/`text-[11px]` in these files. Table headers use `text-[11px] uppercase` (Stock.tsx:221, StockAlerts.tsx:184, StockTransfers.tsx:167, StockAdjustments.tsx:128) and line tables use `text-[10px] uppercase` (StockTransfers.tsx:354, AddStockTransfer.tsx:217, AddStockAdjustment.tsx:206). Fix once: a shared `<Th>` / table-head class `text-xs font-medium text-muted-foreground` in normal case, and `text-xs` for SKU sub-lines.
- **Badge primitive is 10px and gets raw enum strings:** Badge.tsx:23 (`text-[10px]`) → `text-xs px-2.5`. Add a `statusLabel()` map so lowercase enums never reach the DOM (StockTransfers.tsx:204, StockAdjustments.tsx:158). That also fixes Bangla.
- **Hand-rolled segmented filters (3 copies) at about 26px with lowercase `capitalize` text:** Stock.tsx:196-210, StockTransfers.tsx:140-155, StockAdjustments.tsx:102-117 → a shared `SegmentedFilter` (`h-9 text-sm`, static labels).
- **Local `Field` + raw `<select>` copies:** AddStockTransfer.tsx:313-330 & 137-178, AddStockAdjustment.tsx:302-319 & 130-152, Stock.tsx:176-195 → shared `FormField` (`text-xs font-medium mb-1.5`, required marker) and `Select` (`h-10 text-sm`).
- **Duplicated product-search dropdown:** AddStockTransfer.tsx:183-212 and AddStockAdjustment.tsx:172-201 are near-identical copies with no autofocus, no keyboard/Enter/scanner support, no "not found" row, a 10px stock hint and an English " · stock " node → a shared `ProductPicker`.
- **Tiny line-edit controls:** qty inputs `h-7`/`h-8 text-xs` (AddStockTransfer.tsx:244, AddStockAdjustment.tsx:232, StockTransfers.tsx:381) and unlabeled `size-7` trash/cancel/eye buttons (AddStockTransfer.tsx:257, AddStockAdjustment.tsx:251, StockTransfers.tsx:235, StockAdjustments.tsx:181) → `h-10 text-sm`, `size-9` with `aria-label`/visible text.
- **No single-branch awareness:** Transfers in the sidebar (Sidebar.tsx:112) and the Stock header (Stock.tsx:129), the Branch column (StockAdjustments.tsx:133), the Branch select (AddStockAdjustment.tsx:129), From/To selects (AddStockTransfer.tsx:137-160) → one `useIsMultiBranch()` hook (active branches ≥ 2) gating all of them.
- **User ids shown as names:** "By" = `u_admin` (StockTransfers.tsx:201, StockAdjustments.tsx:176) → `useUserName(id)`.
- **Misleading summaries:** page-scoped totals (Stock.tsx:149-160) and unit totals summed across pc/bag/kg (Stock.tsx:151, StockTransfers.tsx:126, AddStockTransfer.tsx:300, AddStockAdjustment.tsx:273-277). Remove them; show money totals only, and only when they're real.
- **Interpolated copy that can't be translated:** Stock.tsx:111, StockAlerts.tsx:145 & 158, StockAdjustments.tsx:83, StockTransfers.tsx:222, 303, 323-324 → a static label node plus a value node.
- **Dead buttons:** Export (Stock.tsx:135) and Eye/View (StockAdjustments.tsx:179). Wire them up or remove them.
- **Save placement on document forms:** the primary Save sits top-right while the sticky Summary card on the right has no action (AddStockTransfer.tsx:121-129, AddStockAdjustment.tsx:112-121). Put `Save` (`h-11 w-full`) at the bottom of the Summary card.
- **Popup safety:** `Modal` closes on backdrop click and Esc even with edits (Modal.tsx:26-31, 47), and the nested CostHistoryPopup's Esc also closes its parent (QuickUpdateModal.tsx:364). Add a `dirty` prop that blocks backdrop close, and let only the top-most `[data-overlay]` handle Esc.
- **Date format mismatch:** native `datetime-local` shows US `mm/dd/yyyy hh:mm AM` (screenshots 27, 29), while lists use `en-GB` dd/mm/yyyy (StockTransfers.tsx:182, StockAdjustments.tsx:152). Set the Chromium UI locale to en-GB in the Electron main process (e.g. `app.commandLine.appendSwitch('lang', 'en-GB')`) so native inputs match.
- **Ungrouped quantities and primary-coloured small text:** raw `{p.stock}` / `{reorderLevel}` (Stock.tsx:356, 361; StockAlerts.tsx:229) → `formatNumber`. `text-primary` on normal-size text is about 3.4:1 on dark cards (StockAlerts.tsx:231) → `text-foreground`. Keep primary only for ≥19px bold totals.
