import type { DB } from '../db/connection.ts';
import { hashSecret } from '../services/auth.ts';

/**
 * Seeds all master/reference data: business, branches, roles, users, agents,
 * tax rates, invoice schemes, catalog (categories/brands/units/warranties/price
 * groups), products, customers, suppliers, expense categories.
 *
 * Deterministic IDs so the verification harness can reference them.
 */

const PERMISSIONS_ALL = [
  'pos.use','pos.discount','pos.priceOverride','pos.holdCart','pos.reprint',
  'sales.view','sales.create','sales.edit','sales.void','sales.return','sales.payment','sales.import',
  'purchases.view','purchases.create','purchases.edit','purchases.return','purchases.payBill',
  'products.view','products.create','products.edit','products.delete','products.bulkPrice',
  'stock.view','stock.transfer','stock.adjustment',
  'contacts.viewCustomers','contacts.editCustomers','contacts.viewSuppliers','contacts.editSuppliers',
  'expenses.view','expenses.create','expenses.delete',
  'cash.openShift','cash.closeShift','cash.move','cash.zReport',
  'reports.view','reports.export',
  'settings.business','settings.users','settings.roles','settings.devices','settings.backup',
];

export interface SeededMaster {
  branchIds: string[];
  userIds: string[];
  productIds: string[];
  customerIds: string[];
  supplierIds: string[];
  agentIds: string[];
  expenseCategoryIds: string[];
}

export interface SeedMasterOptions {
  /**
   * REFERENCE-ONLY MODE — used for a real (packaged/clean) first install.
   *
   * Seeds only what a shop genuinely needs before it starts trading: business
   * row, ONE branch, roles, ONE owner account, tax rates, invoice schemes,
   * categories/brands/units/warranties/price groups, expense categories and the
   * Walk-in customer.
   *
   * It deliberately SKIPS the sample product catalogue, sample customers,
   * suppliers, extra staff accounts and commission agents — those are fixtures
   * for the verification harness and the demo simulation, and shipping them
   * would put invented data in a real shop's database.
   *
   * Default `false` keeps the harness fixture byte-identical.
   */
  referenceOnly?: boolean;
}

export function seedMaster(db: DB, opts: SeedMasterOptions = {}): SeededMaster {
  const referenceOnly = opts.referenceOnly === true;
  const now = new Date().toISOString();

  // ---- Business ----
  // Reference-only installs write an EMPTY identity: the shop name, address and
  // phone print on real receipts, so a placeholder here would ship as the
  // customer's own details. The first-run wizard fills these in.
  if (referenceOnly) {
    db.prepare(
      `INSERT OR REPLACE INTO business_info (id, name, tagline, address, phone_primary, currency_symbol, default_branch_id)
       VALUES (1, '', '', '', '', '৳', 'br_mp')`,
    ).run();
  } else {
    db.prepare(
      `INSERT OR REPLACE INTO business_info (id, name, tagline, address, phone_primary, currency_symbol, default_branch_id)
       VALUES (1, 'Hardware POS', 'Built for the shop floor', 'Mirpur 10, Dhaka', '01711-000001', '৳', 'br_mp')`,
    ).run();
  }

  // ---- Branches ----
  // One neutral branch for a real install (the wizard renames it); the extra
  // branches exist so the harness can exercise transfers between branches.
  const branches = referenceOnly
    ? [{ id: 'br_mp', name: 'Main Branch', code: 'BL0001', def: 1, active: 1, mgr: null as string | null }]
    : [
        { id: 'br_mp', name: 'Mirpur Branch', code: 'BL0001', def: 1, active: 1, mgr: 'Seam' as string | null },
        { id: 'br_ut', name: 'Uttara Branch', code: 'BL0002', def: 0, active: 1, mgr: 'Faruq' as string | null },
        { id: 'br_dh', name: 'Dhanmondi Branch', code: 'BL0003', def: 0, active: 0, mgr: null as string | null },
      ];
  const brStmt = db.prepare(
    'INSERT INTO branches (id, name, code, is_default, active, manager, created_at) VALUES (?,?,?,?,?,?,?)',
  );
  for (const b of branches) brStmt.run(b.id, b.name, b.code, b.def, b.active, b.mgr, now);

  // ---- Roles ----
  const roles = [
    { id: 'role_admin', name: 'Admin', perms: PERMISSIONS_ALL },
    {
      id: 'role_manager',
      name: 'Manager',
      // Everything except the four owner-only powers:
      //  settings.users / settings.roles — who can use the shop's till
      //  settings.backup                 — where the shop's data is copied to
      //  products.delete                 — irreversible removal from the catalogue
      //  sales.edit                      — rewriting an invoice that has already
      //                                    taken money and moved stock
      // Any of these can be granted per-role in Settings → Roles.
      perms: PERMISSIONS_ALL.filter(
        (p) =>
          !['settings.users', 'settings.roles', 'settings.backup', 'products.delete', 'sales.edit'].includes(
            p,
          ),
      ),
    },
    {
      id: 'role_cashier',
      name: 'Cashier',
      perms: ['pos.use','pos.holdCart','pos.reprint','sales.view','sales.create','sales.return','sales.payment','products.view','stock.view','contacts.viewCustomers','contacts.editCustomers','cash.openShift','cash.closeShift','cash.move','cash.zReport'],
    },
    {
      id: 'role_stock',
      name: 'Stock Keeper',
      perms: ['products.view','products.create','products.edit','stock.view','stock.transfer','stock.adjustment','purchases.view','purchases.create','contacts.viewSuppliers'],
    },
  ];
  const roleStmt = db.prepare('INSERT INTO roles (id, name, is_system, permissions) VALUES (?,?,1,?)');
  for (const r of roles) roleStmt.run(r.id, r.name, JSON.stringify(r.perms));

  // ---- Users ----
  // Reference-only installs get JUST the owner account; the first-run wizard
  // immediately renames it and replaces the PIN, so no shipped credential
  // survives setup. The extra staff accounts exist only as harness fixtures.
  const allUsers = [
    { id: 'u_admin', name: 'Seam', username: 'seam', pin: '1234', role: 'role_admin', branches: [] as string[] },
    { id: 'u_faruq', name: 'Faruq Hossain', username: 'faruq', pin: '4321', role: 'role_manager', branches: ['br_ut'] },
    { id: 'u_rana', name: 'Rana Ahmed', username: 'rana', pin: '1111', role: 'role_cashier', branches: ['br_mp'] },
    { id: 'u_rashed', name: 'Rashed Khan', username: 'rashed', pin: '2222', role: 'role_stock', branches: ['br_mp', 'br_ut'] },
  ];
  // A real install gets ONE neutral owner account (the wizard renames it and
  // sets the real PIN immediately). The demo/harness fixture keeps its exact
  // original identities — `backend/verify/scenarios.ts` pins the 'seam' login.
  const users = referenceOnly
    ? [{ ...allUsers[0], name: 'Owner', username: 'owner' }]
    : allUsers;
  const userStmt = db.prepare(
    'INSERT INTO users (id, name, username, pin_hash, role_id, branch_ids, status, created_at) VALUES (?,?,?,?,?,?,?,?)',
  );
  // Demo PINs keep their familiar values (Seam 1234, etc.) but are stored as
  // bcrypt hashes so login verifies against the hash like a real deployment.
  for (const u of users)
    userStmt.run(u.id, u.name, u.username, hashSecret(u.pin), u.role, JSON.stringify(u.branches), 'active', now);

  // ---- Commission agents (harness fixture only) ----
  const agents = referenceOnly
    ? []
    : [
        { id: 'ag_1', name: 'Hassan (Field)', pct: 2 },
        { id: 'ag_2', name: 'Jamal (Contractor)', pct: 1.5 },
      ];
  const agentStmt = db.prepare('INSERT INTO commission_agents (id, name, commission_pct, active) VALUES (?,?,?,1)');
  for (const a of agents) agentStmt.run(a.id, a.name, a.pct);

  // ---- Tax rates ----
  const taxes = [
    { id: 'tx_15', name: 'VAT 15%', pct: 15, def: 0 },
    { id: 'tx_5', name: 'VAT 5%', pct: 5, def: 0 },
    { id: 'tx_0', name: 'No Tax', pct: 0, def: 1 },
  ];
  const taxStmt = db.prepare('INSERT INTO tax_rates (id, name, percentage, is_default, scope, active) VALUES (?,?,?,?,?,1)');
  for (const t of taxes) taxStmt.run(t.id, t.name, t.pct, t.def, 'all');

  // ---- Invoice schemes (default per doc type) ----
  const schemes = [
    { id: 'sch_sale', doc: 'sale', prefix: 'INV' },
    { id: 'sch_pos', doc: 'pos', prefix: 'POS' },
    { id: 'sch_qtn', doc: 'quotation', prefix: 'QTN' },
    { id: 'sch_drf', doc: 'draft', prefix: 'DRF' },
    { id: 'sch_po', doc: 'purchase', prefix: 'PO' },
    { id: 'sch_rtn', doc: 'return', prefix: 'RTN' },
    { id: 'sch_prtn', doc: 'purchase_return', prefix: 'PRTN' },
    { id: 'sch_shp', doc: 'shipment', prefix: 'SHP' },
    { id: 'sch_trf', doc: 'transfer', prefix: 'TRF' },
    { id: 'sch_adj', doc: 'adjustment', prefix: 'ADJ' },
    { id: 'sch_exp', doc: 'expense', prefix: 'EXP' },
  ];
  const schemeStmt = db.prepare(
    `INSERT INTO invoice_schemes (id, name, doc_type, prefix, year_format, separator, counter_padding, reset_rule, start_number, current_counter, is_default)
     VALUES (?,?,?,?,'YYYY','-',4,'yearly',1,0,1)`,
  );
  for (const s of schemes) schemeStmt.run(s.id, `Default ${s.prefix}`, s.doc, s.prefix);

  // ---- Catalog ----
  const categories = [
    { id: 'cat_none', name: 'Uncategorized', emoji: '📦' },
    { id: 'c1', name: 'Hand Tools', emoji: '🔨' },
    { id: 'c2', name: 'Power Tools', emoji: '🪚' },
    { id: 'c3', name: 'Plumbing', emoji: '🚰' },
    { id: 'c4', name: 'Electrical', emoji: '💡' },
    { id: 'c5', name: 'Paint & Finish', emoji: '🎨' },
    { id: 'c6', name: 'Fasteners', emoji: '🔩' },
    { id: 'c7', name: 'Building Material', emoji: '🧱' },
    { id: 'c8', name: 'Safety', emoji: '⛑️' },
  ];
  const catStmt = db.prepare('INSERT INTO categories (id, name, emoji) VALUES (?,?,?)');
  for (const c of categories) catStmt.run(c.id, c.name, c.emoji);

  const brands = ['No Brand', 'Bosch', 'Makita', 'Stanley', 'RFL', 'Berger', 'BSRM', 'Walton', 'Generic'];
  const brandStmt = db.prepare('INSERT INTO brands (id, name) VALUES (?,?)');
  brands.forEach((b, i) => brandStmt.run(i === 0 ? 'b_none' : `b${i}`, b));

  const units = [
    { id: 'u1', name: 'Pieces', short: 'pc', type: 'count', f: 1 },
    { id: 'u2', name: 'Box', short: 'box', type: 'pack', f: 1 },
    { id: 'u3', name: 'Dozen', short: 'dz', type: 'count', f: 12 },
    { id: 'u4', name: 'Kilogram', short: 'kg', type: 'weight', f: 1 },
    { id: 'u5', name: 'Meter', short: 'm', type: 'length', f: 1 },
    { id: 'u6', name: 'Liter', short: 'L', type: 'volume', f: 1 },
    { id: 'u7', name: 'Bag', short: 'bag', type: 'pack', f: 1 },
  ];
  const unitStmt = db.prepare('INSERT INTO units (id, name, short, type, to_base_factor) VALUES (?,?,?,?,?)');
  for (const u of units) unitStmt.run(u.id, u.name, u.short, u.type, u.f);

  const priceGroups = [
    { id: 'pg_retail', name: 'Retail', def: 1 },
    { id: 'pg_wholesale', name: 'Wholesale', def: 0 },
    { id: 'pg_contractor', name: 'Contractor', def: 0 },
  ];
  const pgStmt = db.prepare('INSERT INTO price_groups (id, name, is_default) VALUES (?,?,?)');
  for (const g of priceGroups) pgStmt.run(g.id, g.name, g.def);

  // ---- Products ----
  // [sku, name, catId, brandId, unit, cost, price, wholesale, contractor, reorder]
  const products: [string, string, string, string, string, number, number, number, number, number][] = [
    ['HT-CLW-16', 'Claw Hammer 16oz', 'c1', 'b3', 'pc', 380, 520, 470, 490, 10],
    ['HT-WRN-SET', 'Wrench Set 8pc', 'c1', 'b3', 'box', 850, 1150, 1050, 1090, 6],
    ['HT-SCRD-6', 'Screwdriver Set 6pc', 'c1', 'b8', 'box', 220, 340, 300, 320, 12],
    ['PT-DRL-13', 'Cordless Drill 13mm', 'c2', 'b1', 'pc', 6800, 8500, 7900, 8100, 5],
    ['PT-GRD-100', 'Angle Grinder 4"', 'c2', 'b2', 'pc', 4200, 5400, 5000, 5150, 5],
    ['PT-SAW-CIRC', 'Circular Saw 7"', 'c2', 'b1', 'pc', 7200, 9200, 8600, 8900, 4],
    ['PL-PIPE-PVC-1', 'PVC Pipe 1" x 20ft', 'c3', 'b4', 'pc', 320, 420, 380, 400, 30],
    ['PL-ELB-1', 'PVC Elbow 1"', 'c3', 'b4', 'pc', 12, 22, 18, 20, 100],
    ['PL-TAP-BIB', 'Bib Tap Brass', 'c3', 'b8', 'pc', 180, 290, 260, 275, 25],
    ['EL-WIRE-25', 'Electric Wire 2.5mm (90m)', 'c4', 'b7', 'box', 4200, 5100, 4800, 4950, 8],
    ['EL-SW-1G', '1-Gang Switch', 'c4', 'b7', 'pc', 45, 80, 70, 75, 60],
    ['EL-MCB-32', 'MCB 32A', 'c4', 'b7', 'pc', 220, 340, 310, 325, 20],
    ['PN-WHITE-1L', 'Weather Coat White 1L', 'c5', 'b5', 'pc', 480, 640, 590, 615, 20],
    ['PN-WHITE-4L', 'Weather Coat White 4L', 'c5', 'b5', 'pc', 1750, 2200, 2050, 2120, 12],
    ['PN-WHITE-20L', 'Weather Coat White 20L', 'c5', 'b5', 'pc', 8000, 9800, 9300, 9550, 4],
    ['FS-NAIL-2.5', 'Iron Nail 2.5"', 'c6', 'b8', 'kg', 95, 140, 125, 132, 40],
    ['FS-SCRW-1.5', 'Wood Screw 1.5" (100pc)', 'c6', 'b8', 'box', 110, 175, 155, 165, 30],
    ['FS-BOLT-M10', 'Hex Bolt M10 (50pc)', 'c6', 'b8', 'box', 260, 380, 350, 365, 18],
    ['BM-CMNT-OPC', 'Cement OPC 50kg', 'c7', 'b8', 'bag', 480, 555, 530, 545, 50],
    ['BM-RBR-12', 'MS Rebar 12mm', 'c7', 'b6', 'kg', 92, 118, 110, 114, 500],
    ['BM-BRICK-1', 'Brick 1st Class', 'c7', 'b8', 'pc', 11, 16, 14, 15, 1000],
    ['SF-GLOVE-L', 'Safety Gloves L', 'c8', 'b8', 'pc', 60, 110, 95, 102, 50],
    ['SF-HELM-Y', 'Safety Helmet Yellow', 'c8', 'b8', 'pc', 180, 300, 270, 285, 30],
    ['SF-GOGL-CL', 'Safety Goggles Clear', 'c8', 'b8', 'pc', 70, 130, 115, 122, 40],
  ];
  // `avg_cost` and `cost_updated_at` are seeded alongside `cost`, and each
  // product opens its buying-price history with that same cost. Skipping them
  // would leave the fixture with avg_cost = 0 against a real cost, which is
  // exactly the drift `backend/verify/costing.ts` refuses to allow.
  const prodStmt = db.prepare(
    `INSERT INTO products (id, sku, barcode, name, category_id, brand_id, unit, cost, avg_cost,
       cost_updated_at, price, wholesale_price, contractor_price, reorder_level, tax_pct, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
  );
  const costHistStmt = db.prepare(
    `INSERT INTO product_cost_history (id, product_id, cost, at, user_id, source, note)
     VALUES (?,?,?,?,NULL,'initial','Opening buying price')`,
  );
  const ftsProdStmt = db.prepare('INSERT INTO fts_products (product_id, name, sku, barcode) VALUES (?,?,?,?)');
  const productIds: string[] = [];
  // Reference-only installs ship an EMPTY catalogue — the shop adds its own
  // products (or bulk-imports them from Data & Import).
  (referenceOnly ? [] : products).forEach((p, i) => {
    const id = `p${i + 1}`;
    const barcode = '880100100' + String(1000 + i).padStart(4, '0');
    prodStmt.run(id, p[0], barcode, p[1], p[2], p[3], p[4], p[5], p[5], now, p[6], p[7], p[8], p[9], now, now);
    costHistStmt.run(`pch_seed_${id}`, id, p[5], now);
    ftsProdStmt.run(id, p[1], p[0], barcode);
    productIds.push(id);
  });

  // ---- Customers ----
  const customers: [string, string, string, number, number][] = [
    // [name, phone, group, creditLimit, openingBalance]
    ['Walk-in Customer', '', 'Retail', 0, 0],
    ['Rahim Construction', '01711-200002', 'Contractor', 200000, 0],
    ['Karim Hardware', '01711-200003', 'Wholesale', 150000, 0],
    ['New Era Builders', '01711-200004', 'Contractor', 300000, 5000],
    ['Salma Begum', '01711-200005', 'Retail', 0, 0],
    ['Dhaka Developers Ltd', '01711-200006', 'Wholesale', 500000, 12000],
    ['Jahangir Mia', '01711-200007', 'Retail', 10000, 0],
    ['Bashundhara Project', '01711-200008', 'Contractor', 400000, 0],
    ['Hasan Electric', '01711-200009', 'Wholesale', 100000, 3000],
    ['Nurul Trade', '01711-200010', 'Retail', 5000, 0],
  ];
  const custStmt = db.prepare(
    `INSERT INTO customers (id, name, phone, price_group, credit_limit, opening_balance, joined, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
  );
  const ftsCustStmt = db.prepare('INSERT INTO fts_customers (customer_id, name, phone) VALUES (?,?,?)');
  const customerIds: string[] = [];
  const joinedBase = new Date(Date.now() - 400 * 86400000);
  // Reference-only installs keep ONLY the Walk-in customer (cu1) — the POS and
  // the sale forms rely on it for counter sales; the rest are harness fixtures.
  (referenceOnly ? customers.slice(0, 1) : customers).forEach((c, i) => {
    const id = `cu${i + 1}`;
    const joined = new Date(joinedBase.getTime() + i * 7 * 86400000).toISOString();
    custStmt.run(id, c[0], c[1] || null, c[2], c[3] || null, c[4], joined, joined);
    ftsCustStmt.run(id, c[0], c[1]);
    customerIds.push(id);
  });

  // ---- Suppliers ----
  const suppliers: [string, string, string, string, number][] = [
    // [name, company, phone, terms, openingBalance]
    ['BSRM Steels Ltd', 'BSRM', '01711-300001', 'Net30', 0],
    ['Berger Paints BD', 'Berger', '01711-300002', 'Net15', 0],
    ['RFL Plastics', 'RFL', '01711-300003', 'Cash', 0],
    ['Bosch BD Distributor', 'Bosch', '01711-300004', 'Net30', 0],
    ['Walton Electricals', 'Walton', '01711-300005', 'Net15', 8000],
    ['Generic Imports', 'Generic Co', '01711-300006', 'Net7', 0],
  ];
  const supStmt = db.prepare(
    `INSERT INTO suppliers (id, name, company, phone, payment_terms, opening_balance, created_at) VALUES (?,?,?,?,?,?,?)`,
  );
  const ftsSupStmt = db.prepare('INSERT INTO fts_suppliers (supplier_id, name, company, phone) VALUES (?,?,?,?)');
  const supplierIds: string[] = [];
  // Reference-only installs ship no suppliers — the shop adds its own.
  (referenceOnly ? [] : suppliers).forEach((s, i) => {
    const id = `sp${i + 1}`;
    supStmt.run(id, s[0], s[1], s[2], s[3], s[4], now);
    ftsSupStmt.run(id, s[0], s[1], s[2]);
    supplierIds.push(id);
  });

  // ---- Expense categories ----
  const expCats = [
    { id: 'ec_rent', name: 'Rent', budget: 50000 },
    { id: 'ec_util', name: 'Utilities', budget: 12000 },
    { id: 'ec_salary', name: 'Salary', budget: 100000 },
    { id: 'ec_transport', name: 'Transport', budget: 8000 },
    { id: 'ec_misc', name: 'Misc', budget: null },
  ];
  const ecStmt = db.prepare('INSERT INTO expense_categories (id, name, monthly_budget) VALUES (?,?,?)');
  for (const e of expCats) ecStmt.run(e.id, e.name, e.budget);

  return {
    branchIds: branches.map((b) => b.id),
    userIds: users.map((u) => u.id),
    productIds,
    customerIds,
    supplierIds,
    agentIds: agents.map((a) => a.id),
    expenseCategoryIds: expCats.map((e) => e.id),
  };
}
