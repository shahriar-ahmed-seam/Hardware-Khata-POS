import { useMemo, useState } from 'react';
import { Save, TrendingUp, Package, Info, ShoppingCart, History, X } from 'lucide-react';
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

/** Short, unambiguous date for a price change. */
function shortDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * QUICK UPDATE — the two things a shopkeeper actually changes day to day.
 *
 * WHY THIS EXISTS
 * The full product form has ~25 fields across seven sections (image, POS
 * behaviour toggles, SKU/barcode generators, four price tiers, alternate units
 * and conversion factors, description). Asking an elderly owner to walk through
 * all of that because cement went up ten taka is a design failure. This popup
 * shows exactly two numbers, both pre-filled with the current value, and writes
 * only what was actually changed.
 *
 * THE IMPORTANT PART: STOCK IS NOT AN EDITABLE FIELD ANYWHERE
 * On-hand is `SUM(stock_movements.qty)` — never a stored column — so there is no
 * "save stock = 40" operation to call. Typing a new count here records a signed
 * **recount adjustment for the difference**, which is both the only correct way
 * to do it and the more useful one: the change shows up in Stock Adjustments with
 * who did it and when, instead of a number quietly changing.
 *
 * This also closes a trap in the full form: its "Opening stock" box is only read
 * when CREATING a product. On an existing product `products.update` has no stock
 * column to write, so editing that box and pressing Save reported success and
 * changed nothing.
 *
 * LAYOUT NOTE (why label/value rows instead of sentences)
 * The Bangla layer translates whole text nodes by exact match, so a sentence with
 * a number interpolated into the middle of it can never be translated. Every
 * label here is therefore a complete static phrase with its value in a separate
 * element — which also reads better for the intended user, since the numbers line
 * up in a column instead of hiding inside prose.
 */

interface Props {
  product: Product;
  onClose: () => void;
  /** Branch the count applies to. Stock is per (product, branch). */
  branchId?: string;
}

export function QuickUpdateModal({ product, onClose, branchId = 'br_mp' }: Props) {
  const patchProduct = usePatchProduct();
  const correctStock = useCorrectStock();
  const setProductCost = useSetProductCost();
  const currentUserId = useAuth((s) => s.currentUserId);

  const [price, setPrice] = useState(product.price);
  const [buyPrice, setBuyPrice] = useState(product.cost);
  const [count, setCount] = useState(product.stock);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // `manageStock === false` means this product's quantity is deliberately not
  // tracked (a service line, a bulk item sold by eye). Offering a count box
  // would invite a meaningless adjustment.
  const tracksStock = product.manageStock !== false;

  const priceChanged = Number.isFinite(price) && price > 0 && price !== product.price;
  // Zero is a legitimate buying price (a free sample), so this only requires a
  // finite, non-negative number that differs from the current one.
  const buyChanged =
    Number.isFinite(buyPrice) && buyPrice >= 0 && buyPrice !== product.cost;
  const delta = tracksStock ? count - product.stock : 0;
  const stockChanged = tracksStock && delta !== 0 && Number.isFinite(count);
  const nothingToDo = !priceChanged && !buyChanged && !stockChanged;

  const priceDiff = price - product.price;
  const buyDiff = buyPrice - product.cost;

  // Profit is measured against whatever buying price is in the box RIGHT NOW, so
  // changing both at once shows the margin the shop will actually get.
  const effectiveCost = buyChanged ? buyPrice : product.cost;
  const profit = useMemo(() => {
    if (effectiveCost <= 0 || !Number.isFinite(price)) return null;
    return { amount: price - effectiveCost, pct: ((price - effectiveCost) / effectiveCost) * 100 };
  }, [price, effectiveCost]);

  const save = async () => {
    if (nothingToDo || saving) return;
    setSaving(true);
    try {
      // Prices first: they are the safer writes, so if the stock adjustment is
      // refused (a cashier without `stock.adjustment`) the price changes are not
      // lost along with it.
      if (buyChanged) {
        // Goes through `products.setCost`, NOT a plain column write: the backend
        // appends to the buying-price history and recomputes the average.
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
          userId: currentUserId ?? 'u_admin',
          reason: `Counted ${formatNumber(count)} ${product.unit} in shop`,
        });
      }

      // Report exactly what happened rather than a generic "Saved".
      const parts: string[] = [];
      if (buyChanged) parts.push(`↓ ${formatBDT(buyPrice)}`);
      if (priceChanged) parts.push(`↑ ${formatBDT(price)}`);
      if (stockChanged) parts.push(`${formatNumber(count)} ${product.unit}`);
      toast.success('Product updated', { description: parts.join(' · ') });
      onClose();
    } catch (e) {
      toast.error('Could not save the change', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-xl"
      title="Update Price & Stock"
      subtitle={product.name}
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" onClick={onClose} className="h-11 px-5">
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            disabled={nothingToDo || saving}
            className="h-11 px-6 text-base"
          >
            <Save className="size-4" /> Save
          </Button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        {/* Which product — shown once, big, and never editable here. */}
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
          <div className="text-base font-semibold leading-snug">{product.name}</div>
          <div className="text-xs text-muted-foreground font-mono mt-0.5" data-no-i18n>
            {product.sku}
          </div>
        </div>

        {/* ------------- Buying price | Selling price, side by side -------------
            The buying price is not constant — a shop buys the same item at 100
            one month and 120 the next — so it needs to be editable right here,
            next to the selling price it determines. Stacks on a narrow window. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* ---------------- Buying price ---------------- */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-md bg-warning/10 text-warning grid place-items-center shrink-0">
                <ShoppingCart className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold">Buying price</div>
                <div className="text-2xs text-muted-foreground">What you pay the supplier</div>
              </div>
            </div>

            {/* Current buying price + WHEN it was set, with the history beside it. */}
            <div className="rounded-lg border border-border bg-muted/40 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Current buying price</div>
                  <div className="text-lg font-semibold tabular">{formatBDT(product.cost)}</div>
                  <div className="text-2xs text-muted-foreground mt-0.5">
                    Set on <span className="tabular">{shortDate(product.costUpdatedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setHistoryOpen(true)}
                  title="Price history"
                  className="shrink-0 h-9 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-xs font-medium hover:bg-secondary hover:border-primary/50 transition"
                >
                  <History className="size-3.5" />
                  <span className="hidden md:inline">History</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                New buying price
              </label>
              <NumberField
                value={buyPrice}
                onChangeNumber={setBuyPrice}
                className="h-14 text-2xl text-right font-semibold tabular mt-1"
                aria-label="New buying price"
              />
            </div>

            {buyChanged && (
              <Row
                label={buyDiff > 0 ? 'Buying price goes up by' : 'Buying price goes down by'}
                value={formatBDT(Math.abs(buyDiff))}
                // A HIGHER buying price is bad news for the shop, so the tone is
                // inverted compared with the selling price.
                tone={buyDiff > 0 ? 'bad' : 'good'}
              />
            )}

            <Row label="Average buying price" value={formatBDT(product.avgCost ?? product.cost)} />
            {buyChanged && (
              <div className="text-2xs text-muted-foreground">
                Saving updates the average buying price.
              </div>
            )}
          </div>

          {/* ---------------- Selling price ---------------- */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                <TrendingUp className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold">Selling price</div>
                <div className="text-2xs text-muted-foreground">What the customer pays</div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-2.5">
              <div className="text-xs text-muted-foreground">Current selling price</div>
              <div className="text-lg font-semibold tabular">{formatBDT(product.price)}</div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                New selling price
              </label>
              <NumberField
                value={price}
                onChangeNumber={setPrice}
                className="h-14 text-2xl text-right font-semibold tabular mt-1"
                aria-label="New selling price"
              />
            </div>

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
        </div>

        {/* ---------------- Stock ---------------- */}
        {tracksStock ? (
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-md bg-warning/10 text-warning grid place-items-center shrink-0">
                <Package className="size-4" />
              </div>
              <div className="text-base font-semibold">Stock in shop</div>
            </div>

            <Row label="System count" value={`${formatNumber(product.stock)} ${product.unit}`} />

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Counted quantity</label>
              <NumberField
                value={count}
                onChangeNumber={setCount}
                className="h-14 text-2xl text-right font-semibold tabular mt-1"
                aria-label="Counted quantity"
              />
            </div>

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
              <Info className="size-3.5 mt-0.5 shrink-0" />
              <span>
                Type what you counted on the shelf. The difference is saved as a stock correction,
                so your history stays correct.
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Stock is not tracked for this product, so there is no quantity to update.
          </div>
        )}
      </div>

      {historyOpen && (
        <CostHistoryPopup product={product} onClose={() => setHistoryOpen(false)} />
      )}
    </Modal>
  );
}

/**
 * Buying-price history for one product.
 *
 * A small overlay rather than a nested <Modal>: it has to sit ABOVE the update
 * modal that opened it, and reusing Modal would put a second full-screen scrim
 * over the first and fight for the Escape key.
 */
function CostHistoryPopup({ product, onClose }: { product: Product; onClose: () => void }) {
  const { data, isLoading } = useCostHistory(product.id);
  const entries = data ?? [];

  return (
    <div data-overlay="true" className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <button
        className="absolute inset-0 bg-black/60 animate-fade-in"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-scale-in">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border">
          <div className="min-w-0">
            <div className="text-base font-semibold">Buying price history</div>
            <div className="text-xs text-muted-foreground truncate">{product.name}</div>
          </div>
          <button
            onClick={onClose}
            className="size-8 shrink-0 grid place-items-center rounded-md hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-3">
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
              {(() => {
                // "Current price" is the newest entry that still COUNTS. A
                // retracted one (its purchase was cancelled) is shown for the
                // record but is not the price the shop pays, so the label must
                // not sit on it.
                const currentId = entries.find((e) => !e.retractedAt)?.id;
                return entries.map((e) => (
                  <div key={e.id} className="flex items-baseline gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium tabular">{shortDate(e.at)}</div>
                      <div className="text-2xs text-muted-foreground truncate">
                        {/* Static phrases only — the Bangla layer matches whole nodes. */}
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
                        <div className="text-2xs text-muted-foreground mt-0.5 break-words">
                          {e.retractReason ?? e.note}
                        </div>
                      )}
                    </div>
                    {/* Struck through rather than hidden: the owner looking at a
                        surprising average most needs to see that this price WAS
                        entered once, and that it no longer counts. */}
                    <div
                      className={cn(
                        'shrink-0 text-base font-semibold tabular',
                        e.retractedAt && 'line-through text-muted-foreground font-normal',
                      )}
                    >
                      {formatBDT(e.cost)}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Average buying price
            <span className="ml-1.5 font-semibold tabular text-foreground">
              {formatBDT(product.avgCost ?? product.cost)}
            </span>
          </div>
          <Button variant="outline" onClick={onClose} className="h-9">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Label on the left, number on the right — static label, so it is translatable. */
function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold tabular',
          tone === 'good' && 'text-success',
          tone === 'bad' && 'text-destructive',
        )}
      >
        {value}
      </span>
    </div>
  );
}
