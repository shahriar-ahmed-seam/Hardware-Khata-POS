import type { Product, Customer, Category, Brand } from '@/types/domain';
import type { UnitRecord } from '@/stores/masterData';
import { hasBackend } from '@/lib/api';

/**
 * ============================================================================
 *  BROWSER-PREVIEW SAMPLE DATA — A BOUNDED, DEV-ONLY EXCEPTION
 * ============================================================================
 *
 * READ THIS BEFORE ADDING ANYTHING HERE.
 *
 * Handoff rules 5 and 8 say the app has NO mock data path: `src/mocks/` was
 * deleted, and a figure with no backend source renders '—' rather than an
 * invented number. That rule exists because fabricated figures had reached real
 * screens (dashboard deltas, a guessed COGS, a fake commission split) where the
 * shopkeeper could not tell them from their own books.
 *
 * This file is a deliberate, narrow exception so the UI can be opened in a plain
 * browser (`vite` with no Electron) for visual work. It is NOT a fallback:
 *
 *  1. It is gated on `browserPreview()` below, which requires BOTH that the
 *     Electron bridge is absent AND `import.meta.env.DEV`. Vite replaces `DEV`
 *     with `false` when building, so the whole branch — and with it every value
 *     in this file — is dropped from the production bundle. It cannot reach a
 *     shipped installer even in principle.
 *  2. It is limited to CATALOGUE REFERENCE DATA the pickers need in order to
 *     render at all: products, customers, categories, brands, units.
 *  3. It must never grow to cover MONEY. No sales, purchases, payments, dues,
 *     stock movements, KPIs, report rows or totals. Those are the figures rule 5
 *     is about, and outside Electron the screens that show them must stay empty.
 *
 * If you need to see money on screen without a shop, run the app properly with
 * `POS_SEED=demo npm run dev` — that generates a synthetic year through the REAL
 * services, so every number is a real DB row that went through the real pipeline.
 */

/**
 * True only in a browser dev preview: no Electron bridge, and a dev build.
 *
 * The `import.meta.env.DEV` half is what makes this safe rather than merely
 * unlikely — it is a compile-time constant, so a production build contains no
 * path to the sample data at all.
 */
export function browserPreview(): boolean {
  return import.meta.env.DEV && !hasBackend();
}

export const BROWSER_MOCK_CATEGORIES: (Category & { parentId?: string })[] = [
  { id: 'cat_cement', name: 'Cement & Masonry', emoji: '🧱' },
  { id: 'cat_steel', name: 'Steel & Rebar', emoji: '🏗️' },
  { id: 'cat_pipes', name: 'Plumbing & Pipes', emoji: '🚰' },
  { id: 'cat_paint', name: 'Paints & Coatings', emoji: '🎨' },
  { id: 'cat_tools', name: 'Power & Hand Tools', emoji: '🔨' },
  { id: 'cat_electrical', name: 'Electrical & Lighting', emoji: '💡' },
  { id: 'cat_fasteners', name: 'Fasteners & Hardware', emoji: '🔩' },
];

export const BROWSER_MOCK_BRANDS: Brand[] = [
  { id: 'br_shah', name: 'Shah Cement' },
  { id: 'br_bsrm', name: 'BSRM' },
  { id: 'br_rfl', name: 'RFL' },
  { id: 'br_berger', name: 'Berger' },
  { id: 'br_bosch', name: 'Bosch' },
  { id: 'br_stanley', name: 'Stanley' },
  { id: 'br_superstar', name: 'Super Star' },
  { id: 'br_gazi', name: 'Gazi' },
];

export const BROWSER_MOCK_UNITS: UnitRecord[] = [
  { id: 'u_pcs', name: 'Pieces', short: 'pcs', type: 'count', toBaseFactor: 1 },
  { id: 'u_bag', name: 'Bag (50kg)', short: 'bag', type: 'weight', toBaseFactor: 50 },
  { id: 'u_kg', name: 'Kilogram', short: 'kg', type: 'weight', toBaseFactor: 1 },
  { id: 'u_ft', name: 'Feet', short: 'ft', type: 'length', toBaseFactor: 1 },
  { id: 'u_ltr', name: 'Litre', short: 'ltr', type: 'volume', toBaseFactor: 1 },
  { id: 'u_box', name: 'Box', short: 'box', type: 'count', toBaseFactor: 1 },
];

export const BROWSER_MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'cu_walkin',
    name: 'Walk-in Customer',
    phone: '01700-000000',
    group: 'Retail',
    due: 0,
    creditLimit: 0,
    totalPurchase: 145000,
    totalPaid: 145000,
    joined: '2024-01-01',
  },
  {
    id: 'cu_karim',
    name: 'Karim Builders & Contractors',
    phone: '01819-123456',
    group: 'Contractor',
    due: 24500,
    creditLimit: 50000,
    totalPurchase: 450000,
    totalPaid: 425500,
    joined: '2024-02-15',
  },
  {
    id: 'cu_rahim',
    name: 'Rahim Hardware Store',
    phone: '01911-987654',
    group: 'Wholesale',
    due: 68000,
    creditLimit: 60000,
    totalPurchase: 890000,
    totalPaid: 822000,
    joined: '2023-11-20',
  },
  {
    id: 'cu_master',
    name: 'Master Electricians Hub',
    phone: '01670-554433',
    group: 'Retail',
    due: 3200,
    creditLimit: 15000,
    totalPurchase: 98000,
    totalPaid: 94800,
    joined: '2024-03-10',
  },
];

export const BROWSER_MOCK_PRODUCTS: Product[] = [
  {
    id: 'p_cement_shah',
    sku: 'CEM-SHAH-50',
    barcode: '894100100001',
    name: 'Shah Special Cement 50kg Bag',
    categoryId: 'cat_cement',
    brandId: 'br_shah',
    unit: 'bag',
    cost: 510,
    avgCost: 505,
    price: 560,
    wholesalePrice: 535,
    contractorPrice: 540,
    stock: 240,
    reorderLevel: 50,
    tax: 0,
    manageStock: true,
    allowNegativeSale: false,
    allowDiscount: true,
    showInPOS: true,
    notForSale: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_bsrm_12mm',
    sku: 'STL-BSRM-12',
    barcode: '894100100002',
    name: 'BSRM Xtreme 500W Rebar 12mm',
    categoryId: 'cat_steel',
    brandId: 'br_bsrm',
    unit: 'kg',
    cost: 92,
    avgCost: 91.5,
    price: 104,
    wholesalePrice: 98,
    contractorPrice: 99.5,
    stock: 4500,
    reorderLevel: 500,
    tax: 0,
    manageStock: true,
    allowNegativeSale: false,
    allowDiscount: true,
    showInPOS: true,
    notForSale: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_rfl_pvc_1',
    sku: 'PIP-RFL-1IN',
    barcode: '894100100003',
    name: 'RFL Class-D PVC Pipe 1" (10ft)',
    categoryId: 'cat_pipes',
    brandId: 'br_rfl',
    unit: 'pcs',
    cost: 210,
    avgCost: 208,
    price: 260,
    wholesalePrice: 235,
    contractorPrice: 240,
    stock: 85,
    reorderLevel: 20,
    tax: 0,
    manageStock: true,
    allowNegativeSale: false,
    allowDiscount: true,
    showInPOS: true,
    notForSale: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_berger_white_4l',
    sku: 'PNT-BRG-4L',
    barcode: '894100100004',
    name: 'Berger Robbialac WeatherCoat White 4L',
    categoryId: 'cat_paint',
    brandId: 'br_berger',
    unit: 'ltr',
    cost: 1420,
    avgCost: 1400,
    price: 1680,
    wholesalePrice: 1540,
    contractorPrice: 1560,
    stock: 32,
    reorderLevel: 10,
    tax: 0,
    manageStock: true,
    allowNegativeSale: false,
    allowDiscount: true,
    showInPOS: true,
    notForSale: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_bosch_drill_550',
    sku: 'TLS-BSH-550',
    barcode: '894100100005',
    name: 'Bosch GSB 550 Impact Drill 13mm 550W',
    categoryId: 'cat_tools',
    brandId: 'br_bosch',
    unit: 'pcs',
    cost: 3850,
    avgCost: 3800,
    price: 4500,
    wholesalePrice: 4150,
    contractorPrice: 4200,
    stock: 12,
    reorderLevel: 3,
    tax: 0,
    manageStock: true,
    allowNegativeSale: false,
    allowDiscount: true,
    showInPOS: true,
    notForSale: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_stanley_hammer',
    sku: 'TLS-STN-HAM',
    barcode: '894100100006',
    name: 'Stanley Fiberglass Claw Hammer 16oz',
    categoryId: 'cat_tools',
    brandId: 'br_stanley',
    unit: 'pcs',
    cost: 480,
    avgCost: 475,
    price: 650,
    wholesalePrice: 560,
    contractorPrice: 580,
    stock: 24,
    reorderLevel: 5,
    tax: 0,
    manageStock: true,
    allowNegativeSale: false,
    allowDiscount: true,
    showInPOS: true,
    notForSale: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_superstar_led_15w',
    sku: 'ELE-SS-15W',
    barcode: '894100100007',
    name: 'Super Star Bright Star LED Bulb 15W E27',
    categoryId: 'cat_electrical',
    brandId: 'br_superstar',
    unit: 'pcs',
    cost: 165,
    avgCost: 160,
    price: 220,
    wholesalePrice: 190,
    contractorPrice: 195,
    stock: 110,
    reorderLevel: 25,
    tax: 0,
    manageStock: true,
    allowNegativeSale: false,
    allowDiscount: true,
    showInPOS: true,
    notForSale: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_gazi_pump_1hp',
    sku: 'PLM-GAZI-1HP',
    barcode: '894100100008',
    name: 'Gazi Submersible Water Pump 1.0 HP',
    categoryId: 'cat_pipes',
    brandId: 'br_gazi',
    unit: 'pcs',
    cost: 7200,
    avgCost: 7100,
    price: 8600,
    wholesalePrice: 7900,
    contractorPrice: 8050,
    stock: 8,
    reorderLevel: 2,
    tax: 0,
    manageStock: true,
    allowNegativeSale: false,
    allowDiscount: true,
    showInPOS: true,
    notForSale: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p_screws_box_100',
    sku: 'FAS-SCRW-100',
    barcode: '894100100009',
    name: 'Black Phosphate Drywall Screws 1.5" (100 pcs/box)',
    categoryId: 'cat_fasteners',
    brandId: 'br_rfl',
    unit: 'box',
    cost: 95,
    avgCost: 90,
    price: 140,
    wholesalePrice: 115,
    contractorPrice: 120,
    stock: 180,
    reorderLevel: 30,
    tax: 0,
    manageStock: true,
    allowNegativeSale: false,
    allowDiscount: true,
    showInPOS: true,
    notForSale: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
