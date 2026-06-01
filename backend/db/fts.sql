-- ============================================================================
--  Full-text search (FTS5) for global search.
--  Contentless-external pattern: we maintain the FTS rows manually from the
--  service layer (simpler than triggers across many edge cases for a v1).
-- ============================================================================

CREATE VIRTUAL TABLE IF NOT EXISTS fts_products USING fts5(
  product_id UNINDEXED,
  name,
  sku,
  barcode,
  tokenize = 'unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_customers USING fts5(
  customer_id UNINDEXED,
  name,
  phone,
  tokenize = 'unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_suppliers USING fts5(
  supplier_id UNINDEXED,
  name,
  company,
  phone,
  tokenize = 'unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_invoices USING fts5(
  sale_id UNINDEXED,
  invoice_no,
  customer_name,
  tokenize = 'unicode61'
);
