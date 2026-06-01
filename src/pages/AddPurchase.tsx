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
import { products as mockProducts } from '@/mocks/data';
import { hasBackend } from '@/lib/api';
import { useProducts } from '@/hooks/useProducts';
import { useBranches } from '@/stores/branches';
import { useSuppliers } from '@/stores/contacts';
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

export default function AddPurchase() {
  const nav = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const purchases = usePurchases((s) => s.purchases);
  const addPurchase = usePurchases((s) => s.addPurchase);
  const suppliers = useSuppliers((s) => s.items);

  // Data source: live backend when available, else mock seed (mirrors POS.tsx).
  const backend = hasBackend();
  const productsQuery = useProducts('br_mp');
  const products = backend ? (productsQuery.data ?? []) : mockProducts;
  const branches = useBranches((s) => s.items);

  // Hydrate branches on mount (cheap no-op without a backend).
  const hydrateBranches = useBranches((s) => s.hydrate);
  useEffect(() => {
    void hydrateBranches();
  }, [hydrateBranches]);

  const editing = id ? purchases.find((p) => p.id === id) : undefined;

  // Default branch: edit value wins; otherwise the default branch name, else first.
  const defaultBranchName =
    editing?.branch ??
    (branches.find((b) => b.isDefault)?.name ?? branches[0]?.name ?? 'Mirpur Branch');

  // Header
  const [supplierId, setSupplierId] = useState(editing?.supplierId ?? '');
  const [refNo, setRefNo] = useState(editing?.refNo ?? '');
  const [date, setDate] = useState((editing?.date ?? new Date().toISOString()).slice(0, 16));
  const [branch, setBranch] = useState(defaultBranchName);
  const [status, setStatus] = useState<PurchaseStatus>(editing?.status ?? 'received');
  const [payTerms, setPayTerms] = useState<string>(editing?.payTerms ?? '');
  const [attachmentName, setAttachmentName] = useState<string | undefined>(editing?.attachmentName);

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

  // Auto-fill from supplier
  const supplier = suppliers.find((s) => s.id === supplierId);
  const supplierAddress = supplier?.address ?? '';
  const supplierPayTerms = supplier?.paymentTerms ?? '';

  const matches = useMemo(() => {
    if (!searchQ.trim()) return [];
    const t = searchQ.toLowerCase();
    return products
      .filter((p) => `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(t))
      .slice(0, 8);
  }, [searchQ, products]);

  const addLine = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const idx = lines.findIndex((l) => l.productId === productId);
    if (idx >= 0) {
      const next = [...lines];
      next[idx] = recomputeLine({ ...next[idx], qty: next[idx].qty + 1 });
      setLines(next);
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
      setLines([...lines, newLine]);
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

  const isValid = supplierId && lines.length > 0 && lines.every((l) => l.qty > 0);

  const buildRecord = (paid = 0): PurchaseRecord => ({
    id: editing?.id ?? 'pu_' + Date.now(),
    refNo: refNo || nextPurchaseRef(),
    status,
    date,
    supplierId,
    supplierName: supplier?.name ?? '',
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

  const saveUnpaid = async () => {
    if (!isValid) return;
    // EDIT-MODE INTEGRITY (backend): there is no `purchases.update` channel, and
    // a saved purchase may already have moved stock (status 'received') and cash.
    // Re-creating it would duplicate the record and double-count stock/cash, so
    // editing an existing backend purchase in place is blocked — the user should
    // Cancel it (which reverses stock + cash) and add a new one.
    if (backend && editing) {
      alert(
        'A saved purchase cannot be edited in place (it may have already affected stock and cash). ' +
          'Cancel it from the purchase detail, then add a new purchase.',
      );
      return;
    }
    if (lowMarginLines.length > 0) {
      if (!confirm(
        `${lowMarginLines.length} item(s) will have margin under 10%. Save anyway?`,
      ))
        return;
    }
    const rec = buildRecord(0);
    await addPurchase(rec);
    nav('/purchases');
  };

  const saveAndPay = async () => {
    if (!isValid) return;
    // EDIT-MODE INTEGRITY (backend): same rule as saveUnpaid — never re-create an
    // existing purchase, it would duplicate stock-in and cash-out.
    if (backend && editing) {
      alert(
        'A saved purchase cannot be edited in place (it may have already affected stock and cash). ' +
          'Cancel it from the purchase detail, then add a new purchase.',
      );
      return;
    }
    // Save & Pay (now wired to the persisted purchase): under a backend,
    // addPurchase() awaits api('purchases.create') (which returns the new backend
    // id) and rehydrates, resolving to that real id. We then look the rehydrated
    // record up by that id and open the payment modal on it, so the payment posts
    // to the persisted purchase — not the optimistic local-id record. Without a
    // backend we keep opening the modal on the optimistic `rec`.
    if (lowMarginLines.length > 0) {
      if (!confirm(
        `${lowMarginLines.length} item(s) will have margin under 10%. Save anyway?`,
      ))
        return;
    }
    const rec = buildRecord(0);
    let newId: string;
    try {
      newId = await addPurchase(rec);
    } catch {
      // addPurchase already surfaced the error toast + rehydrated.
      return;
    }
    if (backend) {
      const persisted = usePurchases.getState().purchases.find((p) => p.id === newId);
      if (persisted) {
        setPendingPayment(persisted);
      } else {
        // Couldn't locate the rehydrated purchase — don't attach to a stale id.
        toast.error('Purchase saved, but could not open payment. Open it from the Purchases list.');
        nav('/purchases');
      }
      return;
    }
    setPendingPayment(rec);
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

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="xl:col-span-2 space-y-4">
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
                    {suppliers.map((s) => (
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
                  {(branches.length > 0 ? branches.map((b) => b.name) : [branch]).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="md:col-span-1 space-y-3">
              <Field label="Purchase Date" required>
                <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
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
              <Button variant="ghost" size="sm">
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
                      <div className="text-xs text-muted-foreground font-mono tabular">
                        ৳{p.cost}
                      </div>
                      <Plus className="size-3.5 text-primary" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 -mx-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead className="text-[10px] uppercase text-muted-foreground bg-secondary/40">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-8">#</th>
                    <th className="text-left px-2 py-2 font-medium">Product Name</th>
                    <th className="text-right px-2 py-2 font-medium">Purchase Qty</th>
                    <th className="text-left px-2 py-2 font-medium">IMEI / Serial</th>
                    <th className="text-right px-2 py-2 font-medium">Unit Cost (Before Disc)</th>
                    <th className="text-right px-2 py-2 font-medium">Disc %</th>
                    <th className="text-right px-2 py-2 font-medium">Unit Cost (Before Tax)</th>
                    <th className="text-right px-2 py-2 font-medium">Line Total</th>
                    <th className="text-right px-2 py-2 font-medium">Margin %</th>
                    <th className="text-right px-2 py-2 font-medium">Sell Price (Inc.)</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-2">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{l.sku}</div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <NumberField
                          value={l.qty}
                          onChangeNumber={(v) => updateLine(i, { qty: Math.max(0, v) })}
                          className="h-7 w-20 px-2 text-right text-xs ml-auto"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={l.imei ?? ''}
                          onChange={(e) => updateLine(i, { imei: e.target.value })}
                          placeholder="—"
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <NumberField
                          value={l.unitCostBeforeDisc}
                          onChangeNumber={(v) => updateLine(i, { unitCostBeforeDisc: v })}
                          className="h-7 w-24 px-2 text-right text-xs ml-auto"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <NumberField
                          value={l.discountPct}
                          onChangeNumber={(v) => updateLine(i, { discountPct: v })}
                          placeholder="0"
                          className="h-7 w-16 px-2 text-right text-xs ml-auto"
                        />
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular text-muted-foreground">
                        {formatBDT(l.unitCostBeforeTax, { withSymbol: false })}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular font-semibold">
                        {formatBDT(l.lineTotal, { withSymbol: false })}
                      </td>
                      <td className="px-2 py-2 text-right">
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
                      <td className="px-2 py-2 text-right">
                        <NumberField
                          value={l.newSellPrice ?? 0}
                          onChangeNumber={(v) => updateLine(i, { newSellPrice: v })}
                          className="h-7 w-24 px-2 text-right text-xs ml-auto"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={() => removeLine(i)}
                          className="size-7 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground text-sm">
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

        {/* RIGHT — sticky summary */}
        <div className="space-y-4">
          <Card className="p-4 sticky top-4">
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
        onCreated={(id) => setSupplierId(id)}
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

void Badge;
