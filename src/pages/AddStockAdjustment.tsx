import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@/stores/toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { IconButton } from '@/components/ui/IconButton';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { nowLocalInput, fromLocalInput } from '@/lib/datetime';
import { NumberField } from '@/components/ui/NumberField';
import { ProductPicker } from '@/components/stock/ProductPicker';
import { useIsMultiBranch } from '@/components/stock/hooks';
import { useProducts } from '@/hooks/useProducts';
import { useBranches } from '@/stores/branches';
import { confirm } from '@/stores/confirm';
import {
  nextAdjustmentRef,
  useStock,
  type AdjustmentType,
  type StockAdjustment,
} from '@/stores/stock';
import type { Product } from '@/types/domain';
import { formatBDT, formatNumber, cn } from '@/lib/utils';
import { currentUserId } from '@/lib/actor';

const TYPE_OPTIONS: { value: AdjustmentType; label: string }[] = [
  { value: 'damage', label: 'Damaged' },
  { value: 'theft', label: 'Stolen or lost' },
  { value: 'sample', label: 'Given as sample' },
  { value: 'recount', label: 'Recount' },
  { value: 'other', label: 'Other' },
];
const REMOVES: AdjustmentType[] = ['damage', 'theft', 'sample'];

/**
 * A line as typed. The quantity is always positive; the direction comes from
 * the Type (Damage/Theft/Sample remove, Other picks per line, Recount = counted
 * minus system). A typed "2" can no longer turn into +2 by accident.
 */
interface DraftLine {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  unitCost: number;
  /** System stock when the line was added (fallback if the catalogue reloads). */
  stock: number;
  qty: number;
  dir: 1 | -1;
  counted: number;
}

export default function AddStockAdjustment() {
  const nav = useNavigate();
  const addAdjustment = useStock((s) => s.addAdjustment);
  const multiBranch = useIsMultiBranch();

  const branches = useBranches((s) => s.items);
  const branchNames = branches.map((b) => b.name);
  // The shop's default branch; adopted when the list lands after first render.
  const defaultBranchName = branches.find((b) => b.isDefault)?.name ?? branches[0]?.name ?? '';
  const [branch, setBranch] = useState(defaultBranchName);
  useEffect(() => {
    if (!branch && defaultBranchName) setBranch(defaultBranchName);
  }, [branch, defaultBranchName]);
  // Stock figures for the branch being adjusted.
  const branchId = branches.find((b) => b.name === branch)?.id;
  const { data: beProducts } = useProducts(branchId);
  const products = useMemo(() => beProducts ?? [], [beProducts]);

  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<AdjustmentType>('damage');
  const [date, setDate] = useState(nowLocalInput());
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);

  // Focus the qty box of a just-added (or repeated) line.
  const qtyRefs = useRef(new Map<string, HTMLInputElement | null>());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusId) return;
    const el = qtyRefs.current.get(focusId);
    el?.focus();
    el?.select();
    setFocusId(null);
  }, [focusId, lines]);

  const stockOf = (l: DraftLine) => products.find((p) => p.id === l.productId)?.stock ?? l.stock;
  const signedQty = (l: DraftLine) =>
    type === 'recount' ? l.counted - stockOf(l) : (REMOVES.includes(type) ? -1 : l.dir) * l.qty;

  const addLine = (p: Product) => {
    if (lines.some((l) => l.productId === p.id)) {
      setFlashId(p.id);
      setTimeout(() => setFlashId(null), 900);
      setFocusId(p.id);
      return;
    }
    setLines((ls) => [
      ...ls,
      {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        unitCost: p.cost,
        stock: p.stock,
        qty: 1,
        dir: -1,
        counted: p.stock,
      },
    ]);
    setFocusId(p.id);
  };
  const patch = (i: number, v: Partial<DraftLine>) =>
    setLines((ls) => ls.map((x, j) => (i === j ? { ...x, ...v } : x)));

  const netValue = lines.reduce((s, l) => s + signedQty(l) * l.unitCost, 0);
  const zeroLine = lines.findIndex((l) => signedQty(l) === 0);
  const problem =
    lines.length === 0 ? 'Add at least one item' : zeroLine >= 0 ? 'A line does not change the stock' : '';
  const isValid = problem === '';

  // Leaves the page only once the backend has saved it; a refusal keeps the input.
  const submit = async () => {
    if (!isValid || saving) return;
    const a: StockAdjustment = {
      id: 'a_' + Date.now(),
      refNo: nextAdjustmentRef(),
      date: fromLocalInput(date),
      branch,
      type,
      reason: reason || undefined,
      lines: lines.map((l) => ({
        productId: l.productId,
        name: l.name,
        sku: l.sku,
        qty: signedQty(l),
        unit: l.unit,
        unitCost: l.unitCost,
      })),
      createdBy: currentUserId(),
    };
    setSaving(true);
    const ok = await addAdjustment(a);
    setSaving(false);
    if (!ok) return;
    toast.success('Adjustment saved');
    nav('/stock/adjustments');
  };

  const back = async () => {
    if (
      lines.length > 0 &&
      !(await confirm({
        title: 'Leave without saving?',
        message: 'The items you entered will be lost.',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        variant: 'destructive',
      }))
    )
      return;
    nav('/stock/adjustments');
  };

  return (
    <div>
      <PageHeader
        title="New Stock Adjustment"
        subtitle="Record broken, lost or recounted stock."
        actions={
          <Button variant="outline" onClick={() => void back()}>
            <ArrowLeft className="size-4" /> Back
          </Button>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <Card className="p-4 space-y-4">
            <FormField label="What happened?" required>
              <Segmented ariaLabel="Adjustment type" value={type} onChange={setType} options={TYPE_OPTIONS} />
            </FormField>
            <div className={cn('grid grid-cols-1 gap-3', multiBranch ? 'md:grid-cols-2' : 'md:grid-cols-[minmax(300px,1fr)_2fr]')}>
              {multiBranch && (
                <FormField label="Branch" required>
                  {(f) => (
                    <Select {...f} value={branch} onChange={(e) => setBranch(e.target.value)}>
                      {branchNames.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
              )}
              <FormField label="Date" required>
                <DateTimeField value={date} onChange={setDate} />
              </FormField>
              <FormField label="Reason" className={multiBranch ? 'md:col-span-2' : ''}>
                {(f) => (
                  <textarea
                    {...f}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={1}
                    placeholder="e.g. 2 bags got wet in the rain"
                    className="w-full min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                  />
                )}
              </FormField>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Items</div>
            <ProductPicker products={products} onPick={addLine} autoFocus />

            <div className="mt-3 rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-secondary/40">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Item</th>
                    <th className="text-right px-2 py-2 font-medium">
                      {type === 'recount' ? 'Counted' : 'Qty'}
                    </th>
                    <th className="text-right px-2 py-2 font-medium">In stock → after</th>
                    <th className="text-right px-2 py-2 font-medium">Impact</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const sq = signedQty(l);
                    const now = stockOf(l);
                    return (
                      <tr
                        key={l.productId}
                        className={cn('border-t border-border transition-colors', flashId === l.productId && 'bg-primary/15')}
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium">{l.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{l.sku}</div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            {type === 'other' && (
                              <Segmented
                                size="sm"
                                ariaLabel="Direction"
                                value={l.dir === 1 ? 'add' : 'remove'}
                                onChange={(v) => patch(i, { dir: v === 'add' ? 1 : -1 })}
                                options={[
                                  { value: 'remove', label: 'Remove' },
                                  { value: 'add', label: 'Add' },
                                ]}
                              />
                            )}
                            <NumberField
                              ref={(el) => {
                                qtyRefs.current.set(l.productId, el);
                              }}
                              value={type === 'recount' ? l.counted : l.qty}
                              onChangeNumber={(v) =>
                                patch(i, type === 'recount' ? { counted: Math.max(0, v) } : { qty: Math.max(0, v) })
                              }
                              aria-label={type === 'recount' ? 'Counted' : 'Quantity'}
                              className="h-10 w-24 px-2 text-right text-sm"
                            />
                            <span className="text-xs text-muted-foreground w-8">{l.unit}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right tabular whitespace-nowrap">
                          <span className="text-muted-foreground">{formatNumber(now)}</span>
                          <ArrowRight className="inline size-3.5 mx-1 text-muted-foreground" />
                          <span className={cn('font-semibold', sq < 0 ? 'text-destructive' : sq > 0 ? 'text-success' : '')}>
                            {formatNumber(now + sq)}
                          </span>{' '}
                          <span className="text-xs text-muted-foreground">{l.unit}</span>
                        </td>
                        <td
                          title={`@ ${formatBDT(l.unitCost)}`}
                          className={cn(
                            'px-2 py-2 text-right tabular font-semibold whitespace-nowrap',
                            sq < 0 ? 'text-destructive' : sq > 0 ? 'text-success' : 'text-muted-foreground',
                          )}
                        >
                          {sq > 0 ? '+' : sq < 0 ? '−' : ''}
                          {formatBDT(Math.abs(sq * l.unitCost), { withSymbol: false })}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <IconButton
                            size="sm"
                            tone="danger"
                            label="Remove line"
                            onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="size-4" />
                          </IconButton>
                        </td>
                      </tr>
                    );
                  })}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        Search above to add items. Counting one product? Use Update on the Stock list.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4 sticky top-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Net value</span>
              <span
                className={cn(
                  'text-xl font-bold tabular',
                  netValue < 0 ? 'text-destructive' : netValue > 0 ? 'text-success' : '',
                )}
              >
                {netValue > 0 ? '+' : netValue < 0 ? '−' : ''}
                {formatBDT(Math.abs(netValue))}
              </span>
            </div>
            <Button size="lg" className="w-full" onClick={() => void submit()} disabled={!isValid || saving}>
              <Save className="size-4" /> Save adjustment
            </Button>
            {problem && <p className="text-sm text-muted-foreground text-center">{problem}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
