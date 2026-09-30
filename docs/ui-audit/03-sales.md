# Findings — Sales (list, Add/Edit sale, Drafts, Quotations, Sell returns, Shipments + sale popups)

Size note: `src/styles/globals.css` remaps arbitrary sizes to rem (`text-[9px]`→12px, `text-[10px]`→13px,
`text-[11px]`→14px), so they follow the font slider, but `[9px]`/`[10px]` still render below the 14px floor.

---

### All Sales — `/sales` (screenshot 03)
**Purpose:** find a past invoice (by number, customer or day), see if it is paid, then view / print / return it.
**Works well:**
- Every filter runs in SQL, so the rows, pager and totals agree (Sales.tsx:175-183); voids are hidden by default with a clear "Show voided" toggle.
- Settlement words are plain ("Paid / Part paid / Unpaid"), and Due shows "—" instead of a red 0.
- Money columns are right-aligned and tabular; Total is bold; one primary button (New Sale, h-9 indigo).

**Problems:**
1. [High] Rows are 80–90px and only 4 invoices fit above the fold. The invoice number breaks into three lines ("INV- / 2026- / 3177"), customer and "By" wrap to 2–3 lines. Cause: invoice `font-mono text-xs` with no `whitespace-nowrap` (Sales.tsx:540), 10 default columns (salesUI.ts:44) plus a 96px action column. Fix: invoice cell `whitespace-nowrap text-sm` without `font-mono`; customer `min-w-[180px]`; drop the Paid, Items and By columns from `DEFAULT` (see Remove) so 7 columns remain: Date · Invoice · Customer · Total · Due · Status · Method.
2. [High] "Custom" in the date select does nothing: `presetToRange('custom')` clears the bounds (Sales.tsx:65) and no from/to inputs are rendered anywhere, so picking Custom silently shows all dates. Fix: when `date === 'custom'` render two `<Input type="date">` (h-10) after the select and call `loadPage({from,to})`; or remove the option.
3. [Med] KPI strip is six cards all suffixed "(this page)" plus a note line (Sales.tsx:257-267) — ~110px of the 768px viewport for numbers that describe an arbitrary 50-row slice. "Tax 0.00" is always zero in this shop; "Sales (this page) 50" just repeats the page size; "Paid" ≈ Revenue. Fix: replace with a single summary line above the table, `text-sm`: "This page: 50 sales · ৳8,48,405.60 · Due ৳375.00" (Due red only when > 0), and leave full figures to Reports. If cards stay, keep only Revenue and Due.
4. [Med] Header labels `text-[11px] uppercase` (Sales.tsx:406); date and method/by cells `text-xs` muted (:533, :568-576). Fix: thead `text-xs font-medium` normal case; date `text-sm` (keep the time muted), method/by `text-sm`.
5. [Med] Row actions are three unlabelled 28px icons at 60% opacity (Sales.tsx:436-460; `size-7`, icon `size-3.5`). Eye duplicates the row click. Return is offered even on voided rows. Fix: remove Eye; keep Print and Return as `size-9` with `aria-label`, full opacity; hide Return when `s.status === 'void'`.
6. [Med] Status chips `px-3 py-1 text-xs` ≈ 28px (Sales.tsx:344-360) wrap onto a second filter row next to 36px selects; the voided toggle and "Voided only" are `text-xs` (:375, :388). Fix: chips `h-9 px-4 text-sm`; voided buttons `text-sm`; filter selects `h-10` via a shared `Select` primitive (four hand-copied class strings at :288, :302, :317, :332).
7. [Low] Subtitle "Final and voided sales" (Sales.tsx:226) is wrong by default (voids are hidden). Fix: drop the subtitle, or "All finished sales".
8. [Low] Voided rows use `opacity-60` only (Sales.tsx:428) — colour/opacity is the only signal besides the badge. Keep the badge as the signal ("Voided") and add `line-through` on the Total cell instead of fading the whole row (faded text fails contrast).
9. [Low] Header mixes sizes: columns icon h-9, Export `size="sm"` (h-7), New Sale md (Sales.tsx:232-249). Export → `size="md"`; New Sale → `size="lg"` is not needed, md is fine.

**Remove / merge:** Eye row action (row click already opens); Paid column (Total − Due says the same, and the green duplicate of Total draws the eye); Items column (it is a quantity sum, not item count — label is misleading); By column (keep available in Columns panel); the six "(this page)" cards → one line; the "Totals for this page only…" note; `void Filter/Calendar/Popover` dead imports (Sales.tsx:631-633, not UI but noise).
**Resize:** thead `text-[11px] uppercase` → `text-xs` (:406); Stat label `text-[11px]` → `text-xs` (:595); invoice `font-mono text-xs` → `text-sm whitespace-nowrap` (:540); status chips `py-1 text-xs` → `h-9 text-sm` (:346-351); row icons `size-7` → `size-9`, icon `size-3.5` → `size-4` (:439, :448, :455); Export `size="sm"` → `md` (:239); selects `h-9` → `h-10`; Badge `text-[10px]` → `text-xs` (Badge.tsx:23, shared).
**Popups on this screen:** `SaleDetail` (drawer, row click), `InvoicePrintModal` (printer icon), `CreateReturnModal` (return icon / from detail), `CreateShipmentModal` (from detail), `ColumnsPanel` — see the popup sections at the end of this file.
**Bangla:** fits; header labels read naturally in Bangla (uppercase has no effect). Stays English: invoice numbers (fine), user names, customer "Dhaka Developers Ltd" (data). The status badge "পরিশোধিত" at 13px is hard to read — the Badge resize fixes it. Method options are raw strings `['Cash','bKash',…]` (Sales.tsx:335) — they translate as whole nodes (Bank → ব্যাংক in the table), OK.

---

### Add / Edit Sale — `/sales/new`, `/sales/:id/edit` (screenshots 04, 05)
**Purpose:** type up a sale (or draft/quotation) at the desk; in edit mode, correct a finished invoice (admin only, with a reason).
**Works well:**
- Single-column layout gives the item table the full width (AddSale.tsx:618-626); In-stock turns red as soon as Qty exceeds it (:793-803) — no language needed.
- Stock shortfall and "walk-in cannot owe" rules are checked before saving with plain messages (:398-436).
- Edit mode keeps the invoice number, asks "Why is INV-… being corrected?" and hides Draft/Quotation buttons for a final invoice (:510-521, :574).

**Problems:**
1. [High] The Status select contradicts the header buttons. In new mode, choosing "Quotation" in the select retitles the page "New Quotation" and shows "Valid until", but the primary button still says "Save Sale" and calls `save('final')` (AddSale.tsx:597), so a final sale is created and stock leaves. In edit mode on a final invoice the select still offers Draft/Quotation and "Save Correction" calls `save(status)` (:588-594), re-filing an invoice as a draft — exactly what the comment at :571-573 says must not happen. Fix: delete the Status field (:673-683); the header buttons decide. Show "Valid until" only when the page was opened with `?status=quotation` and make that page's primary "Save quotation".
2. [High] Totals, payment and "Still owing" are all below the fold. At 1366×768 with one line (screenshot 05) the viewport ends at the Order charges card; the Total and the payment card (:939-1045) need two scrolls. The cashier presses "Save Sale" without seeing the amount. Fix: a sticky footer bar `sticky bottom-0 h-16 border-t bg-card` with "Total ৳910.80 · Paid ৳0 · Still owing ৳910.80" (`text-lg` total) and the Save button (`size="lg"`) on the right; keep the header with Back only.
3. [High] Barcode/Enter does not add an item. The search box has no `onKeyDown` (:704-709); results are mouse-only buttons (:715). A scanner types the code + Enter and nothing happens. Fix: Enter adds `matches[0]`, ↑/↓ move a highlighted row; autofocus this input on a new sale (it is the first thing the cashier does).
4. [High] Line inputs are the smallest controls on the page: Qty/Sell price/Disc % `h-7 … text-xs` (28px, 14px) (:811, :822, :829) inside 36px rows. Fix: `h-9 w-24 text-sm` (Qty `w-20`), row `py-2.5`; delete button `size-9` with `aria-label="Remove line"` (:836-842, currently no label at all).
5. [Med] Buy price and Avg buy are on screen for every user and every customer at the counter (:750-751, :786-791), colour-coded amber/blue as the only meaning (:724-729 comment). Two extra columns squeeze Qty/Price. Fix: hide both behind a "Show cost" eye toggle in the table header (default off, remembered per user), or show them in the search dropdown only; if kept, tooltip on hover rather than columns.
6. [Med] Customer is a raw `<select>` of every customer (:632-644). With a few hundred customers it is a long unsearchable list; the searchable `CustomerPicker` is already mounted on this page (:1050-1056) but only for "add". Fix: replace the select with a button showing the chosen name + due that opens `CustomerPicker` (search mode), keep the "+" inside it.
7. [Med] The date field shows two calendar icons and a clock (native `datetime-local` picker icon + "Pick from a calendar" + "Set to right now", DateTimeField.tsx:86-110) and US format "09/30/2026, 03:11 PM" while every list uses dd/mm/yyyy. Fix: on a new sale show the date as read-only text "Now · 30/09/2026 15:11" with a small "Change" link that reveals the field; drop the extra calendar button (the native one already opens a calendar).
8. [Med] Notes card (rows=3, full width) sits between items and totals (:858-869), pushing money further down. Fix: move to the end, collapsed as a "+ Add note" link; `rows={2}` when opened.
9. [Med] Payment rows expose "Paid on" date-time and "Reference" for every row (:977-1015) in a 5-column grid; "Paid in full" (the common case) and "Add payment" are `size="sm"` (:955-962). Fix: "Paid in full" `size="md"` primary-outline first; each row shows Method + Amount; Reference appears only for non-Cash methods; Paid on hidden behind "change date" (defaults to the sale date already, :349).
10. [Med] Walk-in + money owing is only caught by a toast at save (:432-436). Fix: when `!isNamedCustomer && still owing > 0`, show an inline warning in the payment card: "Walk-in customers must pay in full. Choose a customer to put the rest on khata." and disable Save.
11. [Low] Order charges show five boxes (Disc %, Disc ৳, VAT %, Shipping ৳, Other ৳) (:874-890) though VAT/Shipping/Other are rare in this shop. Fix: show Discount (one field with a %/৳ toggle) and a "More charges" disclosure for the rest.
12. [Low] Subtitle "Form-based entry · use POS for fast counter sales" (:565) is shown on edit too. Fix: remove; in edit the subtitle should be the invoice and customer.

**Edit mode differs:** title "Edit Sale" (should name the invoice: "Correct INV-2026-3177"), only Back + "Save Correction", payments card retitled "Payments received", non-admin banner (:605-609) and a reason prompt on save. Issues specific to edit: #1 (status select), and the non-admin still sees a full editable form with a disabled button — render the form `disabled`/read-only for non-admins instead of letting them type and then refusing.
**Remove / merge:** Status select; subtitle; the second calendar button; Buy/Avg-buy columns (to a toggle); `#` column (`w-8`, adds nothing); the "Totals" card's Subtotal repeated in the payment card as "Invoice total" (:1027-1033) — one totals block in the sticky footer; dead `void CalIcon/Badge` (:1144-1145).
**Resize:** Field label `text-[10px] uppercase font-semibold` → `text-xs font-medium` normal case (:1110); thead `text-[10px] uppercase` → `text-xs` (:743); SKU under item `text-[11px]` → `text-xs` (:784); search result SKU `text-[10px]` → `text-xs` (:721); PriceTriplet label `text-[9px] uppercase` → `text-xs` (:1091); in-stock/buy cells `text-xs` → `text-sm`; line inputs `h-7 text-xs` → `h-9 text-sm`; selects and NumberField `h-9` → `h-10`; "Paid in full"/"Add payment" `size="sm"` → `md`; payment helper `text-[11px]` → `text-xs` (:946); empty-payment note `text-xs` → `text-sm` (:967).
**Popups on this screen:** `CustomerPicker` (add customer, `startInAdd`) — POS component, out of scope here; `promptText` reason dialog on save (edit) — fine, required reason; title interpolates the invoice number.
**Bangla:** not viewed. From code, interpolated sentences will stay English or half-translated: "Nothing paid yet — the whole ৳… goes on the customer's khata" (:967-968), "Customer has existing due of …" (:915), "These payments are … more than the invoice total" (:1038-1039), `VAT (${taxPct}%)` (:904), toasts "Not enough stock for …" (:412-413), "Sale INV-… saved" (:542-546), and the page title `Convert ${invoiceNo} to a sale` (:556). Split each into a translatable label + a separate number span.

---

### Drafts & Quotations — `/sales/drafts`, `/sales/quotations` (screenshots 06, 07)
**Purpose:** unfinished sales and price quotes for a customer, waiting to be turned into a real sale.
**Works well:**
- Server-side search and paging, own query per page (Drafts.tsx:31-46, Quotations.tsx:32-46).
- Quotations flag expired quotes with a red "Expired" badge that carries an icon and the word, not colour alone (Quotations.tsx:125-127).
- Delete asks for confirmation with the document number in the title.

**Problems:**
1. [High] The main action of these pages, "Convert to Sale", is an unlabelled 28px arrow icon at 60% opacity, placed right next to an equally sized Delete icon (Drafts.tsx:127-154, Quotations.tsx:141-168). A slip deletes the quote instead of selling it. Fix: a labelled `Button size="md"` "Make sale" as the first action; Delete moved to the far right, `variant="ghost"` icon `size-9` with a gap (`ml-3`) or into the SaleDetail drawer only; remove the Eye icon and make the row clickable (`onClick={() => setOpenId(d.id)}` on `<tr>`, as Sales.tsx:430 does).
2. [Med] Empty state is said three times and gives no next step: subtitle "0 drafts saved", body "No drafts saved.", pager "No drafts" (screenshot 06; Drafts.tsx:70, :162, Pagination). Fix: when `total === 0` hide the search card and the pager, and render one empty state: "No drafts. Save a sale as a draft when the customer will come back to finish it." with a `New draft` button. Same for quotations: "No quotations. Make a quotation to give a customer a price in writing."
3. [Med] The two files are ~95% identical (184 vs 199 lines, same table classes, same row actions). Fix: one `SaleDocList` component with `kind: 'draft' | 'quotation'` (column set differs only by Items/Saved vs Created/Valid until), so every fix lands once. Optionally one page "Drafts & quotations" with two tabs — both are "not sold yet".
4. [Med] Header `text-[11px] uppercase` (Drafts.tsx:100, Quotations.tsx:99); reference `font-mono text-xs` (:113/:114); dates `text-xs` muted (Drafts :122; Quotations :120, :131). Fix: thead `text-xs` normal case; reference `text-sm whitespace-nowrap`; dates `text-sm`.
5. [Low] Drafts "Saved" uses `toLocaleString('en-GB')` → "30/09/2026, 15:11:23" with seconds (Drafts.tsx:122). Fix: `dd/mm/yyyy HH:mm` like Sales.tsx:533-536.
6. [Low] Expiry is `new Date(d.validUntil) < new Date()` (Quotations.tsx:111); a `YYYY-MM-DD` string parses as UTC midnight, so a quote "valid until 30/09" shows Expired from 06:00 on 30/09 in Dhaka. Fix: compare against `endOfLocalDay(parse local)` (lib/datetime already has local helpers). Also show "Expires in 3 days" (`text-warning`) when ≤ 3 days, so the owner can call the customer.
7. [Low] Total column is right-aligned but sits beside the left-aligned date with no gap ("TOTAL SAVED" run together in screenshot 06). Fix: `pr-6` on the Total cell or put the date before Total.

**Remove / merge:** Eye icon (row click); subtitle count (pager has it); "· convert to sale when accepted" subtitle text (becomes the empty-state hint); search card and pager when empty; merge the two pages into one component.
**Resize:** row icons `size-7` → `size-9`, icons `size-3.5` → `size-4`; action column `w-32` → auto with a labelled button; thead `text-[11px]` → `text-xs`; Badge `text-[10px]` → `text-xs` (shared).
**Popups on this screen:** `SaleDetail` (Eye) — mounted without `onCreateReturn`/`onCreateShipment` (Drafts.tsx:181, Quotations.tsx:196), which is right for unsold documents; see SaleDetail below for whether its footer hides those actions. `confirm()` for delete — fine.
**Bangla:** not viewed. Interpolated subtitles `${total} drafts saved` and `${total} quotations · convert to sale when accepted` (Drafts.tsx:70, Quotations.tsx:69) and confirm titles `Delete draft ${invoiceNo}?` will not translate as whole nodes.

---

### Sell Returns — `/sales/returns` (screenshot 08)
**Purpose:** list of goods customers brought back and how the money went back (cash or credit on khata).
**Works well:**
- Compact, one-line rows (~49px) — 10 returns above the fold; references do not wrap here.
- The original invoice number is shown next to the return number, so the owner can trace it.
- Refund total is right-aligned, tabular, bold.

**Problems:**
1. [High] Raw enum values on screen: Reason "Changed-Mind", "Wrong-Item", "Defective" via CSS `capitalize` (SellReturns.tsx:131) and Refund via "CreditAdjust" (:133). They stay English in Bangla (screenshot bn/08) and "CreditAdjust" means nothing to the owner. Fix: `REASON_LABEL` map (Changed mind / Wrong item / Defective / Damaged) and `REFUND_LABEL` (Cash → "Cash back", CreditAdjust → "Taken off khata"), both as dict keys; drop `capitalize`.
2. [Med] Subtitle "23 returns · ৳46,858.84 refunded" (SellReturns.tsx:72) counts credit-note returns as "refunded" though no cash left the drawer (row RTN-0016 CreditAdjust ৳4,950). Fix: split into "Cash back ৳41,908.84 · Off khata ৳4,950.00", or say "returned" instead of "refunded".
3. [Med] Refund amounts are all amber `text-warning` (SellReturns.tsx:135) — ten loud orange numbers per screen, for data that is not a warning. Fix: `text-foreground font-semibold`; reserve amber for something that needs action.
4. [Med] "New Return" does not create a return: it shows a toast and jumps to /sales (SellReturns.tsx:76-86). The user lands on a 50-row list and has to find the invoice. Fix: open a small `Modal max-w-md` "Return goods from which invoice?" with one autofocused invoice-number input (Enter searches `sales.get` by number) that then opens `CreateReturnModal` for it.
5. [Med] Row is not clickable; the only way in is a 28px eye (`size-7`, icon `size-3.5`, :139-145). Fix: `onClick={() => setViewing(r.id)}` + `cursor-pointer` on `<tr>`; delete the eye column.
6. [Low] Dates show seconds and are muted `text-xs` ("18/09/2026, 06:11:11", :125-127). Fix: `dd/mm/yyyy` `text-sm` (time is noise on a returns list).
7. [Low] Search is client-side over every return in memory (SellReturns.tsx:42-47) — fine at 23 rows; no UI change needed, but the empty state "No returns recorded." (:152) should say "No returns yet. Returns are made from a sale: open the sale and choose Return."

**Remove / merge:** Eye column; "Return #" and "Original" could merge into one cell "RTN-2026-0023 / for INV-2026-3046" (second line `text-xs muted`) to free width; Refund via badge → plain text (a grey badge adds nothing).
**Resize:** thead `text-[11px] uppercase` → `text-xs` (:110); ref/invoice `font-mono text-xs` → `text-sm` (:128-129) — the screenshot shows they render large anyway via the mono face, so drop `font-mono` too; reason `text-xs` → `text-sm`; Badge `text-[10px]` → `text-xs`.
**Popups on this screen:** `ReturnDetail` (`src/components/returns/ReturnDetail.tsx`, not in my list — spot-checked): `Drawer width="max-w-2xl"`, title "Return RTN-…" is a code (→ "Return from Walk-in Customer · RTN-…"); five `text-[11px] uppercase` labels (:118, :125, :137, :166, :179) → `text-xs`.
**Bangla (viewed):** title, headers and "নগদ" badge translate and fit. Still English: subtitle "23 returns · ৳… refunded" (interpolated, :72), the search placeholder "Search return ref / invoice / customer…" (not in the dictionary), every Reason value, "CreditAdjust", and data names (fine). The toast "Pick the original sale, then click “Create Return”." (:80) uses curly quotes around a button name — will not match a dict key.

---

### Shipments — `/sales/shipments` (screenshot 09)
**Purpose:** track deliveries of sold goods (driver, address, target date, status).
**Works well:**
- Status filter chips + search in one bar; status can be changed right in the row without opening anything.
- Address is truncated to one line (`truncate max-w-[180px]`) so rows stay one line.

**Problems:**
1. [High] Both row actions are dead: "Print delivery slip" and "View" buttons have no `onClick` (Shipments.tsx:148-160). Fix: wire View to a shipment drawer (or `SaleDetail` for `s.saleId`) and Print to a delivery-slip `PrintSheet`; until then remove both buttons and the empty `w-24` column.
2. [Med] Status is shown twice in the same cell: a 28px select with `text-[11px]` AND a badge below it with the same word (Shipments.tsx:131-144), doubling row height. Fix: one control — a coloured select styled as the badge (`h-9 text-sm`, border colour from `STATUS_VARIANT`), or the badge plus a "Mark delivered" button for the common next step.
3. [Med] Empty state "No shipments." (screenshot 09, :167) plus "0 shipments" subtitle plus pager "No shipments" — three zeros, no next step, and no button on this page to create one (shipments are made from a sale's detail drawer only). Fix: hide pager and filters when `shipments.length === 0`; body: "No deliveries yet. Open a sale and choose Ship to arrange a delivery." with a "Go to sales" button.
4. [Med] Status labels are raw keys humanised by `replace('-', ' ')` + CSS `capitalize` (:86-92, :138, :143) — "In Transit" in English, not translatable as a dictionary key. Fix: `SHIPMENT_STATUS_LABEL = { pending: 'Pending', 'in-transit': 'On the way', delivered: 'Delivered', failed: 'Not delivered' }` used in chips, select and badge.
5. [Low] Changing the status select writes immediately with no feedback (:133); "Delivered"/"Failed" are final states. Fix: success toast "SHP-… marked delivered"; confirm only for Failed.
6. [Low] Driver, address, target are `text-xs` muted (:118-129). Fix: `text-sm`; target date red when past and not delivered (with an "Overdue" word).

**Remove / merge:** duplicate status badge; dead Print/View buttons (until wired); Ref + Invoice → one cell (ref, invoice as `text-xs` second line); `void Truck` dead import (:187); subtitle count.
**Resize:** chips `px-3 py-1 text-xs` → `h-9 px-4 text-sm` (:80-86); status select `h-7 text-[11px]` → `h-9 text-sm` (:134); thead `text-[11px] uppercase` → `text-xs` (:100); ref/invoice `font-mono text-xs` → `text-sm`.
**Popups on this screen:** none (the two buttons that would open them are dead).
**Bangla:** not viewed. `${shipments.length} shipments` subtitle (:66) is interpolated; status words built from keys (see #4) will stay English.

---

## Popups (code only)

### SaleDetail drawer — `src/components/sales/SaleDetail.tsx`
Opened from All Sales (row), Drafts, Quotations and CustomerDetail.tsx:587.
**Works well:** phone number big with a Call button for due invoices (:226-238); Void/Delete pushed right by `flex-1` and gated by permission with a required reason (:390-442); explains why Void is missing when a return exists (:416-419).
**Problems:**
1. [High] "Create Return" and "Create Shipment" are dead when the drawer is opened from a customer's khata: CustomerDetail.tsx:587 and Drafts/Quotations mount `<SaleDetail>` without `onCreateReturn`/`onCreateShipment`, but the buttons render for any final sale and call `onCreateReturn?.(sale.id)` (:370-379). Fix: have SaleDetail mount `CreateReturnModal`/`CreateShipmentModal` itself (as it already does for AddPaymentModal and InvoicePrintModal, :447-458) and drop the two props.
2. [High] Profit is shown to whoever opens the drawer, often with the customer at the counter (:312-314). Fix: gate behind the same "Show cost" preference / a permission, or remove from this drawer (Reports has it).
3. [Med] Footer has 5–7 buttons all `size="sm"` (h-7, icons `size-3.5`) (:360-442), so the one primary "Add Payment" is the same height as Print/Edit. Fix: all `size="md"`; order left→right Print · Return · Ship · Edit … (spacer) … Void; put "Receive payment" last on the right as the only filled button (`size="lg"` when due > 0).
4. [Med] Title is the invoice code and the subtitle is an interpolated `${customer} · ${toLocaleString}` with seconds (:182-183). Fix: title "Sale to Dhaka Developers Ltd", subtitle "INV-2026-3177 · 30/09/2026 11:06".
5. [Med] Header band repeats things: branch and "By Rana Ahmed" as grey badges (:190-191), avatar initials repeating the name (:214-221), "Total Due" badge (customer-wide due, :239-241) next to the invoice's own Due (:307-311) — two different "due" numbers with no explanation. Fix: drop the avatar and the branch/by badges (move "By … · Main Branch" to one `text-xs` muted line under totals); rename the customer badge "Customer owes ৳… in total".
6. [Med] Lines table header `text-[10px] uppercase` (:248), SKU `text-[11px]` (:268), Payments label `text-[10px] uppercase` (:316), "No payments yet" `text-[11px]` (:320), payment rows `text-xs` without a date (:322-330). Fix: all `text-xs` normal case; payment rows `text-sm` with date "30/09 11:06 · Cash · ৳879.80".
7. [Low] Audit log uses `text-[12px]` and `text-[10px]` timestamps, raw action keys with `capitalize` (:337-352), shown open by default. Fix: collapse under a "History (3)" disclosure; `text-xs`; an `ACTION_LABEL` map.
8. [Low] Width `max-w-3xl` for a 5-column table and two small cards — fine at 1366 but the "Sale not found" state (:145-151) also uses 3xl for one line. Keep 3xl for the loaded state.

**Resize:** footer buttons `sm` → `md`; thead `text-[10px]` → `text-xs`; audit `text-[12px]`/`text-[10px]` → `text-xs`; Total `text-lg` → `text-xl`, Due same size as Total when > 0.
**Bangla:** interpolated strings stay English: `By ${sale.user}`, `Valid till …`, `1 return` / `${n} returns`, `Shipment ${refNo}`, `Total Due …`, `VAT (${taxPct}%)`, confirm `Delete ${sale.status} ${invoiceNo}?` (which also inserts the raw status key "draft"), toasts `${invoiceNo} voided/deleted`.

### AddPaymentModal — `src/components/sales/AddPaymentModal.tsx`
**Works well:** re-seeds amount to the current due on every open (:43-49); live "Still owing after this" preview (:160-176); Reference only for non-cash methods (:135); overpay warning in words (:152-157); `max-w-lg` is the right size.
**Problems:**
1. [High] Amount is not the first, largest field: Method tiles come first (:93-110), Amount is a normal `h-9` box in a half-width column with a `text-[10px] uppercase` label (:112-119). Fix: Amount first, full width, `h-12 text-2xl text-right`, label "Amount received"; method tiles below.
2. [Med] "Full due"/"Half" chips are `h-6 text-[10px]` (24px, 13px) (:121-132). Fix: `h-9 px-3 text-sm`, label with the figure: "Full due ৳375.00".
3. [Med] Enter does not save (no `<form onSubmit>`; buttons are plain). Fix: wrap body in `<form onSubmit={submit}>`, Save as `type="submit"`.
4. [Med] Title `Add Payment · INV-…` and subtitle `Outstanding due: ৳ …` (:79-80) are codes/interpolations. Fix: title "Receive payment from {customer}", subtitle "INV-2026-3177 · due ৳375.00" (number in its own span).
5. [Low] "Paid on" date-time is always shown (:145-150) — nearly always "now". Fix: hide behind "Change date" link.
6. [Low] Modal backdrop closes it even after typing an amount (Modal primitive). Fix in `Modal`: `dismissOnBackdrop={!dirty}`.

**Resize:** labels `text-[10px] uppercase font-semibold` → `text-xs font-medium` (:94, :113, :137, :146); method tiles `text-xs` → `text-sm`, `h-9` → `h-10`; overpay note `text-xs` → `text-sm`; Save `size="lg"`.
**Bangla:** overpay sentence interpolates the amount mid-sentence (:154-155); title/subtitle interpolated.

### CreateReturnModal — `src/components/sales/CreateReturnModal.tsx`
**Works well:** each line offers only what is still returnable (:118-127) and clamps the input (:264-267); refund is the discounted amount actually paid (:136-147); store-credit/credit-note hidden for walk-ins (:94-98); stays open on refusal.
**Problems:**
1. [High] Refund methods are jargon and the meaning lives only in a hover `title`: "Credit Adjust" (hint "Reduce customer due"), "Store Credit" (:35-36, :313). Seven tiles squeezed into a half-width column at `text-[11px]` (:306-322). Fix: full-width row of tiles `h-11 text-sm`, visible second line `text-xs` with the hint; labels "Cash back", "Take off his due", "Keep as credit"; hide bKash/Nagad/Card/Bank behind "Other method" unless the sale was paid that way.
2. [Med] Refund total, the number the cashier hands over, is `text-sm` amber in the footer (:208-211). Fix: `text-xl font-bold` (foreground colour), and the Save button states the action: "Give ৳4,240 cash back" / "Take ৳4,240 off due".
3. [Med] No quick "Return all" — each line must be typed. Fix: a `size="sm"`→`md` "Return everything" button above the table, and clicking the "Can return" number fills that line.
4. [Med] Return qty input `h-8 w-20 text-xs` (:269). Fix: `h-10 w-24 text-sm`; autofocus the first enabled line.
5. [Low] Reason is preselected as "Damaged" (:63, :102), so an untouched form records a wrong reason. Fix: no default ("Choose a reason"), required; or chips instead of a select (six options fit as `h-9` chips).
6. [Low] Title `Create Return — INV-…`, subtitle `Customer: …` (:204-205). Fix: title "Return goods from {customer}", subtitle invoice number. Section header "Pick items to return" `text-[11px] uppercase` (:227) duplicates the title's meaning — drop it.
**Resize:** labels `text-[10px] uppercase` → `text-xs` (:290, :304, :331); thead `text-[10px]` → `text-xs` (:230); SKU `text-[11px]` → `text-xs` (:247); `max-w-3xl` is right for the table.
**Bangla:** subtitle and title interpolated; `REASONS` labels are fine as whole nodes.

### CreateShipmentModal — `src/components/sales/CreateShipmentModal.tsx`
**Works well:** address pre-filled from the customer, never overwriting typing (:116-119); target date defaults to tomorrow on local time (:105); `max-w-2xl` two-column grid fits the seven fields.
**Problems:**
1. [Med] Field order does not follow the task: Driver, Vehicle, Tracking, Status come before the Delivery address (:171-199). The address is what the shop must get right. Fix: order Address (autofocus, full width) → Target date → Driver → Vehicle; move Tracking no under a "Courier" disclosure.
2. [Med] Status select on a new shipment (:180-191) — a new delivery is always Pending; offering Delivered/Failed at creation invites mistakes. Fix: remove; status is changed on the Shipments list.
3. [Low] Title `Create Shipment — INV-…`, subtitle `Customer: …` (:157-158). Fix: "Deliver to {customer}", subtitle invoice number. Save "Save Shipment" → "Save delivery".
4. [Low] Status options built from keys with `capitalize` (:184-189) — same issue as Shipments page.
**Resize:** `Field` label `text-[10px] uppercase font-semibold` → `text-xs font-medium` (:229); inputs `h-9` → `h-10`.
**Bangla:** title/subtitle interpolated; status words stay English.

### InvoicePrintModal — `src/components/sales/InvoicePrintModal.tsx`
**Works well:** reprints the stored document exactly (same `Receipt`, stored prices/date) and titles quotations/drafts correctly (:131-133); Print is the primary, bottom-right, with Save as PDF beside it; the on-screen preview and the printed sheet are the same component.
**Problems:**
1. [Med] `width="max-w-3xl"` (768px) for an 80mm receipt preview (~300px; default paper is 80mm, usePaperWidth.ts:22) — a wide grey slab around a narrow strip. Fix: `paper === 'A4' ? 'max-w-3xl' : 'max-w-md'`.
2. [Low] Title is just "Invoice" with the code as subtitle (:179-180). Fix: "Print invoice for {customer}", subtitle invoice number.
3. [Low] Footer note `text-xs` muted ("The original invoice, reprinted. Nothing about it changes.", :183-187) is reassurance nobody needs every time. Fix: remove for invoices; keep the draft/quotation line at `text-sm`.
4. [Low] No Close/Cancel button in the footer (only the header X, `size-8`). Fix: add `Button variant="ghost"` "Close" left of Save as PDF.
**Resize:** width as above; `Saving...` uses three dots vs `…` elsewhere (cosmetic).
**Bangla:** `${docTitle} saved as PDF` toast (:157) is interpolated.

---

## Cross-cutting patterns seen in this group
- **Micro uppercase labels in local `Field` copies.** `text-[10px] uppercase font-semibold` label hand-copied in AddSale.tsx:1110, CreateShipmentModal.tsx:229, CreateReturnModal.tsx:290/304/331, AddPaymentModal.tsx:94/113/137/146, SaleDetail.tsx:316. Fix once: a shared `ui/Field` (`text-xs font-medium`, sentence case, required marker) and delete the local copies.
- **Table header `text-[10px]/[11px] uppercase`** on every table: Sales.tsx:406, Drafts.tsx:100, Quotations.tsx:99, SellReturns.tsx:110, Shipments.tsx:100, AddSale.tsx:743, SaleDetail.tsx:248, CreateReturnModal.tsx:230, ReturnDetail.tsx:125. Fix once: a `ui/Table` (`THead` with `text-xs font-medium`, `sticky top-0`, row `py-3`).
- **Unlabelled 28px row icons at 60% opacity** (`size-7`, icon `size-3.5`, `opacity-60 group-hover:opacity-100`): Sales.tsx:436-460, Drafts.tsx:127-154, Quotations.tsx:141-168, SellReturns.tsx:139-145, Shipments.tsx:148-160 (two of them dead). Fix once: a `RowAction` component (`size-9`, full opacity, required `label` → tooltip + `aria-label`); rows themselves clickable; the one main action per list as a labelled `Button size="md"`.
- **Invoice/reference cells `font-mono text-xs`** wrapping or reading small: Sales.tsx:540, Drafts.tsx:113, Quotations.tsx:114, SellReturns.tsx:128-129, Shipments.tsx:116-117. Fix: a `DocNo` cell (`text-sm whitespace-nowrap tabular`, no mono).
- **Raw enum keys shown with CSS `capitalize`** (untranslatable, jargon): return reason and refund method (SellReturns.tsx:131-133), shipment status (Shipments.tsx:86-92/138-143, CreateShipmentModal.tsx:188-192), audit actions (SaleDetail.tsx:345), sale type badge (Sales.tsx:580). Fix: one `labels.ts` with `REASON_LABEL`, `REFUND_LABEL`, `SHIPMENT_STATUS_LABEL`, `AUDIT_ACTION_LABEL`, all as dict keys.
- **Hand-copied native `<select>` classes** (`h-9 px-2 text-sm rounded-md border …`): Sales.tsx:288/302/317/332, AddSale.tsx:632/661/674/978, CreateReturnModal.tsx:292, CreateShipmentModal.tsx:184, Shipments.tsx:134 (`h-7 text-[11px]`). Fix: a `ui/Select` primitive at `h-10 text-sm`.
- **Segmented chips ~28px** (`px-3 py-1 text-xs`): Sales.tsx:344-360, Shipments.tsx:80-86. Fix: a `ui/Segmented` at `h-9 px-4 text-sm`.
- **Popup titles are document codes and interpolated strings**: SaleDetail.tsx:182-183, AddPaymentModal.tsx:79-80, CreateReturnModal.tsx:204-205, CreateShipmentModal.tsx:157-158, InvoicePrintModal.tsx:179-180, ReturnDetail.tsx:102. Fix: verb + customer title as a dict key with the name in a separate span; code in the subtitle.
- **Interpolated subtitles/toasts that cannot translate**: `${total} drafts saved` (Drafts.tsx:70), `${total} quotations · …` (Quotations.tsx:69), `${n} returns · ৳… refunded` (SellReturns.tsx:72), `${n} shipments` (Shipments.tsx:66), AddSale.tsx:915/967/1038. Fix: drop count subtitles (the pager already shows the count) and split number from words elsewhere.
- **Triple "empty" messages and no next step**: subtitle + body + pager on Drafts, Quotations, Shipments (and SellReturns when empty). Fix: an `EmptyState` with one sentence + action, and `Pagination` hides itself when `total === 0`.
- **Cost/profit shown to everyone at the counter**: AddSale.tsx:750-751, 786-791 (Buy/Avg buy columns + search PriceTriplet), SaleDetail.tsx:313 (Profit). Fix: one "Show cost" preference / permission read by both.
- **`size="sm"` (h-7) buttons in headers and footers**: Sales.tsx:239, AddSale.tsx:955-962, SaleDetail.tsx:360-442. Fix: default header/footer buttons to `md`; money-confirm buttons `lg`.
- **Modal backdrop closes typed forms** (Modal.tsx:42): AddPaymentModal, CreateReturnModal, CreateShipmentModal. Fix in the primitive: a `dirty` prop that disables backdrop close.
