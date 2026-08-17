export type PriceGroup = 'retail' | 'wholesale' | 'contractor';
import { saleLineSubtotal, saleTotals, saleUnitPrice } from '@/lib/money';

export type CartLine = {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unit: string; // chosen unit short code
  availableUnits: string[];
  basePrice: number; // SPR — selling price reference (after price group)
  markupPct: number; // optional markup applied to SPR for unit price
  discountPct: number; // 0..100
  discountFlat: number; // BDT
  taxPct: number; // line tax (often 0 — VAT applied at order level)
  /**
   * The cashier typed this line's selling price by hand.
   *
   * A hardware counter bargains: "give me 20 pieces for 240 each". That price
   * belongs to THIS SALE ONLY — the product's catalogue price must not change,
   * so nothing here is ever written back to `products.price`. The sale is stored
   * at the typed price (POS sends `spr: l.basePrice` to `sales.create`, which is
   * per-line by design), and the catalogue is left alone.
   *
   * The flag exists so the two places that RE-PRICE a cart leave the override
   * standing: switching price group, and revalidating a cart restored from disk
   * (see stores/posCart.ts). Without it, an agreed price would silently snap back
   * to the list price and the customer would be charged the wrong amount.
   */
  priceOverride?: boolean;
};

export type ParkedCart = {
  id: string;
  label: string;
  lines: CartLine[];
  customerId: string;
  priceGroup: PriceGroup;
  orderDiscountPct: number;
  orderDiscountFlat: number;
  orderTaxPct: number; // VAT default
  shippingCharge: number;
  otherCharge: number;
};

/**
 * The cart's money math now delegates to `src/lib/money.ts`, which mirrors
 * `backend/core/calc.ts` step for step — INCLUDING the rounding.
 *
 * These used to be unrounded, while the backend rounds the unit price before
 * multiplying by quantity and rounds every sum. On `basePrice 99.99` with a 5%
 * markup and qty 1000 the cart said ৳104,989.50 and the invoice stored
 * ৳104,990.00. POS caps the payments it sends at the CART total, so a sale paid
 * in full to the last paisa was persisted with a ৳0.50 due that no payment
 * screen could clear.
 */
export function unitPrice(line: CartLine) {
  return saleUnitPrice(line.basePrice, line.markupPct);
}

export function lineSubtotal(line: CartLine) {
  return saleLineSubtotal({
    qty: line.qty,
    unitPrice: unitPrice(line),
    discountPct: line.discountPct,
    discountFlat: line.discountFlat,
  });
}

export interface OrderTotals {
  /** GROSS, before line discounts — what the cart labels "Subtotal". */
  subtotal: number;
  /** After line discounts. This is what the backend stores as `sales.subtotal`. */
  netSubtotal: number;
  totalLineDiscount: number;
  orderDiscount: number;
  taxableBase: number;
  tax: number;
  shipping: number;
  other: number;
  total: number;
}

export function computeTotals(cart: ParkedCart): OrderTotals {
  const t = saleTotals({
    lines: cart.lines.map((l) => ({
      qty: l.qty,
      unitPrice: unitPrice(l),
      discountPct: l.discountPct,
      discountFlat: l.discountFlat,
    })),
    orderDiscountPct: cart.orderDiscountPct,
    orderDiscountFlat: cart.orderDiscountFlat,
    taxPct: cart.orderTaxPct,
    shipping: cart.shippingCharge || 0,
    other: cart.otherCharge || 0,
  });
  return {
    // `subtotal` here is the GROSS, before line discounts, because the cart shows
    // "Subtotal" and "Line discounts" as two rows. The backend's `sales.subtotal`
    // column is the NET figure (`t.subtotal`) — the same word for two things, so
    // `netSubtotal` is exposed alongside for anything that must match the invoice.
    subtotal: t.gross,
    netSubtotal: t.subtotal,
    totalLineDiscount: t.totalLineDiscount,
    orderDiscount: t.orderDiscount,
    taxableBase: t.taxableBase,
    tax: t.tax,
    shipping: t.shipping,
    other: t.other,
    total: t.total,
  };
}
