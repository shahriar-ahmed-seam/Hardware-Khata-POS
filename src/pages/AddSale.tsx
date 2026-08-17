import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Save,
  Search,
  Trash2,
  Calendar as CalIcon,
  PenSquare,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, formatBDT } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import { useCustomersQuery } from '@/hooks/useCustomers';
import { useBranches } from '@/stores/branches';
import {
  useSales,
  type SaleLine,
  type SalePayment,
  type SaleRecord,
  type SaleStatus,
  nextInvoiceNo,
} from '@/stores/sales';

/**
 * Methods offered when correcting the payments on an invoice.
 *
 * `Credit` is NOT here on purpose. It is not money received — it is the unpaid
 * remainder, and the due is derived as (total − payments). Offering it would let
 * someone zero an invoice's due without any money moving. POS leaves it out of
 * the payments it sends for exactly the same reason.
 */
const PAYMENT_METHODS: SalePayment['method'][] = ['Cash', 'bKash', 'Nagad', 'Card', 'Bank'];
import { toast } from '@/stores/toast';
import { promptText } from '@/stores/prompt';
import { useCan } from '@/hooks/useCan';
import { ProductImage } from '@/components/products/ProductImage';
import { CustomerPicker } from '@/components/pos/CustomerPicker';
import { DateTimeField, DateField } from '@/components/ui/DateTimeField';
import { toLocalInput, fromLocalInput, localDateInputPlusDays } from '@/lib/datetime';
import { round2, saleLineSubtotal, saleTotals } from '@/lib/money';
import type { Product } from '@/types/domain';

export default function AddSale() {
  const nav = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const initialStatus = (searchParams.get('status') as SaleStatus) || 'final';
  const sales = useSales((s) => s.sales);
  const addSale = useSales((s) => s.addSale);
  const updateSaleBackend = useSales((s) => s.updateSale);
  // Editing an existing invoice is Admin-only (see electron/permissions.ts).
  // The IPC gate is authoritative; this just keeps the button honest.
  const canEditSale = useCan('sales.edit');
  const [saving, setSaving] = useState(false);

  // Create-form wiring (backend only): the product/customer pickers read live
  // backend data and the Business Location select feeds a real branch.
  // addSale() persists via api('sales.create'), which generates the server id,
  // customerId, and branch id; this page then navigates to the relevant list
  // which rehydrates from the backend. The mock master-data fallback was
  // removed — empty queries render empty pickers.
  const productsQuery = useProducts('br_mp');
  const customersQuery = useCustomersQuery();
  const products = productsQuery.data ?? [];
  const customers = customersQuery.data ?? [];
  const branches = useBranches((s) => s.items);

  // Hydrate branches on mount (cheap no-op without a backend). The customer
  // picker reads `useCustomersQuery()` (unpaged `customers.list`), NOT the
  // contacts store — so the old `useCustomers().hydrate()` here only fetched one
  // page of customers that nothing on this screen read. It is gone.
  const hydrateBranches = useBranches((s) => s.hydrate);
  useEffect(() => {
    void hydrateBranches();
  }, [hydrateBranches]);

  const editing = id ? sales.find((s) => s.id === id) : undefined;

  // Default customer: edit value wins; otherwise pick the real walk-in customer
  // if the backend has one, else leave empty until the query resolves.
  const defaultCustomerId =
    editing?.customerId ??
    customers.find((c) => c.name === 'Walk-in Customer' || c.id === 'cu1')?.id ??
    '';

  // Default branch: edit value wins; otherwise the default branch name, else
  // first. No hardcoded branch-name fallback — an unhydrated branch list simply
  // leaves the select empty.
  const defaultBranchName =
    editing?.branch ?? (branches.find((b) => b.isDefault)?.name ?? branches[0]?.name ?? '');

  const [status, setStatus] = useState<SaleStatus>(editing?.status ?? initialStatus);
  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [branch, setBranch] = useState(defaultBranchName);
  /**
   * Defaults to RIGHT NOW on the shop's clock, and stays editable.
   *
   * It used to be `new Date().toISOString().slice(0, 16)`, which is UTC — so at
   * 10:02 in Dhaka the box read 04:02. Worse, "correcting" it to 10:02 then wrote
   * an instant six hours in the future, which could push the sale into tomorrow's
   * takings. See lib/datetime.ts.
   */
  const [date, setDate] = useState(toLocalInput(editing?.date));
  const [validUntil, setValidUntil] = useState(
    editing?.validUntil ?? localDateInputPlusDays(14),
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');
  /**
   * THE PAYMENTS ON A SALE BEING CORRECTED.
   *
   * There was no payment editor here at all, so `updateSale` re-applied whatever
   * was already on the invoice verbatim — and correcting a wrongly-keyed AMOUNT
   * TENDERED (৳5,000 typed as ৳500, the most common counter mistake) still meant
   * voiding the invoice and re-creating it under a new number the customer does
   * not have. The backend has always supported this; only the form was missing.
   *
   * `Credit` is deliberately NOT offered as a method: it is not money received,
   * it is the unpaid remainder, and the due is DERIVED (total − payments). POS
   * excludes it from the payments it sends for the same reason; listing it here
   * would let the owner "pay" an invoice with credit and zero its due without any
   * money moving.
   */
  const [payments, setPayments] = useState<SalePayment[]>(() => editing?.payments ?? []);
  const [orderDiscFlat, setOrderDiscFlat] = useState(editing?.orderDiscountFlat ?? 0);
  const [orderDiscPct, setOrderDiscPct] = useState(editing?.orderDiscountPct ?? 0);
  const [taxPct, setTaxPct] = useState(editing?.taxPct ?? 0);
  const [shipping, setShipping] = useState(editing?.shipping ?? 0);
  const [other, setOther] = useState(editing?.other ?? 0);
  const [lines, setLines] = useState<SaleLine[]>(editing?.lines ?? []);
  const [searchQ, setSearchQ] = useState('');
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  // Guarded: the list can be empty (backend still loading) — never crash.
  const customer = customers.find((c) => c.id === customerId);

  // Once backend customers load, default the picker to the walk-in customer if
  // nothing is selected yet (and not editing an existing sale).
  useEffect(() => {
    if (editing) return;
    if (customerId) return;
    const walkIn = customers.find((c) => c.name === 'Walk-in Customer' || c.id === 'cu1');
    if (walkIn) setCustomerId(walkIn.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  // Same for branches: the list arrives asynchronously from the backend, so
  // adopt the default branch once it lands (previously a hardcoded branch name
  // filled this gap).
  useEffect(() => {
    if (editing || branch) return;
    const next = branches.find((b) => b.isDefault)?.name ?? branches[0]?.name;
    if (next) setBranch(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches]);

  const matches = useMemo(() => {
    if (!searchQ.trim()) return [] as typeof products;
    const t = searchQ.toLowerCase();
    return products.filter((p) =>
      `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(t),
    ).slice(0, 6);
  }, [searchQ, products]);

  /**
   * Put a product on the sale.
   *
   * Takes the PRODUCT rather than an id so a product created seconds ago in the
   * "Add new product" drawer can be added right away — the catalogue query has
   * not refetched at that point, so an id lookup would come back empty.
   */
  const addLineFromProduct = (p: Product) => {
    const exists = lines.findIndex((l) => l.productId === p.id);
    if (exists >= 0) {
      setLines((ls) => ls.map((l, i) => (i === exists ? { ...l, qty: l.qty + 1 } : l)));
    } else {
      setLines((ls) => [
        ...ls,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          qty: 1,
          unit: p.unit,
          unitPrice: p.price,
          discountPct: 0,
          discountFlat: 0,
          taxPct: 0,
        },
      ]);
    }
    setSearchQ('');
  };

  const addLine = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (p) addLineFromProduct(p);
  };

  const updateLine = (idx: number, patch: Partial<SaleLine>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const removeLine = (idx: number) => setLines((ls) => ls.filter((_, i) => i !== idx));

  /**
   * TOTALS — from the shared money core, not recomputed here.
   *
   * This used to pool every line's discount into one number and clamp the POOL:
   *
   *   const totalLineDiscount = lines.reduce((s, l) => s + gross*pct + flat, 0);
   *   const afterLine = Math.max(0, subtotal - totalLineDiscount);
   *
   * The backend clamps EACH LINE (`computeSaleLine`), so an over-discounted line
   * could eat into the others. Two lines — ৳100 discounted 150%, and ৳1,000 —
   * showed a ৳950 total here while the backend stored ৳1,000. Since the form
   * sends raw lines and the backend recomputes, the operator collected 950 and
   * the invoice kept a ৳50 due nobody knew about. There is no cart-vs-backend
   * warning on this screen the way there is in POS, so nothing caught it.
   *
   * It was also unrounded throughout, which is its own source of phantom paisa.
   */
  const totals = saleTotals({
    lines,
    orderDiscountPct: orderDiscPct,
    orderDiscountFlat: orderDiscFlat,
    taxPct,
    shipping,
    other,
  });
  // `subtotal` on screen is the GROSS, matching the "Line discounts" row beneath
  // it; `totals.subtotal` is the net figure the invoice stores.
  const subtotal = totals.gross;
  const totalLineDiscount = totals.totalLineDiscount;
  const orderDiscount = totals.orderDiscount;
  const taxableBase = totals.taxableBase;
  const tax = totals.tax;
  const total = totals.total;

  /**
   * Payments worth sending. A zero-amount row is a half-finished edit, not a
   * payment, and writing it would put a ৳0.00 line on the invoice's history.
   */
  const cleanPayments = useMemo(
    () => payments.filter((p) => p.amount > 0),
    [payments],
  );
  const paidTotal = useMemo(
    () => cleanPayments.reduce((s, p) => s + p.amount, 0),
    [cleanPayments],
  );
  /** Positive when the payments exceed the corrected total — warned about, not blocked. */
  const overpaid = paidTotal - total;

  const addPayment = () =>
    setPayments((ps) => [
      ...ps,
      {
        id: 'pay_' + Date.now(),
        method: 'Cash',
        // Defaults to what is still owing, which is what the owner is almost
        // always entering. Never negative.
        amount: Math.max(0, Number((total - paidTotal).toFixed(2))),
        paidAt: fromLocalInput(date),
      },
    ]);
  const patchPayment = (idx: number, patch: Partial<SalePayment>) =>
    setPayments((ps) => ps.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  const removePayment = (idx: number) =>
    setPayments((ps) => ps.filter((_, i) => i !== idx));

  const goToList = (s: SaleStatus) => {
    if (s === 'final') nav('/sales');
    else if (s === 'draft') nav('/sales/drafts');
    else nav('/sales/quotations');
  };

  const save = async (newStatus: SaleStatus = status) => {
    if (lines.length === 0) {
      toast.warning('Add at least one item');
      return;
    }

    /**
     * বাকি NEEDS A NAME — the same rule the POS payment screen enforces.
     *
     * `customerDue()` in the backend sums by `customer_id`, and a walk-in sale is
     * stored with NO customer. So a finalized sale left partly unpaid against a
     * walk-in put money owing on the invoice that belongs to nobody: it shows as
     * unpaid in the Sales list but appears in no khata, on no Customer Dues
     * screen, and in no receivables figure. The shop's own money quietly leaves
     * the books. Drafts and quotations are exempt — nothing is owed yet.
     */
    const owingOnSave = round2(total - (editing ? paidTotal : 0));
    const isNamedCustomer = !!customer && customerId.startsWith('cu_');
    if (newStatus === 'final' && owingOnSave > 0.004 && !isNamedCustomer) {
      toast.error('Choose a customer before leaving money owing', {
        description:
          'Money on khata has to be against a name, or it is in nobody’s account and you will never be able to collect it. Pick the customer, or record the full payment.',
      });
      return;
    }

    const rec: SaleRecord = {
      id: editing?.id ?? 'sl_' + Date.now(),
      invoiceNo: editing?.invoiceNo ?? nextInvoiceNo(newStatus),
      status: newStatus,
      // The box holds LOCAL wall-clock time; the database stores a UTC instant,
      // exactly as the POS does. Converting here is what keeps a form sale in the
      // same reporting day and cash shift as a counter sale.
      date: fromLocalInput(date),
      customerId,
      customerName: customer?.name ?? 'Walk-in Customer',
      branch,
      user: 'Seam',
      lines,
      subtotal,
      totalLineDiscount,
      orderDiscountPct: orderDiscPct,
      orderDiscountFlat: orderDiscFlat,
      orderDiscount,
      taxPct,
      tax,
      shipping,
      other,
      total,
      // On an edit the payments already recorded against the invoice are kept
      // (the backend re-applies them); paid/due are recomputed there and come
      // back on the next hydrate, so these are only the create-path defaults.
      // On an edit these come from the payment editor below; on a create there
      // are none yet (a form sale is taken to the counter or left on credit).
      // The backend recomputes paid/due from the payments it is sent, and the
      // real values arrive on the next hydrate — these are the local shape only.
      paid: editing ? paidTotal : 0,
      due: editing ? Math.max(0, total - paidTotal) : total,
      payments: editing ? cleanPayments : [],
      audit: editing?.audit ?? [
        { id: 'a_' + Date.now(), at: new Date().toISOString(), by: 'Seam', action: 'created' },
      ],
      notes: notes || undefined,
      validUntil: newStatus === 'quotation' ? validUntil : undefined,
    };

    // ---------------- EDITING AN EXISTING SALE ----------------
    // There IS a `sales.update` channel now (backend/services/sales.ts): it
    // reverses the original stock and cash and re-applies the corrected figures
    // in one transaction, keeping the invoice number the customer is holding. So
    // the old delete-and-recreate dance is gone, along with the flat refusal to
    // touch a finalized sale.
    if (editing) {
      if (!canEditSale) {
        toast.error('Only an admin can edit a sale', {
          description:
            'Ask the owner to sign in. This is deliberate: an edit rewrites money that has already been taken.',
        });
        return;
      }
      // A correction to a finalized invoice must say WHY — it is recorded in the
      // sale's audit trail, which is the only thing that distinguishes fixing a
      // mistake from quietly changing the books.
      const reason = await promptText({
        title: `Why is ${editing.invoiceNo} being corrected?`,
        message:
          editing.status === 'final'
            ? 'This reverses the original stock and cash and re-applies the corrected amounts. The invoice number stays the same.'
            : 'Recorded against the invoice so the change is traceable.',
        label: 'Reason',
        placeholder: 'e.g. wrong quantity keyed at the counter',
        confirmLabel: 'Save correction',
        required: true,
      });
      if (reason === null) return;

      setSaving(true);
      const ok = await updateSaleBackend(editing.id, rec, reason);
      setSaving(false);
      if (!ok) return;
      toast.success(`${editing.invoiceNo} corrected`);
      goToList(newStatus);
      return;
    }

    addSale(rec);
    goToList(newStatus);
  };

  return (
    <div>
      <PageHeader
        title={editing ? 'Edit Sale' : status === 'quotation' ? 'New Quotation' : status === 'draft' ? 'New Draft' : 'New Sale'}
        subtitle="Form-based entry · use POS for fast counter sales"
        actions={
          <>
            <Button variant="ghost" onClick={() => nav(-1)}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            {/* A finalized invoice is corrected, not re-filed as a draft or a
                quotation — those two buttons would change what the document IS.
                They stay for a new sale and for an unfinalized one. */}
            {editing?.status !== 'final' && (
              <>
                <Button variant="outline" disabled={saving} onClick={() => void save('draft')}>
                  <PenSquare className="size-4" /> Save as Draft
                </Button>
                <Button variant="outline" disabled={saving} onClick={() => void save('quotation')}>
                  <FileText className="size-4" /> Save as Quotation
                </Button>
              </>
            )}
            {editing ? (
              <Button
                disabled={saving || !canEditSale}
                title={canEditSale ? undefined : 'Only an admin can edit a sale'}
                onClick={() => void save(status)}
              >
                <CheckCircle2 className="size-4" /> Save Correction
              </Button>
            ) : (
              <Button disabled={saving} onClick={() => void save('final')}>
                <CheckCircle2 className="size-4" /> Save Sale
              </Button>
            )}
          </>
        }
      />

      {editing && !canEditSale && (
        <div className="mx-6 mt-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          Only an admin can edit a sale. Ask the owner to sign in.
        </div>
      )}

      {/*
        LAYOUT — ONE COLUMN, ITEMS FULL WIDTH.
        This was a 2/3 + 1/3 split with a sticky "Order charges" card on the right,
        so the item table only ever had about 60% of the window and the cashier had
        to scroll it sideways to reach price and subtotal. The table is the working
        area; the charges and totals are read at the end, so they moved to the
        bottom.
      */}
      <div className="p-6 space-y-4">
        {/* Meta + items */}
        <div className="space-y-4">
          <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Customer" required>
              <div className="flex items-center gap-1.5">
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="h-9 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {/* Add a walk-in who is not on file yet, without losing the sale
                    that is half typed. Saves through customers.create and selects
                    the new record. */}
                <button
                  type="button"
                  onClick={() => setNewCustomerOpen(true)}
                  title="Add new customer"
                  aria-label="Add new customer"
                  className="size-9 shrink-0 grid place-items-center rounded-md border border-border text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-primary transition"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </Field>
            <Field label="Date" required>
              <DateTimeField value={date} onChange={setDate} />
            </Field>
            <Field label="Business Location" required>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              >
                {(branches.length > 0 ? branches.map((b) => b.name) : branch ? [branch] : []).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SaleStatus)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="final">Final</option>
                <option value="draft">Draft</option>
                <option value="quotation">Quotation</option>
              </select>
            </Field>
            {status === 'quotation' && (
              <Field label="Valid until">
                <DateField value={validUntil} onChange={setValidUntil} />
              </Field>
            )}
          </Card>

          <Card className="p-4">
            {/*
              NO "Add new product" HERE — deliberately.
              You cannot sell something you have not bought: a product created on
              a sale would have zero stock and the sale would either be refused or
              drive the stock negative. Stock enters through a purchase (or an
              opening-stock / adjustment entry), so the button belongs on the
              PURCHASE form, where it is. The drawer component is still wired up
              and one line away if this is ever wanted for a service item.
            */}
            <div className="text-sm font-semibold mb-2">Add items</div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search product name, SKU, barcode…"
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
                      {/* What it cost us, what it usually costs us, and what we
                          sell it for — so the price can be judged before the line
                          is even added. Colour carries the meaning: amber = paid
                          out, blue = average paid, green = coming in. */}
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

            <div className="mt-3 rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase text-muted-foreground bg-secondary/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-8">#</th>
                    <th className="text-left px-2 py-2 font-medium">Item</th>
                    {/* Read-only reference columns: what this item cost us, and
                        the average we normally pay. The shopkeeper bargains at the
                        counter and needs both before agreeing a price. */}
                    <th className="text-right px-2 py-2 font-medium w-[92px]">Buy price</th>
                    <th className="text-right px-2 py-2 font-medium w-[92px]">Avg buy</th>
                    <th className="text-right px-2 py-2 font-medium">Qty</th>
                    <th className="text-right px-2 py-2 font-medium">Sell price</th>
                    <th className="text-right px-2 py-2 font-medium">Disc %</th>
                    <th className="text-right px-2 py-2 font-medium">Subtotal</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    // The shared helper, not inline arithmetic. The version here
                    // omitted the `max(0, …)` clamp, so a discount larger than
                    // the line printed a NEGATIVE subtotal in this cell while the
                    // stored line was 0 — the same bug that was fixed in the
                    // printed receipt.
                    const sub = saleLineSubtotal(l);
                    // Looked up live from the catalogue rather than copied onto the
                    // line: a stored cost would go stale the moment a new buying
                    // price is recorded. Unknown product renders '—', never 0,
                    // which would read as "this cost us nothing".
                    const cat = products.find((p) => p.id === l.productId);
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-2">
                          <div className="font-medium">{l.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{l.sku}</div>
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular text-xs text-warning">
                          {cat ? formatBDT(cat.cost, { withSymbol: false }) : '—'}
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular text-xs text-primary">
                          {cat ? formatBDT(cat.avgCost ?? cat.cost, { withSymbol: false }) : '—'}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <NumberField
                            value={l.qty}
                            onChangeNumber={(v) => updateLine(i, { qty: v })}
                            className="h-7 w-20 px-2 text-right text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <NumberField
                            value={l.unitPrice}
                            onChangeNumber={(v) => updateLine(i, { unitPrice: v })}
                            className="h-7 w-24 px-2 text-right text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <NumberField
                            value={l.discountPct}
                            onChangeNumber={(v) => updateLine(i, { discountPct: v })}
                            className="h-7 w-16 px-2 text-right text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular font-semibold">
                          {formatBDT(sub, { withSymbol: false })}
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
                    );
                  })}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        Search above to add items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Internal notes about this sale…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
              />
            </Field>
          </Card>
        </div>

        {/* BOTTOM — order charges & totals (moved out of the right rail) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Order charges</div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              <Field label="Disc %">
                <NumberField value={orderDiscPct} onChangeNumber={setOrderDiscPct} />
              </Field>
              <Field label="Disc ৳">
                <NumberField value={orderDiscFlat} onChangeNumber={setOrderDiscFlat} />
              </Field>
              <Field label="VAT %">
                <NumberField value={taxPct} onChangeNumber={setTaxPct} />
              </Field>
              <Field label="Shipping ৳">
                <NumberField value={shipping} onChangeNumber={setShipping} />
              </Field>
              <Field label="Other ৳">
                <NumberField value={other} onChangeNumber={setOther} />
              </Field>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Totals</div>
            <div className="space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatBDT(subtotal)} />
              {totalLineDiscount > 0 && (
                <Row label="Line discounts" value={`− ${formatBDT(totalLineDiscount)}`} tone="success" />
              )}
              {orderDiscount > 0 && (
                <Row label="Order discount" value={`− ${formatBDT(orderDiscount)}`} tone="success" />
              )}
              {tax > 0 && <Row label={`VAT (${taxPct}%)`} value={formatBDT(tax)} />}
              {shipping > 0 && <Row label="Shipping" value={formatBDT(shipping)} />}
              {other > 0 && <Row label="Other" value={formatBDT(other)} />}
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold font-mono tabular text-primary">{formatBDT(total)}</span>
              </div>
            </div>

            {customer && customer.due > 0 && (
              <div className="rounded-md bg-warning/10 text-warning px-3 py-2 text-xs">
                Customer has existing due of {formatBDT(customer.due)}.
              </div>
            )}
          </Card>
        </div>

        {/*
          PAYMENTS — ONLY WHEN CORRECTING A FINALIZED INVOICE.

          A new form sale records no payment here on purpose: it is either taken to
          the counter (POS takes the money) or left on credit. Drafts and
          quotations have no payments at all — nothing has been sold yet.

          On a correction this is the difference between fixing a mistyped amount
          tendered in place and having to void the invoice the customer is holding.
        */}
        {editing?.status === 'final' && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Payments received</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Correct an amount that was keyed wrongly, or record a payment that was
                  missed. Cash changes are posted to the shift that is open now.
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={addPayment}>
                <Plus className="size-3.5" /> Add payment
              </Button>
            </div>

            {payments.length === 0 ? (
              <div className="rounded-md border border-dashed border-border py-5 text-center text-xs text-muted-foreground">
                No payment recorded — the whole invoice is on credit.
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map((p, idx) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-1 sm:grid-cols-[8rem_9rem_1fr_11rem_auto] gap-2 items-end rounded-md border border-border p-2"
                  >
                    <Field label="Method">
                      <select
                        value={p.method}
                        onChange={(e) =>
                          patchPayment(idx, { method: e.target.value as SalePayment['method'] })
                        }
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Amount ৳">
                      <NumberField
                        value={p.amount}
                        onChangeNumber={(v) => patchPayment(idx, { amount: v })}
                      />
                    </Field>
                    <Field label="Reference">
                      <Input
                        value={p.reference ?? ''}
                        onChange={(e) => patchPayment(idx, { reference: e.target.value })}
                        placeholder="TxID / cheque no (optional)"
                      />
                    </Field>
                    <Field label="Paid on">
                      <DateTimeField
                        value={toLocalInput(p.paidAt)}
                        onChange={(v) => patchPayment(idx, { paidAt: fromLocalInput(v) })}
                      />
                    </Field>
                    <button
                      onClick={() => removePayment(idx)}
                      title="Remove this payment"
                      className="h-9 w-9 grid place-items-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Paid / still owing, from the rows above against the corrected total.
                Stated before saving, because this is the number the customer will
                argue about. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <Row label="Invoice total" value={formatBDT(total)} />
              <Row label="Paid" value={formatBDT(paidTotal)} />
              <Row
                label="Still owing"
                value={formatBDT(Math.max(0, total - paidTotal))}
                tone={total - paidTotal > 0.004 ? 'warning' : 'success'}
              />
            </div>

            {overpaid > 0.004 && (
              <div className="rounded-md bg-warning/10 text-warning px-3 py-2 text-xs">
                These payments are {formatBDT(overpaid)} more than the invoice total. The due
                will be recorded as zero — the extra is change given, not credit.
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Add a customer without abandoning this sale. Saves to the real backend
          and is selected here immediately.
          (The product drawer is intentionally NOT mounted here — see the note
          above the item search.) */}
      <CustomerPicker
        open={newCustomerOpen}
        onClose={() => setNewCustomerOpen(false)}
        selectedId={customerId}
        onSelect={setCustomerId}
        startInAdd
      />
    </div>
  );
}

/**
 * Buy / average buy / sell, side by side, for a product in a search result.
 *
 * Colour is the label for someone who will not read three words every time:
 * amber = money that went out, blue = the average we have paid, green = money
 * coming in. `avgCost` is the simple mean of recorded buying prices, NOT the
 * quantity-weighted cost that drives COGS — two different figures that must not
 * be conflated (see backend/services/costing.ts).
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
      <Cell label="Buy" value={cost} tone="text-warning" />
      <Cell label="Avg" value={avgCost} tone="text-primary" />
      <Cell label="Sell" value={price} tone="text-success" />
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase text-muted-foreground leading-none">{label}</div>
      <div className={cn('mt-0.5 text-xs font-mono tabular font-semibold', tone)}>
        {formatBDT(value, { withSymbol: false })}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase font-semibold text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
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
  tone?: 'success' | 'warning';
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-mono tabular',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </span>
    </div>
  );
}

// silence unused
void CalIcon;
void Badge;
