import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, Save, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { ProductImage } from '@/components/products/ProductImage';
import { products as MOCK_PRODUCTS } from '@/mocks/data';
import { useProducts } from '@/hooks/useProducts';
import { useBranches } from '@/stores/branches';
import { hasBackend } from '@/lib/api';
import {
  nextTransferRef,
  useStock,
  type StockTransfer,
  type TransferLine,
  type TransferStatus,
} from '@/stores/stock';
import { formatBDT } from '@/lib/utils';

export default function AddStockTransfer() {
  const nav = useNavigate();
  const addTransfer = useStock((s) => s.addTransfer);

  // Branch dropdown sources from the branches store so it matches real branches
  // (and the names resolve back to IDs on save). Product picker uses backend
  // products when available so the productIds we send are real backend ids.
  const branches = useBranches((s) => s.items);
  const branchNames = branches.map((b) => b.name);
  const { data: beProducts } = useProducts();
  const products = hasBackend() && beProducts ? beProducts : MOCK_PRODUCTS;

  const [fromBranch, setFromBranch] = useState(branchNames[0] ?? 'Mirpur Branch');
  const [toBranch, setToBranch] = useState(branchNames[1] ?? 'Uttara Branch');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [status, setStatus] = useState<TransferStatus>('in-transit');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [searchQ, setSearchQ] = useState('');

  const matches = useMemo(() => {
    if (!searchQ.trim()) return [];
    const t = searchQ.toLowerCase();
    return products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(t)).slice(0, 6);
  }, [searchQ, products]);

  const addLine = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const idx = lines.findIndex((l) => l.productId === id);
    if (idx >= 0) {
      const next = [...lines];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
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
          unitCost: p.cost,
        },
      ]);
    }
    setSearchQ('');
  };

  const totalUnits = lines.reduce((s, l) => s + l.qty, 0);
  const totalValue = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

  const isValid =
    fromBranch && toBranch && fromBranch !== toBranch && lines.length > 0 && lines.every((l) => l.qty > 0);

  const submit = () => {
    if (!isValid) return;
    const t: StockTransfer = {
      id: 't_' + Date.now(),
      refNo: nextTransferRef(),
      date,
      fromBranch,
      toBranch,
      status,
      notes: notes || undefined,
      lines,
      createdBy: 'Seam',
    };
    addTransfer(t);
    nav('/stock/transfers');
  };

  return (
    <div>
      <PageHeader
        title="New Stock Transfer"
        subtitle="Move stock between branches"
        actions={
          <>
            <Button variant="ghost" onClick={() => nav('/stock/transfers')}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button onClick={submit} disabled={!isValid}>
              <Save className="size-4" /> Save Transfer
            </Button>
          </>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <Field label="From branch" required className="md:col-span-5">
                <select
                  value={fromBranch}
                  onChange={(e) => setFromBranch(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {branchNames.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="md:col-span-2 grid place-items-center pb-2">
                <ArrowRight className="size-5 text-muted-foreground" />
              </div>
              <Field label="To branch" required className="md:col-span-5">
                <select
                  value={toBranch}
                  onChange={(e) => setToBranch(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {branchNames.filter((b) => b !== fromBranch).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date" required className="md:col-span-6">
                <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Status" className="md:col-span-6">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TransferStatus)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="pending">Pending (not dispatched yet)</option>
                  <option value="in-transit">In Transit (sent, awaiting receive)</option>
                  <option value="received">Received (instant adjustment)</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Items</div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search product…"
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
                      <Plus className="size-3.5 text-primary" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase text-muted-foreground bg-secondary/40">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-8">#</th>
                    <th className="text-left px-2 py-2 font-medium">Item</th>
                    <th className="text-right px-2 py-2 font-medium">Qty</th>
                    <th className="text-left px-2 py-2 font-medium">Unit</th>
                    <th className="text-right px-2 py-2 font-medium">Unit Cost</th>
                    <th className="text-right px-2 py-2 font-medium">Subtotal</th>
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
                          onChangeNumber={(v) =>
                            setLines((ls) =>
                              ls.map((x, j) => (i === j ? { ...x, qty: Math.max(0, v) } : x)),
                            )
                          }
                          className="h-7 w-20 px-2 text-right text-xs ml-auto"
                        />
                      </td>
                      <td className="px-2 py-2 text-xs">{l.unit}</td>
                      <td className="px-2 py-2 text-right font-mono tabular">
                        {formatBDT(l.unitCost, { withSymbol: false })}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular font-semibold">
                        {formatBDT(l.qty * l.unitCost, { withSymbol: false })}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                          className="size-7 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
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
                placeholder="Reason / driver / vehicle / handover notes…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
              />
            </Field>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4 sticky top-4">
            <div className="text-sm font-semibold">Summary</div>
            <div className="mt-3 space-y-2 text-sm">
              <Row label="From" value={fromBranch} />
              <Row label="To" value={toBranch} />
              <div className="border-t border-border pt-2" />
              <Row label="Items" value={String(lines.length)} />
              <Row label="Units" value={String(totalUnits)} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Value</span>
                <span className="text-xl font-bold font-mono tabular text-primary">
                  {formatBDT(totalValue)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="text-[10px] uppercase font-semibold text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular">{value}</span>
    </div>
  );
}
