import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Trash2, Percent } from 'lucide-react';
import { cn, formatBDT } from '@/lib/utils';
import { type CartLine, lineSubtotal, unitPrice } from './types';
import { useUnits } from '@/hooks/useCatalog';
import { Badge } from '@/components/ui/Badge';
import { NumberField } from '@/components/ui/NumberField';
import { useCanAll } from '@/hooks/useCan';

interface Props {
  line: CartLine;
  index: number;
  onChange: (next: CartLine) => void;
  onRemove: () => void;
  /**
   * CURRENT buying price of the product, from the catalogue. `null` when the
   * catalogue has not loaded yet or the product is gone — rendered as '—'
   * rather than 0, which would read as "this cost us nothing".
   */
  cost?: number | null;
  /** Mean of every recorded buying price (products.avg_cost). */
  avgCost?: number | null;
  /**
   * The product's CATALOGUE price for the cart's current price group. Only used
   * to offer "Undo" after the cashier has typed a price by hand — looked up live
   * for the same reason `cost` is, so it can never be a stale copy.
   */
  listPrice?: number | null;
  /**
   * Bumped by POS each time this product is scanned or tapped (added or +1).
   * A new value scrolls the line into view and highlights it briefly, so a
   * re-scan of an item further down the cart is never invisible.
   */
  flash?: number;
}

/** 2.5 − 1 must be 1.5, not 1.4999999999999998. */
const q3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * ONE CART LINE — compact.
 *
 * This used to be a card about 200px tall (a 44px quantity bar, a label over
 * every field, a separate strip for the buying prices and another for
 * "price × qty"), so only one or two lines were visible and a cashier had to
 * scroll for every sale. Nothing was dropped; it is re-arranged:
 *
 *   wide cart   #  Name                 [− 3 +] pc  [ 3,000 ]  9,000.00  % 🗑
 *                  SKU · Buy ৳ · Avg ৳
 *   narrow cart #  Name                               9,000.00
 *                  SKU · Buy ৳ · Avg ৳
 *                  [− 3 +] pc   [ 3,000 ]                 % 🗑
 *
 * The layout lives in globals.css (`.cart-line`, a grid with named areas); the
 * cart list is the container it measures, in rem, so it also follows the A− /
 * A+ text size. Column labels are shown once, above the list (CartPanel).
 *
 * Markup and the two discounts stay behind the % button and open as one short
 * row under the line. Anything applied opens it by default and is badged, so a
 * discount can never sit on a sale unseen.
 */
export function CartLineRow({
  line,
  index,
  onChange,
  onRemove,
  cost = null,
  avgCost = null,
  listPrice = null,
  flash = 0,
}: Props) {
  // Unit labels come from the backend units catalog (cached by react-query, so
  // every row shares one fetch). Until it resolves we show the stored code.
  const unitsQuery = useUnits();
  const unitName =
    (unitsQuery.data ?? []).find((u) => u.short === line.unit)?.short ?? line.unit;
  const lineTotal = lineSubtotal(line);
  const up = unitPrice(line);
  const savings = up * line.qty - lineTotal;

  const hasMarkup = line.markupPct !== 0;
  const hasDiscount = line.discountPct !== 0 || line.discountFlat !== 0;
  const hasAdjustments = hasMarkup || hasDiscount;
  // null = follow hasAdjustments · boolean = the cashier toggled it by hand.
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? hasAdjustments;

  // Scroll into view + a short highlight when POS says this line was touched.
  const rowRef = useRef<HTMLDivElement>(null);
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (!flash) return;
    rowRef.current?.scrollIntoView({ block: 'nearest' });
    setFlashing(true);
    const t = setTimeout(() => setFlashing(false), 900);
    // Also un-highlight when another line takes the flash (flash → 0) before
    // the timer runs — clearing the timer alone left this line lit for good.
    return () => {
      clearTimeout(t);
      setFlashing(false);
    };
  }, [flash]);

  const setQty = (qty: number) => onChange({ ...line, qty: q3(qty) });

  // The same rights the main process checks on save (backend/services/saleRules.ts).
  // Without them the boxes are shown but locked, so nothing is typed that the
  // sale would then refuse.
  const can = useCanAll(['pos.priceOverride', 'pos.discount'] as const);
  const canPrice = can['pos.priceOverride'];
  const canDiscount = can['pos.discount'];
  const noRight = 'You do not have the right to change this. Ask the owner or a manager.';

  return (
    <div
      ref={rowRef}
      className={cn(
        'cart-line-card mx-2 my-1 rounded-lg border bg-card px-2.5 py-2 transition-colors duration-500',
        flashing ? 'border-primary/60 bg-primary/10' : 'border-border/60 hover:border-border',
      )}
    >
      <div className="cart-line">
        <span className="cl-num text-xs font-semibold text-muted-foreground tabular">
          {index + 1}
        </span>

        <div className="cl-name min-w-0 text-sm font-semibold leading-tight truncate" title={line.name}>
          {line.name}
        </div>

        {/* Code, the two buying prices (owner decision: cashiers may see them)
            and whatever has been applied. Each label is its own text node so
            the Bangla layer can translate it. */}
        <div className="cl-meta min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground leading-tight">
          <span className="font-mono truncate max-w-full">{line.sku}</span>
          {/* SPR only when it differs from the price box (a markup is on). */}
          {hasMarkup && (
            <span className="tabular whitespace-nowrap" title="Selling price before markup">
              <span>SPR</span> ৳ {formatBDT(line.basePrice, { withSymbol: false })}
            </span>
          )}
          <MetaPrice label="Buy" title="Buying price" value={cost} tone="text-warning" />
          <MetaPrice label="Avg" title="Avg. buying price" value={avgCost} tone="text-primary" />
          {hasMarkup && (
            <Badge variant="info">
              Markup
              <span className="tabular">{line.markupPct}%</span>
            </Badge>
          )}
          {hasDiscount && (
            <Badge variant="success">
              Discount
              {line.discountPct !== 0 && <span className="tabular">{line.discountPct}%</span>}
              {line.discountFlat !== 0 && (
                <span className="tabular">৳ {formatBDT(line.discountFlat, { withSymbol: false })}</span>
              )}
            </Badge>
          )}
          {line.priceOverride && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Badge
                variant="info"
                title="Price changed for this sale only — the product's price is unchanged."
              >
                Price changed
              </Badge>
              {listPrice !== null && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...line, basePrice: listPrice, markupPct: 0, priceOverride: false })
                  }
                  className="font-semibold text-primary underline hover:no-underline focus-ring rounded"
                  title={`Put it back to the catalogue price (৳ ${listPrice.toFixed(2)})`}
                >
                  Undo
                </button>
              )}
            </span>
          )}
        </div>

        {/* Quantity: decimals allowed (2.5 kg, 1.5 ft), the whole value is
            selected on click so typing replaces it. The unit is shown as text:
            the old unit picker changed only the label (pack prices are not
            built), so "2 dz" sold and deducted 2 pieces. */}
        <div className="cl-qty flex items-center gap-1.5">
          <div className="flex items-center h-9 rounded-md bg-secondary focus-within:ring-2 focus-within:ring-ring/50">
            <button
              type="button"
              onClick={() => setQty(line.qty - 1)}
              disabled={line.qty <= 1}
              className="h-9 w-8 grid place-items-center rounded-l-md hover:bg-background disabled:opacity-40 disabled:pointer-events-none"
              title="Decrease"
              aria-label="Decrease"
            >
              <Minus className="size-4" />
            </button>
            <NumberField
              value={line.qty}
              onChangeNumber={setQty}
              onBlur={() => {
                // An emptied box would leave a 0-quantity line on the sale.
                if (!(line.qty > 0)) setQty(1);
              }}
              aria-label="Quantity"
              title="Quantity"
              placeholder="1"
              className="h-9 w-14 px-1 rounded-none border-0 bg-transparent text-center text-sm font-semibold focus:ring-0 focus:border-0"
            />
            <button
              type="button"
              onClick={() => setQty(line.qty + 1)}
              className="h-9 w-8 grid place-items-center rounded-r-md hover:bg-background"
              title="Increase"
              aria-label="Increase"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{unitName}</span>
        </div>

        {/*
          SELLING PRICE IS EDITABLE — for THIS SALE ONLY.
          A hardware counter bargains ("240 each if I take twenty"). Typing here
          sets the price on this cart line and nothing else: the catalogue price
          is untouched. `priceOverride` stops a price-group switch or a restored
          cart from quietly snapping it back (stores/posCart).
        */}
        <div className="cl-price">
          <NumberField
            value={up}
            onChangeNumber={(v) =>
              onChange({
                ...line,
                // What was typed IS the selling price, so any markup that was
                // folded into it is cleared rather than multiplied on top.
                basePrice: Math.max(0, v),
                markupPct: 0,
                priceOverride: true,
              })
            }
            aria-label="Selling price"
            title={canPrice ? "Price for this sale only — the product's price does not change" : noRight}
            disabled={!canPrice}
            className="h-9 w-full px-2 text-right text-sm font-semibold text-success"
          />
        </div>

        <div className="cl-total min-w-0">
          <div className="text-sm font-bold tabular truncate">
            {formatBDT(lineTotal, { withSymbol: false })}
          </div>
          {savings > 0.004 && (
            <div className="text-xs text-success tabular truncate">
              −{formatBDT(savings, { withSymbol: false })}
            </div>
          )}
        </div>

        <div className="cl-act flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOpenOverride(!open)}
            title="Markup and discount"
            aria-label="Markup and discount"
            aria-expanded={open}
            className={cn(
              'size-8 grid place-items-center rounded-md border transition',
              hasAdjustments || open
                ? 'border-primary/60 text-primary bg-primary/10'
                : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <Percent className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="size-8 grid place-items-center rounded-md text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition"
            title="Remove"
            aria-label="Remove"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Markup / discount — one short row, labels beside the boxes. */}
      {open && (
        <div className="mt-2 ml-8 flex flex-wrap items-center gap-x-4 gap-y-2">
          <InlineNum
            label="Markup %"
            hint={canPrice ? 'Adds % to SPR for unit price' : noRight}
            value={line.markupPct}
            onChange={(v) => onChange({ ...line, markupPct: v })}
            disabled={!canPrice}
          />
          <InlineNum
            label="Discount %"
            hint={canDiscount ? 'Line discount as percent' : noRight}
            value={line.discountPct}
            onChange={(v) => onChange({ ...line, discountPct: v })}
            disabled={!canDiscount}
          />
          <InlineNum
            label="Discount ৳"
            hint={canDiscount ? 'Line discount as flat amount' : noRight}
            value={line.discountFlat}
            onChange={(v) => onChange({ ...line, discountFlat: v })}
            disabled={!canDiscount}
          />
        </div>
      )}
    </div>
  );
}

/**
 * "Buy ৳ 2,121.00" in the meta line. The short label is its own text node (so
 * the Bangla layer translates it); the full name is the tooltip.
 */
function MetaPrice({
  label,
  title,
  value,
  tone,
}: {
  label: string;
  title: string;
  value: number | null;
  tone: string;
}) {
  return (
    <span className="whitespace-nowrap" title={title}>
      <span>{label}</span>{' '}
      <span className={cn('tabular font-semibold', tone)}>
        {value === null ? '—' : `৳ ${formatBDT(value, { withSymbol: false })}`}
      </span>
    </span>
  );
}

function InlineNum({
  label,
  hint,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground" title={hint}>
      <span>{label}</span>
      <NumberField
        value={value}
        onChangeNumber={onChange}
        disabled={disabled}
        placeholder="0"
        className="h-8 w-20 px-2 text-right text-sm text-foreground"
      />
    </label>
  );
}
