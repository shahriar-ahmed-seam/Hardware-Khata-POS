import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Splitter } from '@/components/ui/Splitter';
import { CartPanel } from '@/components/pos/CartPanel';
import { ProductPanel } from '@/components/pos/ProductPanel';
import { type CartLine, type ParkedCart, computeTotals } from '@/components/pos/types';
import { products as mockProducts, customers as mockCustomers, type Customer } from '@/mocks/data';
import { usePOS } from '@/stores/pos';
import { useSettings } from '@/stores/settings';
import { CustomerPicker } from '@/components/pos/CustomerPicker';
import { PaymentModal, type PaymentMethod, type PaymentResult } from '@/components/pos/PaymentModal';
import { HeldList } from '@/components/pos/HeldList';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { ShortcutsOverlay } from '@/components/pos/ShortcutsOverlay';
import { api, apiSafe, hasBackend } from '@/lib/api';
import { useProducts } from '@/hooks/useProducts';
import { useCustomersQuery } from '@/hooks/useCustomers';
import { useAuth } from '@/stores/auth';
import { useSales } from '@/stores/sales';
import { useCashRegister } from '@/stores/cashRegister';
import { toast } from '@/stores/toast';

function makeCart(label: string, defaults: { taxPct: number; markupPct: number }): ParkedCart {
  return {
    id: String(Date.now() + Math.random()),
    label,
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

let invoiceCounter = 451; // mock counter (used only when running without a backend)

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

  // ----- Data source: live backend when available, else mock seed -----
  const backend = hasBackend();
  const qc = useQueryClient();
  const productsQuery = useProducts('br_mp');
  const customersQuery = useCustomersQuery();
  const products = backend ? (productsQuery.data ?? []) : mockProducts;
  const customers: Customer[] = backend ? (customersQuery.data ?? []) : mockCustomers;
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false); // synchronous in-flight lock (state lags a render)

  // Permission gate (DEFENSIVE — the IPC layer is the authoritative gate; this
  // only hides/disables the UI). Subscribe to `permissions` so the buttons
  // re-disable if the signed-in user changes. Mock mode (`!backend`) never
  // blocks. Falls back to the store's role-derived `can()` when the permission
  // array is empty (pre-restore).
  const permissions = useAuth((s) => s.permissions);
  const canCreateSale =
    !backend ||
    (permissions.length > 0
      ? permissions.includes('sales.create')
      : useAuth.getState().can('sales.create'));

  const [carts, setCarts] = useState<ParkedCart[]>(() => [
    {
      ...makeCart('Cart 1', { taxPct: defaultOrderTaxPct, markupPct: defaultPriceMarkupPct }),
      label: 'Cart 1',
    },
  ]);
  const [activeId, setActiveId] = useState<string>(carts[0].id);
  const [held, setHeld] = useState<ParkedCart[]>([]); // explicitly held / suspended
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

  const active = carts.find((c) => c.id === activeId)!;
  const setActiveCart = (next: ParkedCart) =>
    setCarts((cs) => cs.map((c) => (c.id === activeId ? next : c)));

  function priceForProduct(p: (typeof products)[number], group: ParkedCart['priceGroup']) {
    if (group === 'wholesale' && p.wholesalePrice) return p.wholesalePrice;
    if (group === 'contractor' && p.contractorPrice) return p.contractorPrice;
    return p.price;
  }

  function addToCart(productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
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

  const addCart = () => {
    const c = makeCart(`Cart ${carts.length + 1}`, {
      taxPct: defaultOrderTaxPct,
      markupPct: defaultPriceMarkupPct,
    });
    setCarts((cs) => [...cs, c]);
    setActiveId(c.id);
  };

  const closeCart = (id: string) => {
    setCarts((cs) => {
      const next = cs.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = makeCart('Cart 1', {
          taxPct: defaultOrderTaxPct,
          markupPct: defaultPriceMarkupPct,
        });
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  const clearCart = () => setActiveCart({ ...active, lines: [] });

  const onPickCustomer = () => setPickerOpen(true);
  const onSelectCustomer = (id: string) => setActiveCart({ ...active, customerId: id });

  const totalsForActive = computeTotals(active);

  const openPay = (method: PaymentMethod = 'Cash') => {
    if (active.lines.length === 0) return;
    if (!canCreateSale) {
      toast.error("You don't have permission to create sales");
      return;
    }
    setPaymentStartMode('single');
    setPaymentStartMethod(method);
    setPaymentOpen(true);
  };
  const openSplitPay = () => {
    if (active.lines.length === 0) return;
    if (!canCreateSale) {
      toast.error("You don't have permission to create sales");
      return;
    }
    setPaymentStartMode('split');
    setPaymentOpen(true);
  };

  const handleConfirmPayment = async (result: PaymentResult) => {
    if (submittingRef.current) return; // guard against double-submit
    const snapshot: ParkedCart = JSON.parse(JSON.stringify(active));

    if (!backend) {
      // ---- mock path (no backend): keep the local invoiceCounter behaviour ----
      invoiceCounter += 1;
      const invoiceNo = `INV-${new Date().getFullYear()}-${String(invoiceCounter).padStart(4, '0')}`;
      setReceipt({ invoiceNo, cart: snapshot, payment: result });
      setLastReceipt({ invoiceNo, cart: snapshot, payment: result });
      setPaymentOpen(false);
      return;
    }

    // ---- backend path: persist through sales.create (source of truth) ----
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
      const res = await api<{
        invoiceNo: string;
        totals: { total: number };
        due: number;
      }>('sales.create', payload);
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
      const fresh = makeCart(active.label, {
        taxPct: defaultOrderTaxPct,
        markupPct: defaultPriceMarkupPct,
      });
      setActiveCart({ ...fresh, id: active.id, label: active.label });
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
    const fresh = makeCart(active.label, {
      taxPct: defaultOrderTaxPct,
      markupPct: defaultPriceMarkupPct,
    });
    setActiveCart({ ...fresh, id: active.id, label: active.label });
    searchInputRef.current?.focus();
  };

  // Suspend / Hold (F9): move active cart into held list, replace with fresh cart in same slot
  const onSuspend = () => {
    if (active.lines.length === 0) return;
    setHeld((hs) => [...hs, active]);
    const fresh = makeCart(active.label, {
      taxPct: defaultOrderTaxPct,
      markupPct: defaultPriceMarkupPct,
    });
    setCarts((cs) => cs.map((c) => (c.id === activeId ? { ...fresh, id: c.id, label: c.label } : c)));
  };

  const resumeHeld = (id: string) => {
    const hc = held.find((h) => h.id === id);
    if (!hc) return;
    setHeld((hs) => hs.filter((h) => h.id !== id));
    // Replace active cart with the held one
    setCarts((cs) => cs.map((c) => (c.id === activeId ? { ...hc, label: c.label } : c)));
    setHeldOpen(false);
  };

  const discardHeld = (id: string) => {
    setHeld((hs) => hs.filter((h) => h.id !== id));
  };

  // Reset the active cart slot to a fresh cart (used after a successful
  // backend draft/quotation persist).
  const resetActiveSlot = () => {
    const fresh = makeCart(active.label, {
      taxPct: defaultOrderTaxPct,
      markupPct: defaultPriceMarkupPct,
    });
    setCarts((cs) => cs.map((c) => (c.id === activeId ? { ...fresh, id: c.id, label: c.label } : c)));
  };

  const persistAsStatus = async (status: 'draft' | 'quotation') => {
    if (active.lines.length === 0) return;
    if (submittingRef.current) return;

    if (!backend) {
      // ---- mock path: held with a [Draft]/[Quote] label (unchanged) ----
      const label = status === 'draft' ? '[Draft] ' : '[Quote] ';
      setHeld((hs) => [...hs, { ...active, label: label + active.label }]);
      resetActiveSlot();
      return;
    }

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
      const res = await api<{ invoiceNo: string }>('sales.create', payload);
      toast.success(
        `${status === 'draft' ? 'Draft' : 'Quotation'} ${res.invoiceNo} saved`,
      );
      resetActiveSlot();
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

  const customerForActive = customers.find((c) => c.id === active.customerId);

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

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      <div className="flex-1 min-h-0">
        <Splitter
          ratio={splitRatio}
          onChange={handleSplit}
          left={isCartLeft ? cart : productPicker}
          right={isCartLeft ? productPicker : cart}
        />
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
