export type PriceGroup = 'retail' | 'wholesale' | 'contractor';

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

export function unitPrice(line: CartLine) {
  return line.basePrice * (1 + line.markupPct / 100);
}

export function lineSubtotal(line: CartLine) {
  const gross = unitPrice(line) * line.qty;
  const afterPct = gross * (1 - line.discountPct / 100);
  const afterFlat = afterPct - line.discountFlat;
  return Math.max(0, afterFlat);
}

export interface OrderTotals {
  subtotal: number;
  totalLineDiscount: number;
  orderDiscount: number;
  taxableBase: number;
  tax: number;
  shipping: number;
  other: number;
  total: number;
}

export function computeTotals(cart: ParkedCart): OrderTotals {
  // Sum of "gross" before any line discount, used to show subtotal
  let gross = 0;
  let afterLineDiscount = 0;
  for (const l of cart.lines) {
    const g = unitPrice(l) * l.qty;
    gross += g;
    afterLineDiscount += lineSubtotal(l);
  }
  const totalLineDiscount = gross - afterLineDiscount;
  const orderDiscount =
    afterLineDiscount * (cart.orderDiscountPct / 100) + cart.orderDiscountFlat;
  const taxableBase = Math.max(0, afterLineDiscount - orderDiscount);
  const tax = taxableBase * (cart.orderTaxPct / 100);
  const shipping = cart.shippingCharge || 0;
  const other = cart.otherCharge || 0;
  const total = taxableBase + tax + shipping + other;
  return {
    subtotal: gross,
    totalLineDiscount,
    orderDiscount,
    taxableBase,
    tax,
    shipping,
    other,
    total,
  };
}
