import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Orientation = 'cart-left' | 'cart-right';
export type ProductView = 'grid' | 'list';

interface POSState {
  orientation: Orientation;
  cartRatio: number; // 0-1, fraction of width occupied by the cart panel
  productView: ProductView;
  showOutOfStock: boolean;
  allowNegativeStock: boolean;
  defaultPriceMarkupPct: number; // applied as default to new cart lines (e.g. 0 or 20)
  defaultOrderTaxPct: number; // VAT default, e.g. 15
  setOrientation: (o: Orientation) => void;
  swapOrientation: () => void;
  setCartRatio: (r: number) => void;
  setProductView: (v: ProductView) => void;
  setShowOutOfStock: (v: boolean) => void;
  setAllowNegativeStock: (v: boolean) => void;
  setDefaultPriceMarkupPct: (v: number) => void;
  setDefaultOrderTaxPct: (v: number) => void;
}

export const usePOS = create<POSState>()(
  persist(
    (set) => ({
      orientation: 'cart-left',
      cartRatio: 0.65,
      productView: 'grid',
      showOutOfStock: true,
      allowNegativeStock: false,
      defaultPriceMarkupPct: 0,
      defaultOrderTaxPct: 0,
      setOrientation: (orientation) => set({ orientation }),
      swapOrientation: () =>
        set((s) => ({ orientation: s.orientation === 'cart-left' ? 'cart-right' : 'cart-left' })),
      setCartRatio: (cartRatio) => set({ cartRatio: Math.min(0.85, Math.max(0.25, cartRatio)) }),
      setProductView: (productView) => set({ productView }),
      setShowOutOfStock: (showOutOfStock) => set({ showOutOfStock }),
      setAllowNegativeStock: (allowNegativeStock) => set({ allowNegativeStock }),
      setDefaultPriceMarkupPct: (defaultPriceMarkupPct) => set({ defaultPriceMarkupPct }),
      setDefaultOrderTaxPct: (defaultOrderTaxPct) => set({ defaultOrderTaxPct }),
    }),
    { name: 'pos-layout' },
  ),
);
