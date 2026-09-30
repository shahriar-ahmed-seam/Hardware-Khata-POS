/**
 * ONE PLACE FOR THE WORDS BEHIND RAW DATA KEYS.
 *
 * Screens used to print keys straight from the data — `retail`, `in-transit`,
 * `CreditAdjust`, `compact` — often with CSS `capitalize` / `uppercase` on top.
 * The Bangla layer (src/lib/bn/) translates whole text nodes by their English
 * words, so a lowercase key never matched a dictionary entry and stayed English
 * in the Bangla UI.
 *
 * `labelFor(kind, key)` returns the English words for a key. The Bangla layer
 * then translates them like any other label, so every word here needs an entry
 * in src/lib/bn/dict.ts (checked by `npm run i18n:check` only for static text —
 * add new words there by hand).
 *
 * An unknown key never shows as code: it falls back to a readable version of
 * itself ("in-transit" → "In transit", "CreditAdjust" → "Credit adjust").
 */

const LABELS = {
  /** POS price toggle and customer groups (stored lowercase or capitalised). */
  priceGroup: {
    retail: 'Retail',
    wholesale: 'Wholesale',
    contractor: 'Contractor',
  },
  paymentStatus: {
    paid: 'Paid',
    partial: 'Partial',
    due: 'Due',
  },
  saleStatus: {
    final: 'Final',
    draft: 'Draft',
    quotation: 'Quotation',
  },
  shipmentStatus: {
    pending: 'Pending',
    'in-transit': 'On the way',
    delivered: 'Delivered',
    failed: 'Not delivered',
    cancelled: 'Cancelled',
  },
  transferStatus: {
    pending: 'Pending',
    'in-transit': 'In transit',
    received: 'Received',
    cancelled: 'Cancelled',
  },
  adjustmentType: {
    damage: 'Damage',
    theft: 'Theft',
    sample: 'Sample',
    recount: 'Recount',
    other: 'Other',
  },
  returnReason: {
    damaged: 'Damaged',
    'wrong-item': 'Wrong item',
    'changed-mind': 'Changed mind',
    defective: 'Defective',
    warranty: 'Warranty',
    other: 'Other',
  },
  paymentMethod: {
    Cash: 'Cash',
    bKash: 'bKash',
    Nagad: 'Nagad',
    Card: 'Card',
    Bank: 'Bank',
    Cheque: 'Cheque',
    Credit: 'Credit',
    Mixed: 'Mixed',
    CreditAdjust: 'Credit Adjust',
    StoreCredit: 'Store Credit',
  },
  ledgerType: {
    opening: 'Opening',
    sale: 'Sale',
    purchase: 'Purchase',
    payment: 'Payment',
    return: 'Return',
    adjust: 'Adjustment',
  },
  unitType: {
    count: 'Count',
    weight: 'Weight',
    length: 'Length',
    volume: 'Volume',
    pack: 'Pack',
  },
  /** Global search result / scope types. */
  searchType: {
    all: 'All',
    product: 'Product',
    sku: 'SKU',
    barcode: 'Barcode',
    invoice: 'Invoice',
    sale: 'Sale',
    customer: 'Customer',
    supplier: 'Supplier',
    purchase: 'Purchase',
    expense: 'Expense',
  },
  taxScope: {
    all: 'All',
    sales: 'Sales',
    purchases: 'Purchases',
    product: 'Product',
    sale: 'Sale',
    purchase: 'Purchase',
  },
  density: {
    compact: 'Compact',
    comfortable: 'Comfortable',
  },
  contactMode: {
    customers: 'Customers',
    suppliers: 'Suppliers',
  },
} as const satisfies Record<string, Record<string, string>>;

export type LabelKind = keyof typeof LABELS;

/** "in-transit" → "In transit", "CreditAdjust" → "Credit adjust", "on_hold" → "On hold". */
export function humanizeKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : '';
}

/**
 * The English label for a raw key. Case-insensitive on the key, so `Retail`
 * and `retail` both work. Empty / missing keys give an empty string.
 */
export function labelFor(kind: LabelKind, key: string | null | undefined): string {
  if (key == null || key === '') return '';
  const map = LABELS[kind] as Record<string, string>;
  if (key in map) return map[key];
  const lower = key.toLowerCase();
  for (const k of Object.keys(map)) if (k.toLowerCase() === lower) return map[k];
  return humanizeKey(key);
}
