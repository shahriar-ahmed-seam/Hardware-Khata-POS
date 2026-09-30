# Findings — Products, Product form, Master data, Barcodes, Bulk price update

Size note: `src/styles/globals.css` remaps arbitrary sizes to rem (`text-[9px]`→12px, `text-[10px]`→13px,
`text-[11px]`→14px), so they follow the font slider, but `[9px]`/`[10px]` still render below the 14px floor.

---

### Products — `/products` (screenshot 14)
**Purpose:** find a product, check its price and stock, and change the price or count quickly.
**Works well:**
- Every row has one labelled everyday action, "Update", opening the small price/stock popup (Products.tsx:1037-1046). Rare actions sit in the overflow menu, with Delete split off by a divider (:1087-1098).
- Money is right-aligned and tabular, and sell price is bold (the number that matters). The archive view has its own explanation and a Restore action.
- Delete asks the backend first and offers Archive when the product has history (:214-326). No dead-end errors.

**Problems:**
1. [High] Three header buttons do nothing. Import, Export and Barcode have no `onClick` (Products.tsx:406-414). The bulk bar's Print Barcode, Export and Bulk Update are dead too (:589-597). The owner clicks and nothing happens. Fix: Barcode → `nav('/products/barcodes')`, Import → `nav('/import')`. Bulk "Print Barcode" → `/products/barcodes` with the selected ids, bulk "Bulk Update" → `/products/price-update`. Remove both Export buttons until export exists.
2. [High] Rows are 67px tall and only 5 products fit above the fold. SKU is shown twice: under the name (:909) and again in its own column (:897-900), where it wraps ("PT-GRD-/100"). "338 / pc" wraps inside the stock cell (:949-953), and "Building / Material" wraps. With 11 columns (checkbox + 9 defaults + actions, stores/products.ts:38-48) the table is over-full at 1366px. Fix: drop `sku` from `DEFAULT_COLUMNS` (it stays under the name); stock cell `whitespace-nowrap`; category cell `whitespace-nowrap`.
3. [High] Four stat cards plus a note line use ~150px before the list starts (:441-457). Each card says "(this page)" although 24 products < page size 50, so the page is the whole catalogue. "Total Products 24" repeats the subtitle "24 products". Fix: drop the note and every "(this page)" when `total <= pageSize`, and remove the Total Products card. Keep Stock value, Retail value and Low stock in one compact `grid-cols-3` row, `p-3`. Make "Low stock 3" a button that sets `stockFilter='low'`.
4. [Med] Buying price and Avg. buying price are both default columns (stores/products.ts:43-44). The two numbers are nearly identical (45.00 / 44.33). The header "Avg. Buying Price" wraps to two lines, and the column is jargon for the owner. Fix: keep `cost` only and move `avgCost` to the optional columns in ColumnsCustomize. The average is already in QuickUpdateModal.
5. [Med] The Status column shows a green "In" badge on almost every row (:986-990). This repeats the stock number, adds visual noise, and "In" is cryptic. Fix: merge into the Stock cell. Leave the number plain when stock is fine, add an amber "Low" / red "Out of stock" badge (`text-xs`) after it, and drop `status` from the defaults. Colour then only marks the rows that need attention.
6. [Med] Filter segments "All / In / Low / Out" and "Active / Archived" are `px-3 py-1 text-xs`, about 28px tall (:492, :509, :521), next to 36px selects. Fix: `h-9 px-4 text-sm`, with clearer labels "In stock" / "Low" / "Out of stock". Move Active/Archived to the right end of the bar as a single "Show archived" toggle (it changes the whole list, not a filter).
7. [Med] The "More" popover holds only a price range that filters the loaded page. It has a `text-[10px] uppercase` label (:543) and the developer hint "Price filters this page" (:546-548). Fix: remove the popover and the client price filter (:162-169). The owner searches by name, and this frees the filter row (see Bangla).
8. [Med] The header has six controls, and two are 28px: the columns icon, a view toggle with `h-7` buttons and `size-3.5` icons (:836, :848), and the three dead `size="sm"` buttons. Fix: after (1), keep Columns (`IconBtn` h-9, ok), view toggle buttons `h-9 px-2.5` with `size-4` icons, Barcode and Import `size="md"`, and Add Product (primary).
9. [Low] The row overflow trigger is `size-7` with a `size-3.5` icon (:1053) → `size-9`, `size-4`. Menu items `py-1.5` (:1126) → `py-2.5`.
10. [Low] Grid view text is tiny: SKU `text-[10px]` (:752), name `text-[12px]` (:753), brand · category `text-[10px]` (:756), cost `text-[10px]` (:764). Fix: → `text-xs`, `text-sm`, `text-xs`, `text-xs`. Hide "cost ৳" from the card, because the cashier can see it over the counter.
11. [Low] The empty state "No products match these filters." (:703) gives no next step. Add a "Clear filters" button and, when the catalogue is empty, an "Add product" button.

**Remove / merge:** SKU column (keep it under the name); Status column → merged into Stock; Avg. buying price column → optional; Total Products card; the note "Totals for this page only…" and the "(this page)" suffixes; the "More" price popover; both Export buttons (dead); the bulk "Bulk Update" button → link to `/products/price-update`.
**Resize:** thead `text-[11px] uppercase` → `text-xs font-medium` normal case (:639); SKU/barcode cells `text-[11px]` → `text-xs` (:899, :903, :909); Stat label `text-[11px]` → `text-xs` (:1146); header buttons `size="sm"` → `md`; ViewToggle `h-7` → `h-9`; bulk bar buttons `size="sm"` → `md` (:589-631); overflow trigger `size-7` → `size-9`.
**Popups on this screen:**
- `QuickUpdateModal` (row "Update" and grid card click): see its own section below.
- `ColumnsCustomize` (columns icon): see its own section below.
- Edit drawer: `Drawer width="max-w-3xl" title="Edit Product"` wrapping `ProductForm asDrawer` (:802-825). Same form as the Product form section. In the drawer, `onSave` calls `upsert(p)` and closes immediately (:814-816), so a failed save closes the drawer and the typed changes are lost. Close only after the mutation resolves.
- Delete / Archive / Restore use `confirm()` dialogs. The copy is plain and good, but the titles interpolate names (`Delete "${name}" for good?`, :244-247), so they cannot be translated (see Bangla).
**Bangla (screenshot bn/14):** the filter bar wraps to two rows, with "আরও" alone on row 2 (this is fixed by removing the More popover, item 7). The subtitle "24 products" stays English (`${formatNumber} products`, :396-398). The confirm titles and toasts `${deleted} deleted`, `${restored} restored` (:319-320, :373) stay English. "হালনাগাদ" fits. The Status badges "আছে/কম" fit.

---

### Add / Edit product — `/products/new`, `/products/:id` (screenshots 15, 16)
**Purpose:** create a product, or correct its name, prices, unit and options.
**Works well:**
- The PageHeader is sticky, so Save stays reachable on a long form (ProductForm.tsx:190-220).
- The "+" beside Category and Brand creates one without leaving the form (:369-388). The profit margin line gives instant feedback (:420-432).
- On edit, stock is read-only and explained, instead of a box that silently did nothing (:497-526).

**Problems:**
1. [High] The Edit page opens with a BLANK form. Screenshot 16 (`/products/p11`) shows the placeholder "e.g. Claw Hammer 16oz" and 0.00 prices, while the Delete button (which needs `initial`) is visible. Cause: `ProductEdit` renders `ProductForm` before `useProduct` resolves (ProductEdit.tsx:170-178), and the form copies `initial` into state only once, at mount (ProductForm.tsx:80-82). The owner sees an empty product and may retype or give up. If he types and saves, `id: p.id || 'p_'+Date.now()` (:167) aims the update at a new id. Fix: in ProductEdit, return a skeleton while `!isNew && productQuery.isLoading`, and a "Product not found" card if there is no data. Render `<ProductForm key={initial?.id ?? 'new'} …>`.
2. [High] Save is greyed out with no reason given. `isValid` needs name, SKU and price > 0 (:174). A new product starts with an empty SKU and price 0, and nothing says what is missing. Fix: keep Save enabled. On submit, show plain errors under the fields ("Enter the product name", "Enter a selling price"). If SKU is empty, generate it with `generateSku()` (:105) and drop SKU's `required`.
3. [High] The space goes to the wrong things. The left third of the page (`lg:grid-cols-3`, :227) is a 270px image drop zone plus five toggles. For a new product, Opening stock is in the 4th card, below Units (:497-526), about 1100px down at 1366×768. Fix: one column, `max-w-3xl`, in the order the owner thinks:
   - **Owner needs (always visible):** Product name · Category · Buying price · Selling price · Unit · Opening stock (new) or "In stock now" + an "Update stock" button that opens QuickUpdateModal (edit) · Low-stock alert at.
   - **Tuck under a collapsed "More options" (expert):** Brand, SKU (auto), Barcode (auto), Wholesale and Contractor prices, Alternate units & conversions, Tax %, the five behaviour toggles, Description, Image (as a small 96px thumbnail picker, not a square hero).
4. [Med] Labels are `text-[10px] uppercase tracking-[0.06em]` (:640), hints `text-[10px]` (:646), section subtitles `text-[11px]` (:616), toggle descriptions `text-[11px]` (:709). Fix: labels → `text-xs font-medium text-foreground/80` in normal case, hints → `text-xs`, and drop the section subtitles "Required", "All values in BDT" and "Base unit + alternates with conversions" (:319, :393, :435).
5. [Med] The copy is jargon and inconsistent with the rest of the app. "Cost price" vs "Buying price" (list and QuickUpdate). "Sell price (SPR)" with the hint "Base selling price reference" (:402). "used when cart price group is Wholesale" (:405, :412). "Trigger Low Stock alert when stock ≤ this". "Tax %" with the hint "Default 0; VAT applied at order level", sitting inside the **Units** card (:455). Fix: "Buying price", "Selling price" (no hint), "Wholesale price" hint "For wholesale customers", "Low-stock alert at" hint "Warn me when stock falls to this", and move Tax to More options.
6. [Med] The header has four equal outline buttons: Back · Delete · Reset · Save (:198-218). Delete sits between neutral buttons with the same style. Reset throws away every edit in one click, without confirming. Fix: remove Reset. Back becomes a ghost link left of the title. Header right = primary Save only. "Delete product" moves to the end of the form in a separated zone, `variant="destructive"` outline.
7. [Med] Wholesale and Contractor prices are hard-coded fields (:405-418), but the Price Groups page lets the owner create other groups, which get no field here. Fix: render one price field per existing price group, inside More options.
8. [Med] There is no `<form>`, so Enter does nothing, and the first field is not focused. Fix: wrap in `<form onSubmit={submit}>` with the Save `type="submit"`, and `autoFocus` the name on new.
9. [Low] The five toggles are 36×20px switches (:713). "Show in POS" and "Not for sale" overlap in meaning. Fix: switch `w-11 h-6`, knob `size-5`. Merge the two into "Sell at the counter". Keep "Track stock" and "Allow discount". Move "Allow negative sale" to More options.
10. [Low] UnitsEditor controls are tiny: the factor input `h-7 w-20 text-xs` (:778), the "+ Add unit…" select `h-8 text-xs` (:802), the remove X `size-7` (:785), and all inline text `text-[11px]` (:768-791). Fix: `h-9 text-sm`, `size-9`, `text-xs`. Change "factor 1" to "Main unit".
11. [Low] The SKU placeholder "HT-STN-01" and barcode "8801XXXXXXXXX" look like real values (screenshot 15). Fix: placeholder "Leave empty to create one". The "auto" links are `text-[11px]` (:331, :345) → `Button variant="ghost" size="sm"` "Generate".
12. [Low] The Image card's "PNG or JPG · saved with your data" is `text-[11px]` (:247), "Preview" too (:259). Profit margin is `text-[12px]` (:421). Fix: → `text-xs`, and profit margin → `text-sm` (it is useful, keep it).

**Remove / merge:** Reset button; section subtitles; the square image hero (→ thumbnail in More options); "Show in POS" + "Not for sale" → one toggle; the Tax field in the Units card (→ More options).
**Resize:** Field label `text-[10px] uppercase` → `text-xs` normal case (:640); hint `text-[10px]` → `text-xs` (:646); Section subtitle `text-[11px]` → `text-xs` or removed (:616); inputs and selects `h-9` → `h-10` (local `Select` :662, shared `Input`); form grid `max-w-5xl lg:grid-cols-3` → `max-w-3xl` single column with 2-up rows for paired fields.
**Popups on this screen:**
- `NewCategoryModal` / `NewBrandModal` (QuickCatalogModal.tsx): see its own section.
- Drawer mode (from the Products row menu, `Drawer max-w-3xl`): footer Delete (left) · Cancel · Save (right) is correct (:543-563). The single-column rework fits the drawer better than the current 3-column grid, which collapses anyway below `lg`. Close the drawer only after the save succeeds (Products.tsx:814-816).
**Bangla (screenshot bn/15):** the "auto" links stay English. "SPR" stays in "বিক্রয় দাম (SPR)". The placeholder becomes mixed ("যেমন Claw Hammer 16oz"). Toggle descriptions wrap to 2 lines in the narrow left column ("স্টকে যা আছে তার বেশি বিক্রি করা / যাবে"). The image hint wraps to 2 lines. The one-column layout fixes the wrapping. The hint strings with an em dash and interpolated group names will need their own dict entries.

---

### Master data (Categories, Brands, Units, Price groups, Warranties) — `/products/categories|brands|units|price-groups|warranties` (screenshots 17, 18, 19, 22, 23)
**Purpose:** keep the short lists that products point to.
**Works well:**
- All five use one `max-w-3xl` card list with a search box and a single primary "Add …" button. Row height ≈ 53px meets the 44px target.
- Delete confirmations explain the consequence. Categories counts the linked products and subcategories first (Categories.tsx:70-89).
- The add/edit forms are real `<form>`s with `autoFocus`, so Enter submits and Cancel/Save sit bottom-right (Categories.tsx:237-310, same pattern in Units/PriceGroups/Warranties).

**Proposed shared layout (one `MasterListPage` component, `src/components/ui/`):**
- PageHeader: title plus a plain count subtitle ("9 categories"), and the primary `Add …` (md) on the right. Drop the developer suffixes ("· subcategories optional", "· grouped by type", "· used in POS price-group switcher", "templates").
- One Card. The search input (`h-10`) sits inside the card header, shown only when there are more than 8 rows. No separate search Card.
- Rows `min-h-14 px-4`: name `text-sm font-medium` · optional second line `text-xs text-muted-foreground` · right-aligned count `text-sm tabular` ("3 products") · actions.
- Actions: a labelled `Button variant="ghost" size="md"` "Edit" at full opacity, then Delete as a `size-9` icon with a tooltip, separated by `ml-2`. Today both are `size-7`, `size-3.5` icons at `opacity-60` until hover (Categories.tsx:197-213, Brands.tsx:216-231, Units.tsx:140-158, PriceGroups.tsx:70-98, Warranties.tsx:78-100).
- No column header row (Brands and Warranties have `text-[11px] uppercase` theads, Brands.tsx:161, Warranties.tsx:54). Also no repeated decorative icon in every row: Brands' Award, Units' Paperclip, Price groups' Tag. Keep the icon only where it carries meaning (category emoji).
- Add/Edit in a centred `Modal width="max-w-md"` with a footer (Cancel · Save), not a side Drawer. Forms of 1–3 fields look lost in a full-height drawer. Labels `text-xs font-medium` in normal case: every form uses `text-[10px] uppercase` today (Categories.tsx:247, :251, :282; Units.tsx:215-238; PriceGroups.tsx:154, :158; Warranties.tsx:163-177). Hints `text-[10px]` → `text-xs` (Categories.tsx:298, Units.tsx:246).
- An empty state with a next step: "No warranties yet. Add one, e.g. '1 year'", with the Add button inside the card.

**Per-page notes:**
1. [Med] Categories (17): the subcategory marker is `text-[10px]` "subcategory" (:195) → drop it, since the indent + chevron already show nesting. The count "3 products" is `text-xs` muted (:197) → `text-sm`. The drawer subtitle "Optional parent for subcategories" (:152) describes one field, not the dialog → remove it.
2. [Med] Brands (18): this is the only page that adds and renames INLINE, with Enter/Escape and `size-7` tick/cross icons (Brands.tsx:115-135, :170-212). Every other page uses a drawer. The same task behaves differently one menu item apart. Fix: use the shared Modal form. It also gives the owner a visible Save button instead of a 28px tick.
3. [Med] Units (19): five group cards with `text-[11px] uppercase tracking-wider` headings (COUNT / WEIGHT / LENGTH / VOLUME…, :120) hold 7 units, about one per card, so most of the screen is headings. The second line "1 pc = 1 base unit" (:136-138) is noise for base units, and "base unit" is jargon. The short code is `text-[11px] font-mono` (:134). Fix: one flat list with type as a `text-xs` badge. Second line only when factor ≠ 1, in words: "12 pieces". Short code `text-xs`, not mono.
4. [High] Price groups (22) does not do what it says. The POS switcher is hard-coded to `['retail','wholesale','contractor']` (components/pos/CartPanel.tsx:210). The product form has only Wholesale/Contractor fields (ProductForm.tsx:405-418). So a group added here gets no prices and never appears at the counter. The same `usePriceGroups` store is also edited from Contacts → Customer groups (CustomerGroups.tsx:10, :19), giving two screens for one list. Fix (frontend only): remove "Price Groups" from the Products menu (Sidebar.tsx:98) and keep Customer groups as the single place. Until custom groups can carry prices, hide "Add Group" and allow rename only. The title "Selling Price Groups" does not match the nav label "Price Groups". The default row's disabled delete at `opacity-30` (:93) → do not render it.
5. [High] Warranties (23) is an orphan. No product can carry a warranty: there is no field in ProductForm, and the Products `warranty` column always renders "—" (Products.tsx:962-963). Templates live only in `useWarranties` (stores/masterData.ts:307). The owner can fill in a list that goes nowhere. Fix: hide the nav entry (Sidebar.tsx:100) and drop `warranty` from ColumnsCustomize until products can use it. If kept, the empty state "No warranties." (:108) needs a next step, and the `Description` cell `text-xs truncate max-w-[300px]` (:74) → `text-sm`.

**Remove / merge:** Price groups page → merged into Contacts → Customer groups. Warranties page and nav entry → hidden. Separate search Card → into the list card. Theads on Brands and Warranties. The decorative per-row icons. Brands inline editor → shared Modal.
**Resize:** row action buttons `size-7` → `size-9` (icons `size-4`) and `opacity-60` → `opacity-100`; form labels `text-[10px] uppercase` → `text-xs`; Units group heading `text-[11px] uppercase` → removed (badge `text-xs`); Categories count `text-xs` → `text-sm`; Drawer `max-w-md` → `Modal max-w-md`.
**Popups on these screens:** the add/edit Drawers (Categories.tsx:147-170, Units.tsx:169-190, PriceGroups.tsx:108-125, Warranties.tsx:117-135), all `max-w-md`. Problems: the Drawer closes on a backdrop click even after typing (brief: Drawer primitive), and the uppercase 13px labels. Fix: the shared Modal described above, with `closeOnBackdrop={!dirty}`.
**Bangla:** not checked on screenshots (the Bangla budget went to 14 and 15). From code, every subtitle is an interpolated sentence and stays English: `${n} categories · subcategories optional` (Categories.tsx:94), `${n} brands` (Brands.tsx:94), `${n} units · grouped by type` (Units.tsx:93), `${n} groups · used in POS…` (PriceGroups.tsx:32), `${n} warranty templates` (Warranties.tsx:31). So do the `Delete "${name}"?` confirm titles. The Units type headings are raw keys (`{type}`, Units.tsx:121), so "count/weight" will not match dict entries unless they are mapped to labels.

---

### Barcode print — `/products/barcodes` (screenshot 20)
**Purpose:** pick products, set how many labels of each, and print them.
**Works well:**
- A clear flow: search → Add → copies stepper in the same row. The primary button states the count ("Print 0 labels") and is disabled when there is nothing to print.
- There are only two label presets, named in plain words ("50 × 30 mm (single roll)").

**Problems:**
1. [High] The printed "barcode" is not a barcode. Every label gets the same decorative `repeating-linear-gradient` stripe, 3mm tall (BarcodePrint.tsx:289-295), so no scanner can read it. The owner will print a roll of labels that look right and do not scan. Fix: render a real Code128/EAN-13 SVG from `p.barcode`. `settings.barcode.codeType` already exists (stores/settings.ts:169), but no barcode library is in package.json, so this needs one added (a pinned `jsbarcode`). Until then, hide the stripe and print the number large.
2. [High] The page ignores the owner's saved choices. `size`, `showName`, `showSKU` and `showPrice` are local `useState` defaults (:28-31). Settings → Barcode stores `defaultLabel`, `showName`, `showSKU`, `showBarcode`, `showPrice`, `defaultCopies` (stores/settings.ts:160-170, BarcodeSettingsPage.tsx:30-43), and none are read here. Fix: initialise from `useSettings().barcode`, and use `defaultCopies` in `addToQueue` (:45-55).
3. [High] The preview is below the fold. Its "PREVIEW" heading starts at y≈760 on a 768px screen (:221-248), so the owner prints blind. Fix: move the preview into the right column under Label settings, as a sticky card showing the first 2–3 labels at real size, and fold the Queue list into it ("Cement ×5"). Drop the separate full-width preview block.
4. [Med] "Show SKU" also hides the barcode NUMBER (`{showSKU && …p.barcode || p.sku}`, :296-297), and the SKU prints a second time at `text-[6pt] opacity-70` (:300). Fix: one row under the bars with the barcode number, always shown. "Show SKU" controls only the SKU, at `7pt`, full opacity.
5. [Med] The copies stepper is `size-7` with `size-3` icons, and the count input is `w-10 text-xs` (:129-145). The queue remove button is `size-6` with a `size-3` icon (:205-210), and queue rows are `text-xs` (:202). Fix: stepper buttons `size-9`, input `w-14 h-9 text-sm`, remove `size-9`, queue rows `text-sm`.
6. [Med] The list shows only the first 50 products with no hint (:39), and "No products." (:156) does not suggest searching. Fix: add a line "Showing 50 of 312 — search to find more" (`text-xs`). Accept `?ids=` from the Products bulk bar so selected rows arrive pre-queued (see Products item 1).
7. [Low] The header's "Clear" is `size="sm"` (:82-89) and wipes the queue with no confirm. Fix: move it into the Queue card header as `variant="ghost" size="md"` "Clear all".
8. [Low] The subtitle "Pick products → set copies → print labels" is instruction clutter, and the row's second line `text-[11px] font-mono` "SKU · barcode" (:123-125) is hard to read. Fix: remove the subtitle; second line `text-xs`, not mono.

**Remove / merge:** the separate Queue card → merged into a sticky "Preview & queue" card; the full-width preview block; the header Clear; the subtitle; the duplicate SKU line on the label.
**Resize:** Size label `text-[10px] uppercase` → `text-xs` (:167); "PREVIEW" `text-[11px] uppercase` → `text-sm font-semibold` normal case (:222); Add `Button size="sm"` → `md` (:148); stepper `size-7` → `size-9`; toggle switch `w-9 h-5` → `w-11 h-6` (:329); product list `max-h-[60vh]` → `flex-1` so it fills the column at 768px.
**Popups on this screen:** none. `window.print()` opens the system dialog. The print stylesheet hides `.scroll-hide` (:256), which is also the class on the product list and queue scrollers (:112, :196). That works today only by coincidence. Give it a dedicated `print:hidden` wrapper.
**Bangla:** not checked on screenshots. From code, `Print {n} label{s}` (:91) and `{n} labels` (:185) are interpolated and stay English. The preset names include "mm" and "×", which is fine.

---

### Bulk price update — `/products/price-update` (screenshot 21)
**Purpose:** raise or lower one price on many products at once (e.g. "all cement +5%").
**Works well:**
- Clicking anywhere on a row selects it (:224-231). The "After" column previews the new price in colour and in numbers, before anything is saved.
- The default rounding "Nearest taka" suits a shop, and a confirm guards the write.

**Problems:**
1. [High] Bulk-changing "Cost" skips the buying-price history. `apply` writes `products.update {cost}` directly (BulkPriceUpdate.tsx:128). QuickUpdateModal explicitly routes buying price through `products.setCost` so the history and the average are updated (QuickUpdateModal.tsx:111-119). After a bulk cost change, the average buying price and the "Set on" date are stale. Fix (frontend): for `field === 'cost'`, call `useSetProductCost().mutateAsync` per product, as QuickUpdateModal does.
2. [High] "Total change ৳0.00" (:352-363) adds up per-unit price changes of unrelated products (+5 on a switch, +270 on a grinder). The number means nothing, and a loud green/red total invites misreading. Fix: replace it with "Prices going up: 12 · going down: 0" and "Smallest / largest new price", or remove the line.
3. [Med] The two controls read like a calculator: Mode `± ৳ / ± % / Set =` (:283-299) plus a separate Direction `Increase ↑ / Decrease ↓` (:301-322). Fix: one select or radio list in words: "Increase by %", "Increase by ৳", "Decrease by %", "Decrease by ৳", "Set to ৳". Then one Amount field (`h-10 text-lg text-right`). This removes a whole control group.
4. [Med] The Apply button sits at the bottom of the right column, at y≈740 of 768 (screenshot). On a shorter window or with the Bangla labels it drops below the fold, and it is disabled with no reason when nothing is selected or the amount is 0 (:365). Fix: make the right column `sticky top-4`. Under the button, show `text-xs` "Select products on the left" / "Enter an amount" when disabled. Apply `h-11`.
5. [Med] "24 match" is a disabled outline Button with a filter icon (:199-201), so it looks like a control that is broken. Fix: plain `text-sm text-muted-foreground` "24 products". Add a "Select all 24" link next to it (the thead checkbox is the only way to select all today, :208-210).
6. [Med] The field names do not match the rest of the app: "Sell Price (SPR)", "Cost", "Wholesale", "Contractor" (:21-26). The list screen says "Buying Price" and "Sell Price", and the popup says "Buying price" / "Selling price". Fix: "Selling price", "Buying price", "Wholesale price", "Contractor price". Default `field` 'price' is right.
7. [Low] The header's only action is "Clear selection" `size="sm"` (:156-158), which is not a page-level action. The subtitle "Filter → select → apply" is instruction clutter. Fix: move Clear into the Summary card next to "Selected 3", `variant="ghost" size="md"`, and drop the subtitle.
8. [Low] The row's second line is `text-[11px] font-mono` "SKU · brand · category" (:240-242), so the brand and category names render in monospace. Fix: `text-xs`, not mono (SKU only in mono, if at all).

**Remove / merge:** the Direction group → merged into Mode; the "Total change" line; the "24 match" button → text; the header Clear → into Summary; the subtitle.
**Resize:** thead `text-[11px] uppercase` → `text-xs` normal case (:206); every settings label `text-[10px] uppercase` → `text-xs font-medium` (:268, :283, :304, :326, :336); segment buttons `h-8 text-xs` → `h-10 text-sm` (if kept); Selected `Badge` → plain `text-sm font-semibold tabular`; raw `<select>` h-9 → shared Select `h-10`.
**Popups on this screen:** only `confirm()`. The title `Update ${label} on ${n} product(s)?` (:113) is interpolated. The message "This cannot be undone." is accurate but scary with no alternative. Add "You can run it again in the other direction" or show the first 3 changes.
**Bangla:** not checked on screenshots. From code, the interpolated strings stay English: the confirm title, `Apply to ${n} product${s}` (:367), and the toasts `Updated … on ${ok} product${s}` / `Updated ${ok}, failed ${failed}` (:139-142). `capitalize` on the mode buttons (:289) has no effect in Bangla.

---

### Popup — Update price & stock (`src/components/products/QuickUpdateModal.tsx`)
**Purpose:** the everyday edit. A new buying price, a new selling price, or a shelf count, for one product.
**Works well:**
- Big `h-14 text-2xl` right-aligned number inputs (:223, :270, :315), pre-filled with the current values. Only what changed is written, and the result reads "Price goes up by ৳10" / "Profit per unit ৳35 (44%)", with a plain warning when the price is below cost (:290-294).
- Every label is a static phrase with the value in its own element, so it translates (the comment at :48-53 explains this). Colour always comes with words.
- A stock count becomes a recorded correction, not a silent overwrite (:121-129).

**Problems:**
1. [High] The popup is taller than the screen. The body stacks a product card (:170-177), two price columns, each with an icon header + hint + "Current" box + input + rows (:182-296), and then a full Stock card (:299-337). That is ≈900px against the Modal's `max-h-[90vh]` (≈690px at 768), so the Counted quantity box needs scrolling. Fix, in order:
   - Delete the product card. The name is already the modal subtitle (:153).
   - Delete the icon + "What you pay the supplier / What the customer pays" headers (:184-193, :247-256).
   - Replace each "Current … price" box with a hint on the label ("New selling price · now ৳80.00").
   - Lay out Buying | Selling | Stock as three equal columns with `width="max-w-3xl"` and `sm:grid-cols-3`.
   This fits in ≈480px with the footer always visible.
2. [Med] Enter does not save, and nothing is focused. Selling price is the most common change. Fix: wrap the body in `<form onSubmit={save}>` and make Save `type="submit"`. `autoFocus` the New selling price and select its text on focus.
3. [Med] Esc while "Buying price history" is open closes BOTH layers. Modal listens on `window` (ui/Modal.tsx:22-26), and CostHistoryPopup has no Esc handling of its own (:363-455). Fix: give the history popup its own keydown handler that calls `stopPropagation`, or make Modal close only the top-most `data-overlay`.
4. [Med] A stray backdrop click throws away typed prices (Modal primitive, ui/Modal.tsx:39). Fix: pass `onClose` only when `nothingToDo`; otherwise ignore the backdrop.
5. [Med] Footer is `justify-between`: Cancel far left, Save far right (:155). Fix: `justify-end gap-2`. Keep `h-11`.
6. [Low] The toast description "↓ ৳120.00 · ↑ ৳85.00 · 40 pc" (:133-135) uses ↓ for "buying price", which reads as "decreased". Fix: "Buying ৳120 · Selling ৳85 · Stock 40 pc".
7. [Low] `text-2xs` (12px) hints: "Set on …" (:201), "Saving updates the average buying price." (:240-242), the history row captions (:405, :421). Fix: → `text-xs`. The row "System count" (:307) → "In stock now".
**Resize:** `width="max-w-xl"` → `max-w-3xl` with 3 columns (after removing the headers); `text-2xs` → `text-xs`; History button `h-9` is ok, drop `hidden md:inline` so the label always shows (:211).
**Bangla:** designed for it and fine. Only the toast title and description strings need dict entries.

---

### Popup — Add category / Add brand (`src/components/products/QuickCatalogModal.tsx`)
**Purpose:** create a missing category or brand from inside the product form, and select it.
**Works well:**
- `autoFocus`, Enter submits, and `max-w-md` fits the content. The case-insensitive duplicate check selects the existing record instead of making "cement" twice (:52-60, :112-117).
- The primary label says what happens: "Save & Select".

**Problems:**
1. [Med] Each modal opens with an info box plus a 40px icon, saying "This is the same category list as Catalogue → Categories. Adding it here saves it for good." (:95-103, :181-188). That is developer reassurance and competes with the one field. Fix: delete it. The subtitle "Created and selected for this product" already says it.
2. [Med] Labels are `text-[10px] uppercase tracking-[0.06em]` and the hint is `text-[10px]` (`Labelled`, :224-229), with no `htmlFor`. Fix: `text-xs font-medium` in normal case, hint `text-xs`, and link the label to the input with `htmlFor`/`id`.
3. [Low] The category icon is a free-text input with the placeholder "🔧" (:106-108). The Categories page has an emoji picker grid (Categories.tsx:251-278). Fix: reuse that picker so both paths look the same and nobody has to type an emoji on Windows 7.
4. [Low] The duplicate notice is `text-xs text-warning` on `bg-warning/10` (:109-113, :190-194). Amber on pale amber is likely below 4.5:1 in the light theme (not measured). Fix: `text-foreground` with a warning icon.
**Bangla:** the toasts `"${name}" already exists — selected it`, `Category "${name}" added` (:56, :66, :146, :155) are interpolated and stay English.

---

### Popup — Customize columns (`src/components/products/ColumnsCustomize.tsx`)
**Purpose:** choose which columns the Products table shows, and in what order.
**Works well:**
- Active columns are listed first, in their current order, with Reset to defaults (:30, :80-82).

**Problems:**
1. [Med] It is a hand-built side drawer, not `Drawer`/`Popover`. There is no Esc handler, no `data-overlay` flag, and the backdrop `<button>` has no `aria-label` (:14-16). A full-height 448px panel is also heavy for a checklist. Fix: a `Popover` anchored to the columns button (`w-72`), or the shared `Drawer width="max-w-sm"`. Either one gives Esc and the overlay flag.
2. [Med] Only the 20px checkbox toggles (:40-49). Clicking the column name does nothing. Fix: make the whole row a `<label>`/button `min-h-11`, checkbox `size-5` → `size-6`.
3. [Med] The order arrows are "↑"/"↓" text glyphs in `size-7` buttons, titled "Move left"/"Move right" (:52-69). The glyph and the tooltip disagree. Fix: `size-9` buttons with `ChevronUp`/`ChevronDown` icons, titled "Move up"/"Move down" (the list is vertical).
4. [Low] The Product (`name`) column can be switched off, which leaves a table without names. `warranty` is offered but always renders "—" (Products.tsx:962-963). Fix: lock `name` on (no checkbox), and drop `warranty` from `ALL_PRODUCT_COLUMNS` until it has data.
5. [Low] Footer buttons are `size="sm"` (:80-86) → `md`.
**Bangla:** the column labels come from `COLUMN_META` (stores/products.ts:80-100) and translate when dict keys exist. The "↑/↓" glyphs need none.

---

## Cross-cutting patterns seen in this group
- **Uppercase 13px micro-labels on every form.** A local `Field`/`Labelled` uses `text-[10px] uppercase font-semibold tracking-[0.06em]` in ProductForm.tsx:640, QuickCatalogModal.tsx:224, BarcodePrint.tsx:167, BulkPriceUpdate.tsx:268-336, Categories.tsx:247-282, Units.tsx:215-238, PriceGroups.tsx:154-158, Warranties.tsx:163-177. Fix once: a shared `FormField` in `src/components/ui/` (label `text-xs font-medium`, normal case, `htmlFor`, hint and error `text-xs`), and delete the local copies.
- **Uppercase `text-[11px]` table headers.** Products.tsx:639, BulkPriceUpdate.tsx:206, Brands.tsx:161, Warranties.tsx:54. Fix once: a shared `<THead>` with `text-xs font-medium` in normal case.
- **28px row and icon buttons.** `size-7` edit/delete icons at `opacity-60` (Categories, Brands, Units, PriceGroups, Warranties), the Products overflow `size-7`, the barcode stepper `size-7`/`size-6`, the ColumnsCustomize arrows `size-7`, and the ProductForm UnitsEditor `h-7`. Fix once: an `IconButton` primitive with a `size-9` minimum and a required `title`, plus a labelled `RowAction` (ghost `md`) for Edit.
- **Dead or misleading controls.** Import, Export and Barcode on Products (Products.tsx:406-414), bulk Print/Export/Bulk Update (:589-597), the "24 match" disabled button (BulkPriceUpdate.tsx:199), the fake barcode stripe (BarcodePrint.tsx:289-295), the Warranties page, and Price groups that never reach the POS (CartPanel.tsx:210). Wire them or remove them. A button that does nothing costs the owner's trust.
- **Hard-coded Retail / Wholesale / Contractor.** ProductForm.tsx:405-418, BulkPriceUpdate.tsx:21-26, CartPanel.tsx:210, while PriceGroups.tsx and CustomerGroups.tsx both edit `usePriceGroups`. Pick one source (the three fixed tiers) and remove the page that suggests otherwise.
- **Inconsistent price vocabulary.** "Cost price" / "Cost" / "Buying Price" / "Avg. Buying Price" and "Sell price (SPR)" / "Sell Price" / "Selling price" across ProductForm.tsx:398-402, stores/products.ts:87-90, BulkPriceUpdate.tsx:21-26 and QuickUpdateModal.tsx. Fix: "Buying price" and "Selling price" everywhere, with one dict entry each.
- **Instruction subtitles and "(this page)" qualifiers.** "Pick products → set copies → print labels", "Filter → select → apply", "· subcategories optional", "· grouped by type", "· used in POS price-group switcher", "Totals for this page only…". Remove them. Show the page-scope note only when `total > pageSize`.
- **Interpolated English sentences.** `${n} products`, `${n} categories · …`, `Print ${n} label${s}`, `Apply to ${n} product${s}`, and every `Delete "${name}"?` confirm and `… added/deleted/restored` toast. They cannot be translated by whole-node matching. Fix once: a `plural(n, 'product')` helper plus static-label + value layout (the pattern QuickUpdateModal already uses), with the name in a separate element.
- **Popups close on a stray click and lose typing.** Modal and Drawer backdrops (ui/Modal.tsx:39, Drawer) are used by QuickUpdateModal, QuickCatalogModal, the master-data drawers and the Edit Product drawer. Fix once: a `dirty`/`closeOnBackdrop` prop on Modal and Drawer, and close only the top-most overlay on Esc.
- **Small toggles.** `w-9 h-5` switches in ProductForm.tsx:713 and BarcodePrint.tsx:329 (two copies of the same local `Toggle`). Fix once: a shared `Switch` at `w-11 h-6` with the whole row clickable.
