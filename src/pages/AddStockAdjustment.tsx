import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Search, Trash2 } from 'lucide-react';
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
  nextAdjustmentRef,
  useStock,
  type AdjustmentLine,
  type AdjustmentType,
  type StockAdjustment,
} from '@/stores/stock';
import { formatBDT, cn } from '@/lib/utils';

const TYPES: AdjustmentType[] = ['damage', 'theft', 'sample', 'recount', 'other'];

export default function AddStockAdjustment() {
  const nav = useNavigate();
  const addAdjustment = useStock((s) => s.addAdjustment);

  // Branch dropdown sources from the branches store so it matches real branches
  // (the name resolves back to an ID on save). Product picker uses backend
  // products when available so the productIds we send are real backend ids.
  const branches = useBranches((s) => s.items);
  const branchNames = branches.map((b) => b.name);
  const { data: beProducts } = useProducts();
  const products = hasBackend() && beProducts ? beProducts : MOCK_PRODUCTS;

  const [branch, setBranch] = useState(branchNames[0] ?? 'Mirpur Branch');
  const [type, setType] = useState<AdjustmentType>('damage');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<AdjustmentLine[]>([]);
  const [searchQ, setSearchQ] = useState('');

  const matches = useMemo(() => {
    if (!searchQ.trim()) return [];
    const t = searchQ.toLowerCase();
    return products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(t)).slice(0, 6);
  }, [searchQ, products]);

  const addLine = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    if (lines.some((l) => l.productId === id)) return;
    setLines([
      ...lines,
      {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        qty: type === 'damage' || type === 'theft' || type === 'sample' ? -1 : 1,
        unit: p.unit,
        unitCost: p.cost,
      },
    ]);
    setSearchQ('');
  };

  const netQty = lines.reduce((s, l) => s + l.qty, 0);
  const netValue = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

  const isValid = lines.length > 0 && lines.every((l) => l.qty !== 0);

  const submit = () => {
    if (!isValid) return;
    const a: StockAdjustment = {
      id: 'a_' + Date.now(),
      refNo: nextAdjustmentRef(),
      date,
      branch,
      type,
      reason: reason || undefined,
      lines,
      createdBy: 'Seam',
    };
    addAdjustment(a);
    nav('/stock/adjustments');
  };

  return (
    <div>
      <PageHeader
        title="New Stock Adjustment"
        subtitle="Damage / theft / sample / recount"
        actions={
          <>
            <Button variant="ghost" onClick={() => nav('/stock/adjustments')}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button onClick={submit} disabled={!isValid}>
              <Save className="size-4" /> Save Adjustment
            </Button>
          </>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Branch" required>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {branchNames.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Type" required>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AdjustmentType)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 capitalize"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
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
              <Field label="Reason" className="md:col-span-3">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Why this adjustment? (e.g. broken during forklift move)"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                />
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
                    <th className="text-right px-2 py-2 font-medium">± Qty</th>
                    <th className="text-left px-2 py-2 font-medium">Unit</th>
                    <th className="text-right px-2 py-2 font-medium">Unit Cost</th>
                    <th className="text-right px-2 py-2 font-medium">Impact</th>
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
                            setLines((ls) => ls.map((x, j) => (i === j ? { ...x, qty: v } : x)))
                          }
                          allowNegative
                          className="h-7 w-24 px-2 text-right text-xs ml-auto"
                        />
                      </td>
                      <td className="px-2 py-2 text-xs">{l.unit}</td>
                      <td className="px-2 py-2 text-right font-mono tabular">
                        {formatBDT(l.unitCost, { withSymbol: false })}
                      </td>
                      <td
                        className={cn(
                          'px-2 py-2 text-right font-mono tabular font-semibold',
                          l.qty < 0 ? 'text-destructive' : l.qty > 0 ? 'text-success' : '',
                        )}
                      >
                        {l.qty >= 0 ? '+' : ''}
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
                        Search above to add items. Use negative qty for damage/theft, positive for found stock.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4 sticky top-4">
            <div className="text-sm font-semibold">Summary</div>
            <div className="mt-3 space-y-2 text-sm">
              <Row label="Lines" value={String(lines.length)} />
              <Row
                label="Net qty"
                value={`${netQty >= 0 ? '+' : ''}${netQty}`}
                tone={netQty < 0 ? 'destructive' : netQty > 0 ? 'success' : undefined}
              />
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-muted-foreground">Net value</span>
                <span
                  className={cn(
                    'text-xl font-bold font-mono tabular',
                    netValue < 0 ? 'text-destructive' : netValue > 0 ? 'text-success' : '',
                  )}
                >
                  {netValue >= 0 ? '+' : ''}
                  {formatBDT(netValue)}
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

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'destructive';
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-mono tabular',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </span>
    </div>
  );
}
