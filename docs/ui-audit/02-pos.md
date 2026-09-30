# Findings — POS counter (`/pos`)

Size notes used below:
- `src/styles/globals.css:458-461` sets `.font-mono { font-size: max(1em, .8125rem) }`. It is unlayered and lands AFTER the utilities in the built CSS (`dist/assets/index-*.css`: `.text-2xl` at byte ~34k, this rule at ~50.7k). So on any element that has `font-mono`, the `text-*` size class is ignored and the element takes its parent's size (usually 16–17px). Container-query sizes (`[@container…]:text-2xl`) come later still, so they win. This is why the product card's SKU renders larger than its name (see d.1).
- `Badge` is `text-[10px]`, remapped to 13px (Badge.tsx:23). That is below the 14px floor.
- Layout at 1366×768 with the sidebar open: content ≈1118px, `cartRatio` 0.65 (stores/pos.ts:29), so the cart is ≈727px and products ≈391px. It stacks only below `lg` (POS.tsx:601).

---

### POS counter — `/pos` (screenshot 02)
**Purpose:** ring up a sale fast (scan or pick items, set the customer and price group, take payment, print) and hold or park carts while the next customer waits.

**Works well:**
- One very clear primary action: Pay is `h-14`, full-width-ish and the loudest control (CartPanel.tsx:637-652). F8 is shown on it.
- Total Payable is the biggest number on screen (25px via the container rule), and it truncates instead of overflowing.
- Order charges are collapsed by default and forced open with an "Applied" badge when set (CartPanel.tsx:108-121). A line discount can never hide.
- Scanner flow: any printable key goes to the search box, Enter adds the exact barcode/SKU match, and there is a guard so keys never leak behind a modal (ProductPanel.tsx:73-96, :389-396).


#### (a) Cart header: tabs, customer, price group, scanner hint
**Problems:**
1. [High] Held carts are invisible. Suspend (F9) moves the cart into `held`, and the only ways back are F5 or ⋯ → "Held carts" (CartPanel.tsx:548-557). Nothing on screen says "2 customers are waiting", so held carts get forgotten. Fix: pass `held.length` into CartPanel and render a `Held (2)` button (`h-9 px-3 text-sm`, warning tint) in the tab strip, left of `+`, whenever held > 0. It opens HeldList.
2. [High] One click on a tab's X deletes a full cart. The X is a bare `size-3.5` icon (14px) inside the tab (CartPanel.tsx:161-167) → `closeCart` (posCart.ts:166), with no confirm and no undo. Fix: show the X only on the active or hovered tab, give it a real `size-6` button, and when `lines.length > 0` ask "Close Cart 2? 4 items will be removed." (or give an Undo toast).
3. [High] The price-group toggle is 12px English. It uses `text-2xs` plus CSS `capitalize` on the raw keys `retail/wholesale/contractor` (CartPanel.tsx:210-226). The text node is lowercase, so the Bangla layer never matches it and it stays "Retail Wholesale Contractor" in the Bangla screenshot. Fix: `text-sm font-medium`, with a label map `{retail:'Retail', wholesale:'Wholesale', contractor:'Contractor'}` rendered as whole text nodes, and dict entries (খুচরা / পাইকারি / ঠিকাদার). Make the active segment stronger: `bg-primary/15 text-primary ring-1 ring-primary/40` instead of `bg-card` on `bg-secondary`, which is hard to see in light theme.
4. [Med] The customer button's subtitle is `{phone} · {group}` (CartPanel.tsx:193-195). Walk-in has no phone, so it reads "· Retail" (screenshot). The group repeats the toggle beside it, and it can contradict it: picking a Wholesale customer only sets `customerId` (POS.tsx:309-311), and the toggle stays on Retail. Fix: subtitle = phone only, hidden when empty; on select, set `priceGroup` from `customer.group` when it is one of the three. Name `text-xs` → `text-sm font-semibold`. Show "F3" as a `kbd` on the button (today it is only in the tooltip).
5. [Med] The scanner hint box (CartPanel.tsx:228-231) is a dashed, non-clickable box that looks like an input. Its 12px text is truncated to "Scanner ready · or press F2 to s…" (screenshot), and it repeats the same message found in 3 other places: the Scan button, the search placeholder "(F2)", and the empty-cart hint "Press F2 to focus search". Fix: delete it. Change the strip grid from `md:grid-cols-3` to `grid-cols-[1fr_auto]` so the customer name gets the width.
6. [Low] Tabs are `h-8 text-xs`, and the item count is `text-2xs` (12px) (CartPanel.tsx:148-158). → `h-9 text-sm`, count `text-xs`. The label "Cart 1" comes from the store as an interpolated English string and stays English in Bangla. Render it as `t('Cart')` + number.
7. [Low] The fallback `customers.find(...) ?? customers[0]` (CartPanel.tsx:99) can show some other customer's name while the list loads or when the id is missing. Fall back to the literal "Walk-in customer".

**Remove / merge:** scanner hint box; group in the customer subtitle; the leading "·".
**Resize:** tabs `h-8 text-xs` → `h-9 text-sm`; tab close `size-3.5` icon → `size-6` button; customer name `text-xs` → `text-sm`, phone `text-2xs` → `text-xs`; price toggle `text-2xs` → `text-sm`; Due badge `text-[10px]` → `text-xs`.
**Bangla:** "Cart 1" and "Retail / Wholesale / Contractor" stay English (screenshot bn). "সাধারণ গ্রাহক · খুচরা" fits.


#### (b) Cart lines (CartLineRow)
Height of one collapsed line, from the classes: `my-1.5`, `py-2.5`, head row 56px (trash `size-8` under the total), `mt-2.5` + field row 60px (label + `h-11`), `mt-2` + cost strip ≈54px, `mt-2` + computed strip ≈17px. That is ≈245px. The list area at 1366×768 is ≈368px (screenshot y≈158–526), so **1½ lines are visible**. With 5–15 items the cashier sees 1–2 at a time. When the charges expander is open, the area drops below one line.

**Problems:**
1. [High] The line card is too tall for a counter (numbers above), and the scrollbar is hidden (`scroll-hide`, CartPanel.tsx:235). A new line is appended off-screen at the bottom, with no scroll-into-view. Re-scanning an item that is already in the cart bumps the qty on a row that may be out of sight (POS.tsx:259-262). Fix: at container width ≥ 560px, lay each line out as ONE row, ≈60px: `# (w-6 text-xs muted) | name text-sm font-semibold + SKU text-xs muted | qty stepper h-10 | unit | price h-10 | line total text-base font-semibold tabular right | trash size-9`. Show column labels once, as a sticky header row `text-xs` above the list, instead of per row. Keep the current stacked card only below 560px. Remove `scroll-hide`. After add or increment, `scrollIntoView({block:'nearest'})` the line and flash `bg-primary/10` for about 1s. About 6 lines then fit.
2. [High] You cannot type a decimal quantity. Qty is a raw `<input value={line.qty} onChange={Number(v)||0}>` (CartLineRow.tsx:150-151). Typing "2." re-renders as "2", so 2.5 kg of nails or 1.5 ft of pipe cannot be entered. Minus stops at 0 (:143), which leaves a zero-qty line in the sale. Fix: use the existing `NumberField` (as the price field does) with `inputMode="decimal"` and select-all on focus. Minus disabled at the smallest step; qty 0 → remove the line (with Undo).
3. [High] Buying price and average buying price sit on every line in amber and blue, on the screen the customer faces (CartLineRow.tsx:240-272). The customer at the counter can read the shop's cost. It is also three more numbers per line with 12px labels. Fix: hide the cost strip by default. Add "Show buying price" in the ⋯ menu (per session), or show it only while a key such as Alt is held. When hidden, keep one warning: a red `Below cost` badge when selling price < cost.
4. [High] The price the cashier bargains on is the smallest control on the line: the selling-price field is `h-7 text-xs` (CartLineRow.tsx:255-269), next to a 44px qty stepper. Fix: `h-10 text-sm font-semibold text-right`, labelled "Price", in the main row (see 1).
5. [Med] The unit price shows three times per line: "SPR ৳ 80.00" in the meta line (:87), the "Selling price" field (:254), and the computed strip "৳ 80.00 × 2 pc" (:293-305). "SPR" is jargon and has no Bangla. Fix: drop SPR from the meta line and drop the computed strip. Qty × Price = Total is already visible in the one-row layout. Keep the "saved ৳x" text as a green `text-xs` under the line total only.
6. [Med] Per-field labels are `text-2xs font-semibold uppercase tracking-[0.06em]`, i.e. 12px uppercase: FieldBox (CartLineRow.tsx:347) and ChargeInput (CartPanel.tsx:447). "Disc ৳" and "Disc %" are abbreviations. Fix: `text-xs font-medium` sentence case, "Discount %" and "Discount ৳". In the one-row layout they become column headers.
7. [Med] The thumbnail is decorative. It is always a generic `Package` icon at 48px (CartLineRow.tsx:70-76), since there is no product image, and the line number is hidden in a `size-4 text-2xs` dot on its corner. Remove it; the line number becomes the first column.
8. [Med] The unit `<select>` changes only the label. Price and stock ignore it, because `unitFactor` is deferred (POS.tsx:43-47), so switching pc → box keeps the per-piece price. Fix: when `availableUnits.length <= 1`, render the unit as plain text next to the qty. Hide the select until conversion is wired.
9. [Low] The price-override notice is a 12px sentence that truncates: "Price changed for this sale only — the product's…" (CartLineRow.tsx:274-291). → a `Badge` "Price changed" + `text-xs` "Undo" link; the full sentence goes in `title`.
10. [Low] Remove is `size-8` with no undo (CartLineRow.tsx:126-132). → `size-9`, plus a toast "Removed 1-Gang Switch · Undo".
11. [Low] In the meta line, SKU and SPR are `text-2xs font-mono`, but they render at 16px (global mono rule). That is the same size as the name, so the line hierarchy is flat. It is fixed by 1 and the cross-cutting mono fix.

**Remove / merge:** thumbnail; "SPR" meta; computed "৳ × qty" strip; the cost strip, which moves behind a toggle; per-row field labels, which become one header row.
**Resize:** selling price `h-7 text-xs` → `h-10 text-sm`; qty stepper `h-11` → `h-10` (so the row matches); labels `text-2xs uppercase` → `text-xs`; line total `text-sm font-medium` → `text-base font-semibold`; index dot `size-4 text-2xs` → plain `text-xs` column; trash `size-8` → `size-9`.
**Bangla:** "SPR", "Disc ৳" and "Disc %" are abbreviations with no clean translation. PriceCell labels are whole-phrase nodes and translate. The long override sentence will truncate even sooner in Bangla.


#### (c) Totals + bottom action bar (Suspend, Multi-Pay, ⋯, Pay F8)
The footer is ≈240px tall (screenshot y≈526–768), 31% of the viewport. With "Discounts & charges" open, it grows by ≈190px (five `h-11` inputs + labels in a 2-col grid, CartPanel.tsx:308), and the list area falls to ≈180px.

**Problems:**
1. [High] "Multi-Pay" does the same as Pay. It calls `openSplitPay`, which sets `startMode='split'` (POS.tsx:363-372), but PaymentModal never reads `startMode`: it is not destructured (PaymentModal.tsx:136-146). Both buttons open the same single-amount screen. Fix: delete the Multi-Pay button (CartPanel.tsx:385-391). The modal's own "Part of it another way" already splits; make that link a real button (see e.3). That frees ≈110px (≈180px in Bangla) for Pay.
2. [High] Pay, Suspend and ⋯ look fully enabled on an empty cart, and Pay F8 silently does nothing (`openPay` returns early, POS.tsx:353). Fix: `disabled={active.lines.length === 0}` on Pay and Suspend, with `title="Add an item first"`.
3. [Med] "Clear cart" in ⋯ wipes the cart with no confirm or undo (CartPanel.tsx:587-594 → posCart.ts:182). It sits two rows under "Save as Quotation". Fix: ConfirmDialog "Remove all 6 items from Cart 1?" when lines > 0, or an Undo toast.
4. [Med] The ⋯ menu mixes daily actions with a one-time preference. "Swap panel side" (CartPanel.tsx:578-585) is a layout setting, so move it to Settings → POS. The menu keeps Held carts (F5), Save as draft (F6), Save as quotation (F7), a separator, then Clear cart.
5. [Med] Shortcut keys are only in tooltips. On screen only "F8" is visible. F3 (customer), F5, F6, F7, F9 and F10 appear only in `title`, and the `?` overlay (POS.tsx:532) is undiscoverable. Fix: a visible `kbd` (`text-xs`, muted) on each control: "Hold F9", "+ F10", customer "F3". Add a "Keys ?" ghost button `size="md"` in the cart header that opens ShortcutsOverlay.
6. [Med] One concept has three names: button "Suspend", menu "Held carts", comment "hold". Bangla "স্থগিত করুন" (postpone) is formal and long. Fix: "Hold" / "Held carts", Bangla "রেখে দিন" / "রাখা কার্ট".
7. [Med] Subtotal is shown even when it equals Total (no discounts or charges), so the same number appears twice (screenshot: "৳ 0.00" and "৳0.00"). The symbol spacing also differs: `formatBDT` gives "৳ 0.00", and the Total builds "৳" + number with `mr-0.5` (CartPanel.tsx:271, :364-368). Fix: render the Subtotal row only when `totals.total !== totals.subtotal`. Use one money format.
8. [Med] The charges editor pushes the cart lines off screen. Fix: open it as a Popover anchored above the "Discounts & charges" button (like ⋯ opens upward), with a 3-col grid of `h-10` inputs. Relabel the fields in full: "Discount %", "Discount ৳", "VAT %", "Delivery ৳", "Other ৳". Keep the "Applied" badge and the breakdown rows.
9. [Low] Compact buttons are `h-11` but `text-xs` (CartPanel.tsx:487). → `text-sm`. The Total box label "Total Payable" → "Total" (shorter in both languages; "মোট প্রদেয়" is fine too).

**Remove / merge:** Multi-Pay button; Subtotal row when there are no adjustments; "Swap panel side" from ⋯, moved to Settings.
**Resize:** compact buttons `text-xs` → `text-sm`; charge inputs `h-11` → `h-10` in a popover; charge labels `text-2xs uppercase` → `text-xs`; menu `kbd` `text-2xs` → `text-xs`.
**Bangla:** "একাধিক মাধ্যমে পরিশোধ" (Multi-Pay) is ≈180px and shrinks Pay (screenshot bn). Removing the button solves it. The other labels fit.

#### (d) Product panel (ProductPanel)
**Problems:**
1. [High] The SKU is larger than the product name on every card. The SKU is `text-2xs font-mono` (ProductPanel.tsx:278), but the global `.font-mono{font-size:max(1em,…)}` rule overrides `text-2xs`, so it renders at the button's 16px. The name is `text-xs` = 14px (:281). The same rule makes the price `text-lg font-mono` (:288) 16px instead of 19px, so the price is not the biggest text, although the comment says it is. Fix: order the card as name (`text-sm font-semibold line-clamp-2`) → brand + SKU on one muted line (`text-xs`, no `font-mono`) → price (`text-lg font-bold tabular`, no `font-mono`).
2. [High] Only 4 cards are fully visible (2×2) at 1366×768 with the sidebar open (screenshot). The panel is ≈391px, and `minmax(170px,1fr)` (:243) gives 2 columns. Each card is ≈235px tall, because the image box is `aspect-[4/3]` (≈135px) around a 64px emoji (:262-263). Collapsing the sidebar still gives 2 columns (needs ≥530px for 3). Fix: compact card with image box `h-16` and `ProductImage size={40}`, and stock badge inline next to the price. That gives ≈140px cards and ≈6–8 visible. Default `productView` to `'list'` when the panel is < 480px wide; list rows are ≈64px, so ≈8 visible.
3. [High] Categories past the second chip cannot be reached with a mouse wheel. The chip strip is `overflow-x-auto scroll-hide` with a fade (ProductPanel.tsx:199-217). A vertical wheel does not scroll it, and there is no scrollbar, so on Win7 with a plain mouse "Plumbing", "Tools" and the rest are clipped (screenshot: third chip cut at the edge). Fix: `flex-wrap` capped at 2 rows (`max-h-[5.5rem] overflow-y-auto`), or replace the strip with a `<select>` "Category" next to Filters. Chips `py-1.5 text-xs` (≈32px) → `h-9 px-3 text-sm`.
4. [Med] The search box, which is the scanner's target, is the smallest input on the page: `h-9 text-xs` with a `size-3.5` icon (:138-151). The "Scan" button beside it (:126-136) only clears and focuses that same box, so there are two controls for one job. Fix: remove the Scan button. Make the input `h-11 text-sm pl-10`, icon `size-4`, placeholder "Scan or type name / SKU (F2)".
5. [Med] Enter adds the first partial match with no preview. `bestMatch` falls back to the first name or SKU `includes` (POS.tsx:282-293), so typing "switch" + Enter adds whichever switch comes first in the catalogue. Fix: highlight the card or row that Enter will add (`ring-2 ring-primary`), and show a line under the input: "Enter adds: 1-Gang Switch · 80.00".
6. [Med] "Allow selling without stock" is a shop policy, but it sits as a per-device toggle in the product filter popover that any cashier can flip (ProductPanel.tsx:478-484). Move it to Settings → POS behind a permission. The popover keeps Brand and "Show finished items".
7. [Med] The view and filter controls are undersized. The Grid/List toggle is `px-2 py-1 text-xs` (≈28px) (:158-180), and Filters is `h-8 text-xs` (:438). The count "24 of 24" (`text-2xs font-mono`, rendering at 16px) is noise when no filter is on. Fix: toggle `h-9 text-sm`, or icon-only `size-9` with tooltips; Filters `h-9 text-sm`; show the count only when narrowed ("12 shown").
8. [Low] Brand is `text-2xs` (12px) (:284). List view: thead `text-2xs uppercase` (:313), SKU and brand `text-2xs` (:348, :351). Card stock and "No stock" badges are 13px, and "No stock" repeats the red "0 pc" badge (:267-274). → `text-xs`; drop the second badge.
9. [Low] The splitter handle is a 4px line whose grip shows only on hover (Splitter.tsx:65-69), so it is hard to find and grab. → `w-2`, grip always visible at 40% opacity.

**Remove / merge:** Scan button (merge into the search input); "No stock" second badge; "24 of 24" when unfiltered; "Allow selling without stock" → Settings.
**Resize:** search `h-9 text-xs` → `h-11 text-sm`; view toggle and Filters → `h-9 text-sm`; cat chips → `h-9 text-sm`; card name `text-xs` → `text-sm`; SKU → `text-xs` non-mono under the name; card image `aspect-[4/3]` → `h-16`; `minmax(170px…)` → `minmax(150px…)`.
**Bangla:** category names ("Building Material", "Electrical") are data and stay English, which is fine. Brand "Generic" becomes "সাধারণ" (data translated by the dict, inconsistent with other brands). "24 এর 24" fits. Placeholder "নাম / এসকেইউ / বারকোড (F2)": "এসকেইউ" is a transliteration nobody reads; use "কোড".


**Popups on this screen:**

#### (e) PaymentModal — `src/components/pos/PaymentModal.tsx` (Pay / F8)
**Works well:** it asks one question ("How much is the customer paying now?") and states the result in words (change / still owes / paid in full). The quick tenders are computed from the bill (:125-134). "Nothing now" replaces the old Credit method. A walk-in due is blocked, with a one-click "Choose customer" fix.

**Problems:**
1. [High] Every money figure in the modal loses its size. The bill total (`text-3xl font-mono`, :242), change and still-owes (`text-3xl font-mono`, :396, :411), and the amount input (NumberField carries `font-mono` in its base class, NumberField.tsx:57, plus `text-3xl` here, :256-260) are all overridden by the global `.font-mono{font-size:max(1em,…)}`. Per the built CSS order they render at ≈16px, inside a `h-16` box. I have not seen this rendered; the conclusion comes from the cascade. Fix: see the cross-cutting mono fix. Until then, use `font-sans tabular` on these four elements.
2. [High] Enter does not confirm. There is no `<form>` and no key handler, and pressing F8 again only re-runs `openPay` (POS.tsx:557-560). The cashier must reach for the mouse for every sale. Fix: wrap the body in `<form onSubmit={confirm}>` so Enter in the amount field confirms when `canConfirm`, and make F8 inside the open modal = confirm. Show "Enter" as a `kbd` on the confirm button.
3. [Med] The amount is prefilled with the total and autofocused, but not selected (NumberField has no select-on-focus). Typing the note the customer handed over ("1000") appends to "780" → "7801000". Fix: `onFocus={(e) => e.currentTarget.select()}` on this field (or in NumberField for all).
4. [Med] The confirm button label is an interpolated English sentence: "Take ৳12,450.00 · give ৳550.00 change" (:206-214). The Bangla layer cannot translate it, and its width changes as you type (`min-w-48`). Fix: fixed label "Confirm sale" / "বিক্রি নিশ্চিত করুন" at `h-12 text-base`. The outcome panel already states the money consequence. If a second line is wanted, build it from separately translated nodes.
5. [Med] Split payment is a 14px text link with a 12px icon, "Part of it another way (cash + bKash)" (:346). It shows only when amount > 0. Split rows have no labels, the reference is `text-xs font-mono` with placeholder "TxID/note", and the trash is `size-3.5` (:444-491). Fix: `Button variant="outline" size="md"` "Split payment"; a header row "Method · Amount · Reference" `text-xs`; reference `text-sm`; trash `size-9` with icon `size-4`; a "Still to pay ৳x" line under the rows.
6. [Med] The "Paid by" tiles vanish when the amount is 0 (:294), so the layout jumps while typing. Tile labels are `text-xs` (:308). Keep the tiles visible (disabled at 0) and set labels to `text-sm`.
7. [Med] A stray backdrop click closes the modal and loses a typed split or reference (Modal.tsx:42). With no focus trap, Tab walks out into the cart behind it. Fix in Modal (cross-cutting).
8. [Low] The footer hint "Esc cancel" (:225) duplicates Cancel, so remove it. "Choose customer" and "Take the full … instead" are `size="sm"` (h-7) (:379, :383) → `md`. Width `max-w-2xl` → `max-w-xl` (the content is ≈520px). Title "Take payment" → "Take payment from Rahim" when a customer is named.

**Bangla:** the confirm label, "Who owes the ৳x?" (:368), "{name} will still owe", "Already owed ৳x · khata becomes ৳y" (:417) and the over-limit sentence (:425) are all interpolated, so they stay English. Split each into a translated phrase node plus a separate number node.

#### (f) ReceiptModal — `src/components/pos/ReceiptModal.tsx` (after a sale; Ctrl+P)
**Problems:**
1. [High] "Re-print Last" does nothing. `onReprint` is an empty function (POS.tsx:737-739). Ctrl+P already reopens the last receipt. Fix: remove the button.
2. [High] It is slow for the next customer. Nothing is focused (Modal sets no initial focus), there is no Enter or keyboard path, and the Settings toggle "Auto-print receipt on save" (`autoPrintOnSave`, settings.ts:219) is never read by POS or ReceiptModal, so it has no effect. Fix: honour `autoPrintOnSave` (call `window.print()` on open). Make the primary action "Print & new sale" (autofocused, Enter), then "New sale" (outline, `N`), then "Save as PDF" (ghost). All `size="md"`, primary `lg`.
3. [Med] The title "Receipt Preview", with the invoice code as the subtitle, is not what the cashier needs to read. → "Sale saved · INV-3155", and the subtitle "Paid ৳12,450 · change ৳550" or "৳2,450 on Rahim's khata".
4. [Med] `width="max-w-3xl"` (768px) whatever the paper. An 80mm receipt (≈300px) sits in a wide grey `bg-muted py-6` band. Fix: width from `usePaperWidth()`: 58/80mm → `max-w-md`, A5/A4 → `max-w-3xl`. The body scrolls while the footer stays visible (Modal has `max-h-[90vh]`, good).
5. [Low] The footer has four outline/primary buttons in two groups (:98-114). After removing Re-print it is three, right-aligned, primary last.

**Bangla:** "Receipt Preview", "Save as PDF" and "New Sale" are static and translate. The receipt body itself (Receipt.tsx) is out of scope here.

#### (g) HeldList — `src/components/pos/HeldList.tsx` (F5 / ⋯ → Held carts)
**Problems:**
1. [High] Resume silently overwrites the current cart. `resumeHeld` replaces the active slot with the held cart (posCart.ts:212-221), so anything already in the active cart is lost without a warning. Fix: if the active cart has lines, resume into a new tab (`addCart` then load), or swap the current cart into held. Toast "Resumed Rahim's cart in Cart 2".
2. [High] The subtitle promises "Enter resumes the highlighted cart" (HeldList.tsx:32), but no row is ever highlighted and there is no Enter handler. Fix: highlight the first row, ↑/↓ to move, Enter to resume. Otherwise drop the sentence.
3. [Med] Held carts cannot be told apart. The label is the slot's ("Cart 1" for every cart held from slot 1). The meta line is `text-[11px]`: "Walk-in · 3 items · retail", with the raw lowercase group and an interpolated count (:59-61). There is no time held. Fix: a `heldAt` stamp on the frontend ParkedCart; row = customer name `text-sm font-semibold`, "10:42 · 5 min ago" `text-xs`, and the first two item names `text-xs` muted; total `text-base`.
4. [Med] Resume (`h-8 text-xs`) and the trash icon (`size-8`, icon `size-3.5`, no confirm) sit side by side (:70-80). Fix: Resume `Button size="md"`; Discard as a `ghost` button with a gap before it and a confirm ("Discard Rahim's held cart, 3 items?").
5. [Low] Title "Held / Parked Carts" → "Held carts (3)". Remove the decorative Receipt tile (:54-56). Show the search box only when there are more than 5 held carts. `scroll-hide` hides the scrollbar.

#### (g) CustomerPicker — `src/components/pos/CustomerPicker.tsx` (F3 / customer button)
**Problems:**
1. [Med] It is mouse-only after typing. The search is autofocused, but Enter picks nothing and ↑/↓ do nothing (:85). Fix: highlight the first match; Enter selects; ↑/↓ move. If there is no match, Enter opens "New" with the typed text prefilled: the name if it is letters, the phone if it is digits.
2. [Med] Picking a Wholesale or Contractor customer leaves the cart on Retail prices (POS.tsx:309-311). Fix: set `priceGroup` from `customer.group` on select (see a.4).
3. [Med] Row text is small and noisy: decorative initials avatar `text-[11px]` (:119-125); phone `text-[11px] font-mono` (:140); "Limit ৳x" `text-[10px]` (:151); a group badge and an "Over limit" badge at 13px. Fix: drop the avatar; phone `text-sm tabular` (not mono); due `text-sm font-semibold` right-aligned; limit `text-xs`; keep the over-limit badge at `text-xs`.
4. [Med] New-customer form labels are `text-[10px] uppercase` (:194, :198, :202), and an empty phone is saved as "-" (:185), which then appears as the phone everywhere. Fix: `text-xs font-medium` sentence case, "Name (required)"; send an empty phone as empty; group buttons `text-sm`. The form fits `max-w-lg`.
5. [Low] The subtitle "F3 from POS" is a developer hint. Remove it, or show "F3" as a `kbd` on the POS customer button. Title "Select Customer" → "Choose customer". Remove `scroll-hide` from the list (:97). Pin "Walk-in (no name)" as the first row so the cashier can undo a pick.

**Bangla (popups):** HeldList "{n} items" and the `priceGroup` key stay English. CustomerPicker `No customers match "{q}"` is interpolated. Group badges ("Retail" etc.) translate because they are capitalized whole words.


**Remove / merge (whole screen):**
- Duplicate "scan / F2" hints: keep only the search placeholder. Remove the cart scanner box (CartPanel.tsx:228-231), the Scan button (ProductPanel.tsx:126-136) and the empty-cart "Press F2 to focus search" line (CartPanel.tsx:241). Change the empty-cart copy to "Scan a barcode or click a product →".
- Multi-Pay button (a duplicate of Pay); Re-print Last (no-op); Subtotal row when it equals Total.
- Per line: thumbnail, "SPR", the computed "৳ × qty" strip, and the always-on cost strip (goes behind a toggle).
- "Swap panel side" and "Allow selling without stock" → Settings → POS.

**Resize (whole screen):** cart tabs → `h-9 text-sm`; price toggle `text-2xs` → `text-sm`; line price input `h-7 text-xs` → `h-10 text-sm`; line row ≈245px → ≈60px (one-row layout); search `h-9 text-xs` → `h-11 text-sm`; view toggle, Filters and category chips → `h-9 text-sm`; product card image `aspect-[4/3]` → `h-16`; HeldList Resume `h-8 text-xs` → `Button md`; PaymentModal `max-w-2xl` → `max-w-xl`; ReceiptModal `max-w-3xl` → by paper width (`max-w-md` for 80mm).

**Bangla (whole screen):** English remains in "Cart 1", "Retail / Wholesale / Contractor", the HeldList meta line, and every interpolated sentence in PaymentModal and the toasts in POS.tsx (`Sale ${invoiceNo} recorded`, `Not enough stock for ${name}`, :340, :435). "এসকেইউ" in the search placeholder should be "কোড". Nothing clips in the first viewport, but Multi-Pay's Bangla label squeezes Pay.

---

## Cross-cutting patterns seen in this group
- **The global mono rule defeats every size class on mono text.** `globals.css:458-461` `.font-mono{font-size:max(1em,.8125rem)}` is unlayered and emitted after the utilities, so `text-2xs/xs/lg/xl/3xl` on any `font-mono` element is ignored and it renders at its parent's size. Seen in: product card SKU bigger than the name (ProductPanel.tsx:278), card price not enlarged (:288), all PaymentModal money figures (:242, :260, :396, :411), `NumberField` everywhere (NumberField.tsx:57), cart meta and cost strip (CartLineRow.tsx:84, :327), `kbd` hints. Fix once: move the rule into `@layer base` (so explicit utilities win), then bump the real `text-2xs font-mono` call sites to `text-xs`. Prefer `tabular` over `font-mono` for money and codes in sans UI (mono is the widest face).
- **12px `text-2xs` as a working size.** It is below the floor and used for the price-group toggle, labels, meta lines, hints and counts: CartPanel.tsx:158, :210, :228, :447, :627; CartLineRow.tsx:74, :84, :253, :275, :294, :326, :347; ProductPanel.tsx:284, :313, :348, :351, :455, :539; HeldList/CustomerPicker `text-[10px]/[11px]`. Replace with `text-xs` minimum. Remove uppercase from FieldBox and ChargeInput.
- **Badge at 13px** (Badge.tsx:23 `text-[10px]`) carries stock, Due, Applied, Markup and Discount on this screen. → `text-xs`.
- **Hidden scrollbars on lists that overflow.** `scroll-hide` is used on the cart lines (CartPanel.tsx:235), cart tabs (:142), the product grid (ProductPanel.tsx:220), the category strip (:201), HeldList (:45) and CustomerPicker (:97). Cashiers get no cue that more items exist, and the category strip is unreachable with a vertical wheel. Keep `scroll-hide` only on the tab strip, and add wrap or arrows there.
- **Destructive actions with no confirm or undo:** tab X (CartPanel.tsx:161), Clear cart (:587), line trash (CartLineRow.tsx:126), held Discard (HeldList.tsx:76), and Resume overwriting the active cart (posCart.ts:212). One shared "Undo" toast pattern (`toast.success(..., {action:{label:'Undo'}})`) would cover all five.
- **Pickers without keyboard selection.** CustomerPicker and HeldList both autofocus a search box but do not support ↑/↓/Enter (HeldList even promises it). A shared `useListNav(items, onPick)` hook for both would help, and later for the global Ctrl+K.
- **Modal primitive** (Modal.tsx:42): backdrop click closes, there is no focus trap and no initial-focus prop. On POS this loses typed payment splits and lets Tab escape to the cart. Add `dismissOnBackdrop={false}` when dirty, a focus trap, and `initialFocusRef` (needed for ReceiptModal "Print & new sale").
- **Interpolated sentences that the text-node Bangla layer cannot translate:** PaymentModal confirm label and outcome lines, HeldList meta, CustomerPicker empty state, and POS toasts. Split each into a fixed phrase node plus a number node. Render enum keys (`priceGroup`) through a label map, not CSS `capitalize`.
- **Shortcuts exist but are invisible** (F3/F5/F6/F7/F9/F10 only in `title`). Show a `kbd text-xs` on each control, and add a visible "Keys ?" button for ShortcutsOverlay.
