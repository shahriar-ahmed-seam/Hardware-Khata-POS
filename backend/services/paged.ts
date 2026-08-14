import type { DB } from '../db/connection.ts';
import { stockLevels } from './stock.ts';
import { customerTotals, supplierTotals } from './ledger.ts';
import { round2 } from '../core/money.ts';

/**
 * PAGINATED LIST READS
 *
 * WHY THIS FILE EXISTS
 * The Sales and Purchases screens used to load like this:
 *
 *   const list = await api('sales.list', {});                    // ALL rows
 *   await Promise.all(list.map(r => api('sales.get', { id })));  // 1 call EACH
 *
 * On a shop with a year of history that is one unbounded query followed by
 * thousands of separate IPC round-trips, each running synchronous SQLite on the
 * main process — which freezes the entire app until it finishes. Classic N+1.
 *
 * These queries replace that with a fixed, small number of statements per page:
 *   1. COUNT(*) for the pager
 *   2. one page of header rows (filtered + ordered + LIMIT/OFFSET in SQL)
 *   3. one batched query per child table, using `IN (…page ids…)`
 *
 * So a page costs ~5 queries regardless of how much history exists.
 */

/** Everything the list screens can filter by, pushed down into SQL. */
export interface PageQuery {
  page?: number; // 1-based
  pageSize?: number;
  branchId?: string;
  /** Match any of these statuses. Empty/omitted = all. */
  statuses?: string[];
  customerId?: string;
  supplierId?: string;
  userId?: string;
  /** Payment method present on the document. */
  method?: string;
  /** Inclusive ISO date bounds. */
  from?: string;
  to?: string;
  /** Free text over the document ref and the counterparty name. */
  q?: string;
}

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

function normalize(query: PageQuery) {
  const pageSize = Math.min(Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const page = Math.max(1, query.page ?? 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** `IN (?,?,?)` placeholders — page-sized, so always well under SQLite's limit. */
function placeholders(n: number): string {
  return new Array(n).fill('?').join(',');
}

/** Group child rows by their parent id in one pass. */
function groupBy<T extends Record<string, unknown>>(rows: T[], key: string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = r[key] as string;
    const bucket = out.get(k);
    if (bucket) bucket.push(r);
    else out.set(k, [r]);
  }
  return out;
}

// ---------------------------------------------------------------------- sales

export function listSalesPage(db: DB, query: PageQuery = {}): Page<Record<string, unknown>> {
  const { page, pageSize, offset } = normalize(query);

  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (query.branchId && query.branchId !== 'all') {
    where.push('s.branch_id = @branchId');
    params.branchId = query.branchId;
  }
  if (query.statuses && query.statuses.length > 0) {
    // Inlined from a fixed whitelist — never interpolate caller text into SQL.
    const allowed = query.statuses.filter((s) =>
      ['final', 'draft', 'quotation', 'void'].includes(s),
    );
    if (allowed.length === 0) return { rows: [], total: 0, page, pageSize };
    where.push(`s.status IN (${allowed.map((s) => `'${s}'`).join(',')})`);
  }
  if (query.customerId && query.customerId !== 'all') {
    where.push('s.customer_id = @customerId');
    params.customerId = query.customerId;
  }
  if (query.userId && query.userId !== 'all') {
    where.push('s.user_id = @userId');
    params.userId = query.userId;
  }
  if (query.from) {
    where.push('s.date >= @from');
    params.from = query.from;
  }
  if (query.to) {
    where.push('s.date <= @to');
    params.to = query.to;
  }
  if (query.q) {
    where.push(
      `(LOWER(s.invoice_no) LIKE @q OR LOWER(COALESCE(c.name, 'walk-in customer')) LIKE @q)`,
    );
    params.q = `%${query.q.toLowerCase()}%`;
  }
  if (query.method && query.method !== 'all') {
    where.push('EXISTS (SELECT 1 FROM sale_payments sp WHERE sp.sale_id = s.id AND sp.method = @method)');
    params.method = query.method;
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const joinSql = 'LEFT JOIN customers c ON c.id = s.customer_id';

  const total = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM sales s ${joinSql} ${whereSql}`)
      .get(params) as { n: number }
  ).n;

  const headers = db
    .prepare(
      `SELECT s.*, COALESCE(c.name, 'Walk-in Customer') AS customer_name, u.name AS user_name
         FROM sales s
         ${joinSql}
         LEFT JOIN users u ON u.id = s.user_id
        ${whereSql}
        ORDER BY s.date DESC, s.id DESC
        LIMIT @pageSize OFFSET @offset`,
    )
    .all({ ...params, pageSize, offset }) as Record<string, unknown>[];

  if (headers.length === 0) return { rows: [], total, page, pageSize };

  const ids = headers.map((h) => h.id as string);
  const ph = placeholders(ids.length);
  const lines = groupBy(
    db
      .prepare(`SELECT * FROM sale_lines WHERE sale_id IN (${ph}) ORDER BY line_no`)
      .all(...ids) as Record<string, unknown>[],
    'sale_id',
  );
  const payments = groupBy(
    db
      .prepare(`SELECT * FROM sale_payments WHERE sale_id IN (${ph}) ORDER BY paid_at`)
      .all(...ids) as Record<string, unknown>[],
    'sale_id',
  );
  const audit = groupBy(
    db
      .prepare(`SELECT * FROM sale_audit WHERE sale_id IN (${ph}) ORDER BY at`)
      .all(...ids) as Record<string, unknown>[],
    'sale_id',
  );

  const rows = headers.map((h) => ({
    ...h,
    lines: lines.get(h.id as string) ?? [],
    payments: payments.get(h.id as string) ?? [],
    audit: audit.get(h.id as string) ?? [],
  }));

  return { rows, total, page, pageSize };
}

// ------------------------------------------------------------------ purchases

export function listPurchasesPage(db: DB, query: PageQuery = {}): Page<Record<string, unknown>> {
  const { page, pageSize, offset } = normalize(query);

  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (query.branchId && query.branchId !== 'all') {
    where.push('p.branch_id = @branchId');
    params.branchId = query.branchId;
  }
  if (query.statuses && query.statuses.length > 0) {
    const allowed = query.statuses.filter((s) =>
      ['received', 'ordered', 'in-transit', 'cancelled'].includes(s),
    );
    if (allowed.length === 0) return { rows: [], total: 0, page, pageSize };
    where.push(`p.status IN (${allowed.map((s) => `'${s}'`).join(',')})`);
  }
  if (query.supplierId && query.supplierId !== 'all') {
    where.push('p.supplier_id = @supplierId');
    params.supplierId = query.supplierId;
  }
  if (query.from) {
    where.push('p.date >= @from');
    params.from = query.from;
  }
  if (query.to) {
    where.push('p.date <= @to');
    params.to = query.to;
  }
  if (query.q) {
    where.push('(LOWER(p.ref_no) LIKE @q OR LOWER(COALESCE(sup.name, \'\')) LIKE @q)');
    params.q = `%${query.q.toLowerCase()}%`;
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const joinSql = 'LEFT JOIN suppliers sup ON sup.id = p.supplier_id';

  const total = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM purchases p ${joinSql} ${whereSql}`)
      .get(params) as { n: number }
  ).n;

  const headers = db
    .prepare(
      `SELECT p.*, sup.name AS supplier_name, u.name AS user_name
         FROM purchases p
         ${joinSql}
         LEFT JOIN users u ON u.id = p.user_id
        ${whereSql}
        ORDER BY p.date DESC, p.id DESC
        LIMIT @pageSize OFFSET @offset`,
    )
    .all({ ...params, pageSize, offset }) as Record<string, unknown>[];

  if (headers.length === 0) return { rows: [], total, page, pageSize };

  const ids = headers.map((h) => h.id as string);
  const ph = placeholders(ids.length);
  const lines = groupBy(
    db
      .prepare(`SELECT * FROM purchase_lines WHERE purchase_id IN (${ph}) ORDER BY line_no`)
      .all(...ids) as Record<string, unknown>[],
    'purchase_id',
  );
  const payments = groupBy(
    db
      .prepare(`SELECT * FROM purchase_payments WHERE purchase_id IN (${ph}) ORDER BY paid_at`)
      .all(...ids) as Record<string, unknown>[],
    'purchase_id',
  );
  const audit = groupBy(
    db
      .prepare(`SELECT * FROM purchase_audit WHERE purchase_id IN (${ph}) ORDER BY at`)
      .all(...ids) as Record<string, unknown>[],
    'purchase_id',
  );

  const rows = headers.map((h) => ({
    ...h,
    lines: lines.get(h.id as string) ?? [],
    payments: payments.get(h.id as string) ?? [],
    audit: audit.get(h.id as string) ?? [],
  }));

  return { rows, total, page, pageSize };
}

// ================================================================= catalogue
/**
 * Products, paginated.
 *
 * `listProducts` returns the WHOLE catalogue and computes a stock level for
 * every row. This returns one page and attaches stock from a single aggregate
 * pass, so a 5,000-product catalogue costs the same as a 20-product one.
 */
export function listProductsPage(
  db: DB,
  query: PageQuery & {
    categoryId?: string;
    brandId?: string;
    stockState?: 'in' | 'low' | 'out';
    /** Include retired products. Default false — archived means "gone" everywhere. */
    includeArchived?: boolean;
    /** Show ONLY retired products (the Archived view). Wins over includeArchived. */
    archivedOnly?: boolean;
  } = {},
): Page<Record<string, unknown>> {
  const { page, pageSize, offset } = normalize(query);

  const where: string[] = [];
  const params: Record<string, unknown> = {};
  // Archived products are retired from the catalogue. Excluded by default so no
  // caller has to remember to filter them out — the same reason stock is derived
  // rather than stored: the safe answer is the default one.
  if (query.archivedOnly) where.push('p.archived_at IS NOT NULL');
  else if (!query.includeArchived) where.push('p.archived_at IS NULL');
  if (query.categoryId && query.categoryId !== 'all') {
    where.push('p.category_id = @categoryId');
    params.categoryId = query.categoryId;
  }
  if (query.brandId && query.brandId !== 'all') {
    where.push('p.brand_id = @brandId');
    params.brandId = query.brandId;
  }
  if (query.q) {
    where.push('(LOWER(p.name) LIKE @q OR LOWER(p.sku) LIKE @q OR LOWER(COALESCE(p.barcode,\'\')) LIKE @q)');
    params.q = `%${query.q.toLowerCase()}%`;
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  // Stock is derived (SUM of stock_movements), so it cannot be filtered or
  // ordered in the header query. When a stock-state filter is active we need the
  // levels first, then filter ids — still only ONE aggregate query.
  const levels = stockLevels(db, query.branchId && query.branchId !== 'all' ? query.branchId : undefined);

  const decorate = (rows: Record<string, unknown>[]): Record<string, unknown>[] =>
    rows.map((p) => {
      const cost = p.cost as number;
      const price = p.price as number;
      return {
        ...p,
        stock: levels.get(p.id as string) ?? 0,
        margin: cost > 0 ? round2(((price - cost) / cost) * 100) : 0,
      };
    });

  const selectSql = `SELECT p.*, c.name AS category_name, c.emoji AS category_emoji, b.name AS brand_name
                       FROM products p
                       LEFT JOIN categories c ON c.id = p.category_id
                       LEFT JOIN brands b ON b.id = p.brand_id
                      ${whereSql}
                      ORDER BY p.name, p.id`;

  if (query.stockState) {
    // Filtering on a derived value: fetch the filtered id/name set (cheap — no
    // joins needed for the predicate), narrow by stock, then page in memory.
    const all = decorate(db.prepare(selectSql).all(params) as Record<string, unknown>[]);
    const matched = all.filter((p) => {
      const stock = p.stock as number;
      const reorder = (p.reorder_level as number) ?? 0;
      if (query.stockState === 'out') return stock <= 0;
      if (query.stockState === 'low') return stock > 0 && stock <= reorder;
      return stock > reorder;
    });
    return {
      rows: matched.slice(offset, offset + pageSize),
      total: matched.length,
      page,
      pageSize,
    };
  }

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM products p ${whereSql}`).get(params) as { n: number }
  ).n;
  const rows = decorate(
    db
      .prepare(`${selectSql} LIMIT @pageSize OFFSET @offset`)
      .all({ ...params, pageSize, offset }) as Record<string, unknown>[],
  );
  return { rows, total, page, pageSize };
}

// ================================================================== contacts
/**
 * Customers, paginated.
 *
 * `listCustomers` calls `customerTotals()` for EVERY customer — a per-row query
 * burst that grows with the contact book. Paging means the derived totals are
 * only computed for the rows actually shown.
 */
export function listCustomersPage(
  db: DB,
  query: PageQuery & { group?: string } = {},
): Page<Record<string, unknown>> {
  const { page, pageSize, offset } = normalize(query);

  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (query.group && query.group !== 'all') {
    where.push('price_group = @group');
    params.group = query.group;
  }
  if (query.q) {
    where.push(
      "(LOWER(name) LIKE @q OR LOWER(COALESCE(phone,'')) LIKE @q OR LOWER(COALESCE(email,'')) LIKE @q)",
    );
    params.q = `%${query.q.toLowerCase()}%`;
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM customers ${whereSql}`).get(params) as { n: number }
  ).n;
  const rows = (
    db
      .prepare(`SELECT * FROM customers ${whereSql} ORDER BY name, id LIMIT @pageSize OFFSET @offset`)
      .all({ ...params, pageSize, offset }) as Record<string, unknown>[]
  ).map((c) => ({ ...c, ...customerTotals(db, c.id as string) }));

  return { rows, total, page, pageSize };
}

/** Suppliers, paginated. Same per-row `supplierTotals` reasoning as customers. */
export function listSuppliersPage(db: DB, query: PageQuery = {}): Page<Record<string, unknown>> {
  const { page, pageSize, offset } = normalize(query);

  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (query.q) {
    where.push(
      "(LOWER(name) LIKE @q OR LOWER(COALESCE(company,'')) LIKE @q OR LOWER(COALESCE(phone,'')) LIKE @q)",
    );
    params.q = `%${query.q.toLowerCase()}%`;
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM suppliers ${whereSql}`).get(params) as { n: number }
  ).n;
  const rows = (
    db
      .prepare(`SELECT * FROM suppliers ${whereSql} ORDER BY name, id LIMIT @pageSize OFFSET @offset`)
      .all({ ...params, pageSize, offset }) as Record<string, unknown>[]
  ).map((s) => ({ ...s, ...supplierTotals(db, s.id as string) }));

  return { rows, total, page, pageSize };
}

// ================================================================== expenses
/** Expenses, paginated (voided rows excluded, matching `listExpenses`). */
export function listExpensesPage(
  db: DB,
  query: PageQuery & { categoryId?: string } = {},
): Page<Record<string, unknown>> {
  const { page, pageSize, offset } = normalize(query);

  const where: string[] = ['e.voided = 0'];
  const params: Record<string, unknown> = {};
  if (query.branchId && query.branchId !== 'all') {
    where.push('e.branch_id = @branchId');
    params.branchId = query.branchId;
  }
  if (query.categoryId && query.categoryId !== 'all') {
    where.push('e.category_id = @categoryId');
    params.categoryId = query.categoryId;
  }
  if (query.from) {
    where.push('e.date >= @from');
    params.from = query.from;
  }
  if (query.to) {
    where.push('e.date <= @to');
    params.to = query.to;
  }
  if (query.method && query.method !== 'all') {
    where.push('e.payment_method = @method');
    params.method = query.method;
  }
  if (query.q) {
    where.push(
      "(LOWER(COALESCE(e.ref_no,'')) LIKE @q OR LOWER(COALESCE(e.note,'')) LIKE @q OR LOWER(COALESCE(ec.name,'')) LIKE @q)",
    );
    params.q = `%${query.q.toLowerCase()}%`;
  }
  const whereSql = 'WHERE ' + where.join(' AND ');
  const joinSql = 'LEFT JOIN expense_categories ec ON ec.id = e.category_id';

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM expenses e ${joinSql} ${whereSql}`).get(params) as {
      n: number;
    }
  ).n;
  const rows = db
    .prepare(
      `SELECT e.*, ec.name AS category_name FROM expenses e ${joinSql} ${whereSql}
        ORDER BY e.date DESC, e.id DESC LIMIT @pageSize OFFSET @offset`,
    )
    .all({ ...params, pageSize, offset }) as Record<string, unknown>[];

  return { rows, total, page, pageSize };
}
