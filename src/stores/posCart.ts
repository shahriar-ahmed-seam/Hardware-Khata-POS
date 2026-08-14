import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ParkedCart, PriceGroup } from '@/components/pos/types';

/**
 * POS CART STATE — persisted.
 *
 * WHY THIS STORE EXISTS
 * `carts`, `activeId` and `held` used to be `useState` inside `src/pages/POS.tsx`.
 * Navigating to any other tab unmounts that component, so React discarded every
 * open cart — a half-built sale vanished if the cashier stepped away to check a
 * customer's balance. Held/suspended carts were worse: "Suspend" implies the
 * shop can come back to it later, and an app restart silently destroyed it.
 *
 * Persisting here fixes both, and survives a restart.
 *
 * WHAT IS DELIBERATELY *NOT* HERE
 *  - `submitting` / modal open flags — transient UI, must never be restored.
 *  - Layout prefs (orientation, split ratio, grid/list) — those live in
 *    `usePOS`, which is a separate concern with its own storage key.
 *
 * THE PRICE-STALENESS RULE (see `revalidate`)
 * A cart line snapshots `basePrice`, `name` and `sku` when the product is added.
 * That was harmless while carts died on unmount. Once they survive for days, a
 * restored cart would happily sell at last week's price, so restored carts are
 * revalidated against the live catalogue before the cashier can charge anyone.
 */

let cartCounter = 0;

/** Build an empty cart. Labels come from a monotonic counter, never from
 *  `carts.length + 1` — closing the middle tab of three used to produce a second
 *  "Cart 3". */
export function makeCart(no: number, defaults: { taxPct: number }): ParkedCart {
  return {
    id: `cart_${Date.now()}_${(cartCounter += 1)}`,
    label: `Cart ${no}`,
    lines: [],
    customerId: 'cu1',
    priceGroup: 'retail',
    orderDiscountPct: 0,
    orderDiscountFlat: 0,
    orderTaxPct: defaults.taxPct,
    shippingCharge: 0,
    otherCharge: 0,
  };
}

/** Resolves the current catalogue price of a product for a given price group. */
export type PriceResolver = (
  productId: string,
  group: PriceGroup,
) => { price: number; name: string; sku: string } | undefined;

export interface RevalidationResult {
  /** Lines dropped because the product no longer exists in the catalogue. */
  removed: string[];
  /** Lines whose base price was moved to the current catalogue price. */
  repriced: { name: string; from: number; to: number }[];
}

interface Defaults {
  taxPct: number;
}

interface State {
  carts: ParkedCart[];
  activeId: string;
  held: ParkedCart[];
  /** Next cart number for labelling. Monotonic; never reused. */
  nextCartNo: number;
  /**
   * True when this state came off disk and has not been checked against the
   * live catalogue yet. Set by the rehydrate hook, cleared by `revalidate`.
   */
  needsRevalidation: boolean;

  /** Create the first cart if storage was empty. Safe to call on every mount. */
  ensureInitialized: (d: Defaults) => void;
  setActiveId: (id: string) => void;
  /** Replace the ACTIVE cart wholesale (the panel's single mutation path). */
  setActiveCart: (next: ParkedCart) => void;
  addCart: (d: Defaults) => void;
  closeCart: (id: string, d: Defaults) => void;
  clearActive: () => void;
  /** Empty the active slot but keep its id + label (used after a sale). */
  resetActiveSlot: (d: Defaults) => void;
  suspendActive: (d: Defaults) => void;
  resumeHeld: (id: string) => void;
  discardHeld: (id: string) => void;
  /**
   * Change the active cart's price group AND re-price its existing lines.
   * Switching used to leave the lines at the old group's price, so the tabs
   * said "Wholesale" while retail prices were charged.
   */
  setPriceGroup: (group: PriceGroup, resolve: PriceResolver) => void;
  /** Reconcile every stored cart against the live catalogue. Idempotent. */
  revalidate: (resolve: PriceResolver) => RevalidationResult | null;
}

const EMPTY_RESULT: RevalidationResult = { removed: [], repriced: [] };

export const usePOSCart = create<State>()(
  persist(
    (set, get) => ({
      carts: [],
      activeId: '',
      held: [],
      nextCartNo: 1,
      needsRevalidation: false,

      ensureInitialized: (d) => {
        const s = get();
        if (s.carts.length > 0) {
          // Storage could hold an activeId that no longer matches a cart (an
          // interrupted write, or a hand-edited store). Without this the POS
          // page's `carts.find(...)!` would be undefined and crash on render.
          if (!s.carts.some((c) => c.id === s.activeId)) {
            set({ activeId: s.carts[0].id });
          }
          return;
        }
        const first = makeCart(s.nextCartNo, d);
        set({ carts: [first], activeId: first.id, nextCartNo: s.nextCartNo + 1 });
      },

      setActiveId: (activeId) => set({ activeId }),

      setActiveCart: (next) =>
        set((s) => ({ carts: s.carts.map((c) => (c.id === s.activeId ? next : c)) })),

      addCart: (d) =>
        set((s) => {
          const c = makeCart(s.nextCartNo, d);
          return { carts: [...s.carts, c], activeId: c.id, nextCartNo: s.nextCartNo + 1 };
        }),

      closeCart: (id, d) =>
        set((s) => {
          const next = s.carts.filter((c) => c.id !== id);
          if (next.length === 0) {
            // Never leave the screen with zero carts.
            const fresh = makeCart(s.nextCartNo, d);
            return { carts: [fresh], activeId: fresh.id, nextCartNo: s.nextCartNo + 1 };
          }
          return {
            carts: next,
            activeId: id === s.activeId ? next[0].id : s.activeId,
          };
        }),

      clearActive: () =>
        set((s) => ({
          carts: s.carts.map((c) => (c.id === s.activeId ? { ...c, lines: [] } : c)),
        })),

      resetActiveSlot: (d) =>
        set((s) => {
          const current = s.carts.find((c) => c.id === s.activeId);
          if (!current) return {};
          const fresh = makeCart(0, d);
          return {
            carts: s.carts.map((c) =>
              c.id === s.activeId ? { ...fresh, id: current.id, label: current.label } : c,
            ),
          };
        }),

      suspendActive: (d) =>
        set((s) => {
          const current = s.carts.find((c) => c.id === s.activeId);
          if (!current || current.lines.length === 0) return {};
          const fresh = makeCart(0, d);
          return {
            held: [...s.held, current],
            carts: s.carts.map((c) =>
              c.id === s.activeId ? { ...fresh, id: current.id, label: current.label } : c,
            ),
          };
        }),

      resumeHeld: (id) =>
        set((s) => {
          const hc = s.held.find((h) => h.id === id);
          if (!hc) return {};
          const current = s.carts.find((c) => c.id === s.activeId);
          return {
            held: s.held.filter((h) => h.id !== id),
            carts: s.carts.map((c) =>
              c.id === s.activeId ? { ...hc, id: c.id, label: current?.label ?? c.label } : c,
            ),
          };
        }),

      discardHeld: (id) => set((s) => ({ held: s.held.filter((h) => h.id !== id) })),

      setPriceGroup: (group, resolve) =>
        set((s) => ({
          carts: s.carts.map((c) => {
            if (c.id !== s.activeId) return c;
            return {
              ...c,
              priceGroup: group,
              // Re-price every line to the NEW group. Per-line markup and
              // discounts are intentionally preserved — they are the cashier's
              // own adjustments, not a property of the price group.
              lines: c.lines.map((l) => {
                const hit = resolve(l.productId, group);
                return hit ? { ...l, basePrice: hit.price } : l;
              }),
            };
          }),
        })),

      revalidate: (resolve) => {
        const s = get();
        if (!s.needsRevalidation) return null;

        const result: RevalidationResult = { removed: [], repriced: [] };

        const fix = (cart: ParkedCart): ParkedCart => {
          const lines = [];
          for (const l of cart.lines) {
            const hit = resolve(l.productId, cart.priceGroup);
            if (!hit) {
              // The product was deleted while the cart sat on disk. Keeping the
              // line would fail at `sales.create` with a foreign-key error the
              // cashier cannot act on.
              result.removed.push(l.name);
              continue;
            }
            if (Math.abs(hit.price - l.basePrice) > 0.001) {
              result.repriced.push({ name: hit.name, from: l.basePrice, to: hit.price });
              lines.push({ ...l, basePrice: hit.price, name: hit.name, sku: hit.sku });
            } else {
              lines.push({ ...l, name: hit.name, sku: hit.sku });
            }
          }
          return { ...cart, lines };
        };

        set({
          carts: s.carts.map(fix),
          held: s.held.map(fix),
          needsRevalidation: false,
        });

        return result.removed.length || result.repriced.length ? result : EMPTY_RESULT;
      },
    }),
    {
      name: 'pos-carts',
      version: 1,
      // Only the durable sale state. Nothing derived, nothing transient.
      partialize: (s) => ({
        carts: s.carts,
        activeId: s.activeId,
        held: s.held,
        nextCartNo: s.nextCartNo,
      }),
      onRehydrateStorage: () => (state) => {
        // Anything restored from disk predates the current catalogue read, so
        // mark it for the price/existence check in `revalidate`.
        if (state && (state.carts.length > 0 || state.held.length > 0)) {
          state.needsRevalidation = true;
        }
      },
    },
  ),
);
