import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Save,
  Search,
  Trash2,
  Paperclip,
  Banknote,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
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
import { formatBDT, cn } from '@/lib/utils';
import { consumePurchasePrefill } from '@/lib/purchasePrefill';
import { AddPurchasePaymentModal } from '@/components/purchases/AddPurchasePaymentModal';
import { NewSupplierModal } from '@/components/purchases/NewSupplierModal';
import { NewProductDrawer } from '@/components/products/NewProductDrawer';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { toLocalInput, fromLocalInput } from '@/lib/datetime';

export default function AddPurchase() {
  const nav = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const purchases = usePurchases((s) => s.purchases);
  const addPurchase = usePurchases((s) => s.addPurchase);
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
  const productsQuery = useProducts('br_mp');
  const products = productsQuery.data ?? [];
  const branches = useBranches((s) => s.items);

  // Hydrate branches + load the full supplier option list on mount (cheap
  // no-ops without a backend).
  const hydrateBranches = useBranches((s) => s.hydrate);
  useEffect(() => {
    void hydrateBranches();
    void loadSupplierOptions();
  }, [hydrateBranches, loadSupplierOptions]);

  const editing = id ? purchases.find((p) => p.id === id) : undefined;

  // Default branch: edit value wins; otherwise the default branch name, else
  // first. No hardcoded branch-name fallback (see the hydrate effect below).
  const defaultBranchName =
    editing?.branch ?? (branches.find((b) => b.isDefault)?.name ?? branches[0]?.name ?? '');

  // Header
  const [supplierId, setSupplierId] = useState(editing?.supplierId ?? '');
  const [refNo, setRefNo] = useState(editing?.refNo ?? '');
  /**
   * Defaults to RIGHT NOW on the shop's clock, and stays editable.
   * Was `new Date().toISOString().slice(0, 16)` — UTC, so it read six hours behind
   * in Dhaka, and "fixing" it wrote an instant in the future. See lib/datetime.ts.
   */
  const [date, setDate] = useState(toLocalInput(editing?.date));
  const [branch, setBranch] = useState(defaultBranchName);
  const [status, setStatus] = useState<PurchaseStatus>(editing?.status ?? 'received');
  const [payTerms, setPayTerms] = useState<string>(editing?.payTerms ?? '');
  const [attachmentName, setAttachmentName] = useState<string | undefined>(editing?.attachmentName);

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

  const addLine = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (p) addLineFromProduct(p);
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

  const isValid = supplierId && lines.length > 0 && lines.every((l) => l.qty > 0);

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
    user: 'Seam',
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
    due: Math.max(0, totals.total - paid),
    payments: [],
    notes: notes || undefined,
    audit: [{ id: 'a_' + Date.now(), at: new Date().toISOString(), by: 'Seam', action: 'created' }],
  });

  // For Save & Pay flow we save first then open the payment modal on a transient record
  const [pendingPayment, setPendingPayment] = useState<PurchaseRecord | null>(null);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);

  const saveUnpaid = async () => {
    if (!isValid) return;
    // EDIT-MODE INTEGRITY (backend): there is no `purchases.update` channel, and
    // a saved purchase may already have moved stock (status 'received') and cash.
    // Re-creating it would duplicate the record and double-count stock/cash, so
    // editing an existing backend purchase in place is blocked — the user should
    // Cancel it (which reverses stock + cash) and add a new one.
    if (editing) {
      toast.error('A saved purchase cannot be edited in place', {
        description:
          'It may have already affected stock and cash. Cancel it from the purchase detail, then add a new purchase.',
      });
      return;
    }
    if (lowMarginLines.length > 0) {
      const ok = await confirm({
        title: `${lowMarginLines.length} item(s) will have margin under 10%.`,
        message: 'Save anyway?',
        confirmLabel: 'Save',
      });
      if (!ok) return;
    }
    const rec = buildRecord(0);
    await addPurchase(rec);
    nav('/purchases');
  };

  const saveAndPay = async () => {
    if (!isValid) return;
    // EDIT-MODE INTEGRITY (backend): same rule as saveUnpaid — never re-create an
    // existing purchase, it would duplicate stock-in and cash-out.
    if (editing) {
      toast.error('A saved purchase cannot be edited in place', {
        description:
          'It may have already affected stock and cash. Cancel it from the purchase detail, then add a new purchase.',
      });
      return;
    }
    // Save & Pay is always wired to the persisted purchase: addPurchase() awaits
    // api('purchases.create') (which returns the new backend id) and rehydrates,
    // resolving to that real id. We then look the rehydrated record up by that
    // id and open the payment modal on it, so the payment posts to the persisted
    // purchase. The optimistic local-id fallback was removed.
    if (lowMarginLines.length > 0) {
      const ok = await confirm({
        title: `${lowMarginLines.length} item(s) will have margin under 10%.`,
        message: 'Save anyway?',
        confirmLabel: 'Save',
      });
      if (!ok) return;
    }
    const rec = buildRecord(0);
    let newId: string;
    try {
      newId = await addPurchase(rec);
    } catch {
      // addPurchase already surfaced the error toast + rehydrated.
      return;
    }
    const persisted = usePurchases.getState().purchases.find((p) => p.id === newId);
    if (persisted) {
      setPendingPayment(persisted);
    } else {
      // Couldn't locate the rehydrated purchase — don't attach to a stale id.
      toast.error('Purchase saved, but could not open payment. Open it from the Purchases list.');
      nav('/purchases');
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAttachmentName(f.name);
  };

  return (
    <div>
      <PageHeader
        title={editing ? 'Edit Purchase' : 'Add Purchase'}
        subtitle="Goods Received Note"
        actions={
          <>
            <Button variant="ghost" onClick={() => nav(-1)}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button variant="outline" onClick={saveUnpaid} disabled={!isValid}>
              <Save className="size-4" /> Save Unpaid
            </Button>
            <Button onClick={saveAndPay} disabled={!isValid}>
              <Banknote className="size-4" /> Save & Pay
            </Button>
          </>
        }
      />

      {/*
        LAYOUT — ONE COLUMN, WIDEST THING FIRST.
        This used to be a 2/3 + 1/3 split with a sticky Summary card on the right,
        which left the item table about 60% of the window: eleven columns of
        quantities and prices squeezed into it, so entering a purchase meant
        scrolling the table sideways to reach the sell price and margin — with the
        product name scrolled out of sight. The table is what the buyer actually
        works in, so it now gets the FULL width and the Summary sits underneath,
        where it is read once at the end.
      */}
      <div className="p-6 space-y-4">
        <div className="space-y-4">
          {/* Header card matching the reference layout */}
          <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-3">
              <Field label="Supplier" required>
                <div className="flex items-center gap-1.5">
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                  >
                    <option value="">Please Select</option>
                    {supplierOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setNewSupplierOpen(true)}
                    title="Add new supplier"
                    className="size-9 grid place-items-center rounded-md border border-border hover:border-primary hover:bg-primary/10 hover:text-primary text-muted-foreground transition shrink-0"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </Field>
              {supplierAddress && (
                <div>
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Address
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{supplierAddress}</div>
                </div>
              )}
            </div>

            <div className="md:col-span-1 space-y-3">
              <Field label="Reference No" hint="Auto-generated if blank">
                <Input
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  placeholder={nextPurchaseRef()}
                />
              </Field>
              <Field label="Business Location" required>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {(branches.length > 0 ? branches.map((b) => b.name) : branch ? [branch] : []).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="md:col-span-1 space-y-3">
              <Field label="Purchase Date" required>
                <DateTimeField value={date} onChange={setDate} />
              </Field>
              <Field label="Pay Term" hint={supplierPayTerms ? `Supplier default: ${supplierPayTerms}` : undefined}>
                <Input
                  value={payTerms}
                  onChange={(e) => setPayTerms(e.target.value)}
                  placeholder={supplierPayTerms || 'Please Select'}
                />
              </Field>
            </div>

            <div className="md:col-span-1">
              <Field label="Purchase Status" required>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PurchaseStatus)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 capitalize"
                >
                  <option value="received">Received</option>
                  <option value="ordered">Ordered</option>
                  <option value="in-transit">In Transit</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Attach Document" hint="Max 5MB · pdf, csv, zip, doc, docx, jpeg, jpg, png">
                <label className="cursor-pointer flex items-center gap-2 px-3 h-9 rounded-md border border-input bg-background hover:bg-secondary/50 transition text-xs">
                  <Paperclip className="size-3.5" />
                  <span className="flex-1 truncate">{attachmentName ?? 'Browse'}</span>
                  <input type="file" className="hidden" onChange={handleFile} />
                </label>
              </Field>
            </div>
          </Card>

          {/* Items */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Items</div>
              {/* Was a dead button with no handler at all. Opens the real product
                  form in a drawer; the saved product is added to this purchase
                  immediately with its opening stock locked to 0, because the
                  quantity arrives on the line below. */}
              <Button variant="outline" size="sm" onClick={() => setNewProductOpen(true)}>
                <Plus className="size-3.5" /> Add new product
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Enter product name / SKU / scan barcode / IMEI"
                className="pl-9"
              />
              {matches.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-xl overflow-hidden z-10">
                  {matches.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addLine(p.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary text-left"
                    >
                      <ProductImage url={p.image} categoryId={p.categoryId} size={28} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {p.sku} · stock {p.stock} {p.unit}
                        </div>
                      </div>
                      {/* Last paid, average paid, current sell price — the three
                          numbers a buyer needs to judge the price being quoted,
                          before the line is even added. Colour is the label:
                          amber = paid out, blue = average paid, green = coming in. */}
                      <PriceTriplet
                        cost={p.cost}
                        avgCost={p.avgCost ?? p.cost}
                        price={p.price}
                      />
                      <Plus className="size-3.5 text-primary shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* `min-w` dropped from 1100px to 860px and the widest columns tightened,
                so on any normal window the whole line — name through sell price —
                is visible at once. overflow-x-auto stays as the safety valve for a
                window narrowed to the 900px minimum. */}
            <div className="mt-3 -mx-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[940px]">
                <thead className="text-[10px] uppercase text-muted-foreground bg-secondary/40">
                  <tr>
                    <th className="text-left px-2 py-2 font-medium w-8">#</th>
                    <th className="text-left px-2 py-2 font-medium">Product Name</th>
                    <th className="text-right px-1 py-2 font-medium w-[74px]">Qty</th>
                    <th className="text-left px-1 py-2 font-medium w-[96px]">Serial</th>
                    {/* Read-only: the average we have paid for this item before,
                        sitting right next to the price being entered so a bad
                        quote is obvious while it is still being typed. */}
                    <th className="text-right px-1 py-2 font-medium w-[84px]">Avg buy</th>
                    <th className="text-right px-1 py-2 font-medium w-[92px]">Unit Cost</th>
                    <th className="text-right px-1 py-2 font-medium w-[62px]">Disc %</th>
                    <th className="text-right px-1 py-2 font-medium w-[86px]">Net Cost</th>
                    <th className="text-right px-1 py-2 font-medium w-[92px]">Line Total</th>
                    <th className="text-right px-1 py-2 font-medium w-[70px]">Margin</th>
                    <th className="text-right px-1 py-2 font-medium w-[96px]">Sell Price</th>
                    <th className="w-9"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    // Read live from the catalogue, not copied onto the line: a
                    // stored average would be stale the moment another purchase is
                    // recorded. Unknown product renders '—', never 0.
                    const cat = products.find((p) => p.id === l.productId);
                    return (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-2">
                        <div className="font-medium leading-tight">{l.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{l.sku}</div>
                      </td>
                      <td className="px-1 py-2 text-right">
                        <NumberField
                          value={l.qty}
                          onChangeNumber={(v) => updateLine(i, { qty: Math.max(0, v) })}
                          className="h-7 w-full px-1.5 text-right text-xs"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          value={l.imei ?? ''}
                          onChange={(e) => updateLine(i, { imei: e.target.value })}
                          placeholder="—"
                          className="h-7 px-1.5 text-xs"
                        />
                      </td>
                      <td className="px-1 py-2 text-right font-mono tabular text-xs text-primary">
                        {cat ? formatBDT(cat.avgCost ?? cat.cost, { withSymbol: false }) : '—'}
                      </td>
                      <td className="px-1 py-2 text-right">
                        <NumberField
                          value={l.unitCostBeforeDisc}
                          onChangeNumber={(v) => updateLine(i, { unitCostBeforeDisc: v })}
                          className="h-7 w-full px-1.5 text-right text-xs"
                        />
                      </td>
                      <td className="px-1 py-2 text-right">
                        <NumberField
                          value={l.discountPct}
                          onChangeNumber={(v) => updateLine(i, { discountPct: v })}
                          placeholder="0"
                          className="h-7 w-full px-1.5 text-right text-xs"
                        />
                      </td>
                      <td className="px-1 py-2 text-right font-mono tabular text-muted-foreground text-xs">
                        {formatBDT(l.unitCostBeforeTax, { withSymbol: false })}
                      </td>
                      <td className="px-1 py-2 text-right font-mono tabular font-semibold text-xs">
                        {formatBDT(l.lineTotal, { withSymbol: false })}
                      </td>
                      <td className="px-1 py-2 text-right">
                        <span
                          className={cn(
                            'font-mono tabular text-xs',
                            l.marginPct === undefined
                              ? 'text-muted-foreground'
                              : l.marginPct < 10
                                ? 'text-destructive'
                                : l.marginPct > 30
                                  ? 'text-success'
                                  : 'text-warning',
                          )}
                        >
                          {l.marginPct !== undefined ? `${l.marginPct.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td className="px-1 py-2 text-right">
                        <NumberField
                          value={l.newSellPrice ?? 0}
                          onChangeNumber={(v) => updateLine(i, { newSellPrice: v })}
                          className="h-7 w-full px-1.5 text-right text-xs"
                        />
                      </td>
                      <td className="px-1 py-2 text-right">
                        <button
                          onClick={() => removeLine(i)}
                          title="Remove line"
                          className="size-7 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        Search above to add items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Bottom: discount type + tax + shipping + notes */}
          <Card className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Field label="Discount Type">
                <select
                  value={orderDiscountType}
                  onChange={(e) => setOrderDiscountType(e.target.value as 'flat' | 'percent')}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="flat">Flat (৳)</option>
                  <option value="percent">Percent (%)</option>
                </select>
              </Field>
              <Field label="Discount Amount">
                <NumberField value={orderDiscountValue} onChangeNumber={setOrderDiscountValue} />
              </Field>
              <Field label="Purchase Tax %">
                <NumberField value={taxPct} onChangeNumber={setTaxPct} />
              </Field>
            </div>
            <div className="space-y-3">
              <Field label="Shipping Charge (৳)">
                <NumberField value={shipping} onChangeNumber={setShipping} />
              </Field>
              <Field label="Shipping Details">
                <Input
                  value={shippingDetails}
                  onChange={(e) => setShippingDetails(e.target.value)}
                  placeholder="Courier, vehicle, driver…"
                />
              </Field>
              <Field label="Other Charge (৳)">
                <NumberField value={other} onChangeNumber={setOther} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Additional Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Anything to remember about this purchase…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* SUMMARY — at the BOTTOM, and no longer sticky.
            It was a third of the window's width for the whole time the buyer was
            typing lines, purely so it could hover. It is read once, at the end. */}
        <div className="space-y-4">
          <Card className="p-4 md:max-w-md md:ml-auto">
            <div className="text-sm font-semibold">Summary</div>
            <div className="mt-3 space-y-1.5 text-sm">
              <Row label="Total items" value={String(lines.length)} />
              <Row label="Total qty" value={String(lines.reduce((s, l) => s + l.qty, 0))} />
              <div className="border-t border-border pt-2" />
              <Row label="Subtotal" value={formatBDT(totals.subtotal)} />
              {totals.totalLineDiscount > 0 && (
                <Row label="Line discount" value={`− ${formatBDT(totals.totalLineDiscount)}`} tone="success" />
              )}
              {totals.orderDiscount > 0 && (
                <Row label="Order discount" value={`− ${formatBDT(totals.orderDiscount)}`} tone="success" />
              )}
              {totals.tax > 0 && <Row label={`Tax (${taxPct}%)`} value={formatBDT(totals.tax)} />}
              {totals.shipping > 0 && <Row label="Shipping" value={formatBDT(totals.shipping)} />}
              {totals.other > 0 && <Row label="Other" value={formatBDT(totals.other)} />}
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="font-semibold">Net Total</span>
                <span className="text-xl font-bold font-mono tabular text-primary">
                  {formatBDT(totals.total)}
                </span>
              </div>
            </div>

            {lowMarginLines.length > 0 && (
              <div className="mt-3 rounded-md bg-warning/10 text-warning px-3 py-2 text-xs flex items-start gap-2">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                <span>
                  {lowMarginLines.length} item{lowMarginLines.length === 1 ? '' : 's'} will have
                  margin under 10%. Adjust sell prices in the table or save anyway.
                </span>
              </div>
            )}

            {supplier && supplier.due > 0 && (
              <div className="mt-3 rounded-md bg-secondary/60 text-foreground px-3 py-2 text-xs">
                Existing supplier payable: <span className="font-mono tabular">{formatBDT(supplier.due)}</span>
              </div>
            )}
          </Card>
        </div>
      </div>

      {pendingPayment && (
        <AddPurchasePaymentModal
          open={!!pendingPayment}
          onClose={() => {
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

      {/* "Add new product" — the created product lands on this purchase straight
          away, so the buyer can carry on typing the quantity and cost. */}
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

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success';
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-mono tabular', tone === 'success' && 'text-success')}>{value}</span>
    </div>
  );
}

/**
 * Buy / average buy / sell for a product in the search results.
 *
 * Colour is the label for someone who will not read three words every time:
 * amber = money that went out, blue = the average we have paid, green = money
 * coming in. `avgCost` is the simple mean of recorded buying prices, NOT the
 * quantity-weighted cost that drives COGS (see backend/services/costing.ts).
 */
function PriceTriplet({
  cost,
  avgCost,
  price,
}: {
  cost: number;
  avgCost: number;
  price: number;
}) {
  return (
    <div className="shrink-0 flex items-center gap-3 text-right">
      <TripletCell label="Buy" value={cost} tone="text-warning" />
      <TripletCell label="Avg" value={avgCost} tone="text-primary" />
      <TripletCell label="Sell" value={price} tone="text-success" />
    </div>
  );
}

function TripletCell({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase text-muted-foreground leading-none">{label}</div>
      <div className={cn('mt-0.5 text-xs font-mono tabular font-semibold', tone)}>
        {formatBDT(value, { withSymbol: false })}
      </div>
    </div>
  );
}

void Badge;
