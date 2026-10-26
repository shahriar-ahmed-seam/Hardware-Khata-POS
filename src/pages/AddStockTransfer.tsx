import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@/stores/toast';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Trash2, ArrowLeftRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { nowLocalInput, fromLocalInput } from '@/lib/datetime';
import { NumberField } from '@/components/ui/NumberField';
import { ProductPicker } from '@/components/stock/ProductPicker';
import { useIsMultiBranch } from '@/components/stock/hooks';
import { useProducts } from '@/hooks/useProducts';
import { useBranches } from '@/stores/branches';
import { confirm } from '@/stores/confirm';
import {
  nextTransferRef,
  useStock,
  type StockTransfer,
  type TransferLine,
  type TransferStatus,
} from '@/stores/stock';
import type { Product } from '@/types/domain';
import { formatBDT } from '@/lib/utils';
import { currentUserId } from '@/lib/actor';

export default function AddStockTransfer() {
  const nav = useNavigate();
  const addTransfer = useStock((s) => s.addTransfer);
  const multiBranch = useIsMultiBranch();

  const branches = useBranches((s) => s.items);
  const branchNames = branches.filter((b) => b.active !== false).map((b) => b.name);

  // From = the shop's default branch (not simply the first in the list).
  const defaultName = branches.find((b) => b.isDefault)?.name ?? branchNames[0] ?? '';
  const [fromBranch, setFromBranch] = useState(defaultName);
  const [toBranch, setToBranch] = useState('');
  const otherName = branchNames.find((b) => b !== fromBranch) ?? '';
  useEffect(() => {
    if (!fromBranch && defaultName) setFromBranch(defaultName);
  }, [fromBranch, defaultName]);
  useEffect(() => {
    if ((!toBranch || toBranch === fromBranch) && otherName) setToBranch(otherName);
  }, [toBranch, fromBranch, otherName]);

  const fromId = branches.find((b) => b.name === fromBranch)?.id;
  const { data: beProducts } = useProducts(fromId);
  const products = useMemo(() => beProducts ?? [], [beProducts]);

  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(nowLocalInput());
  const [status, setStatus] = useState<TransferStatus>('in-transit');
  const [moreOpen, setMoreOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<TransferLine[]>([]);

  // Focus the qty box of a just-added line.
  const qtyRefs = useRef(new Map<string, HTMLInputElement | null>());
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusId) return;
    const el = qtyRefs.current.get(focusId);
    el?.focus();
    el?.select();
    setFocusId(null);
  }, [focusId, lines]);

  const addLine = (p: Product) => {
    setLines((ls) => {
      const idx = ls.findIndex((l) => l.productId === p.id);
      if (idx >= 0) return ls.map((l, j) => (j === idx ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { productId: p.id, name: p.name, sku: p.sku, qty: 1, unit: p.unit, unitCost: p.cost }];
    });
    setFocusId(p.id);
  };

  const totalValue = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const problem = !toBranch || fromBranch === toBranch
    ? 'Choose where the stock goes'
    : lines.length === 0
      ? 'Add at least one item'
      : lines.some((l) => !(l.qty > 0))
        ? 'Quantity can’t be 0'
        : '';
  const isValid = problem === '';

  // Leaves the page only once the backend has saved it.
  const submit = async () => {
    if (!isValid || saving) return;
    const t: StockTransfer = {
      id: 't_' + Date.now(),
      refNo: nextTransferRef(),
      date: fromLocalInput(date),
      fromBranch,
      toBranch,
      status,
      notes: notes || undefined,
      lines,
      createdBy: currentUserId(),
    };
    setSaving(true);
    const ok = await addTransfer(t);
    setSaving(false);
    if (!ok) return;
    toast.success('Transfer saved');
    nav('/stock/transfers');
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
    nav('/stock/transfers');
  };

  // Owner decision #5: one branch → nothing to transfer to.
  if (branches.length > 0 && !multiBranch) {
    return (
      <div>
        <PageHeader title="New Stock Transfer" />
        <div className="p-6">
          <Card>
            <EmptyState
              icon={ArrowLeftRight}
              title="You need a second branch to transfer stock."
              message="Add a branch in Settings → Branches to use transfers."
              action={
                <Link to="/settings/branches">
                  <Button variant="outline">Open branch settings</Button>
                </Link>
              }
            />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New Stock Transfer"
        subtitle="Move stock between branches"
        actions={
          <Button variant="outline" onClick={() => void back()}>
            <ArrowLeft className="size-4" /> Back
          </Button>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1.2fr] gap-3 items-end">
              <FormField label="From branch" required>
                {(f) => (
                  <Select {...f} value={fromBranch} onChange={(e) => setFromBranch(e.target.value)}>
                    {branchNames.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <div className="hidden md:grid place-items-center h-10">
                <ArrowRight className="size-5 text-muted-foreground" />
              </div>
              <FormField label="To branch" required>
                {(f) => (
                  <Select {...f} value={toBranch} onChange={(e) => setToBranch(e.target.value)}>
                    {branchNames
                      .filter((b) => b !== fromBranch)
                      .map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Date" required>
                <DateTimeField value={date} onChange={setDate} />
              </FormField>
            </div>
            <FormField label="Notes">
              {(f) => (
                <textarea
                  {...f}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={1}
                  placeholder="Driver, vehicle, handover notes…"
                  className="w-full min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-y"
                />
              )}
            </FormField>
            {/* Expert: the status defaults to In transit. */}
            {moreOpen ? (
              <FormField label="Status" className="max-w-sm">
                {(f) => (
                  <Select {...f} value={status} onChange={(e) => setStatus(e.target.value as TransferStatus)}>
                    <option value="pending">Pending (not sent yet)</option>
                    <option value="in-transit">In transit (sent, waiting to be received)</option>
                    <option value="received">Received now</option>
                  </Select>
                )}
              </FormField>
            ) : (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="text-sm text-primary hover:underline focus-ring rounded"
              >
                More options
              </button>
            )}
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-2">Items</div>
            <ProductPicker products={products} onPick={addLine} autoFocus />

            <div className="mt-3 rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-secondary/40">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Item</th>
                    <th className="text-right px-2 py-2 font-medium">Qty</th>
                    <th className="text-right px-2 py-2 font-medium">Unit cost</th>
                    <th className="text-right px-2 py-2 font-medium">Subtotal</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.productId} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{l.sku}</div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <NumberField
                            ref={(el) => {
                              qtyRefs.current.set(l.productId, el);
                            }}
                            value={l.qty}
                            aria-label="Quantity"
                            onChangeNumber={(v) =>
                              setLines((ls) => ls.map((x, j) => (i === j ? { ...x, qty: Math.max(0, v) } : x)))
                            }
                            className="h-10 w-24 px-2 text-right text-sm"
                          />
                          <span className="text-xs text-muted-foreground w-8">{l.unit}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right tabular">
                        {formatBDT(l.unitCost, { withSymbol: false })}
                      </td>
                      <td className="px-2 py-2 text-right tabular font-semibold">
                        {formatBDT(l.qty * l.unitCost, { withSymbol: false })}
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
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        Search above to add items.
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
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span className="tabular">{lines.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total value</span>
              <span className="text-xl font-bold tabular">{formatBDT(totalValue)}</span>
            </div>
            <Button size="lg" className="w-full" onClick={() => void submit()} disabled={!isValid || saving}>
              <Save className="size-4" /> Save transfer
            </Button>
            {problem && <p className="text-sm text-muted-foreground text-center">{problem}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
