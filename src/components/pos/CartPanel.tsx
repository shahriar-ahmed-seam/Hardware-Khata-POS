import { useEffect, useState } from 'react';
import {
  Plus,
  X,
  Trash2,
  Pause,
  ScanBarcode,
  User,
  ChevronDown,
  Truck,
  Receipt,
  Percent,
  ArrowLeftRight,
  ArrowRight,
  Tag,
  MoreHorizontal,
  PenSquare,
  FileText,
  ListChecks,
  SlidersHorizontal,
  Split,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Popover } from '@/components/ui/Popover';
import { NumberField } from '@/components/ui/NumberField';
import { cn, formatBDT } from '@/lib/utils';
import {
  type CartLine,
  type ParkedCart,
  type PriceGroup,
  computeTotals,
} from './types';
import { CartLineRow } from './CartLineRow';
import type { Customer } from '@/types/domain';
import { usePOS, type Orientation } from '@/stores/pos';
import type { PaymentMethod } from './PaymentModal';

interface Props {
  carts: ParkedCart[];
  activeId: string;
  setActiveId: (id: string) => void;
  setCart: (next: ParkedCart) => void;
  addCart: () => void;
  closeCart: (id: string) => void;
  clearCart: () => void;
  /** Customer source — live backend rows supplied by the POS screen. */
  customers?: Customer[];
  /** True while a sale/draft/quotation is being persisted — disables actions. */
  busy?: boolean;
  /**
   * Buying prices for a product, looked up from the live catalogue so each cart
   * line can show what the item cost us next to what it is selling for.
   * Returns nulls when the catalogue has not loaded — the row shows '—' rather
   * than a fabricated 0. Passed as a lookup instead of being copied onto
   * CartLine because carts are persisted to localStorage: a stored cost would go
   * stale the moment the owner records a new buying price.
   */
  costOf?: (productId: string) => { cost: number | null; avgCost: number | null };
  /**
   * Catalogue selling price for a product in the cart's CURRENT price group.
   * Only needed so a hand-typed price can be undone back to the list price; same
   * live-lookup reasoning as `costOf`.
   */
  listPriceOf?: (productId: string) => number | null;
  // Actions
  onPickCustomer: () => void;
  onPay: (startWith?: PaymentMethod) => void;
  onSplitPay: () => void;
  onSuspend: () => void;
  onShowHeld: () => void;
  onSaveAsDraft: () => void;
  onSaveAsQuotation: () => void;
}

export function CartPanel({
  carts,
  activeId,
  setActiveId,
  setCart,
  addCart,
  closeCart,
  clearCart,
  customers = [],
  busy = false,
  costOf,
  listPriceOf,
  onPickCustomer,
  onPay,
  onSplitPay,
  onSuspend,
  onShowHeld,
  onSaveAsDraft,
  onSaveAsQuotation,
}: Props) {
  const active = carts.find((c) => c.id === activeId)!;
  // Resolved against the live customer list only (seed fallback removed). May be
  // undefined while customers load or when the cart has no matching customer —
  // the strip then shows the walk-in label instead of a fabricated name.
  const customer = customers.find((c) => c.id === active.customerId) ?? customers[0];
  const totals = computeTotals(active);
  const swapOrientation = usePOS((s) => s.swapOrientation);
  const orientation = usePOS((s) => s.orientation);

  // Order-level charges sit behind one expander: an elderly cashier almost
  // never touches VAT/Ship/Other, and five inputs in a row clipped the panel.
  // Closed by default — EXCEPT when a value is non-zero, in which case it is
  // forced open (and badged) so an applied discount can never stay hidden.
  const hasOrderCharges =
    active.orderDiscountPct !== 0 ||
    active.orderDiscountFlat !== 0 ||
    active.orderTaxPct !== 0 ||
    active.shippingCharge !== 0 ||
    active.otherCharge !== 0;
  // null = follow hasOrderCharges · boolean = the cashier toggled it by hand.
  const [chargesOverride, setChargesOverride] = useState<boolean | null>(null);
  // Switching carts drops the manual override so the new cart is judged fresh.
  useEffect(() => {
    setChargesOverride(null);
  }, [activeId]);
  const chargesOpen = chargesOverride ?? hasOrderCharges;

  const updateLine = (i: number, next: CartLine) => {
    const lines = [...active.lines];
    lines[i] = next;
    setCart({ ...active, lines });
  };
  const removeLine = (i: number) => {
    const lines = active.lines.filter((_, idx) => idx !== i);
    setCart({ ...active, lines });
  };

  const overLimit =
    !!customer?.creditLimit && customer.due >= customer.creditLimit;

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-card/40 border-r border-border">
      {/* Cart tabs — ONLY the tab list scrolls sideways. The trailing controls
          live outside the scroller so they stay reachable with 5+ carts open
          (they used to scroll away with the tabs). Held / Clear / Swap moved
          into the ⋯ menu next to Pay, so just "new cart" stays pinned. */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card/60">
        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scroll-hide">
          {carts.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                'group flex items-center gap-2 px-2.5 h-8 max-w-[11rem] rounded-md text-xs font-medium transition shrink-0',
                activeId === c.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
              )}
            >
              <span className="truncate">{c.label}</span>
              {/* Item count only once there IS something in the cart — an empty
                  cart used to render a bare "0" next to its name. */}
              {c.lines.length > 0 && (
                <span className="text-2xs opacity-70 tabular shrink-0">{c.lines.length}</span>
              )}
              {carts.length > 1 && (
                <X
                  className="size-3.5 shrink-0 opacity-60 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeCart(c.id);
                  }}
                />
              )}
            </button>
          ))}
        </div>
        <button
          onClick={addCart}
          className="size-9 shrink-0 grid place-items-center rounded-md border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition"
          title="New cart (F10)"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* Customer + price group + scan strip */}
      <div className="px-3 py-2 border-b border-border grid grid-cols-1 md:grid-cols-3 gap-2 bg-card/60">
        {/* Customer */}
        <button
          onClick={onPickCustomer}
          className="flex items-center gap-2 min-w-0 px-2.5 h-10 rounded-md border border-border hover:border-primary hover:bg-secondary/40 transition text-left"
          title="Pick customer (F3)"
        >
          <User className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate">{customer?.name ?? 'Walk-in'}</div>
            {customer && (
              <div className="text-2xs text-muted-foreground truncate">
                {customer.phone} · {customer.group}
              </div>
            )}
          </div>
          {!!customer && customer.due > 0 && (
            <Badge
              variant={overLimit ? 'destructive' : 'warning'}
              className="shrink-0 max-w-[8rem] truncate"
            >
              Due {formatBDT(customer.due, { withSymbol: false })}
            </Badge>
          )}
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>

        {/* Price group selector */}
        <div className="flex items-center gap-0.5 p-0.5 min-w-0 bg-secondary rounded-md text-2xs h-10">
          {(['retail', 'wholesale', 'contractor'] as PriceGroup[]).map((g) => (
            <button
              key={g}
              onClick={() => setCart({ ...active, priceGroup: g })}
              className={cn(
                'flex-1 min-w-0 h-full rounded capitalize font-medium transition truncate px-1',
                active.priceGroup === g
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Scan placeholder */}
        <div className="flex items-center gap-2 min-w-0 px-2.5 h-10 rounded-md border border-dashed border-border text-muted-foreground text-2xs">
          <ScanBarcode className="size-4 shrink-0" />
          <span className="truncate">Scanner ready · or press F2 to search</span>
        </div>
      </div>

      {/* Cart lines */}
      <div className="flex-1 overflow-auto scroll-hide min-h-0 py-1">
        {active.lines.length === 0 ? (
          <div className="h-full grid place-items-center text-center p-6 text-muted-foreground">
            <div>
              <ScanBarcode className="size-12 mx-auto opacity-30" />
              <div className="mt-3 text-sm">Scan or pick a product to start</div>
              <div className="text-2xs mt-1">Press F2 to focus search</div>
            </div>
          </div>
        ) : (
          active.lines.map((l, i) => {
            const prices = costOf?.(l.productId);
            return (
              <CartLineRow
                key={l.productId + i}
                index={i}
                line={l}
                cost={prices?.cost ?? null}
                avgCost={prices?.avgCost ?? null}
                listPrice={listPriceOf?.(l.productId) ?? null}
                onChange={(n) => updateLine(i, n)}
                onRemove={() => removeLine(i)}
              />
            );
          })
        )}
      </div>

      {/* Footer: totals & charges */}
      <div className="shadow-soft-top bg-card relative z-10">
        {/* `container-type: inline-size` makes this footer the measuring box for
            the action bar below: its buttons drop their labels (icons stay) on
            the PANEL's width, not the window's — the splitter can make this
            panel narrow while the window is wide. */}
        <div className="p-3 space-y-2.5 [container-type:inline-size]">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground shrink-0">Subtotal</span>
            <span className="font-mono tabular min-w-0 truncate">{formatBDT(totals.subtotal)}</span>
          </div>
          {totals.totalLineDiscount > 0 && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground shrink-0">Line Discounts</span>
              <span className="font-mono tabular text-success min-w-0 truncate">
                − {formatBDT(totals.totalLineDiscount)}
              </span>
            </div>
          )}

          {/* Discounts & charges — one expander instead of five always-on
              inputs. Badged + forced open whenever a value is set. */}
          <div className="pt-1">
            <button
              onClick={() => setChargesOverride(!chargesOpen)}
              className="w-full h-11 flex items-center gap-2 px-2.5 rounded-md border border-border bg-card hover:bg-secondary hover:border-primary/50 transition text-sm font-medium"
              title="Discounts & charges"
            >
              <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Discounts &amp; charges</span>
              {hasOrderCharges && (
                <Badge variant="warning" className="shrink-0">
                  Applied
                </Badge>
              )}
              <span className="flex-1" />
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform',
                  chargesOpen && 'rotate-180',
                )}
              />
            </button>

            {chargesOpen && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <ChargeInput
                  icon={Percent}
                  label="Disc %"
                  value={active.orderDiscountPct}
                  onChange={(v) => setCart({ ...active, orderDiscountPct: v })}
                />
                <ChargeInput
                  icon={Tag}
                  label="Disc ৳"
                  value={active.orderDiscountFlat}
                  onChange={(v) => setCart({ ...active, orderDiscountFlat: v })}
                />
                <ChargeInput
                  icon={Receipt}
                  label="VAT %"
                  value={active.orderTaxPct}
                  onChange={(v) => setCart({ ...active, orderTaxPct: v })}
                />
                <ChargeInput
                  icon={Truck}
                  label="Ship ৳"
                  value={active.shippingCharge}
                  onChange={(v) => setCart({ ...active, shippingCharge: v })}
                />
                <ChargeInput
                  icon={Plus}
                  label="Other ৳"
                  value={active.otherCharge}
                  onChange={(v) => setCart({ ...active, otherCharge: v })}
                />
              </div>
            )}
          </div>

          {(totals.orderDiscount > 0 || totals.tax > 0 || totals.shipping > 0 || totals.other > 0) && (
            <div className="border-t border-border/60 pt-2 space-y-1 text-xs">
              {totals.orderDiscount > 0 && (
                <Row
                  label="Order Discount"
                  value={`− ${formatBDT(totals.orderDiscount)}`}
                  tone="success"
                />
              )}
              {totals.tax > 0 && (
                <Row label={`VAT (${active.orderTaxPct}%)`} value={formatBDT(totals.tax)} />
              )}
              {totals.shipping > 0 && <Row label="Shipping" value={formatBDT(totals.shipping)} />}
              {totals.other > 0 && <Row label="Other" value={formatBDT(totals.other)} />}
            </div>
          )}

          {/* Total stays the loudest number in the panel, but a 7-figure total
              no longer breaks the box: the label can't shrink, the amount can,
              and it truncates instead of overflowing. */}
          <div className="rounded-lg border border-border bg-gradient-to-br from-primary/5 to-primary/10 px-3.5 py-2.5 flex items-center justify-between gap-2 edge-top">
            <span className="text-sm font-semibold tracking-tight shrink-0">Total Payable</span>
            <span className="font-mono tabular text-xl [@container_(min-width:340px)]:text-2xl leading-none font-bold text-primary tracking-tight min-w-0 truncate text-right">
              <span className="font-bold mr-0.5">৳</span>
              {formatBDT(totals.total, { withSymbol: false })}
            </span>
          </div>

          {/* The six payment-method tiles that used to sit here were removed:
              the payment modal always opens on its own method picker, so they
              made the cashier choose a method twice for no benefit. One Pay
              button (F8) now opens the picker once. */}

          {/* Bottom action bar — flexbox, not grid fractions. Twelfths gave the
              ⋯ button ~40px (icon clipped) and squeezed "Multi-Pay" below its
              label, because a grid track cannot refuse to shrink. Now: Pay
              grows and is taller, the compact buttons are shrink-0 with a real
              min-width, and ⋯ is a fixed 44px. Below ~400px of panel width the
              two compact buttons drop their labels and keep their icons, so the
              row never clips. */}
          <div className="flex items-end gap-2 pt-1">
            <CompactBtn icon={Pause} label="Suspend" title="Suspend (F9)" onClick={onSuspend} />
            <CompactBtn
              icon={Split}
              label="Multi-Pay"
              title="Multi-Pay — split across methods"
              onClick={onSplitPay}
              disabled={busy}
            />
            <MoreActions
              onSaveAsDraft={onSaveAsDraft}
              onSaveAsQuotation={onSaveAsQuotation}
              onShowHeld={onShowHeld}
              onClearCart={clearCart}
              onSwapOrientation={swapOrientation}
              orientation={orientation}
              disabled={busy}
            />
            <PrimaryCTA onClick={() => onPay('Cash')} disabled={busy} />
          </div>
        </div>
      </div>
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
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground min-w-0 truncate">{label}</span>
      <span
        className={cn(
          'font-mono tabular shrink-0',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ChargeInput({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: any;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-2xs font-semibold uppercase text-muted-foreground tracking-[0.06em] inline-flex items-center gap-1 leading-none min-w-0">
        <Icon className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </label>
      <NumberField
        value={value}
        onChangeNumber={onChange}
        placeholder="0.00"
        className="h-11 px-2 text-right text-sm"
      />
    </div>
  );
}

/**
 * Compact action next to Pay. `shrink-0` + a min-width wide enough for the
 * label means it can never be squeezed under its own text; below ~400px of
 * panel width the label is dropped and the button becomes a 44px icon square
 * (tooltip keeps the meaning) instead of clipping the row.
 */
function CompactBtn({
  icon: Icon,
  label,
  onClick,
  title,
  disabled,
}: {
  icon: any;
  label: string;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-11 shrink-0 min-w-11 px-2 rounded-md border border-border bg-card',
        'hover:bg-secondary hover:border-primary/50 text-xs font-medium whitespace-nowrap',
        'transition edge-top inline-flex items-center justify-center gap-1.5',
        'disabled:opacity-50 disabled:pointer-events-none',
        '[@container_(min-width:400px)]:min-w-[104px]',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="hidden [@container_(min-width:400px)]:inline">{label}</span>
    </button>
  );
}

/**
 * The ⋯ menu is now the single home for the low-frequency cart actions that
 * used to crowd the tab strip (Held / Clear / Swap) next to Draft & Quotation.
 * Fixed 44px trigger, and the panel opens UPWARD (`bottom-full`) because the
 * trigger sits at the very bottom of the screen.
 */
function MoreActions({
  onSaveAsDraft,
  onSaveAsQuotation,
  onShowHeld,
  onClearCart,
  onSwapOrientation,
  orientation,
  disabled,
}: {
  onSaveAsDraft: () => void;
  onSaveAsQuotation: () => void;
  onShowHeld: () => void;
  onClearCart: () => void;
  onSwapOrientation: () => void;
  orientation: Orientation;
  disabled?: boolean;
}) {
  return (
    // The wrapper keeps the Popover's inline-block root out of the flex shrink
    // maths, so the trigger stays exactly 44px wide.
    <div className="shrink-0">
      <Popover
        width="w-64"
        align="right"
        // Opens upward: the trigger is pinned to the bottom edge of the screen.
        className="bottom-full mb-2 mt-0"
        trigger={(_o, set) => (
          <button
            onClick={() => set(true)}
            disabled={disabled}
            className={cn(
              'h-11 w-11 shrink-0 rounded-md border border-border bg-card hover:bg-secondary hover:border-primary/50',
              'font-medium transition edge-top inline-flex items-center justify-center',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
            title="More actions"
          >
            <MoreHorizontal className="size-5" />
          </button>
        )}
      >
        {(close) => (
          <div className="py-1">
            <MenuRow
              icon={ListChecks}
              label="Held carts"
              hint="F5"
              onClick={() => {
                close();
                onShowHeld();
              }}
            />
            <MenuRow
              icon={PenSquare}
              label="Save as Draft"
              hint="F6"
              onClick={() => {
                close();
                onSaveAsDraft();
              }}
            />
            <MenuRow
              icon={FileText}
              label="Save as Quotation"
              hint="F7"
              onClick={() => {
                close();
                onSaveAsQuotation();
              }}
            />
            <div className="my-1 border-t border-border" />
            <MenuRow
              icon={ArrowLeftRight}
              label="Swap panel side"
              title={orientation === 'cart-left' ? 'Move cart to right' : 'Move cart to left'}
              onClick={() => {
                close();
                onSwapOrientation();
              }}
            />
            <MenuRow
              icon={Trash2}
              label="Clear cart"
              tone="destructive"
              onClick={() => {
                close();
                onClearCart();
              }}
            />
          </div>
        )}
      </Popover>
    </div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  hint,
  title,
  tone,
  onClick,
}: {
  icon: any;
  label: string;
  hint?: string;
  title?: string;
  tone?: 'destructive';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary text-sm text-left transition',
        tone === 'destructive' && 'text-destructive hover:bg-destructive/10',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
      {hint && <kbd className="ml-auto shrink-0 font-mono text-2xs opacity-60">{hint}</kbd>}
    </button>
  );
}

/**
 * Pay is deliberately the loudest control in the panel: it grows to fill the
 * row (~half of it), and it is TALLER (h-14) than its h-11 neighbours so an
 * elderly cashier cannot miss it.
 */
function PrimaryCTA({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative h-14 flex-1 basis-1/2 min-w-0 rounded-lg',
        'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground text-base font-bold',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_-4px_hsl(var(--primary)/0.55)]',
        'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_6px_20px_-4px_hsl(var(--primary)/0.7)]',
        'transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
        'disabled:opacity-50 disabled:pointer-events-none',
      )}
      title="Pay (F8)"
    >
      Pay <span className="opacity-70 text-2xs font-mono ml-0.5">F8</span>
      <ArrowRight className="size-4 ml-0.5 shrink-0" />
    </button>
  );
}
