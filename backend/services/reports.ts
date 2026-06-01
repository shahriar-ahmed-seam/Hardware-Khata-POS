import type { DB } from '../db/connection.ts';
import { round2 } from '../core/money.ts';
import { resolveRange, type RangeInput } from '../core/dates.ts';
import { stockLevels, stockValuation } from './stock.ts';

function bclause(branchId?: string, alias = ''): string {
  const col = alias ? `${alias}.branch_id` : 'branch_id';
  return branchId && branchId !== 'all' ? ` AND ${col} = @branchId` : '';
}

// ---------- Profit / Loss ----------
export function profitLoss(db: DB, rangeInput: RangeInput, branchId?: string) {
  const range = resolveRange(rangeInput);
  const p = { from: range.from, to: range.to, branchId };

  const sales = db
    .prepare(
      `SELECT COALESCE(SUM(subtotal - order_discount),0) AS net, COALESCE(SUM(cogs),0) AS cogs,
              COALESCE(SUM(shipping),0) AS shipping, COALESCE(SUM(other),0) AS other,
              COALESCE(SUM(tax),0) AS tax, COALESCE(SUM(order_discount),0) AS disc
         FROM sales WHERE status='final' AND date >= @from AND date <= @to ${bclause(branchId)}`,
    )
    .get(p) as { net: number; cogs: number; shipping: number; other: number; tax: number; disc: number };

  const purchases = db
    .prepare(
      `SELECT COALESCE(SUM(total),0) AS total, COALESCE(SUM(tax),0) AS tax
         FROM purchases WHERE status != 'cancelled' AND date >= @from AND date <= @to ${bclause(branchId)}`,
    )
    .get(p) as { total: number; tax: number };

  const sellReturns = db
    .prepare(`SELECT COALESCE(SUM(total),0) AS s FROM sell_returns WHERE date >= @from AND date <= @to ${bclause(branchId)}`)
    .get(p) as { s: number };
  const purchaseReturns = db
    .prepare(`SELECT COALESCE(SUM(total),0) AS s FROM purchase_returns WHERE date >= @from AND date <= @to ${bclause(branchId)}`)
    .get(p) as { s: number };
  const expenses = db
    .prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE voided=0 AND date >= @from AND date <= @to ${bclause(branchId)}`)
    .get(p) as { s: number };
  const adjustments = db
    .prepare(
      `SELECT COALESCE(SUM(sal.qty * sal.unit_cost),0) AS v
         FROM stock_adjustment_lines sal JOIN stock_adjustments sa ON sa.id = sal.adjustment_id
        WHERE sa.date >= @from AND sa.date <= @to ${bclause(branchId, 'sa')}`,
    )
    .get(p) as { v: number };

  const grossProfit = round2(sales.net - sales.cogs - sellReturns.s);
  const marginPct = sales.net > 0 ? round2((grossProfit / sales.net) * 100) : 0;
  // adjustments.v is signed: negative = loss. Subtracting it (when negative) reduces profit.
  const netProfit = round2(
    grossProfit + sales.shipping + sales.other + purchaseReturns.s - expenses.s + adjustments.v,
  );

  return {
    range,
    moneyIn: {
      totalSalesExclTaxDisc: round2(sales.net),
      sellShipping: round2(sales.shipping),
      sellOther: round2(sales.other),
      purchaseReturns: round2(purchaseReturns.s),
    },
    moneyOut: {
      cogs: round2(sales.cogs),
      sellReturns: round2(sellReturns.s),
      expenses: round2(expenses.s),
      stockAdjustment: round2(adjustments.v),
    },
    tax: {
      salesTaxCollected: round2(sales.tax),
      purchaseTaxPaid: round2(purchases.tax),
      netVat: round2(sales.tax - purchases.tax),
    },
    grossProfit,
    marginPct,
    netProfit,
    totalPurchases: round2(purchases.total),
  };
}

// ---------- Product Sell ----------
export function productSell(db: DB, rangeInput: RangeInput, branchId?: string) {
  const range = resolveRange(rangeInput);
  const rows = db
    .prepare(
      `SELECT sl.product_id, sl.name_at_sale AS name, sl.sku_at_sale AS sku,
              SUM(sl.qty) AS qty, SUM(sl.line_subtotal) AS revenue,
              SUM(sl.qty * sl.unit_cost_at_sale) AS cost,
              COUNT(DISTINCT sl.sale_id) AS invoices
         FROM sale_lines sl JOIN sales s ON s.id = sl.sale_id
        WHERE s.status='final' AND s.date >= @from AND s.date <= @to ${bclause(branchId, 's')}
        GROUP BY sl.product_id ORDER BY revenue DESC`,
    )
    .all({ from: range.from, to: range.to, branchId }) as {
    product_id: string;
    name: string;
    sku: string;
    qty: number;
    revenue: number;
    cost: number;
    invoices: number;
  }[];
  return rows.map((r) => {
    const profit = round2(r.revenue - r.cost);
    return {
      productId: r.product_id,
      name: r.name,
      sku: r.sku,
      qty: round2(r.qty),
      revenue: round2(r.revenue),
      cost: round2(r.cost),
      profit,
      marginPct: r.revenue > 0 ? round2((profit / r.revenue) * 100) : 0,
      invoices: r.invoices,
    };
  });
}

// ---------- Product Purchase ----------
export function productPurchase(db: DB, rangeInput: RangeInput, branchId?: string) {
  const range = resolveRange(rangeInput);
  const rows = db
    .prepare(
      `SELECT pl.product_id, pl.name, pl.sku, SUM(pl.qty) AS qty, SUM(pl.line_total) AS spend,
              COUNT(DISTINCT pl.purchase_id) AS bills
         FROM purchase_lines pl JOIN purchases pu ON pu.id = pl.purchase_id
        WHERE pu.status != 'cancelled' AND pu.date >= @from AND pu.date <= @to ${bclause(branchId, 'pu')}
        GROUP BY pl.product_id ORDER BY spend DESC`,
    )
    .all({ from: range.from, to: range.to, branchId }) as {
    product_id: string;
    name: string;
    sku: string;
    qty: number;
    spend: number;
    bills: number;
  }[];
  return rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    sku: r.sku,
    qty: round2(r.qty),
    spend: round2(r.spend),
    avgCost: r.qty > 0 ? round2(r.spend / r.qty) : 0,
    bills: r.bills,
  }));
}

// ---------- Payments ----------
export function sellPayments(db: DB, rangeInput: RangeInput, branchId?: string) {
  const range = resolveRange(rangeInput);
  const byMethod = db
    .prepare(
      `SELECT p.method, COALESCE(SUM(p.amount),0) AS amount, COUNT(*) AS cnt
         FROM sale_payments p JOIN sales s ON s.id = p.sale_id
        WHERE s.status='final' AND p.paid_at >= @from AND p.paid_at <= @to ${bclause(branchId, 's')}
        GROUP BY p.method ORDER BY amount DESC`,
    )
    .all({ from: range.from, to: range.to, branchId }) as { method: string; amount: number; cnt: number }[];
  const total = round2(byMethod.reduce((a, m) => a + m.amount, 0));
  return { byMethod: byMethod.map((m) => ({ ...m, amount: round2(m.amount) })), total };
}

export function purchasePayments(db: DB, rangeInput: RangeInput, branchId?: string) {
  const range = resolveRange(rangeInput);
  const byMethod = db
    .prepare(
      `SELECT p.method, COALESCE(SUM(p.amount),0) AS amount, COUNT(*) AS cnt
         FROM purchase_payments p JOIN purchases pu ON pu.id = p.purchase_id
        WHERE pu.status != 'cancelled' AND p.paid_at >= @from AND p.paid_at <= @to ${bclause(branchId, 'pu')}
        GROUP BY p.method ORDER BY amount DESC`,
    )
    .all({ from: range.from, to: range.to, branchId }) as { method: string; amount: number; cnt: number }[];
  const total = round2(byMethod.reduce((a, m) => a + m.amount, 0));
  return { byMethod: byMethod.map((m) => ({ ...m, amount: round2(m.amount) })), total };
}

// ---------- Tax ----------
export function taxReport(db: DB, rangeInput: RangeInput, branchId?: string) {
  const range = resolveRange(rangeInput);
  const salesByRate = db
    .prepare(
      `SELECT ROUND(tax_pct,1) AS rate, COUNT(*) AS invoices,
              COALESCE(SUM(subtotal - order_discount),0) AS taxable, COALESCE(SUM(tax),0) AS tax
         FROM sales WHERE status='final' AND date >= @from AND date <= @to ${bclause(branchId)}
        GROUP BY rate ORDER BY rate DESC`,
    )
    .all({ from: range.from, to: range.to, branchId }) as {
    rate: number;
    invoices: number;
    taxable: number;
    tax: number;
  }[];
  const purchaseByRate = db
    .prepare(
      `SELECT ROUND(tax_pct,1) AS rate, COUNT(*) AS bills,
              COALESCE(SUM(subtotal - order_discount),0) AS taxable, COALESCE(SUM(tax),0) AS tax
         FROM purchases WHERE status != 'cancelled' AND date >= @from AND date <= @to ${bclause(branchId)}
        GROUP BY rate ORDER BY rate DESC`,
    )
    .all({ from: range.from, to: range.to, branchId }) as {
    rate: number;
    bills: number;
    taxable: number;
    tax: number;
  }[];
  const salesTotal = round2(salesByRate.reduce((a, r) => a + r.tax, 0));
  const purchaseTotal = round2(purchaseByRate.reduce((a, r) => a + r.tax, 0));
  return {
    salesByRate: salesByRate.map((r) => ({ ...r, taxable: round2(r.taxable), tax: round2(r.tax) })),
    purchaseByRate: purchaseByRate.map((r) => ({ ...r, taxable: round2(r.taxable), tax: round2(r.tax) })),
    salesTotal,
    purchaseTotal,
    net: round2(salesTotal - purchaseTotal),
  };
}

// ---------- Trending ----------
export function trending(db: DB, rangeInput: RangeInput, metric: 'qty' | 'revenue', branchId?: string) {
  const range = resolveRange(rangeInput);
  const span = new Date(range.to).getTime() - new Date(range.from).getTime();
  const prevFrom = new Date(new Date(range.from).getTime() - span - 1).toISOString();
  const prevTo = new Date(new Date(range.from).getTime() - 1).toISOString();
  const col = metric === 'qty' ? 'SUM(sl.qty)' : 'SUM(sl.line_subtotal)';

  const agg = (from: string, to: string) =>
    db
      .prepare(
        `SELECT sl.product_id, sl.name_at_sale AS name, sl.sku_at_sale AS sku, ${col} AS val
           FROM sale_lines sl JOIN sales s ON s.id = sl.sale_id
          WHERE s.status='final' AND s.date >= @from AND s.date <= @to ${bclause(branchId, 's')}
          GROUP BY sl.product_id`,
      )
      .all({ from, to, branchId }) as { product_id: string; name: string; sku: string; val: number }[];

  const cur = agg(range.from, range.to);
  const prev = agg(prevFrom, prevTo);
  const prevMap = new Map(prev.map((r) => [r.product_id, r.val]));
  return cur
    .map((r) => {
      const previous = prevMap.get(r.product_id) ?? 0;
      const deltaPct = previous > 0 ? round2(((r.val - previous) / previous) * 100) : r.val > 0 ? 100 : 0;
      return { productId: r.product_id, name: r.name, sku: r.sku, current: round2(r.val), previous: round2(previous), deltaPct };
    })
    .sort((a, b) => b.current - a.current)
    .slice(0, 50);
}

// ---------- Sales rep ----------
export function salesRep(db: DB, rangeInput: RangeInput, branchId?: string) {
  const range = resolveRange(rangeInput);
  const agents = db.prepare('SELECT * FROM commission_agents WHERE active = 1').all() as {
    id: string;
    name: string;
    commission_pct: number;
  }[];
  return agents.map((a) => {
    const s = db
      .prepare(
        `SELECT COALESCE(SUM(subtotal - order_discount),0) AS gross, COUNT(*) AS cnt
           FROM sales WHERE status='final' AND agent_id = @aid AND date >= @from AND date <= @to ${bclause(branchId)}`,
      )
      .get({ aid: a.id, from: range.from, to: range.to, branchId }) as { gross: number; cnt: number };
    const ret = db
      .prepare(
        `SELECT COALESCE(SUM(sr.total),0) AS s FROM sell_returns sr JOIN sales sa ON sa.id = sr.sale_id
          WHERE sa.agent_id = @aid AND sr.date >= @from AND sr.date <= @to`,
      )
      .get({ aid: a.id, from: range.from, to: range.to }) as { s: number };
    const net = round2(s.gross - ret.s);
    const commission = round2((net * a.commission_pct) / 100);
    return {
      id: a.id,
      name: a.name,
      commissionPct: a.commission_pct,
      saleCount: s.cnt,
      grossSales: round2(s.gross),
      returns: round2(ret.s),
      netSales: net,
      commissionEarned: commission,
    };
  });
}

// ---------- Customer group ----------
export function customerGroup(db: DB, rangeInput: RangeInput, branchId?: string) {
  const range = resolveRange(rangeInput);
  const rows = db
    .prepare(
      `SELECT COALESCE(c.price_group,'Retail') AS grp, COUNT(DISTINCT s.id) AS sales,
              COALESCE(SUM(s.subtotal),0) AS gross, COALESCE(SUM(s.subtotal - s.order_discount),0) AS net
         FROM sales s JOIN customers c ON c.id = s.customer_id
        WHERE s.status='final' AND s.date >= @from AND s.date <= @to ${bclause(branchId, 's')}
        GROUP BY grp ORDER BY net DESC`,
    )
    .all({ from: range.from, to: range.to, branchId }) as {
    grp: string;
    sales: number;
    gross: number;
    net: number;
  }[];
  return rows.map((r) => ({
    group: r.grp,
    saleCount: r.sales,
    grossSales: round2(r.gross),
    netSales: round2(r.net),
    avgTicket: r.sales > 0 ? round2(r.net / r.sales) : 0,
  }));
}

// ---------- Stock report ----------
export function stockReport(db: DB, branchId?: string) {
  const levels = stockLevels(db, branchId && branchId !== 'all' ? branchId : undefined);
  const prods = db
    .prepare('SELECT id, name, sku, cost, price, reorder_level, manage_stock FROM products')
    .all() as {
    id: string;
    name: string;
    sku: string;
    cost: number;
    price: number;
    reorder_level: number;
    manage_stock: number;
  }[];
  const rows = prods.map((p) => {
    const stock = levels.get(p.id) ?? 0;
    const state = stock <= 0 ? 'out' : stock <= p.reorder_level ? 'low' : 'in';
    return {
      ...p,
      stock,
      valueAtCost: round2(stock * p.cost),
      valueAtRetail: round2(stock * p.price),
      state,
    };
  });
  return {
    rows,
    totalValueAtCost: stockValuation(db, 'cost', branchId && branchId !== 'all' ? branchId : undefined),
    totalValueAtRetail: stockValuation(db, 'retail', branchId && branchId !== 'all' ? branchId : undefined),
  };
}
