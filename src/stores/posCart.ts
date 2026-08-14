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

/**
 * Build an empty cart. The LABEL is not set here — `renumber()` owns labels.
 *
 * The `id` still comes from a monotonic counter, and must: it is a React key and
 * the handle every mutation matches on, so it can never be reused.
 */
export function makeCart(defaults: { taxPct: number }): ParkedCart {
  return {
    id: `cart_${Date.now()}_${(cartCounter += 1)}`,
    label: '',
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

/**
 * Label every open cart by its POSITION: Cart 1 … Cart N.
 *
 * WHY NOT A MONOTONIC COUNTER (which is what this used to do)
 * A never-reused counter meant the numbers only ever climbed: open a few carts,
 * close them, and the next one was "Cart 14" with a single cart on screen. The
 * cashier calls out "cart three" across the counter, so the number has to mean
 * "the third tab", not "the fourteenth cart since this PC was set up".
 *
 * The original reason for the counter was that `carts.length + 1` produced a
 * DUPLICATE "Cart 3" when you closed the middle of three tabs. Renumbering the
 * whole row on every add/close fixes that properly: labels are always exactly
 * 1..N, with no gaps and no repeats.
 *
 * Returns the same object identity for carts whose label is already correct, so
 * React does not re-render untouched tabs.
 */
function renumber(carts: ParkedCart[]): ParkedCart[] {
  return carts.map((c, i) => {
    const label = `Cart ${i + 1}`;
    return c.label === label ? c : { ...c, label };
  });
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
      needsRevalidation: false,

      ensureInitialized: (d) => {
        const s = get();
        if (s.carts.length > 0) {
          // Storage could hold an activeId that no longer matches a cart (an
          // interrupted write, or a hand-edited store). Without this the POS
          // page's `carts.find(...)!` would be undefined and crash on render.
          const patch: Partial<State> = {};
          if (!s.carts.some((c) => c.id === s.activeId)) patch.activeId = s.carts[0].id;
          // Also re-label: a store written by an older build carries the old
          // runaway numbers ("Cart 14" on its own).
          const renumbered = renumber(s.carts);
          if (renumbered.some((c, i) => c !== s.carts[i])) patch.carts = renumbered;
          if (Object.keys(patch).length > 0) set(patch);
          return;
        }
        const first = makeCart(d);
        set({ carts: renumber([first]), activeId: first.id });
      },

      setActiveId: (activeId) => set({ activeId }),

      setActiveCart: (next) =>
        set((s) => ({ carts: s.carts.map((c) => (c.id === s.activeId ? next : c)) })),

      addCart: (d) =>
        set((s) => {
          const c = makeCart(d);
          return { carts: renumber([...s.carts, c]), activeId: c.id };
        }),

      closeCart: (id, d) =>
        set((s) => {
          const next = s.carts.filter((c) => c.id !== id);
          if (next.length === 0) {
            // Never leave the screen with zero carts.
            const fresh = makeCart(d);
            return { carts: renumber([fresh]), activeId: fresh.id };
          }
          // Renumber so the remaining tabs read 1..N — closing "Cart 1" of three
          // must leave "Cart 1, Cart 2", not "Cart 2, Cart 3".
          return {
            carts: renumber(next),
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
          const fresh = makeCart(d);
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
          const fresh = makeCart(d);
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
      // v2: cart labels are positional (Cart 1..N) instead of coming from a
      // monotonic `nextCartNo`, which is dropped. The migration relabels whatever
      // is on disk so an upgraded install does not keep showing "Cart 14".
      version: 2,
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<State> & { nextCartNo?: number };
        if (version < 2) {
          const { nextCartNo: _dropped, ...rest } = s;
          return { ...rest, carts: renumber(rest.carts ?? []) } as State;
        }
        return s as State;
      },
      // Only the durable sale state. Nothing derived, nothing transient.
      partialize: (s) => ({
        carts: s.carts,
        activeId: s.activeId,
        held: s.held,
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
