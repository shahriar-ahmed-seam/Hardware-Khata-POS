-- ============================================================================
--  Hardware POS — SQLite schema (v2)
--  Offline-first. All money stored as REAL (BDT). All timestamps ISO-8601 TEXT.
--  IDs are TEXT (string keys) to match the frontend mock IDs and ease sync.
-- ============================================================================

-- ---------- Meta / migrations ----------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Business (singleton, id = 1) ----------
CREATE TABLE IF NOT EXISTS business_info (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  name               TEXT NOT NULL,
  tagline            TEXT,
  logo_url           TEXT,
  address            TEXT,
  phone_primary      TEXT,
  phone_alt          TEXT,
  email              TEXT,
  website            TEXT,
  vat_tin            TEXT,
  bin_no             TEXT,
  trade_license_no   TEXT,
  currency_symbol    TEXT NOT NULL DEFAULT '৳',
  currency_position  TEXT NOT NULL DEFAULT 'before',
  decimal_places     INTEGER NOT NULL DEFAULT 2,
  thousand_separator TEXT NOT NULL DEFAULT ',',
  timezone           TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  date_format        TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  fiscal_year_start  INTEGER NOT NULL DEFAULT 7,
  default_language   TEXT NOT NULL DEFAULT 'en',
  default_branch_id  TEXT,
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Branches ----------
CREATE TABLE IF NOT EXISTS branches (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  code          TEXT,
  address       TEXT,
  phone_primary TEXT,
  phone_alt     TEXT,
  manager       TEXT,
  is_default    INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Roles & Users ----------
CREATE TABLE IF NOT EXISTS roles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  is_system   INTEGER NOT NULL DEFAULT 0,
  permissions TEXT NOT NULL DEFAULT '[]'  -- JSON array of permission ids
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  phone         TEXT,
  email         TEXT,
  pin_hash      TEXT,        -- bcrypt (mock: plain) of PIN
  password_hash TEXT,
  role_id       TEXT NOT NULL REFERENCES roles(id),
  branch_ids    TEXT NOT NULL DEFAULT '[]', -- JSON array; empty = all branches
  status        TEXT NOT NULL DEFAULT 'active',
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commission_agents (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  phone          TEXT,
  commission_pct REAL NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1
);

-- ---------- Settings key-value (tax rates, schemes, prefs as JSON blobs) ----------
CREATE TABLE IF NOT EXISTS settings_kv (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,          -- JSON
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tax_rates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  percentage  REAL NOT NULL,
  is_default  INTEGER NOT NULL DEFAULT 0,
  scope       TEXT NOT NULL DEFAULT 'all',
  active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS invoice_schemes (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  doc_type        TEXT NOT NULL,
  prefix          TEXT NOT NULL,
  year_format     TEXT NOT NULL DEFAULT 'YYYY',
  separator       TEXT NOT NULL DEFAULT '-',
  counter_padding INTEGER NOT NULL DEFAULT 4,
  reset_rule      TEXT NOT NULL DEFAULT 'yearly',
  start_number    INTEGER NOT NULL DEFAULT 1,
  current_counter INTEGER NOT NULL DEFAULT 0,
  is_default      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS printer_profiles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  branch_id   TEXT REFERENCES branches(id),
  connection  TEXT NOT NULL DEFAULT 'USB',
  model       TEXT,
  ip_or_port  TEXT,
  paper_width INTEGER NOT NULL DEFAULT 80,
  encoding    TEXT NOT NULL DEFAULT 'UTF-8',
  is_default  INTEGER NOT NULL DEFAULT 0
);

-- ---------- Catalog: categories, brands, units, warranties, price groups ----------
CREATE TABLE IF NOT EXISTS categories (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  emoji     TEXT,
  parent_id TEXT REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS brands (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  logo_url TEXT
);

CREATE TABLE IF NOT EXISTS units (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  short          TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'count',
  to_base_factor REAL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS warranties (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  duration_months INTEGER NOT NULL DEFAULT 0,
  description     TEXT
);

CREATE TABLE IF NOT EXISTS price_groups (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  is_default           INTEGER NOT NULL DEFAULT 0,
  notes                TEXT,
  default_credit_limit REAL,
  default_discount_pct REAL,
  tax_exempt           INTEGER NOT NULL DEFAULT 0
);

-- ---------- Products ----------
CREATE TABLE IF NOT EXISTS products (
  id                  TEXT PRIMARY KEY,
  sku                 TEXT NOT NULL UNIQUE,
  barcode             TEXT,
  name                TEXT NOT NULL,
  category_id         TEXT REFERENCES categories(id),
  brand_id            TEXT REFERENCES brands(id),
  unit                TEXT NOT NULL DEFAULT 'pc',
  cost                REAL NOT NULL DEFAULT 0,
  price               REAL NOT NULL DEFAULT 0,
  wholesale_price     REAL,
  contractor_price    REAL,
  reorder_level       REAL NOT NULL DEFAULT 0,
  tax_pct             REAL NOT NULL DEFAULT 0,
  warranty_id         TEXT REFERENCES warranties(id),
  image_url           TEXT,
  description         TEXT,
  manage_stock        INTEGER NOT NULL DEFAULT 1,
  allow_negative_sale INTEGER NOT NULL DEFAULT 0,
  allow_discount      INTEGER NOT NULL DEFAULT 1,
  show_in_pos         INTEGER NOT NULL DEFAULT 1,
  not_for_sale        INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-product alternate units (1 unit = factor x base unit)
CREATE TABLE IF NOT EXISTS product_units (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_short TEXT NOT NULL,
  factor     REAL NOT NULL DEFAULT 1,
  PRIMARY KEY (product_id, unit_short)
);

-- ---------- Stock movements (the single source of truth for stock on hand) ----------
-- qty is SIGNED: + adds, - removes. Stock on hand = SUM(qty) per (product, branch).
CREATE TABLE IF NOT EXISTS stock_movements (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id),
  branch_id   TEXT NOT NULL REFERENCES branches(id),
  reason      TEXT NOT NULL,   -- sale|sale_return|purchase|purchase_return|transfer_out|transfer_in|damage|theft|sample|recount|opening_stock|other
  qty         REAL NOT NULL,
  unit        TEXT NOT NULL DEFAULT 'pc',
  unit_cost   REAL NOT NULL DEFAULT 0,  -- cost per base unit at the time of movement
  ref_type    TEXT,            -- sale|purchase|transfer|adjustment|opening
  ref_id      TEXT,
  ref_no      TEXT,
  note        TEXT,
  user_id     TEXT,
  at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Customers & Suppliers ----------
CREATE TABLE IF NOT EXISTS customers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  phone           TEXT,
  alt_phone       TEXT,
  email           TEXT,
  address         TEXT,
  price_group     TEXT NOT NULL DEFAULT 'Retail',
  opening_balance REAL NOT NULL DEFAULT 0,
  credit_limit    REAL,
  dob             TEXT,
  tags            TEXT,        -- JSON array
  notes           TEXT,
  store_credit    REAL NOT NULL DEFAULT 0,
  joined          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  company         TEXT,
  contact_person  TEXT,
  phone           TEXT,
  alt_phone       TEXT,
  email           TEXT,
  address         TEXT,
  tax_id          TEXT,
  bank_account    TEXT,
  lead_time_days  INTEGER,
  payment_terms   TEXT,
  opening_balance REAL NOT NULL DEFAULT 0,
  tags            TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Sales ----------
CREATE TABLE IF NOT EXISTS sales (
  id                  TEXT PRIMARY KEY,
  invoice_no          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'final', -- final|draft|quotation|void
  date                TEXT NOT NULL,
  customer_id         TEXT REFERENCES customers(id),
  branch_id           TEXT NOT NULL REFERENCES branches(id),
  user_id             TEXT NOT NULL REFERENCES users(id),
  agent_id            TEXT REFERENCES commission_agents(id),
  subtotal            REAL NOT NULL DEFAULT 0,   -- sum of line subtotals (after line disc)
  total_line_discount REAL NOT NULL DEFAULT 0,
  order_discount_pct  REAL NOT NULL DEFAULT 0,
  order_discount_flat REAL NOT NULL DEFAULT 0,
  order_discount      REAL NOT NULL DEFAULT 0,
  tax_pct             REAL NOT NULL DEFAULT 0,
  tax                 REAL NOT NULL DEFAULT 0,
  shipping            REAL NOT NULL DEFAULT 0,
  other               REAL NOT NULL DEFAULT 0,
  round_off           REAL NOT NULL DEFAULT 0,
  total               REAL NOT NULL DEFAULT 0,
  paid                REAL NOT NULL DEFAULT 0,
  due                 REAL NOT NULL DEFAULT 0,
  cogs                REAL NOT NULL DEFAULT 0,   -- sum(qty * unit_cost_at_sale)
  profit              REAL NOT NULL DEFAULT 0,   -- subtotal - order_discount - cogs
  valid_until         TEXT,
  source_quotation_id TEXT,
  notes               TEXT,
  voided_at           TEXT,
  voided_by           TEXT,
  void_reason         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_lines (
  id                TEXT PRIMARY KEY,
  sale_id           TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES products(id),
  name_at_sale      TEXT NOT NULL,
  sku_at_sale       TEXT NOT NULL,
  qty               REAL NOT NULL,
  unit_used         TEXT NOT NULL DEFAULT 'pc',
  unit_factor       REAL NOT NULL DEFAULT 1,
  spr_at_sale       REAL NOT NULL DEFAULT 0,
  markup_pct        REAL NOT NULL DEFAULT 0,
  unit_price        REAL NOT NULL DEFAULT 0,
  discount_pct      REAL NOT NULL DEFAULT 0,
  discount_flat     REAL NOT NULL DEFAULT 0,
  tax_pct           REAL NOT NULL DEFAULT 0,
  unit_cost_at_sale REAL NOT NULL DEFAULT 0,
  line_subtotal     REAL NOT NULL DEFAULT 0,
  line_no           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id        TEXT PRIMARY KEY,
  sale_id   TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method    TEXT NOT NULL,
  amount    REAL NOT NULL,
  reference TEXT,
  paid_at   TEXT NOT NULL,
  by_user   TEXT
);

CREATE TABLE IF NOT EXISTS sale_audit (
  id      TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  at      TEXT NOT NULL,
  by_user TEXT,
  action  TEXT NOT NULL,
  note    TEXT
);

-- ---------- Sell Returns ----------
CREATE TABLE IF NOT EXISTS sell_returns (
  id              TEXT PRIMARY KEY,
  ref_no          TEXT NOT NULL,
  sale_id         TEXT REFERENCES sales(id),
  sale_invoice_no TEXT,
  date            TEXT NOT NULL,
  customer_id     TEXT REFERENCES customers(id),
  branch_id       TEXT REFERENCES branches(id),
  user_id         TEXT,
  reason          TEXT,
  refund_method   TEXT NOT NULL,
  total           REAL NOT NULL DEFAULT 0,
  notes           TEXT,
  manual          INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sell_return_lines (
  id             TEXT PRIMARY KEY,
  return_id      TEXT NOT NULL REFERENCES sell_returns(id) ON DELETE CASCADE,
  product_id     TEXT NOT NULL REFERENCES products(id),
  name_at_return TEXT,
  sku_at_return  TEXT,
  qty            REAL NOT NULL,
  unit           TEXT NOT NULL DEFAULT 'pc',
  unit_price     REAL NOT NULL DEFAULT 0,
  unit_cost      REAL NOT NULL DEFAULT 0,
  refund_amount  REAL NOT NULL DEFAULT 0
);

-- ---------- Shipments ----------
CREATE TABLE IF NOT EXISTS shipments (
  id              TEXT PRIMARY KEY,
  ref_no          TEXT NOT NULL,
  sale_id         TEXT REFERENCES sales(id),
  sale_invoice_no TEXT,
  customer_name   TEXT,
  driver          TEXT,
  vehicle_no      TEXT,
  tracking_no     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending|in-transit|delivered|failed
  address         TEXT,
  target_date     TEXT,
  delivered_at    TEXT,
  notes           TEXT,
  branch_id       TEXT REFERENCES branches(id),
  created_by      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Purchases ----------
CREATE TABLE IF NOT EXISTS purchases (
  id                  TEXT PRIMARY KEY,
  ref_no              TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'received', -- received|ordered|in-transit|cancelled
  date                TEXT NOT NULL,
  supplier_id         TEXT REFERENCES suppliers(id),
  supplier_name       TEXT,
  branch_id           TEXT NOT NULL REFERENCES branches(id),
  user_id             TEXT NOT NULL REFERENCES users(id),
  pay_terms           TEXT,
  subtotal            REAL NOT NULL DEFAULT 0,
  total_line_discount REAL NOT NULL DEFAULT 0,
  order_discount_type TEXT NOT NULL DEFAULT 'flat',
  order_discount_value REAL NOT NULL DEFAULT 0,
  order_discount      REAL NOT NULL DEFAULT 0,
  tax_pct             REAL NOT NULL DEFAULT 0,
  tax                 REAL NOT NULL DEFAULT 0,
  shipping            REAL NOT NULL DEFAULT 0,
  other               REAL NOT NULL DEFAULT 0,
  total               REAL NOT NULL DEFAULT 0,
  paid                REAL NOT NULL DEFAULT 0,
  due                 REAL NOT NULL DEFAULT 0,
  notes               TEXT,
  cancelled_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_lines (
  id                   TEXT PRIMARY KEY,
  purchase_id          TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id           TEXT NOT NULL REFERENCES products(id),
  name                 TEXT NOT NULL,
  sku                  TEXT NOT NULL,
  qty                  REAL NOT NULL,
  unit                 TEXT NOT NULL DEFAULT 'pc',
  imei                 TEXT,
  unit_cost_before_disc REAL NOT NULL DEFAULT 0,
  discount_pct         REAL NOT NULL DEFAULT 0,
  discount_flat        REAL NOT NULL DEFAULT 0,
  tax_pct              REAL NOT NULL DEFAULT 0,
  unit_cost_before_tax REAL NOT NULL DEFAULT 0,
  line_total           REAL NOT NULL DEFAULT 0,
  new_sell_price       REAL,
  line_no              INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_payments (
  id        TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  method    TEXT NOT NULL,
  amount    REAL NOT NULL,
  reference TEXT,
  paid_at   TEXT NOT NULL,
  by_user   TEXT
);

CREATE TABLE IF NOT EXISTS purchase_audit (
  id          TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  at          TEXT NOT NULL,
  by_user     TEXT,
  action      TEXT NOT NULL,
  note        TEXT
);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id               TEXT PRIMARY KEY,
  ref_no           TEXT NOT NULL,
  purchase_id      TEXT REFERENCES purchases(id),
  purchase_ref_no  TEXT,
  date             TEXT NOT NULL,
  supplier_id      TEXT REFERENCES suppliers(id),
  supplier_name    TEXT,
  branch_id        TEXT REFERENCES branches(id),
  user_id          TEXT,
  reason           TEXT,
  refund_method    TEXT NOT NULL,
  total            REAL NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_return_lines (
  id          TEXT PRIMARY KEY,
  return_id   TEXT NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id),
  name        TEXT,
  sku         TEXT,
  qty         REAL NOT NULL,
  unit        TEXT NOT NULL DEFAULT 'pc',
  unit_cost   REAL NOT NULL DEFAULT 0,
  refund_amount REAL NOT NULL DEFAULT 0
);

-- ---------- Stock transfers ----------
CREATE TABLE IF NOT EXISTS stock_transfers (
  id          TEXT PRIMARY KEY,
  ref_no      TEXT NOT NULL,
  date        TEXT NOT NULL,
  from_branch TEXT NOT NULL REFERENCES branches(id),
  to_branch   TEXT NOT NULL REFERENCES branches(id),
  status      TEXT NOT NULL DEFAULT 'pending', -- pending|in-transit|received|cancelled
  notes       TEXT,
  created_by  TEXT,
  received_by TEXT,
  received_at TEXT,
  receive_note TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_transfer_lines (
  id           TEXT PRIMARY KEY,
  transfer_id  TEXT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id   TEXT NOT NULL REFERENCES products(id),
  name         TEXT,
  sku          TEXT,
  qty          REAL NOT NULL,
  unit         TEXT NOT NULL DEFAULT 'pc',
  unit_cost    REAL NOT NULL DEFAULT 0,
  received_qty REAL
);

-- ---------- Stock adjustments ----------
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id         TEXT PRIMARY KEY,
  ref_no     TEXT NOT NULL,
  date       TEXT NOT NULL,
  branch_id  TEXT NOT NULL REFERENCES branches(id),
  type       TEXT NOT NULL DEFAULT 'recount', -- damage|theft|sample|recount|other
  reason     TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_adjustment_lines (
  id            TEXT PRIMARY KEY,
  adjustment_id TEXT NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  product_id    TEXT NOT NULL REFERENCES products(id),
  name          TEXT,
  sku           TEXT,
  qty           REAL NOT NULL,   -- signed
  unit          TEXT NOT NULL DEFAULT 'pc',
  unit_cost     REAL NOT NULL DEFAULT 0
);

-- ---------- Expenses ----------
CREATE TABLE IF NOT EXISTS expense_categories (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  parent_id      TEXT REFERENCES expense_categories(id),
  emoji          TEXT,
  monthly_budget REAL
);

CREATE TABLE IF NOT EXISTS expenses (
  id              TEXT PRIMARY KEY,
  ref_no          TEXT,
  date            TEXT NOT NULL,
  category_id     TEXT REFERENCES expense_categories(id),
  amount          REAL NOT NULL DEFAULT 0,
  payment_method  TEXT NOT NULL DEFAULT 'Cash',
  reference       TEXT,
  note            TEXT,
  branch_id       TEXT REFERENCES branches(id),
  user_id         TEXT,
  attachment_name TEXT,
  recurring       INTEGER NOT NULL DEFAULT 0,
  frequency       TEXT,
  recurring_end   TEXT,
  voided          INTEGER NOT NULL DEFAULT 0,
  void_reason     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Cash register / shifts ----------
CREATE TABLE IF NOT EXISTS cash_shifts (
  id             TEXT PRIMARY KEY,
  shift_no       INTEGER NOT NULL,
  branch_id      TEXT NOT NULL REFERENCES branches(id),
  user_id        TEXT NOT NULL REFERENCES users(id),
  opened_at      TEXT NOT NULL,
  opening_cash   REAL NOT NULL DEFAULT 0,
  closed_at      TEXT,
  counted_cash   REAL,
  expected_cash  REAL,
  variance       REAL,
  carried_float  REAL,
  open_note      TEXT,
  close_note     TEXT,
  status         TEXT NOT NULL DEFAULT 'open' -- open|closed
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id        TEXT PRIMARY KEY,
  shift_id  TEXT NOT NULL REFERENCES cash_shifts(id) ON DELETE CASCADE,
  branch_id TEXT,
  direction TEXT NOT NULL,  -- in|out
  reason    TEXT NOT NULL,  -- sale|refund|expense|supplier_paid|manual_in|manual_out|opening|...
  amount    REAL NOT NULL,  -- always positive; direction carries sign
  ref_type  TEXT,
  ref_id    TEXT,
  note      TEXT,
  user_id   TEXT,
  at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Activity log ----------
CREATE TABLE IF NOT EXISTS activity_log (
  id         TEXT PRIMARY KEY,
  at         TEXT NOT NULL,
  by_user    TEXT,
  branch_id  TEXT,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  entity_ref TEXT,
  message    TEXT,
  amount     REAL
);

-- ---------- Stock valuation snapshots (nightly, for profit/loss) ----------
CREATE TABLE IF NOT EXISTS stock_valuation_snapshots (
  date        TEXT NOT NULL,
  branch_id   TEXT NOT NULL,
  by_purchase REAL NOT NULL DEFAULT 0,
  by_sale     REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (date, branch_id)
);

-- ---------- Sync outbox ----------
CREATE TABLE IF NOT EXISTS sync_outbox (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  op         TEXT NOT NULL,    -- insert|update|delete
  payload    TEXT,             -- JSON snapshot
  version    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at  TEXT
);

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS idx_stock_mov_prod_branch ON stock_movements(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_at ON stock_movements(at);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sale_lines_sale ON sale_lines(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_lines_product ON sale_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_purchase ON purchase_lines(purchase_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_cat ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_cash_mov_shift ON cash_movements(shift_id);
CREATE INDEX IF NOT EXISTS idx_activity_at ON activity_log(at);
CREATE INDEX IF NOT EXISTS idx_sell_returns_date ON sell_returns(date);
CREATE INDEX IF NOT EXISTS idx_sell_returns_sale ON sell_returns(sale_id);
