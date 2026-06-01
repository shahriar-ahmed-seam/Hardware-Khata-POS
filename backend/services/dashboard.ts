import type { DB } from '../db/connection.ts';
import { round2 } from '../core/money.ts';
import { resolveRange, type RangeInput, type ResolvedRange } from '../core/dates.ts';
import { stockLevels, stockValuation } from './stock.ts';
import { customerDue, supplierDue } from './ledger.ts';

function branchClause(branchId?: string, alias = ''): string {
  const col = alias ? `${alias}.branch_id` : 'branch_id';
  return branchId && branchId !== 'all' ? ` AND ${col} = @branchId` : '';
}

function deltaPct(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return round2(((curr - prev) / prev) * 100);
}

/** Previous period of equal length immediately before `r`. */
function priorRange(r: ResolvedRange): ResolvedRange {
  const from = new Date(r.from).getTime();
  const to = new Date(r.to).getTime();
  const span = to - from;
  return {
    from: new Date(from - span - 1).toISOString(),
    to: new Date(from - 1).toISOString(),
  };
}

function salesAgg(db: DB, range: ResolvedRange, branchId?: string) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(total),0) AS total, COALESCE(SUM(subtotal - order_discount),0) AS net,
              COALESCE(SUM(cogs),0) AS cogs, COALESCE(SUM(profit),0) AS profit, COUNT(*) AS cnt
         FROM sales WHERE status = 'final' AND date >= @from AND date <= @to ${branchClause(branchId)}`,
    )
    .get({ from: range.from, to: range.to, branchId }) as {
    total: number;
    net: number;
    cogs: number;
    profit: number;
    cnt: number;
  };
  return row;
}

export function getStats(db: DB, rangeInput: RangeInput, branchId?: string) {
  const range = resolveRange(rangeInput);
  const prev = priorRange(range);

  const cur = salesAgg(db, range, branchId);
  const prv = salesAgg(db, prev, branchId);

  const itemsSold = db
    .prepare(
      `SELECT COALESCE(SUM(sl.qty),0) AS q FROM sale_lines sl JOIN sales s ON s.id = sl.sale_id
        WHERE s.status='final' AND s.date >= @from AND s.date <= @to ${branchClause(branchId, 's')}`,
    )
    .get({ from: range.from, to: range.to, branchId }) as { q: number };

  const itemsSoldPrev = db
    .prepare(
      `SELECT COALESCE(SUM(sl.qty),0) AS q FROM sale_lines sl JOIN sales s ON s.id = sl.sale_id
        WHERE s.status='final' AND s.date >= @from AND s.date <= @to ${branchClause(branchId, 's')}`,
    )
    .get({ from: prev.from, to: prev.to, branchId }) as { q: number };

  const newCustomers = db
    .prepare(`SELECT COUNT(*) AS c FROM customers WHERE created_at >= @from AND created_at <= @to`)
    .get({ from: range.from, to: range.to }) as { c: number };
  const newCustomersPrev = db
    .prepare(`SELECT COUNT(*) AS c FROM customers WHERE created_at >= @from AND created_at <= @to`)
    .get({ from: prev.from, to: prev.to }) as { c: number };

  const expenses = db
    .prepare(
      `SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE voided = 0 AND date >= @from AND date <= @to ${branchClause(branchId)}`,
    )
    .get({ from: range.from, to: range.to, branchId }) as { s: number };

  const purchases = db
    .prepare(
      `SELECT COALESCE(SUM(total),0) AS s FROM purchases WHERE status != 'cancelled' AND date >= @from AND date <= @to ${branchClause(branchId)}`,
    )
    .get({ from: range.from, to: range.to, branchId }) as { s: number };

  const returns = db
    .prepare(
      `SELECT COALESCE(SUM(total),0) AS s FROM sell_returns WHERE date >= @from AND date <= @to ${branchClause(branchId)}`,
    )
    .get({ from: range.from, to: range.to, branchId }) as { s: number };

  // dues totals (all customers/suppliers, not range-bound)
  const customers = db.prepare('SELECT id FROM customers').all() as { id: string }[];
  let customerDuesTotal = 0;
  for (const c of customers) customerDuesTotal += customerDue(db, c.id);
  const suppliers = db.prepare('SELECT id FROM suppliers').all() as { id: string }[];
  let supplierDuesTotal = 0;
  for (const s of suppliers) supplierDuesTotal += supplierDue(db, s.id);

  // stock alerts
  const levels = stockLevels(db, branchId && branchId !== 'all' ? branchId : undefined);
  const prods = db.prepare('SELECT id, reorder_level FROM products WHERE manage_stock = 1').all() as {
    id: string;
    reorder_level: number;
  }[];
  let lowStockCount = 0;
  let outOfStockCount = 0;
  for (const p of prods) {
    const qty = levels.get(p.id) ?? 0;
    if (qty <= 0) outOfStockCount++;
    else if (qty <= p.reorder_level) lowStockCount++;
  }

  // cash in drawer (open shift expected)
  let cashInDrawer = 0;
  const openShifts = db.prepare("SELECT id, opening_cash FROM cash_shifts WHERE status = 'open'").all() as {
    id: string;
    opening_cash: number;
  }[];
  for (const sh of openShifts) {
    const inRow = db
      .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM cash_movements WHERE shift_id = ? AND direction='in' AND reason != 'opening'")
      .get(sh.id) as { s: number };
    const outRow = db
      .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM cash_movements WHERE shift_id = ? AND direction='out'")
      .get(sh.id) as { s: number };
    cashInDrawer += sh.opening_cash + inRow.s - outRow.s;
  }

  const grossProfit = round2(cur.net - cur.cogs);
  const netProfit = round2(grossProfit - expenses.s);

  return {
    range,
    sales: { total: round2(cur.total), deltaPct: deltaPct(cur.total, prv.total) },
    profit: {
      revenue: round2(cur.net),
      cogs: round2(cur.cogs),
      grossProfit,
      marginPct: cur.net > 0 ? round2((grossProfit / cur.net) * 100) : 0,
      expenses: round2(expenses.s),
      netProfit,
      deltaPct: deltaPct(cur.profit, prv.profit),
    },
    transactions: { count: cur.cnt, deltaPct: deltaPct(cur.cnt, prv.cnt) },
    itemsSold: { count: round2(itemsSold.q), deltaPct: deltaPct(itemsSold.q, itemsSoldPrev.q) },
    newCustomers: { count: newCustomers.c, deltaPct: deltaPct(newCustomers.c, newCustomersPrev.c) },
    cashInDrawer: round2(cashInDrawer),
    customerDuesTotal: round2(customerDuesTotal),
    supplierDuesTotal: round2(supplierDuesTotal),
    lowStockCount,
    outOfStockCount,
    todayExpenses: round2(expenses.s),
    todayPurchases: round2(purchases.s),
    returnsToday: round2(returns.s),
    stockValueAtCost: stockValuation(db, 'cost', branchId && branchId !== 'all' ? branchId : undefined),
    stockValueAtRetail: stockValuation(db, 'retail', branchId && branchId !== 'all' ? branchId : undefined),
  };
}

// ---------- Widgets ----------
export function hourlySales(db: DB, rangeInput: RangeInput, branchId?: string) {
  const range = resolveRange(rangeInput);
  const rows = db
    .prepare(
      `SELECT substr(date, 12, 2) AS hour, COALESCE(SUM(total),0) AS total, COUNT(*) AS cnt
         FROM sales WHERE status='final' AND date >= @from AND date <= @to ${branchClause(branchId)}
        GROUP BY hour ORDER BY hour`,
    )
    .all({ from: range.from, to: range.to, branchId }) as {
    hour: string;
    total: number;
    cnt: number;
  }[];
  return rows.map((r) => ({ hour: Number(r.hour), total: round2(r.total), count: r.cnt }));
}

export function salesTrend(db: DB, days: number, branchId?: string) {
  const rows = db
    .prepare(
      `SELECT substr(date, 1, 10) AS day, COALESCE(SUM(total),0) AS total
         FROM sales WHERE status='final' AND date >= date('now', '-' || @days || ' days') ${branchClause(branchId)}
        GROUP BY day ORDER BY day`,
    )
    .all({ days, branchId }) as { day: string; total: number }[];
  return rows.map((r) => ({ day: r.day, total: round2(r.total) }));
}

export function topProducts(db: DB, rangeInput: RangeInput, limit = 10, branchId?: string) {
  const range = resolveRange(rangeInput);
  const rows = db
    .prepare(
      `SELECT sl.product_id, sl.name_at_sale AS name, SUM(sl.qty) AS qty, SUM(sl.line_subtotal) AS revenue
         FROM sale_lines sl JOIN sales s ON s.id = sl.sale_id
        WHERE s.status='final' AND s.date >= @from AND s.date <= @to ${branchClause(branchId, 's')}
        GROUP BY sl.product_id ORDER BY qty DESC LIMIT @limit`,
    )
    .all({ from: range.from, to: range.to, branchId, limit }) as {
    product_id: string;
    name: string;
    qty: number;
    revenue: number;
  }[];
  return rows.map((r) => ({ productId: r.product_id, name: r.name, qty: round2(r.qty), revenue: round2(r.revenue) }));
}

export function recentSales(db: DB, limit = 10, branchId?: string) {
  const rows = db
    .prepare(
      `SELECT s.id, s.invoice_no, s.date, s.total, s.paid, s.due, s.status, COALESCE(c.name,'Walk-in Customer') AS customer
         FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.status='final' ${branchClause(branchId, 's')}
        ORDER BY s.date DESC LIMIT @limit`,
    )
    .all({ branchId, limit }) as Record<string, unknown>[];
  return rows;
}

export function lowStock(db: DB, branchId?: string, limit = 50) {
  const levels = stockLevels(db, branchId && branchId !== 'all' ? branchId : undefined);
  const prods = db
    .prepare('SELECT id, name, sku, reorder_level, cost FROM products WHERE manage_stock = 1')
    .all() as { id: string; name: string; sku: string; reorder_level: number; cost: number }[];
  const out = prods
    .map((p) => ({ ...p, stock: levels.get(p.id) ?? 0 }))
    .filter((p) => p.stock <= p.reorder_level)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, limit);
  return out;
}

export function paymentMethodBreakdown(db: DB, rangeInput: RangeInput, branchId?: string) {
  const range = resolveRange(rangeInput);
  const rows = db
    .prepare(
      `SELECT p.method, COALESCE(SUM(p.amount),0) AS amount, COUNT(*) AS cnt
         FROM sale_payments p JOIN sales s ON s.id = p.sale_id
        WHERE s.status='final' AND p.paid_at >= @from AND p.paid_at <= @to ${branchClause(branchId, 's')}
        GROUP BY p.method ORDER BY amount DESC`,
    )
    .all({ from: range.from, to: range.to, branchId }) as {
    method: string;
    amount: number;
    cnt: number;
  }[];
  return rows.map((r) => ({ method: r.method, amount: round2(r.amount), count: r.cnt }));
}

export function expenseBreakdown(db: DB, rangeInput: RangeInput, branchId?: string) {
  const range = resolveRange(rangeInput);
  const rows = db
    .prepare(
      `SELECT COALESCE(ec.name,'Uncategorized') AS category, COALESCE(SUM(e.amount),0) AS amount, COUNT(*) AS cnt
         FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.category_id
        WHERE e.voided = 0 AND e.date >= @from AND e.date <= @to ${branchClause(branchId, 'e')}
        GROUP BY e.category_id ORDER BY amount DESC`,
    )
    .all({ from: range.from, to: range.to, branchId }) as {
    category: string;
    amount: number;
    cnt: number;
  }[];
  return rows.map((r) => ({ category: r.category, amount: round2(r.amount), count: r.cnt }));
}

export function activityFeed(db: DB, limit = 20, branchId?: string) {
  const rows = db
    .prepare(
      `SELECT * FROM activity_log ${branchId && branchId !== 'all' ? 'WHERE branch_id = @branchId' : ''} ORDER BY at DESC LIMIT @limit`,
    )
    .all({ branchId, limit }) as Record<string, unknown>[];
  return rows;
}

/**
 * Top customers by final-sale total within a range.
 * GROUP BY customer_id over status='final' sales; name resolved via LEFT JOIN
 * with COALESCE to 'Walk-in Customer' (covers null customer_id walk-ins).
 */
export function topCustomers(db: DB, rangeInput: RangeInput, limit = 5, branchId?: string) {
  const range = resolveRange(rangeInput);
  const rows = db
    .prepare(
      `SELECT s.customer_id AS customer_id, COALESCE(c.name,'Walk-in Customer') AS name,
              COUNT(*) AS orders, COALESCE(SUM(s.total),0) AS total
         FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.status='final' AND s.date >= @from AND s.date <= @to ${branchClause(branchId, 's')}
        GROUP BY s.customer_id ORDER BY total DESC LIMIT @limit`,
    )
    .all({ from: range.from, to: range.to, branchId, limit }) as {
    customer_id: string | null;
    name: string;
    orders: number;
    total: number;
  }[];
  return rows.map((r) => ({
    customerId: r.customer_id,
    name: r.name,
    orders: r.orders,
    total: round2(r.total),
  }));
}

/** Latest non-cancelled purchases (newest first). */
export function recentPurchases(db: DB, limit = 8, branchId?: string) {
  const rows = db
    .prepare(
      `SELECT id, ref_no, COALESCE(supplier_name,'') AS supplier_name, date, total
         FROM purchases WHERE status != 'cancelled' ${branchClause(branchId)}
        ORDER BY date DESC LIMIT @limit`,
    )
    .all({ branchId, limit }) as {
    id: string;
    ref_no: string;
    supplier_name: string;
    date: string;
    total: number;
  }[];
  return rows.map((r) => ({ ...r, total: round2(r.total) }));
}

/**
 * Per-calendar-month comparison for the last `months` (inclusive of the current
 * month). sales = final-sale totals, purchases = non-cancelled purchase totals,
 * expenses = non-voided expense amounts. Months with no data come back as 0 so
 * the chart always has a continuous axis.
 */
export function salesVsPurchaseVsExpense(db: DB, months = 6, branchId?: string) {
  const now = new Date();
  // Build the ordered list of YYYY-MM keys for the window (oldest → newest).
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const from = keys[0] + '-01'; // first day of the oldest month (string compare is safe on ISO)

  const salesRows = db
    .prepare(
      `SELECT substr(date,1,7) AS m, COALESCE(SUM(total),0) AS v FROM sales
        WHERE status='final' AND date >= @from ${branchClause(branchId)} GROUP BY m`,
    )
    .all({ from, branchId }) as { m: string; v: number }[];
  const purchaseRows = db
    .prepare(
      `SELECT substr(date,1,7) AS m, COALESCE(SUM(total),0) AS v FROM purchases
        WHERE status != 'cancelled' AND date >= @from ${branchClause(branchId)} GROUP BY m`,
    )
    .all({ from, branchId }) as { m: string; v: number }[];
  const expenseRows = db
    .prepare(
      `SELECT substr(date,1,7) AS m, COALESCE(SUM(amount),0) AS v FROM expenses
        WHERE voided = 0 AND date >= @from ${branchClause(branchId)} GROUP BY m`,
    )
    .all({ from, branchId }) as { m: string; v: number }[];

  const toMap = (rs: { m: string; v: number }[]) => new Map(rs.map((r) => [r.m, r.v]));
  const sMap = toMap(salesRows);
  const pMap = toMap(purchaseRows);
  const eMap = toMap(expenseRows);

  return keys.map((month) => ({
    month,
    sales: round2(sMap.get(month) ?? 0),
    purchases: round2(pMap.get(month) ?? 0),
    expenses: round2(eMap.get(month) ?? 0),
  }));
}

export function birthdays(db: DB, daysAhead = 7) {
  const rows = db.prepare("SELECT id, name, phone, dob FROM customers WHERE dob IS NOT NULL").all() as {
    id: string;
    name: string;
    phone: string;
    dob: string;
  }[];
  const today = new Date();
  const out: typeof rows = [];
  for (const c of rows) {
    const d = new Date(c.dob);
    if (isNaN(d.getTime())) continue;
    const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000);
    if (diff >= 0 && diff <= daysAhead) out.push(c);
  }
  return out;
}
