



# Frontend Map — where to edit what

> **Who this is for:** you, changing how the app *looks*, without going near the
> money math. Every path is under `src/`.
>
> **The one rule:** the frontend never invents a number. If a value has no
> backend source, show `—` and leave it out of totals. Restyling is free;
> inventing data is not.

---

## 0. The 60-second version

| I want to change…                                      | Open this                                                         |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| Colours, dark mode, radius                              | `src/styles/globals.css` (the CSS variables at the top)         |
| Font sizes everywhere                                   | `tailwind.config.js` → `theme.extend.fontSize`               |
| A button / input / card looks wrong**everywhere** | `src/components/ui/`                                            |
| The window top bar                                      | `src/components/layout/Titlebar.tsx`                            |
| The left menu and its items                             | `src/components/layout/Sidebar.tsx`                             |
| The POS (checkout) screen                               | `src/pages/POS.tsx` + `src/components/pos/`                   |
| The printed receipt                                     | `src/components/pos/Receipt.tsx` + print CSS in `globals.css` |
| The dashboard cards                                     | `src/components/dashboard/`                                     |
| One specific screen                                     | `src/pages/<Name>.tsx` — names match the menu                  |
| Bangla wording                                          | `src/lib/bn/dict.ts` (add one line, no component edit)          |

Run `npm run dev` while editing — the screen reloads as you save.

---

## 1. How a screen is put together

```
main.tsx                 boots React
└── App.tsx              ROUTES: url → page component
    └── AuthGate         login / lock / first-run gate
        └── AppShell     Titlebar + Sidebar + <main>
            └── pages/*  ONE FILE PER SCREEN
                └── components/*  reusable pieces
```

- **`src/App.tsx`** is the routing table. To find the file behind a screen, find
  its URL here. It is also where a new screen gets registered.
- **`src/components/layout/AppShell.tsx`** is the frame every screen sits in
  (also handles the narrow-window sidebar collapse).

### Lazy screens — don't be surprised

Reports and Settings pages are loaded **on demand** (`lazy(() => import(...))` in
`App.tsx`) so the app starts faster on the slow PC. They are still ordinary files
you edit normally. Same for the dashboard chart widgets
(`components/dashboard/lazyWidgets.ts`). If you add a new *report* or *settings*
page, copy the `lazy(...)` style of its neighbours; anything else can be a plain
`import`.

---

## 2. Design tokens — change these first

### `src/styles/globals.css`

The single source of colour. Everything else refers to these, so editing one
variable restyles the whole app.

- `:root { … }` — light theme. `--primary`, `--background`, `--card`,
  `--border`, `--muted-foreground`, `--success`, `--warning`, `--destructive`.
- `.dark { … }` — the dark theme's overrides.
- Values are **HSL numbers without the `hsl()`** — `220 90% 56%`, not `#2563eb`.
- `--radius` controls corner roundness everywhere.
- Further down: custom scrollbars, the frameless-window rules
  (`.titlebar-drag`), `.app-shell`, the **reduce-animations** block, and the
  **`@media print`** block.

> `--primary` is also written at runtime from Settings → Appearance (accent
> colour slider) in `App.tsx`. If your change to `--primary` seems ignored, that
> is why — change the default in `stores/settings.ts` instead.

### `tailwind.config.js`

- `theme.extend.colors` — maps the CSS variables to Tailwind names, so
  `bg-primary` / `text-warning` work. Add a colour here **and** in `globals.css`.
- `theme.extend.fontSize` — **the whole app's type scale is bumped ~2px** over
  Tailwind's default because the owner is elderly. `text-sm` is 16px here, not
  14px. Change sizes here rather than sprinkling bigger classes on components.
- `theme.extend.fontFamily` — no webfonts are downloaded on purpose (offline
  counter PC). Everything after the first entry ships with Windows.
- `keyframes` / `animation` — `fade-in`, `scale-in`, `slide-in-right`.

---

## 3. The shared UI kit — `src/components/ui/`

Edit one of these and **every screen changes**. This is usually what you want.

| File                                                           | What it is                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Button.tsx`                                                 | All buttons. Variants:`primary`, `outline`, `ghost`, `destructive`; sizes `sm`/default |
| `Input.tsx`                                                  | All single-line text fields                                                                      |
| `NumberField.tsx`                                            | Numeric input (money/qty) — right-aligned, tabular digits                                       |
| `Card.tsx`                                                   | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`                    |
| `Badge.tsx`                                                  | Status pills. Variants`default`/`info`/`success`/`warning`/`destructive`               |
| `Modal.tsx`                                                  | Centred dialog                                                                                   |
| `Drawer.tsx`                                                 | Side panel (used for edit forms)                                                                 |
| `ConfirmDialog.tsx`                                          | The global "are you sure?" — driven by`stores/confirm.ts`                                     |
| `PromptDialog.tsx`                                           | The global "type a reason" — driven by`stores/prompt.ts`                                      |
| `Toaster.tsx`                                                | Corner notifications — driven by`stores/toast.ts`                                             |
| `PageHeader.tsx`                                             | The title + subtitle + action buttons strip at the top of a page                                 |
| `Pagination.tsx`                                             | Page-size + prev/next footer on long lists                                                       |
| `Popover.tsx`                                                | Click-to-open floating panel                                                                     |
| `Splitter.tsx`                                               | The draggable divider on the POS screen                                                          |
| `Skeleton.tsx` / `EmptyState.tsx` / `LoadingOverlay.tsx` | Loading + empty states                                                                           |
| `PrintSheet.tsx`                                             | Portals content outside`#root` so **only it** prints                                     |
| `ColumnsPanel.tsx`                                           | The "which columns" chooser on list screens                                                      |
| `ToggleRow.tsx`                                              | Label + description + switch row used across Settings                                            |

**Two rules for dialogs:** never use the browser's `confirm()` / `alert()` /
`prompt()` (they break keyboard focus on Windows — use the stores above), and any
new full-screen overlay needs `data-overlay="true"` so the POS search box does
not steal the caret from it.

---

## 4. Layout chrome — `src/components/layout/`

| File                 | Notes                                                                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Titlebar.tsx`     | Custom window bar: brand, global search, shift pill, min/max/close, account menu.**Anything clickable needs the `titlebar-no-drag` class**, or the OS treats the click as dragging the window. The account menu is portalled to `<body>`. |
| `Sidebar.tsx`      | The whole menu. The`nav` array near the top **is** the menu — labels, icons, links, groups. Edit that array to add/rename/reorder items. Collapses to icons on narrow windows.                                                             |
| `AppShell.tsx`     | Titlebar + Sidebar + scrolling`<main>`. Owns the responsive collapse and the mobile scrim.                                                                                                                                                        |
| `GlobalSearch.tsx` | The Ctrl+K search box in the titlebar.                                                                                                                                                                                                              |

---

## 5. Screens — `src/pages/`

One file per screen, named after the menu item. Highlights:

**Selling**

- `POS.tsx` — the checkout screen. Layout, keyboard shortcuts (F2–F10), cart
  state wiring. Visual detail lives in `components/pos/`.
- `Sales.tsx` (list) · `AddSale.tsx` (form-based sale **and** the edit-a-sale
  screen) · `Drafts.tsx` · `Quotations.tsx` · `SellReturns.tsx` · `Shipments.tsx`

**Catalogue**

- `Products.tsx` — the big product table (columns, filters, bulk actions).
- `ProductEdit.tsx` — the full 25-field product form (renders
  `components/products/ProductForm.tsx`).
- `Categories.tsx` · `Brands.tsx` · `Units.tsx` · `Warranties.tsx` ·
  `PriceGroups.tsx` · `BulkPriceUpdate.tsx` · `BarcodePrint.tsx`

**People** — `Customers.tsx` · `CustomerDetail.tsx` · `CustomerDues.tsx` ·
`CustomerGroups.tsx` · `Suppliers.tsx` · `SupplierDetail.tsx`

**Buying / stock** — `Purchases.tsx` · `AddPurchase.tsx` · `PurchaseReturns.tsx` ·
`Stock.tsx` · `StockAlerts.tsx` · `StockTransfers.tsx` · `AddStockTransfer.tsx` ·
`StockAdjustments.tsx` · `AddStockAdjustment.tsx`

**Money** — `Expenses.tsx` · `ExpenseCategories.tsx` · `CashRegister.tsx` ·
`RegisterReport.tsx`

**Dashboard / reports** — `Dashboard.tsx`, `Reports.tsx` (the tile index), and
`pages/reports/*` (one file per report; they share
`components/reports/ReportToolbar.tsx` for the date range and export row).

**Settings** — `Settings.tsx` is the tile grid; each tile's screen is
`pages/settings/*`. To add a tile, add one row to the `tiles` array in
`Settings.tsx` (with `needs:` set to the permission it requires) plus a route in
`App.tsx`.

**Auth** — `pages/auth/LoginPage.tsx` · `LockScreen.tsx` · `FirstRunWizard.tsx`

**Not routed** — `pages/SMS.tsx` and `pages/sms/*` are kept on disk but removed
from the menu (no backend existed). Ignore them.

---

## 6. Feature components

### `src/components/pos/` — the checkout screen

| File                                                                   | What it draws                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProductPanel.tsx`                                                   | Search box, category/brand chips, and the product**grid** and **list** views. Grid columns come from the *panel* width, not the window — don't switch it to `md:`/`lg:` breakpoints, that was a bug. |
| `CartPanel.tsx`                                                      | Cart tabs, customer strip, the totals footer and the big action bar                                                                                                                                                     |
| `CartLineRow.tsx`                                                    | One line in the cart: qty stepper, unit, discount drawer, and the buying/avg/selling price strip                                                                                                                        |
| `PaymentModal.tsx`                                                   | Take payment (cash/bKash/card/split)                                                                                                                                                                                    |
| `Receipt.tsx`                                                        | **The printed receipt layout**                                                                                                                                                                                    |
| `ReceiptModal.tsx`                                                   | The after-sale popup wrapping the receipt (Print / Save as PDF)                                                                                                                                                         |
| `CustomerPicker.tsx` · `HeldList.tsx` · `ShortcutsOverlay.tsx` | Pickers and the`?` help overlay                                                                                                                                                                                       |
| `types.ts`                                                           | Cart line/total**math** — careful, this is money                                                                                                                                                                 |

### `src/components/dashboard/`

- `widgets.tsx` — **every chart and list widget body.** The only file that uses
  `recharts`; loaded on demand via `lazyWidgets.ts`.
- `widgetRegistry.tsx` — maps a widget id → component + its grid width. Add a
  widget here and in `WIDGET_META`.
- `kpiRegistry.tsx` + `Kpi.tsx` — the number tiles across the top.
- `Widget.tsx` — the card frame every widget sits in (title, "view all" link,
  remove/reorder buttons, loading skeleton).
- `CustomizePanel.tsx` — the show/hide/reorder panel.
- `TimeRange.tsx` · `Shortcuts.tsx` · `ProfitDetail.tsx` · `ProfitPopover.tsx`
- `PendriveBackup.tsx` — the "Backup to Pendrive" button.

### Other groups

`components/products/` (ProductForm, QuickUpdateModal, ProductImage) ·
`components/sales/` (SaleDetail drawer, payment/return/shipment modals) ·
`components/purchases/` · `components/contacts/` (CustomerForm, SupplierForm,
Avatar, payment modals) · `components/expenses/` · `components/cash/`
(shift open/close, Z-report) · `components/settings/SettingsHeader.tsx`

---

## 7. Where the data comes from (so you don't fight it)

You rarely need these to restyle, but this is the chain:

```
component → hooks/use*.ts  → lib/api.ts → IPC → backend (SQLite)
         └→ stores/*.ts (zustand: UI state + some data)
```

- **`hooks/use*.ts`** — TanStack Query hooks: `useProducts`, `useCatalog`,
  `useCustomers`, `useReport`, `useDashboardData`. These fetch and cache.
- **`hooks/*Adapter.ts`** — translate `snake_case` backend rows into the
  `camelCase` shapes components use. If a field is missing on screen, it is
  usually missing here.
- **`stores/*.ts`** — zustand. Two kinds:
  - **UI state** (safe to touch): `ui.ts` (sidebar/density), `theme.ts`,
    `pos.ts` (POS layout + splitter), `posCart.ts` (open carts),
    `*UI.ts` (which columns a list shows), `toast.ts`, `confirm.ts`, `prompt.ts`
  - **Data + writes** (careful): `sales.ts`, `purchases.ts`, `products.ts`,
    `contacts.ts`, `expenses.ts`, `stock.ts`, `cashRegister.ts`, `settings.ts`,
    `users.ts`, `auth.ts`, `backup.ts`, `updates.ts`
- **`types/domain.ts`** — the shared `Product` / `Customer` / … shapes.

### Showing or hiding by role

`hooks/useCan.ts` — `useCan('sales.edit')` / `useCanAll([...])`. Use it to hide a
button a cashier may not use. It is **presentation only**; the real gate is in
the Electron layer, so hiding a button is never a security decision.

---

## 8. Bangla text

`src/lib/bn/dict.ts` maps **exact English UI text → Bangla**. Adding a
translation is one line at the **end** of the file; no component changes.

```ts
Object.assign(BN, {
  'Backup to Pendrive': 'পেনড্রাইভে ব্যাকআপ',
});
```

Rules that will bite you otherwise:

1. **Append only.** Never reorder or delete existing blocks.
2. The key must be the **whole rendered text of one element**. This works:
   `<div>Buying price</div>`. This can never be translated:
   `<div>Buying {label} price</div>` — it becomes several text nodes.
3. Wrap anything that must stay English (paths, versions, invoice numbers) in
   `data-no-i18n`.
4. Run **`npm run i18n:check`** after editing — it fails on a duplicate key with
   a conflicting translation, and it has caught real mistakes twice.
5. `npm run i18n:extract` writes `scripts/strings.txt`, a list of visible English
   text you can use to find what is still untranslated.

`lib/bn/translate.ts` is the engine (a `MutationObserver` swapping text nodes).
You should not need to touch it.

---

## 9. Print / receipts

- Receipt markup: `components/pos/Receipt.tsx`.
- Paper width comes from Settings → Printers via `hooks/usePaperWidth.ts`.
- `components/ui/PrintSheet.tsx` portals the receipt outside `#root`; the
  `@media print` block in `globals.css` then hides `#root` so **only** the
  receipt prints.
- Mark screen-only chrome with `print:hidden`.
- Saving a PDF re-uses the same print CSS, so **don't decouple them** — a change
  to the print block changes the PDF too. Test both.

---

## 10. Performance notes (the slow Windows 7 PC)

Things already done that you should not undo:

- **No `backdrop-blur` on anything permanently on screen.** The titlebar used to
  have it; a `backdrop-filter` forces continuous GPU compositing of everything
  underneath, every frame. Use an opaque background.
- Reports, Settings and the chart widgets are **lazy-loaded**; keep new heavy or
  rarely-used screens lazy too.
- `recharts` must stay imported **only** by `components/dashboard/widgets.tsx`.
  Importing it anywhere eagerly pulls ~410 KB back into startup.
- The dashboard's 30s auto-refresh **pauses while the window is hidden**.
- Settings → Performance offers "reduce animations" (a `reduce-motion` class on
  `<html>`, handled in `globals.css`) and "turn off graphics acceleration".
- Avoid rendering unbounded lists. The POS product list caps at 200 rows with a
  "keep typing" notice; long tables use `Pagination.tsx`.

---

## 11. Practical workflow

```bash
npm run dev          # live-reloading app; edit and see it instantly
npx tsc --noEmit -p tsconfig.json   # did I break a type?
npm run i18n:check   # did I break the Bangla dictionary?
npm run build        # production build (also typechecks)
```

`npm run lint` does **not** work — eslint is not installed. `tsc` is the check.

**Safe to change freely:** anything in `globals.css`, `tailwind.config.js`,
`components/ui/`, `components/layout/`, and the JSX/classes inside `pages/`.

**Think twice:** `components/pos/types.ts`, any `stores/*.ts` write function, and
`hooks/*Adapter.ts` — those decide what the numbers *are*, not how they look.

**Sanity check after a visual change:** open the POS screen, drag the splitter
narrow, and switch the language to Bangla. Those three things break layouts more
often than anything else — narrow panels and longer Bangla words.
