import { FormEvent, useMemo, useState } from 'react';
import { Save, History, Info } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/NumberField';
import {
  useCorrectStock,
  useCostHistory,
  usePatchProduct,
  useSetProductCost,
} from '@/hooks/useProducts';
import { useAuth } from '@/stores/auth';
import { toast } from '@/stores/toast';
import type { Product } from '@/types/domain';
import { formatBDT, formatNumber, cn } from '@/lib/utils';
import { useDateFormat } from '@/lib/formatDate';

/**
 * QUICK UPDATE — the three things a shopkeeper changes day to day: buying
 * price, selling price, shelf count. Pre-filled; only what changed is written.
 *
 * STOCK IS NOT AN EDITABLE FIELD ANYWHERE: on-hand is SUM(stock_movements), so
 * a new count is saved as a signed recount adjustment for the difference.
 *
 * Layout: three equal columns (Buying | Selling | Stock) so it fits a 768px
 * screen with the footer visible. Every label is a static phrase with its value
 * in its own element, so the Bangla layer can translate it.
 */

interface Props {
  product: Product;
  onClose: () => void;
  /** Branch the count applies to. Stock is per (product, branch). */
  branchId?: string;
  /** Which box gets the caret: the selling price (Products) or the count (Stock list). */
  focus?: 'price' | 'stock';
}

// No branchId → the backend counts it against the shop's default branch.
export function QuickUpdateModal({ product, onClose, branchId, focus = 'price' }: Props) {
  const patchProduct = usePatchProduct();
  const correctStock = useCorrectStock();
  const setProductCost = useSetProductCost();
  const currentUserId = useAuth((s) => s.currentUserId);
  const fmt = useDateFormat();

  const [price, setPrice] = useState(product.price);
  const [buyPrice, setBuyPrice] = useState(product.cost);
  const [count, setCount] = useState(product.stock);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // `manageStock === false`: quantity deliberately not tracked (a service line).
  const tracksStock = product.manageStock !== false;

  const priceChanged = Number.isFinite(price) && price > 0 && price !== product.price;
  // Zero is a legitimate buying price (a free sample).
  const buyChanged = Number.isFinite(buyPrice) && buyPrice >= 0 && buyPrice !== product.cost;
  const delta = tracksStock ? count - product.stock : 0;
  const stockChanged = tracksStock && delta !== 0 && Number.isFinite(count);
  const nothingToDo = !priceChanged && !buyChanged && !stockChanged;

  const priceDiff = price - product.price;
  const buyDiff = buyPrice - product.cost;

  // Margin against the buying price in the box right now.
  const effectiveCost = buyChanged ? buyPrice : product.cost;
  const profit = useMemo(() => {
    if (effectiveCost <= 0 || !Number.isFinite(price)) return null;
    return { amount: price - effectiveCost, pct: ((price - effectiveCost) / effectiveCost) * 100 };
  }, [price, effectiveCost]);

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (nothingToDo || saving) return;
    setSaving(true);
    try {
      // Prices first: if the stock adjustment is refused, the prices still land.
      if (buyChanged) {
        // products.setCost, not a column write: keeps the history and the average.
        await setProductCost.mutateAsync({
          productId: product.id,
          cost: buyPrice,
          userId: currentUserId ?? undefined,
        });
      }
      if (priceChanged) {
        await patchProduct.mutateAsync({ id: product.id, patch: { price } });
      }
      if (stockChanged) {
        await correctStock.mutateAsync({
          productId: product.id,
          delta,
          unit: product.unit,
          branchId,
          userId: currentUserId ?? '',
          reason: `Counted ${formatNumber(count)} ${product.unit} in shop`,
        });
      }

      const parts: string[] = [];
      if (buyChanged) parts.push(`Buying ${formatBDT(buyPrice)}`);
      if (priceChanged) parts.push(`Selling ${formatBDT(price)}`);
      if (stockChanged) parts.push(`Stock ${formatNumber(count)} ${product.unit}`);
      toast.success('Product updated', { description: parts.join(' · ') });
      onClose();
    } catch (err) {
      toast.error('Could not save the change', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const bigInput = 'h-14 text-2xl text-right font-semibold tabular';

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-3xl"
      title="Update price & stock"
      subtitle={product.name}
      dirty={!nothingToDo}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 px-5">
            Cancel
          </Button>
          <Button
            type="submit"
            form="quick-update-form"
            disabled={nothingToDo || saving}
            className="h-11 px-6 text-base"
          >
            <Save className="size-4" /> Save
          </Button>
        </div>
      }
    >
      <form id="quick-update-form" onSubmit={save} className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* ---------------- Buying price ---------------- */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="qu-buy" className="text-sm font-medium">
                  New buying price
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistoryOpen(true)}
                  title="Buying price history"
                >
                  <History className="size-4" /> History
                </Button>
              </div>
              <NumberField
                id="qu-buy"
                value={buyPrice}
                onChangeNumber={setBuyPrice}
                className={cn(bigInput, 'mt-1.5')}
              />
            </div>
            <Row label="Now" value={formatBDT(product.cost)} />
            <Row label="Set on" value={fmt.date(product.costUpdatedAt)} />
            {buyChanged && (
              <Row
                label={buyDiff > 0 ? 'Buying price goes up by' : 'Buying price goes down by'}
                value={formatBDT(Math.abs(buyDiff))}
                // A higher buying price is bad news for the shop.
                tone={buyDiff > 0 ? 'bad' : 'good'}
              />
            )}
            <Row label="Average buying price" value={formatBDT(product.avgCost ?? product.cost)} />
            {buyChanged && (
              <div className="text-xs text-muted-foreground">
                Saving updates the average buying price.
              </div>
            )}
          </div>

          {/* ---------------- Selling price ---------------- */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div>
              <div className="flex items-center min-h-8">
                <label htmlFor="qu-price" className="text-sm font-medium">
                  New selling price
                </label>
              </div>
              <NumberField
                id="qu-price"
                autoFocus={focus === 'price'}
                value={price}
                onChangeNumber={setPrice}
                className={cn(bigInput, 'mt-1.5')}
              />
            </div>
            <Row label="Now" value={formatBDT(product.price)} />
            {priceChanged && (
              <Row
                label={priceDiff > 0 ? 'Price goes up by' : 'Price goes down by'}
                value={formatBDT(Math.abs(priceDiff))}
                tone={priceDiff > 0 ? 'good' : 'bad'}
              />
            )}
            {profit && (
              <Row
                label="Profit per unit"
                value={`${formatBDT(profit.amount)} (${profit.pct.toFixed(0)}%)`}
                tone={profit.amount < 0 ? 'bad' : undefined}
              />
            )}
            {profit && profit.amount < 0 && (
              <div className="text-sm font-medium text-destructive">
                This price is below your buying price. You would lose money on every sale.
              </div>
            )}
          </div>

          {/* ---------------- Stock ---------------- */}
          {tracksStock ? (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div>
                <div className="flex items-center min-h-8">
                  <label htmlFor="qu-count" className="text-sm font-medium">
                    Counted quantity
                  </label>
                </div>
                <NumberField
                  id="qu-count"
                  autoFocus={focus === 'stock'}
                  value={count}
                  onChangeNumber={setCount}
                  className={cn(bigInput, 'mt-1.5')}
                />
              </div>
              <Row label="In stock now" value={`${formatNumber(product.stock)} ${product.unit}`} />
              {stockChanged ? (
                <Row
                  label={delta > 0 ? 'Will add' : 'Will remove'}
                  value={`${formatNumber(Math.abs(delta))} ${product.unit}`}
                  tone={delta > 0 ? 'good' : 'bad'}
                />
              ) : (
                <div className="text-sm text-muted-foreground">No change</div>
              )}
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="size-4 mt-0.5 shrink-0" />
                <span>
                  Type what you counted on the shelf. The difference is saved as a stock
                  correction.
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Stock is not tracked for this product, so there is no quantity to update.
            </div>
          )}
        </div>
      </form>

      {historyOpen && (
        <CostHistoryPopup product={product} onClose={() => setHistoryOpen(false)} />
      )}
    </Modal>
  );
}

/**
 * Buying-price history for one product. A nested Modal: the overlay stack makes
 * Esc close only this layer, not the update popup under it.
 */
function CostHistoryPopup({ product, onClose }: { product: Product; onClose: () => void }) {
  const { data, isLoading } = useCostHistory(product.id);
  const fmt = useDateFormat();
  const entries = data ?? [];
  // "Current price" = newest entry that still counts (a retracted one does not).
  const currentId = entries.find((e) => !e.retractedAt)?.id;

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-md"
      title="Buying price history"
      subtitle={product.name}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            <span>Average buying price</span>
            <span className="ml-1.5 font-semibold tabular text-foreground">
              {formatBDT(product.avgCost ?? product.cost)}
            </span>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="p-4">
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Loading price history…
          </div>
        ) : entries.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No price changes recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {entries.map((e) => (
              <div key={e.id} className="flex items-baseline gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium tabular">{fmt.date(e.at)}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {e.retractedAt ? (
                      <span>Cancelled — not counted</span>
                    ) : e.id === currentId ? (
                      <span>Current price</span>
                    ) : e.source === 'initial' ? (
                      <span>Opening price</span>
                    ) : e.source === 'purchase' ? (
                      <span>From a purchase</span>
                    ) : (
                      <span>Changed</span>
                    )}
                    {e.userName && <span className="ml-1">· {e.userName}</span>}
                  </div>
                  {(e.retractReason ?? e.note) && (
                    <div className="text-xs text-muted-foreground mt-0.5 break-words">
                      {e.retractReason ?? e.note}
                    </div>
                  )}
                </div>
                {/* Struck through rather than hidden: it was entered once, and no longer counts. */}
                <div
                  className={cn(
                    'shrink-0 text-base font-semibold tabular',
                    e.retractedAt && 'line-through text-muted-foreground font-normal',
                  )}
                >
                  {formatBDT(e.cost)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Label on the left, number on the right — static label, so it is translatable. */
function Row({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold tabular text-right',
          tone === 'good' && 'text-success',
          tone === 'bad' && 'text-destructive',
        )}
      >
        {value}
      </span>
    </div>
  );
}
