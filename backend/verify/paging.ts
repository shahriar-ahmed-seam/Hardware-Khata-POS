/**
 * PAGINATED LIST VERIFICATION
 * ===========================
 * Covers `backend/services/paged.ts`, which replaced an N+1 that froze the app
 * (`sales.list` for every row, then one `sales.get` per row).
 *
 * The properties that matter:
 *  - a page never returns more than pageSize rows, and pageSize is clamped
 *  - `total` reflects the FILTER, not the page
 *  - walking every page visits each row exactly once — no gaps, no repeats
 *  - the batched nested lines/payments/audit are IDENTICAL to `sales.get`
 *    (this is the correctness risk of batching, so it is asserted directly)
 *  - every filter actually narrows in SQL
 *
 * Run standalone: npx tsx backend/verify/paging.ts
 */
import { openDatabase, migrate, type DB } from '../db/connection.ts';
import { simulate } from '../seed/simulate.ts';
import { buildApi } from '../api.ts';
import { Suite } from './assert.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Page {
  rows: Record<string, any>[];
  total: number;
  page: number;
  pageSize: number;
}

export function runPaging(s: Suite) {
  const db: DB = openDatabase(':memory:');
  migrate(db);
  // `simulate()` seeds the master data itself, so do NOT call seedMaster here.
  // A realistic history is the whole point — this volume is what used to hang.
  simulate(db, { days: 120, seed: 7 });

  const api = buildApi();
  const call = (ch: string, payload: unknown = {}): any => api[ch](db, payload);

  // ------------------------------------------------------------------ sales
  s.section('paging-sales');
  const all = call('sales.list', {}) as Record<string, any>[];
  const finalAndVoid = all.filter((r) => r.status === 'final' || r.status === 'void');

  const PAGE_SIZE = 25;
  const first = call('sales.listPage', {
    page: 1,
    pageSize: PAGE_SIZE,
    statuses: ['final', 'void'],
  }) as Page;

  s.ok('page returns at most pageSize rows', first.rows.length <= PAGE_SIZE);
  s.eq('total reflects the filter, not the page', first.total, finalAndVoid.length);
  s.eq('page number is echoed back', first.page, 1);
  s.gt('the simulated history is large enough to page', first.total, PAGE_SIZE);

  // Full coverage: walk every page, confirm each row appears exactly once.
  const pageCount = Math.ceil(first.total / PAGE_SIZE);
  const seen = new Set<string>();
  let duplicates = 0;
  for (let p = 1; p <= pageCount; p++) {
    const res = call('sales.listPage', {
      page: p,
      pageSize: PAGE_SIZE,
      statuses: ['final', 'void'],
    }) as Page;
    for (const row of res.rows) {
      if (seen.has(row.id)) duplicates++;
      seen.add(row.id);
    }
  }
  s.eq('walking all pages visits every matching row', seen.size, finalAndVoid.length);
  s.eq('walking all pages repeats no row', duplicates, 0);

  // Ordering must be newest-first and total-ordered (id breaks date ties), or
  // pages would overlap/skip rows as the user navigates.
  const ordered = call('sales.listPage', {
    page: 1,
    pageSize: 50,
    statuses: ['final', 'void'],
  }) as Page;
  let descending = true;
  for (let i = 1; i < ordered.rows.length; i++) {
    if (String(ordered.rows[i - 1].date) < String(ordered.rows[i].date)) descending = false;
  }
  s.ok('page is ordered newest-first', descending);

  // ---- the batching correctness check ----
  s.section('paging-batched-detail');
  let linesMatch = true;
  let paymentsMatch = true;
  let auditMatch = true;
  for (const row of ordered.rows.slice(0, 15)) {
    const detail = call('sales.get', { id: row.id }) as Record<string, any>;
    if (JSON.stringify(row.lines) !== JSON.stringify(detail.lines)) linesMatch = false;
    if (JSON.stringify(row.payments) !== JSON.stringify(detail.payments)) paymentsMatch = false;
    if (JSON.stringify(row.audit) !== JSON.stringify(detail.audit)) auditMatch = false;
  }
  s.ok('batched lines are identical to sales.get', linesMatch);
  s.ok('batched payments are identical to sales.get', paymentsMatch);
  s.ok('batched audit is identical to sales.get', auditMatch);
  s.ok(
    'every row on a page carries its nested arrays',
    ordered.rows.every((r) => Array.isArray(r.lines) && Array.isArray(r.payments)),
  );

  // ---- filters ----
  s.section('paging-filters');
  const drafts = call('sales.listPage', { pageSize: 10, statuses: ['draft'] }) as Page;
  s.ok('status filter returns only that status', drafts.rows.every((r) => r.status === 'draft'));
  s.eq('status filter total matches the raw count', drafts.total, all.filter((r) => r.status === 'draft').length);

  const voided = call('sales.listPage', { pageSize: 10, statuses: ['void'] }) as Page;
  s.ok('void filter returns only voided sales', voided.rows.every((r) => r.status === 'void'));

  s.eq(
    'an unknown status yields nothing (whitelist enforced)',
    (call('sales.listPage', { statuses: ['bogus'] }) as Page).total,
    0,
  );

  s.eq(
    'an impossible date range yields nothing',
    (call('sales.listPage', {
      pageSize: 200,
      statuses: ['final', 'void'],
      from: '2000-01-01T00:00:00.000Z',
      to: '2000-01-02T00:00:00.000Z',
    }) as Page).total,
    0,
  );

  const invoiceNo = ordered.rows[0].invoice_no as string;
  const searched = call('sales.listPage', { pageSize: 10, q: invoiceNo }) as Page;
  s.ok(
    'text search matches on invoice number',
    searched.rows.some((r) => r.invoice_no === invoiceNo),
  );
  s.gte('text search total is at least 1', searched.total, 1);

  const withCustomer = ordered.rows.find((r) => r.customer_id);
  if (withCustomer) {
    const byCustomer = call('sales.listPage', {
      pageSize: 200,
      customerId: withCustomer.customer_id,
    }) as Page;
    s.ok(
      'customer filter returns only that customer',
      byCustomer.rows.every((r) => r.customer_id === withCustomer.customer_id),
    );
    s.gte('customer filter finds at least one row', byCustomer.total, 1);
  }

  const branchScoped = call('sales.listPage', { pageSize: 200, branchId: 'br_mp' }) as Page;
  s.ok(
    'branch filter returns only that branch',
    branchScoped.rows.every((r) => r.branch_id === 'br_mp'),
  );

  /**
   * ---- PAYMENT STATE (Paid / Partial / Due) ----
   *
   * These three were filtered in the UI over the rows of the loaded page, so
   * "Due" reported "no sales match" whenever the unpaid invoices happened to sit
   * past page one, and the pager and page totals disagreed with what was on
   * screen. They are SQL filters now, so `total` has to be the TRUE count across
   * the whole history — which is what these checks pin.
   */
  s.section('paging-payment-state');
  {
    const EPS = 0.005;
    const finals = all.filter((r) => r.status === 'final');
    const expectPaid = finals.filter((r) => r.due <= EPS).length;
    const expectPartial = finals.filter((r) => r.paid > EPS && r.due > EPS).length;
    const expectDue = finals.filter((r) => r.paid <= EPS && r.due > EPS).length;

    const paid = call('sales.listPage', { pageSize: 200, statuses: ['final'], payment: 'paid' }) as Page;
    const partial = call('sales.listPage', { pageSize: 200, statuses: ['final'], payment: 'partial' }) as Page;
    const due = call('sales.listPage', { pageSize: 200, statuses: ['final'], payment: 'due' }) as Page;

    s.eq('paid filter total is the true count, not the page', paid.total, expectPaid);
    s.eq('partial filter total is the true count', partial.total, expectPartial);
    s.eq('due filter total is the true count', due.total, expectDue);

    s.ok('every paid row really owes nothing', paid.rows.every((r) => r.due <= EPS));
    s.ok(
      'every partial row has paid something AND owes something',
      partial.rows.every((r) => r.paid > EPS && r.due > EPS),
    );
    s.ok('every due row has paid nothing', due.rows.every((r) => r.paid <= EPS));

    // The three states must be a PARTITION of the finalized sales: no sale can be
    // in two of them, and none can fall through the gaps.
    s.eq(
      'paid + partial + due accounts for every finalized sale',
      paid.total + partial.total + due.total,
      finals.length,
    );

    // Omitting the filter must not narrow anything.
    s.eq(
      'no payment filter means no payment narrowing',
      (call('sales.listPage', { pageSize: 200, statuses: ['final'] }) as Page).total,
      finals.length,
    );

    // Same rules on the buying side. "Partially paid" has to mean the same thing
    // on both sides of the books, which is why one helper builds both.
    const purchaseRows = call('purchases.list', {}) as Record<string, any>[];
    const pPaid = call('purchases.listPage', { pageSize: 200, payment: 'paid' }) as Page;
    const pPartial = call('purchases.listPage', { pageSize: 200, payment: 'partial' }) as Page;
    const pDue = call('purchases.listPage', { pageSize: 200, payment: 'due' }) as Page;
    s.eq(
      'purchase paid filter total is the true count',
      pPaid.total,
      purchaseRows.filter((r) => r.due <= EPS).length,
    );
    s.ok(
      'every partial purchase has paid something AND owes something',
      pPartial.rows.every((r) => r.paid > EPS && r.due > EPS),
    );
    s.eq(
      'paid + partial + due accounts for every purchase',
      pPaid.total + pPartial.total + pDue.total,
      purchaseRows.length,
    );
  }

  // ---- bounds ----
  s.section('paging-bounds');
  const beyond = call('sales.listPage', {
    page: 9999,
    pageSize: PAGE_SIZE,
    statuses: ['final', 'void'],
  }) as Page;
  s.eq('a page past the end returns no rows', beyond.rows.length, 0);
  s.eq('a page past the end still reports the true total', beyond.total, finalAndVoid.length);

  s.ok(
    'pageSize is capped so a caller cannot request the whole table',
    (call('sales.listPage', { pageSize: 100000 }) as Page).rows.length <= 200,
  );
  s.gte('pageSize below 1 is clamped up', (call('sales.listPage', { pageSize: 0 }) as Page).pageSize, 1);
  s.gte('page below 1 is clamped up', (call('sales.listPage', { page: -5 }) as Page).page, 1);

  // -------------------------------------------------------------- purchases
  s.section('paging-purchases');
  const allPurchases = call('purchases.list', {}) as Record<string, any>[];
  const pFirst = call('purchases.listPage', { page: 1, pageSize: 20 }) as Page;
  s.ok('purchases page returns at most pageSize rows', pFirst.rows.length <= 20);
  s.eq('purchases total matches the raw count', pFirst.total, allPurchases.length);

  const pSeen = new Set<string>();
  const pPages = Math.ceil(pFirst.total / 20);
  for (let p = 1; p <= pPages; p++) {
    for (const row of (call('purchases.listPage', { page: p, pageSize: 20 }) as Page).rows) {
      pSeen.add(row.id);
    }
  }
  s.eq('walking all purchase pages visits every row', pSeen.size, allPurchases.length);

  if (pFirst.rows.length > 0) {
    const pSample = pFirst.rows[0];
    const pDetail = call('purchases.get', { id: pSample.id }) as Record<string, any>;
    s.eq(
      'batched purchase lines are identical to purchases.get',
      JSON.stringify(pSample.lines),
      JSON.stringify(pDetail.lines),
    );
    s.eq(
      'batched purchase payments are identical to purchases.get',
      JSON.stringify(pSample.payments),
      JSON.stringify(pDetail.payments),
    );
    s.ok('purchase rows carry the supplier name for display', 'supplier_name' in pSample);
  }

  const received = call('purchases.listPage', { pageSize: 50, statuses: ['received'] }) as Page;
  s.ok(
    'purchase status filter returns only that status',
    received.rows.every((r) => r.status === 'received'),
  );

  // ========================================================================
  // The other four paged channels. These were added later than sales/purchases
  // and page real WORK, not just rows: `products.list` recomputes stock for the
  // whole catalogue, and `customers/suppliers.list` run derived-total queries
  // PER ROW. So the properties to prove are that paging still returns the same
  // set overall, and that the derived figures on a page match the unpaged ones.
  // ========================================================================

  /** Walk every page of a channel and return the ids seen, plus any duplicate. */
  const walk = (channel: string, extra: Record<string, unknown> = {}, size = 20) => {
    const head = call(channel, { page: 1, pageSize: size, ...extra }) as Page;
    const ids = new Set<string>();
    let dupes = 0;
    const pages = Math.ceil(head.total / size);
    for (let p = 1; p <= pages; p++) {
      for (const row of (call(channel, { page: p, pageSize: size, ...extra }) as Page).rows) {
        if (ids.has(row.id)) dupes++;
        ids.add(row.id);
      }
    }
    return { head, ids, dupes };
  };

  // -------------------------------------------------------------- products
  s.section('paging-products');
  const allProducts = call('products.list', {}) as Record<string, any>[];
  const prod = walk('products.listPage');
  s.eq('products total matches the unpaged catalogue', prod.head.total, allProducts.length);
  s.eq('walking all product pages visits every product', prod.ids.size, allProducts.length);
  s.eq('walking all product pages repeats no product', prod.dupes, 0);
  s.ok('product pages respect pageSize', prod.head.rows.length <= 20);

  // Stock is DERIVED (sum of movements), so the paged read must agree with the
  // unpaged one product by product — that is the whole risk of paging it.
  const stockByIdUnpaged = new Map(allProducts.map((p) => [p.id as string, p.stock as number]));
  let stockMatches = true;
  for (const row of prod.head.rows) {
    if (stockByIdUnpaged.get(row.id) !== row.stock) stockMatches = false;
  }
  s.ok('paged product stock equals the unpaged derived stock', stockMatches);
  s.ok(
    'product rows carry their category name for display',
    prod.head.rows.every((r) => 'category_name' in r),
  );

  const firstProduct = prod.head.rows[0];
  const bySku = call('products.listPage', { pageSize: 50, q: firstProduct.sku }) as Page;
  s.ok(
    'product search matches on SKU',
    bySku.rows.some((r) => r.sku === firstProduct.sku),
  );
  const byCategory = call('products.listPage', {
    pageSize: 200,
    categoryId: firstProduct.category_id,
  }) as Page;
  s.ok(
    'product category filter returns only that category',
    byCategory.rows.every((r) => r.category_id === firstProduct.category_id),
  );
  s.gte('product category filter finds at least one row', byCategory.total, 1);

  // stockState filters a DERIVED value, so it is computed then paged in memory.
  const outOfStock = call('products.listPage', { pageSize: 200, stockState: 'out' }) as Page;
  s.ok(
    'stockState=out returns only products with no stock',
    outOfStock.rows.every((r) => (r.stock as number) <= 0),
  );
  const inStock = call('products.listPage', { pageSize: 200, stockState: 'in' }) as Page;
  s.ok(
    'stockState=in returns only products above their reorder level',
    inStock.rows.every((r) => (r.stock as number) > ((r.reorder_level as number) ?? 0)),
  );
  s.eq(
    'the three stock states partition the catalogue',
    outOfStock.total +
      inStock.total +
      (call('products.listPage', { pageSize: 1, stockState: 'low' }) as Page).total,
    allProducts.length,
  );

  // -------------------------------------------------------------- customers
  s.section('paging-customers');
  const allCustomers = call('customers.list', {}) as Record<string, any>[];
  const cust = walk('customers.listPage');
  s.eq('customers total matches the unpaged list', cust.head.total, allCustomers.length);
  s.eq('walking all customer pages visits every customer', cust.ids.size, allCustomers.length);
  s.eq('walking all customer pages repeats no customer', cust.dupes, 0);

  // Derived dues are the expensive part; they must be identical when paged.
  const dueByIdUnpaged = new Map(allCustomers.map((c) => [c.id as string, c.due as number]));
  let duesMatch = true;
  let totalsMatch = true;
  for (const row of cust.head.rows) {
    if (dueByIdUnpaged.get(row.id) !== row.due) duesMatch = false;
    if (typeof row.totalPurchase !== 'number' || typeof row.totalPaid !== 'number') {
      totalsMatch = false;
    }
  }
  s.ok('paged customer due equals the unpaged derived due', duesMatch);
  s.ok('paged customer rows carry their derived totals', totalsMatch);

  const someCustomer = cust.head.rows[0];
  const custSearch = call('customers.listPage', { pageSize: 50, q: someCustomer.name }) as Page;
  s.ok(
    'customer search matches on name',
    custSearch.rows.some((r) => r.id === someCustomer.id),
  );
  const group = someCustomer.price_group as string;
  if (group) {
    const byGroup = call('customers.listPage', { pageSize: 200, group }) as Page;
    s.ok(
      'customer group filter returns only that group',
      byGroup.rows.every((r) => r.price_group === group),
    );
    s.gte('customer group filter finds at least one row', byGroup.total, 1);
  }
  s.eq(
    'a search that matches nothing returns nothing',
    (call('customers.listPage', { q: 'zzz-no-such-customer-zzz' }) as Page).total,
    0,
  );

  // -------------------------------------------------------------- suppliers
  s.section('paging-suppliers');
  const allSuppliers = call('suppliers.list', {}) as Record<string, any>[];
  const sup = walk('suppliers.listPage');
  s.eq('suppliers total matches the unpaged list', sup.head.total, allSuppliers.length);
  s.eq('walking all supplier pages visits every supplier', sup.ids.size, allSuppliers.length);
  s.eq('walking all supplier pages repeats no supplier', sup.dupes, 0);

  const supDueUnpaged = new Map(allSuppliers.map((x) => [x.id as string, x.due as number]));
  let supDuesMatch = true;
  for (const row of sup.head.rows) {
    if (supDueUnpaged.get(row.id) !== row.due) supDuesMatch = false;
  }
  s.ok('paged supplier due equals the unpaged derived due', supDuesMatch);
  if (sup.head.rows.length > 0) {
    const someSupplier = sup.head.rows[0];
    const supSearch = call('suppliers.listPage', { pageSize: 50, q: someSupplier.name }) as Page;
    s.ok(
      'supplier search matches on name',
      supSearch.rows.some((r) => r.id === someSupplier.id),
    );
  }

  // --------------------------------------------------------------- expenses
  s.section('paging-expenses');
  const allExpenses = call('expenses.list', {}) as Record<string, any>[];
  const exp = walk('expenses.listPage');
  s.eq('expenses total matches the unpaged list', exp.head.total, allExpenses.length);
  s.eq('walking all expense pages visits every expense', exp.ids.size, allExpenses.length);
  s.eq('walking all expense pages repeats no expense', exp.dupes, 0);
  s.ok(
    'expense pages are ordered newest-first',
    (() => {
      const rows = (call('expenses.listPage', { pageSize: 50 }) as Page).rows;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i - 1].date) < String(rows[i].date)) return false;
      }
      return true;
    })(),
  );
  s.ok(
    'expense rows carry their category name for display',
    exp.head.rows.every((r) => 'category_name' in r),
  );
  // `listExpenses` excludes voided rows; the paged read must match that, or the
  // list and its totals would disagree with every report.
  const voidedCount = (
    db.prepare('SELECT COUNT(*) AS n FROM expenses WHERE voided = 1').get() as { n: number }
  ).n;
  const allExpenseRows = (
    db.prepare('SELECT COUNT(*) AS n FROM expenses').get() as { n: number }
  ).n;
  s.eq('paged expenses exclude voided rows', exp.head.total, allExpenseRows - voidedCount);

  const someExpense = exp.head.rows[0];
  if (someExpense) {
    const byCat = call('expenses.listPage', {
      pageSize: 200,
      categoryId: someExpense.category_id,
    }) as Page;
    s.ok(
      'expense category filter returns only that category',
      byCat.rows.every((r) => r.category_id === someExpense.category_id),
    );
    s.gte('expense category filter finds at least one row', byCat.total, 1);
  }
  s.eq(
    'an impossible expense date range yields nothing',
    (call('expenses.listPage', {
      pageSize: 200,
      from: '2000-01-01T00:00:00.000Z',
      to: '2000-01-02T00:00:00.000Z',
    }) as Page).total,
    0,
  );

  s.section('paging-bounds-all-channels');
  // Every paged channel must clamp pageSize — none may be tricked into
  // returning the whole table, which is the regression this file exists to stop.
  for (const channel of [
    'sales.listPage',
    'purchases.listPage',
    'products.listPage',
    'customers.listPage',
    'suppliers.listPage',
    'expenses.listPage',
  ]) {
    s.ok(
      `${channel} caps pageSize at 200`,
      (call(channel, { pageSize: 999999 }) as Page).rows.length <= 200,
    );
    s.gte(`${channel} clamps page below 1`, (call(channel, { page: 0 }) as Page).page, 1);
  }

  db.close();
}

// ---- standalone runner (mirrors e2e.ts) ----
if (
  import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/') ||
  process.argv[1]?.endsWith('paging.ts')
) {
  const s = new Suite();
  const t0 = Date.now();
  runPaging(s);
  const rep = s.report();
  const ms = Date.now() - t0;
  console.log(`PAGING: ${rep.passed}/${rep.total} checks in ${ms}ms`);
  if (rep.failed > 0) {
    console.log(`\n❌ ${rep.failed} FAILURES:`);
    for (const f of rep.failures) console.log(`   - ${f.name}: ${f.detail ?? ''}`);
    process.exit(1);
  }
  console.log('✅ ALL PAGING CHECKS PASSED');
}
