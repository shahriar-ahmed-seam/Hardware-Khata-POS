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

// Mock searcher — backend will replace with IPC-backed search.
import {
  products,
  customers,
  suppliers,
  recentSales,
  brandName,
  categoryName,
} from '@/mocks/data';

export interface SearchResult {
  id: string;
  type: 'invoice' | 'product' | 'customer' | 'supplier';
  title: string;
  subtitle?: string;
  meta?: string;
  to: string;
}

export function runSearch(parsed: ParsedSearch, limit = 8): SearchResult[] {
  const term = parsed.term.toLowerCase();
  if (!term) return [];

  const results: SearchResult[] = [];

  const includeProducts = parsed.scope === 'all' || parsed.scope === 'product' || parsed.scope === 'sku' || parsed.scope === 'barcode';
  const includeInvoices = parsed.scope === 'all' || parsed.scope === 'invoice';
  const includeCustomers = parsed.scope === 'all' || parsed.scope === 'customer';
  const includeSuppliers = parsed.scope === 'all' || parsed.scope === 'supplier';

  if (includeProducts) {
    products.forEach((p) => {
      const hay =
        parsed.scope === 'sku'
          ? p.sku.toLowerCase()
          : parsed.scope === 'barcode'
            ? p.barcode.toLowerCase()
            : `${p.name} ${p.sku} ${p.barcode}`.toLowerCase();
      if (hay.includes(term)) {
        results.push({
          id: p.id,
          type: 'product',
          title: p.name,
          subtitle: `${p.sku} · ${brandName(p.brandId)} · ${categoryName(p.categoryId)}`,
          meta: `${p.stock} ${p.unit}`,
          to: `/products?q=${encodeURIComponent(p.name)}`,
        });
      }
    });
  }

  if (includeInvoices) {
    recentSales.forEach((s) => {
      if (
        s.invoiceNo.toLowerCase().includes(term) ||
        s.customerName.toLowerCase().includes(term)
      ) {
        results.push({
          id: s.id,
          type: 'invoice',
          title: s.invoiceNo,
          subtitle: `${s.customerName} · ${new Date(s.date).toLocaleDateString()}`,
          meta: s.status,
          to: `/sales?q=${encodeURIComponent(s.invoiceNo)}`,
        });
      }
    });
  }

  if (includeCustomers) {
    customers.forEach((c) => {
      if (`${c.name} ${c.phone}`.toLowerCase().includes(term)) {
        results.push({
          id: c.id,
          type: 'customer',
          title: c.name,
          subtitle: `${c.phone} · ${c.group}`,
          meta: c.due > 0 ? `Due ৳${c.due}` : '',
          to: `/contacts/customers?q=${encodeURIComponent(c.name)}`,
        });
      }
    });
  }

  if (includeSuppliers) {
    suppliers.forEach((s) => {
      if (`${s.name} ${s.phone}`.toLowerCase().includes(term)) {
        results.push({
          id: s.id,
          type: 'supplier',
          title: s.name,
          subtitle: `${s.phone}${s.company ? ' · ' + s.company : ''}`,
          meta: s.due > 0 ? `Due ৳${s.due}` : '',
          to: `/contacts/suppliers?q=${encodeURIComponent(s.name)}`,
        });
      }
    });
  }

  return results.slice(0, limit);
}

/* ----------------------------------------------------------------------------
 * Backend-backed search (search.global)
 *
 * The backend returns FTS rows; we map them into the same SearchResult[] shape
 * the dropdown already renders. Routing emits a `?q=` param so the target list
 * page can highlight the match (Products/Sales/Customers/Suppliers read it).
 * GlobalSearch picks this path when hasBackend(); runSearch() above is the
 * !hasBackend() fallback.
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
