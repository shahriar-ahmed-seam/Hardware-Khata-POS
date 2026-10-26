import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCan } from '@/hooks/useCan';
import { promptText } from '@/stores/prompt';
import { branchNameOf, useDefaultBranchId } from '@/lib/branch';
import { toPurchaseRecord, type BackendPurchase } from '@/hooks/purchaseAdapter';
import { ArrowLeft, Plus, Save, Search, Trash2, Banknote, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { IconButton } from '@/components/ui/IconButton';
import { useIsMultiBranch } from '@/components/stock/hooks';
import { PAY_TERMS } from '@/components/purchases/labels';
import { useProducts } from '@/hooks/useProducts';
import { useBranches } from '@/stores/branches';
import { useSuppliers } from '@/stores/contacts';
import { api } from '@/lib/api';
import { toSupplier, type BackendSupplier } from '@/hooks/contactAdapter';
import type { Product, Supplier } from '@/types/domain';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import {
  computeTotals,
  nextPurchaseRef,
  recomputeLine,
  usePurchases,
  type PurchaseLine,
  type PurchaseRecord,
  type PurchaseStatus,
} from '@/stores/purchases';
import { ProductImage } from '@/components/products/ProductImage';
import { formatBDT, formatNumber, cn } from '@/lib/utils';
import { currentUserName } from '@/lib/actor';
import { markupOnCostPct, round2 } from '@/lib/money';
import { consumePurchasePrefill } from '@/lib/purchasePrefill';
import { AddPurchasePaymentModal } from '@/components/purchases/AddPurchasePaymentModal';
import { NewSupplierModal } from '@/components/purchases/NewSupplierModal';
import { NewProductDrawer } from '@/components/products/NewProductDrawer';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { toLocalInput, fromLocalInput } from '@/lib/datetime';

/**
 * The pack sizes a Bangladeshi hardware supplier actually quotes in.
 *
 * A shop sells screws, hinges and fittings by the piece but buys them by the
 * dozen, the gross or the box. Entering "5 dozen at 620" used to mean doing the
 * division by hand — 60 at 51.6667 — which does not come back to the ৳3,100 the
 * supplier charged. Choosing the pack keeps the bill exact and lets the app
 * convert the stock.
 */
const PACKS: { factor: number; label: string }[] = [
  { factor: 1, label: 'each' },
  { factor: 12, label: 'dozen' },
  { factor: 24, label: '2 dozen' },
  { factor: 144, label: 'gross' },
  { factor: 10, label: 'box of 10' },
  { factor: 20, label: 'box of 20' },
  { factor: 25, label: 'box of 25' },
  { factor: 50, label: 'box of 50' },
  { factor: 100, label: 'box of 100' },
];

/**
 * `/purchases/new` and `/purchases/:id/edit`.
 *
 * THE EDIT URL LOADS THE BILL BY ID, and only then mounts the form. It used to
 * read the bill from the loaded page of the Purchases list: from a deep link
 * `editing` was undefined and Save CREATED A SECOND BILL. Now the form is
 * mounted with the bill in hand (from the store, or `purchases.get`), and saving
 * goes through `purchases.update` — the admin's correction, which keeps the
 * bill's number and its payments (backend/services/purchases.ts).
 */
export default function AddPurchase() {
  const { id } = useParams<{ id?: string }>();
  const nav = useNavigate();
  const storePurchase = usePurchases((s) => (id ? s.purchases.find((p) => p.id === id) : undefined));
  const canEdit = useCan('purchases.edit');
  const [fetched, setFetched] = useState<PurchaseRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const hasStorePurchase = !!storePurchase;

  useEffect(() => {
    if (!id || hasStorePurchase) return;
    let alive = true;
    setMissing(false);
    void api<BackendPurchase | null>('purchases.get', { id })
      .then((row) => {
        if (!alive) return;
        if (row) setFetched(toPurchaseRecord(row));
        else setMissing(true);
      })
      .catch(() => {
        if (alive) setMissing(true);
      });
    return () => {
      alive = false;
    };
  }, [id, hasStorePurchase]);

  if (!id) return <AddPurchaseForm key="new" />;

  const editing = storePurchase ?? (fetched?.id === id ? fetched : undefined);
  const back = (
    <Button variant="outline" onClick={() => nav('/purchases')}>
      <ArrowLeft className="size-4" /> Back to purchases
    </Button>
  );
  if (!editing) {
    return (
      <div className="p-8 max-w-xl space-y-3 text-sm text-muted-foreground">
        <div>{missing ? 'That purchase could not be found.' : 'Loading purchase…'}</div>
        {missing && back}
      </div>
    );
  }
  if (!canEdit) {
    return (
      <div className="p-8 max-w-xl space-y-3">
        <div className="text-base font-semibold">Only the owner or a manager can edit a saved purchase</div>
        {back}
      </div>
    );
  }
  if (editing.status === 'cancelled') {
    return (
      <div className="p-8 max-w-xl space-y-3">
        <div className="text-base font-semibold">A cancelled purchase cannot be edited</div>
        <div className="text-sm text-muted-foreground">Enter a new purchase instead.</div>
        {back}
      </div>
    );
  }
  return <AddPurchaseForm key={id} editing={editing} />;
}

function AddPurchaseForm({ editing }: { editing?: PurchaseRecord }) {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const addPurchase = usePurchases((s) => s.addPurchase);
  const updatePurchase = usePurchases((s) => s.updatePurchase);
  const [saving, setSaving] = useState(false);
  // Synchronous: state lags a render, so two quick clicks both saw saving=false.
  const savingRef = useRef(false);
  // The supplier SELECT reads the contacts store's UNPAGED `options` (id+name).
  // `items` is one page of suppliers, so building the select from it would hide
  // every supplier past the first page. The chosen supplier's address / pay
  // terms / payable are NOT in `options`, so that one record is read directly
  // (see the suppliers.get effect below).
  const supplierOptions = useSuppliers((s) => s.options);
  const loadSupplierOptions = useSuppliers((s) => s.loadOptions);
  const storeSuppliers = useSuppliers((s) => s.items);

  // Data source: the SQLite backend only (mirrors POS.tsx). The mock product
  // seed fallback was removed — an empty query means an empty item picker.
  const productsQuery = useProducts(useDefaultBranchId());
  const products = productsQuery.data ?? [];
  const branches = useBranches((s) => s.items);
  const multiBranch = useIsMultiBranch();

  // Hydrate branches + load the full supplier option list on mount (cheap
  // no-ops without a backend).
  const hydrateBranches = useBranches((s) => s.hydrate);
  useEffect(() => {
    void hydrateBranches();
    void loadSupplierOptions();
  }, [hydrateBranches, loadSupplierOptions]);

  // Default branch: edit value wins; otherwise the default branch name, else
  // first. No hardcoded branch-name fallback (see the hydrate effect below).
  // A loaded bill carries its branch ID; the picker lists names.
  const defaultBranchName = editing
    ? branchNameOf(editing.branch) || editing.branch
    : (branches.find((b) => b.isDefault)?.name ?? branches[0]?.name ?? '');

  // Header
  const [supplierId, setSupplierId] = useState(editing?.supplierId ?? '');
  // The number is given by the backend on save; a correction keeps the original.
  const refNo = editing?.refNo ?? '';
  /**
   * Defaults to RIGHT NOW on the shop's clock, and stays editable.
   * Was `new Date().toISOString().slice(0, 16)` — UTC, so it read six hours behind
   * in Dhaka, and "fixing" it wrote an instant in the future. See lib/datetime.ts.
   */
  const [date, setDate] = useState(toLocalInput(editing?.date));
  const [branch, setBranch] = useState(defaultBranchName);
  const [status, setStatus] = useState<PurchaseStatus>(editing?.status ?? 'received');
  const [payTerms, setPayTerms] = useState<string>(editing?.payTerms ?? '');
  // Upload is not built: the field was removed, an old name is kept as-is.
  const attachmentName = editing?.attachmentName;

  // Branches arrive asynchronously from the backend, so adopt the default branch
  // once the list lands (a hardcoded branch name used to fill this gap).
  useEffect(() => {
    if (editing || branch) return;
    const next = branches.find((b) => b.isDefault)?.name ?? branches[0]?.name;
    if (next) setBranch(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches]);

  // Totals
  const [orderDiscountType, setOrderDiscountType] = useState<'flat' | 'percent'>(editing?.orderDiscountType ?? 'flat');
  const [orderDiscountValue, setOrderDiscountValue] = useState(editing?.orderDiscountValue ?? 0);
  const [taxPct, setTaxPct] = useState(editing?.taxPct ?? 0);
  const [shipping, setShipping] = useState(editing?.shipping ?? 0);
  const [shippingDetails, setShippingDetails] = useState(editing?.shippingDetails ?? '');
  const [other, setOther] = useState(editing?.other ?? 0);
  const [notes, setNotes] = useState(editing?.notes ?? '');

  // Lines
  const [lines, setLines] = useState<PurchaseLine[]>(editing?.lines ?? []);
  const [searchQ, setSearchQ] = useState('');

  // Auto-fill from supplier. `options` only carries id+name, so the FULL record
  // for the chosen supplier (address, pay terms, payable) is read one row at a
  // time — the store page is preferred when it happens to hold that supplier, so
  // an edit elsewhere is reflected without a refetch.
  const storeSupplier = storeSuppliers.find((s) => s.id === supplierId);
  const [fetchedSupplier, setFetchedSupplier] = useState<Supplier | null>(null);
  const hasStoreSupplier = !!storeSupplier;

  useEffect(() => {
    if (!supplierId || hasStoreSupplier) {
      setFetchedSupplier(null);
      return;
    }
    let alive = true;
    void api<BackendSupplier | null>('suppliers.get', { id: supplierId })
      .then((row) => {
        if (alive && row) setFetchedSupplier(toSupplier(row));
      })
      .catch(() => {
        // Channel error or running outside Electron — no autofill, fields stay
        // editable.
      });
    return () => {
      alive = false;
    };
  }, [supplierId, hasStoreSupplier]);

  const supplier =
    storeSupplier ?? (fetchedSupplier?.id === supplierId ? fetchedSupplier : undefined);
  // The name is available from `options` straight away, so the record being built
  // is never left with a blank supplier name while the detail read is in flight.
  const supplierName =
    supplier?.name ?? supplierOptions.find((o) => o.id === supplierId)?.name ?? '';
  const supplierAddress = supplier?.address ?? '';
  const supplierPayTerms = supplier?.paymentTerms ?? '';
  // Pay term pre-set from the supplier on a new bill.
  useEffect(() => {
    if (!editing && supplierPayTerms) setPayTerms(supplierPayTerms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierPayTerms]);

  const matches = useMemo(() => {
    if (!searchQ.trim()) return [];
    const t = searchQ.toLowerCase();
    return products
      .filter((p) => `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(t))
      .slice(0, 8);
  }, [searchQ, products]);

  /**
   * Put a product on the purchase.
   *
   * Takes the PRODUCT, not just its id, so a product created a moment ago in the
   * "Add new product" drawer can be added straight away — the catalogue query
   * has not refetched yet at that point, so an id-only lookup would find
   * nothing and the new product would silently fail to appear.
   */
  const addLineFromProduct = (p: Product) => {
    const idx = lines.findIndex((l) => l.productId === p.id);
    if (idx >= 0) {
      setLines((ls) =>
        ls.map((l, j) => (j === idx ? recomputeLine({ ...l, qty: l.qty + 1 }) : l)),
      );
    } else {
      const newLine: PurchaseLine = recomputeLine({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        qty: 1,
        unit: p.unit,
        unitCostBeforeDisc: p.cost,
        discountPct: 0,
        discountFlat: 0,
        taxPct: 0,
        unitCostBeforeTax: p.cost,
        lineTotal: p.cost,
        newSellPrice: p.price,
      });
      setLines((ls) => [...ls, newLine]);
    }
    setSearchQ('');
  };

  const updateLine = (i: number, patch: Partial<PurchaseLine>) =>
    setLines((ls) => ls.map((l, j) => (i === j ? recomputeLine({ ...l, ...patch }) : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));

  // Prefill handoff (e.g. from Stock Alerts → "Create Purchase"): when
  // `?prefill=alerts` is present and a sessionStorage payload exists, pre-add
  // those product lines (resolving name/cost/sell price from the products
  // source) and clear the payload so a reload starts clean. Guarded so the
  // normal "Add Purchase" flow and the edit flow are unaffected. Re-runs when
  // the backend products source resolves so we don't consume the payload before
  // the products needed to resolve the lines are available.
  useEffect(() => {
    if (editing) return; // never override an in-progress edit
    if (searchParams.get('prefill') !== 'alerts') return;
    // Wait for the products source before consuming the one-shot payload.
    if (products.length === 0) return;
    const pending = consumePurchasePrefill();
    if (pending.length === 0) return;
    const prefilled = pending
      .map(({ productId, qty }) => {
        const p = products.find((x) => x.id === productId);
        if (!p) return null;
        return recomputeLine({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          qty: Math.max(1, qty),
          unit: p.unit,
          unitCostBeforeDisc: p.cost,
          discountPct: 0,
          discountFlat: 0,
          taxPct: 0,
          unitCostBeforeTax: p.cost,
          lineTotal: p.cost,
          newSellPrice: p.price,
        });
      })
      .filter((l): l is PurchaseLine => l !== null);
    if (prefilled.length > 0) setLines((ls) => (ls.length > 0 ? ls : prefilled));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const totals = computeTotals({
    lines,
    orderDiscountType,
    orderDiscountValue,
    taxPct,
    shipping,
    other,
  });

  // Margin warnings: count lines with margin < 10%
  const lowMarginLines = lines.filter((l) => l.marginPct !== undefined && l.marginPct < 10);

  // Says what is missing instead of a silently disabled Save.
  const zeroLine = lines.findIndex((l) => !(l.qty > 0));
  const problem = !supplierId
    ? 'Choose a supplier'
    : lines.length === 0
      ? 'Add at least one item'
      : zeroLine >= 0
        ? 'Quantity can’t be 0'
        : '';
  const isValid = problem === '';

  const buildRecord = (paid = 0): PurchaseRecord => ({
    id: editing?.id ?? 'pu_' + Date.now(),
    refNo: refNo || nextPurchaseRef(),
    status,
    // Local wall-clock box → UTC instant for storage. This is the date the stock
    // movement and the cost-history entry are dated with, so it has to be a real
    // instant, not a naive string six hours out.
    date: fromLocalInput(date),
    supplierId,
    supplierName,
    supplierAddress,
    branch,
    user: currentUserName(),
    payTerms: payTerms || undefined,
    attachmentName,
    lines: lines.map((l) => recomputeLine(l)),
    subtotal: totals.subtotal,
    totalLineDiscount: totals.totalLineDiscount,
    orderDiscountType,
    orderDiscountValue,
    orderDiscount: totals.orderDiscount,
    taxPct,
    tax: totals.tax,
    shipping: totals.shipping,
    shippingDetails: shippingDetails || undefined,
    other: totals.other,
    total: totals.total,
    paid,
    // A new bill has no supplier credit notes yet; they come from returns later.
    credited: 0,
    due: round2(Math.max(0, totals.total - paid)),
    payments: [],
    notes: notes || undefined,
    audit: [{ id: 'a_' + Date.now(), at: new Date().toISOString(), by: currentUserName(), action: 'created' }],
  });

  // For Save & Pay flow we save first then open the payment modal on a transient record
  const [pendingPayment, setPendingPayment] = useState<PurchaseRecord | null>(null);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);

  /**
   * Save a CORRECTION to the saved bill (admin). The backend keeps the bill's
   * number and every payment made on it, and re-applies stock and buying
   * prices in one transaction. The reason goes into the bill's audit.
   */
  const saveCorrection = async () => {
    if (!editing || !isValid || saving) return;
    const reason = await promptText({
      title: 'Why are you correcting this bill?',
      message:
        editing.status === 'received'
          ? 'The stock and buying prices from the original bill are replaced by the corrected ones. Payments already made stay on the bill.'
          : 'Recorded on the bill so the change is traceable.',
      label: 'Reason',
      placeholder: 'e.g. supplier invoice showed a different price',
      confirmLabel: 'Save correction',
      required: true,
    });
    if (reason === null) return;
    setSaving(true);
    const ok = await updatePurchase(editing.id, buildRecord(editing.paid), reason);
    setSaving(false);
    if (!ok) return;
    toast.success('Purchase corrected', { description: editing.refNo });
    nav('/purchases');
  };

  /**
   * ONE SAVE AT A TIME. Neither button had a guard, so a double click (or a
   * click while the first save was still in flight) created the bill twice —
   * twice the stock and twice the money owed to the supplier.
   */
  const createOnce = async (): Promise<string | null> => {
    if (savingRef.current) return null;
    savingRef.current = true;
    setSaving(true);
    try {
      return await addPurchase(buildRecord(0));
    } catch {
      // addPurchase already showed the backend's message and re-read the list.
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const saveUnpaid = async () => {
    if (!isValid || savingRef.current) return;
    if (editing) return saveCorrection();
    if (lowMarginLines.length > 0) {
      const ok = await confirm({
        title: 'Some items will have a margin under 10%.',
        message: 'Save anyway?',
        confirmLabel: 'Save',
      });
      if (!ok) return;
    }
    const newId = await createOnce();
    if (!newId) return; // refused: the form keeps everything typed
    nav('/purchases');
  };

  const saveAndPay = async () => {
    if (!isValid || savingRef.current) return;
    // A correction never re-creates the bill: it goes through purchases.update.
    if (editing) return saveCorrection();
    // Save & Pay is always wired to the persisted purchase: addPurchase() awaits
    // api('purchases.create') (which returns the new backend id) and rehydrates,
    // resolving to that real id. We then look the rehydrated record up by that
    // id and open the payment modal on it, so the payment posts to the persisted
    // purchase. The optimistic local-id fallback was removed.
    if (lowMarginLines.length > 0) {
      const ok = await confirm({
        title: 'Some items will have a margin under 10%.',
        message: 'Save anyway?',
        confirmLabel: 'Save',
      });
      if (!ok) return;
    }
    const newId = await createOnce();
    if (!newId) return;
    const persisted = usePurchases.getState().purchases.find((p) => p.id === newId);
    if (persisted) {
      setPendingPayment(persisted);
    } else {
      // Couldn't locate the rehydrated purchase — don't attach to a stale id.
      toast.error('Purchase saved, but could not open payment. Open it from the Purchases list.');
      nav('/purchases');
    }
  };

  // ---- Product search: type or scan, ↑/↓ + Enter, focus returns here. ----
  const searchRef = useRef<HTMLInputElement>(null);
  const [hi, setHi] = useState(0);
  const pickProduct = (p: Product) => {
    addLineFromProduct(p);
    setHi(0);
    searchRef.current?.focus();
  };
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault();
      setHi((h) => (h + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && matches.length) {
      e.preventDefault();
      setHi((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const t = searchQ.trim().toLowerCase();
      if (!t) return;
      // A scanner types the code and Enter: an exact barcode / SKU wins.
      const exact = products.find((p) => p.barcode?.toLowerCase() === t || p.sku.toLowerCase() === t);
      const p = exact ?? matches[hi];
      if (p) pickProduct(p);
    } else if (e.key === 'Escape' && searchQ) {
      e.stopPropagation();
      setSearchQ('');
    }
  };
  // Once a supplier is picked on a new bill, the next thing is the first item.
  const supplierPicked = useRef(!!editing);
  useEffect(() => {
    if (!supplierId || supplierPicked.current) return;
    supplierPicked.current = true;
    searchRef.current?.focus();
  }, [supplierId]);

  // Serial no. per line is rare in a hardware shop: shown on demand.
  const [serialOpen, setSerialOpen] = useState<Set<number>>(new Set());

  // Charges, notes and pay term sit behind one disclosure (open when used).
  const [chargesOpen, setChargesOpen] = useState(
    () =>
      !!(
        editing &&
        (editing.orderDiscountValue || editing.taxPct || editing.shipping || editing.other || editing.notes || editing.shippingDetails)
      ),
  );

  const back = async () => {
    if (
      lines.length > 0 &&
      !(await confirm({
        title: 'Leave without saving?',
        message: 'The lines you entered will be lost.',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        variant: 'destructive',
      }))
    )
      return;
    nav(-1);
  };

  const totalQtyLabel = lines.length;
  const willOwe = editing ? round2(totals.total - editing.paid) : 0;
  const hasCharges = totals.totalLineDiscount > 0 || totals.orderDiscount > 0 || totals.tax > 0 || totals.shipping > 0 || totals.other > 0;
  // A received bill cannot go back to Ordered / In transit (backend rule).
  const statusLocked = editing?.status === 'received';

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title={editing ? 'Correct purchase' : 'Add Purchase'}
        subtitle={
          editing
            ? `${editing.refNo} · ${supplierName}`
            : 'Enter the supplier’s bill. Stock goes in when status is Received.'
        }
        actions={
          <Button variant="outline" onClick={() => void back()}>
            <ArrowLeft className="size-4" /> Back
          </Button>
        }
      />

      <div className="p-6 space-y-4 flex-1">
        {/* Header: Supplier | Date | Status on one row. */}
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1.4fr_1fr] gap-3">
            <FormField label="Supplier" required>
              {(f) => (
                <div className="flex items-center gap-1.5">
                  <Select
                    {...f}
                    autoFocus={!editing && lines.length === 0}
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="flex-1 min-w-0"
                  >
                    <option value="">Choose a supplier…</option>
                    {supplierOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                  <IconButton variant="outline" label="Add new supplier" onClick={() => setNewSupplierOpen(true)}>
                    <Plus className="size-4" />
                  </IconButton>
                </div>
              )}
            </FormField>
            <FormField label="Purchase date" required>
              <DateTimeField value={date} onChange={setDate} />
            </FormField>
            <FormField label="Status" required>
              {(f) =>
                statusLocked ? (
                  <div id={f.id} className="h-10 flex items-center text-sm font-medium">
                    Received
                  </div>
                ) : (
                  <Select {...f} value={status} onChange={(e) => setStatus(e.target.value as PurchaseStatus)}>
                    <option value="received">Received</option>
                    <option value="ordered">Ordered</option>
                    <option value="in-transit">In transit</option>
                  </Select>
                )
              }
            </FormField>
          </div>
          {(supplierAddress || (supplier && supplier.due > 0)) && (
            <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
              {supplierAddress && <span>{supplierAddress}</span>}
              {supplierAddress && supplier && supplier.due > 0 && <span aria-hidden>·</span>}
              {supplier && supplier.due > 0 && (
                <span>
                  <span>Owes on earlier bills</span>{' '}
                  <span className="tabular text-foreground font-medium">{formatBDT(supplier.due)}</span>
                </span>
              )}
            </div>
          )}
          {/* Branch only matters with more than one. */}
          {multiBranch && (
            <FormField label="Branch" required className="max-w-sm">
              {(f) => (
                <Select {...f} value={branch} onChange={(e) => setBranch(e.target.value)}>
                  {(branches.length > 0 ? branches.map((b) => b.name) : branch ? [branch] : []).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          )}
        </Card>

        {/* Items */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Items</div>
            {/* Saved product lands on this purchase straight away (opening stock 0). */}
            <Button variant="outline" onClick={() => setNewProductOpen(true)}>
              <Plus className="size-4" /> Add new product
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value);
                setHi(0);
              }}
              onKeyDown={onSearchKey}
              placeholder="Product name, SKU or scan barcode"
              aria-label="Search product"
              className="pl-9"
            />
            {searchQ.trim() !== '' && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-xl overflow-hidden z-20">
                {matches.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseEnter={() => setHi(i)}
                    onClick={() => pickProduct(p)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left',
                      i === hi ? 'bg-secondary' : 'hover:bg-secondary',
                    )}
                  >
                    <ProductImage url={p.image} categoryId={p.categoryId} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-mono">{p.sku}</span> · <span>In stock</span>{' '}
                        <span className="tabular">{formatNumber(p.stock)}</span> {p.unit}
                      </div>
                    </div>
                    {/* The three prices a buyer judges a quote by. */}
                    <PriceTriplet cost={p.cost} avgCost={p.avgCost ?? p.cost} price={p.price} />
                    <Plus className="size-4 text-primary shrink-0" />
                  </button>
                ))}
                {matches.length === 0 && (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No product found.</div>
                )}
              </div>
            )}
          </div>

          {/* 7 columns: secondary numbers ride as small lines under their neighbours. */}
          <div className="mt-3 -mx-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="text-xs text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Product</th>
                  <th className="text-left px-1.5 py-2 font-medium w-[230px]">Qty</th>
                  <th className="text-right px-1.5 py-2 font-medium w-[120px]">Unit cost</th>
                  <th className="text-right px-1.5 py-2 font-medium w-[76px]">Disc %</th>
                  <th className="text-right px-1.5 py-2 font-medium w-[120px]">Line total</th>
                  <th className="text-right px-1.5 py-2 font-medium w-[120px]">Sell price</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  // Live from the catalogue (a stored average would be stale).
                  const cat = products.find((p) => p.id === l.productId);
                  const baseUnit = cat?.unit ?? l.baseUnit ?? 'pc';
                  const factor = l.unitFactor ?? 1;
                  const convs = (cat?.unitConversions ?? []).filter((u) => u.factor > 1);
                  const conv = convs.find((u) => u.unit === l.unit && u.factor === factor);
                  const packValue = factor <= 1 ? 'p:1' : conv ? `u:${conv.unit}` : `p:${factor}`;
                  const margin =
                    l.marginPct ??
                    (!l.newSellPrice && cat && cat.price > 0 && l.unitCostBeforeTax > 0
                      ? markupOnCostPct(cat.price, l.unitCostBeforeTax)
                      : undefined);
                  const showSerial = !!l.imei || serialOpen.has(i);
                  return (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium leading-tight">{l.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{l.sku}</div>
                        {showSerial ? (
                          <Input
                            value={l.imei ?? ''}
                            onChange={(e) => updateLine(i, { imei: e.target.value })}
                            placeholder="Serial no."
                            aria-label="Serial no."
                            className="h-9 mt-1 max-w-[14rem]"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSerialOpen((s) => new Set(s).add(i))}
                            className="text-xs text-primary hover:underline mt-0.5 focus-ring rounded"
                          >
                            + Serial no.
                          </button>
                        )}
                      </td>
                      {/*
                        BOUGHT BY THE PACK, SOLD BY THE PIECE: "5 dozen at 620"
                        keeps the bill exact while stock arrives as 60 pc.
                        The product's own units come first.
                      */}
                      <td className="px-1.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <NumberField
                            value={l.qty}
                            aria-label="Quantity"
                            onChangeNumber={(v) => updateLine(i, { qty: Math.max(0, v) })}
                            className="h-9 w-20 px-2 text-right text-sm"
                          />
                          <Select
                            value={packValue}
                            aria-label="Bought as"
                            title="What the supplier is quoting — the price is per one of these"
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v.startsWith('u:')) {
                                const u = convs.find((x) => x.unit === v.slice(2));
                                if (u) updateLine(i, { unitFactor: u.factor, unit: u.unit, baseUnit });
                                return;
                              }
                              const f = Number(v.slice(2));
                              const preset = PACKS.find((p) => p.factor === f);
                              updateLine(i, {
                                unitFactor: f,
                                unit: f > 1 ? (preset?.label ?? 'pack') : baseUnit,
                                baseUnit,
                              });
                            }}
                            className="h-9 flex-1 min-w-0 px-2"
                          >
                            <option value="p:1">{baseUnit}</option>
                            {convs.map((u) => (
                              <option key={`u:${u.unit}`} value={`u:${u.unit}`}>
                                {u.unit} ({u.factor} {baseUnit})
                              </option>
                            ))}
                            {convs.length > 0 && <option disabled>──────</option>}
                            {PACKS.filter((p) => p.factor > 1).map((p) => (
                              <option key={p.factor} value={`p:${p.factor}`}>
                                {p.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        {factor > 1 && (
                          <div className="text-xs text-muted-foreground mt-0.5 tabular">
                            = {formatNumber(round2(l.qty * factor))} {baseUnit}
                          </div>
                        )}
                      </td>
                      <td className="px-1.5 py-2 text-right">
                        <NumberField
                          value={l.unitCostBeforeDisc}
                          aria-label="Unit cost"
                          onChangeNumber={(v) => updateLine(i, { unitCostBeforeDisc: v })}
                          className="h-9 w-full px-2 text-right text-sm"
                        />
                        {/* Average paid, right beside the price being typed. */}
                        {cat && (
                          <div className="text-xs text-muted-foreground mt-0.5 tabular">
                            <span>avg</span> {formatBDT(cat.avgCost ?? cat.cost, { withSymbol: false })}
                          </div>
                        )}
                      </td>
                      <td className="px-1.5 py-2 text-right">
                        <NumberField
                          value={l.discountPct}
                          aria-label="Discount %"
                          onChangeNumber={(v) => updateLine(i, { discountPct: v })}
                          placeholder="0"
                          className="h-9 w-full px-2 text-right text-sm"
                        />
                      </td>
                      <td className="px-1.5 py-2 text-right">
                        <div className="h-9 flex items-center justify-end tabular font-semibold">
                          {formatBDT(l.lineTotal, { withSymbol: false })}
                        </div>
                        <div className="text-xs text-muted-foreground tabular">
                          {formatBDT(l.unitCostBeforeTax, { withSymbol: false })} <span>each</span>
                        </div>
                      </td>
                      <td className="px-1.5 py-2 text-right">
                        <NumberField
                          value={l.newSellPrice ?? 0}
                          aria-label="Sell price"
                          onChangeNumber={(v) => updateLine(i, { newSellPrice: v })}
                          placeholder={cat ? formatBDT(cat.price, { withSymbol: false }) : ''}
                          className="h-9 w-full px-2 text-right text-sm"
                        />
                        <div
                          className={cn(
                            'text-xs mt-0.5 tabular',
                            margin === undefined
                              ? 'text-muted-foreground'
                              : margin < 10
                                ? 'text-destructive'
                                : margin > 30
                                  ? 'text-success'
                                  : 'text-warning',
                          )}
                        >
                          {margin !== undefined ? (
                            <>
                              {margin.toFixed(1)}% <span>margin</span>
                            </>
                          ) : !l.newSellPrice && editing ? (
                            <span>blank = keep current</span>
                          ) : (
                            '—'
                          )}
                        </div>
                      </td>
                      <td className="px-1.5 py-2 text-right">
                        <IconButton size="sm" tone="danger" label="Remove line" onClick={() => removeLine(i)}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      Search or scan above to add items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Discount, tax, shipping, other, pay term, notes — opened when needed. */}
        {chargesOpen ? (
          <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Discount">
              {(f) => (
                <div className="flex items-center gap-1.5">
                  <NumberField {...f} value={orderDiscountValue} onChangeNumber={setOrderDiscountValue} className="flex-1 min-w-0" />
                  <Segmented
                    ariaLabel="Discount type"
                    value={orderDiscountType}
                    onChange={setOrderDiscountType}
                    options={[
                      { value: 'flat', label: '৳' },
                      { value: 'percent', label: '%' },
                    ]}
                  />
                </div>
              )}
            </FormField>
            <FormField label="Purchase tax %">
              {(f) => <NumberField {...f} value={taxPct} onChangeNumber={setTaxPct} />}
            </FormField>
            <FormField label="Pay term">
              {(f) => (
                <Select {...f} value={payTerms} onChange={(e) => setPayTerms(e.target.value)}>
                  <option value="">—</option>
                  {PAY_TERMS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                  {payTerms && !PAY_TERMS.some((t) => t.value === payTerms) && (
                    <option value={payTerms}>{payTerms}</option>
                  )}
                </Select>
              )}
            </FormField>
            <FormField label="Shipping charge (৳)">
              {(f) => <NumberField {...f} value={shipping} onChangeNumber={setShipping} />}
            </FormField>
            <FormField label="Shipping details">
              {(f) => (
                <Input
                  {...f}
                  value={shippingDetails}
                  onChange={(e) => setShippingDetails(e.target.value)}
                  placeholder="Courier, vehicle, driver…"
                />
              )}
            </FormField>
            <FormField label="Other charge (৳)">
              {(f) => <NumberField {...f} value={other} onChangeNumber={setOther} />}
            </FormField>
            <FormField label="Notes" hint="Supplier’s invoice no., etc." className="md:col-span-3">
              {(f) => (
                <textarea
                  {...f}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                />
              )}
            </FormField>
          </Card>
        ) : (
          <button
            type="button"
            onClick={() => setChargesOpen(true)}
            className="text-sm text-primary hover:underline focus-ring rounded"
          >
            + Add discount, shipping or other charges
          </button>
        )}

        {lowMarginLines.length > 0 && (
          <div className="rounded-md bg-warning/10 text-warning px-3 py-2 text-sm flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>Some items will have a margin under 10%. Adjust sell prices in the table or save anyway.</span>
          </div>
        )}
      </div>

      {/* STICKY ACTION BAR — the total and the save buttons stay in view. */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-card px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="text-sm text-muted-foreground">
          <span className="tabular text-foreground font-medium">{formatNumber(totalQtyLabel)}</span> <span>items</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">Net total</span>
            <span className="text-xl font-bold tabular">{formatBDT(totals.total)}</span>
          </div>
          {hasCharges && (
            <div className="text-xs text-muted-foreground tabular">
              <span>Subtotal</span> {formatBDT(totals.subtotal, { withSymbol: false })}
              {totals.totalLineDiscount + totals.orderDiscount > 0 && (
                <>
                  {' · '}
                  <span>Discount</span> −{formatBDT(totals.totalLineDiscount + totals.orderDiscount, { withSymbol: false })}
                </>
              )}
              {totals.tax > 0 && (
                <>
                  {' · '}
                  <span>Tax</span> {formatBDT(totals.tax, { withSymbol: false })}
                </>
              )}
              {totals.shipping + totals.other > 0 && (
                <>
                  {' · '}
                  <span>Charges</span> {formatBDT(totals.shipping + totals.other, { withSymbol: false })}
                </>
              )}
            </div>
          )}
        </div>
        {editing && (
          <div className="text-sm">
            <div>
              <span className="text-muted-foreground">Paid so far</span>{' '}
              <span className="tabular">{formatBDT(editing.paid)}</span> ·{' '}
              <span className="text-muted-foreground">Will owe</span>{' '}
              <span className="tabular font-medium">{formatBDT(Math.max(0, willOwe))}</span>
            </div>
            {willOwe < 0 && (
              <div className="text-warning text-xs">
                <span className="tabular">{formatBDT(-willOwe)}</span>{' '}
                <span>will become an advance with the supplier.</span>
              </div>
            )}
          </div>
        )}
        <div className="flex-1" />
        {problem && <span className="text-sm text-muted-foreground">{problem}</span>}
        {editing ? (
          <Button size="lg" className="min-w-[10rem]" onClick={() => void saveCorrection()} disabled={!isValid || saving}>
            <Save className="size-4" /> Save correction
          </Button>
        ) : (
          <>
            <Button size="lg" variant="outline" className="min-w-[10rem]" onClick={saveUnpaid} disabled={!isValid || saving}>
              <Save className="size-4" /> Save Unpaid
            </Button>
            <Button size="lg" className="min-w-[10rem]" onClick={saveAndPay} disabled={!isValid || saving}>
              <Banknote className="size-4" /> Save & Pay
            </Button>
          </>
        )}
      </div>

      {pendingPayment && (
        <AddPurchasePaymentModal
          open={!!pendingPayment}
          cancelLabel="Pay later"
          onClose={() => {
            // Closed without paying → say where the bill went.
            const now = usePurchases.getState().purchases.find((p) => p.id === pendingPayment.id);
            if (!now || now.paid <= pendingPayment.paid) {
              toast.info('Saved as unpaid. Pay it later with Pay Bill.', { description: pendingPayment.refNo });
            }
            setPendingPayment(null);
            nav('/purchases');
          }}
          purchase={pendingPayment}
        />
      )}

      <NewSupplierModal
        open={newSupplierOpen}
        onClose={() => setNewSupplierOpen(false)}
        onCreated={(id) => {
          setSupplierId(id);
          // Refresh the option list so the new supplier appears in the select.
          void loadSupplierOptions();
        }}
      />

      {/* "Add new product" — the created product lands on this purchase straight away. */}
      <NewProductDrawer
        open={newProductOpen}
        onClose={() => setNewProductOpen(false)}
        lockStock
        onCreated={(p) => {
          addLineFromProduct(p);
          void productsQuery.refetch();
        }}
        subtitle="Saved to your catalogue and added to this purchase. Stock arrives on the purchase line."
      />
    </div>
  );
}

/**
 * Last buy / average / sell for a product in the search results.
 * `avgCost` is the simple mean of recorded buying prices, not the COGS cost.
 */
function PriceTriplet({ cost, avgCost, price }: { cost: number; avgCost: number; price: number }) {
  return (
    <div className="shrink-0 flex items-center gap-4 text-right">
      <TripletCell label="Last buy" value={cost} tone="text-warning" />
      <TripletCell label="Average" value={avgCost} tone="text-foreground" />
      <TripletCell label="Sell" value={price} tone="text-success" />
    </div>
  );
}

function TripletCell({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground leading-none">{label}</div>
      <div className={cn('mt-0.5 text-sm tabular font-semibold', tone)}>
        {formatBDT(value, { withSymbol: false })}
      </div>
    </div>
  );
}
