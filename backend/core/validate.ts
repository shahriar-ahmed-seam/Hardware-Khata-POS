/**
 * INPUT CHECKS FOR MONEY AND STOCK DOCUMENTS — pure, no database.
 *
 * The services trusted whatever the screen sent. A sale line with quantity −5
 * put five pieces INTO stock (the sale movement is −qty), a discount bigger than
 * the bill was stored and drove profit negative, NaN travelled into totals, and
 * 'cash' in lower case skipped the drawer because only 'Cash' posts to it. The
 * screens mostly prevent these, but an import, a script or a future screen
 * would not, and the books cannot depend on every caller being careful.
 *
 * Every check throws an Error whose message is a complete sentence the shop
 * can read in a toast.
 */

/** Money within a paisa. */
const EPS = 0.005;

/**
 * The payment methods the books know. Matched case-insensitively and stored in
 * this spelling, because 'Cash' decides whether the drawer is involved.
 */
export const PAYMENT_METHODS = ['Cash', 'bKash', 'Nagad', 'Rocket', 'Card', 'Bank', 'Cheque'] as const;
export type PaymentMethodName = (typeof PAYMENT_METHODS)[number];

/** The seeded walk-in customer. It is a row, but nobody owes anything as it. */
export const WALK_IN_CUSTOMER_ID = 'cu1';

/** True when a sale has nobody to hold a balance: no customer, or the walk-in. */
export function isWalkIn(customerId: string | null | undefined): boolean {
  return !customerId || customerId === WALK_IN_CUSTOMER_ID;
}

/** The stored spelling of a payment method, or a readable refusal. */
export function canonicalMethod(method: unknown): PaymentMethodName {
  const raw = typeof method === 'string' ? method.trim().toLowerCase() : '';
  const hit = PAYMENT_METHODS.find((m) => m.toLowerCase() === raw);
  if (!hit) {
    throw new Error(
      `"${String(method ?? '')}" is not a payment method. Use one of: ${PAYMENT_METHODS.join(', ')}.`,
    );
  }
  return hit;
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** A number that must be present, finite and within [min, max]. */
function requireNumber(label: string, v: unknown, min: number, max = Number.POSITIVE_INFINITY): number {
  if (!finite(v)) throw new Error(`${label} must be a number.`);
  if (v < min - 1e-9) throw new Error(`${label} cannot be below ${min}.`);
  if (v > max + 1e-9) throw new Error(`${label} cannot be above ${max}.`);
  return v;
}

/** An optional number: undefined/null is fine, anything else is checked. */
function optionalNumber(label: string, v: unknown, min: number, max?: number): void {
  if (v === undefined || v === null) return;
  requireNumber(label, v, min, max);
}

export interface LineLike {
  productId: string;
  qty: number;
  /** Selling price (sales) or unit cost before discount (purchases). */
  price: number;
  discountPct?: number;
  discountFlat?: number;
  unitFactor?: number;
}

/**
 * Every line of a sale or a purchase: a product, a quantity above zero, a price
 * that is not negative, a discount within the line.
 */
export function assertDocumentLines(lines: readonly LineLike[] | undefined, kind: 'sale' | 'purchase'): void {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error(kind === 'sale' ? 'A sale needs at least one item.' : 'A purchase needs at least one item.');
  }
  lines.forEach((l, i) => {
    const n = `Line ${i + 1}`;
    if (!l || typeof l.productId !== 'string' || !l.productId) {
      throw new Error(`${n} has no product.`);
    }
    if (!finite(l.qty) || l.qty <= 0) {
      throw new Error(`${n}: the quantity must be above zero.`);
    }
    requireNumber(kind === 'sale' ? `${n}: the price` : `${n}: the cost`, l.price, 0);
    optionalNumber(`${n}: the discount %`, l.discountPct, 0, 100);
    optionalNumber(`${n}: the discount`, l.discountFlat, 0);
    if (l.unitFactor !== undefined && l.unitFactor !== null) {
      if (!finite(l.unitFactor) || l.unitFactor <= 0) {
        throw new Error(`${n}: the pack size must be above zero.`);
      }
    }
    const gross = l.price * l.qty;
    if (finite(l.discountFlat) && l.discountFlat > gross + EPS) {
      throw new Error(`${n}: the discount is more than the line is worth.`);
    }
  });
}

export interface ChargesLike {
  orderDiscountPct?: number;
  orderDiscountFlat?: number;
  /** Purchases express the order discount as one value. */
  orderDiscountValue?: number;
  orderDiscountType?: 'flat' | 'percent';
  taxPct?: number;
  shipping?: number;
  other?: number;
  roundOff?: number;
}

/** A manual round-off is for the last few taka of a bill, never a discount. */
export const MAX_ROUND_OFF = 10;

/** The bill-level figures, before any total is computed. */
export function assertOrderCharges(c: ChargesLike): void {
  optionalNumber('The order discount %', c.orderDiscountPct, 0, 100);
  optionalNumber('The order discount', c.orderDiscountFlat, 0);
  if (c.orderDiscountValue !== undefined && c.orderDiscountValue !== null) {
    if (c.orderDiscountType === 'percent') requireNumber('The order discount %', c.orderDiscountValue, 0, 100);
    else requireNumber('The order discount', c.orderDiscountValue, 0);
  }
  if (c.orderDiscountType !== undefined && c.orderDiscountType !== 'flat' && c.orderDiscountType !== 'percent') {
    throw new Error('The order discount must be flat or a percentage.');
  }
  optionalNumber('VAT %', c.taxPct, 0, 100);
  optionalNumber('Shipping', c.shipping, 0);
  optionalNumber('The other charge', c.other, 0);
  optionalNumber('The round-off', c.roundOff, -MAX_ROUND_OFF, MAX_ROUND_OFF);
}

/** After the totals are known: the order discount can never exceed the goods. */
export function assertDiscountWithinSubtotal(orderDiscount: number, subtotal: number): void {
  if (orderDiscount > subtotal + EPS) {
    throw new Error('The order discount is more than the items are worth.');
  }
}

export interface PaymentLike {
  method: string;
  amount: number;
}

/**
 * Payments: a real method and an amount above zero. Returns them with the
 * method in its stored spelling.
 */
export function normalisePayments<T extends PaymentLike>(payments: readonly T[] | undefined): T[] {
  if (payments === undefined || payments === null) return [];
  if (!Array.isArray(payments)) throw new Error('Payments must be a list.');
  return payments.map((p, i) => {
    if (!p || !finite(p.amount) || p.amount <= 0) {
      throw new Error(`Payment ${i + 1}: the amount must be above zero.`);
    }
    return { ...p, method: canonicalMethod(p.method) };
  });
}

/**
 * বাকি NEEDS A NAME, and so does an advance.
 *
 * Money left owing on a walk-in sale is on nobody's khata: it shows as unpaid on
 * the invoice and appears in no customer's balance and no receivables total.
 * Money paid OVER the bill by a walk-in is the same problem the other way round:
 * the drawer takes it and no account holds it. A named customer may owe, or pay
 * ahead (the extra is a credit on their account, which the payment screens say).
 */
export function assertSaleSettlement(args: {
  customerId: string | null | undefined;
  total: number;
  paid: number;
  credited?: number;
}): void {
  if (!isWalkIn(args.customerId)) return;
  const owing = args.total - args.paid - (args.credited ?? 0);
  if (owing > EPS) {
    throw new Error(
      'Money left owing needs a named customer. Choose the customer, or take the full amount.',
    );
  }
  if (owing < -EPS) {
    throw new Error(
      'A walk-in customer cannot pay more than the bill. Enter the bill amount; give the rest back as change.',
    );
  }
}

/** The supplier-side twin: an advance or an unpaid bill needs a supplier. */
export function assertPurchaseSettlement(args: {
  supplierId: string | null | undefined;
  total: number;
  paid: number;
  credited?: number;
}): void {
  if (args.supplierId) return;
  const owing = args.total - args.paid - (args.credited ?? 0);
  if (owing < -EPS) {
    throw new Error('Paying more than the bill needs a supplier to hold the advance. Choose the supplier.');
  }
}
