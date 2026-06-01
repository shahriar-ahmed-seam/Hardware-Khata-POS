# 06 — End-to-End & Smoke Test

This is the **final proof** that data input/output, calculations, and sync are
correct across the *whole* app. There are two parts:

1. **Programmatic E2E** — an automated full-shop-day test that drives the exact
   backend channels the UI calls, from a clean first-run database through a
   complete day, and asserts every cross-module number reconciles.
2. **Manual smoke test** — a short checklist the owner runs by hand in the real
   GUI (the parts a script can't click).

Run both before shipping a build.

---

## Part 1 — Programmatic E2E (automated)

### How to run

```bash
npm run backend:e2e        # the full-shop-day suite alone
npm run backend:verify:all # every backend suite, including E2E
```

`backend:e2e` rebuilds the native `better-sqlite3` binding for Node, then runs
`backend/verify/e2e.ts`. It prints a single line, e.g.:

```
E2E (full-shop-day): 68/68 checks in 916ms
✅ ALL E2E CHECKS PASSED
```

A non-zero exit code means a check failed — the failing assertion name and the
expected-vs-actual delta are printed so you can pinpoint it.

### What it proves

The suite starts from the **clean first-run state** — `openDatabase(':memory:')`
→ `migrate` → `seedMaster` (master/reference data only, **no** opening stock, **no**
demo simulation) — then builds the API map with `buildApi()` and drives a realistic
day through `api[channel](db, payload)`, exactly like the Electron IPC layer does.
It walks, in order:

1. **First-run** — `setup.status` (not complete) → `setup.complete` (shop/admin/
   branch/tax) → `setup.status` (complete); business name persisted, branch renamed
   + default, admin authenticates with the chosen PIN, the seed default PIN is
   rejected, and a second `setup.complete` throws (run-once / self-disabling).
2. **Open shift** — `cash.openShift` with opening cash; `cash.shiftTotals.expected`
   equals the opening float.
3. **Receive a purchase** — `purchases.create` (received, partial cash) raises stock
   by the purchased qty, sets supplier due to `total − paid`, and the cash portion
   reduces the drawer.
4. **POS cash sale** (the hero path) — `sales.create` (Cash fully covering) returns
   `due == 0`, drops stock by the sold qty, raises the drawer by the cash amount, and
   appears in `sales.list`.
5. **Credit sale + customer due** — `sales.create` (no payment) raises the customer's
   due by the total; `sales.addPayment` (partial cash) drops the due exactly and hits
   the drawer.
6. **Sell return** — `sellReturns.create` (Cash refund) restocks the returned qty and
   reduces the drawer by the refund.
7. **Expense** — `expenses.create` (Cash) drops the drawer; `expenses.void` restores it
   and removes it from `expenses.list`.
8. **Stock transfer** — `transfers.create` (br_mp → br_ut, in-transit) reduces the
   source immediately; `transfers.receive` increases the destination; total stock is
   conserved across branches.
9. **Adjustment** — `adjustments.create` (damage, signed −qty) reduces stock by exactly
   that qty.
10. **Close shift** — `cash.closeShift` with counted == expected yields variance 0; the
    branch then has no open shift.
11. **Cross-module reconciliation (the money-conservation finale)** —
    - `dashboard.stats` sales total == Σ today's final sales from `sales.list`;
      transaction count matches; cash-in-drawer is 0 once the shift is closed;
      customer/supplier dues totals match summing `customers.list` / `suppliers.list`.
    - `reports.profitLoss` revenue / COGS / sell-returns reconcile to the raw sale
      primitives, and `netProfit` is recomputed from the same numbers the report
      exposes.
    - `reports.stock` total value matches summing per-product `stock × cost`
      (and matches `products.list` recomputed the same way).
    - No negative stock anywhere; `PRAGMA foreign_key_check` is clean.

Each assertion uses a 1-paisa epsilon for money and is independently named, so a
failure points straight at the broken identity.

### Why it calls handlers directly (the permission-gate note)

The E2E harness invokes the backend handlers **directly** through `buildApi()` —
the same flat `channel → handler(db, payload)` map the renderer talks to. It does
**not** go through Electron IPC, so the **IPC permission gate is deliberately not
exercised here**.

That is by design. Permission **enforcement** lives at the transport boundary
(`electron/ipc.ts` + `electron/permissions.ts`), *not* inside the services or
`buildApi()`. Keeping the services enforcement-free is exactly what lets the Node
verify harness drive them. The permission gate is covered separately by:

- the **manual cashier-permission step** in the smoke test below, and
- the documented design (`electron/permissions.ts` maps each mutating channel to a
  required permission; reads are open; `auth.*` is always allowed; admins satisfy
  every entry).

---

## Part 2 — Manual smoke test (owner checklist)

Run this by hand in the real app. It mirrors the automated flow but exercises the
GUI, printing, and the permission gate that the harness can't.

### Start from a clean database

You want a true first-run, so clear the existing data first:

- **Delete** the dev database file: `userData/pos.db` (plus `pos.db-wal` /
  `pos.db-shm` if present), **or**
- start with the clean seed: set `POS_SEED=clean` before launching.

Then:

```bash
npm run dev
```

For each step below: **what to click** → **what to expect**.

### 1. First-run wizard
- The First-Run Wizard appears (no login yet).
- Enter shop name, an admin name + username, a **memorable PIN**, pick the default
  branch + tax, optionally a printer.
- Finish → **Expect**: it drops you at the login/lock screen. The wizard does not
  reappear on the next launch.

### 2. Login
- Enter the **PIN you just chose**. → **Expect**: you land on the Dashboard as the
  owner. The old demo PIN (1234) does **not** work.

### 3. Open shift
- Go to **Cash Register → Open Shift**, enter an opening float (e.g. 5000).
  → **Expect**: shift shows open; expected cash == opening float.

### 4. Add a product
- **Products → New Product**: fill SKU, name, cost, price, an opening stock.
  → **Expect**: it appears in the Products list with the stock you entered.

### 5. Receive a purchase
- **Purchases → New Purchase**: pick a supplier, add a couple of lines, pay part in
  **Cash**, save as **received**.
  → **Expect**: those products' **stock goes up** by the received qty; the supplier's
  **due** = total − paid; the cash you paid **lowers the drawer** (check Cash Register).

### 6. Ring up a POS cash sale
- Open **POS**, add items to the cart, take **Cash** for the full amount, complete.
  → **Expect**: receipt prints/preview shows; **due is 0**.
- Confirm across modules:
  - **Sales** list shows the new invoice.
  - The product's **stock dropped** by the sold qty.
  - **Cash Register** drawer **rose** by the cash amount.
  - **Dashboard** today's sales total and transaction count went up.

### 7. Credit sale + receive payment
- **POS / Sales → New Sale**: choose a customer, **no payment** (full credit), complete.
  → **Expect**: the customer's **due rises** by the total (see **Contacts → customer**).
- **Contacts → that customer → Receive Payment**: take a partial amount in Cash.
  → **Expect**: due **drops** by exactly that amount; drawer **rises** by it.

### 8. Sell return
- **Sales → the cash sale → Return**: return a couple of units, refund in **Cash**.
  → **Expect**: product **stock restored** by the returned qty; drawer **reduced** by
  the refund; the return shows in the Returns list.

### 9. Expense
- **Expenses → New Expense**: a Cash expense.
  → **Expect**: drawer **drops** by the amount. Void it → drawer **restored**, and it
  leaves the expense list.

### 10. Close shift
- **Cash Register → Close Shift**: enter the counted cash equal to the **expected**
  figure shown.
  → **Expect**: **variance 0**; a Z-report/summary; shift now closed.

### 11. Reports reconcile
- **Reports → Profit / Loss** (range: Today): revenue, COGS, returns, expenses look
  right; **net profit** matches what you'd expect from the day.
- **Reports → Stock**: total stock value == sum of each product's stock × cost.
- **Dashboard** today's numbers agree with the Sales list.

### 12. Sign out / lock / **permission check as a cashier**
- **Sign out** (or **Lock**) → re-enter PIN to return. → **Expect**: lock works.
- Create or use a **Cashier** user (role `role_cashier`) and log in as them.
  → **Expect** (this is the IPC permission gate in action):
  - They **can** use POS, take payments, view products/stock, open/close their shift.
  - They **cannot** reach owner-only actions — e.g. deleting a product, editing
    business settings, or managing users/roles are blocked/hidden.
  - Attempting a gated action surfaces a permission error rather than performing it.

This cashier step is the human-side counterpart to the programmatic E2E: the
automated suite proves the *calculations and data flow* through the API facade, and
this step proves the *permission gate* at the IPC boundary that the harness
intentionally bypasses.

---

## Quick reference

| Command | What it does |
| --- | --- |
| `npm run backend:e2e` | Run the full-shop-day E2E suite alone |
| `npm run backend:verify:all` | Run every backend suite (scenarios + api + identities + **e2e**) |
| `npm run backend:typecheck` | Typecheck the backend |
| `npm run dev` | Launch the app for the manual smoke test |
