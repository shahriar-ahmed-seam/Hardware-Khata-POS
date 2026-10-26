import type { PurchaseStatus, ReturnReason, ReturnRefundMethod } from '@/stores/purchases';

/** Words for raw purchase keys (each is a Bangla dictionary key). */
export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  received: 'Received',
  ordered: 'Ordered',
  'in-transit': 'In transit',
  cancelled: 'Cancelled',
};

export const PURCHASE_STATUS_VARIANT: Record<PurchaseStatus, 'success' | 'warning' | 'destructive'> = {
  received: 'success',
  ordered: 'warning',
  'in-transit': 'warning',
  cancelled: 'destructive',
};

export const RETURN_REASONS: { id: ReturnReason; label: string }[] = [
  { id: 'damaged', label: 'Damaged' },
  { id: 'wrong-item', label: 'Wrong item' },
  { id: 'expired', label: 'Expired' },
  { id: 'short-shipped', label: 'Short shipped' },
  { id: 'other', label: 'Other' },
];

export const REFUND_LABEL: Record<ReturnRefundMethod, { label: string; hint: string }> = {
  CashRefund: { label: 'Cash refund', hint: 'The supplier gives cash back.' },
  CreditAdjust: { label: 'Take off dues', hint: 'Lowers what you owe this supplier. No money changes hands.' },
  Bank: { label: 'Bank reversal', hint: 'The supplier sends the money back to the bank.' },
  bKash: { label: 'bKash', hint: 'The supplier sends the money back by bKash.' },
  Nagad: { label: 'Nagad', hint: 'The supplier sends the money back by Nagad.' },
};

export const reasonLabel = (r: string) => RETURN_REASONS.find((x) => x.id === r)?.label ?? r;
export const refundLabel = (m: string) => REFUND_LABEL[m as ReturnRefundMethod]?.label ?? m;

/** Supplier pay terms: stored codes → words (values unchanged). */
export const PAY_TERMS: { value: string; label: string }[] = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Net7', label: '7 days' },
  { value: 'Net15', label: '15 days' },
  { value: 'Net30', label: '30 days' },
  { value: 'Net60', label: '60 days' },
];
export const payTermLabel = (t?: string) => PAY_TERMS.find((x) => x.value === t)?.label ?? t ?? '';
