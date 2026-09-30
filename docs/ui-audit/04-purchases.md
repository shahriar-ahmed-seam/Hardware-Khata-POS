# C — Purchases module (UI/UX audit)

Evidence: screenshots 10–13 (EN dark + BN dark; this group has no light screenshots, so contrast numbers below are computed from the dark tokens in `src/styles/globals.css`). All popups reviewed from code only.
Measured contrast (dark): `text-primary` on card = 3.44:1, primary on `bg-primary/15` badge = 3.0:1, white on `bg-destructive` button = 3.81:1. All three are below 4.5:1 at the sizes used here.

---

### Purchases list — `/purchases` (screenshot 10)
**Purpose:** find a supplier bill, see what's still owed on it, and open it to pay, print, return or edit.

**Works well:**
- Every filter runs in SQL, so the rows, the pager and the totals always describe the same set of bills. Cancelled bills are hidden by default, with one toggle to bring them back.
- Money columns are right-aligned `font-mono tabular`. Due shows "—" when zero, and the Payment badge uses plain words ("Part paid", "Unpaid") from `SettlementBadge`.
- Clicking anywhere on a row opens the detail drawer.

**Problems:**
1. [High] The table overflows sideways at 1366px. Only the eye icon is visible at the right edge of screenshot 10; the Print icon is scrolled off. The cause is 10 default columns plus a `w-24` actions column (`stores/purchasesUI.ts` `DEFAULT`, `Purchases.tsx:358–405`). Reference numbers wrap onto 3 lines ("PO- / 2026- / 0071") and supplier names onto 2, so each row is about 80px and only 3 rows fit in the viewport. Fix: set the default columns to `date, ref, supplier, total, paid, due, paymentStatus` (7). Show `status` only when it isn't "received" (render it as a second badge in the Payment cell). Drop `items` and `user` from the default set; they stay available in Customize columns. Add `whitespace-nowrap` to the `ref` cell (`Cell` case `'ref'`, :462).
2. [High] The KPI strip uses about 150px above the table and says little (`Purchases.tsx:232–245`). "Purchases (this page) = 50" is just the page size. Tax is ৳0.00. At `xl:grid-cols-6` the cards are about 165px wide, so "৳" and the number break onto separate lines (cards 2 and 3 in the screenshot). The label "(this page)" repeats six times and still needs an 11px caption to explain it. Fix: delete the six `Stat` cards and the caption. Put one `text-sm` line in the table footer instead, next to the pager: "This page: ৳1,76,77,234 bought · ৳1,22,55,118 paid · ৳54,22,117 unpaid". This removes the duplicate numbers and moves the table up by about 150px.
3. [Med] The header has five actions at mixed sizes and colours (:199–227). "Pay Bill" is `variant="destructive"`: red means danger, and white on red measures 3.81:1. "Returns" duplicates the sidebar's "Purchase Returns" (`Sidebar.tsx:83`). "Export all" is a rare admin action. Fix: keep only `Pay Bill` (`variant="outline"`, `size="md"`, Banknote icon) and `Add Purchase` (primary, `size="md"`). Move "Export all" and "Customize columns" into one `IconBtn` overflow menu (⋯). Remove the "Returns" button.
4. [Med] The filter card wraps onto 2 rows and has two "All" buttons, one in each chip group (:247–347). The status chips are `text-xs py-1`, about 26px tall. Their labels are lowercase data (`s.replace('-',' ')` + CSS `capitalize`), so they never translate. Fix: replace the status chip group and the "Show cancelled" button with one `<select>`: "Received + ordered (all live)" / "Received" / "Ordered" / "In transit" / "Cancelled". Keep the payment chips at `h-9 px-3 text-sm`. Result: search, supplier, date, payment on one row.
5. [Med] Row actions are `size-7`, 14px icons at `opacity-60` (:388–403). The eye does the same thing as clicking the row. Fix: remove the eye. Make Print a `size-9` button with `aria-label` and `title` at full opacity, or move it into the drawer only; the drawer already has Print.
6. [Med] Cell text is below the target size. Dates are `text-xs text-muted-foreground` (:447), ref is `font-mono text-xs` (:452), `user`/`branch` are `text-xs`, the header is `text-[11px] uppercase` (:358), and Badge is `text-[10px]` (`ui/Badge.tsx`). "Part paid" wraps onto 2 lines inside its badge (screenshot row 3). Fix: header `text-xs normal-case font-medium`; date and ref `text-sm`; Badge `text-xs px-2.5 py-0.5 whitespace-nowrap`; row `py-3` (≥44px once wrapping stops).
7. [Low] The status badge prints raw lowercase data ("received") with `variant="info"` for ordered/in-transit, which measures 3.0:1 (:497–509). Fix: map it to labels ("Received", "Ordered", "In transit", "Cancelled"). Use `default` or `warning` instead of `info` for "Ordered" and "In transit".
8. [Low] The empty state "No purchases match." (:415) gives no next step. Fix: "No purchases match these filters." plus a `Clear filters` button. When there are no bills at all, add an `Add purchase` button.

**Remove / merge:**
- The 6 KPI cards and their caption, merged into one footer line (see 2).
- The "Returns" header button (the sidebar already links there). The eye row action (the row click does the same).
- The status chip group and the "Show cancelled" toggle, merged into one status select.
- `items` and `user` columns out of the default set. Status merged into the Payment cell when it isn't "received".

**Resize:**
- Header buttons `size="sm"` (h-7) → `md` (h-9); ideally h-10 via a new `Button` size.
- `thead text-[11px] uppercase` → `text-xs` normal case. `Stat` label `text-[11px]` → gone. Caption `text-[11px]` → gone.
- Chip buttons `px-3 py-1 text-xs` → `h-9 px-3 text-sm`.
- Row action `size-7` → `size-9`. Badge `text-[10px]` → `text-xs`.

**Popups on this screen:**

*PurchaseDetail drawer — `components/purchases/PurchaseDetail.tsx`*
1. [High] The footer packs up to 7 `size="sm"` (h-7, 14px) buttons (:274–356). The destructive one is labelled just "Cancel" (:353), which reads like "close this drawer" next to a Drawer that also closes on Esc or backdrop click. Fix: label it `Cancel purchase`. Make every footer button `size="md"`. Order them: left = Print, Edit, Create return, Mark received (outline); right = `Pay ৳8,32,398` (primary, showing the due amount). Put the destructive Delete / Cancel purchase in a separate "More" menu, or behind a divider at the far left.
2. [Med] The title is a code ("PO-2026-0071"), and the subtitle is an en-GB timestamp with seconds (:108–109). Fix: title `Purchase from Walton Electricals`, subtitle `PO-2026-0071 · 25 Sep 2026, 12:11 am`.
3. [Med] A row of up to 6 `text-[10px]` badges: status, payment, branch, "By Owner", pay terms, returns (:112–121). Fix: keep only the status and payment badges. Show branch, user and pay terms as one `text-sm text-muted-foreground` line ("Main Branch · entered by Owner · Net15").
4. [Med] The supplier-wide "Total payable ৳X" is a red badge (:147), next to this bill's own Due in the totals box. That gives two different "due" numbers in red. Fix: render it as plain text under the supplier's name: "Owed on all bills: ৳X" (`text-sm`), with a `Pay supplier` link that opens `PayBillModal` with `initialSupplierId`.
5. [Med] The payments list shows method and amount but no date, at `text-xs`, under a `text-[10px] uppercase` "Payments" label (:213–229). Fix: one `text-sm` row per payment: date · method · reference · amount.
6. [Low] The audit log is always expanded. It uses `text-[12px]`/`text-[10px]` and raw lowercase `a.action` with `capitalize` (:243–268). Fix: collapse it behind "History (3)" using `<details>`. Use `text-sm` rows and map actions to labels ("Created", "Payment added", "Cancelled").
7. [Low] Line table header `text-[10px] uppercase`, SKU `text-[11px]`, S/N `text-[10px]` (:154–175) → `text-xs` normal case / `text-xs`.

*PayBillModal — `components/purchases/PayBillModal.tsx`*
1. [High] The flow runs in the wrong order, and the opening-balance / advance rules are only half shown. The order is Supplier → mode toggle → method tiles → amount → a grey box (opening/advance, shown only when >0) → a bills table. The "Paying ৳X" total sits in the footer. In pick mode, the opening balance vanishes completely: the preview box is gated on `mode === 'auto'` (:315), and allocations cover bills only. The user never learns that part of the payable can't be picked. Nothing shows what the supplier will still be owed afterwards. Fix, in this order:
   1. Supplier.
   2. Amount (autofocus, `h-11 text-lg`), with chips "All ৳X" and "Oldest bill ৳Y".
   3. Method tiles, plus the reference field when needed.
   4. A single "Where it goes" table whose first row is always *Opening balance* (if >0), then each bill, then *Advance kept with supplier*. Its last row is **"Still owed after this: ৳Z"**.
   
   Put the mode toggle above that table as a small secondary switch, "Oldest first / I'll choose". In choose mode, keep the Opening balance row visible with the note "Paid only with Oldest first".
2. [Med] The title "Pay Bill" / "Settle outstanding supplier dues" is generic, and the modal is `max-w-3xl` while it shows only a select at first (:205–207). Fix: title `Pay a supplier`, changing to `Pay Walton Electricals` once one is chosen. Width `max-w-2xl`. Give the supplier select `autoFocus`.
3. [Med] If nobody is owed money, the select shows only "Select supplier…" with no message, because `supplierOptions` filters `due > 0` (:143–147). Fix: when `supplierOptions.length === 0`, show "You don't owe any supplier right now." and a Close button.
4. [Med] The mode labels are jargon: "Auto-allocate (oldest first)" / "Pick bills manually" (:258). Fix: "Oldest bills first" / "I'll choose the bills".
5. [Low] Controls below target size: the "Full payable" chip is `text-[10px] h-6` (:294), pick-mode inputs are `h-8 w-24 text-xs` (:382), and labels are `text-[10px] uppercase` (:229, 287, 303). The table header is `text-[10px] uppercase` and the caption `text-[11px] uppercase` (:338–342). Fix: chips → `h-8 px-3 text-xs`, inputs → `h-9 w-28 text-sm`, labels → the shared 14px `Field` label.
6. [Low] Unlike `AddPurchasePaymentModal`, there is no "Paid on" field; the payment is always stamped now. Say so under the amount: "Recorded as paid now."
7. [Low] Enter doesn't submit (no `<form>`), and the backdrop closes the modal even after an amount is typed (`ui/Modal.tsx`).

*PurchasePrintModal — `components/purchases/PurchasePrintModal.tsx`*
1. [Med] The title "Purchase" says nothing, and there is no Close button, only Print (:43–53). Fix: title `Print goods received note`, subtitle `PO-… · Walton Electricals`. Footer: `Close` (outline) + `Print` (primary), right-aligned.
2. [Low] The printed status is raw lowercase (`p.status.replace('-', ' ')`, :101), and several print labels are missing from the Bangla dictionary ("Reference No.", "Location", "Pay term", "Other charge"), so a Bangla print comes out mixed.

*CreatePurchaseReturnModal (opened from the drawer) — `components/purchases/CreatePurchaseReturnModal.tsx`*
1. [Med] The title is a code and doesn't translate: `Create Purchase Return — PO-…`, subtitle `Supplier: …` (:174–175). Fix: title `Send goods back to Berger Paints BD`, subtitle `From bill PO-2026-0069`. Add dictionary entries for the static parts.
2. [Med] The table has 6 columns, and "Bought qty" and "Can return" repeat each other (:199–255). Return-qty inputs are `h-8 w-20 text-xs` with no quick "all" button. Fix: merge those two into "Can return: 10 of 12 pc". Make the input `h-9 w-24 text-sm` with an `All` button (`h-9`) beside it.
3. [Med] The refund-method tiles are `text-[11px] h-9` in a 3-column grid inside half the modal width, so "Bank reversal" is cramped. The meaning ("Reduce supplier due") lives only in a `title` tooltip (:280–296). Fix: give the refund method the full row, with 5 tiles `h-10 text-sm`. Show the selected method's hint as a visible `text-xs` line underneath.
4. [Low] Labels `text-[10px] uppercase` (:262, 276, 303), caption `text-[11px] uppercase` (:195) → 14px sentence-case labels.

*ColumnsPanel — `components/ui/ColumnsPanel.tsx`* (shared)
- [Low] Only the 20px check box toggles, not the row label. The ↑/↓ buttons are `size-7`. The footer buttons are `size="sm"`. It lacks `data-overlay`. Fix: make the whole row a `<label>`, use `size-9` arrows and `size="md"` buttons.

**Bangla:**
- The status chips "All / Received / Ordered / In Transit" stay English (screenshot 10-bn, second filter row). They render lowercase data ("all", "received", "in transit"), and those strings aren't dictionary keys.
- The table's status badge "received" stays English (every row).
- Drawer: "Total payable ৳X", "{n} return(s)", "Purchase tax (5%)", and the audit actions (lowercase "created", "paid") stay English because they are interpolated or lowercase.
- PayBill: the text node "Full payable (" doesn't match the `'Full payable'` key, because "(" isn't in `SUFFIX` (`lib/bn/translate.ts:37`). "Auto-allocate (oldest first)" → "নিজে থেকেই বসান (পুরোনো আগে)" is awkward; "পুরোনো বিল আগে" reads better.

---

### New Purchase — `/purchases/new` (screenshot 11)
**Purpose:** enter a supplier's bill line by line, so stock goes in and buying prices are recorded, and optionally pay now.

**Works well:**
- The one-column layout gives the item table the full width, and the whole line fits without horizontal scroll at 1366px (screenshot 12).
- "Bought as" (dozen, gross, box) keeps the bill exact and shows "= 60 pc" under the unit. The search dropdown shows Buy / Avg / Sell before a line is added.
- "+" beside the supplier and "Add new product" let the user create missing records without leaving the page. The low-margin confirm catches bad sell prices.

**Problems:**
1. [High] Net Total and Save are two screens apart. The page header (not sticky) holds Save Unpaid / Save & Pay. Net Total is at the very bottom, below a 7-field charges card (`AddPurchase.tsx:834–926`). In screenshot 11 the viewport ends at "Discount type". With 10 lines, the buyer scrolls down to check the total and back up to save. Fix: add a sticky bottom action bar (`sticky bottom-0 border-t bg-card px-6 py-3`) with "3 items · 148 pc", **Net total ৳X** (`text-xl font-bold`), `Save unpaid` (outline, h-11) and `Save & pay` (primary, h-11). Remove the save buttons from the PageHeader and keep only Back there.
2. [High] The Reference No field does nothing, and its placeholder is invented. `purchaseInputOf` never sends `refNo` (`stores/purchases.ts:267–298`), and the backend always assigns its own (`backend/services/purchases.ts:347`). The placeholder calls `nextPurchaseRef()` on every render (:563). That is a client counter starting at 42, so it shows "PO-2026-0045" while the list already has PO-2026-0071. Fix: remove the input. In the header subtitle show "Number is given when you save". If the supplier's own invoice number matters, add a hint to the Notes field: "Supplier's invoice no., etc."
3. [High] Attach Document is a dead field. Only the file name is kept (`handleFile`, :475–479), and `attachmentName` is marked "client-side only — file uploads are not persisted yet" (`stores/purchases.ts:87`). The "Max 5MB" hint isn't enforced either. Fix: remove the Attach Document field (:609–617) until upload exists. That also frees a whole grid row.
4. [High] Barcode scan and Enter do nothing. The product search Input has no `onKeyDown` (:632–638), so a scanner's Enter (or a typed SKU + Enter) doesn't add the line. Results can only be clicked; there are no arrow keys. The page also has no initial focus. Fix: on Enter, add `matches[0]`, or the exact barcode/SKU match. Support ↑/↓ plus Enter over `matches`. After adding, return focus to the search. `autoFocus` the supplier select on a new bill, and the search once a supplier is picked.
5. [High] The line-entry table is too dense for its users: 13 columns (:677–696), 28px inputs with 14px text (`h-7 … text-xs`, :715/769/777/806), a 11px unit select (:737), and a 10px uppercase header. Product names get about 160px and wrap onto 2 lines (screenshot 12). Fix, targeting 8 columns:
   - Remove `#` (:679).
   - Merge Qty + Bought as into one "Qty" cell: `[148] [pc ▾]`, with "= 60 pc" under it at `text-xs`.
   - Move Avg buy into the Unit cost cell as a `text-xs` line under the input ("avg 176.51"), which keeps it next to the price as the comment intends.
   - Move Net cost under Line total as `text-xs` ("173.67 each").
   - Move Margin under the Sell price input as `text-xs`, keeping the colour but adding the word "margin".
   - Hide Serial behind a per-row "+ Serial no." link, or show the column only if some line already has one. A hardware shop rarely needs it.
   
   Result: Product | Qty | Unit cost | Disc % | Line total | Sell price | 🗑 (7). Inputs → `h-9 text-sm` (h-10 once there's room), header → `text-xs` normal case. Delete button `size-7` → `size-9` (:810–816).
6. [Med] The Bought-as list ignores the product's own units. `PACKS` is hard-coded (each / dozen / 2 dozen / gross / box of 10…100, :61–71), but products carry `unitConversions` set in ProductForm's Units editor (e.g. 1 bag = 50 kg, 1 box = 24 pc). A buyer who sets up "box = 24" can't pick it here. Fix: list `cat.unitConversions` first ("box (24 pc)"), then a divider, then the generic packs.
7. [Med] The header card wastes space: about 285px for 7 fields, with an empty gap under Supplier and Status alone on its own row (:522–618). Fix: one row, `grid-cols-[2fr_1.4fr_1fr]`: Supplier (with "+") | Date | Status. Below the supplier, in one `text-sm text-muted-foreground` line, show the address and the current payable ("Owes ৳X on earlier bills"), moved from the Summary box (:920–924). Hide Business Location when `branches.length <= 1` (the demo has one). Put Pay term in a "More details" disclosure together with the charges card.
8. [Med] Pay term looks like a dropdown but is free text: an `Input` with placeholder "Please Select" (:585–591). Its hint "Supplier default: Net15" repeats the value in edit mode (screenshot 12). Fix: use a `<select>` with the same options as NewSupplierModal (`TERMS`, labelled "Cash", "7 days", "15 days", "30 days", "60 days"), pre-set from the supplier. Drop the hint.
9. [Med] The Status select offers "Cancelled" on a new bill (:604), which is meaningless. Fix: show only Received / Ordered / In transit on new bills.
10. [Med] The charges card has 7 always-visible fields (:834–880). Discount is split into two fields (type select + amount). Tax %, shipping details and "other" are rarely used. Fix: one "Discount" field with a ৳/% segmented toggle inside it. Collapse Tax %, Shipping, Shipping details, Other and Notes behind `+ Add discount, shipping or other charges`, auto-opened when any value is non-zero.
11. [Med] The Save buttons are disabled with no reason (:489–499, `isValid` :355). Fix: under the disabled button (or in the sticky bar), say what's missing in plain words: "Choose a supplier" / "Add at least one item" / "Quantity can't be 0 on line 2".
12. [Med] No unsaved-changes guard. Back (`nav(-1)`, :488), or any sidebar link, throws away a half-entered bill silently. Fix: confirm "Leave without saving? The 6 lines you entered will be lost." when `lines.length > 0`.
13. [Med] The search dropdown's price triplet uses `text-[9px] uppercase` labels "BUY / AVG / SELL" (:1034) and `text-[10px]` stock info (:651). This is the smallest text in the module. Fix: labels `text-xs` sentence case ("Last buy", "Average", "Sell"), values `text-sm`, stock line `text-xs`.
14. [Low] The date field shows three calendar controls: the native datetime-local glyph, plus the clock, plus a calendar button (screenshot 11, top right). It also displays `09/30/2026, 03:11 PM` (US order) while the list shows `25/09/2026`. See cross-cutting.
15. [Low] The subtitle "Goods Received Note" is jargon on an entry form (:485). Fix: "Enter the supplier's bill. Stock goes in when status is Received."

**Remove / merge:**
- Reference No input (ignored by save). Attach Document (not stored). "Cancelled" status option on new bills.
- `#`, Serial, Avg buy, Net cost and Margin columns, merged as sub-lines into neighbouring cells (see 5).
- Discount Type + Discount Amount → one field with a ৳/% toggle.
- "Existing supplier payable" moved from the Summary to beside the supplier. Summary card + header Save buttons → one sticky bar.
- The Summary's "Total items" and "Total qty" rows → folded into the sticky bar text.

**Resize:**
- `Field` label `text-[10px] uppercase tracking-[0.06em]` (:979) → `text-xs font-medium text-foreground/80` (sentence case); hint `text-[10px]` (:983) → `text-xs`.
- Line inputs `h-7 … text-xs` → `h-9 text-sm`; unit select `h-7 text-[11px]` → `h-9 text-sm`; SKU `text-[11px]` → `text-xs`; "= 60 pc" `text-[10px]` → `text-xs`.
- `thead text-[10px] uppercase` → `text-xs` normal case. Supplier "Address" `text-[10px] uppercase` (:550) → drop the label; show the address inline as `text-sm`.
- "Add new product" `size="sm"` → `md`. Selects `h-9` → `h-10` with the shared Input.

**Popups on this screen:**

*AddPurchasePaymentModal (Save & Pay, and "Add Payment" in the drawer) — `components/purchases/AddPurchasePaymentModal.tsx`*
1. [Med] The title "Supply Payment" is awkward (BN "সরবরাহ পরিশোধ"), and the subtitle is codes (:77–78). Fix: title `Pay Berger Paints BD`, subtitle `Bill PO-2026-0069 · ৳8,32,398 still owed`.
2. [Med] The due appears twice: an "Outstanding due" box (:104–109) and the "Already paid / This payment / Still owing" box (:179–200). "Paid on" is the first field, although it's rarely changed (:96–101). Fix: order Amount (autofocused, `h-11 text-lg`) → Method → Reference → one summary box (Bill total, Already paid, This payment, **Still owing after this**) → "Paid on" last, as a small `text-sm` row ("Paid on: now · change").
3. [Med] After Save & Pay, closing this modal (Esc, backdrop or Cancel) navigates away silently, and the bill stays unpaid (`AddPurchase.tsx:932–935`). Fix: on close without paying, toast "PO-… saved as unpaid. Pay it later with Pay Bill." Change the Cancel label to `Pay later` in this flow.
4. [Low] The quick chips "Full due / Half" are `text-[10px] h-6` (:122, 128) → `h-8 px-3 text-xs`. Labels are `text-[10px] uppercase` (:97, 112, 136, 163) → 14px labels. Method tiles `text-xs` → `text-sm`. Enter doesn't submit.
5. [Low] The overpay warning is an interpolated sentence ("That is more than the ৳X still owed…", :172–177), so it stays English in Bangla mode. Fix: a static sentence plus the amount on its own line.

*NewSupplierModal — `components/purchases/NewSupplierModal.tsx`*
1. [High] A backdrop click wipes the form. `onClose` calls `reset()` (:91–94), and `ui/Modal` closes on any backdrop click, so one stray click loses name, phone, address and opening balance. Fix: don't close on backdrop when any field is non-empty (see cross-cutting).
2. [Med] It shows 8 fields where 2 are required. A jargon banner ("Phone is the de-dupe key…", :117–124) with a decorative avatar takes the top. Fix: remove the banner. Under Phone add a `text-xs` hint: "If this number is already saved, that supplier is picked instead." Show Name, Phone, Opening balance and Payment terms. Put Company, Contact person, Email and Address behind "More details". Width `max-w-2xl` → `max-w-lg`, one column.
3. [Low] The payment terms options are codes "Net7 / Net15…" (:13, 170–174). Fix: labels "Cash", "7 days", "15 days"… (values unchanged). Labels and hints are `text-[10px]` (:196, 200) → `text-xs`. Enter doesn't submit.

*NewProductDrawer + ProductForm — `components/products/NewProductDrawer.tsx`, `ProductForm.tsx`*
1. [High] Clicking the backdrop or pressing Esc discards a 20+ field form (`ui/Drawer.tsx` backdrop button) with no confirm. Fix: guard close when the form is dirty.
2. [High] The drawer shows the wrong things first for a buyer standing at the counter. At `lg:grid-cols-3` (:227, viewport-based, so it applies inside the 896px drawer) the left column opens with a ~260px square image upload (:238) and 5 behaviour toggles. The fields that matter (name, SKU, unit, sell price) sit to the right, and Wholesale/Contractor price, the Units editor and Description all show in full. Fix: when `lockStock` (purchase context), render one column in this order: Name → Category / Brand → Unit → Sell price → SKU / Barcode (auto-filled). Put Image, Status toggles, Wholesale/Contractor, Units editor, Reorder level and Description behind "More details". Width `max-w-4xl` → `max-w-xl`.
3. [Med] Save is disabled with no explanation (`isValid`, :174). SKU is required but only fillable through a `text-[11px]` "auto" link (:325–348). Fix: auto-generate the SKU when it's left blank, and show "Enter a name and a sell price" beside the disabled button.
4. [Med] The locked opening-stock hint is 3 sentences at 10px (:498). Fix: one `text-xs` line, "Comes in on the purchase line."
5. [Low] About 14 arbitrary sizes (`text-[10px]` labels/hints :640/646, `text-[11px]` subtitles/toggles/unit editor :616/709/768–791, `text-[12px]` margin :421). Unit editor inputs are `h-7`, the add-unit select is `h-8 text-xs`. Move them all to the scale (`text-xs` minimum, h-9 inputs).

**Bangla:** (screenshot 11-bn)
- The "Serial" column header stays English. The 84px "Bought as" header wraps to "যেভাবে / কিনেছেন", and "Margin" wraps to "মুনাফার / হার" (column widths are fixed px). Merging columns (problem 5) fixes both.
- "Supplier default: Net15" stays English (interpolated, :585). "Net15" is a code in both languages.
- The low-margin confirm title `${n} item(s) will have margin under 10%.` and the Summary's `Tax (5%)` are interpolated, so they aren't translatable.
- "Save Unpaid" → "পরিশোধ ছাড়াই সংরক্ষণ" and "Save & Pay" → "সংরক্ষণ করে পরিশোধ" fit at `md`, but they are long. In the sticky bar give them `min-w-[10rem]` rather than letting them wrap.

---

### Edit Purchase — `/purchases/:id/edit` (screenshot 12)
**Purpose:** an admin corrects a saved bill (prices, quantities, supplier). The bill keeps its number and its payments.

**Works well:**
- It loads by id, so a deep link can't create a second bill. Save is a single, clearly labelled `Save correction`, and a required reason goes to the audit trail.
- Permission and cancelled states get plain-sentence screens with a Back button (`AddPurchase.tsx:110–137`).

**Problems:** (everything under New Purchase applies too; these are edit-specific)
1. [High] Sell price shows "0" and Margin shows "—" on every loaded line (screenshot 12). Saved lines usually have no `newSellPrice`, so `NumberField` renders blank with its default placeholder "0" (`value={l.newSellPrice ?? 0}`, :804). That reads as "sell price is 0". Fix: set the placeholder to the catalogue price, `placeholder={cat ? formatBDT(cat.price,{withSymbol:false}) : ''}`, with a `text-xs` line under it: "blank = keep current". Compute the displayed margin against `cat.price` when `newSellPrice` is empty.
2. [Med] The status select offers options the backend rejects. A received bill can't go back to Ordered or In transit (`backend/services/purchases.ts:535`), but the select offers them, plus Cancelled (:595–606). The user only finds out after typing a reason. Fix: when `editing.status === 'received'`, render the status as read-only text "Received". Cancelling stays a drawer action.
3. [Med] The Reference No field is editable, but the correction keeps the original number (the ref is never sent, as on New Purchase). Fix: show the ref read-only in the header: title `Correct PO-2026-0071`, subtitle `Walton Electricals · entered 25 Sep 2026`, replacing "Goods Received Note".
4. [Med] Nothing shows how the correction changes what's owed. The Summary shows only Net Total, although payments stay on the bill. Fix: in the sticky bar (New Purchase problem 1) add "Paid so far ৳X · Will owe ৳Y". If the new total is below what's already paid, add a warning line: "৳Z will become an advance with the supplier".
5. [Low] Back is `variant="ghost"` beside a primary button, and there's no dirty guard (see New Purchase problem 12).

**Remove / merge:** Reference No input → read-only header text. The status select → read-only text for received bills. The "Supplier default: Net15" hint (duplicates the field value).

**Resize:** same as New Purchase.

**Popups on this screen:**
- *PromptDialog (reason for correction), `stores/prompt` → `ui/PromptDialog.tsx`:* the title `Why is ${refNo} being corrected?` (:404) is interpolated and stays English in Bangla mode ("Why is" / "being corrected?" are missing from the dictionary). Fix: a static title "Why are you correcting this bill?" with the ref in the message.
- NewSupplierModal, NewProductDrawer: as on New Purchase.

**Bangla:** (screenshot 12-bn) Same as New Purchase: "Serial" in English, "Supplier default: Net15" in English, and the header wraps. The date shows `09/25/2026, 12:18 AM` (US order) inside a Bangla UI.

---

### Purchase Returns — `/purchases/returns` (screenshot 13)
**Purpose:** list goods sent back to suppliers and what was refunded or credited.

**Works well:**
- Few columns, right-aligned refund amount, a pager with full-height labelled buttons.
- Search covers the return ref, the original bill and the supplier.

**Problems:**
1. [High] It's a dead end: there's no way to start a return from here, and the empty state "No purchase returns recorded." (`PurchaseReturns.tsx:131`) doesn't explain how. Returns can only be created from a bill's drawer (PurchaseDetail → Create Return). Fix: empty-state copy "To send goods back, open the purchase and choose Create return.", plus a primary `Go to purchases` button. In the PageHeader add `Back to purchases` (outline).
2. [Med] "Refund via" shows raw enum codes: `<Badge>{r.refundMethod}</Badge>` (:112) prints "CashRefund" / "CreditAdjust". Reason uses `capitalize` on slugs (:110), which gives "Wrong-item" and "Short-shipped". Fix: map both through the label tables already in `CreatePurchaseReturnModal.tsx:21–35` (export `REASONS`/`REFUND` and reuse them).
3. [Med] The subtitle `${n} returns · ৳X refunded` (:65) counts credit adjustments as "refunded", although no money came back. It also doesn't translate. Fix: "3 returns · ৳X cash back · ৳Y taken off dues", built from translatable static labels.
4. [Low] Only the `size-7` eye opens a return (:117–123); the row itself isn't clickable. Fix: make the row clickable (`cursor-pointer`, `onClick`) like the Purchases list, and remove the eye.
5. [Low] The header is `text-[11px] uppercase` (:89). Date is `toLocaleString('en-GB')` with seconds at `text-xs` (:102–104). Ref and original are `font-mono text-xs`. Fix: header `text-xs` normal case, date as `toLocaleDateString('en-GB')` in `text-sm`, refs `text-sm`.
6. [Low] The search box sits alone in a full-width Card (:69–79). Fix: drop the Card wrapper; put the search (`max-w-md`) in the PageHeader actions row.

**Remove / merge:** the Eye column (row click replaces it); the search Card wrapper.

**Resize:** `thead text-[11px] uppercase` → `text-xs`; cells `text-xs` → `text-sm`; Badge `text-[10px]` → `text-xs`; eye `size-7` → gone.

**Popups on this screen:** `ReturnDetail` (`components/returns/ReturnDetail.tsx`) is shared with sales returns and not in this group's list, so it wasn't reviewed here.

**Bangla:** (screenshot 13-bn)
- The pager footer reads "না ফেরত". `Pagination.tsx:48` renders `No {label}` as two text nodes, "No " and "returns", which translate word by word into broken Bangla. Fix in the shared component: one full string per state, e.g. `label` passed as a complete phrase ("No returns yet").
- The subtitle "0 returns · ৳ 0.00 refunded" stays English.
- Refund-method codes ("CashRefund") would show in English once rows exist.

---

## Cross-cutting patterns seen in this group

- **Local `Field` with 10px uppercase labels, copied into every form.** `text-[10px] uppercase font-semibold tracking-[0.06em]` labels and `text-[10px]` hints appear in `AddPurchase.tsx:979–983`, `NewSupplierModal.tsx:196–200`, `ProductForm.tsx:640–646`, plus inline copies in `PayBillModal.tsx`, `AddPurchasePaymentModal.tsx` and `CreatePurchaseReturnModal.tsx`. Fix once: add `ui/Field.tsx` (label `text-xs font-medium` sentence case, required marker, hint `text-xs`, error slot) and replace all six copies. This group has about 58 arbitrary-px text sizes, and every one bypasses the font-scale slider.
- **Raw `<select>` with hand-copied `h-9 … text-sm` classes.** `AddPurchase.tsx` (4×), `Purchases.tsx` (2×), `PayBillModal.tsx`, `CreatePurchaseReturnModal.tsx`, `NewSupplierModal.tsx`, `ProductForm.tsx` `Select`. Fix: add `ui/Select.tsx` sharing the Input's height (move both to `h-10`).
- **Modal/Drawer lose typed work on a stray click.** `ui/Modal.tsx` and `ui/Drawer.tsx` close on any backdrop click and have no initial focus or focus trap. That affects NewSupplierModal (it even resets the fields), NewProductDrawer, PayBillModal, AddPurchasePaymentModal and CreatePurchaseReturnModal. Fix: add a `dirty` (or `closeOnBackdrop={false}`) prop to both primitives, autofocus the first field, and wrap the body in a `<form onSubmit>` so Enter runs the primary action.
- **Payment-method tile grid duplicated three times.** `METHODS` with identical `h-12 text-xs` tiles lives in `PayBillModal.tsx:17–24`, `AddPurchasePaymentModal.tsx:13–20` and `contacts/ReceivePaymentModal.tsx`, and the same toggle copy ("Auto-allocate (oldest first)") appears in both allocate modals. Fix: add `ui/PaymentMethodPicker.tsx` (tiles `h-12 text-sm`, the reference field built in) and one shared "where the money goes" allocation table covering the opening balance, bills, advance and "still owed after".
- **Codes and enums shown as text.** Titles such as `refNo` in PurchaseDetail and CreatePurchaseReturnModal, lowercase status via `replace('-',' ')` + `capitalize` (`Purchases.tsx:319, 507`, `PurchasePrintModal.tsx:101`), raw `refundMethod`/`reason` (`PurchaseReturns.tsx:110–112`), and audit `a.action` (`PurchaseDetail.tsx:260`). None of these translate. Fix: one `labels.ts` with `PURCHASE_STATUS_LABEL`, `REFUND_LABEL`, `REASON_LABEL` and `AUDIT_LABEL` (all dictionary keys), and use it everywhere.
- **Interpolated sentences that can't be translated.** `Supplier default: ${x}`, `Create Purchase Return — ${ref}`, `Supplier: ${name}`, `Why is ${ref} being corrected?`, `${n} item(s) will have margin under 10%.`, `${n} returns · ${x} refunded`, `Full payable (${x})`, `Total payable ${x}`, and `Pagination`'s `No {label}` / `of {n} {label}`. Fix: static label text plus the value in its own element. Separately, add "(" to `SUFFIX` in `lib/bn/translate.ts:37` so "Full payable (" is caught.
- **Row/footer controls below target.** `Button size="sm"` (h-7) is used for page-header and drawer-footer actions (`Purchases.tsx`, `PurchaseDetail.tsx` 7×, `ColumnsPanel`). Icon row actions are `size-7` (`Purchases.tsx:391/400`, `PurchaseReturns.tsx:118`, `AddPurchase.tsx:813`). Fix: make `sm` h-8 / `md` h-10 in `ui/Button.tsx`, and make row icon buttons `size-9` with `aria-label`.
- **`Badge` at 10px and wrapping.** `ui/Badge.tsx` `text-[10px]` without `whitespace-nowrap` produces a 2-line "Part paid" (screenshot 10). `info` = primary on primary/15 measures 3.0:1. Fix: `text-xs whitespace-nowrap`, and darken or lighten the `info` foreground to reach 4.5:1.
- **`text-primary` used for small data text.** "Avg buy" values (`AddPurchase.tsx:762`) and the Total Value KPI measure 3.44:1 on the dark card. Fix: use `text-foreground` for data and keep primary for large headings and links only.
- **DateTimeField: three calendar affordances and US date order.** The native `datetime-local` glyph, the clock and the calendar button all show together (`ui/DateTimeField.tsx:84–119`, screenshot 11). The field renders `mm/dd/yyyy` while every list prints `en-GB` `dd/mm/yyyy`. Fix: hide the native indicator (`[&::-webkit-calendar-picker-indicator]:hidden`, since the explicit button already calls `showPicker()`). Set the renderer locale to en-GB in the Electron shell (`app.commandLine.appendSwitch('lang', 'en-GB')`) so native date inputs match the lists.
- **Main actions scroll away on long forms.** PageHeader isn't sticky on AddPurchase, and the totals sit at the bottom. The same pattern likely applies to `AddSale.tsx`, `AddStockTransfer.tsx` and `AddStockAdjustment.tsx`, which share the `Field`/layout copy. Fix: add a shared `ui/StickyActionBar.tsx` (total + primary/secondary buttons) for document-entry pages.
- **No empty-state guidance.** "No purchases match.", "No purchase returns recorded.", "Search above to add items." (`AddPurchase.tsx:823`), and PayBill with no suppliers owed. Fix: `ui/EmptyState.tsx` already exists; use it with a next-step button.
