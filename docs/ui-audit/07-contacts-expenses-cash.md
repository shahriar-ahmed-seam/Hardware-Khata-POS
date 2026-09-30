# Findings — Contacts, Expenses, Cash Register, Import hub

Size note used below: `src/styles/globals.css:412-420` already remaps the arbitrary sizes to rem
(`text-[9px]`→12px, `text-[10px]`→13px, `text-[11px]`→14px), so they do follow the font slider,
but `[9px]`/`[10px]` still render below the 14px floor. `Badge` is `text-[10px]` (13px) everywhere.

---

### Customers — `/contacts/customers` (screenshot 30)
**Purpose:** find a customer, see who owes money, jump to their khata or take a payment.
**Works well:**
- Due is right-aligned, tabular, red only when > 0; over-limit gets an icon and a red bar, not colour alone.
- One clear primary action (Add Customer, h-9 indigo).
- Group badges help scanning.

**Problems:**
1. [High] Phone numbers wrap onto two lines ("01711-" / "200008") in every row and names wrap to 2–3 lines, so rows are 60–90px and only 5 customers fit above the fold. Cause: `font-mono text-xs` with no `whitespace-nowrap` (Customers.tsx:547) plus 10 columns. Fix: phone cell `whitespace-nowrap text-sm` (drop `font-mono`, it is the widest face); cut columns (see Remove).
2. [High] Group filter and badge colours are hard-coded to Retail/Wholesale/Contractor (Customers.tsx:214-217, :398, :555). Groups created on Customer Groups never appear in the filter. Fix: build options from `usePriceGroups().items`; badge colour from group index, not name.
3. [Med] Four stat cards all say "(this page)" plus a separate note line "Totals for this page only…" (Customers.tsx:181-192); "Customers (this page) 10" repeats the subtitle "10 customers". With 10 customers the page IS the whole list. Fix: when `total <= query.pageSize` drop every "(this page)" and the note; otherwise show the qualifier once in the note. Remove the Customers-count card; keep Outstanding (the number the owner cares about) first.
4. [Med] "Last sale" column is always "—": `contactAdapter.ts` never maps `lastSaleAt`, but it is a default column (contactsUI.ts:78). Remove it from `DEFAULT_CUSTOMER_COLS`.
5. [Med] Row actions are three unlabeled 28px icons at 82% opacity (Customers.tsx:331-352; `size-7`, icon `size-3.5`), and the Receive icon only renders when due > 0, so the icons jump position row to row. Fix: make the whole row open the profile (drop the eye), keep one labelled `Button size="md"` "Receive" (render a disabled placeholder when due = 0 so columns align), move Edit into the profile page.
6. [Low] Due filter chips `px-3 py-1 text-xs` ≈ 28px tall (Customers.tsx:239) next to 36px inputs; hint "Due and tag filter this page" `text-[11px]` (:255) is developer wording. Chips → `h-9 px-4 text-sm`; drop the hint (the one KPI note covers it).
7. [Low] Header has four controls before the primary (columns icon, list/grid toggle `h-7`, Export `sm`, Add) (Customers.tsx:156-176). Move Columns + view toggle into a single "View" menu; Export `size="md"`.

**Remove / merge:** avatar column (initials repeat the name); "Last sale" column; checkbox column + bulk bar (only action is bulk Delete of customers, a dangerous one — Customers.tsx:258-285); Customers-count stat card; the "(this page)" suffixes; eye row action.
**Resize:** thead `text-[11px] uppercase` → `text-xs font-medium` normal case (Customers.tsx:292); tag chips `text-[9px]` → `text-xs` (:537); grid-card labels `text-[10px] uppercase` → `text-xs` (:422, :428); Stat label `text-[11px]` → `text-xs`, value `text-xl` ok (:680); Export `Button size="sm"` → `md`; ViewToggle `h-7` → `h-9`.
**Popups on this screen:**
- `CustomerForm` in `Drawer width="max-w-3xl"` (Customers.tsx:481-509) — see Customer detail below.
- `ReceivePaymentModal` — see Customer detail below.
**Bangla:** subtitle `${formatNumber(total)} customers` stays English ("10 customers", Customers.tsx:153). Phone wrap is identical. Everything else translated and fits.

---

### Customer detail (khata) — `/contacts/customers/:id` (screenshot 31)
**Purpose:** the customer's khata — what he bought, what he paid, what he owes — shown to the customer at the counter.
**Works well:**
- Outstanding due and credit usage bar are prominent and correctly coloured.
- The khata comes straight from the backend ledger (`useKhata`), so the last balance equals the due.
- Receive Payment is the single primary button.

**Problems:**
1. [High] The khata is hidden. Default tab is `overview` (CustomerDetail.tsx:111), which shows only the last 8 rows (:341-381) beside a mostly empty Notes card. The ledger is the second tab. Fix: make Ledger the first and default tab, name it "Khata" (EN) / "খাতা"; delete the Overview tab (Recent activity is a subset of the ledger, Notes has its own tab).
2. [High] "Print Statement" does nothing — no `onClick` (CustomerDetail.tsx:212-214; same in SupplierDetail.tsx:194-196). This is the owner's main "show the customer" action. Fix: wire it to a `PrintSheet` of the khata (pattern already in `ShiftReport.tsx:170-183`), or hide the button until it prints.
3. [High] Ledger column names are accounting jargon and wrong in Bangla: "Debit / Credit / Balance" (:391-393). The dictionary maps `Credit` → "বাকি" (dict.ts:243), so the column that holds PAYMENTS reads "due" in Bangla, the opposite meaning; `Debit` → "ডেবিট". Fix: new labels "Sale" / "Paid" / "Due after" with new dict keys (e.g. "বিক্রি" / "জমা" / "বাকি"); do not reuse `Credit`.
4. [High] Ledger rows are hard to read and to follow: header `text-[11px] uppercase` (:386); date and reference `text-xs` muted (:413, :428); rows `py-2` ≈ 37px; type is the raw lowercase key with CSS `capitalize` (:417); oldest-first with no paging, so a 149-invoice customer's current balance sits at the bottom of ~300 rows; no sticky header; no closing row. Fix: cells `text-sm`, `py-3`, date not muted; `thead sticky top-0`; a bold last row "Due now ৳66,962.75"; a period filter (This month / Last 3 months / All, default 3 months) with an "Opening balance" first row; a `TYPE_LABEL` map (Opening, Sale, Payment, Return).
5. [Med] A fully paid cash sale shows as two rows for the same invoice (screenshot: "Sale INV-3155 +69,343.20" then "Payment INV-3155 −69,343.20"), doubling what the customer must read. Fix: merge sale+payment rows that share `docId` and net to zero into one row "Sale INV-3155 · paid cash", or add a "Hide fully paid cash sales" toggle (on for print).
6. [Med] Subtitle prints a raw ISO timestamp: "Contractor · joined 2025-09-02T09:11:11.859Z" (:205). Fix: drop the subtitle (group is already the badge in the card); if kept, format the date `dd/mm/yyyy`.
7. [Med] Name appears twice (PageHeader title and card :237), group twice (subtitle and badge). Keep the card; PageHeader title only.
8. [Med] Header buttons are three heights: Back ghost md (h-9), Print/Edit/New Sale `size="sm"` (h-7), Receive md (:207-226). All → `md`; put Back as a small link left of the title so the right side is Print · Edit · New sale · Receive payment.
9. [Med] Stat labels `text-[10px] uppercase` (13px) (:603); all four values the same `text-base`. Make "Outstanding due" the hero (`text-2xl`), the other three `text-base` with `text-xs` sentence-case labels.
10. [Low] Receive Payment is disabled when due = 0 (:223) although the payment flow keeps extra money as an advance. Enable it; the modal already explains advances.
11. [Low] Notes tab saves on every keystroke (:547) with no "Saved" feedback. Save on blur and show "Saved" `text-xs`.
12. [Low] Ledger shows "No ledger entries yet." while `khata.loading` is still true (`loading` returned by useKhata is unused). Show "Loading…" first.

**Remove / merge:** Overview tab (Recent activity + Notes card) → gone; khata becomes default. PageHeader subtitle. Duplicate name/group. Returns tab could fold into the khata (returns are already ledger rows) — keep only if the owner uses it.
**Resize:** tab counts `text-[10px]` → `text-xs` (:328, :333); credit-usage row `text-[11px]` → `text-xs` (:292); tag chips `text-[10px]` → `text-xs` (:252); all three tables' thead `text-[11px] uppercase` → `text-xs` (:386, :442, :507); date/ref/invoice cells `text-xs` → `text-sm`; `Button size="sm"` → `md` in header.
**Popups on this screen:**
- `ReceivePaymentModal.tsx` (also opened from Customers and Customer dues):
  1. [High] The main money input is third and tiny. Order today: mode toggle (:231-246) → method tiles (:248-266) → Amount with `text-[10px] uppercase` label (:272), chips "Full due"/"Half" `h-6 text-[10px]` (:275-286). Fix order: Amount first (autofocus, `h-12 text-2xl text-right`), chips `h-9 text-sm` ("Full due ৳66,962.75", "Half"); then method tiles; reference directly under the tiles; invoices last.
  2. [High] `width="max-w-3xl"` (:208) for five small controls; lots of empty space. → `max-w-lg`; switch to `max-w-2xl` only in pick mode.
  3. [Med] Auto vs pick is presented as an up-front choice with jargon ("Auto-allocate (oldest first)" / "Pick invoices manually", `text-xs h-8`). Make auto the silent default: a section "Goes to the oldest bills first" showing the first 3 rows + "and N more", and a text button "Choose bills myself". In pick mode the Amount field disappears (:269 renders only in auto) and total is derived — keep a read-only "Total ৳X" in its place. Pick inputs `h-8 w-24 text-xs` (:367) → `h-10 w-32 text-sm`, plus a "Full" button per row.
  4. [Med] Reference: one label "Reference / TxID" and placeholder "TX1234567" for bKash, Nagad, Card and Bank (:290-296); not marked optional; the field pops in and shifts the layout. Per-method label: "bKash transaction ID (optional)", "Bank reference (optional)", "Card slip no. (optional)"; reserve the row height so nothing jumps.
  5. [Med] Footer shows "Receiving ৳X" (:212-218) but not the result. Add "Due after: ৳Y" (or "Advance: ৳Z" when over-paid) — this is the line the customer wants to hear.
  6. [Low] Not a `<form>`: Enter does nothing; no initial focus. Table header `text-[10px] uppercase` (:330), section title `text-[11px] uppercase` (:326); method tiles `text-xs` → `text-sm`, `h-12` → `h-14`.
  7. Bangla: subtitle `Outstanding due: ৳ …` is interpolated (:210) and stays English; toast description (`Opening balance …`, `Invoices …`) likewise.
- `CustomerForm.tsx` (Edit drawer `max-w-3xl`, :559):
  1. [High] Group buttons hard-coded `GROUPS = ['Retail','Wholesale','Contractor']` (CustomerForm.tsx:20): a group added on Customer Groups cannot be chosen. Read from `usePriceGroups`; if the data model really only allows these three, hide "Add Group" instead.
  2. [Med] Header "preview" card (:73-81) repeats the drawer title/subtitle. Remove. Drawer `max-w-3xl` → `max-w-xl`, one column, Name `autoFocus`.
  3. [Med] Labels `text-[10px] uppercase tracking-[0.06em]` (:262), hints `text-[10px]` (:266) → `text-xs font-medium` sentence case, hints `text-xs`.
  4. [Med] Date of birth sits in "Credit & Balances" (:130-149). Group as: Basic (Name, Phone, Group, Address) · Money (Opening due, Credit limit) · "More details" collapsed (Alt phone, Email, DOB, Tags, Notes).
  5. [Low] Save is just disabled when Name/Phone are empty (:41) with no message; not a `<form>`, Enter does nothing. Show "Name is required" under the field after a Save attempt. Delete button (:202) → `variant="outline" className="text-destructive"`.
**Bangla:** tabs "Overview", "Ledger", "Notes" stay English because the text nodes are lowercase keys styled with `capitalize` (:315-326) and the dictionary is exact-match (translate.ts:67-80). Recent-activity type ("Payment", "Sale") stays English for the same reason (:353). Subtitle "Contractor · joined …" stays English (interpolated). The khata's Credit column becomes "বাকি" (see Problem 3).

---

### Suppliers — `/contacts/suppliers` (screenshot 32)
**Purpose:** list of suppliers and what the shop owes each.
**Works well:**
- Phone does not wrap here (fewer columns); rows are a comfortable ~53px.
- Payable column is right-aligned and red; the whole list fits above the fold.

**Problems:**
1. [Med] Same page-scoped stat strip with "(this page)" ×4 plus note (Suppliers.tsx:132-143); "Suppliers (this page) 6" repeats the subtitle. Same fix as Customers.
2. [Med] Row actions are three unlabeled 28px icons, the Pay icon only when due > 0 (Suppliers.tsx:187-210). Row click → profile; one labelled "Pay" `md` button.
3. [Low] Terms badge shows codes "Net30 / Net15 / Net7" (data from SupplierForm TERMS). Label as "30 days" etc. in the badge renderer.
4. [Low] No "Has payable" filter although Customers has "Has due". Add the same segmented control for consistency.

**Remove / merge:** avatar column; Company column when it just repeats the name's first word (keep it available in Columns, drop from `DEFAULT_SUPPLIER_COLS`, contactsUI.ts:79); Suppliers-count card.
**Resize:** thead `text-[11px] uppercase` → `text-xs`; phone `font-mono text-xs` → `text-sm whitespace-nowrap` (Suppliers.tsx:379); row icons `size-7` → labelled `md` button; header `Export all size="sm"` → `md`.
**Popups on this screen:**
- `SupplierForm.tsx` (Drawer `max-w-3xl`, Suppliers.tsx:333):
  1. [Med] Required Phone is the 4th field, after Company and Contact person (SupplierForm.tsx:60-75). Order: Name, Phone, Company, Address; the rest under "More details".
  2. [Med] "Trade & finance" shows 5 expert fields up front (Tax ID, Bank account, Lead time, Terms, Opening balance — :95-126). Keep Opening balance + Terms visible, collapse the rest.
  3. [Low] Same duplicated preview card (:48-56) and `text-[10px] uppercase` labels (:203). Drawer → `max-w-xl`.
- `PaySupplierModal.tsx`:
  1. [Med] `width="max-w-2xl"` (:99) for tiles + one amount → `max-w-md`.
  2. [Med] Same order/size problems as Receive Payment: tiles first, Amount label `text-[10px] uppercase` (:137), chips `h-6 text-[10px]` (:139-151), reference label (:156). Same fixes; add "Payable after: ৳Y" in the footer.
  3. [Low] Returns `null` while the supplier loads (:75), so clicking Pay can show nothing for a moment; render a loading body like ReceivePaymentModal does (:193-201).
**Bangla:** subtitle "6 suppliers" stays English (Suppliers.tsx:106). Terms codes stay English (data). Pagination (below the fold) is half-translated.

---

### Supplier detail — `/contacts/suppliers/:id` (screenshot 33)
**Purpose:** supplier khata and purchase bills; pay the supplier.
**Works well:**
- Clear header card with Outstanding payable in red and Pay Supplier as the only primary.

**Problems:**
1. [High] Default tab Overview contains only the Notes text ("—") (SupplierDetail.tsx:105, :284-289) — the first thing the owner sees is an empty box, with 60% of the screen blank. Delete Overview; default to Ledger ("Khata").
2. [High] "Print Statement" has no handler (:194-196). Wire or hide.
3. [Med] Ledger uses "Debit / Credit / Payable" (:299-301) — for a supplier the colours/labels read backwards to a non-accountant. Rename "Bought" / "Paid" / "We owe"; same readability fixes as the customer khata (sizes, closing row, sticky header).
4. [Med] "Bank account" is shown as a fourth money stat with "—" (:260). Move it to the contact line under the name (next to phone), only when present.
5. [Low] Header button heights mixed (Back md, Print/Edit `sm`, Pay md) (:188-204). All `md`.

**Remove / merge:** Overview tab; Bank-account stat; the Notes tab can stay (textarea).
**Resize:** Stat label `text-[10px] uppercase` → `text-xs` (:472); ledger/purchases thead `text-[11px] uppercase` → `text-xs`; date/ref cells `text-xs` → `text-sm`; "Lead time: 30d" / "Tax ID" `text-xs`/`text-[11px]` → `text-sm` (:216-218, :242-244).
**Popups on this screen:** `PaySupplierModal`, `SupplierForm` — see Suppliers.
**Bangla:** tabs "Overview", "Ledger", "Notes" stay English (lowercase keys + `capitalize`, :268-282). "Lead time: Nd" interpolated.

---

### Customer groups — `/contacts/customer-groups` (screenshot 34)
**Purpose:** define groups (price tier, default credit, discount).
**Works well:**
- Simple list, one primary action; the group form is a real `<form>` with `autoFocus` and Enter-to-save (CustomerGroups.tsx:170-243) — the only form in this group that does.

**Problems:**
1. [High] This page and Products → Price groups edit the same store (`usePriceGroups` in both CustomerGroups.tsx and PriceGroups.tsx); the subtitle even says "Same as Selling Price Groups" (:62). Two menu entries for one thing. Keep one screen; make the other route redirect to it.
2. [High] New groups cannot be used: CustomerForm and the Customers filter only offer the three hard-coded names (see Customers #2, CustomerForm #1). Either wire them to this list or remove Add Group.
3. [Med] Default group shows a greyed-out trash icon at 30% opacity (:124-125) — looks broken. Hide the delete button for the default group.
4. [Low] Save closes the drawer before the add/update resolves (:146-148); a refusal loses the input. `await` and close only on success, like CustomerForm does.
5. [Low] Edit/Delete are 32px icons with 14px glyphs, no label (:108-128). → `size-9`, or a labelled "Edit" button.

**Remove / merge:** merge with Price groups; decorative tag-icon box per row (:74-76); subtitle jargon → "Price, credit and discount for each kind of customer".
**Resize:** customer-count `text-[11px]` → `text-xs` (:86); group form: Drawer `max-w-md` → `Modal max-w-md` (4 fields do not need a full-height drawer); labels `text-[10px] uppercase` → `text-xs`.
**Popups on this screen:** in-file `Form` in `Drawer` (:136-156) — covered above.
**Bangla:** "4 customers" stays English (interpolated `${count} customers`, :87). Group names translate; "Default" badge fits.

---

### Customer dues — `/contacts/dues` (screenshot 35)
**Purpose:** who owes money and how old the debt is; collect.
**Works well:**
- Aging buckets double as filters; labelled "Receive" button on each row (the only row action in the group with a text label).
- Sorted oldest debt first.

**Problems:**
1. [Med] Selection checkboxes do nothing: the bulk bar offers only "Clear" (CustomerDues.tsx:185-192, :200, :225). Remove the checkbox column and bar.
2. [Med] Total is shown twice: subtitle "৳6,47,548.39 outstanding" (:125-129) and the "Total" bucket card (:137-142). Every bucket also carries a "Filter →" micro-line (`text-[10px]`, :342). Drop the subtitle amount (keep count), drop the "Filter →" lines; the active border already signals selection.
3. [Med] Zero buckets are painted amber/red ("৳ 0.00" in amber for 30–60 and 60–90, :150-163). Mute the value when it is 0.
4. [Med] Phone wraps to two lines (`font-mono text-xs`, no nowrap, :236) — same fix as Customers. Header "OLDEST INVOICE" wraps in both languages.
5. [Low] Age badge "358d" (`text-[11px]`, :261-274) → "358 days" `text-xs`; Receive `Button size="sm"` (h-7, :278) → `md`.
6. [Low] "Oldest invoice" is plain muted text (:257-259); either link it to the sale or drop the column (Age already says it).

**Remove / merge:** checkbox column + selection bar; "Filter →" lines; subtitle amount; Oldest invoice column (optional).
**Resize:** thead `text-[11px] uppercase` → `text-xs`; bucket labels `text-[11px]` → `text-xs`, values `text-lg` ok; phone → `text-sm whitespace-nowrap`.
**Popups on this screen:** `ReceivePaymentModal` — see Customer detail.
**Bangla:** subtitle "9 customers · ৳ … outstanding" stays English (interpolated, :125-129); "358d" suffix stays English; "সবচেয়ে পুরোনো ইনভয়েস" wraps to two lines in the header.

---

### Expenses — `/expenses` (screenshot 36)
**Purpose:** log and review money paid out of the shop.
**Works well:**
- Amount column bold, right-aligned, tabular; Add Expense is the single primary.
- Method badge makes cash vs non-cash scannable.

**Problems:**
1. [Med] Two different counts on screen: subtitle "92 expenses" vs stat "Count (this page) 50" (Expenses.tsx:156, :197); four "(this page)" cards + note (:193-201); "Total" coloured brand indigo (`tone="primary"`, :198) which carries no meaning. Keep two cards: Total and Cash (cash matters for the drawer); drop Count and Non-cash; neutral colour.
2. [Med] Date chips say "Week"/"Month" but mean last 7 / last 30 days (presetToRange, :50-57). Rename "Last 7 days" / "Last 30 days" (RegisterReport already uses those words).
3. [Med] Filter bar wraps to two lines at 1366px: search, category, method, 4 date chips, Min–Max and a hint "Amount filters this page" (:204-280). Min/Max filter only this page (client-side). Remove Min/Max (or move behind a "More filters" popover).
4. [Med] 10 columns by default (`DEFAULT` in expensesUI.ts:34) with three that carry nothing: Branch (single branch, always "Main Branch"), By ("u_admin", a login id), Attached (always "—"; the drawer only stores a file name, AddExpenseDrawer.tsx:142). Default to Date, Category, Note, Amount, Method.
5. [Low] Date cell `text-xs text-muted-foreground` (:435) — the date is how the owner finds an expense. → `text-sm` normal colour.
6. [Low] Edit is a 28px icon at 82% opacity (:356-368). Make the row clickable to edit; drop the icon.

**Remove / merge:** Count + Non-cash cards; Min/Max + hint; Branch/By/Attached default columns; row edit icon.
**Resize:** date chips `px-3 py-1 text-xs` → `h-9 px-4 text-sm` (:254); Categories and Export `Button size="sm"` → `md` (:161-175); thead `text-[11px] uppercase` → `text-xs`; Stat label `text-[11px]` → `text-xs`.
**Popups on this screen:**
- `AddExpenseDrawer.tsx` (`Drawer max-w-xl`, :147-153):
  1. [High] Two controls promise things that never happen: "Attach receipt" keeps only the file name (:138-143, :271-279) — nothing is stored; "Recurring expense — Automatically create future copies" (:281-337) — the backend never creates copies (backend/services/expenses.ts:32-34 says so). Hide both, the same way the Import hub hides importers.
  2. [Med] Category select is noisy: each parent is an `<optgroup>` AND an option "Rent (top-level)" (:180-190), so with flat categories every name appears twice. With ≤ 8 categories use a grid of category buttons (`h-11 text-sm`, emoji + name) plus "+ New"; otherwise a flat select with indented children.
  3. [Med] Branch select shown for a single-branch shop (:252-270). Render only when `branches.length > 1`.
  4. [Med] Labels `text-[10px] uppercase tracking` (:389, :310, :326) → `text-xs font-medium`; Amount (`text-lg`, :157-160) not autofocused → `autoFocus`, `h-11 text-xl`.
  5. [Low] No hint that a Cash expense comes out of the drawer. Under the method tiles when Cash is chosen: "Taken from the cash drawer" `text-xs`.
  6. [Low] Save is only disabled when category is missing (:111) — say "Choose a category" under the field. Not a `<form>`; Enter does nothing. Subtitle "Log a payment out" → drop.
  7. [Low] Method tiles `h-12 text-xs` (:207-227) → `text-sm`; six tiles in one row at `max-w-xl` are tight in Bangla.
- `NewExpenseCategoryModal.tsx` (opened from the "+" beside Category) — see Expense categories.
**Bangla:** "92 expenses" stays English (:156); date chips "Today/Week/Month" stay English (lowercase keys + `capitalize`, :246-261; only "All" is literal). "u_admin" and "Operating expense" are data.

---

### Expense categories — `/expenses/categories` (screenshot 37)
**Purpose:** manage expense categories and monthly budgets.
**Works well:**
- Compact rows with count and this-month spend; over-budget spend turns red and bold.

**Problems:**
1. [Med] Over budget is signalled by colour only: "1,35,000.00 / 50,000.00" with no word "budget" (ExpenseCategories.tsx:196-215). → "This month ৳1,35,000 of ৳50,000 budget" + a Badge "Over budget"; optionally the thin bar used for credit usage.
2. [Low] Search box for 5 categories (:112-122). Show it only when there are > 12.
3. [Low] Every row shows a placeholder list icon when no emoji is set (:185-187) — decorative noise. Render the icon box only when `cat.emoji` exists.
4. [Low] Edit/Delete 28px icons at 82% opacity (:219-233). → `size-9`, full opacity.

**Remove / merge:** search box (small lists); placeholder icons; subtitle "subcategories supported".
**Resize:** row meta `text-[11px]` → `text-xs` (:196); name `text-sm font-medium` ok; icons `size-7` → `size-9`.
**Popups on this screen:**
- `NewExpenseCategoryModal.tsx` (`max-w-md`, :66 — size is right):
  1. [Low] 17 emoji buttons up front (:10, :95-122) and a Parent select (:124-142) — expert options. Show Name + Monthly budget; put Icon and Parent under "More options".
  2. [Low] `submit` is not awaited (:36-57): the modal closes before the save is confirmed. Labels `text-[10px] uppercase` (:87, :96, :125, :145) → `text-xs`.
**Bangla:** "5 categories · subcategories supported" stays English (interpolated, :101); "18 expenses" stays English (plural built in code, :197). "এই মাসে" translated.

---

### Import hub — `/import` (screenshot 38)
**Purpose:** say that spreadsheet import is not available and where to enter records instead.
**Works well:**
- Honest: nothing pretends to import. Each card links to the manual screen.
- Bangla fits without clipping.

**Problems:**
1. [Med] One message repeated eight times: the banner plus seven dashed, faded cards each with a "Not available yet" badge (ImportHub.tsx:93-132). In English the badge wraps into a two-line pill on three cards (Opening stock, Customers, Purchases). Fix: keep the banner; replace the card grid with a plain list "Add records by hand" of 7 links (`h-10 text-sm`, icon + label); no badges, no descriptions of features that do not exist. Better still, drop "Data & Import" from the More menu until importers ship.
2. [Low] Banner copy is developer-speak ("switched off so nothing can look imported when it was not saved", :101-104). → "Importing from Excel is coming later. For now, add records on their own screens. To take data out, use Export all on each list or Settings → Backup."
3. [Low] Links `text-xs text-primary` (:126) → `text-sm`.

**Remove / merge:** 7 "Not available yet" badges; card descriptions; dashed/opacity styling.
**Resize:** link `text-xs` → `text-sm`; if cards stay, badge `whitespace-nowrap`.
**Popups on this screen:** none.
**Bangla:** fully translated, fits.

---

### Cash register — `/cash-register` (screenshot 39 = no-shift state; open state from code)
**Purpose:** see the cash drawer, record cash in/out, optionally count and close.
**Works well:**
- The old forced "Open shift" dialog is gone; the screen says nothing has to be opened.
- In the open state, "Expected in drawer right now" is a big `text-3xl` figure.

**Problems (no-shift state, screenshot):**
1. [High] It does not show the one number the owner wants: how much cash is in the drawer now. The store already has `carriedForward(branch)` (used by OpenShiftModal.tsx:33-39). Show "Cash in drawer now ৳X" big (`text-3xl`) with "left from shift #N" under it.
2. [Med] "The drawer opens by itself" (CashRegister.tsx:102) reads like the physical cash drawer will pop open; the Bangla "ক্যাশ বাক্স নিজে থেকেই খোলে" has the same double meaning. → "No need to start the register" / "ক্যাশ হিসাব নিজে থেকেই শুরু হয়", body: "Cash sales, payments and expenses are added to the drawer automatically."
3. [Med] Three equal outline buttons in a `max-w-xl` card; the long label "Count the drawer and start now" pushes "Cash Out" onto its own line (:99, :106-117). Put Cash In / Cash Out side by side (`h-10`), and the count as a secondary text button "Count the cash (optional)".
4. [Low] Right 60% of the screen is empty. Add a "Last closed shift" card (closed at, counted, difference, link to report) from the already-hydrated `shifts`.

**Problems (open-shift state, code):**
5. [High] Every action is duplicated: Cash In/Out in the Expected card (:223-229) and again in Quick actions (:318-324); X-Report in header (:169) and Quick actions (:330); Close Shift in header (:172) and Quick actions (:334). Remove the Quick actions card (:315-337) entirely.
6. [High] "Close Shift" is red `variant="destructive"` twice (:172, :334) while closing/counting is now optional and routine; nothing near it says it is optional (only the `text-xs` tips card, :339-352). Rename "Count & close" `variant="outline"` in the header only, and under the expected figure add one line: "Counting is optional. Count and close when you want to check the cash."
7. [Med] Status card repeats the header: "Shift Open" + badge "#338" + "11h 30m elapsed" (:185-205) vs subtitle "Shift #338 · Main Branch" (:161); its Opening/In/Out mini-stats (`text-[9px] uppercase`, 12px, :378) are repeated by the formula line under Expected (`text-[11px]`, :216-220). Merge into one card: big Expected, then Opening · Cash in · Cash out as `text-sm` label + `text-lg` value; drop the formula.
8. [Med] Movements table: thead `text-[11px] uppercase` (:260), all cells `text-xs` (:282-304), `py-2`, filter chips `h-7 text-xs` (:246). → `text-sm`, `py-3`, chips `h-9 text-sm`; drop the "By" column (one cashier) or show it only when > 1 name.
9. [Low] Remove the "How shifts work" card once the one-line hint (#6) exists; its third paragraph about block limits belongs in Settings.

**Remove / merge:** Quick actions card; tips card; status card merged into Expected card; formula line; second X-Report/Close buttons.
**Resize:** "Expected in drawer right now" label `text-[10px] uppercase` → `text-sm` (:210); Stat `text-[9px] uppercase` → `text-xs` (:378); "Opened … by …" `text-[12px]` → `text-xs` (:195); header `Register Report`/`X-Report` `size="sm"` → `md`.
**Popups on this screen:**
- `OpenShiftModal.tsx` ("Count the drawer", `max-w-md`): good — `autoFocus`, pre-filled with the carried-forward amount. [Low] labels `text-[10px] uppercase` (:71, :85) and hint `text-[11px]` (:80) → `text-xs`; Enter should submit; it takes a total while closing demands denominations — offer the same choice in both.
- `CashMoveModal.tsx` (`max-w-lg`):
  1. [Med] One reason list for both directions (cashRegister.ts:44-50) and default "Petty cash" for Cash In (CashMoveModal.tsx:29): "Bank deposit"/"Personal use" offered as Cash In, "Float top-up" as Cash Out. Split: In = Float top-up, Owner added cash, Other; Out = Bank deposit, Owner took cash, Petty cash, Other.
  2. [Med] Cash Out overlaps Add Expense; money paid for shop costs via Cash Out never appears in expense reports. Under the Cash Out form: "Paying for a shop cost? Use Add expense so it shows in reports." with a link.
  3. [Low] In/Out toggle inside the modal repeats the button that opened it (`text-xs`, :80-104) — remove, the title already says it. Labels `text-[10px] uppercase` (:107, :116, :132); `md:grid-cols-2` → one column, `max-w-md`; subtitle "One-off drawer adjustment" → drop. Enter should submit.
- `CloseShiftModal.tsx` (`max-w-3xl`):
  1. [High] A stray backdrop click or Esc throws away the whole count: Modal closes on backdrop (Modal.tsx:39) and the count resets on reopen (CloseShiftModal.tsx:66-73). Block backdrop close once any denomination is entered; confirm "Discard the count?" on Esc/X.
  2. [High] Four steps (Count → Variance → Notes → Confirm, :28) for one decision. The Count step already shows Expected/Counted/Variance (:220-241); Variance repeats them (:244-309); Confirm repeats them again (:346-395). One screen instead: left = denominations; right = Expected, Counted, Difference (big) with the tolerance message; note field appears (and is required) only when difference ≠ 0; "Leave in drawer for next time ৳[…]" with "To bank/owner ৳X" under it; footer Cancel + "Close drawer". Keep the existing variance confirm dialog (:95-104).
  3. [High] Denomination inputs are 28px with 14px text (`h-7 w-20 text-xs`, :208) — the most number-heavy entry in the app. → `h-10 w-28 text-base text-right`; note label "৳ 1000" `text-base font-semibold`; Enter/↓ moves to the next row; thead `text-[10px] uppercase` (:189) → `text-xs`.
  4. [Med] No way to enter just the total, although the backend stores only the total (cashRegister.ts:314-318). Add "Type the total instead" toggle that replaces the denomination table with one big amount field.
  5. [Med] Before anything is typed, "Counted ৳0.00" is red and Variance shows −expected in big red (:227-240). Show "—" until the first entry.
  6. [Med] Expected is recomputed here from locally loaded movements (:45-47) while the page uses the backend's `shift.totals.expected` (CashRegister.tsx:150-152); the two can differ. Use `shift.totals` here too.
  7. [Med] Carry-over defaults to a hard-coded ৳5,000 (:51, :70) and is hidden on the Notes step (:329-341). Default to `shift.openingCash` and show it on the main screen (see #2).
  8. [Low] Wording is heavier than the task: "Close Shift #338", "Close & Lock", "Closing the shift is final" (:154, :175, :389-392). → title "Count and close the drawer", button "Close drawer". Footer step badges `text-[10px]`/`text-[11px]` (:127, :139) go away with one screen.
- `ShiftReport.tsx` (X-Report): see Register report.
**Bangla:** no-shift state fits. Open state: "11h 30m elapsed" and "Opened … by …" are interpolated (:192, :195-198) and stay English. CloseShift: "Closing note" is missing from the dictionary (:315) and stays English; step "Count" → "সংখ্যা" (dict.ts:202, means "number") — use "গণনা"; variance confirm message is interpolated (:99).

---

### Register report (Z-report history) — `/cash-register/report` (screenshot 40)
**Purpose:** history of drawer shifts with counted cash and differences.
**Works well:**
- Money columns right-aligned and tabular; Counted bold; difference signed.
- Row click opens the shift report.

**Problems:**
1. [High] 12 columns at 1366px (RegisterReport.tsx:116-131): Opened/Closed date-time + "by" wrap into 4-line cells, rows are ~100px, only 4.5 shifts fit, and the eye icon is jammed against the card edge. Fix: drop Branch (single branch) and Duration; merge Opened+Closed into one "Date" cell ("30/09 · 00:41 → 12:11"); show Status only as a badge on open shifts. Result ≈ 8 columns: Shift, Date, Opening, Cash In, Cash Out, Counted, Difference, (open badge).
2. [High] Bangla headers are wrong: "In"/"Out" translate to "আছে"/"নেই" ("in stock"/"none", dict.ts:1340-1341). Use the existing keys "Cash In"/"Cash Out" (dict.ts:247-248 → নগদ জমা/নগদ উত্তোলন).
3. [Med] Export button has no handler (:68-70). Remove or wire to the CSV export used on other lists.
4. [Med] Variance colour uses a hard-coded ৳100 threshold (:183; also ShiftReport.tsx:103) while CloseShiftModal uses Settings → Cash Register limits. Read `useSettings().cashRegister.varianceWarn`.
5. [Med] Zero values in loud colour: "0.00" Out in amber on almost every row (:171-173). Mute when 0.
6. [Low] "by —" printed when closer is empty (:153); status badge is the raw lowercase key "closed" (:193); eye button `size-7` duplicates row click (:196-205); all 338 shifts render with no paging. Hide empty "by", label map for status, drop the eye, add `Pagination`.
7. [Low] Status filter chips `px-3 py-1 text-xs` (:102) → `h-9 text-sm`; Back/Export `size="sm"` (:65-70) → `md`.

**Remove / merge:** Branch, Duration, Status columns; eye button; Export (until it works); Opened+Closed merged.
**Resize:** thead `text-[11px] uppercase` → `text-xs`; "by …" `text-[10px]` → `text-xs` (:147, :153); shift # and dates `text-xs` → `text-sm`.
**Popups on this screen:**
- `ShiftReport.tsx` (X/Z report, `max-w-2xl`):
  1. [Med] For a closed shift the big stat is "Counted" and Expected is not shown at all (:84-89), so the difference cannot be read against anything. Show Expected and Counted side by side, then Difference.
  2. [Med] Footer primary is "Close"; "Print" is outline (:60-63). Printing is why you open it → Print primary, Close outline.
  3. [Low] Title/subtitle jargon: "X-Report — Shift #338", "Interim snapshot · shift remains open" (:56-57) → "Drawer summary so far" / "Drawer closing report". Row values are all `font-mono` including dates and names (:316-321) → mono only for money. Breakdown header `text-[11px] uppercase` (:116), rows `py-1.5` → `py-2.5`; Stat label `text-[10px] uppercase` (:338) → `text-xs`.
**Bangla:** "In"/"Out" mistranslated (above); filter chips "All" and "Closed" stay English and "open" becomes "খুলুন" (imperative "open!", dict.ts:604) because the keys are lowercase with `capitalize` (:96-110); status "closed" stays English; "11h 30m" wraps to two lines; "দ্বারা Rana Ahmed" has the wrong word order (use "খুলেছেন: Rana Ahmed").

Light theme (20, 21, 22, 23 in shots-light): nothing breaks; hierarchy holds. Amber `text-warning` on white for zero values and the "Contractor" amber-on-cream badge look the weakest — contrast not measured.

---

## Cross-cutting patterns seen in this group

- **Uppercase micro-labels in hand-copied `Field`/`Stat` components.** `text-[10px] uppercase` (13px) or `text-[9px]` (12px): CustomerForm.tsx:262, SupplierForm.tsx:203, AddExpenseDrawer.tsx:389, ReceivePaymentModal.tsx:272/292, PaySupplierModal.tsx:137/156, CashMoveModal.tsx:107/116/132, OpenShiftModal.tsx:71/85, CloseShiftModal.tsx:189/247/314/330/372/412, NewExpenseCategoryModal.tsx:87/96/125/145, CustomerGroups.tsx (form), CustomerDetail.tsx:603, SupplierDetail.tsx:472, ShiftReport.tsx:156/338, CashRegister.tsx:210/378. Fix once: `ui/Field` (label `text-xs font-medium`, sentence case, required `*`, error slot) and `ui/Stat`.
- **Table headers `text-[11px] uppercase` and muted `text-xs` date/reference cells** in every table: Customers, Suppliers, CustomerDetail (3 tables), SupplierDetail (2), CustomerDues, Expenses, CashRegister, RegisterReport, ReceivePaymentModal, CloseShiftModal. Fix: one `thead` class (`text-xs font-medium`, normal case) and cell default `text-sm`.
- **`Badge` primitive is `text-[10px]`** (Badge.tsx:25) — used for groups, terms, methods, statuses. → `text-xs`.
- **Unlabelled 28px row icons at reduced opacity** (`size-7` + `size-3.5` + `opacity-60`): Customers.tsx:331-352, Suppliers.tsx:187-210, Expenses.tsx:356-368, ExpenseCategories.tsx:219-233, RegisterReport.tsx:196-205. Fix: row click opens/edits; at most one labelled `md` action per row (Customer dues' "Receive" is the model).
- **Segmented filter chips hand-copied at ~28px `text-xs`**: Customers.tsx:239, Expenses.tsx:254, RegisterReport.tsx:102, CashRegister.tsx:246, ReceivePaymentModal.tsx:231-246, CashMoveModal.tsx:80. Fix: `ui/Segmented` at `h-9 text-sm`.
- **Lowercase keys + CSS `capitalize` defeat the exact-match translator** (translate.ts:67-80): CustomerDetail.tsx:315-326/353/417, SupplierDetail.tsx:268-282, Expenses.tsx:246-261, RegisterReport.tsx:96-110/193. Fix: render labels from a map of proper-case strings; never `capitalize` a key.
- **Interpolated counts/sentences stay English**: `${n} customers|suppliers|expenses` (Customers.tsx:153, Suppliers.tsx:106, Expenses.tsx:156, CustomerGroups.tsx:87, CustomerDues.tsx:125-129, ExpenseCategories.tsx:101/197), `${age}d`, `Outstanding due: ৳…`, `joined …`, `… elapsed`, `by …`. Fix: put the word and the number in separate text nodes ("Customers" + "10"), or a `t()` with params.
- **Dictionary homonyms give wrong meanings in money screens**: `Credit`→বাকি (dict.ts:243) in the khata, `In/Out`→আছে/নেই (dict.ts:1340-1341) in the register, `open`→খুলুন (dict.ts:604). Fix: context-specific keys ("Paid", "Cash In", "Open shift") instead of reusing generic words.
- **Page-scoped KPI strips with "(this page)" ×4 plus a note**: Customers.tsx:181-192, Suppliers.tsx:132-143, Expenses.tsx:193-201. Fix: one `PageTotals` component that hides the qualifier when `total ≤ pageSize` and shows it once otherwise; drop the count card that repeats the subtitle.
- **Dead or fake controls shown as working**: Print Statement (CustomerDetail.tsx:212, SupplierDetail.tsx:194), Register report Export (RegisterReport.tsx:68), Attach receipt (AddExpenseDrawer.tsx:142), Recurring expense (AddExpenseDrawer.tsx:281-337), Customer dues checkboxes (CustomerDues.tsx:185-225). Hide until real, as the Import hub already does.
- **Customer groups hard-coded to three names**: CustomerForm.tsx:20, Customers.tsx:214-217/398/555, CustomerDetail.tsx:240-246, CustomerDues.tsx:239-247. Fix: read `usePriceGroups`; colour by index.
- **Popups lose typed input and ignore Enter**: Modal.tsx:39 and Drawer.tsx:37 close on any backdrop click; no initial focus; no footer slot in Drawer. Only CustomerGroups' form is a `<form>`. Affects CloseShiftModal (whole count), AddExpenseDrawer, CustomerForm, SupplierForm, ReceivePayment, PaySupplier, CashMove, OpenShift. Fix: `dirty`/`closeOnBackdrop={false}` prop, `initialFocus`, and wrap bodies in `<form onSubmit>`.
- **Oversized popups for small content**: ReceivePaymentModal `max-w-3xl`, PaySupplierModal `max-w-2xl`, CloseShiftModal `max-w-3xl` (fine for the one-screen redesign), CustomerForm/SupplierForm drawers `max-w-3xl`. → `max-w-lg` / `max-w-md` / `max-w-xl`.
- **Payment-method tiles copied three times** (ReceivePaymentModal.tsx:17-23/248-266, PaySupplierModal.tsx:14-20/114-131, AddExpenseDrawer.tsx:22-29/204-228), each with the same generic "Reference / TxID" + "TX1234567". Fix: `ui/MethodTiles` (`h-14 text-sm`) with a per-method reference label.
- **Phone cells `font-mono text-xs` without `whitespace-nowrap`** wrap mid-number: Customers.tsx:547, CustomerDues.tsx:236, Suppliers.tsx:379.
- **Loud colour on zero / hard-coded thresholds**: amber "0.00" in CustomerDues buckets (:150-163) and RegisterReport Out (:171); variance colour threshold `100` in ShiftReport.tsx:103 and RegisterReport.tsx:183 instead of Settings. Fix: mute zeros; one `varianceTone()` helper reading settings.
- **Header action buttons `size="sm"` (h-7) next to `md` primaries** on every screen in the group (e.g. CustomerDetail.tsx:212-222, CashRegister.tsx:93/165-173, RegisterReport.tsx:65-70). Fix: PageHeader actions default to `md`.
- **Duplicate screens/panels**: Customer Groups ≡ Price Groups (same store), Overview tabs that only repeat the ledger/notes (CustomerDetail, SupplierDetail), Cash Register Quick actions repeating the main buttons.
