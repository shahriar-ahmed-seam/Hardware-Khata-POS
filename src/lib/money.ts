/**
 * ============================================================================
 *  THE RENDERER'S MIRROR OF THE MONEY CORE
 * ============================================================================
 *
 * Every formula here is a line-for-line mirror of `backend/core/calc.ts` and
 * `backend/core/money.ts`. That is the whole point of the file: the backend
 * recomputes and STORES its own figures from the raw lines the renderer sends, so
 * any place the renderer does its own arithmetic is a place the screen can
 * disagree with the invoice.
 *
 * WHY IT EXISTS — three real bugs, all the same shape
 *
 *  1. `Receipt.tsx` recomputed a line subtotal inline and left out the
 *     `max(0, …)` clamp, so a flat discount bigger than the line printed a
 *     NEGATIVE subtotal while the footer counted it as zero.
 *
 *  2. `AddSale.tsx` pooled every line's discount into one number and clamped the
 *     POOL, where the backend clamps EACH LINE. An over-discounted line could
 *     therefore eat into other lines: two lines of ৳100 (150% discount) and
 *     ৳1,000 showed a ৳950 total while the backend stored ৳1,000. The operator
 *     collected 950 and the invoice kept a ৳50 due nobody knew about.
 *
 *  3. Nothing in the renderer rounded, and the backend rounds at every step —
 *     including rounding the UNIT PRICE before multiplying by quantity. On
 *     `basePrice 99.99` with a 5% markup and qty 1000 the cart said ৳104,989.50
 *     and the backend stored ৳104,990.00. Worse, POS caps the payments it sends
 *     at the CART total, so a sale paid in full to the last paisa persisted with
 *     a ৳0.50 due that no payment screen could ever clear.
 *
 * RULES FOR CHANGING ANYTHING HERE
 *  - If you change a formula, change `backend/core/calc.ts` in the same commit
 *    and add a check. The backend is authoritative; this file follows it.
 *  - Round at the SAME STEPS the backend rounds at, not just at the end. Where
 *    the backend rounds a unit price before multiplying, so does this.
 *  - Clamp per line, never per pool.
 */

/**
 * Round to 2 decimal places. Identical to `round2` in backend/core/money.ts,
 * including the `Number.EPSILON` nudge that stops 1.005 collapsing to 1.00.
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Sum, rounded. Mirrors `sum2` in backend/core/money.ts. */
export function sum2(nums: number[]): number {
  return round2(nums.reduce((a, b) => a + b, 0));
}

// ---------------------------------------------------------------- sale lines

/**
 * The money-bearing fields of a sale line, in the shape BOTH the POS cart
 * (`CartLine`, which carries basePrice + markupPct) and the sale form
 * (`SaleLine`, which carries a single unitPrice) can supply.
 */
export interface SaleLineMoney {
  qty: number;
  /** Already-marked-up unit price. Round it with `saleUnitPrice` first. */
  unitPrice: number;
  discountPct: number;
  discountFlat: number;
}

/**
 * A line's unit price after markup. Mirrors `computeSaleLine`, which rounds the
 * unit price BEFORE it is multiplied by quantity — so 99.99 at 5% is 104.99,
 * not 104.9895. Getting this step wrong is what put ৳0.50 of phantom due on a
 * thousand-unit line.
 */
export function saleUnitPrice(basePrice: number, markupPct: number): number {
  return round2(basePrice * (1 + markupPct / 100));
}

/**
 * What a line contributes to the invoice, after its own discounts.
 * Mirrors `computeSaleLine`: percent first, then flat, then CLAMP AT ZERO, then
 * round. The clamp is per line and must stay per line.
 */
export function saleLineSubtotal(l: SaleLineMoney): number {
  const gross = l.unitPrice * l.qty;
  const afterPct = gross * (1 - l.discountPct / 100);
  return round2(Math.max(0, afterPct - l.discountFlat));
}

/** A line's gross, before its own discounts. Rounded like the backend's. */
export function saleLineGross(l: SaleLineMoney): number {
  return round2(l.unitPrice * l.qty);
}

// --------------------------------------------------------------- sale totals

export interface SaleTotalsMoneyInput {
  lines: SaleLineMoney[];
  orderDiscountPct: number;
  orderDiscountFlat: number;
  /** Order-level VAT %. Line `taxPct` is deliberately not used — see settings. */
  taxPct: number;
  shipping: number;
  other: number;
  /** Manual round-off, as the backend supports. */
  roundOff?: number;
}

export interface SaleTotalsMoney {
  /**
   * Sum of line subtotals, i.e. AFTER line discounts. This is what the backend
   * calls `subtotal` and what it stores in `sales.subtotal`.
   */
  subtotal: number;
  /** Sum of line grosses, BEFORE line discounts. Shown as "Subtotal" on screen. */
  gross: number;
  totalLineDiscount: number;
  orderDiscount: number;
  taxableBase: number;
  tax: number;
  shipping: number;
  other: number;
  roundOff: number;
  total: number;
}

/**
 * The invoice totals. Mirrors `computeSaleTotals` exactly:
 * line discounts (clamped per line) → order discount on the NET subtotal →
 * clamp → VAT on the post-discount base → shipping and other added after tax,
 * never taxed → round-off.
 */
export function saleTotals(i: SaleTotalsMoneyInput): SaleTotalsMoney {
  const subtotal = sum2(i.lines.map(saleLineSubtotal));
  const gross = sum2(i.lines.map(saleLineGross));
  const totalLineDiscount = round2(gross - subtotal);
  const orderDiscount = round2(
    subtotal * (i.orderDiscountPct / 100) + i.orderDiscountFlat,
  );
  const taxableBase = round2(Math.max(0, subtotal - orderDiscount));
  const tax = round2(taxableBase * (i.taxPct / 100));
  const roundOff = round2(i.roundOff ?? 0);
  const total = round2(
    taxableBase + tax + (i.shipping || 0) + (i.other || 0) + roundOff,
  );
  return {
    subtotal,
    gross,
    totalLineDiscount,
    orderDiscount,
    taxableBase,
    tax,
    shipping: round2(i.shipping || 0),
    other: round2(i.other || 0),
    roundOff,
    total,
  };
}

// ------------------------------------------------------------ purchase lines

export interface PurchaseLineMoney {
  qty: number;
  unitCostBeforeDisc: number;
  discountPct: number;
  discountFlat: number;
  taxPct: number;
}

export interface PurchaseLineComputedMoney {
  unitCostBeforeTax: number;
  lineTotal: number;
}

/**
 * Mirrors `computePurchaseLine`. Note the unit cost is rounded BEFORE being
 * multiplied by quantity — without that, a screen could show a net cost of 87.49
 * and a line total of 8,749.13 for 100 units, which do not agree with each other
 * and are ৳0.13 above the bill that actually gets stored.
 */
export function purchaseLine(l: PurchaseLineMoney): PurchaseLineComputedMoney {
  const afterPct = l.unitCostBeforeDisc * (1 - l.discountPct / 100);
  const unitCostBeforeTax = round2(Math.max(0, afterPct - l.discountFlat));
  const lineTotal = round2(unitCostBeforeTax * l.qty * (1 + l.taxPct / 100));
  return { unitCostBeforeTax, lineTotal };
}

export interface PurchaseTotalsMoneyInput {
  lines: PurchaseLineMoney[];
  orderDiscountType: 'flat' | 'percent';
  orderDiscountValue: number;
  taxPct: number;
  shipping: number;
  other: number;
}

export interface PurchaseTotalsMoney {
  /** Gross: sum of unitCostBeforeDisc × qty, as the backend reports it. */
  subtotal: number;
  totalLineDiscount: number;
  orderDiscount: number;
  taxableBase: number;
  tax: number;
  shipping: number;
  other: number;
  total: number;
}

/** Mirrors `computePurchaseTotals`. */
export function purchaseTotals(i: PurchaseTotalsMoneyInput): PurchaseTotalsMoney {
  let gross = 0;
  let afterLine = 0;
  for (const l of i.lines) {
    const c = purchaseLine(l);
    gross += l.unitCostBeforeDisc * l.qty;
    afterLine += c.unitCostBeforeTax * l.qty;
  }
  gross = round2(gross);
  afterLine = round2(afterLine);
  const totalLineDiscount = round2(gross - afterLine);
  const orderDiscount =
    i.orderDiscountType === 'percent'
      ? round2(afterLine * (i.orderDiscountValue / 100))
      : round2(i.orderDiscountValue);
  const taxableBase = round2(Math.max(0, afterLine - orderDiscount));
  const tax = round2(taxableBase * (i.taxPct / 100));
  const total = round2(taxableBase + tax + (i.shipping || 0) + (i.other || 0));
  return {
    subtotal: gross,
    totalLineDiscount,
    orderDiscount,
    taxableBase,
    tax,
    shipping: round2(i.shipping || 0),
    other: round2(i.other || 0),
    total,
  };
}

// ------------------------------------------------------------------ payments

/** Mirrors `computeDue`: never negative, always rounded. */
export function computeDue(total: number, payments: number[]): number {
  return round2(Math.max(0, total - sum2(payments)));
}

/**
 * Markup on COST, as a percentage. Mirrors `marginPct` in backend/core/calc.ts,
 * including returning 0 rather than dividing by zero.
 *
 * NOTE the name: this is (sell − cost) / COST, which is what a shopkeeper means
 * by "I make 50% on that". The Profit & Loss and Product Sell reports use a
 * different figure — gross profit over REVENUE — and the two must not be given
 * the same label on screen.
 */
export function markupOnCostPct(sellPrice: number, cost: number): number {
  if (cost <= 0) return 0;
  return round2(((sellPrice - cost) / cost) * 100);
}
