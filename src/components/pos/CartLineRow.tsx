import { useState } from 'react';
import { Minus, Plus, Trash2, Package, Percent, ChevronDown } from 'lucide-react';
import { cn, formatBDT } from '@/lib/utils';
import { type CartLine, lineSubtotal, unitPrice } from './types';
import { useUnits } from '@/hooks/useCatalog';
import { Badge } from '@/components/ui/Badge';
import { NumberField } from '@/components/ui/NumberField';

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
}

const FIELD_H = 'h-11'; // Uniform height for every input/select/button in the row

export function CartLineRow({
  line,
  index,
  onChange,
  onRemove,
  cost = null,
  avgCost = null,
  listPrice = null,
}: Props) {
  // Unit labels come from the backend units catalog (cached by react-query, so
  // every row shares one fetch). The seed-data fallback was removed; until the
  // catalog resolves we display the unit code stored on the cart line.
  const unitsQuery = useUnits();
  const unitName =
    (unitsQuery.data ?? []).find((u) => u.short === line.unit)?.short ?? line.unit;
  const lineTotal = lineSubtotal(line);
  const up = unitPrice(line);
  const grossBeforeDisc = up * line.qty;
  const savings = grossBeforeDisc - lineTotal;

  // Five numeric fields per line was too much to read and clipped on a narrow
  // panel. Quantity + Unit stay out front; markup and the two discount fields
  // hide behind a per-line toggle. Anything already applied is badged on the
  // collapsed row (and opens the drawer by default) so a discount can never be
  // left on the sale unseen.
  const hasMarkup = line.markupPct !== 0;
  const hasDiscount = line.discountPct !== 0 || line.discountFlat !== 0;
  const hasAdjustments = hasMarkup || hasDiscount;
  // null = follow hasAdjustments · boolean = the cashier toggled it by hand.
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? hasAdjustments;

  return (
    // The card is its own measuring box: the fields below react to the PANEL
    // width (the splitter can narrow it while the window stays wide).
    <div className="mx-2 my-1.5 rounded-lg border border-border/60 bg-card edge-top hover:border-border transition px-3 py-2.5 [container-type:inline-size]">
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <div className="relative shrink-0">
          <div className="size-12 rounded-lg bg-gradient-to-br from-secondary to-muted grid place-items-center text-muted-foreground/60 ring-1 ring-border/60">
            <Package className="size-5" />
          </div>
          <span className="absolute -top-1.5 -left-1.5 size-4 rounded-full bg-primary text-primary-foreground text-2xs font-bold grid place-items-center ring-2 ring-card">
            {index + 1}
          </span>
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight tracking-tight truncate">
            {line.name}
          </div>
          <div className="flex items-center gap-2 text-2xs text-muted-foreground font-mono mt-0.5 min-w-0">
            <span className="truncate">{line.sku}</span>
            <span className="opacity-50 shrink-0">·</span>
            <span className="tabular shrink-0">SPR ৳ {line.basePrice.toFixed(2)}</span>
          </div>
          {/* Applied markup / discount is visible even while the drawer is shut */}
          {hasAdjustments && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {hasMarkup && (
                <Badge variant="info" className="shrink-0">
                  Markup
                  <span className="font-mono tabular">{line.markupPct}%</span>
                </Badge>
              )}
              {hasDiscount && (
                <Badge variant="success" className="shrink-0">
                  Discount
                  {line.discountPct !== 0 && (
                    <span className="font-mono tabular">{line.discountPct}%</span>
                  )}
                  {line.discountFlat !== 0 && (
                    <span className="font-mono tabular">
                      ৳ {formatBDT(line.discountFlat, { withSymbol: false })}
                    </span>
                  )}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Line total + remove */}
        <div className="text-right shrink-0 max-w-[45%] min-w-0">
          <div className="font-mono font-medium text-sm tabular text-foreground/90 truncate">
            {formatBDT(lineTotal, { withSymbol: false })}
          </div>
          {savings > 0 && (
            <div className="text-2xs text-success font-mono tabular -mt-0.5 truncate">
              −{formatBDT(savings, { withSymbol: false })}
            </div>
          )}
          <button
            onClick={onRemove}
            className="mt-1 size-8 grid place-items-center rounded text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition ml-auto"
            title="Remove"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Always-visible fields: quantity (big steppers) + unit, plus the toggle
          for the rarely-used markup/discount fields. `flex-wrap` is the safety
          valve — on an extremely narrow panel the toggle drops to its own line
          instead of clipping. */}
      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <FieldBox label="Quantity" className="flex-1 basis-[8rem] min-w-0">
          <div className={cn('flex items-center bg-secondary rounded-md min-w-0', FIELD_H)}>
            <button
              onClick={() => onChange({ ...line, qty: Math.max(0, line.qty - 1) })}
              className={cn(FIELD_H, 'aspect-square shrink-0 grid place-items-center hover:bg-background rounded-l-md')}
              title="Decrease"
            >
              <Minus className="size-4" />
            </button>
            <input
              value={line.qty}
              onChange={(e) => onChange({ ...line, qty: Number(e.target.value) || 0 })}
              className="w-full min-w-0 bg-transparent text-center text-sm font-mono font-semibold tabular outline-none"
            />
            <button
              onClick={() => onChange({ ...line, qty: line.qty + 1 })}
              className={cn(FIELD_H, 'aspect-square shrink-0 grid place-items-center hover:bg-background rounded-r-md')}
              title="Increase"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </FieldBox>

        <FieldBox label="Unit" className="w-20 shrink-0 [@container_(min-width:340px)]:w-28">
          <select
            value={line.unit}
            onChange={(e) => onChange({ ...line, unit: e.target.value })}
            className={cn(
              'w-full min-w-0 truncate rounded-md border border-input bg-background text-sm px-1.5 outline-none focus:ring-2 focus:ring-ring/50',
              FIELD_H,
            )}
          >
            {line.availableUnits.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </FieldBox>

        <button
          onClick={() => setOpenOverride(!open)}
          title="Markup and discount"
          className={cn(
            FIELD_H,
            'shrink-0 min-w-11 px-2 rounded-md border bg-card hover:bg-secondary transition',
            'text-xs font-medium whitespace-nowrap inline-flex items-center justify-center gap-1.5',
            hasAdjustments ? 'border-primary/60 text-primary' : 'border-border',
            '[@container_(min-width:340px)]:min-w-[104px]',
          )}
        >
          <Percent className="size-4 shrink-0" />
          <span className="hidden [@container_(min-width:340px)]:inline">Discount</span>
          <ChevronDown
            className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>
      </div>

      {/* Drawer: the three fields an elderly cashier rarely needs */}
      {open && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <FieldBox label="Markup %" hint="Adds % to SPR for unit price">
            <NumInput
              value={line.markupPct}
              onChange={(v) => onChange({ ...line, markupPct: v })}
              placeholder="0"
            />
          </FieldBox>

          <FieldBox label="Disc %" hint="Line discount as percent">
            <NumInput
              value={line.discountPct}
              onChange={(v) => onChange({ ...line, discountPct: v })}
              placeholder="0"
            />
          </FieldBox>

          <FieldBox label="Disc ৳" hint="Line discount as flat amount">
            <NumInput
              value={line.discountFlat}
              onChange={(v) => onChange({ ...line, discountFlat: v })}
              placeholder="0"
            />
          </FieldBox>
        </div>
      )}

      {/* WHAT THIS ITEM COSTS US vs WHAT WE ARE SELLING IT FOR.
          The shopkeeper bargains at the counter, so the two buying prices have
          to be readable at a glance while the sale is still open — after the
          receipt prints it is too late. Colour carries the meaning for someone
          who is not going to read three labels every time:
            amber  = money that went out (what we paid)
            blue   = the average we have paid over time (the honest benchmark)
            green  = money coming in (what this line sells for)
          `avgCost` is the simple mean of recorded buying prices, NOT the
          qty-weighted cost that drives COGS — two different figures that must
          not be conflated (see backend/services/costing.ts). */}
      <div className="mt-2 grid grid-cols-3 gap-2 rounded-md bg-secondary/40 px-2 py-1.5">
        <PriceCell label="Buying price" value={cost} tone="text-warning" />
        <PriceCell label="Avg. buying price" value={avgCost} tone="text-primary" />
        {/*
          SELLING PRICE IS EDITABLE — for THIS SALE ONLY.
          A hardware counter bargains ("240 each if I take twenty"), and until now
          the cashier's only options were a discount percentage or walking away
          from the sale. Typing here sets the price on this cart line and nothing
          else: the product's catalogue price is untouched, so tomorrow's customer
          still sees the list price. `priceOverride` is what stops a price-group
          switch or a restored cart from quietly snapping it back (stores/posCart).
        */}
        <div className="min-w-0">
          <div className="text-2xs text-muted-foreground leading-none truncate">
            Selling price
          </div>
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
            title="Price for this sale only — the product's price does not change"
            className="mt-0.5 h-7 w-full px-1.5 text-right text-xs font-bold text-success"
          />
        </div>
      </div>

      {line.priceOverride && (
        <div className="mt-1.5 flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1 text-2xs text-primary">
          <span className="flex-1 min-w-0 truncate">
            Price changed for this sale only — the product's price is unchanged.
          </span>
          {listPrice !== null && (
            <button
              onClick={() =>
                onChange({ ...line, basePrice: listPrice, markupPct: 0, priceOverride: false })
              }
              className="shrink-0 font-semibold underline hover:no-underline"
              title={`Put it back to the catalogue price (৳ ${listPrice.toFixed(2)})`}
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Computed strip */}
      <div className="mt-2 flex items-center justify-between gap-2 text-2xs text-muted-foreground font-mono tabular">
        <span className="min-w-0 truncate">
          ৳ {up.toFixed(2)} × {line.qty} {unitName}
        </span>
        {(line.discountPct > 0 || line.discountFlat > 0) && (
          <span className="text-success shrink-0">
            saved {formatBDT(savings, { withSymbol: false })}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * One labelled money figure in the buy/avg/sell strip.
 *
 * `label` arrives as a whole phrase and is the ONLY child of its element, so the
 * rendered text node is exactly that phrase — which is what the Bangla layer
 * matches on (src/lib/bn/translate.ts). Never build the label from fragments.
 */
function PriceCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: string;
}) {
  return (
    <div className="min-w-0" title={label}>
      <div className="text-2xs text-muted-foreground leading-none truncate">{label}</div>
      <div className={cn('mt-1 font-mono tabular text-xs font-bold truncate', tone)}>
        {value === null ? '—' : `৳ ${formatBDT(value, { withSymbol: false })}`}
      </div>
    </div>
  );
}

function FieldBox({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1 min-w-0', className)} title={hint}>
      <label className="text-2xs font-semibold uppercase text-muted-foreground tracking-[0.06em] leading-none truncate">
        {label}
      </label>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  return (
    <NumberField
      value={value}
      onChangeNumber={onChange}
      placeholder={placeholder}
      className={cn('text-right text-sm px-2', FIELD_H)}
    />
  );
}
