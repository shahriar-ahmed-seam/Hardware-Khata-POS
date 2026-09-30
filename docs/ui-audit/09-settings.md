# Findings — Settings (hub, shared pattern, full sections, short notes)

Scope note: only the English dark screenshots listed in the task were viewed (58, 59, 66, 67, 70, 71, 73). Everything else is from code. Bangla notes are code-derived.

---

### Settings hub — `/settings` (screenshot 58)
**Purpose:** one place to reach every shop, device and personal setting.
**Works well:**
- Tiles are whole-card links with a plain one-line description; titles `text-sm` semibold, 40px icon well (Settings.tsx:106-113).
- Permission filtering hides tiles a cashier cannot use (Settings.tsx:84-86, comment :31-38), so a cashier sees only Appearance + Shortcuts.
- Grouping exists (6 groups) and the grid is 3-up at 1366px, so it reads calmly.

**Problems:**
1. [High] The two settings an elderly owner actually needs are below the fold: at 1366×768 only Shop / People / Documents / Devices are visible; "Application" (Theme & Appearance = text size) is cut at the bottom edge and "System" (Backup) needs a scroll (screenshot 58). Group order is by developer category (Settings.tsx:70-77 `GROUP_TITLES`), not by how often the owner comes here. Fix: reorder and regroup into three sections (see Remove / merge), with Backup and Text size in the first row.
2. [High] 17 tiles at equal weight; about half are one-time technical setup (Invoice Schemes, Barcode, Roles, Branches, Sales Commission Agents, Shortcuts, Performance, Updates). Fix: progressive disclosure — show ~8 everyday tiles, then a collapsed `<details>`-style "Advanced settings (9)" section below, closed by default, remembered in `useUI`.
3. [Med] Backup tile gives no safety signal. The single most important thing on this page ("when was the last backup?") is not shown. Fix: on the Backup tile show a status line from the backup store, e.g. "Last backup: today 18:40" in `text-xs` success colour, or "No backup in 7 days" with a warning icon + text (not colour alone).
4. [Med] Group headings are `text-[11px] uppercase tracking-[0.06em]` (Settings.tsx:95) — the uppercase micro-label pattern. → `text-sm font-semibold text-foreground` sentence case ("Shop", "People").
5. [Med] Duplicate icons make tiles hard to tell apart at a glance: Users and Roles both `Users` (:46-47); Receipt Template and Receipt Printers both `Printer` (:52, :55). Fix: Roles → `ShieldCheck`; Receipt Template → `ReceiptText`.
6. [Low] Tile copy is jargon/wrong: "Invoice Schemes — Numbering format per document type" (schemes do not affect numbering yet, see short notes); "Theme & Appearance — Light/dark, accent color, density" hides the one thing an older user looks for (text size); "Backup & Cloud" (there is no cloud). Fix copy: "Text size & theme — Make text bigger, light or dark"; "Backup — Save a copy of your data, restore"; "Commission agents".
7. [Low] Description `text-xs text-muted-foreground` (:112) is 14px muted on dark — acceptable, but it is the only explanation of each tile. Keep `text-xs`, use `text-foreground/75` for contrast.
8. [Low] Page subtitle "Configure your shop, devices, and preferences" (:89) says nothing the tiles do not. Remove it.

**Remove / merge:** Proposed structure (order matters):
- **Everyday** (first row): Backup · Text size & theme · Shop details (Business Info) · Users & PINs.
- **Selling & printing:** Receipt & printer (merge Receipt Template + Receipt Printers into one tile/page with two cards — both are "what comes out of the printer") · POS preferences · Cash register · Tax rates.
- **Advanced** (collapsed): Roles & permissions · Branches · Invoice numbering · Barcode labels · Commission agents · Keyboard shortcuts · Performance · Updates.
Drop the subtitle.
**Resize:** group `h2` `text-[11px] uppercase` → `text-sm font-semibold` sentence case; tile `p-4` fine; "Everyday" tiles can be `p-5` with `size-12` icon wells to mark them as primary.
**Popups on this screen:** none.
**Bangla:** all labels are static strings so they translate by text node. The long Bangla for "Sales Commission Agents" will wrap to two lines in a 3-up tile — fine (cards are `h-full`). Nothing interpolated.

---

### Shared settings page pattern — all `/settings/*` (judged on screenshots 59, 67)
**Purpose:** the common shell every settings sub-page uses: `SettingsHeader` (title + "← Settings" link + one action), a grid of `Card` sections, local `Field` labels, `ToggleRow` switches.
**Works well:**
- One header shape everywhere with a back link in the same spot (`src/components/settings/SettingsHeader.tsx:16-27`, h-9 link).
- Section cards with a plain `text-sm font-semibold` title group related fields (BusinessInfoPage.tsx:318-325).
- `ToggleRow` makes the whole row the click target (`ToggleRow.tsx:12-16`), label `text-sm font-medium`, description under it.

**Problems:**
1. [High] Two save models that look identical but behave differently. Business Info and Receipt Template keep a local draft and need "Save Changes" (BusinessInfoPage.tsx:83-86, ReceiptTemplatePage.tsx:84). POS, Cash Register, Barcode, Shortcuts and Appearance save on every change via `writePref` (`stores/settings.ts:344-348`, :525-529) but still show a primary button labelled "Saved" whose `onClick` only fires a toast (POSPrefsPage.tsx:39-42, CashRegisterPrefsPage.tsx:20-23, BarcodeSettingsPage.tsx:21-24, ShortcutsPage.tsx:118-121, AppearancePage.tsx:81-84). An owner cannot tell whether he must click it; on Business Info, leaving via "← Settings" or the sidebar silently drops his edits. Fix: pick one per page type and make it visible —
   - Autosave pages: delete the fake "Saved" button; put a small status line in the header `actions` slot: "Changes save automatically" → on write "Saved ✓" (`text-xs text-success`, 2 s), on error "Not saved — try again" (the store already toasts the error at settings.ts:346).
   - Draft pages (Business Info, Receipt Template): track `dirty = !shallowEqual(draft, business)`; disable Save when clean and label it "Saved"; when dirty show "Unsaved changes" next to it and a sticky bottom bar with Save/Discard; block navigation with a confirm when dirty.
2. [High] The Save button sits only at the top-right while the form runs below the fold (screenshot 59: "Locale & Currency" is cut off at 768px). After editing the last field the user must scroll up to find it. Fix: sticky footer bar `sticky bottom-0 border-t bg-card/95 p-3 flex justify-end gap-2` with Discard + `Button size="lg"` Save, shown whenever the page is dirty.
3. [High] Success toast is optimistic: BusinessInfoPage.tsx:84-85 shows "Business info saved" before `business.update` resolves (settings.ts:417-457), so a failed save shows green then red. Fix: make `setBusiness` return the promise; toast after it resolves.
4. [Med] Every page has its own local `Field` with the forbidden label style `text-[10px] uppercase font-semibold tracking-[0.06em]` (BusinessInfoPage.tsx:332; POSPrefsPage.tsx:50, :59; same pattern in the other settings pages). Labels are not tied to inputs (`<label>` without `htmlFor`). Fix: one shared `FormField` in `src/components/ui/` — `<label htmlFor>` `text-xs font-medium text-foreground/80 mb-1.5 block`, sentence case, required `*` plus `aria-required`.
5. [Med] `ToggleRow` switch is 36×20px (`w-9 h-5`, knob 16px, ToggleRow.tsx:22-33) and the OFF state `bg-muted` is nearly invisible on the dark card (screenshot 67: the three off switches read as dark smudges). There is no "On/Off" text, so state is shown by colour and knob position only. Fix: switch `w-11 h-6`, knob `size-5`; OFF `bg-muted-foreground/40` with a `ring-1 ring-border`; add `role="switch" aria-checked={checked}` and a `text-xs` "On"/"Off" word left of the switch; row `min-h-12 py-3`; description `text-[11px]` → `text-xs` (ToggleRow.tsx:19).
6. [Med] Raw `<select>` copied with `h-9 ... px-2` in ~9 places on Business Info alone (BusinessInfoPage.tsx:156-230) and elsewhere; inputs are `h-9`. Fix: a shared `Select` primitive at `h-10 text-sm px-3`, and `Input` `h-10` (standard #2).
7. [Low] Developer "What this affects" cards (POSPrefsPage.tsx:156-164, dashed card, `text-[12px]` bullets such as "Negative stock guard at cart line level") repeat the toggle descriptions in jargon. Remove.
8. [Low] Header subtitles restate the tile description ("Defaults applied at the checkout screen", "Shop identity, currency, locale"). Keep only where they add a fact (e.g. "3 users · 2 active").

**Remove / merge:** the five fake "Saved" buttons; "What this affects" card; duplicated local `Field`/`Section` helpers → shared `FormField` + `SettingsSection`.
**Resize:** Field label `text-[10px] uppercase` → `text-xs font-medium` sentence case; `ToggleRow` switch `w-9 h-5` → `w-11 h-6`, row `p-3` → `px-3 py-3 min-h-12`, desc `text-[11px]` → `text-xs`; selects/inputs `h-9` → `h-10`; Save `Button` md → `lg` in a sticky footer.
**Popups on this screen:** n/a (see each page).
**Bangla:** toast strings ("POS preferences saved") are whole strings — fine. Uppercase labels become plain Bangla, so the uppercase styling only hurts English. The proposed "Saved ✓" status must be a whole-string dict key, not composed.

---

### Business info — `/settings/business` (screenshot 59)
**Purpose:** the shop's name, address, phones and tax IDs as printed on receipts, plus money/date format.
**Works well:**
- Identity fields first, shop name marked required; address is a real textarea.
- Logo upload stores bytes, not a blob URL (comment BusinessInfoPage.tsx:54-62), and explains where it is used.
- Currency position options show a live sample ("৳ 100.00").

**Problems:**
1. [High] Unsaved edits are lost silently and Save is off-screen once you scroll (see shared #1–#2). This is the page the owner fills once and never again, so a silent loss is exactly what he will not notice.
2. [Med] "Locale & Currency" mixes three receipt-relevant choices (currency symbol, position, decimals) with six technical ones (thousand separator, timezone, date format, default language, fiscal year start, default branch) in a 3-column grid (BusinessInfoPage.tsx:150-240), all below the fold. Fix: keep "Money format" (symbol, position, decimals) visible; move timezone, date format, thousand separator, fiscal year, default branch into a collapsed "Advanced" section. Default language duplicates the titlebar EN/বাংলা toggle — label it "Language when the app starts" so it is not mistaken for a switch.
3. [Med] The Preview card lies: it formats with fixed `'en-IN'` (:294) and `toLocaleDateString('en-GB')` (:302), so changing Thousand separator or Date format changes nothing in the preview. Fix: render the preview through the app's real `formatMoney`/`formatDate` with `draft` values, or remove the card. Also a `decimalPlaces` above 20 or negative makes `toLocaleString` throw and blank the page — use a `<select>` with 0 / 2 instead of `NumberField` (:163-164).
4. [Med] The logo dropzone is `aspect-square` of the right column (:256) ≈ 300×300px of dashed empty space when there is no logo, more visual weight than the whole Identity card. Fix: `h-40 aspect-auto`, and when a logo exists show it at `h-24` with "Change" / "Remove" `Button size="md"` side by side (Remove is `ghost sm` today, :279).
5. [Low] Tagline is a top-row field beside Shop name; it is optional decoration. Move it after Address; put Primary phone next to Shop name (both are printed on every receipt).
6. [Low] Help lines `text-[11px]` (:267, :284) → `text-xs`.

**Remove / merge:** Preview card (or fix it); "Default branch" belongs on Branches ("Make default").
**Resize:** labels `text-[10px] uppercase` → `text-xs font-medium` (:332); selects `h-9 px-2` → `h-10 px-3` (:156-230); logo box `aspect-square` → `h-40`; Remove `Button size="sm"` → `md`.
**Popups on this screen:** none (native file picker only).
**Bangla:** `FY_MONTHS` includes "July (BD default)" (:21-24) — a composite string that needs its own dict key or it stays English. Timezone ids ("Asia/Dhaka") and format codes ("DD/MM/YYYY") stay English — acceptable once they are under Advanced.

---

### Appearance — `/settings/appearance` (screenshot 66)
**Purpose:** make the app comfortable to look at all day: text size, light/dark, accent.
**Works well:**
- The scale is rem-based (`tailwind.config.js:76-82`) and `App.tsx:160` applies `fontScale` to `<html>` at startup, so the font setting really does scale the whole app, including heights.
- Theme and density are big buttons (h-16 / h-12), not tiny radios.
- Preview uses the shop's own name and branch.

**Problems:**
1. [High] Text size is not visible. The "Font size" card is the fourth card in the left column (AppearancePage.tsx:~186-207) and sits fully below the fold at 1366×768 (screenshot 66 ends at Density). The hub tile description ("Light/dark, accent color, density", Settings.tsx:58) does not mention it either. For an elderly owner this is the single most useful control in Settings. Fix: make "Text size" the first card, full width, and rename the tile/page "Text size & theme". Also add A−/A+ to the titlebar next to the EN toggle so it can be changed from any screen.
2. [High] It does not go big enough, and it goes too small. Options are 90/100/110/120% (:~192, type `0.9 | 1 | 1.1 | 1.2` in `stores/settings.ts:203`). 120% makes body `text-sm` ≈ 19px; 90% makes `text-xs` ≈ 12.6px, below the 14px floor. Fix: options 100% "Normal", 115% "Large", 130% "Larger", 145% "Largest" (drop 90%); each button shows a sample "আমার দোকান Aa" at its own size (it already sets `fontSize: s*14px`, :~200 — keep). Verify POS and Sales tables at 130% on 1366px before shipping 145%.
3. [Med] Titlebar and this page fight over theme and density. The titlebar density icon calls `useUI.setDensity` only (Titlebar.tsx:178) and is not saved; opening this page runs `setDensity(a.density)` on mount (AppearancePage.tsx:68-70) and flips it back. Same split for theme: titlebar `setMode` only (Titlebar.tsx:97-99). Fix: route titlebar toggles through `setAppearance` — or remove the density icon from the titlebar (the comment at Titlebar.tsx:175 already calls it least essential).
4. [Med] "System" theme and Reset are wrong for this PC. Windows 7 reports no dark preference, so "System" means light; Reset sets `themeMode: 'system'` (:54-55), so Reset switches the owner from the default dark look to light. Fix: remove "System" (two buttons: Dark, Light), Reset → `themeMode: 'dark'`.
5. [Med] Selected state is low contrast: `border-primary bg-primary/10 text-primary` (:~110, :~172, :~198) — in screenshot 66 "System" and "Comfortable" are dim indigo on near-black, harder to read than the unselected ones. Fix: selected `bg-primary text-primary-foreground` + a `Check` icon, so state is not colour-only.
6. [Med] Accent colour gets a full card plus a 0–360° hue slider (:~121-160). Rose (350), Amber (38) and Emerald (152) collide with the destructive / warning / success colours used for money state (standard #8). Fix: move accent to a collapsed "More options"; keep Indigo, Blue, Teal, Violet; delete the custom hue slider.
7. [Low] Fake "Saved" button + Reset in the header (:76-85): see shared #1. Reset should ask "Reset text size and colours to normal?" — it also resets text size, which could shrink the owner's text without warning.
8. [Low] Micro text: accent labels `text-[11px]` (:~127), "CUSTOM HUE" `text-[10px] uppercase` (:~141), help lines `text-[11px]` (:~180, :~206), "PREVIEW" `text-[10px] uppercase` (:~213), preview "In stock" `text-[11px]`.

**Remove / merge:** "System" theme option; custom hue slider; fake Saved button; the preview card can shrink to a single sample row under Text size (the whole app already previews the change live).
**Resize:** theme labels `text-xs` → `text-sm`, icons `size-4` → `size-5`; `text-[10px] uppercase` → `text-xs font-medium`; `text-[11px]` → `text-xs`.
**Popups on this screen:** none.
**Bangla:** density buttons render the raw key with CSS `capitalize` (`{d}` at :~175) — "compact"/"comfortable" are translated only if the dict has lowercase keys; use a label map ("Compact", "Comfortable"). `` `${Math.round(s*100)}%` `` is fine (digits). "Custom hue ({a.accentHue}°)" is an interpolated label and stays English.

---

### Backup — `/settings/backup` (screenshot 73)
**Purpose:** answer "is my shop data safe?" and let the owner make a copy (folder / pendrive) or bring one back.
**Works well:**
- Honest by design: every value is read back from the backend (comment BackupPage.tsx:25-35); copy is plain and reassuring ("Take it home — that is the copy that survives a stolen or dead computer").
- Buttons are real size (`Button` md, export tiles `h-11`, keep-count chips `h-10`); last error is shown in words with an icon (:415-426).
- Restore explains what will happen and saves the current data first (:480-484).

**Problems:**
1. [High] The answer to "am I safe?" is below the fold. "Last backup" / size / last error live in the fourth card (Schedule, :341-427), after Pendrive, Backup folder and Invoice PDF location. Screenshot 73 shows only setup text and "LAST PENDRIVE BACKUP: Never". Fix: a status banner as the first element, full width: big icon + `text-lg font-semibold` "Last backup: today 18:40 (2.1 MB)" in success, or "No backup for 5 days" / "The last backup did not finish" in warning/destructive with icon + words. Right of it the one primary `Button size="lg"` "Back up now". Under it one line: "Pendrive copy: never · Automatic: on shift close".
2. [High] Two competing primaries in the first viewport: header "Back up now" (indigo) and "Backup to Pendrive" (hard-coded `bg-blue-600` + border, `PendriveBackup.tsx:~150-164`). The owner cannot tell which one is "the backup". Fix: primary = "Back up now" inside the status banner (remove from the header); pendrive = `variant="outline" size="lg"` in its own card; drop the ad-hoc blue styling in the `inline` variant.
3. [High] Restore is not marked as dangerous. Each saved backup row has an outline `size="sm"` (28px) "Restore" (:461-468), the same look as Refresh and Open, and it sits in a scroll list next to Refresh. Confirmation happens in the main process (`stores/backup.ts:358-372`, `res.cancelled`), i.e. a native Windows dialog: English only, small system font, no Bangla. Fix: move restore into its own "Bring back old data" card at the bottom, separated from the schedule; row action `variant="outline"` with `text-destructive border-destructive/40`, `size="md"`; open an in-app confirm `Modal` (Bangla-capable) titled "Replace all shop data with the backup from 12 Mar 18:40?" with a typed/second-step confirm, then call the IPC.
4. [Med] The Invoice PDF location card (:254-340) with its own file list sits between backup setup and backup status. It is not a backup task. Fix: move it to Receipt & printer settings (or to the bottom under Advanced); keep one line here: "Invoice PDFs are also copied into the backup folder".
5. [Med] Setup and reassurance text dominates: three long paragraphs plus two dashed "ShieldCheck" notes (:240-251, :292-299). Fix: keep one short sentence per card; move the "never sends data over the internet" note behind a "How does cloud copy work?" disclosure.
6. [Med] The page title and tile say "Backup & Cloud" though there is no cloud service. Rename "Backup". Keep the "Cloud synced" badge when the folder is inside OneDrive/Drive.
7. [Med] "Back up now" is disabled when no folder is set (:112) with no reason shown. Fix: when `!config.folder`, the status banner says "Choose a backup folder first" with the Change folder button inline.
8. [Low] Every sub-label is `text-2xs uppercase tracking-[0.06em]` (12px uppercase; :139, :188, :211, :269, :302, :373, :399, :408, :474). → `text-xs font-medium` sentence case. Path lines `font-mono text-xs` are fine; cloud-root paths `text-2xs` (:~225) → `text-xs`.
9. [Low] Refresh buttons are inconsistent: `className="h-8"` override (:305) vs md (:~437). Both → `size="md"` icon + label, or remove (the lists already re-hydrate after each action).
10. [Low] Automatic-backup option hints `text-2xs` (:~368) and selected state `text-primary on bg-primary/10` (low contrast, see Appearance #5).

**Remove / merge:** header "Back up now" (moves into status banner); Invoice PDF card (moves out); second ShieldCheck note; "Current database" size (:408-412) — not useful to the owner, keep only in the backup row size.
**Resize:** all `text-2xs uppercase` labels → `text-xs`; Restore / Open `size="sm"` → `md`; Refresh `h-8` → `size="md"`; status line `text-sm` → `text-lg`.
**Popups on this screen:**
- `PendriveBackup.tsx` "Which pendrive?" `Modal max-w-md` (:171-205): good size and wording; drive rows are 64px targets. Fix: free space `text-xs` → `text-sm`; the trailing `CheckCircle2` on every row (:~196) looks like "already selected" — replace with `ChevronRight`. Only Cancel in the footer, fine.
- `PendriveBackup.tsx` "Choose the drive yourself" `Modal max-w-md` (:208-234): primary "Choose folder…" bottom-right with Cancel — correct. `{detectionFailed}` is a raw error string shown first in muted text; put the plain instruction first and the error below in `text-xs`.
- Native restore confirm (main process): see #3.
**Bangla:** dates use `toLocaleString('en-GB', {month:'short'})` (:58-66, :~146) → "12 Mar 2026, 18:40" stays English; use the app's date formatter. `` `Exported ${res.rows} rows to ${res.path}` `` (`stores/backup.ts:~381`) and `` `${formatGb(free)} free` `` (PendriveBackup.tsx:~188) are interpolated and stay English. The native restore dialog is English only.

---

### Users — `/settings/users` (screenshot 70)
**Purpose:** add a cashier, give him a PIN and a role, switch someone off when he leaves.
**Works well:**
- Rows are ~70px, name bold with a readable status badge; role and branch shown as chips.
- Add/Edit is a Drawer with `autoFocus` on Full name, Enter submits (`<form onSubmit>`), footer Cancel + primary bottom-right (UsersPage.tsx:~470-482).
- Deleting asks for confirmation and the owner account is protected (:214-220).

**Problems:**
1. [High] PIN entry is unsafe and unclear (UserForm, :398-405). The PIN is a plain visible text input (no `type="password"`), so it shows on the counter screen; no repeat field; "4-6 digits" appears only in the label and `isValid` (:~356) does not check length, so a 1-digit PIN saves. On edit the field is empty with no hint whether a PIN exists or whether empty keeps it. In screenshot 70 no row shows the "PIN set" key icon (:168-172) although PIN login is in use — the list apparently never receives `pin` (hashed server-side, `stores/users.ts:222`), so that marker never shows (not verified against the backend payload). Fix: a "PIN" section with `type="password" inputMode="numeric" autoComplete="off"` + "Repeat PIN", eye button to reveal, inline error "PIN must be 4 to 6 digits", and on edit a "Change PIN" button that reveals the two fields plus the line "The current PIN stays if you leave this empty". Show "PIN: set / not set" from a backend flag rather than the raw value.
2. [High] Deactivate is one click, no confirm, on an icon that reads as "hide" (`PowerOff`, :191-205), and it is offered on the owner's own row. Fix: move Activate/Deactivate into the Edit drawer (Status already exists there, :~408); confirm "Stop Rana from logging in?"; hide it for the signed-in user and the owner.
3. [Med] Row actions are three unlabeled `size-7` (28px) icons at `opacity-60` (:189-224); Delete sits next to Edit. Fix: whole row opens Edit; one visible `Button variant="outline" size="md"` "Edit"; Delete goes inside the drawer footer on the left, `variant="ghost"` destructive.
4. [Med] Search + role filter + status filter for four users (:107-141). Fix: hide the filter card when `users.length <= 8`.
5. [Med] The Auto-lock card leads the page (:106, :259-300) with `h-8 text-xs` chips (:283) and `Button size="sm"` "Lock now" (:293). It is a shop security setting, not a user. Keep it but move it below the list (or to "Everyday" on the hub) and resize chips to `h-10 px-4 text-sm`, "Lock now" → `md`.
6. [Low] Header `text-[10px] uppercase` (:143); username/phone line `text-[11px]` (:173); role descriptions in the form `text-[11px]` (:435); "Branches assigned" `text-[10px] uppercase` (:444); Field label (:499).
7. [Low] "Last login" uses `m/h/d ago` abbreviations (:28-39) and "All branches" in italic muted (:~315). Use whole words ("3 minutes ago") via a translatable formatter; "All branches" in normal text.

**Remove / merge:** filter card (for small lists); avatar initials circle (repeats the name); Deactivate row icon (into drawer); Email column content (rarely used in a shop, keep in form only).
**Resize:** row icons `size-7` → one `Button size="md"` "Edit"; auto-lock chips `h-8 text-xs` → `h-10 text-sm`; Lock now `sm` → `md`; selects `h-9 px-2` → `h-10 px-3`; table header → `text-xs font-medium` normal case.
**Popups on this screen:**
- User Drawer `max-w-xl` (:239-255): width is right. Problems: two-column grid pairs PIN with Status and Username with Full name — group instead as "Who" (name, phone), "Sign-in" (username, PIN, repeat PIN), "Access" (role, branches), "Status". Role tiles show `text-[11px]` descriptions → `text-xs`. Branch checkboxes are native 13px boxes in `py-1.5` rows → `size-5` boxes, `py-2.5` rows. Backdrop click closes the drawer and discards typed data (shared Drawer behaviour) — guard when dirty.
- `confirm()` delete dialog: title `Delete user "${u.name}"?` (:219) is interpolated; fine visually, but see Bangla.
**Bangla:** `` `${counts.total} users · ${counts.active} active` `` (:97), `` `${m}m ago` `` / `h ago` / `d ago` (:33-37), `` `Delete user "${u.name}"?` `` stay English. "PIN (4-6 digits)" needs its own dict key.

---

### Roles & permissions — `/settings/roles` (screenshot 71)
**Purpose:** decide what a Cashier / Manager / Stock keeper may do.
**Works well:**
- Master–detail layout: role list left, permissions right, grouped by area (POS / Checkout, Sales, Purchases…) with a group tick and "5/5" count.
- Labels are plain actions ("Void sale", "Override line price"); rows are whole-label click targets.
- Delete is blocked when users are assigned, with a reason (:153-160).

**Problems:**
1. [High] The owner can lock himself out. The system Admin role is fully editable: "Revoke all" and every checkbox work on Admin (:178-189, :229-238; the store only blocks delete, `stores/users.ts:138` "can be edited"). Every click saves at once with no undo (:333-345). Fix: Admin shows "Admin can do everything" and a read-only list, no checkboxes, no Grant/Revoke; for other roles, "Revoke all" asks for confirmation.
2. [High] Permission ids are printed on every row in mono: `pos.use`, `sales.priceOverride`… (`text-[10px] font-mono`, :241-244, screenshot 71 right side). Developer noise that competes with the labels. Remove (keep as `title` tooltip if needed for support).
3. [Med] Checkboxes are tiny: native checkbox (~13px) (:233-238) and a custom `size-4` group box (:205-218); rows `py-1.5` ≈ 32px. Fix: `size-5` checkboxes, rows `py-2.5 min-h-10`, group toggle `size-5` with a text label "All" beside it.
4. [Med] Changes save silently. There is no "Saved" feedback and no statement that the change applies to users already logged in or only on next login. Fix: header status line (shared #1) and one sentence under the role name: "Changes apply the next time a user logs in" (only if that is true — not verified).
5. [Med] "Quick: Grant all / Revoke all" are `h-6` (24px) `text-[12px]` buttons (:176-189). → `Button variant="outline" size="md"`; drop the "Quick:" label.
6. [Low] Role list: "43/43 perms" badge (developer count) and "1 users" `text-[10px]` (:113-118). Replace with "4 users" (proper plural) in `text-xs` and drop the perms badge — the right side already says "43 of 43 permissions enabled". Header "ROLES (4)" `text-[10px] uppercase` (:81) → remove (the list is self-evident). Description `text-[11px] truncate` (:107) → `text-xs line-clamp-2`.
7. [Low] The matrix scrolls inside `max-h-[60vh]` (:194) within a page that also scrolls → two scrollbars at 768px (visible in screenshot 71). Let the page scroll; make the role header + quick bar `sticky top-0`.
8. [Low] Edit (pencil) and Delete role are `size-8` unlabeled icons (:146-170). → `Button size="md" variant="ghost"` "Rename" and a separated destructive "Delete role".

**Remove / merge:** permission id column; "perms" badge; "ROLES (n)" header; "Quick:" label.
**Resize:** checkboxes → `size-5`; permission rows `py-1.5` → `py-2.5`; Grant/Revoke `h-6 text-[12px]` → `Button size="md"`; group count `text-[11px]` → `text-xs`; icon buttons `size-8` → labelled `md` buttons.
**Popups on this screen:**
- Add Role / Edit Role `Modal max-w-md` (:260-290, `RoleMetaForm` :293-335): right size, name autofocus, Enter submits, Cancel + Save bottom-right — good. Labels `text-[10px] uppercase` (:~311, :~317) → `text-xs`. Title "Add Role" → "New role"; after creating, the new role has zero permissions and no hint — add "Start from: Cashier / Manager / empty" select in this modal.
- Delete role `confirm()` (:161): destructive variant, fine.
**Bangla:** `` `${n}/${total} perms` ``, `` `${n} users` ``, `` `${a} of ${b} permissions enabled` `` (:190-192), `` `Cannot delete: ${n} users are assigned to this role` `` (:156-158) are interpolated and stay English. Permission labels come from `PERMISSION_GROUPS` — translated only if each label is a dict key (not checked).

---

## Short notes (code only)

**Branches — `/settings/branches`** (BranchesPage.tsx)
- [Med] Row actions are `opacity-60` until hover (:~84): "Set default" `text-[11px] h-7` text button (:~86-92) plus two unlabeled `size-7` icons (Edit, Delete). → "Make default" `Button variant="outline" size="md"`, Edit as labelled `md`, Delete inside the edit drawer.
- [Low] Search card for a list that is usually 1–3 branches (:43-52). Hide when `items.length <= 5`.
- [Low] Code chip `text-[10px] font-mono` (:~67) → `text-xs`; "· Mgr: {name}" abbreviation (:~80) → "Manager: {name}".
- [Low] Bangla: subtitle `` `${items.length} branches` `` (:35) and `` `Delete "${b.name}"?` `` stay English.

**Tax rates — `/settings/tax-rates`** (TaxRatesPage.tsx)
- [Med] thead `text-[11px] uppercase` (:43); rows `py-2.5` ≈ 40px; Edit/Delete `size-7` icons with no `title` (:83-100) at `opacity-60`. → `text-xs` normal-case header, `py-3`, labelled `md` Edit, Delete in the drawer.
- [Low] Scope shows the raw key through CSS `capitalize` in a Badge (`{t.scope ?? 'all'}`, :61-63) — untranslatable. Use a label map ("All", "Sales", "Purchases").
- [Low] "Set default" is a `text-[11px] h-7` button (:~72-77) and fires one `update` per rate (:24-26), each re-hydrating — a visible flicker. One `setDefault` call; button `size="md"`.

**Invoice schemes — `/settings/invoice-schemes`** (InvoiceSchemesPage.tsx) — schemes are KV prefs only (`stores/settings.ts:494-501`) and do not drive numbering yet.
- [High] Each card shows "Next: INV-2026-0001" (`previewSchemeNumber`, :~72-77) — a number the app will not use. The owner will believe his invoice numbers changed. Until wired, hide the tile under Advanced and show a banner "Invoice numbers are not changed by this page yet", or remove the "Next" preview.
- [Med] Meta line "Reset yearly · Year YYYY · Padding 4 · Start #1" (`text-xs`, :~62-70) is format jargon. Replace with the example number only, and a plain "Starts again every year".
- [Low] Icon-only `size-8` Edit/Delete (:~80-99); page has no `hydrate()` on mount unlike its siblings, so it shows defaults if opened first (not verified at runtime).

**Receipt template — `/settings/receipt-template`** (ReceiptTemplatePage.tsx)
- [High] Mixed save model on one page: every toggle and paper size autosaves via `setReceipt` → `writePref` (settings.ts:507), but header/footer text only saves on "Save Changes" (:66-76). Typing a footer and leaving loses it while the toggles above did save. Fix: save textareas on blur too, drop the header button, show "Saved ✓".
- [Med] "Preview size" 50mm / 80mm / A4 (:~94-118) looks like a real setting but only changes the preview (the note says so). Remove it; size the preview from the default printer's `paperWidth`. A4 preview is `width: 720` (:~176) inside a half-width column at 1366px → horizontal scroll.
- [Med] Merge with Receipt Printers into one "Receipt & printer" page: printer card on top (width, test print), template below, preview on the right.
- [Low] Labels `text-[10px] uppercase` (:~127, :~155); "LIVE PREVIEW" `text-[10px] uppercase` (:~172); note `text-[11px]` (:~181).

**Barcode — `/settings/barcode`** (BarcodeSettingsPage.tsx)
- [Med] Sample label always draws the bars even when "Barcode" is off (bars `div` not conditional, :~95-101; only the digits are), and "MRP" has no effect on the sample. Fix both so the sample is trustworthy.
- [Low] Fake "Saved" header button (:20-24); developer note "Real preview uses the codeType setting." `text-[10px]` (:~108-110) → remove.
- [Low] Labels `text-[10px] uppercase` (:~62, :~69); select `h-9 px-2` (:~74) → `h-10`. Label-size buttons say "50 × 30 mm (single roll)" — good plain copy, keep.

**Receipt printers — `/settings/printers`** (PrintersPage.tsx)
- [High] "Test" does not print: `onClick={() => toast.success(\`Test print sent to "${p.name}"\`)}` (:78-83). The owner is told a test page was sent when nothing happened. Wire to the real print path or remove the button.
- [Med] Row actions are `text-[11px] h-7` "Set default" / "Test" plus two icon-only `size-8` Edit/Delete with no `title` (:~70-99). → `Button size="md"` "Print test page" as the row's main action; "Make default" outline `md`; Edit labelled; Delete in the drawer.
- [Low] Meta line "USB · 80mm · CP437 · Main Branch" (:~62-68): encoding is technical — move to the edit drawer.

**POS preferences — `/settings/pos`** (POSPrefsPage.tsx; screenshot 67 already covered in the shared pattern)
- [Med] "Default payment method" tiles and "Visible payment methods" toggles are two cards editing one list (:~74-120). Merge into one list: each method row has a show/hide switch and a "Default" radio.
- [Med] "Allow negative stock by default" (:~139-144) is a risky policy switch shown at the same weight as "Auto-print". Move it to an "Advanced" group with a warning line; "Big-button mode" (useful for older eyes) should move up and be cross-linked from Text size.
- [Low] Remove the "What this affects" card (:156-164) and the fake "Saved" button (:39-42); labels `text-[10px] uppercase` (:50, :59); selected tile `text-primary on bg-primary/10` is low contrast (screenshot 67 "Cash").

**Cash register — `/settings/cash-register`** (CashRegisterPrefsPage.tsx)
- [Med] The long rule paragraph in `text-[11px]` (:~54-56) repeats the right-hand "What cashiers will see" preview. Drop the paragraph; keep the preview, with `text-[12px]` lines → `text-xs` (:~140-175).
- [Med] Currency is hard-coded: "(BDT)" (:~31) and "৳" in the preview titles (:~92-110), ignoring Business Info's currency symbol. No check that Warn < Block.
- [Low] Labels "Warn at (≥)" / "Block at (≥)" `text-[10px] uppercase` (:~35, :~44) → "Warn when short or over by" / "Stop closing when short or over by", `text-xs`. Fake "Saved" button (:20-23).
- [Low] Bangla: threshold titles are template strings with `{warn}`/`{block}` replaced in code (:~123) — they cannot be dictionary-matched.

**Keyboard shortcuts — `/settings/shortcuts`** (ShortcutsPage.tsx)
- [Med] The help text says "click Save to apply" (:~128-135) but the header "Saved" button is fake (:118-121) and the real apply is an unlabeled `size-8` tick icon (:~160-166). Fix: while recording, show `Button size="md"` "Use this key" + "Cancel"; delete the header button; rewrite the help to one line.
- [Med] Conflicts silently clear the other binding (:~86-92). Show "F8 was used for Hold cart — that is now unassigned" inline on the affected row.
- [Low] Row description `text-[11px]` (:~148); "unassigned" lowercase (:~180) → "Not set"; footnote `text-[11px]` (:~186). This page is for experts — Advanced group.

**Sales agents — `/settings/sales-agents`** (SalesAgentsPage.tsx)
- [Low] Good: dashed "When to use this" card says plainly to skip it (:37-50). Its text is `text-[12px]` (:~44) → `text-xs`.
- [Low] Uses a `Modal` for add/edit (:~92-108) while Users/Branches/Tax use a `Drawer` — pick one pattern for small settings forms (Modal `max-w-md` fits these 3-field forms better).
- [Low] Edit/Delete are icon-only `size-8` with no `title` (:~70-86). Bangla: `` `Delete agent "${a.name}"?` `` stays English.

**Updates — `/settings/updates`** (UpdatesPage.tsx)
- [Low] Good: three calm states, "no releases yet" is explicitly not shown as an error (:~176-186), honest network note, and a proper `role="switch"` `w-11 h-6` toggle (:~214-230) — the switch every settings page should use.
- [Low] "Check for updates" sits in the header while the result is in the card; put the button inside the status card next to "Last checked". "Open downloads page" `size="sm"` (:~200) → `md`.
- [Low] Bangla: `` `Last checked ${toLocaleString('en-GB')}` `` (:~98) and "Released {date}" are interpolated/English-formatted.

**Performance — `/settings/performance`** (PerformancePage.tsx)
- [Low] Good: two plain-language switches with correct `role="switch"` (:~150-165) and honest "needs a restart" copy.
- [Low] The restart banner (:~66-73) is local state and disappears on navigation; add a `Button size="md"` "Restart now" in it (the updater already has a restart path).
- [Low] "Reduce animations" is an eye-comfort option; mirror it on the Appearance page (or link to it). Info card text `text-xs muted` (:~98-110) can go to a single line.

---

## Cross-cutting patterns seen in this group
- **Fake "Saved" buttons on autosave pages.** A primary button that only fires a toast: POSPrefsPage.tsx:39-42, CashRegisterPrefsPage.tsx:20-23, BarcodeSettingsPage.tsx:21-24, ShortcutsPage.tsx:118-121, AppearancePage.tsx:81-84. Replace with one shared `<SaveStatus />` in `SettingsHeader` ("Changes save automatically" / "Saved ✓" / "Not saved") driven by `writePref` (`stores/settings.ts:344-348`).
- **Draft pages lose edits silently.** BusinessInfoPage.tsx, ReceiptTemplatePage.tsx (textareas). Add a shared `useDirtyGuard(draft, saved)` + sticky Save/Discard footer in `SettingsHeader`/a `SettingsPage` shell; toast only after the promise resolves.
- **Fake actions that claim success.** Printers "Test" (PrintersPage.tsx:78-83), Invoice schemes "Next:" number (InvoiceSchemesPage.tsx:~72-77), Receipt "Preview size" (ReceiptTemplatePage.tsx:~94-118), Barcode sample ignoring toggles. Wire them or remove them — on a settings screen, a control that does nothing is worse than a missing one.
- **Three switch implementations.** `ToggleRow` (`w-9 h-5`, no `role`, faint OFF; ToggleRow.tsx:22-33) vs the correct `role="switch" h-6 w-11` in UpdatesPage.tsx:~214 and PerformancePage.tsx:~150. Promote the latter into `ToggleRow`, add "On/Off" text, `text-xs` description, `min-h-12` row.
- **Local `Field` with `text-[10px] uppercase` labels, no `htmlFor`.** BusinessInfoPage.tsx:332, UsersPage.tsx:499, RolesPage.tsx:~311, and inline in POSPrefsPage, CashRegisterPrefsPage, BarcodeSettingsPage, ReceiptTemplatePage, AppearancePage; `text-2xs uppercase` in BackupPage (9×). One shared `FormField` (`text-xs font-medium`, sentence case).
- **Hand-copied `<select className="h-9 … px-2">`.** BusinessInfoPage.tsx (7×), UsersPage.tsx (3×), BarcodeSettingsPage.tsx. Shared `Select` at `h-10 px-3 text-sm`.
- **Selected-tile style `border-primary bg-primary/10 text-primary`** is low contrast on dark (screenshots 66, 67): AppearancePage (theme, density, font), POSPrefsPage (payment), BackupPage (auto, keep), UsersPage (auto-lock), BarcodeSettingsPage, ReceiptTemplatePage. A shared `ChoiceTile` with `bg-primary text-primary-foreground` + check icon when selected.
- **Row actions: unlabeled `size-7`/`size-8` icons at `opacity-60`, Delete next to Edit, "Set default" as `text-[11px] h-7`.** UsersPage.tsx:189-224, BranchesPage.tsx:~84-110, TaxRatesPage.tsx:~72-100, PrintersPage.tsx:~70-99, InvoiceSchemesPage.tsx:~80-99, SalesAgentsPage.tsx:~70-86, RolesPage.tsx:146-170. Standard: row click = edit; one labelled `Button size="md"`; Delete inside the drawer, separated on the left.
- **Filters/search on tiny lists.** UsersPage.tsx:107-141, BranchesPage.tsx:43-52. Hide below ~8 rows.
- **Interpolated strings and `en-GB` dates that stay English.** Subtitles (`${n} users · ${m} active`, `${n} branches`), confirm titles (`Delete "${name}"?`), role counts, backup/updates dates via `toLocaleString('en-GB')`, `m/h/d ago`, CashRegister `{warn}` templates, `Exported ${rows} rows…`. Route through dict keys with placeholders and one shared date formatter.
- **Developer notes in the UI.** "What this affects" (POSPrefsPage), permission ids (RolesPage.tsx:241-244), "perms" badge, "Real preview uses the codeType setting" (BarcodeSettingsPage), "Current database" size (BackupPage). Remove.
- **Hub ordering by category, not by need.** Settings.tsx:41-77. Everyday (Backup, Text size & theme, Shop details, Users) first; Advanced collapsed.
