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
import { customers as mockCustomers, products as mockProducts } from '@/mocks/data';
import { cn, formatBDT } from '@/lib/utils';
import { hasBackend } from '@/lib/api';
import { useProducts } from '@/hooks/useProducts';
import { useCustomersQuery } from '@/hooks/useCustomers';
import { useBranches } from '@/stores/branches';
import { useCustomers } from '@/stores/contacts';
import {
  useSales,
  type SaleLine,
  type SaleRecord,
  type SaleStatus,
  nextInvoiceNo,
} from '@/stores/sales';
import { ProductImage } from '@/components/products/ProductImage';

export default function AddSale() {
  const nav = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const initialStatus = (searchParams.get('status') as SaleStatus) || 'final';
  const sales = useSales((s) => s.sales);
  const addSale = useSales((s) => s.addSale);

  // Create-form wiring (now wired to the real backend): under Electron the
  // product/customer pickers read live backend data and the Business Location
  // select feeds a real branch. addSale() persists via api('sales.create'),
  // which generates the server id, customerId, and branch id; this page then
  // navigates to the relevant list which rehydrates from the backend. Without a
  // backend (browser dev) it falls back to the mock master data + optimistic id.
  const backend = hasBackend();
  const productsQuery = useProducts('br_mp');
  const customersQuery = useCustomersQuery();
  const products = backend ? (productsQuery.data ?? []) : mockProducts;
  const customers = backend ? (customersQuery.data ?? []) : mockCustomers;
  const branches = useBranches((s) => s.items);

  // Hydrate customers + branches on mount (cheap no-ops without a backend).
  const hydrateCustomers = useCustomers((s) => s.hydrate);
  const hydrateBranches = useBranches((s) => s.hydrate);
  useEffect(() => {
    void hydrateCustomers();
    void hydrateBranches();
  }, [hydrateCustomers, hydrateBranches]);

  const editing = id ? sales.find((s) => s.id === id) : undefined;

  // Default customer: edit value wins; otherwise under backend pick the real
  // walk-in customer if present (by name or seed id), else leave empty; under
  // mock keep 'cu1' (the walk-in label).
  const defaultCustomerId =
    editing?.customerId ??
    (backend
      ? customers.find((c) => c.name === 'Walk-in Customer' || c.id === 'cu1')?.id ?? ''
      : 'cu1');

  // Default branch: edit value wins; otherwise the default branch name, else first.
  const defaultBranchName =
    editing?.branch ??
    (branches.find((b) => b.isDefault)?.name ?? branches[0]?.name ?? 'Mirpur Branch');

  const [status, setStatus] = useState<SaleStatus>(editing?.status ?? initialStatus);
  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [branch, setBranch] = useState(defaultBranchName);
  const [date, setDate] = useState((editing?.date ?? new Date().toISOString()).slice(0, 16));
  const [validUntil, setValidUntil] = useState(
    editing?.validUntil ?? new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [orderDiscFlat, setOrderDiscFlat] = useState(editing?.orderDiscountFlat ?? 0);
  const [orderDiscPct, setOrderDiscPct] = useState(editing?.orderDiscountPct ?? 0);
  const [taxPct, setTaxPct] = useState(editing?.taxPct ?? 0);
  const [shipping, setShipping] = useState(editing?.shipping ?? 0);
  const [other, setOther] = useState(editing?.other ?? 0);
  const [lines, setLines] = useState<SaleLine[]>(editing?.lines ?? []);
  const [searchQ, setSearchQ] = useState('');
  // Guarded: the list can be empty (backend still loading) — never crash.
  const customer = customers.find((c) => c.id === customerId);

  // Once backend customers load, default the picker to the walk-in customer if
  // nothing is selected yet (and not editing an existing sale).
  useEffect(() => {
    if (!backend || editing) return;
    if (customerId) return;
    const walkIn = customers.find((c) => c.name === 'Walk-in Customer' || c.id === 'cu1');
    if (walkIn) setCustomerId(walkIn.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  const matches = useMemo(() => {
    if (!searchQ.trim()) return [] as typeof products;
    const t = searchQ.toLowerCase();
    return products.filter((p) =>
      `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(t),
    ).slice(0, 6);
  }, [searchQ, products]);

  const addLine = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const exists = lines.findIndex((l) => l.productId === id);
    if (exists >= 0) {
      const next = [...lines];
      next[exists] = { ...next[exists], qty: next[exists].qty + 1 };
      setLines(next);
    } else {
      setLines([
        ...lines,
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

  const updateLine = (idx: number, patch: Partial<SaleLine>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const removeLine = (idx: number) => setLines((ls) => ls.filter((_, i) => i !== idx));

  // Totals
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const totalLineDiscount = lines.reduce(
    (s, l) => s + l.unitPrice * l.qty * (l.discountPct / 100) + l.discountFlat,
    0,
  );
  const afterLine = Math.max(0, subtotal - totalLineDiscount);
  const orderDiscount = afterLine * (orderDiscPct / 100) + orderDiscFlat;
  const taxableBase = Math.max(0, afterLine - orderDiscount);
  const tax = taxableBase * (taxPct / 100);
  const total = taxableBase + tax + shipping + other;

  const save = (newStatus: SaleStatus = status) => {
    if (lines.length === 0) {
      alert('Add at least one item');
      return;
    }
    const rec: SaleRecord = {
      id: editing?.id ?? 'sl_' + Date.now(),
      invoiceNo: editing?.invoiceNo ?? nextInvoiceNo(newStatus),
      status: newStatus,
      date,
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
      paid: 0,
      due: total,
      payments: [],
      audit: [{ id: 'a_' + Date.now(), at: new Date().toISOString(), by: 'Seam', action: 'created' }],
      notes: notes || undefined,
      validUntil: newStatus === 'quotation' ? validUntil : undefined,
    };
    addSale(rec);
    if (newStatus === 'final') nav('/sales');
    else if (newStatus === 'draft') nav('/sales/drafts');
    else nav('/sales/quotations');
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
            <Button variant="outline" onClick={() => save('draft')}>
              <PenSquare className="size-4" /> Save as Draft
            </Button>
            <Button variant="outline" onClick={() => save('quotation')}>
              <FileText className="size-4" /> Save as Quotation
            </Button>
            <Button onClick={() => save('final')}>
              <CheckCircle2 className="size-4" /> Save Sale
            </Button>
          </>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT — meta + items */}
        <div className="xl:col-span-2 space-y-4">
          <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Customer" required>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date" required>
              <Input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Business Location" required>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              >
                {(branches.length > 0 ? branches.map((b) => b.name) : [branch]).map((name) => (
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
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </Field>
            )}
          </Card>

          <Card className="p-4">
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
                        <div className="text-[10px] text-muted-foreground font-mono">{p.sku}</div>
                      </div>
                      <div className="text-sm font-mono tabular">{formatBDT(p.price, { withSymbol: false })}</div>
                      <Plus className="size-3.5 text-primary" />
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
                    <th className="text-right px-2 py-2 font-medium">Qty</th>
                    <th className="text-right px-2 py-2 font-medium">Price</th>
                    <th className="text-right px-2 py-2 font-medium">Disc %</th>
                    <th className="text-right px-2 py-2 font-medium">Subtotal</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const sub = l.unitPrice * l.qty - l.discountFlat - l.unitPrice * l.qty * (l.discountPct / 100);
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-2">
                          <div className="font-medium">{l.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{l.sku}</div>
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
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
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

        {/* RIGHT — totals & charges */}
        <div className="space-y-4">
          <Card className="p-4 space-y-3 sticky top-4">
            <div className="text-sm font-semibold">Order charges</div>
            <div className="grid grid-cols-2 gap-2">
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

            <div className="border-t border-border pt-3 space-y-1.5 text-sm">
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
  tone?: 'success';
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-mono tabular', tone === 'success' && 'text-success')}>{value}</span>
    </div>
  );
}

// silence unused
void CalIcon;
void Badge;
