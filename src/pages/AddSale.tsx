import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Save,
  Search,
  Trash2,
  PenSquare,
  FileText,
  CheckCircle2,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { IconButton } from '@/components/ui/IconButton';
import { labelFor } from '@/lib/labels';
import { useDateFormat } from '@/lib/formatDate';
import { cn, formatBDT } from '@/lib/utils';
import { currentUserName } from '@/lib/actor';
import { useProducts } from '@/hooks/useProducts';
import { useDefaultBranchId } from '@/lib/branch';
import { useCustomersQuery } from '@/hooks/useCustomers';
import { useBranches } from '@/stores/branches';
import {
  useSales,
  type SaleLine,
  type SalePayment,
  type SaleRecord,
  type SaleStatus,
  nextInvoiceNo,
  realCustomerId,
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
import { api } from '@/lib/api';
import { toSaleRecord, type BackendSale } from '@/hooks/saleAdapter';
import type { Product } from '@/types/domain';

/**
 * `/sales/new` and `/sales/:id/edit`.
 *
 * THE RECORD IS LOADED BEFORE THE FORM EXISTS. The form seeds every field once,
 * from `useState` initialisers, and it used to find the sale being edited in the
 * sales store — which holds ONE PAGE. A deep link, a refresh, or an invoice from
 * page four therefore rendered an EMPTY "New Sale" form, and saving it created a
 * SECOND sale with its own number, stock movement and cash. Now an edit URL
 * shows "Loading…" until the sale is in hand (from the store, or `sales.get`),
 * and the form is mounted with it; an edit URL can never reach the create path.
 */
export default function AddSale() {
  const { id } = useParams<{ id?: string }>();
  const storeSale = useSales((s) => (id ? s.sales.find((x) => x.id === id) : undefined));
  const [fetched, setFetched] = useState<SaleRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const hasStoreSale = !!storeSale;

  useEffect(() => {
    if (!id || hasStoreSale) return;
    let alive = true;
    setMissing(false);
    void api<BackendSale | null>('sales.get', { id })
      .then((row) => {
        if (!alive) return;
        if (row) setFetched(toSaleRecord(row));
        else setMissing(true);
      })
      .catch(() => {
        if (alive) setMissing(true);
      });
    return () => {
      alive = false;
    };
  }, [id, hasStoreSale]);

  if (!id) return <AddSaleForm key="new" />;

  const editing = storeSale ?? (fetched?.id === id ? fetched : undefined);
  if (!editing) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        {missing ? 'That sale could not be found.' : 'Loading sale…'}
      </div>
    );
  }
  if (editing.status === 'void') {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        A voided sale cannot be edited — its stock and cash have already been reversed.
      </div>
    );
  }
  return <AddSaleForm key={id} editing={editing} />;
}

function AddSaleForm({ editing }: { editing?: SaleRecord }) {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  // Only the three statuses a new document can have; anything else in the URL
  // (a stale link, `?status=void`) falls back to a normal sale.
  const requested = searchParams.get('status');
  const initialStatus: SaleStatus =
    requested === 'draft' || requested === 'quotation' ? requested : 'final';
  const addSale = useSales((s) => s.addSale);
  const updateSaleBackend = useSales((s) => s.updateSale);
  // Editing an existing invoice is Admin-only (see electron/permissions.ts).
  // The IPC gate is authoritative; this just keeps the button honest.
  const canEditSale = useCan('sales.edit');
  const [saving, setSaving] = useState(false);
  // Blocks a second click that lands before the disabled button re-renders.
  const savingRef = useRef(false);

  // Create-form wiring (backend only): the product/customer pickers read live
  // backend data and the Business Location select feeds a real branch.
  // addSale() persists via api('sales.create'), which generates the server id,
  // customerId, and branch id; this page then navigates to the relevant list
  // which rehydrates from the backend. The mock master-data fallback was
  // removed — empty queries render empty pickers.
  const productsQuery = useProducts(useDefaultBranchId());
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

  /**
   * CONVERTING a draft or quotation into a sale (`?convert=true`). The page used
   * to ignore the flag, so "Convert to Sale" just opened the Admin-only
   * correction form and the document stayed a quotation. Converting is selling:
   * it goes through `sales.convert`, which gives the sale a real invoice number
   * (a draft is finalised in place; a quotation is kept and a new sale is made).
   */
  const converting =
    searchParams.get('convert') === 'true' &&
    !!editing &&
    (editing.status === 'draft' || editing.status === 'quotation');
  const convertSaleBackend = useSales((s) => s.convertSale);

  // Fixed for the life of the form: the Status select is gone (UI audit step 3),
  // the save buttons decide what a new document becomes.
  const status: SaleStatus = converting ? 'final' : editing?.status ?? initialStatus;
  const fmt = useDateFormat();
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
  // A converted document is sold NOW, not on the day the quote was written.
  const [date, setDate] = useState(toLocalInput(converting ? undefined : editing?.date));
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
  /** Highlighted search result (↑/↓, Enter adds it). */
  const [hi, setHi] = useState(0);
  /** Searchable customer picker: 'search' to choose, 'add' to create one. */
  const [pickerMode, setPickerMode] = useState<'search' | 'add' | null>(null);
  // Progressive disclosure: the date is "now" on a new sale, notes and the
  // rare charges are usually empty — each opens on demand (or when it has a value).
  const [dateOpen, setDateOpen] = useState(!!editing && !converting);
  const [notesOpen, setNotesOpen] = useState(!!editing?.notes);
  const [moreCharges, setMoreCharges] = useState(
    !!(editing?.taxPct || editing?.shipping || editing?.other),
  );
  // Guarded: the list can be empty (backend still loading) — never crash.
  const customer = customers.find((c) => c.id === customerId);
  // Any real customer counts (see the save() check below).
  const isNamedCustomer = !!customer && !!realCustomerId(customerId);

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
    const raw = searchQ.trim();
    if (!raw) return [] as typeof products;
    const t = raw.toLowerCase();
    // An exact barcode / SKU (what a scanner types) goes first, so Enter adds it.
    const exact = products.filter(
      (p) => p.barcode?.toLowerCase() === t || p.sku?.toLowerCase() === t,
    );
    const rest = products.filter(
      (p) => !exact.includes(p) && `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(t),
    );
    return [...exact, ...rest].slice(0, 6);
  }, [searchQ, products]);
  useEffect(() => setHi(0), [searchQ]);

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
        amount: round2(Math.max(0, total - paidTotal)),
        paidAt: fromLocalInput(date),
      },
    ]);

  /** One tap for the commonest case: the customer paid the whole bill in cash. */
  const payInFull = () =>
    setPayments([
      {
        id: 'pay_' + Date.now(),
        method: 'Cash',
        amount: round2(total),
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
    /**
     * NEGATIVE STOCK IS REFUSED. The backend enforces it in `recordMovement`, so
     * saving would fail anyway — but failing at the end, after the whole form is
     * filled in, is a poor way to find out. Checked here so the message names the
     * product and the shortfall while there is still something to change.
     *
     * Only for a FINAL sale: drafts and quotations move no stock, so they are the
     * right way to write down an order for goods that have not arrived yet.
     */
    if (newStatus === 'final') {
      const shortfalls = lines
        .map((l) => {
          const p = products.find((x) => x.id === l.productId);
          return { name: l.name, qty: l.qty, have: p?.stock, unit: p?.unit ?? '' };
        })
        // `have === undefined` means the catalogue has not loaded that product;
        // leave it to the backend rather than blocking on missing information.
        .filter((x) => x.have !== undefined && x.qty > (x.have as number) + 0.0001);
      if (shortfalls.length > 0) {
        // Static title (translates); names and figures in the description.
        toast.error('Not enough stock', {
          description: shortfalls
            .map((x) => `${x.name}: ${x.have} / ${x.qty} ${x.unit}`)
            .join(' · '),
        });
        return;
      }
    }

    const owingOnSave = round2(total - paidTotal);
    // Any real customer counts — not only ids created in the app (`cu_…`); the
    // sample year's customers and imported ones were refused credit here.
    const isNamedCustomer = !!customer && !!realCustomerId(customerId);
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
      user: currentUserName(),
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
      // From the payment editor, on a CREATE as well as an edit — a new sale used
      // to always be sent with zero payments, so money taken at the desk could
      // only be recorded by saving the invoice and then editing it. The backend
      // recomputes paid/due from the payments it is sent and the real values come
      // back on the next hydrate, so these are the local shape only.
      paid: paidTotal,
      // Credit notes come from sell returns, not from this form. The backend
      // carries the existing value through a correction; this is the local shape.
      credited: editing?.credited ?? 0,
      due: round2(Math.max(0, total - paidTotal - (editing?.credited ?? 0))),
      payments: cleanPayments,
      audit: editing?.audit ?? [
        { id: 'a_' + Date.now(), at: new Date().toISOString(), by: currentUserName(), action: 'created' },
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
    if (converting && editing) {
      setSaving(true);
      const invoiceNo = await convertSaleBackend(editing.id, { ...rec, status: 'final' });
      setSaving(false);
      if (!invoiceNo) return;
      toast.success('Converted to a sale', { description: `${editing.invoiceNo} → ${invoiceNo}` });
      goToList('final');
      return;
    }

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
      toast.success('Sale corrected', { description: editing.invoiceNo });
      goToList(newStatus);
      return;
    }

    // Wait for the backend: a refused sale keeps the form open with everything
    // typed, instead of leaving for the list as if it had been saved.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const created = await addSale(rec);
    savingRef.current = false;
    setSaving(false);
    if (!created) return;
    toast.success(
      newStatus === 'quotation'
        ? 'Quotation saved'
        : newStatus === 'draft'
          ? 'Draft saved'
          : 'Sale saved',
      { description: created.invoiceNo },
    );
    goToList(newStatus);
  };

  const owing = round2(Math.max(0, total - paidTotal));
  // Walk-in + money owing: said in the payment card and Save is off (was a toast at save).
  const walkInOwing = status === 'final' && owing > 0.004 && !isNamedCustomer;
  // A non-admin sees the correction read-only instead of typing and then being refused.
  const readOnly = !!editing && !canEditSale && !converting;
  const saveDisabled = saving || readOnly || walkInOwing;

  /** Scanner / keyboard: Enter adds the highlighted match, ↑/↓ move, Esc clears. */
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && matches.length > 0) {
      e.preventDefault();
      setHi((h) => (h + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && matches.length > 0) {
      e.preventDefault();
      setHi((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const p = matches[hi] ?? matches[0];
      if (p) addLineFromProduct(p);
      else if (searchQ.trim()) toast.warning('No product found');
    } else if (e.key === 'Escape' && searchQ) {
      e.stopPropagation();
      setSearchQ('');
    }
  };

  return (
    <div>
      <PageHeader
        title={
          converting
            ? 'Convert to a sale'
            : editing
              ? 'Correct sale'
              : status === 'quotation'
                ? 'New Quotation'
                : status === 'draft'
                  ? 'New Draft'
                  : 'New Sale'
        }
        // Codes and names are data; the title stays a translatable phrase.
        subtitle={editing ? `${editing.invoiceNo} · ${editing.customerName}` : undefined}
        actions={
          <>
            <Button variant="ghost" onClick={() => nav(-1)}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            {/* "Save as" for the other kinds of a NEW document. A finalized invoice
                is corrected, never re-filed as a draft or quotation. The main
                Save is in the bar at the bottom, next to the total. */}
            {!editing && !converting && (
              <>
                {status !== 'draft' && (
                  <Button variant="outline" disabled={saving} onClick={() => void save('draft')}>
                    <PenSquare className="size-4" /> Save as Draft
                  </Button>
                )}
                {status !== 'quotation' && (
                  <Button variant="outline" disabled={saving} onClick={() => void save('quotation')}>
                    <FileText className="size-4" /> Save as Quotation
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      {readOnly && (
        <div className="mx-6 mt-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          Only an admin can edit a sale. Ask the owner to sign in.
        </div>
      )}
      {converting && (
        <div className="mx-6 mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          {editing?.status === 'quotation'
            ? 'Saving makes a new sale from this quotation. The quotation is kept as it was.'
            : 'Saving turns this draft into a sale with its own invoice number.'}
        </div>
      )}

      {/* ONE COLUMN, ITEMS FULL WIDTH; totals + Save in the sticky bar below.
          `fieldset disabled` makes the whole form read-only for a non-admin. */}
      <fieldset disabled={readOnly} className="p-6 space-y-4 min-w-0">
        <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField
            label="Customer"
            required
            htmlFor="sale-customer"
            action={
              <button
                type="button"
                onClick={() => setPickerMode('add')}
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <Plus className="size-3.5" /> New customer
              </button>
            }
          >
            {/* Searchable picker instead of a long unsearchable dropdown. */}
            <button
              id="sale-customer"
              type="button"
              onClick={() => setPickerMode('search')}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm flex items-center gap-2 text-left outline-none focus:ring-2 focus:ring-ring/50 hover:border-primary/50 disabled:opacity-60"
            >
              <span className="flex-1 min-w-0 truncate font-medium">
                {customer ? customer.name : <span className="text-muted-foreground">Choose customer</span>}
              </span>
              {customer && customer.due > 0.004 && (
                <span className="shrink-0 text-warning">
                  <span>Owes</span>{' '}
                  <span className="tabular font-semibold">{formatBDT(customer.due)}</span>
                </span>
              )}
              <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            </button>
          </FormField>
          <FormField
            label="Date"
            required
            action={
              !dateOpen && (
                <button
                  type="button"
                  onClick={() => setDateOpen(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Change
                </button>
              )
            }
          >
            {(f) =>
              dateOpen ? (
                <DateTimeField {...f} value={date} onChange={setDate} showNowButton={false} />
              ) : (
                // A new sale happens now; the field opens only to back-date it.
                <div className="h-10 flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Now</span>
                  <span className="tabular">{fmt.dateTime(fromLocalInput(date))}</span>
                </div>
              )
            }
          </FormField>
          {status === 'quotation' ? (
            <FormField label="Valid until">
              {(f) => <DateField {...f} value={validUntil} onChange={setValidUntil} />}
            </FormField>
          ) : (
            <FormField label="Business Location" required>
              {(f) => (
                <Select {...f} value={branch} onChange={(e) => setBranch(e.target.value)}>
                  {(branches.length > 0 ? branches.map((b) => b.name) : branch ? [branch] : []).map(
                    (name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ),
                  )}
                </Select>
              )}
            </FormField>
          )}
        </Card>

        <Card className="p-4">
          {/* NO "Add new product" here on purpose: you cannot sell what you have
              not bought (zero stock). Stock enters through a purchase. */}
          <label htmlFor="sale-item-search" className="block text-sm font-semibold mb-2">
            Add items
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="sale-item-search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={onSearchKey}
              autoFocus={!editing}
              autoComplete="off"
              placeholder="Scan a barcode or type a product name…"
              className="pl-9"
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-controls="sale-item-results"
            />
            {matches.length > 0 && (
              <div
                id="sale-item-results"
                role="listbox"
                className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-xl overflow-hidden z-20"
              >
                {matches.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={i === hi}
                    onClick={() => addLineFromProduct(p)}
                    onMouseEnter={() => setHi(i)}
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
                        <span className="tabular">
                          {p.stock} {p.unit}
                        </span>
                      </div>
                    </div>
                    {/* Buy / average buy / sell, so the price can be judged first. */}
                    <PriceTriplet cost={p.cost} avgCost={p.avgCost ?? p.cost} price={p.price} />
                    <Plus className="size-4 text-primary shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-secondary/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Item</th>
                  {/* Buying prices stay visible (owner decision 1): the shopkeeper
                      bargains at the counter and needs both. */}
                  <th className="text-right px-2 py-2 font-medium">Buy price</th>
                  <th className="text-right px-2 py-2 font-medium">Avg buy</th>
                  {/* Turns red the moment Qty passes it — no words needed. */}
                  <th className="text-right px-2 py-2 font-medium">In stock</th>
                  <th className="text-right px-2 py-2 font-medium">Qty</th>
                  <th className="text-right px-2 py-2 font-medium">Sell price</th>
                  <th className="text-right px-2 py-2 font-medium">Disc %</th>
                  <th className="text-right px-2 py-2 font-medium">Subtotal</th>
                  <th className="w-12">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  // Shared helper (clamps an over-discounted line at 0).
                  const sub = saleLineSubtotal(l);
                  // Live catalogue lookup; unknown product shows '—', never 0.
                  const cat = products.find((p) => p.id === l.productId);
                  const short = cat !== undefined && l.qty > cat.stock + 0.0001;
                  return (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{l.sku}</div>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular text-warning">
                        {cat ? formatBDT(cat.cost, { withSymbol: false }) : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular text-primary">
                        {cat ? formatBDT(cat.avgCost ?? cat.cost, { withSymbol: false }) : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-2 py-2.5 text-right tabular whitespace-nowrap',
                          short ? 'text-destructive font-bold' : 'text-muted-foreground',
                        )}
                      >
                        {cat ? `${cat.stock} ${cat.unit}` : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <NumberField
                          aria-label="Quantity"
                          value={l.qty}
                          onChangeNumber={(v) => updateLine(i, { qty: v })}
                          className={cn(
                            'h-9 w-20 px-2 text-right text-sm',
                            short && 'border-destructive text-destructive',
                          )}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <NumberField
                          aria-label="Sell price"
                          value={l.unitPrice}
                          onChangeNumber={(v) => updateLine(i, { unitPrice: v })}
                          className="h-9 w-24 px-2 text-right text-sm"
                        />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <NumberField
                          aria-label="Disc %"
                          value={l.discountPct}
                          onChangeNumber={(v) => updateLine(i, { discountPct: v })}
                          className="h-9 w-20 px-2 text-right text-sm"
                        />
                      </td>
                      <td className="px-2 py-2.5 text-right tabular font-semibold">
                        {formatBDT(sub, { withSymbol: false })}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <IconButton size="sm" tone="danger" label="Remove line" onClick={() => removeLine(i)}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      Scan a barcode or search above to add items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ORDER CHARGES + BREAKDOWN. The total itself is in the sticky bar. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Order charges</div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Discount %">
                {(f) => <NumberField {...f} value={orderDiscPct} onChangeNumber={setOrderDiscPct} />}
              </FormField>
              <FormField label="Discount ৳">
                {(f) => <NumberField {...f} value={orderDiscFlat} onChangeNumber={setOrderDiscFlat} />}
              </FormField>
            </div>
            {/* VAT / shipping / other are rare in this shop. */}
            {moreCharges ? (
              <div className="grid grid-cols-3 gap-3">
                <FormField label="VAT %">
                  {(f) => <NumberField {...f} value={taxPct} onChangeNumber={setTaxPct} />}
                </FormField>
                <FormField label="Shipping ৳">
                  {(f) => <NumberField {...f} value={shipping} onChangeNumber={setShipping} />}
                </FormField>
                <FormField label="Other ৳">
                  {(f) => <NumberField {...f} value={other} onChangeNumber={setOther} />}
                </FormField>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMoreCharges(true)}
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <Plus className="size-3.5" /> VAT, shipping or other charges
              </button>
            )}
          </Card>

          <Card className="p-4 space-y-1.5">
            <div className="text-sm font-semibold mb-1">Bill</div>
            <Row label="Subtotal" value={formatBDT(subtotal)} />
            {totalLineDiscount > 0 && (
              <Row label="Line discounts" value={`− ${formatBDT(totalLineDiscount)}`} tone="success" />
            )}
            {orderDiscount > 0 && (
              <Row label="Order discount" value={`− ${formatBDT(orderDiscount)}`} tone="success" />
            )}
            {tax > 0 && (
              <Row
                label={
                  <>
                    <span>VAT</span> <span className="tabular">({taxPct}%)</span>
                  </>
                }
                value={formatBDT(tax)}
              />
            )}
            {shipping > 0 && <Row label="Shipping" value={formatBDT(shipping)} />}
            {other > 0 && <Row label="Other" value={formatBDT(other)} />}
            <div className="border-t border-border pt-1.5">
              <Row label="Total" value={formatBDT(total)} strong />
            </div>
          </Card>
        </div>

        {/* PAYMENT — whenever this document will be a real sale (new or edit).
            Drafts and quotations have none: nothing has been sold yet. */}
        {status === 'final' && (
          <Card className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">
                  {editing ? 'Payments received' : 'How much is the customer paying now?'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {editing
                    ? 'Correct an amount that was keyed wrongly, or record a payment that was missed. Cash changes are posted to the shift that is open now.'
                    : 'Leave it empty if the whole bill goes on their khata. Cash is posted to the shift that is open now.'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* The commonest case, one click: they paid the lot. */}
                {owing > 0.004 && (
                  <Button variant="outline" onClick={payInFull} className="border-primary/50 text-primary">
                    Paid in full
                  </Button>
                )}
                <Button variant="outline" onClick={addPayment}>
                  <Plus className="size-4" /> Add payment
                </Button>
              </div>
            </div>

            {walkInOwing && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 text-sm flex items-start gap-2"
              >
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                <span>Walk-in customers must pay in full. Choose a customer to put the rest on khata.</span>
              </div>
            )}

            {payments.length === 0 ? (
              !walkInOwing && (
                <div className="rounded-md border border-dashed border-border py-4 text-center text-sm text-muted-foreground">
                  Nothing paid yet. The whole bill goes on the customer’s khata.
                </div>
              )
            ) : (
              <div className="space-y-2">
                {payments.map((p, idx) => {
                  // Reference only matters for non-cash; Paid on only when back-dating.
                  const showRef = p.method !== 'Cash' || !!p.reference;
                  const showWhen = !!editing || dateOpen;
                  return (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-end gap-3 rounded-md border border-border p-2"
                    >
                      <FormField label="Method" className="w-36">
                        {(f) => (
                          <Select
                            {...f}
                            value={p.method}
                            onChange={(e) =>
                              patchPayment(idx, { method: e.target.value as SalePayment['method'] })
                            }
                          >
                            {PAYMENT_METHODS.map((m) => (
                              <option key={m} value={m}>
                                {labelFor('paymentMethod', m)}
                              </option>
                            ))}
                          </Select>
                        )}
                      </FormField>
                      <FormField label="Amount ৳" className="w-40">
                        {(f) => (
                          <NumberField
                            {...f}
                            value={p.amount}
                            onChangeNumber={(v) => patchPayment(idx, { amount: v })}
                          />
                        )}
                      </FormField>
                      {showRef && (
                        <FormField label="Reference" className="flex-1 min-w-[180px]">
                          {(f) => (
                            <Input
                              {...f}
                              value={p.reference ?? ''}
                              onChange={(e) => patchPayment(idx, { reference: e.target.value })}
                              placeholder="TxID / cheque no (optional)"
                            />
                          )}
                        </FormField>
                      )}
                      {showWhen && (
                        <FormField label="Paid on" className="w-56">
                          {(f) => (
                            <DateTimeField
                              {...f}
                              value={toLocalInput(p.paidAt)}
                              onChange={(v) => patchPayment(idx, { paidAt: fromLocalInput(v) })}
                            />
                          )}
                        </FormField>
                      )}
                      <IconButton
                        variant="outline"
                        tone="danger"
                        label="Remove this payment"
                        onClick={() => removePayment(idx)}
                        className="ml-auto"
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  );
                })}
              </div>
            )}

            {overpaid > 0.004 && (
              <div className="rounded-md bg-warning/10 text-warning px-3 py-2 text-sm">
                <span>Paid more than the total by</span>{' '}
                <span className="tabular font-semibold">{formatBDT(overpaid)}</span>.{' '}
                <span>The due is recorded as zero. The extra is change given, not credit.</span>
              </div>
            )}
          </Card>
        )}

        {/* Notes last and collapsed — they are usually empty. */}
        {notesOpen ? (
          <Card className="p-4">
            <FormField label="Notes">
              {(f) => (
                <textarea
                  {...f}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  autoFocus={!editing?.notes}
                  placeholder="Internal notes about this sale…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                />
              )}
            </FormField>
          </Card>
        ) : (
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <Plus className="size-3.5" /> Add note
          </button>
        )}
      </fieldset>

      {/* STICKY TOTAL + SAVE: the amount is always in view when Save is pressed. */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-card px-6 py-3 flex items-center gap-6">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-xl font-bold tabular text-primary">{formatBDT(total)}</span>
        </div>
        {status === 'final' && (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">Paid</span>
              <span className="text-lg font-semibold tabular">{formatBDT(paidTotal)}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">Still owing</span>
              <span
                className={cn(
                  'text-lg font-semibold tabular',
                  owing > 0.004 ? 'text-warning' : 'text-success',
                )}
              >
                {formatBDT(owing)}
              </span>
            </div>
          </>
        )}
        <div className="ml-auto">
          <Button
            size="lg"
            disabled={saveDisabled}
            title={
              readOnly
                ? 'Only an admin can edit a sale'
                : walkInOwing
                  ? 'Choose a customer or take the full payment'
                  : undefined
            }
            onClick={() => void save(converting ? 'final' : status)}
          >
            <CheckCircle2 className="size-5" />
            {converting ? (
              <span>Save Sale</span>
            ) : editing ? (
              <span>Save Correction</span>
            ) : status === 'quotation' ? (
              <span>Save Quotation</span>
            ) : status === 'draft' ? (
              <span>Save Draft</span>
            ) : (
              <span>Save Sale</span>
            )}
          </Button>
        </div>
      </div>

      {/* Choose or add a customer without abandoning this sale.
          (No product drawer here — see the note above the item search.) */}
      <CustomerPicker
        open={pickerMode !== null}
        onClose={() => setPickerMode(null)}
        selectedId={customerId}
        onSelect={setCustomerId}
        startInAdd={pickerMode === 'add'}
      />
    </div>
  );
}

/**
 * Buy / average buy / sell, side by side, for a product in a search result.
 * amber = paid out, blue = average paid, green = coming in. `avgCost` is the
 * simple mean of buying prices, NOT the weighted COGS cost (see costing.ts).
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
      <div className="text-xs text-muted-foreground leading-none">{label}</div>
      <div className={cn('mt-0.5 text-sm tabular font-semibold', tone)}>
        {formatBDT(value, { withSymbol: false })}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: React.ReactNode;
  value: string;
  tone?: 'success' | 'warning';
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
      <span
        className={cn(
          'tabular',
          strong && 'font-semibold',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </span>
    </div>
  );
}
