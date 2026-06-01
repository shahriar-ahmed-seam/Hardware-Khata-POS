# Hardware POS — Backend

Offline-first data layer built on **SQLite (better-sqlite3)**. Pure, synchronous,
fully testable in plain Node before any UI wiring. This phase builds and *proves* the
backend in isolation; wiring to the React frontend (via Electron IPC) is the next phase.

## Layout

```
backend/
  db/
    connection.ts     open/migrate/tx/reset helpers + pragmas (WAL, FK on)
    schema.sql        all tables + indexes (v1)
    fts.sql           FTS5 virtual tables for global search
  core/               PURE functions (no DB) — the calculation truth
    money.ts          round2, sum2, epsilon money equality
    calc.ts           sale/purchase line + order totals, COGS, profit, cash, margin
    words.ts          amount-in-words (BD lakh/crore numbering)
    ids.ts            entity id + document ref formatting
    dates.ts          date-range presets (matches frontend ReportToolbar)
  services/           operations with side-effects (all go through core/)
    stock.ts          movements = single source of truth; on-hand, WAC, valuation
    sales.ts          createSale / addSalePayment / voidSale
    purchases.ts      createPurchase / addPurchasePayment
    returns.ts        sell + purchase returns
    stockOps.ts       transfers + adjustments
    expenses.ts       expenses (+ cash routing)
    cash.ts           shifts, movements, expected/variance
    ledger.ts         derived customer/supplier due + running ledger
    activity.ts       activity log
    sequences.ts      atomic invoice/ref numbering from invoice_schemes
    dashboard.ts      KPIs + widgets
    reports.ts        P/L, product sell/purchase, payments, tax, trending, etc.
  seed/
    master.ts         deterministic reference data (branches, users, products, ...)
    rng.ts            seeded PRNG (reproducible)
    simulate.ts       a coherent year of shop activity via the real services
  verify/
    assert.ts         tiny assertion harness
    run.ts            56 identity checks on a 365-day simulated dataset
    scenarios.ts      36 targeted exact-value operation tests
    all.ts            scenarios + determinism + persistent-file smoke + identities
```

## Design principles

1. **Stock is never a stored column.** On-hand = `SUM(qty)` of `stock_movements`
   for a (product, branch). Every change has a signed movement with a reason and a
   reference, so stock is always auditable and reconstructable.
2. **Balances are derived, never running columns.** Customer due / supplier due /
   drawer expected are computed from sales/purchases/payments/returns/movements.
3. **All money flows through `core/`.** POS, sales, purchases, reports, and the seeder
   use the same pure functions, so totals are identical everywhere. Money rounds to 2dp
   at every boundary; comparisons tolerate a 1-paisa epsilon.
4. **Everything is a transaction.** Each operation wraps its writes in `tx()` so a
   failure rolls back cleanly (no half-written sales).
5. **Deterministic seed.** Same seed → identical history → stable verification.

## Verify

```
npm run backend:typecheck      # tsc, zero errors
npm run backend:scenarios      # 36 targeted exact-value tests
npm run backend:verify         # 56 identity checks on 365 simulated days
npm run backend:verify:all     # combined gate (scenarios + determinism + file smoke + identities)
```

### What the verification proves

- **Sale identities** (per sale): total = taxableBase+tax+ship+other+roundoff;
  due = max(0, total−paid); subtotal = Σ line subtotals; profit = subtotal−orderDisc−cogs;
  cogs = Σ qty×unitCostAtSale.
- **Purchase identities**: due = max(0, total−paid); received lines create matching stock-in.
- **Stock**: never negative anywhere; sale/purchase lines reconcile to movements;
  transfers conserve total stock across branches; void/return restore stock exactly.
- **Ledgers**: customer/supplier due match the opening±activity formula; never negative.
- **Cash**: shift expected = opening + in − out; variance = counted − expected;
  cash sale payments == cash-in movements; cash expenses == cash-out movements;
  non-cash never touches the drawer; void reverses cash.
- **References**: invoice/PO/SKU all unique.
- **Aggregations**: dashboard totals == raw sums; gross/net profit identities;
  payment breakdown sums to raw; report revenue/tax/payments == raw.
- **Determinism**: same seed reproduces identical sales count, totals, and stock.
- **Persistence**: data survives close/reopen (WAL), FK integrity holds on the file.

## Next phase (wiring)

- Expose services through an `ipc/` layer in Electron main, with permission checks
  resolved from the session user against the role permission catalog.
- Replace the frontend Zustand mock stores with TanStack Query hooks hitting IPC.
- Rebuild `better-sqlite3` for the Electron ABI (`electron-rebuild`) at package time.
