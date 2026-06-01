/**
 * PURCHASE PREFILL HANDOFF
 *
 * Tiny, transport-agnostic contract used to carry a set of products + suggested
 * quantities from one screen (e.g. Stock Alerts → "Create Purchase") into the
 * Add Purchase form. The producer writes the prefill and navigates to
 * `/purchases/new?prefill=alerts`; AddPurchase reads + clears it on mount.
 *
 * sessionStorage is used so the handoff survives the route change (and a single
 * reload) but never leaks across browser sessions. Works in both mock and
 * backend modes — the product ids are resolved against whatever product source
 * the consuming form uses.
 */

const KEY = 'purchase_prefill';

export interface PurchasePrefillLine {
  productId: string;
  qty: number;
}

/** Stash the prefill lines for AddPurchase to pick up. No-op for an empty list. */
export function setPurchasePrefill(lines: PurchasePrefillLine[]): void {
  if (!lines.length) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* sessionStorage unavailable (rare) — silently skip; the form just opens empty. */
  }
}

/** Read + CLEAR the prefill lines (one-shot). Returns [] when none are pending. */
export function consumePurchasePrefill(): PurchasePrefillLine[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is PurchasePrefillLine => !!x && typeof x.productId === 'string')
      .map((x) => ({ productId: x.productId, qty: Math.max(1, Number(x.qty) || 1) }));
  } catch {
    return [];
  }
}
