// Smart global search parser.
// Supports tag-prefixed queries like:
//   #invoice:INV-2026-0451
//   #product:cement
//   #sku:BM-CMNT-OPC
//   #customer:rahim
//   #supplier:bsrm
//   #barcode:8801001000017
// Plain text falls back to multi-entity search.

export type SearchScope =
  | 'all'
  | 'invoice'
  | 'product'
  | 'sku'
  | 'customer'
  | 'supplier'
  | 'barcode';

export interface ParsedSearch {
  scope: SearchScope;
  term: string;
  raw: string;
}

const TAG_RE = /^#(invoice|product|sku|customer|supplier|barcode)\s*:\s*(.*)$/i;

export function parseSearch(input: string): ParsedSearch {
  const raw = input.trim();
  if (!raw) return { scope: 'all', term: '', raw };

  const m = raw.match(TAG_RE);
  if (m) {
    return {
      scope: m[1].toLowerCase() as SearchScope,
      term: m[2].trim(),
      raw,
    };
  }
  return { scope: 'all', term: raw, raw };
}

export const SCOPE_HINTS: { scope: SearchScope; label: string; example: string }[] = [
  { scope: 'invoice', label: 'Invoice', example: '#invoice:INV-2026-0451' },
  { scope: 'product', label: 'Product', example: '#product:cement' },
  { scope: 'sku', label: 'SKU', example: '#sku:BM-CMNT-OPC' },
  { scope: 'customer', label: 'Customer', example: '#customer:rahim' },
  { scope: 'supplier', label: 'Supplier', example: '#supplier:bsrm' },
  { scope: 'barcode', label: 'Barcode', example: '#barcode:8801001000017' },
];

export interface SearchResult {
  id: string;
  type: 'invoice' | 'product' | 'customer' | 'supplier';
  title: string;
  subtitle?: string;
  meta?: string;
  to: string;
}

/* Removed: the local `runSearch` stub (and the mock dataset it once indexed).
 * Search results come exclusively from the backend `search.global` channel via
 * `mapBackendResults` below. */

/* ----------------------------------------------------------------------------
 * Backend-backed search (search.global)
 *
 * The backend returns FTS rows; we map them into the same SearchResult[] shape
 * the dropdown already renders. Routing emits a `?q=` param so the target list
 * page can highlight the match (Products/Sales/Customers/Suppliers read it).
 * This is the only source of search results.
 * ------------------------------------------------------------------------- */

/** Raw shape returned by the `search.global` channel (queries.globalSearch). */
export interface BackendSearchPayload {
  products: { product_id: string; name: string; sku: string; barcode: string | null }[];
  invoices: { sale_id: string; invoice_no: string; customer_name: string | null }[];
  customers: { customer_id: string; name: string; phone: string | null }[];
  suppliers: { supplier_id: string; name: string; company: string | null; phone: string | null }[];
}

export function mapBackendResults(payload: BackendSearchPayload, limit = 8): SearchResult[] {
  const results: SearchResult[] = [];

  for (const p of payload.products ?? []) {
    results.push({
      id: p.product_id,
      type: 'product',
      title: p.name,
      subtitle: [p.sku, p.barcode].filter(Boolean).join(' · '),
      to: `/products?q=${encodeURIComponent(p.name)}`,
    });
  }
  for (const s of payload.invoices ?? []) {
    results.push({
      id: s.sale_id,
      type: 'invoice',
      title: s.invoice_no,
      subtitle: s.customer_name ?? undefined,
      to: `/sales?q=${encodeURIComponent(s.invoice_no)}`,
    });
  }
  for (const c of payload.customers ?? []) {
    results.push({
      id: c.customer_id,
      type: 'customer',
      title: c.name,
      subtitle: c.phone ?? undefined,
      to: `/contacts/customers?q=${encodeURIComponent(c.name)}`,
    });
  }
  for (const s of payload.suppliers ?? []) {
    results.push({
      id: s.supplier_id,
      type: 'supplier',
      title: s.name,
      subtitle: [s.phone, s.company].filter(Boolean).join(' · ') || undefined,
      to: `/contacts/suppliers?q=${encodeURIComponent(s.name)}`,
    });
  }

  return results.slice(0, limit);
}
