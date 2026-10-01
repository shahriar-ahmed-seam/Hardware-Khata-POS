import { QueryClient } from '@tanstack/react-query';

/**
 * The app's one QueryClient, shared so a write made outside React Query (the
 * zustand stores, the POS) can tell it what went stale.
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 30, refetchOnWindowFocus: false } },
});

/**
 * WHAT A WRITE MAKES STALE (R84).
 *
 * Writes went through the stores, and nothing told the cached lists: after a
 * sale the product picker still showed the old stock, the POS still showed the
 * customer's old due, and a refund or a supplier payment left the drawer figure
 * behind until the page was reopened. `api()` (src/lib/api.ts) calls
 * `afterWrite(channel)` after every successful write, so no caller can forget.
 *
 * `writeEffect` says what a channel makes stale: query keys, and whether cash
 * may have moved (the drawer figure is a store, told by an event).
 *
 * Only these verbs write. Listed rather than guessed from "not a read": a read
 * that looked like a write here (`products.costHistory`) would invalidate its
 * own query, refetch, and invalidate again — a loop.
 */
const WRITE =
  /\.(create|update|convert|addPayment|void|delete|pay|receive|cancel|setCost|archive|unarchive|move|openShift|openShiftFor|closeShift)$/;
const STOCK = /^(sales|sellReturns|purchases|purchaseReturns|adjustments|transfers|products)\./;
const CUSTOMER_DUE = /^(sales|sellReturns|customers)\./;
const CASH =
  /^(sales\.(create|update|convert|addPayment|void)|sellReturns\.create|purchases\.(create|update|cancel|addPayment|receive)|purchaseReturns\.create|customers\.pay|suppliers\.pay|expenses\.|cash\.)/;

export interface WriteEffect {
  keys: string[];
  cash: boolean;
}

export function writeEffect(channel: string): WriteEffect {
  if (!WRITE.test(channel)) return { keys: [], cash: false };
  const keys: string[] = [];
  if (STOCK.test(channel)) keys.push('products');
  if (CUSTOMER_DUE.test(channel)) keys.push('customers');
  return { keys, cash: CASH.test(channel) };
}

/** Event the cash register store listens for (src/stores/cashRegister.ts). */
export const CASH_CHANGED_EVENT = 'pos:cash-changed';

export function afterWrite(channel: string): void {
  const effect = writeEffect(channel);
  for (const key of effect.keys) void queryClient.invalidateQueries({ queryKey: [key] });
  if (effect.cash && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CASH_CHANGED_EVENT, { detail: { channel } }));
  }
}
