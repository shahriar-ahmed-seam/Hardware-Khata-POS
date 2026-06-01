/**
 * API FACADE INTEGRATION TEST
 * Exercises the exact `buildApi()` channel map that Electron IPC will forward
 * to. Proves every channel resolves and returns sane shapes against a seeded DB.
 */
import { openDatabase, migrate } from '../db/connection.ts';
import { simulate } from '../seed/simulate.ts';
import { seedMaster } from '../seed/master.ts';
import { buildApi, API_CHANNELS } from '../api.ts';
import { Suite } from './assert.ts';
import { round2 } from '../core/money.ts';

function main() {
  const db = openDatabase(':memory:');
  migrate(db);
  simulate(db, { days: 90, seed: 55 });
  const api = buildApi();
  const s = new Suite();
  s.section('api');

  const call = (ch: string, payload: unknown = {}) => api[ch](db, payload);

  // reads return arrays / objects without throwing
  s.gt('products.list', (call('products.list') as unknown[]).length, 0);
  s.gt('sales.list', (call('sales.list') as unknown[]).length, 0);
  s.gt('purchases.list', (call('purchases.list') as unknown[]).length, 0);
  s.gt('customers.list', (call('customers.list') as unknown[]).length, 0);
  s.gt('suppliers.list', (call('suppliers.list') as unknown[]).length, 0);
  s.gt('branches.list', (call('branches.list') as unknown[]).length, 0);
  s.gt('expenses.list', (call('expenses.list') as unknown[]).length, 0);
  s.gt('shifts.list', (call('shifts.list') as unknown[]).length, 0);
  s.ok('business.get returns object', !!call('business.get'));

  // detail by id
  const firstSale = (call('sales.list', { limit: 1 }) as { id: string }[])[0];
  const saleDetail = call('sales.get', { id: firstSale.id }) as { lines: unknown[]; payments: unknown[] };
  s.gt('sales.get has lines', saleDetail.lines.length, 0);

  const firstCust = (call('customers.list') as { id: string }[]).find((c) => c.id !== 'cu1')!;
  const custDetail = call('customers.get', { id: firstCust.id }) as { ledger: unknown[]; due: number };
  s.ok('customers.get has ledger', Array.isArray(custDetail.ledger));

  // aggregations
  const range = { preset: 'thisYear' as const };
  const stats = call('dashboard.stats', { range }) as { transactions: { count: number } };
  s.gt('dashboard.stats transactions', stats.transactions.count, 0);
  s.ok('dashboard.topProducts', Array.isArray(call('dashboard.topProducts', { range })));
  s.ok('reports.profitLoss', !!call('reports.profitLoss', { range }));
  s.ok('reports.productSell', Array.isArray(call('reports.productSell', { range })));
  s.ok('reports.tax', !!call('reports.tax', { range }));

  // ----- dashboard-extra: the 3 new aggregation handlers -----
  s.section('dashboard-extra');
  {
    // topCustomers: array of { customerId, name, orders, total } with total >= 0,
    // sorted descending by total.
    const tc = call('dashboard.topCustomers', { range, limit: 5 }) as {
      customerId: string | null;
      name: string;
      orders: number;
      total: number;
    }[];
    s.ok('dashboard.topCustomers is array', Array.isArray(tc));
    s.gt('dashboard.topCustomers has rows', tc.length, 0);
    s.ok('dashboard.topCustomers respects limit', tc.length <= 5);
    let tcShapeOk = true;
    let tcOrderOk = true;
    for (let i = 0; i < tc.length; i++) {
      const r = tc[i];
      if (typeof r.name !== 'string' || typeof r.orders !== 'number' || typeof r.total !== 'number') {
        tcShapeOk = false;
      }
      if (i > 0 && tc[i - 1].total < r.total) tcOrderOk = false;
    }
    s.ok('dashboard.topCustomers rows well-shaped', tcShapeOk);
    s.ok('dashboard.topCustomers sorted desc by total', tcOrderOk);
    s.gte('dashboard.topCustomers top total >= 0', tc[0].total, 0);
    s.gt('dashboard.topCustomers top orders > 0', tc[0].orders, 0);

    // recentPurchases: array of { id, ref_no, supplier_name, date, total } newest-first.
    const rp = call('dashboard.recentPurchases', { limit: 8 }) as {
      id: string;
      ref_no: string;
      supplier_name: string;
      date: string;
      total: number;
    }[];
    s.ok('dashboard.recentPurchases is array', Array.isArray(rp));
    s.gt('dashboard.recentPurchases has rows', rp.length, 0);
    s.ok('dashboard.recentPurchases respects limit', rp.length <= 8);
    let rpShapeOk = true;
    let rpOrderOk = true;
    for (let i = 0; i < rp.length; i++) {
      const r = rp[i];
      if (typeof r.id !== 'string' || typeof r.ref_no !== 'string' || typeof r.total !== 'number') {
        rpShapeOk = false;
      }
      if (i > 0 && rp[i - 1].date < r.date) rpOrderOk = false;
    }
    s.ok('dashboard.recentPurchases rows well-shaped', rpShapeOk);
    s.ok('dashboard.recentPurchases ordered by date DESC', rpOrderOk);
    s.money('dashboard.recentPurchases total rounded', rp[0].total, round2(rp[0].total));

    // salesVsPurchaseVsExpense: 6 month rows each with numeric sales/purchases/expenses.
    const spe = call('dashboard.salesVsPurchaseVsExpense', { months: 6 }) as {
      month: string;
      sales: number;
      purchases: number;
      expenses: number;
    }[];
    s.ok('dashboard.salesVsPurchaseVsExpense is array', Array.isArray(spe));
    s.eq('dashboard.salesVsPurchaseVsExpense has 6 months', spe.length, 6);
    let speShapeOk = true;
    for (const r of spe) {
      if (
        !/^\d{4}-\d{2}$/.test(r.month) ||
        typeof r.sales !== 'number' ||
        typeof r.purchases !== 'number' ||
        typeof r.expenses !== 'number'
      ) {
        speShapeOk = false;
      }
    }
    s.ok('dashboard.salesVsPurchaseVsExpense rows well-shaped (YYYY-MM + numbers)', speShapeOk);
    // sum across the window is non-negative and rounded
    const speSales = round2(spe.reduce((a, r) => a + r.sales, 0));
    s.gte('dashboard.salesVsPurchaseVsExpense sales sum >= 0', speSales, 0);
    s.money('dashboard.salesVsPurchaseVsExpense first month sales rounded', spe[0].sales, round2(spe[0].sales));
  }

  // ----- reports-extra: the remaining reports.* aggregation handlers -----
  // The 10 reports.* channels exist; profitLoss/productSell/tax are smoke-tested
  // above. Here we assert the shapes of productPurchase / sellPayments /
  // purchasePayments / trending / salesRep / customerGroup / stock against the
  // seeded sim. Kept robust to seed (no hard counts; totals >= 0, money rounded).
  s.section('reports-extra');
  {
    const range = { preset: 'thisYear' as const };

    // productPurchase: rows of { productId, name, sku, qty, spend, avgCost, bills }
    const pp = call('reports.productPurchase', { range }) as {
      productId: string;
      name: string;
      sku: string;
      qty: number;
      spend: number;
      avgCost: number;
      bills: number;
    }[];
    s.ok('reports.productPurchase is array', Array.isArray(pp));
    s.gt('reports.productPurchase has rows', pp.length, 0);
    let ppShapeOk = true;
    let ppSpendOrderOk = true;
    for (let i = 0; i < pp.length; i++) {
      const r = pp[i];
      if (
        typeof r.productId !== 'string' ||
        typeof r.sku !== 'string' ||
        typeof r.qty !== 'number' ||
        typeof r.spend !== 'number' ||
        typeof r.bills !== 'number'
      ) {
        ppShapeOk = false;
      }
      if (i > 0 && pp[i - 1].spend < r.spend) ppSpendOrderOk = false;
    }
    s.ok('reports.productPurchase rows well-shaped', ppShapeOk);
    s.ok('reports.productPurchase sorted desc by spend', ppSpendOrderOk);
    s.gte('reports.productPurchase top spend >= 0', pp[0].spend, 0);
    s.money('reports.productPurchase spend rounded', pp[0].spend, round2(pp[0].spend));
    s.money('reports.productPurchase avgCost rounded', pp[0].avgCost, round2(pp[0].avgCost));

    // sellPayments: { byMethod: [{ method, amount, cnt }], total } with total = sum.
    const sp = call('reports.sellPayments', { range }) as {
      byMethod: { method: string; amount: number; cnt: number }[];
      total: number;
    };
    s.ok('reports.sellPayments has byMethod array', Array.isArray(sp.byMethod));
    s.gt('reports.sellPayments has methods', sp.byMethod.length, 0);
    s.gte('reports.sellPayments total >= 0', sp.total, 0);
    s.money('reports.sellPayments total rounded', sp.total, round2(sp.total));
    const spSum = round2(sp.byMethod.reduce((a, m) => a + m.amount, 0));
    s.money('reports.sellPayments total = sum(byMethod)', sp.total, spSum);
    s.ok('reports.sellPayments method amounts rounded', sp.byMethod.every((m) => Math.abs(m.amount - round2(m.amount)) <= 0.0001));

    // purchasePayments: same shape as sellPayments.
    const ppay = call('reports.purchasePayments', { range }) as {
      byMethod: { method: string; amount: number; cnt: number }[];
      total: number;
    };
    s.ok('reports.purchasePayments has byMethod array', Array.isArray(ppay.byMethod));
    s.gte('reports.purchasePayments total >= 0', ppay.total, 0);
    s.money('reports.purchasePayments total rounded', ppay.total, round2(ppay.total));
    const ppaySum = round2(ppay.byMethod.reduce((a, m) => a + m.amount, 0));
    s.money('reports.purchasePayments total = sum(byMethod)', ppay.total, ppaySum);

    // trending ({ range, metric: 'qty' }): rows of { productId, name, sku, current, previous, deltaPct }
    const tr = call('reports.trending', { range, metric: 'qty' }) as {
      productId: string;
      name: string;
      sku: string;
      current: number;
      previous: number;
      deltaPct: number;
    }[];
    s.ok('reports.trending is array', Array.isArray(tr));
    s.gt('reports.trending has rows', tr.length, 0);
    s.ok('reports.trending respects top-50 cap', tr.length <= 50);
    let trShapeOk = true;
    let trOrderOk = true;
    for (let i = 0; i < tr.length; i++) {
      const r = tr[i];
      if (
        typeof r.productId !== 'string' ||
        typeof r.current !== 'number' ||
        typeof r.previous !== 'number' ||
        typeof r.deltaPct !== 'number'
      ) {
        trShapeOk = false;
      }
      if (i > 0 && tr[i - 1].current < r.current) trOrderOk = false;
    }
    s.ok('reports.trending rows well-shaped', trShapeOk);
    s.ok('reports.trending sorted desc by current', trOrderOk);
    s.gte('reports.trending top current >= 0', tr[0].current, 0);

    // salesRep: rows of { id, name, commissionPct, saleCount, grossSales, returns, netSales, commissionEarned }
    // Seed may have few/no agent_id on sales, so numbers can be 0 — assert shape + non-negativity only.
    const sr = call('reports.salesRep', { range }) as {
      id: string;
      name: string;
      commissionPct: number;
      saleCount: number;
      grossSales: number;
      returns: number;
      netSales: number;
      commissionEarned: number;
    }[];
    s.ok('reports.salesRep is array', Array.isArray(sr));
    let srShapeOk = true;
    let srMoneyOk = true;
    for (const r of sr) {
      if (
        typeof r.id !== 'string' ||
        typeof r.name !== 'string' ||
        typeof r.commissionPct !== 'number' ||
        typeof r.netSales !== 'number'
      ) {
        srShapeOk = false;
      }
      if (
        Math.abs(r.grossSales - round2(r.grossSales)) > 0.0001 ||
        Math.abs(r.commissionEarned - round2(r.commissionEarned)) > 0.0001
      ) {
        srMoneyOk = false;
      }
      if (r.grossSales < 0 || r.netSales < 0) srMoneyOk = false;
    }
    s.ok('reports.salesRep rows well-shaped', srShapeOk);
    s.ok('reports.salesRep money rounded + non-negative', srMoneyOk);

    // customerGroup: rows of { group, saleCount, grossSales, netSales, avgTicket } sorted desc by net.
    const cg = call('reports.customerGroup', { range }) as {
      group: string;
      saleCount: number;
      grossSales: number;
      netSales: number;
      avgTicket: number;
    }[];
    s.ok('reports.customerGroup is array', Array.isArray(cg));
    s.gt('reports.customerGroup has rows', cg.length, 0);
    let cgShapeOk = true;
    let cgOrderOk = true;
    for (let i = 0; i < cg.length; i++) {
      const r = cg[i];
      if (
        typeof r.group !== 'string' ||
        typeof r.saleCount !== 'number' ||
        typeof r.netSales !== 'number' ||
        typeof r.avgTicket !== 'number'
      ) {
        cgShapeOk = false;
      }
      if (i > 0 && cg[i - 1].netSales < r.netSales) cgOrderOk = false;
    }
    s.ok('reports.customerGroup rows well-shaped', cgShapeOk);
    s.ok('reports.customerGroup sorted desc by netSales', cgOrderOk);
    s.gte('reports.customerGroup top netSales >= 0', cg[0].netSales, 0);
    s.money('reports.customerGroup netSales rounded', cg[0].netSales, round2(cg[0].netSales));

    // stock (payload { branchId } only — NO range): { rows:[...], totalValueAtCost, totalValueAtRetail }
    const st = call('reports.stock', { branchId: 'br_mp' }) as {
      rows: {
        id: string;
        name: string;
        sku: string;
        cost: number;
        price: number;
        reorder_level: number;
        stock: number;
        valueAtCost: number;
        valueAtRetail: number;
        state: string;
      }[];
      totalValueAtCost: number;
      totalValueAtRetail: number;
    };
    s.ok('reports.stock has rows array', Array.isArray(st.rows));
    s.gt('reports.stock has rows', st.rows.length, 0);
    s.gte('reports.stock totalValueAtCost >= 0', st.totalValueAtCost, 0);
    s.gte('reports.stock totalValueAtRetail >= 0', st.totalValueAtRetail, 0);
    s.money('reports.stock totalValueAtCost rounded', st.totalValueAtCost, round2(st.totalValueAtCost));
    s.money('reports.stock totalValueAtRetail rounded', st.totalValueAtRetail, round2(st.totalValueAtRetail));
    let stShapeOk = true;
    let stStateOk = true;
    for (const r of st.rows) {
      if (
        typeof r.id !== 'string' ||
        typeof r.sku !== 'string' ||
        typeof r.stock !== 'number' ||
        typeof r.valueAtCost !== 'number'
      ) {
        stShapeOk = false;
      }
      if (!['in', 'low', 'out'].includes(r.state)) stStateOk = false;
      // valueAtCost should equal stock * cost (rounded)
      if (Math.abs(r.valueAtCost - round2(r.stock * r.cost)) > 0.0001) stShapeOk = false;
    }
    s.ok('reports.stock rows well-shaped (valueAtCost = stock*cost)', stShapeOk);
    s.ok('reports.stock state in {in,low,out}', stStateOk);
  }
  s.section('api');

  // global search
  const search = call('search.global', { query: 'cement' }) as { products: unknown[] };
  s.gt('search.global finds products', search.products.length, 0);

  // a write through the API: create a sale, then read it back
  const created = call('sales.create', {
    branchId: 'br_mp',
    userId: 'u_rana',
    lines: [{ productId: 'p1', qty: 1, spr: 520 }],
    payments: [{ method: 'Cash', amount: 520 }],
  }) as { id: string; due: number };
  s.money('api sale created, due 0', created.due, 0);
  const readBack = call('sales.get', { id: created.id }) as { invoice_no: string };
  s.ok('api created sale readable', !!readBack.invoice_no);

  // ----- catalog CRUD round-trip (the Products + Stock slice) -----
  s.section('api-catalog');
  {
    const before = (call('products.list') as unknown[]).length;
    const { id } = call('products.create', {
      sku: 'WIRE-001',
      name: 'Wiring Test Product',
      categoryId: 'c1',
      brandId: 'b8',
      cost: 100,
      price: 160,
      reorderLevel: 5,
      openingStock: 25,
      branchId: 'br_mp',
      userId: 'u_admin',
    }) as { id: string };
    const after = call('products.list', { branchId: 'br_mp' }) as Record<string, unknown>[];
    s.eq('product list grew by 1', after.length, before + 1);
    const row = after.find((p) => p.id === id) as Record<string, unknown> | undefined;
    s.ok('created product present in list', !!row);
    s.money('created product stock on hand', (row?.stock as number) ?? -1, 25);
    s.eq('created product carries category_name', row?.category_name as string, 'Hand Tools');

    // update via API
    call('products.update', { id, patch: { price: 180, name: 'Wiring Test v2' } });
    const detail = call('products.get', { id, branchId: 'br_mp' }) as { price: number; name: string };
    s.money('product price updated via API', detail.price, 180);
    s.eq('product name updated via API', detail.name, 'Wiring Test v2');

    // category + brand create via API
    const cat = call('categories.create', { name: 'Test Cat', emoji: '🧪' }) as { id: string };
    const catList = call('categories.list') as { id: string }[];
    s.ok('category created via API', catList.some((c) => c.id === cat.id));
    const brand = call('brands.create', { name: 'TestBrand' }) as { id: string };
    const brandList = call('brands.list') as { id: string }[];
    s.ok('brand created via API', brandList.some((b) => b.id === brand.id));

    // ----- units CRUD round-trip + delete-guard -----
    // units.create -> units.list contains it -> units.update -> units.delete removes it
    const unit = call('units.create', {
      name: 'Wiring Test Unit',
      short: 'wtu',
      type: 'count',
      toBaseFactor: 1,
    }) as { id: string };
    s.ok('unit created via API', (call('units.list') as { id: string }[]).some((u) => u.id === unit.id));
    call('units.update', { id: unit.id, patch: { name: 'Wiring Test Unit v2', toBaseFactor: 6 } });
    const unitRow = (call('units.list') as { id: string; name: string; to_base_factor: number }[]).find(
      (u) => u.id === unit.id,
    );
    s.eq('unit name updated via API', unitRow?.name ?? '', 'Wiring Test Unit v2');
    s.money('unit to_base_factor updated via API', unitRow?.to_base_factor ?? -1, 6);
    call('units.delete', { id: unit.id });
    s.ok(
      'unit deleted via API',
      !(call('units.list') as { id: string }[]).some((u) => u.id === unit.id),
    );

    // delete-guard: a unit whose `short` is used by a product cannot be deleted
    const guardUnit = call('units.create', { name: 'Guarded Unit', short: 'gdu' }) as { id: string };
    call('products.create', {
      sku: 'WIRE-UNIT-001',
      name: 'Unit Guard Product',
      unit: 'gdu',
      cost: 10,
      price: 20,
    });
    let unitDelBlocked = false;
    try {
      call('units.delete', { id: guardUnit.id });
    } catch {
      unitDelBlocked = true;
    }
    s.ok('api units.delete blocked when a product uses the unit short', unitDelBlocked);
    s.ok(
      'guarded unit still present after blocked delete',
      (call('units.list') as { id: string }[]).some((u) => u.id === guardUnit.id),
    );
  }

  // ----- purchases cancel / delete round-trip (the Purchases backend-wiring slice) -----
  s.section('api-purchases');
  {
    const readStock = (productId: string) =>
      (call('products.get', { id: productId, branchId: 'br_mp' }) as { stock: number }).stock;

    const stockBefore = readStock('p1');

    // create a received purchase via API, then cancel it via API
    const created = call('purchases.create', {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 15, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [{ method: 'Cash', amount: 6000 }],
    }) as { id: string };
    s.money('api purchase raised stock', readStock('p1'), round2(stockBefore + 15));

    call('purchases.cancel', { purchaseId: created.id, userId: 'u_admin', reason: 'api test' });
    const cancelled = call('purchases.get', { id: created.id }) as { status: string };
    s.eq('api purchases.cancel flips status', cancelled.status, 'cancelled');
    s.money('api purchases.cancel reverses stock', readStock('p1'), round2(stockBefore));

    // create an ordered purchase via API, then delete it via API
    const ordered = call('purchases.create', {
      status: 'ordered',
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: 'sp1',
      lines: [{ productId: 'p1', qty: 5, unitCostBeforeDisc: 400, taxPct: 0 }],
      payments: [],
    }) as { id: string };
    call('purchases.delete', { purchaseId: ordered.id });
    s.ok('api purchases.delete removes ordered purchase', !call('purchases.get', { id: ordered.id }));
  }

  // ----- sales create / delete round-trip (the Sales backend-wiring slice) -----
  s.section('api-sales');
  {
    // create a draft via API, then delete it via API — record must be gone
    const draft = call('sales.create', {
      status: 'draft',
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 2, spr: 520 }],
    }) as { id: string };
    s.ok('api draft sale created', !!call('sales.get', { id: draft.id }));
    call('sales.delete', { saleId: draft.id });
    s.ok('api sales.delete removes draft sale', !call('sales.get', { id: draft.id }));

    // a final sale cannot be deleted via the channel — throws + stays present
    const finalSale = call('sales.create', {
      branchId: 'br_mp',
      userId: 'u_rana',
      lines: [{ productId: 'p1', qty: 1, spr: 520 }],
      payments: [{ method: 'Cash', amount: 520 }],
    }) as { id: string };
    let blocked = false;
    try {
      call('sales.delete', { saleId: finalSale.id });
    } catch {
      blocked = true;
    }
    s.ok('api sales.delete blocked for final sale', blocked);
    s.ok('api final sale still present after blocked delete', !!call('sales.get', { id: finalSale.id }));
  }

  // ----- shipments create / list / update round-trip (the Shipments backend slice) -----
  s.section('api-shipments');
  {
    // pick a real sale to link the shipment to
    const sale = (call('sales.list', { limit: 1 }) as { id: string; invoice_no: string }[])[0];

    const beforeCount = (call('shipments.list') as unknown[]).length;
    const created = call('shipments.create', {
      saleId: sale.id,
      branchId: 'br_mp',
      userId: 'u_rana',
      driver: 'Karim',
      vehicleNo: 'DH 11-3344',
      address: 'Uttara Sector 7, Dhaka',
      targetDate: '2026-05-27',
      notes: 'api shipment',
    }) as { id: string; refNo: string };
    s.ok('api shipments.create returns a SHP ref', /^SHP-\d{4}-\d{4}$/.test(created.refNo));

    // appears in shipments.list, linked to the sale + status default pending
    const list = call('shipments.list') as {
      id: string;
      sale_id: string;
      sale_invoice_no: string;
      status: string;
      delivered_at: string | null;
    }[];
    s.eq('api shipments list grew by 1', list.length, beforeCount + 1);
    const row = list.find((r) => r.id === created.id);
    s.ok('api created shipment present in list', !!row);
    s.eq('api shipment linked to sale', row?.sale_id ?? '', sale.id);
    s.eq('api shipment resolves sale invoice no', row?.sale_invoice_no ?? '', sale.invoice_no);
    s.eq('api shipment default status pending', row?.status ?? '', 'pending');
    s.ok('api shipment delivered_at null while pending', row?.delivered_at == null);

    // update status -> delivered is reflected + stamps delivered_at
    call('shipments.update', { id: created.id, patch: { status: 'delivered' } });
    const after = (call('shipments.list') as { id: string; status: string; delivered_at: string | null }[]).find(
      (r) => r.id === created.id,
    );
    s.eq('api shipment status reflected as delivered', after?.status ?? '', 'delivered');
    s.ok('api shipment delivered_at stamped on delivery', !!after?.delivered_at);

    // delete removes it
    call('shipments.delete', { id: created.id });
    s.ok(
      'api shipments.delete removes the shipment',
      !(call('shipments.list') as { id: string }[]).some((r) => r.id === created.id),
    );
  }

  // ----- contacts CRUD + supplier pay round-trip (the Contacts backend slice) -----
  s.section('api-contacts');
  {
    // customers.create -> customers.update -> present in customers.list
    const beforeCust = (call('customers.list') as unknown[]).length;
    const cust = call('customers.create', {
      name: 'API Customer',
      phone: '01700112233',
      group: 'Retail',
      userId: 'u_admin',
    }) as { id: string };
    call('customers.update', { id: cust.id, patch: { name: 'API Customer v2', creditLimit: 5000 } });
    const custList = call('customers.list') as Record<string, unknown>[];
    s.eq('customer list grew by 1', custList.length, beforeCust + 1);
    const custRow = custList.find((c) => c.id === cust.id) as Record<string, unknown> | undefined;
    s.ok('created customer present in list', !!custRow);
    s.eq('customer name updated via API', custRow?.name as string, 'API Customer v2');

    // suppliers.create -> suppliers.pay round-trip: due drops by paid amount
    const sup = call('suppliers.create', {
      name: 'API Supplier',
      company: 'API Co',
      phone: '01800112233',
      userId: 'u_admin',
    }) as { id: string };
    // give the supplier an open credit purchase
    call('purchases.create', {
      branchId: 'br_mp',
      userId: 'u_admin',
      supplierId: sup.id,
      lines: [{ productId: 'p1', qty: 10, unitCostBeforeDisc: 400, taxPct: 0 }], // total 4000
      payments: [],
    });
    const supBefore = call('suppliers.get', { id: sup.id }) as { due: number };
    s.money('supplier due before pay', supBefore.due, 4000);
    const pay = call('suppliers.pay', {
      supplierId: sup.id,
      amount: 2500,
      method: 'Bank',
      userId: 'u_admin',
      branchId: 'br_mp',
    }) as { allocated: number; remainder: number };
    s.money('api suppliers.pay allocated', pay.allocated, 2500);
    const supAfter = call('suppliers.get', { id: sup.id }) as { due: number };
    s.money('api supplier due dropped by paid amount', supAfter.due, round2(supBefore.due - 2500));

    // deleting a referenced contact throws
    let supDelBlocked = false;
    try {
      call('suppliers.delete', { id: sup.id });
    } catch {
      supDelBlocked = true;
    }
    s.ok('api suppliers.delete blocked for referenced supplier', supDelBlocked);
  }

  // ----- cash shift / drawer round-trip (the Cash Register backend slice) -----
  s.section('api-cash');
  {
    // Robust to seeded data: pick a branch with no open shift; if every branch
    // already has one open, close one first so cash.openShift won't throw.
    const branches = ['br_ut', 'br_mp', 'br_dh'];
    let branchId = branches.find((b) => !call('cash.openShiftFor', { branchId: b }));
    if (!branchId) {
      const open = call('cash.openShiftFor', { branchId: branches[0] }) as { id: string };
      call('cash.closeShift', { shiftId: open.id, countedCash: 0 });
      branchId = branches[0];
    }

    const opening = 5000;
    const shiftId = call('cash.openShift', {
      branchId,
      userId: 'u_admin',
      openingCash: opening,
    }) as string;
    s.ok('api cash.openShift returns id', typeof shiftId === 'string' && shiftId.length > 0);

    // a manual cash-in and a manual cash-out
    call('cash.move', {
      shiftId,
      branchId,
      direction: 'in',
      reason: 'manual_in',
      amount: 1500,
      userId: 'u_admin',
    });
    call('cash.move', {
      shiftId,
      branchId,
      direction: 'out',
      reason: 'manual_out',
      amount: 400,
      userId: 'u_admin',
    });

    const totals = call('cash.shiftTotals', { shiftId }) as {
      cashIn: number;
      cashOut: number;
      expected: number;
    };
    s.money('api shift cashIn (excludes opening)', totals.cashIn, 1500);
    s.money('api shift cashOut', totals.cashOut, 400);
    // expected = opening + in - out = 5000 + 1500 - 400 = 6100
    s.money('api shift expected = opening + in - out', totals.expected, round2(opening + 1500 - 400));

    // close with a deliberate +100 variance
    const counted = round2(totals.expected + 100);
    const close = call('cash.closeShift', { shiftId, countedCash: counted }) as {
      expected: number;
      counted: number;
      variance: number;
    };
    s.money('api close variance = counted - expected', close.variance, round2(counted - totals.expected));

    // shift status flips to 'closed' and the branch has no open shift left
    const row = (call('shifts.list', {}) as { id: string; status: string }[]).find(
      (r) => r.id === shiftId,
    );
    s.eq('api closed shift status flips to closed', row?.status ?? 'missing', 'closed');
    s.ok('api no open shift on branch after close', !call('cash.openShiftFor', { branchId }));
  }

  // ----- expenses CRUD + void round-trip (the Expenses backend slice) -----
  s.section('api-expenses');
  {
    // expenseCategories.create -> present in expenseCategories.list
    const cat = call('expenseCategories.create', {
      name: 'API Expense Cat',
      emoji: '🧪',
      monthlyBudget: 4000,
    }) as { id: string };
    const catList = call('expenseCategories.list') as { id: string }[];
    s.ok('expense category created via API', catList.some((c) => c.id === cat.id));

    // expenses.create (Cash) -> expenses.update (amount change) -> read back
    const created = call('expenses.create', {
      branchId: 'br_mp',
      userId: 'u_admin',
      amount: 900,
      paymentMethod: 'Cash',
      categoryId: cat.id,
      note: 'api expense',
    }) as { id: string };
    s.ok('api expense present before void', (call('expenses.list') as { id: string }[]).some((e) => e.id === created.id));

    call('expenses.update', { id: created.id, patch: { amount: 1250 } });
    const updatedRow = (call('expenses.list') as { id: string; amount: number }[]).find(
      (e) => e.id === created.id,
    );
    s.money('api expense amount updated', updatedRow?.amount ?? -1, 1250);

    // expenses.void -> voided rows drop out of expenses.list (it filters voided=0)
    call('expenses.void', { id: created.id, reason: 'api void', userId: 'u_admin' });
    s.ok(
      'api voided expense dropped from list',
      !(call('expenses.list') as { id: string }[]).some((e) => e.id === created.id),
    );

    // expenseCategories.delete -> gone from list
    call('expenseCategories.delete', { id: cat.id });
    s.ok(
      'api expense category deleted',
      !(call('expenseCategories.list') as { id: string }[]).some((c) => c.id === cat.id),
    );
  }

  // ----- settings CRUD round-trip (the Settings backend slice) -----
  s.section('api-settings');
  {
    // business.update -> business.get reflects the change
    call('business.update', { name: 'Updated Shop Name', email: 'api@shop.local' });
    const biz = call('business.get') as { name: string; email: string };
    s.eq('api business.update reflected in business.get', biz.name, 'Updated Shop Name');
    s.eq('api business email updated', biz.email, 'api@shop.local');

    // branches.create -> setDefault -> list shows exactly one default
    const newBranch = call('branches.create', { name: 'API Branch', code: 'API01' }) as { id: string };
    call('branches.setDefault', { id: newBranch.id });
    const branches = call('branches.list') as { id: string; is_default: number }[];
    const defaults = branches.filter((b) => b.is_default === 1);
    s.eq('api exactly one default branch', defaults.length, 1);
    s.eq('api new branch is default', defaults[0].id, newBranch.id);

    // taxRates.create -> present in list
    const beforeTax = (call('taxRates.list') as unknown[]).length;
    const tax = call('taxRates.create', { name: 'API VAT', percentage: 9 }) as { id: string };
    const taxList = call('taxRates.list') as { id: string }[];
    s.eq('api tax list grew by 1', taxList.length, beforeTax + 1);
    s.ok('api created tax present', taxList.some((t) => t.id === tax.id));

    // users.create -> list (no hash leaked) -> roles.update
    const user = call('users.create', {
      name: 'API User',
      username: 'apiuser',
      pin: '5555',
      roleId: 'role_cashier',
      branchIds: ['br_mp'],
    }) as { id: string };
    const userList = call('users.list') as Record<string, unknown>[];
    const userRow = userList.find((u) => u.id === user.id) as Record<string, unknown> | undefined;
    s.ok('api created user present in list', !!userRow);
    s.ok('api users.list does not leak pin_hash', userRow ? !('pin_hash' in userRow) : false);
    s.ok('api users.list does not leak password_hash', userRow ? !('password_hash' in userRow) : false);

    const role = call('roles.create', { name: 'API Role', permissions: ['reports.view'] }) as { id: string };
    call('roles.update', { id: role.id, patch: { permissions: ['reports.view', 'reports.export'] } });
    const roleRow = (call('roles.list') as { id: string; permissions: string }[]).find((r) => r.id === role.id);
    s.eq('api role permissions updated', roleRow?.permissions ?? '', JSON.stringify(['reports.view', 'reports.export']));

    // agents.create -> agents.list
    const beforeAgents = (call('agents.list') as unknown[]).length;
    const agent = call('agents.create', { name: 'API Agent', commissionPct: 2.5 }) as { id: string };
    const agentList = call('agents.list') as { id: string }[];
    s.eq('api agent list grew by 1', agentList.length, beforeAgents + 1);
    s.ok('api created agent present', agentList.some((a) => a.id === agent.id));

    // settings.set / settings.get round-trip a JSON blob, plus settings.getAll
    call('settings.set', { key: 'receipt', value: { paperSize: '58mm', showLogo: false } });
    const receipt = call('settings.get', { key: 'receipt' }) as { paperSize: string; showLogo: boolean };
    s.eq('api settings round-trip paperSize', receipt.paperSize, '58mm');
    s.ok('api settings round-trip showLogo', receipt.showLogo === false);
    s.ok('api settings.get absent key returns null', call('settings.get', { key: 'no_such_key' }) === null);
    const allSettings = call('settings.getAll') as Record<string, unknown>;
    s.ok('api settings.getAll has the set key', 'receipt' in allSettings);
  }

  // ----- stock transfers + adjustments round-trip (the Stock Ops backend slice) -----
  s.section('api-stockops');
  {
    const readStock = (productId: string, branchId: string) =>
      (call('products.get', { id: productId, branchId }) as { stock: number }).stock;

    // ---- transfer: create (in-transit) dispatches stock-out at source ----
    const srcBefore = readStock('p1', 'br_mp');
    const dstBefore = readStock('p1', 'br_ut');
    const transfer = call('transfers.create', {
      fromBranch: 'br_mp',
      toBranch: 'br_ut',
      status: 'in-transit',
      lines: [{ productId: 'p1', qty: 12 }],
      createdBy: 'u_admin',
    }) as { id: string };
    s.money('api transfer dispatch reduces source', readStock('p1', 'br_mp'), round2(srcBefore - 12));
    s.money('api transfer in-transit does not raise destination yet', readStock('p1', 'br_ut'), dstBefore);

    // it appears in transfers.list with nested lines
    const tList = call('transfers.list') as {
      id: string;
      status: string;
      from_branch: string;
      to_branch: string;
      lines: { product_id: string; qty: number }[];
    }[];
    const tRow = tList.find((t) => t.id === transfer.id);
    s.ok('api created transfer present in transfers.list', !!tRow);
    s.eq('api transfer carries branch IDs (from)', tRow?.from_branch ?? '', 'br_mp');
    s.eq('api transfer carries branch IDs (to)', tRow?.to_branch ?? '', 'br_ut');
    s.gt('api transfer list row has lines', tRow?.lines.length ?? 0, 0);

    // ---- transfer: receive raises destination + flips status ----
    call('transfers.receive', {
      transferId: transfer.id,
      received: [{ productId: 'p1', receivedQty: 12 }],
      userId: 'u_faruq',
      note: 'all received',
    });
    s.money('api transfer receive raises destination', readStock('p1', 'br_ut'), round2(dstBefore + 12));
    const receivedRow = (call('transfers.list') as { id: string; status: string }[]).find(
      (t) => t.id === transfer.id,
    );
    s.eq('api transfer status flips to received', receivedRow?.status ?? '', 'received');
    // conservation: total across the two branches unchanged by the move
    s.money(
      'api transfer conserves total stock across branches',
      round2(readStock('p1', 'br_mp') + readStock('p1', 'br_ut')),
      round2(srcBefore + dstBefore),
    );

    // ---- adjustment: damage with signed -qty reduces stock ----
    const adjBefore = readStock('p1', 'br_mp');
    const adjustment = call('adjustments.create', {
      branchId: 'br_mp',
      type: 'damage',
      reason: 'api test damage',
      lines: [{ productId: 'p1', qty: -4 }],
      createdBy: 'u_admin',
    }) as { id: string };
    s.money('api damage adjustment reduces stock', readStock('p1', 'br_mp'), round2(adjBefore - 4));

    const aList = call('adjustments.list') as {
      id: string;
      branch_id: string;
      type: string;
      lines: { product_id: string; qty: number }[];
    }[];
    const aRow = aList.find((a) => a.id === adjustment.id);
    s.ok('api created adjustment present in adjustments.list', !!aRow);
    s.eq('api adjustment carries branch ID', aRow?.branch_id ?? '', 'br_mp');
    s.eq('api adjustment type persisted', aRow?.type ?? '', 'damage');
    s.eq('api adjustment line qty stays signed', aRow?.lines[0]?.qty ?? 0, -4);
  }

  // ----- auth channels round-trip (the Auth backend slice) -----
  // NOTE: IPC-layer permission ENFORCEMENT (session + CHANNEL_PERMISSIONS gate in
  // electron/ipc.ts) is Electron-only and NOT reachable from this Node harness.
  // Here we only verify the pure auth.* handlers that buildApi() exposes.
  s.section('api-auth');
  {
    // seed stores demo pins as bcrypt hashes — auth.authenticate verifies them.
    const okAuth = call('auth.authenticate', { mode: 'pin', userId: 'u_admin', secret: '1234' }) as {
      ok: boolean;
      user?: Record<string, unknown>;
      permissions?: string[];
    };
    s.ok('auth.authenticate pin ok', okAuth.ok === true);
    s.ok('auth.authenticate returns a user', !!okAuth.user);
    s.ok('auth.authenticate user has NO pin_hash', okAuth.user ? !('pin_hash' in okAuth.user) : false);
    s.ok('auth.authenticate user has NO password_hash', okAuth.user ? !('password_hash' in okAuth.user) : false);
    s.ok('auth.authenticate returns permissions array', Array.isArray(okAuth.permissions));
    s.gt('auth.authenticate admin has permissions', (okAuth.permissions ?? []).length, 0);
    s.ok('auth.authenticate permissions include sales.create', (okAuth.permissions ?? []).includes('sales.create'));

    // wrong secret → ok:false (handler returns structured failure, does not throw)
    const badAuth = call('auth.authenticate', { mode: 'pin', userId: 'u_admin', secret: '0000' }) as {
      ok: boolean;
      error?: string;
    };
    s.ok('auth.authenticate wrong pin → ok:false', badAuth.ok === false);
    s.ok('auth.authenticate wrong pin has error', !!badAuth.error);

    // auth.verifyPin boolean round-trip
    s.ok('auth.verifyPin true for correct pin', call('auth.verifyPin', { userId: 'u_admin', pin: '1234' }) === true);
    s.ok('auth.verifyPin false for wrong pin', call('auth.verifyPin', { userId: 'u_admin', pin: '0000' }) === false);

    // auth.setSecret stores a bcrypt hash that authenticate then accepts
    call('auth.setSecret', { userId: 'u_faruq', pin: '7788' });
    const reAuth = call('auth.authenticate', { mode: 'pin', userId: 'u_faruq', secret: '7788' }) as { ok: boolean };
    s.ok('auth.setSecret new pin authenticates', reAuth.ok === true);
  }

  // ----- first-run setup channels (the run-once bootstrap write-through) -----
  // Uses a SEPARATE fresh seedMaster db so it does not collide with the shared
  // simulated `db` (which already has business_info and would be re-completed).
  s.section('api-setup');
  {
    const setupDb = openDatabase(':memory:');
    migrate(setupDb);
    seedMaster(setupDb);
    const setupCall = (ch: string, payload: unknown = {}) => api[ch](setupDb, payload);

    // status false before running
    s.ok('api setup.status false before setup', (setupCall('setup.status') as { complete: boolean }).complete === false);

    // setup.complete returns the sanitized owner + permissions
    const res = setupCall('setup.complete', {
      shop: { name: 'API Setup Shop', currencySymbol: '৳' },
      defaultTaxId: 'tx_5',
      branch: { name: 'API Setup Branch' },
      admin: { name: 'API Owner', username: 'APIOwner', pin: '135790' },
      printer: null,
      cloud: false,
    }) as { ok: boolean; adminUserId: string; user: Record<string, unknown>; permissions: string[] };
    s.ok('api setup.complete ok', res.ok === true);
    s.eq('api setup.complete owner is u_admin', res.adminUserId, 'u_admin');
    s.ok('api setup.complete user has NO pin_hash', !('pin_hash' in res.user));
    s.gt('api setup.complete returns permissions', res.permissions.length, 0);

    // status true after running
    s.ok('api setup.status true after setup', (setupCall('setup.status') as { complete: boolean }).complete === true);

    // business + admin actually persisted through the channel
    const biz = setupCall('business.get') as { name: string };
    s.eq('api setup persisted business name', biz.name, 'API Setup Shop');
    s.ok(
      'api setup admin authenticates with new pin',
      (setupCall('auth.authenticate', { mode: 'pin', userId: 'u_admin', secret: '135790' }) as { ok: boolean }).ok === true,
    );

    // second setup.complete errors (run-once / self-disabling)
    let secondBlocked = false;
    try {
      setupCall('setup.complete', {
        shop: { name: 'Replay' },
        branch: { name: 'Replay Branch' },
        admin: { name: 'Replay', username: 'replay', pin: '000000' },
      });
    } catch (e) {
      secondBlocked = (e as Error).message === 'Setup already completed';
    }
    s.ok('api second setup.complete throws "Setup already completed"', secondBlocked);
    setupDb.close();
  }

  // ----- master data: warranties + price groups CRUD (the last master-data slice) -----
  s.section('api-masterdata');
  {
    // warranties.create -> list -> update -> delete
    const beforeW = (call('warranties.list') as unknown[]).length;
    const w = call('warranties.create', {
      name: 'API 1Y Warranty',
      durationMonths: 12,
      description: 'api-created',
    }) as { id: string };
    const wList = call('warranties.list') as { id: string; name: string; duration_months: number }[];
    s.eq('api warranty list grew by 1', wList.length, beforeW + 1);
    const wRow = wList.find((x) => x.id === w.id);
    s.ok('api created warranty present in list', !!wRow);
    s.eq('api warranty duration persisted', wRow?.duration_months ?? -1, 12);

    call('warranties.update', { id: w.id, patch: { name: 'API 2Y Warranty', durationMonths: 24 } });
    const wRow2 = (call('warranties.list') as { id: string; name: string; duration_months: number }[]).find(
      (x) => x.id === w.id,
    );
    s.eq('api warranty name updated', wRow2?.name ?? '', 'API 2Y Warranty');
    s.eq('api warranty duration updated', wRow2?.duration_months ?? -1, 24);

    call('warranties.delete', { id: w.id });
    s.ok(
      'api warranty deleted',
      !(call('warranties.list') as { id: string }[]).some((x) => x.id === w.id),
    );

    // priceGroups.create -> list (default-first ordering) -> delete-guards
    const beforePg = (call('priceGroups.list') as unknown[]).length;
    const pg = call('priceGroups.create', {
      name: 'API VIP',
      notes: 'api group',
      defaultCreditLimit: 25000,
      defaultDiscountPct: 5,
      taxExempt: true,
    }) as { id: string };
    const pgList = call('priceGroups.list') as {
      id: string;
      name: string;
      is_default: number;
      default_credit_limit: number | null;
      tax_exempt: number;
    }[];
    s.eq('api price group list grew by 1', pgList.length, beforePg + 1);
    const pgRow = pgList.find((x) => x.id === pg.id);
    s.ok('api created price group present', !!pgRow);
    s.money('api price group credit limit persisted', pgRow?.default_credit_limit ?? -1, 25000);
    s.eq('api price group tax exempt persisted', pgRow?.tax_exempt ?? -1, 1);
    s.eq('api priceGroups.list orders default first', pgList[0].is_default, 1);

    // delete-guard: the default group cannot be deleted
    const defaultGroup = (call('priceGroups.list') as { id: string; is_default: number }[]).find(
      (x) => x.is_default === 1,
    )!;
    let defaultBlocked = false;
    try {
      call('priceGroups.delete', { id: defaultGroup.id });
    } catch {
      defaultBlocked = true;
    }
    s.ok('api priceGroups.delete blocked for default group', defaultBlocked);

    // a non-default, unreferenced group (our API VIP) deletes cleanly
    call('priceGroups.delete', { id: pg.id });
    s.ok(
      'api unreferenced price group deleted',
      !(call('priceGroups.list') as { id: string }[]).some((x) => x.id === pg.id),
    );
  }

  // every channel is registered + callable (smoke: just that handler exists)
  let missing = 0;
  for (const ch of API_CHANNELS) if (typeof api[ch] !== 'function') missing++;
  s.eq('all channels are functions', missing, 0);

  const rep = s.report();
  console.log(`API: ${rep.passed}/${rep.total} passed (${API_CHANNELS.length} channels registered)`);
  if (rep.failed > 0) {
    for (const f of rep.failures) console.log(`   - ${f.name}: ${f.detail ?? ''}`);
    db.close();
    process.exit(1);
  }
  console.log('✅ API FACADE OK');
  db.close();
}

main();
