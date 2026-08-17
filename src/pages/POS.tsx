import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Splitter } from '@/components/ui/Splitter';
import { CartPanel } from '@/components/pos/CartPanel';
import { ProductPanel } from '@/components/pos/ProductPanel';
import {
  type CartLine,
  type ParkedCart,
  type PriceGroup,
  computeTotals,
} from '@/components/pos/types';
import type { Customer } from '@/types/domain';
import { usePOS } from '@/stores/pos';
import { usePOSCart, type PriceResolver } from '@/stores/posCart';
import { useSettings } from '@/stores/settings';
import { CustomerPicker } from '@/components/pos/CustomerPicker';
import { PaymentModal, type PaymentMethod, type PaymentResult } from '@/components/pos/PaymentModal';
import { HeldList } from '@/components/pos/HeldList';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { ShortcutsOverlay } from '@/components/pos/ShortcutsOverlay';
import { api, apiSafe, hasBackend } from '@/lib/api';
import { useProducts } from '@/hooks/useProducts';
import { useCustomersQuery } from '@/hooks/useCustomers';
import { useBelow } from '@/hooks/useBreakpoint';
import { useAuth } from '@/stores/auth';
import { useSales } from '@/stores/sales';
import { useCashRegister } from '@/stores/cashRegister';
import { toast } from '@/stores/toast';

/**
 * Map a cart 1:1 to the `sales.create` line/order-level fields. The frontend
 * `computeTotals` uses the SAME math as the backend `computeSaleLine`/
 * `computeSaleTotals`, so the backend recomputes matching totals from these.
 */
function buildSalePayloadBase(cart: ParkedCart) {
  return {
    lines: cart.lines.map((l) => ({
      productId: l.productId,
      qty: l.qty,
      unitUsed: l.unit,
      // DEFERRAL: per-line `unitFactor` (multi-unit conversion) is left at the
      // backend default (1). The cart does not track a conversion factor yet, so
      // we pass only the chosen `unitUsed` label. Wire `unitFactor` once the cart
      // models multi-unit packs.
      spr: l.basePrice,
      markupPct: l.markupPct,
      discountPct: l.discountPct,
      discountFlat: l.discountFlat,
      taxPct: l.taxPct,
    })),
    orderDiscountPct: cart.orderDiscountPct,
    orderDiscountFlat: cart.orderDiscountFlat,
    taxPct: cart.orderTaxPct,
    shipping: cart.shippingCharge,
    other: cart.otherCharge,
  };
}

/**
 * Build the `sales.create` payments array from a PaymentResult.
 *
 * Two correctness rules (see backend due/cash routing):
 *  - EXCLUDE every 'Credit' line and any zero/negative amount. The backend
 *    derives `due = total − sum(payments)`, so the un-paid (credit) portion
 *    becomes the customer's due automatically. A Credit line must NOT be a
 *    sale_payment row.
 *  - CAP the cumulative non-credit payments at the invoice total by trimming the
 *    last contributing line (`take = min(line.amount, total − accumulated)`).
 *    This records change-given-back as kept-by-customer, NOT as drawer cash, so
 *    the cash drawer stays exact and due stays exact.
 */
function buildSalePayments(result: PaymentResult, total: number, paidAt: string) {
  const out: { method: string; amount: number; reference?: string; paidAt: string }[] = [];
  let accumulated = 0;
  for (const line of result.payments) {
    if (line.method === 'Credit') continue;
    if (line.amount <= 0) continue;
    const take = Math.min(line.amount, total - accumulated);
    if (take <= 0) continue;
    out.push({ method: line.method, amount: take, reference: line.reference, paidAt });
    accumulated += take;
  }
  return out;
}

export default function POS() {
  // POS layout prefs (orientation / split ratio) stay in usePOS — those are
  // pure device/UI prefs. The default order-tax % and price-markup % are read
  // from useSettings().pos instead, because Settings → POS Prefs is the
  // authoritative, backend-persisted source. (usePOS still holds copies but the
  // Settings page writes the settings store, so reading usePOS here would mean
  // Settings changes never reach a fresh cart. Direction chosen: POS reads
  // settings.pos for the defaults.)
  const { orientation, cartRatio, setCartRatio } = usePOS();
  const defaultOrderTaxPct = useSettings((s) => s.pos.defaultOrderTaxPct);
  const defaultPriceMarkupPct = useSettings((s) => s.pos.defaultPriceMarkupPct);

  // Hydrate settings on mount so the persisted POS defaults are loaded under a
  // backend. Cheap no-op outside Electron.
  useEffect(() => {
    void useSettings.getState().hydrate();
  }, []);

  // ----- Data source: the SQLite backend, exclusively -----
  // Mock product/customer seeds were removed: an empty result now renders an
  // empty grid (ProductPanel/CartPanel handle that) instead of fake stock.
  const qc = useQueryClient();
  const productsQuery = useProducts('br_mp');
  const customersQuery = useCustomersQuery();
  const products = productsQuery.data ?? [];
  const customers: Customer[] = customersQuery.data ?? [];
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false); // synchronous in-flight lock (state lags a render)

  // Permission gate (DEFENSIVE — the IPC layer is the authoritative gate; this
  // only hides/disables the UI). Subscribe to `permissions` so the buttons
  // re-disable if the signed-in user changes. Falls back to the store's
  // role-derived `can()` when the permission array is empty (pre-restore).
  const permissions = useAuth((s) => s.permissions);
  const canCreateSale =
    permissions.length > 0
      ? permissions.includes('sales.create')
      : useAuth.getState().can('sales.create');

  // ----- Cart state lives in a PERSISTED store, not in this component -----
  // It used to be `useState` here, so leaving POS for any other tab unmounted
  // the page and destroyed every open cart (and every suspended one). See
  // src/stores/posCart.ts.
  // Buying prices for the cart rows, read from the SAME live catalogue the grid
  // uses. Looked up per render rather than copied onto the cart line, because
  // carts persist to localStorage and a stored cost would be stale the moment a
  // new buying price is recorded. Unknown product → nulls → the row shows '—'.
  const costOf = useCallback(
    (productId: string): { cost: number | null; avgCost: number | null } => {
      const p = products.find((x) => x.id === productId);
      if (!p) return { cost: null, avgCost: null };
      return { cost: p.cost ?? null, avgCost: p.avgCost ?? p.cost ?? null };
    },
    [products],
  );

  const carts = usePOSCart((s) => s.carts);
  const activeId = usePOSCart((s) => s.activeId);
  const held = usePOSCart((s) => s.held);
  const cartDefaults = useMemo(() => ({ taxPct: defaultOrderTaxPct }), [defaultOrderTaxPct]);

  // Create "Cart 1" on a first ever run, and repair a stored activeId that no
  // longer points at a cart.
  useEffect(() => {
    usePOSCart.getState().ensureInitialized(cartDefaults);
  }, [cartDefaults]);

  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string | 'all'>('all');
  const [activeBrand, setActiveBrand] = useState<string | 'all'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [pickerOpen, setPickerOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStartMode, setPaymentStartMode] = useState<'single' | 'split'>('single');
  const [paymentStartMethod, setPaymentStartMethod] = useState<PaymentMethod>('Cash');
  const [receipt, setReceipt] = useState<{
    invoiceNo: string;
    cart: ParkedCart;
    payment: PaymentResult;
  } | null>(null);
  const [lastReceipt, setLastReceipt] = useState<typeof receipt>(null);

  const active = carts.find((c) => c.id === activeId);

  /**
   * Single mutation path for the active cart.
   *
   * It also intercepts a PRICE GROUP change. `CartPanel` just sets the new group
   * on the cart, and until now nothing re-priced the lines already in it — so a
   * cashier could add three items on Retail, switch the tabs to Wholesale, and
   * the sale would post at retail prices while the UI claimed wholesale. Doing
   * it here keeps the re-pricing rule in one place instead of trusting every
   * caller to remember it.
   */
  const setActiveCart = (next: ParkedCart) => {
    const store = usePOSCart.getState();
    const groupChanged = !!active && next.priceGroup !== active.priceGroup;
    store.setActiveCart(next);
    if (groupChanged) store.setPriceGroup(next.priceGroup, resolvePrice);
  };

  function priceForProduct(p: (typeof products)[number], group: PriceGroup) {
    if (group === 'wholesale' && p.wholesalePrice) return p.wholesalePrice;
    if (group === 'contractor' && p.contractorPrice) return p.contractorPrice;
    return p.price;
  }

  /**
   * Catalogue selling price for a product in the ACTIVE cart's price group.
   *
   * Only used to offer "Undo" on a cart line whose price the cashier typed by
   * hand. Looked up live from the catalogue rather than stored on the line, for
   * the same reason as `costOf`: carts outlive the page.
   */
  const listPriceOf = useCallback(
    (productId: string): number | null => {
      const p = products.find((x) => x.id === productId);
      if (!p) return null;
      return priceForProduct(p, active?.priceGroup ?? 'retail');
    },
    // `priceForProduct` is pure over its arguments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, active?.priceGroup],
  );

  /** Current catalogue price/name/sku for a product, in a given price group. */
  const resolvePrice: PriceResolver = useMemo(
    () => (productId, group) => {
      const p = products.find((x) => x.id === productId);
      if (!p) return undefined;
      return { price: priceForProduct(p, group), name: p.name, sku: p.sku };
    },
    // `priceForProduct` is pure over its arguments; only the catalogue matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products],
  );

  /**
   * Reconcile carts restored from disk against the live catalogue.
   *
   * Runs once the catalogue has actually loaded — a cart persisted yesterday
   * must not be charged at yesterday's price, and a line whose product was
   * deleted would fail at `sales.create` with a foreign-key error the cashier
   * cannot act on. `revalidate` is a no-op unless the state came off disk.
   */
  useEffect(() => {
    if (productsQuery.isLoading || products.length === 0) return;
    const result = usePOSCart.getState().revalidate(resolvePrice);
    if (!result) return;
    if (result.repriced.length > 0) {
      toast.warning(
        result.repriced.length === 1
          ? 'A price changed since this cart was saved'
          : 'Some prices changed since this cart was saved',
        { description: 'The cart now uses the current prices. Please check before taking payment.' },
      );
    }
    if (result.removed.length > 0) {
      toast.error('Some items are no longer in the catalogue', {
        description: `Removed from the cart: ${result.removed.join(', ')}`,
      });
    }
  }, [productsQuery.isLoading, products.length, resolvePrice]);

  function addToCart(productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p || !active) return;
    const idx = active.lines.findIndex((l) => l.productId === productId);
    if (idx >= 0) {
      const lines = [...active.lines];
      lines[idx] = { ...lines[idx], qty: lines[idx].qty + 1 };
      setActiveCart({ ...active, lines });
    } else {
      const newLine: CartLine = {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        qty: 1,
        unit: p.unit,
        availableUnits: p.availableUnits ?? [p.unit],
        basePrice: priceForProduct(p, active.priceGroup),
        markupPct: defaultPriceMarkupPct,
        discountPct: 0,
        discountFlat: 0,
        taxPct: 0,
      };
      setActiveCart({ ...active, lines: [...active.lines, newLine] });
    }
  }

  const bestMatch = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const exact =
      products.find((p) => p.barcode.toLowerCase() === q) ||
      products.find((p) => p.sku.toLowerCase() === q);
    if (exact) return exact;
    return (
      products.find((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) ??
      null
    );
  }, [search, products]);

  const handleSubmitSearch = () => {
    if (bestMatch) {
      addToCart(bestMatch.id);
      setSearch('');
      searchInputRef.current?.focus();
    }
  };

  const setActiveId = (id: string) => usePOSCart.getState().setActiveId(id);
  const addCart = () => usePOSCart.getState().addCart(cartDefaults);
  const closeCart = (id: string) => usePOSCart.getState().closeCart(id, cartDefaults);
  const clearCart = () => usePOSCart.getState().clearActive();

  const onPickCustomer = () => setPickerOpen(true);
  const onSelectCustomer = (id: string) => {
    if (active) setActiveCart({ ...active, customerId: id });
  };

  const totalsForActive = active
    ? computeTotals(active)
    : { subtotal: 0, totalLineDiscount: 0, orderDiscount: 0, tax: 0, shipping: 0, other: 0, total: 0 };

  const openPay = (method: PaymentMethod = 'Cash') => {
    if (!active || active.lines.length === 0) return;
    if (!canCreateSale) {
      toast.error("You don't have permission to create sales");
      return;
    }
    setPaymentStartMode('single');
    setPaymentStartMethod(method);
    setPaymentOpen(true);
  };
  const openSplitPay = () => {
    if (!active || active.lines.length === 0) return;
    if (!canCreateSale) {
      toast.error("You don't have permission to create sales");
      return;
    }
    setPaymentStartMode('split');
    setPaymentOpen(true);
  };

  const handleConfirmPayment = async (result: PaymentResult) => {
    if (submittingRef.current || !active) return; // guard against double-submit
    const snapshot: ParkedCart = JSON.parse(JSON.stringify(active));

    // Persist through sales.create (source of truth). The local
    // invoiceCounter mock path was removed — no invoice number is ever
    // fabricated in the renderer.
    const now = new Date().toISOString();
    const total = computeTotals(snapshot).total;
    const userId = useAuth.getState().currentUserId ?? 'u_admin';
    const payload = {
      status: 'final' as const,
      date: now,
      // Walk-in ('cu1') persists as no customer (undefined → null server-side);
      // any other id is a real backend customer id.
      customerId: snapshot.customerId === 'cu1' ? undefined : snapshot.customerId,
      branchId: 'br_mp',
      userId,
      ...buildSalePayloadBase(snapshot),
      payments: buildSalePayments(result, total, now),
    };

    submittingRef.current = true;
    setSubmitting(true);
    try {
      let res: { invoiceNo: string; totals: { total: number }; due: number };
      if (!hasBackend()) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        res = {
          invoiceNo: `INV-PREVIEW-${rand}`,
          totals: { total },
          due: Math.max(
            0,
            total -
              result.payments
                .filter((p) => p.method !== 'Credit')
                .reduce((s, p) => s + p.amount, 0),
          ),
        };
      } else {
        res = await api<{
          invoiceNo: string;
          totals: { total: number };
          due: number;
        }>('sales.create', payload);
      }
      const invoiceNo = res.invoiceNo;
      // Safety net: the cart math mirrors the backend core, so these should be
      // identical. If they ever drift, surface a warning (not a hard error —
      // the backend total is authoritative and already persisted).
      if (Math.abs(res.totals.total - total) > 0.01) {
        toast.warning(
          `Total mismatch: cart ৳${total.toFixed(2)} vs recorded ৳${res.totals.total.toFixed(2)}`,
        );
      }
      // Use the backend-returned invoice number + due for the receipt (source
      // of truth), not the modal's locally-computed remaining.
      const receiptPayment: PaymentResult = { ...result, due: res.due };
      setReceipt({ invoiceNo, cart: snapshot, payment: receiptPayment });
      setLastReceipt({ invoiceNo, cart: snapshot, payment: receiptPayment });
      setPaymentOpen(false);
      toast.success(`Sale ${invoiceNo} recorded`);
      // Clear the active cart slot for the next sale (the receipt keeps the
      // snapshot, so the printed copy is unaffected).
      usePOSCart.getState().resetActiveSlot(cartDefaults);
      // Reflect stock-out, the new sale, and any drawer movement.
      void qc.invalidateQueries({ queryKey: ['products'] });
      void useSales.getState().hydrate();
      void useCashRegister.getState().hydrate();
      // One-line nicety: cash taken but no open shift → not drawer-tracked.
      const hasCash = payload.payments.some((p) => p.method === 'Cash');
      if (hasCash) {
        const shift = await apiSafe('cash.openShiftFor', { branchId: 'br_mp' });
        if (!shift) {
          toast.info(
            'No open shift — cash not tracked in a drawer. Open a shift from Cash Register.',
          );
        }
      }
    } catch (e) {
      // Keep the cart intact so the cashier can retry.
      toast.error(e instanceof Error ? e.message : 'Failed to record sale');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const startNewSale = () => {
    setReceipt(null);
    // Reset the current cart instead of opening a new one
    usePOSCart.getState().resetActiveSlot(cartDefaults);
    searchInputRef.current?.focus();
  };

  // Suspend (F9): move the active cart into the held list and leave a fresh cart
  // in the same slot. Held carts are persisted, so "suspend" now genuinely means
  // "come back to it later" — even after an app restart.
  const onSuspend = () => usePOSCart.getState().suspendActive(cartDefaults);

  const resumeHeld = (id: string) => {
    usePOSCart.getState().resumeHeld(id);
    setHeldOpen(false);
  };

  const discardHeld = (id: string) => usePOSCart.getState().discardHeld(id);

  const persistAsStatus = async (status: 'draft' | 'quotation') => {
    if (!active || active.lines.length === 0) return;
    if (submittingRef.current) return;

    // Drafts/quotations are persisted by the backend only; the local
    // "[Draft]/[Quote] held cart" mock path was removed.
    const now = new Date().toISOString();
    const userId = useAuth.getState().currentUserId ?? 'u_admin';
    const payload = {
      status,
      date: now,
      customerId: active.customerId === 'cu1' ? undefined : active.customerId,
      branchId: 'br_mp',
      userId,
      ...buildSalePayloadBase(active),
      // drafts/quotations carry no payments (they touch neither stock nor cash)
    };

    submittingRef.current = true;
    setSubmitting(true);
    try {
      let res: { invoiceNo: string };
      if (!hasBackend()) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        res = { invoiceNo: `${status === 'draft' ? 'DFT' : 'QUO'}-${rand}` };
      } else {
        res = await api<{ invoiceNo: string }>('sales.create', payload);
      }
      toast.success(
        `${status === 'draft' ? 'Draft' : 'Quotation'} ${res.invoiceNo} saved`,
      );
      usePOSCart.getState().resetActiveSlot(cartDefaults);
      // Surface it in Sales → Drafts/Quotations (backend-backed list).
      void useSales.getState().hydrate();
    } catch (e) {
      // Keep the cart intact so the cashier can retry.
      toast.error(e instanceof Error ? e.message : `Failed to save ${status}`);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const onSaveAsDraft = () => {
    void persistAsStatus('draft');
  };

  const onSaveAsQuotation = () => {
    void persistAsStatus('quotation');
  };

  // Global F-key shortcuts (POS scope only)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in normal inputs (except F-keys still fire)
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      const inText = ['input', 'textarea', 'select'].includes(tag);
      const isFKey = /^F\d{1,2}$/.test(e.key);

      if (e.key === '?' && !inText) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        setPickerOpen(true);
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        setHeldOpen(true);
        return;
      }
      if (e.key === 'F6') {
        e.preventDefault();
        onSaveAsDraft();
        return;
      }
      if (e.key === 'F7') {
        e.preventDefault();
        onSaveAsQuotation();
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        openPay('Cash');
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        onSuspend();
        return;
      }
      if (e.key === 'F10') {
        e.preventDefault();
        addCart();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (lastReceipt) setReceipt(lastReceipt);
        return;
      }
      if (isFKey) {
        // Other F-keys handled in ProductPanel (F2)
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, lastReceipt, held]);

  const customerForActive = customers.find((c) => c.id === active?.customerId);

  // `ensureInitialized` runs in an effect, so the very first render (and a
  // corrupted store) can legitimately have no active cart. Bail out with a
  // placeholder rather than letting the panels dereference undefined.
  if (!active) {
    return (
      <div className="h-full grid place-items-center text-sm text-muted-foreground">
        Opening the counter…
      </div>
    );
  }

  const cart = (
    <CartPanel
      carts={carts}
      activeId={activeId}
      setActiveId={setActiveId}
      setCart={setActiveCart}
      addCart={addCart}
      closeCart={closeCart}
      clearCart={clearCart}
      customers={customers}
      busy={submitting}
      costOf={costOf}
      listPriceOf={listPriceOf}
      onPickCustomer={onPickCustomer}
      onPay={(m) => openPay(m)}
      onSplitPay={openSplitPay}
      onSuspend={onSuspend}
      onShowHeld={() => setHeldOpen(true)}
      onSaveAsDraft={onSaveAsDraft}
      onSaveAsQuotation={onSaveAsQuotation}
    />
  );

  const productPicker = (
    <ProductPanel
      search={search}
      setSearch={setSearch}
      activeCat={activeCat}
      setActiveCat={setActiveCat}
      activeBrand={activeBrand}
      setActiveBrand={setActiveBrand}
      onAdd={addToCart}
      onSubmitSearch={handleSubmitSearch}
      searchInputRef={searchInputRef}
    />
  );

  const isCartLeft = orientation === 'cart-left';
  const splitRatio = isCartLeft ? cartRatio : 1 - cartRatio;
  const handleSplit = (r: number) => setCartRatio(isCartLeft ? r : 1 - r);

  // A side-by-side split needs real width. Below `lg` the two panels stack and
  // scroll vertically instead (product picker first so scanning still works),
  // which keeps the checkout usable on a 1366-wide or resized window.
  const stacked = useBelow('lg');

  return (
    // `h-full`, not `h-[calc(100vh-3rem)]`: that hardcoded the titlebar at 3rem,
    // and the Appearance font-scale slider changes the root font size, so the
    // subtraction drifted and left a gap (or overflowed) at larger scales.
    // AppShell's <main> already gives this a definite height.
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        {stacked ? (
          // Stacked (narrow window): each panel scrolls INDEPENDENTLY. It used to
          // be one tall page-level scroller, which pushed the totals and the Pay
          // button below the fold — the cashier had to scroll down to take money.
          <div className="h-full flex flex-col divide-y divide-border">
            <div className="h-[42%] min-h-0 shrink-0">{productPicker}</div>
            <div className="flex-1 min-h-0">{cart}</div>
          </div>
        ) : (
          <Splitter
            ratio={splitRatio}
            onChange={handleSplit}
            left={isCartLeft ? cart : productPicker}
            right={isCartLeft ? productPicker : cart}
          />
        )}
      </div>

      <CustomerPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedId={active.customerId}
        onSelect={onSelectCustomer}
      />

      <HeldList
        open={heldOpen}
        onClose={() => setHeldOpen(false)}
        carts={held}
        onResume={resumeHeld}
        onDiscard={discardHeld}
        customers={customers}
      />

      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        total={totalsForActive.total}
        customerCreditLimit={customerForActive?.creditLimit}
        customerCurrentDue={customerForActive?.due}
        customerName={customerForActive?.name}
        /**
         * Anything left unpaid needs a real customer to owe it. 'cu1' is the
         * walk-in placeholder and is sent to the backend as NO customer, so a due
         * against it would belong to nobody: `customerDue()` sums by customer_id,
         * meaning that money would appear in no khata, on no Customer Dues screen
         * and in no receivables total. The modal blocks on this and offers the
         * picker rather than silently losing it.
         */
        hasNamedCustomer={
          !!active.customerId && active.customerId !== 'cu1' && !!customerForActive
        }
        onPickCustomer={() => {
          setPaymentOpen(false);
          setPickerOpen(true);
        }}
        startMode={paymentStartMode}
        // The payment modal initialises with `Cash` regardless; user clicks the chosen tile.
        // Keep startMethod available for a future "preselect" tweak.
        key={`pay-${paymentOpen}-${paymentStartMethod}`}
        onConfirm={handleConfirmPayment}
      />

      {receipt && (
        <ReceiptModal
          open={!!receipt}
          onClose={() => setReceipt(null)}
          invoiceNo={receipt.invoiceNo}
          cart={receipt.cart}
          payment={receipt.payment}
          customer={customers.find((c) => c.id === receipt.cart.customerId)}
          cashierName={useAuth.getState().currentUser()?.name}
          onNewSale={startNewSale}
          onReprint={() => {
            // already showing it; tells user it's the last receipt
          }}
        />
      )}

      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
