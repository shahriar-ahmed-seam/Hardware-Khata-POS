import { round2, sum2 } from './money.ts';

/**
 * ============================================================================
 *  PURE CALCULATION CORE
 *  Every monetary computation in the app funnels through these functions so the
 *  math is consistent between POS, Sales, Purchases, Reports, and the seeder.
 * ============================================================================
 */

// ---------- Sale line ----------
export interface SaleLineInput {
  qty: number;
  spr: number;          // selling price reference (base price for the price group)
  markupPct: number;    // optional markup on top of SPR
  discountPct: number;  // line discount %
  discountFlat: number; // line discount flat (BDT)
}

export interface SaleLineComputed {
  unitPrice: number;    // spr * (1 + markup/100)
  lineSubtotal: number; // max(0, unitPrice*qty*(1-disc%/100) - discFlat)
}

export function computeSaleLine(l: SaleLineInput): SaleLineComputed {
  const unitPrice = round2(l.spr * (1 + l.markupPct / 100));
  const gross = unitPrice * l.qty;
  const afterPct = gross * (1 - l.discountPct / 100);
  const lineSubtotal = round2(Math.max(0, afterPct - l.discountFlat));
  return { unitPrice, lineSubtotal };
}

// ---------- Sale order totals ----------
export interface SaleTotalsInput {
  lineSubtotals: number[];      // already computed per-line subtotals
  lineGrosses: number[];        // unitPrice*qty per line (pre line-discount), for total line discount
  orderDiscountPct: number;
  orderDiscountFlat: number;
  taxPct: number;               // order-level VAT %
  shipping: number;
  other: number;
  roundOff?: number;            // optional manual round-off (+/-)
}

export interface SaleTotals {
  subtotal: number;            // sum of line subtotals (after line discounts)
  totalLineDiscount: number;   // sum(lineGross) - sum(lineSubtotal)
  orderDiscount: number;
  taxableBase: number;
  tax: number;
  shipping: number;
  other: number;
  roundOff: number;
  total: number;
}

export function computeSaleTotals(i: SaleTotalsInput): SaleTotals {
  const subtotal = sum2(i.lineSubtotals);
  const grossSum = sum2(i.lineGrosses);
  const totalLineDiscount = round2(grossSum - subtotal);
  const orderDiscount = round2(
    subtotal * (i.orderDiscountPct / 100) + i.orderDiscountFlat,
  );
  const taxableBase = round2(Math.max(0, subtotal - orderDiscount));
  const tax = round2(taxableBase * (i.taxPct / 100));
  const roundOff = i.roundOff ?? 0;
  const total = round2(taxableBase + tax + (i.shipping || 0) + (i.other || 0) + roundOff);
  return {
    subtotal,
    totalLineDiscount,
    orderDiscount,
    taxableBase,
    tax,
    shipping: round2(i.shipping || 0),
    other: round2(i.other || 0),
    roundOff: round2(roundOff),
    total,
  };
}

// ---------- COGS / profit ----------
export interface CogsLine {
  qty: number;
  unitCostAtSale: number;
}

export function computeCogs(lines: CogsLine[]): number {
  return sum2(lines.map((l) => l.qty * l.unitCostAtSale));
}

/** Gross profit for a sale = (subtotal - orderDiscount) - cogs. */
export function computeSaleProfit(subtotal: number, orderDiscount: number, cogs: number): number {
  return round2(subtotal - orderDiscount - cogs);
}

// ---------- Purchase line ----------
export interface PurchaseLineInput {
  qty: number;
  unitCostBeforeDisc: number;
  discountPct: number;
  discountFlat: number;
  taxPct: number;
}

export interface PurchaseLineComputed {
  unitCostBeforeTax: number;
  lineTotal: number; // unitCostBeforeTax * qty * (1 + taxPct/100)
}

export function computePurchaseLine(l: PurchaseLineInput): PurchaseLineComputed {
  const afterPct = l.unitCostBeforeDisc * (1 - l.discountPct / 100);
  const unitCostBeforeTax = round2(Math.max(0, afterPct - l.discountFlat));
  const lineTotal = round2(unitCostBeforeTax * l.qty * (1 + l.taxPct / 100));
  return { unitCostBeforeTax, lineTotal };
}

// ---------- Purchase totals ----------
export interface PurchaseTotalsInput {
  lines: PurchaseLineInput[];
  orderDiscountType: 'flat' | 'percent';
  orderDiscountValue: number;
  taxPct: number;
  shipping: number;
  other: number;
}

export interface PurchaseTotals {
  subtotal: number;          // sum of gross (unitCostBeforeDisc * qty)
  totalLineDiscount: number;
  orderDiscount: number;
  taxableBase: number;
  tax: number;
  shipping: number;
  other: number;
  total: number;
}

export function computePurchaseTotals(i: PurchaseTotalsInput): PurchaseTotals {
  let gross = 0;
  let afterLine = 0;
  for (const l of i.lines) {
    const c = computePurchaseLine(l);
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

// ---------- Payments / due ----------
export function computeDue(total: number, payments: number[]): number {
  const paid = sum2(payments);
  return round2(Math.max(0, total - paid));
}

export function computePaid(payments: number[]): number {
  return sum2(payments);
}

// ---------- Margin ----------
export function marginPct(sellPrice: number, cost: number): number {
  if (cost <= 0) return 0;
  return round2(((sellPrice - cost) / cost) * 100);
}

// ---------- Cash drawer ----------
export interface CashExpectedInput {
  openingCash: number;
  cashIn: number;   // sum of all 'in' movements (sales paid in cash, manual in)
  cashOut: number;  // sum of all 'out' movements (refunds, expenses, supplier paid, manual out)
}

export function computeExpectedCash(i: CashExpectedInput): number {
  return round2(i.openingCash + i.cashIn - i.cashOut);
}

export function computeVariance(counted: number, expected: number): number {
  return round2(counted - expected);
}
