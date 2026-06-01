# Frontend — Complete Reference

The UI is feature-complete. Every **data-bearing** store is now backend-aware: under
Electron it reads/writes the real SQLite backend through `src/lib/api.ts`; in plain
browser dev (`!hasBackend()`) it falls back to the original mock seed so the UI still
runs. Pure-UI stores (theme, ui, i18n, toast, confirm) stay local.

## Layout & shell

- `src/main.tsx` — entry; mounts `HashRouter` + `QueryClientProvider` + `<App/>`.
- `src/App.tsx` — all routes; wraps everything in `<AuthGate>` → `<AppShell>`; mounts
  global overlays (`Toaster`, `ConfirmDialog`); applies persisted appearance; calls
  `useAuth.restoreSession()` on boot.
- `src/components/layout/AppShell.tsx` — titlebar + sidebar + main content + error
  boundary + command palette.
- `src/components/layout/Titlebar.tsx` — frameless drag region, brand, branch switcher,
  global search, status pills (shift/sync), density/language/theme toggles, profile menu
  (lock/sign-out), window controls. Hydrates the cash store on mount for the shift pill.
- `src/components/layout/Sidebar.tsx` — accordion nav, collapsible.
- `src/components/layout/GlobalSearch.tsx` — `#scope:term` search, portaled dropdown,
  Ctrl+K. (Backend channel `search.global` exists; wire when desired.)
- `src/components/layout/CommandPalette.tsx` — Ctrl+Shift+P action palette.

## Data hooks & adapters (`src/hooks/`)

These bridge backend snake_case rows ↔ the camelCase types the components already use.

| Hook / adapter | Backs | Notes |
|----------------|-------|-------|
| `useProducts.ts` | products | TanStack Query; `toProduct`/`fromProduct`; create/update/delete mutations |
| `useCatalog.ts` | categories/brands/units | TanStack Query; create/update/delete each |
| `purchaseAdapter.ts` | purchases | `toPurchaseRecord` |
| `saleAdapter.ts` | sales + sell-returns | `toSaleRecord`, `toSellReturnRecord` |
| `contactAdapter.ts` | customers/suppliers | `toCustomer`, `toSupplier` |
| `cashAdapter.ts` | shifts/movements | `toShift`, `toMovement`, `BRANCH_NAME`, `resolveBranchId` |
| `expenseAdapter.ts` | expenses/categories | `toExpense`, `toCategory` |
| `stockOpsAdapter.ts` | transfers/adjustments | `toTransfer`, `toAdjustment` (inject id→name) |
| `settingsAdapter.ts` | business/branches/tax/users/roles/agents | `toBusinessInfo`, `toBranch`, `toTaxRate`, `toUser`, `toRole`, `toAgent` (no hashes) |
| `useReport.ts` | all reports | generic `useReport(channel, payload, deps)` + `useBranchId` |
| `useDashboardData.tsx` | dashboard | context provider; fetches all `dashboard.*` keyed by range |

## State stores (`src/stores/`)

| Store | Mode | Backend channels |
|-------|------|------------------|
| `products.ts` (+ productsUI) | TanStack Query hooks | `products.*` |
| `masterData.ts` (categories/brands/units/warranties/priceGroups) | backend-aware (catalog hooks + CRUD) | `categories.*`, `brands.*`, `units.*`, `warranties.*`, `priceGroups.*` |
| `sales.ts` | backend-aware (`hydrate`) | `sales.*`, `sellReturns.*` |
| `purchases.ts` | backend-aware (`hydrate`) | `purchases.*`, `purchaseReturns.*` |
| `stock.ts` (+ stockUI) | backend-aware (`hydrate`) | `transfers.*`, `adjustments.*` |
| `contacts.ts` | backend-aware (`hydrate`) | `customers.*`, `suppliers.*` |
| `cashRegister.ts` | backend-aware (`hydrate`, persist) | `cash.*`, `shifts.*` |
| `expenses.ts` | backend-aware (`hydrate`, persist) | `expenses.*`, `expenseCategories.*` |
| `dashboard.ts` | layout in store; data via `useDashboardData` | `dashboard.*` |
| `settings.ts` | backend-aware (`hydrate`, persist) | `business.*`, `taxRates.*`, `settings.get/set/getAll` |
| `branches.ts` | backend-aware (`hydrate`, persist) | `branches.*` |
| `users.ts` | backend-aware (`hydrate`, persist) | `users.*`, `roles.*`, `agents.*` |
| `auth.ts` | backend-aware (session in main) | `session.*`, `auth.*`, `setup.*` |
| `activity.ts` | reads backend `dashboard.activityFeed`; local store only as browser-dev fallback | `dashboard.activityFeed` |
| `sms.ts` | mock (deferred — no backend) | n/a |
| `theme.ts`, `ui.ts`, `i18n.ts`, `toast.ts`, `confirm.ts` | pure UI — keep local | n/a |

## Pages by module (`src/pages/`) — ALL WIRED

**Dashboard** — `Dashboard.tsx` wrapped in `<DashboardDataProvider>`; KPIs/widgets read
backend data via `useDashboardData()` (real DB through the `dashboard.*` channels). Falls
back to mock ONLY in plain browser dev (`!hasBackend()`); under Electron it is always the DB.

- **POS / Checkout** — `POS.tsx` + `components/pos/*`. ✅ **WIRED.** Product/customer pickers
  read live backend data (`useProducts`, `useCustomersQuery`); payment confirm persists via
  `sales.create` (Credit = unpaid remainder; receipt uses backend invoice/`due`); F6/F7 save
  Draft/Quotation via `status`. Park/Hold stay client-side. Mock fallback preserved.

**Sales** — `Sales.tsx`, `AddSale.tsx`, `Drafts.tsx`, `Quotations.tsx`, `SellReturns.tsx`,
`Shipments.tsx`. List/detail/void/delete/payment/return wired. AddSale create-form reads
real master data and persists via `sales.create`. Editing/converting a draft or quotation
deletes the source so no duplicate remains; editing a FINAL sale is blocked (Void + recreate)
to protect stock/cash integrity. Shipments has its own backend table + channels.

**Purchases** — `Purchases.tsx`, `AddPurchase.tsx`, `PurchaseReturns.tsx`. Wired. AddPurchase
create-form reads real products/suppliers/branches and persists via `purchases.create`;
editing a saved purchase is blocked (Cancel + re-add) to protect stock/cash integrity (there
is no `purchases.update` channel).

**Products** — `Products.tsx` (+drawer), `ProductEdit.tsx` (full page), `Categories.tsx`,
`Brands.tsx`, `Units.tsx`, `Warranties.tsx`, `PriceGroups.tsx` — all wired to real backend
CRUD. Bulk price update + barcode print read real catalog (display/print only).

**Stock** — `Stock.tsx`, `StockAlerts.tsx`, `StockTransfers.tsx`, `AddStockTransfer.tsx`,
`StockAdjustments.tsx`, `AddStockAdjustment.tsx` — wired (transfer-cancel deferred).

**Contacts** — customers/suppliers list/detail/dues/groups — wired.

**Cash Register** — `CashRegister.tsx`, `RegisterReport.tsx` — wired.

**Expenses** — `Expenses.tsx`, `ExpenseCategories.tsx` — wired.

**Reports** — landing + 16 report pages — all wired (read-only).

**SMS** — frontend complete; **gateway integration deferred**.

**Settings** — BusinessInfo, Branches, TaxRates, Users, Roles, SalesAgents wired to real
entities; device/UI prefs (Appearance, POSPrefs, CashRegisterPrefs, Shortcuts, Barcode,
Receipt, Printers, InvoiceSchemes, Backup) persist app-wide via `settings_kv`.

**Auth** — `pages/auth/*`: LoginPage (PIN pad + password, backend-verified), LockScreen,
FirstRunWizard (writes a real shop via `setup.complete`). `AuthGate` decides phase + idle
auto-lock.

## Renderer→backend client (`src/lib/api.ts`)

- `api(channel, payload)` → resolves data or throws `ApiError`
- `apiSafe(...)` → returns null on error
- `hasBackend()` → `typeof window !== 'undefined' && !!window.api?.db`
- `window.api.db.invoke(...)` type declared in `src/types/global.d.ts`

## The established wiring pattern (used for every slice — follow it for new ones)

1. **Backend**: add any missing write handler to `backend/services/*.ts` (tx-wrapped, reuse
   `core/`), register the channel in `backend/api.ts`, add a scenario test in
   `backend/verify/scenarios.ts` + an api round-trip in `backend/verify/api.ts`.
2. **Adapter**: `src/hooks/xxxAdapter.ts` mapping snake_case→camelCase (and back for writes).
3. **Store**: make it backend-aware — `loading` + `hydrate()` (reads), and each write does
   `api(channel,...).then(() => hydrate()).catch((e) => { toast.error(e.message); hydrate(); })`
   when `hasBackend()`, else the original mock optimistic path. Keep synchronous `add()`
   returns (optimistic) for callers that need them.
4. **Pages**: `useEffect(() => void hydrate(), [hydrate])` on entry pages. Loading →
   `Skeleton*`. Writes → `toast` + `confirm`.
5. **Verify**: `npm run backend:typecheck && npx tsc --noEmit -p tsconfig.json &&
   npm run backend:verify:all && npm run build`, then `npm run rebuild:electron`.

## Conventions

- Numeric inputs always use `NumberField` (handles `0`/decimals correctly).
- Money formatting via `src/lib/utils.ts` `formatBDT`.
- Branch name↔id: resolve through `resolveBranchId`/`useBranchId` (backend uses ids;
  several pages still use branch names in the UI).
- `CURRENT_USER = 'u_admin'` / `DEFAULT_BRANCH = 'br_mp'` constants are used consistently
  across stores for the single-branch/owner assumption (until multi-branch context lands).
