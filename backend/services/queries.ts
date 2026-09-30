import type { DB } from '../db/connection.ts';
import { stockLevels, stockOnHand } from './stock.ts';
import { customerTotals, supplierTotals, customerLedger, supplierLedger } from './ledger.ts';
import { round2 } from '../core/money.ts';

/**
 * Read-side queries that feed list/detail screens. Pure reads, no side effects.
 * Returns plain JSON-serializable rows for IPC transport.
 */

// ---------- Products ----------
export function listProducts(
  db: DB,
  opts: { branchId?: string; q?: string; includeArchived?: boolean; archivedOnly?: boolean } = {},
) {
  // Archived (retired) products are excluded by default. They still exist so
  // that past invoices resolve, but they are not part of the catalogue any more.
  const archiveSql = opts.archivedOnly
    ? 'WHERE p.archived_at IS NOT NULL'
    : opts.includeArchived
      ? ''
      : 'WHERE p.archived_at IS NULL';
  const products = db
    .prepare(
      `SELECT p.*, c.name AS category_name, c.emoji AS category_emoji, b.name AS brand_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN brands b ON b.id = p.brand_id
        ${archiveSql}
        ORDER BY p.name`,
    )
    .all() as Record<string, unknown>[];
  const levels = stockLevels(db, opts.branchId && opts.branchId !== 'all' ? opts.branchId : undefined);
  let rows = products.map((p) => ({
    ...p,
    stock: levels.get(p.id as string) ?? 0,
    margin: (p.cost as number) > 0 ? round2((((p.price as number) - (p.cost as number)) / (p.cost as number)) * 100) : 0,
  }));
  if (opts.q) {
    const t = opts.q.toLowerCase();
    rows = rows.filter((p: Record<string, unknown>) =>
      `${p.name} ${p.sku} ${p.barcode ?? ''}`.toLowerCase().includes(t),
    );
  }
  return rows;
}

export function getProduct(db: DB, id: string, branchId?: string) {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!p) return null;
  return { ...p, stock: stockOnHand(db, id, branchId) };
}

// ---------- Sales ----------
export function listSales(db: DB, opts: { branchId?: string; status?: string; q?: string; limit?: number } = {}) {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (opts.branchId && opts.branchId !== 'all') {
    where.push('s.branch_id = @branchId');
    params.branchId = opts.branchId;
  }
  if (opts.status) {
    where.push('s.status = @status');
    params.status = opts.status;
  }
  const sql = `SELECT s.*, COALESCE(c.name, 'Walk-in Customer') AS customer_name, u.name AS user_name
                 FROM sales s
                 LEFT JOIN customers c ON c.id = s.customer_id
                 LEFT JOIN users u ON u.id = s.user_id
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY s.date DESC
                ${opts.limit ? 'LIMIT @limit' : ''}`;
  if (opts.limit) params.limit = opts.limit;
  let rows = db.prepare(sql).all(params) as Record<string, unknown>[];
  if (opts.q) {
    const t = opts.q.toLowerCase();
    rows = rows.filter((r) => `${r.invoice_no} ${r.customer_name}`.toLowerCase().includes(t));
  }
  return rows;
}

export function getSale(db: DB, id: string) {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!sale) return null;
  const lines = db.prepare('SELECT * FROM sale_lines WHERE sale_id = ? ORDER BY line_no').all(id);
  const payments = db.prepare('SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY paid_at').all(id);
  const audit = db.prepare('SELECT * FROM sale_audit WHERE sale_id = ? ORDER BY at').all(id);
  return { ...sale, lines, payments, audit };
}

// ---------- Purchases ----------
export function listPurchases(db: DB, opts: { branchId?: string; status?: string; q?: string; limit?: number } = {}) {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (opts.branchId && opts.branchId !== 'all') {
    where.push('p.branch_id = @branchId');
    params.branchId = opts.branchId;
  }
  if (opts.status) {
    where.push('p.status = @status');
    params.status = opts.status;
  }
  const sql = `SELECT p.*, u.name AS user_name FROM purchases p LEFT JOIN users u ON u.id = p.user_id
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY p.date DESC ${opts.limit ? 'LIMIT @limit' : ''}`;
  if (opts.limit) params.limit = opts.limit;
  let rows = db.prepare(sql).all(params) as Record<string, unknown>[];
  if (opts.q) {
    const t = opts.q.toLowerCase();
    rows = rows.filter((r) => `${r.ref_no} ${r.supplier_name ?? ''}`.toLowerCase().includes(t));
  }
  return rows;
}

export function getPurchase(db: DB, id: string) {
  const pur = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!pur) return null;
  const lines = db.prepare('SELECT * FROM purchase_lines WHERE purchase_id = ? ORDER BY line_no').all(id);
  const payments = db.prepare('SELECT * FROM purchase_payments WHERE purchase_id = ? ORDER BY paid_at').all(id);
  const audit = db.prepare('SELECT * FROM purchase_audit WHERE purchase_id = ? ORDER BY at').all(id);
  return { ...pur, lines, payments, audit };
}

// ---------- Returns / shipments ----------
/**
 * Sell returns, with the customer's and the user's NAME joined in.
 *
 * This was `SELECT * FROM sell_returns`, and the adapter filled in the customer
 * as the constant 'Walk-in Customer' — so every return in the list, and the
 * search box, named the wrong person.
 */
export function listSellReturns(db: DB, opts: { branchId?: string } = {}) {
  const sql = `SELECT r.*, c.name AS customer_name, u.name AS user_name
                 FROM sell_returns r
                 LEFT JOIN customers c ON c.id = r.customer_id
                 LEFT JOIN users u ON u.id = r.user_id
                ${opts.branchId && opts.branchId !== 'all' ? 'WHERE r.branch_id = @branchId' : ''}
                ORDER BY r.date DESC`;
  return db.prepare(sql).all(opts) as Record<string, unknown>[];
}
export function listPurchaseReturns(db: DB) {
  return db
    .prepare(
      `SELECT r.*, u.name AS user_name
         FROM purchase_returns r LEFT JOIN users u ON u.id = r.user_id
        ORDER BY r.date DESC`,
    )
    .all() as Record<string, unknown>[];
}

/** One sell return with its lines — what the return detail view shows. */
export function getSellReturn(db: DB, id: string) {
  const head = db
    .prepare(
      `SELECT r.*, c.name AS customer_name, u.name AS user_name
         FROM sell_returns r
         LEFT JOIN customers c ON c.id = r.customer_id
         LEFT JOIN users u ON u.id = r.user_id
        WHERE r.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!head) return null;
  const lines = db.prepare('SELECT * FROM sell_return_lines WHERE return_id = ? ORDER BY rowid').all(id);
  return { ...head, lines };
}

/** One purchase return with its lines. */
export function getPurchaseReturn(db: DB, id: string) {
  const head = db
    .prepare(
      `SELECT r.*, u.name AS user_name
         FROM purchase_returns r LEFT JOIN users u ON u.id = r.user_id
        WHERE r.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!head) return null;
  const lines = db.prepare('SELECT * FROM purchase_return_lines WHERE return_id = ? ORDER BY rowid').all(id);
  return { ...head, lines };
}
export function listShipments(db: DB, opts: { branchId?: string } = {}) {
  const sql = `SELECT * FROM shipments ${
    opts.branchId && opts.branchId !== 'all' ? 'WHERE branch_id = @branchId' : ''
  } ORDER BY created_at DESC`;
  return db.prepare(sql).all(opts) as Record<string, unknown>[];
}
export function getShipment(db: DB, id: string) {
  return db.prepare('SELECT * FROM shipments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
}

// ---------- Customers / Suppliers ----------
export function listCustomers(db: DB, opts: { q?: string } = {}) {
  const custs = db.prepare('SELECT * FROM customers ORDER BY name').all() as Record<string, unknown>[];
  let rows = custs.map((c) => ({ ...c, ...customerTotals(db, c.id as string) }));
  if (opts.q) {
    const t = opts.q.toLowerCase();
    rows = rows.filter((c: Record<string, unknown>) => `${c.name} ${c.phone ?? ''}`.toLowerCase().includes(t));
  }
  return rows;
}
export function getCustomer(db: DB, id: string) {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!c) return null;
  return { ...c, ...customerTotals(db, id), ledger: customerLedger(db, id) };
}
export function listSuppliers(db: DB, opts: { q?: string } = {}) {
  const sups = db.prepare('SELECT * FROM suppliers ORDER BY name').all() as Record<string, unknown>[];
  let rows = sups.map((s) => ({ ...s, ...supplierTotals(db, s.id as string) }));
  if (opts.q) {
    const t = opts.q.toLowerCase();
    rows = rows.filter((s: Record<string, unknown>) => `${s.name} ${s.company ?? ''} ${s.phone ?? ''}`.toLowerCase().includes(t));
  }
  return rows;
}
export function getSupplier(db: DB, id: string) {
  const s = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!s) return null;
  return { ...s, ...supplierTotals(db, id), ledger: supplierLedger(db, id) };
}

// ---------- Expenses ----------
export function listExpenses(db: DB, opts: { branchId?: string } = {}) {
  const sql = `SELECT e.*, ec.name AS category_name FROM expenses e
               LEFT JOIN expense_categories ec ON ec.id = e.category_id
               WHERE e.voided = 0 ${opts.branchId && opts.branchId !== 'all' ? 'AND e.branch_id = @branchId' : ''}
               ORDER BY e.date DESC`;
  return db.prepare(sql).all(opts) as Record<string, unknown>[];
}
export function listExpenseCategories(db: DB) {
  return db.prepare('SELECT * FROM expense_categories ORDER BY name').all() as Record<string, unknown>[];
}

// ---------- Stock ops ----------
export function listTransfers(db: DB) {
  const transfers = db.prepare('SELECT * FROM stock_transfers ORDER BY date DESC').all() as Record<string, unknown>[];
  return transfers.map((t) => ({
    ...t,
    lines: db.prepare('SELECT * FROM stock_transfer_lines WHERE transfer_id = ?').all(t.id),
  }));
}
export function listAdjustments(db: DB) {
  const adj = db.prepare('SELECT * FROM stock_adjustments ORDER BY date DESC').all() as Record<string, unknown>[];
  return adj.map((a) => ({
    ...a,
    lines: db.prepare('SELECT * FROM stock_adjustment_lines WHERE adjustment_id = ?').all(a.id),
  }));
}

// ---------- Cash ----------
export function listShifts(db: DB, opts: { branchId?: string } = {}) {
  const sql = `SELECT cs.*, u.name AS user_name, cu.name AS closed_by_name
                 FROM cash_shifts cs
                 LEFT JOIN users u ON u.id = cs.user_id
                 LEFT JOIN users cu ON cu.id = cs.closed_by
               ${opts.branchId && opts.branchId !== 'all' ? 'WHERE cs.branch_id = @branchId' : ''}
               ORDER BY cs.opened_at DESC`;
  return db.prepare(sql).all(opts) as Record<string, unknown>[];
}
export function getShiftMovements(db: DB, shiftId: string) {
  return db.prepare('SELECT * FROM cash_movements WHERE shift_id = ? ORDER BY at').all(shiftId) as Record<
    string,
    unknown
  >[];
}

// ---------- Master / reference ----------
export function listBranches(db: DB) {
  return db.prepare('SELECT * FROM branches ORDER BY name').all() as Record<string, unknown>[];
}
export function listCategories(db: DB) {
  return db.prepare('SELECT * FROM categories ORDER BY name').all() as Record<string, unknown>[];
}
export function listBrands(db: DB) {
  return db.prepare('SELECT * FROM brands ORDER BY name').all() as Record<string, unknown>[];
}
export function listUnits(db: DB) {
  return db.prepare('SELECT * FROM units ORDER BY name').all() as Record<string, unknown>[];
}
export function listWarranties(db: DB) {
  return db.prepare('SELECT * FROM warranties ORDER BY name').all() as Record<string, unknown>[];
}
export function listPriceGroups(db: DB) {
  return db
    .prepare('SELECT * FROM price_groups ORDER BY is_default DESC, name')
    .all() as Record<string, unknown>[];
}
export function listTaxRates(db: DB) {
  return db.prepare('SELECT * FROM tax_rates ORDER BY percentage DESC').all() as Record<string, unknown>[];
}
export function listUsers(db: DB) {
  return db.prepare('SELECT id, name, username, phone, email, role_id, branch_ids, status, last_login_at FROM users ORDER BY name').all() as Record<
    string,
    unknown
  >[];
}
export function listRoles(db: DB) {
  return db.prepare('SELECT * FROM roles ORDER BY name').all() as Record<string, unknown>[];
}
export function listAgents(db: DB) {
  return db.prepare('SELECT * FROM commission_agents ORDER BY name').all() as Record<string, unknown>[];
}
export function getBusinessInfo(db: DB) {
  return db.prepare('SELECT * FROM business_info WHERE id = 1').get() as Record<string, unknown> | undefined;
}

// ---------- Global search ----------
/**
 * Turn what the user typed into a safe FTS5 query: every word a quoted prefix
 * term (`"inv-2026"*`), quotes inside doubled.
 *
 * The raw text used to go straight into MATCH with only quotes stripped, and
 * FTS5 gives `-`, `(`, `:`, `*`, AND/OR/NOT and friends a meaning. Typing an
 * invoice number such as INV-2026-0001 — the most common thing anyone searches
 * for — was a syntax error, and because errors are swallowed, the search simply
 * returned nothing. Words with no letter or digit (a lone `(`) are dropped.
 * Returns null when nothing searchable is left.
 */
export function ftsQuery(text: string): string | null {
  const words = String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .slice(0, 8);
  if (words.length === 0) return null;
  return words.map((w) => `"${w.replace(/"/g, '""')}"*`).join(' ');
}

export function globalSearch(db: DB, query: string, scope?: string) {
  const match = ftsQuery(query);
  if (!match) return { products: [], invoices: [], customers: [], suppliers: [] };
  const result: Record<string, unknown[]> = { products: [], invoices: [], customers: [], suppliers: [] };
  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  if (!scope || scope === 'all' || scope === 'product' || scope === 'sku' || scope === 'barcode') {
    result.products = safe(
      () => db.prepare('SELECT product_id, name, sku, barcode FROM fts_products WHERE fts_products MATCH ? LIMIT 8').all(match),
      [],
    );
  }
  if (!scope || scope === 'all' || scope === 'invoice') {
    result.invoices = safe(
      () => db.prepare('SELECT sale_id, invoice_no, customer_name FROM fts_invoices WHERE fts_invoices MATCH ? LIMIT 8').all(match),
      [],
    );
  }
  if (!scope || scope === 'all' || scope === 'customer') {
    result.customers = safe(
      () => db.prepare('SELECT customer_id, name, phone FROM fts_customers WHERE fts_customers MATCH ? LIMIT 8').all(match),
      [],
    );
  }
  if (!scope || scope === 'all' || scope === 'supplier') {
    result.suppliers = safe(
      () => db.prepare('SELECT supplier_id, name, company, phone FROM fts_suppliers WHERE fts_suppliers MATCH ? LIMIT 8').all(match),
      [],
    );
  }
  return result;
}
