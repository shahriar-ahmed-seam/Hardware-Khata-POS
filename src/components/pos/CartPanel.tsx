import { forwardRef, useEffect, useRef, useState } from 'react';
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
  Printer,
  Keyboard,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Popover } from '@/components/ui/Popover';
import { NumberField } from '@/components/ui/NumberField';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCan } from '@/hooks/useCan';
import { cn, formatBDT } from '@/lib/utils';
import { labelFor } from '@/lib/labels';
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
import { keyLabel, usePosKeys } from './shortcuts';

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
   * Buying prices for a product, looked up from the live catalogue (never
   * copied onto the persisted cart line, where they would go stale).
   */
  costOf?: (productId: string) => { cost: number | null; avgCost: number | null };
  /** Catalogue price in the cart's CURRENT group, for "Undo" on a typed price. */
  listPriceOf?: (productId: string) => number | null;
  /** The product last scanned or tapped; its line scrolls into view and flashes. */
  touched?: { cartId: string; productId: string; n: number } | null;
  /** Bumped by the order-discount key: opens the charges and focuses Discount %. */
  discountSignal?: number;
  // Actions
  onPickCustomer: () => void;
  onPay: (startWith?: PaymentMethod) => void;
  onSplitPay: () => void;
  onSuspend: () => void;
  onShowHeld: () => void;
  onSaveAsDraft: () => void;
  onSaveAsQuotation: () => void;
  /** Opens the list of keyboard keys. */
  onShowKeys?: () => void;
  /** How many carts are held. Shown on the tab strip so none is forgotten. */
  heldCount?: number;
  /** Re-print the last receipt; undefined when there is none (or no right). */
  onReprintLast?: () => void;
}

const GROUPS: PriceGroup[] = ['retail', 'wholesale', 'contractor'];

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
  touched = null,
  discountSignal = 0,
  onPickCustomer,
  onPay,
  onSplitPay,
  onSuspend,
  onShowHeld,
  onSaveAsDraft,
  onSaveAsQuotation,
  onShowKeys,
  heldCount = 0,
  onReprintLast,
}: Props) {
  const active = carts.find((c) => c.id === activeId)!;
  // Live list only. While it loads (or the id is missing) say Walk-in, never
  // somebody else's name.
  const customer = customers.find((c) => c.id === active.customerId);
  const totals = computeTotals(active);
  const swapOrientation = usePOS((s) => s.swapOrientation);
  const orientation = usePOS((s) => s.orientation);
  const keys = usePosKeys();
  const empty = active.lines.length === 0;

  // Order-level charges sit behind one expander, forced open (and badged)
  // whenever a value is set so an applied discount can never stay hidden.
  const hasOrderCharges =
    active.orderDiscountPct !== 0 ||
    active.orderDiscountFlat !== 0 ||
    active.orderTaxPct !== 0 ||
    active.shippingCharge !== 0 ||
    active.otherCharge !== 0;
  // null = follow hasOrderCharges · boolean = the cashier toggled it by hand.
  const [chargesOverride, setChargesOverride] = useState<boolean | null>(null);
  useEffect(() => {
    setChargesOverride(null);
  }, [activeId]);
  const chargesOpen = chargesOverride ?? hasOrderCharges;
  // An order discount needs the discount right, checked again on save.
  const canDiscount = useCan('pos.discount');

  // Order-discount key (F4 by default): open the charges, caret in Discount %.
  const discountRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!discountSignal) return;
    setChargesOverride(true);
    const id = requestAnimationFrame(() => {
      discountRef.current?.focus();
      discountRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [discountSignal]);

  const updateLine = (i: number, next: CartLine) => {
    const lines = [...active.lines];
    lines[i] = next;
    setCart({ ...active, lines });
  };
  const removeLine = (i: number) => {
    const lines = active.lines.filter((_, idx) => idx !== i);
    setCart({ ...active, lines });
  };

  const overLimit = !!customer?.creditLimit && customer.due >= customer.creditLimit;
  const hasAdjustments = totals.total !== totals.subtotal;

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-card/40 border-r border-border">
      {/* Cart tabs — only the tab list scrolls sideways; held / keys / new cart
          stay pinned on the right. */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-card/60">
        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scroll-hide">
          {carts.map((c, i) => {
            const on = activeId === c.id;
            return (
              <div
                key={c.id}
                className={cn(
                  'group flex items-center h-9 max-w-[11rem] rounded-md text-sm font-medium transition shrink-0',
                  on
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
                )}
              >
                <button
                  onClick={() => setActiveId(c.id)}
                  className="h-full flex items-center gap-1.5 pl-3 pr-2 min-w-0 rounded-md focus-ring"
                  aria-pressed={on}
                >
                  {/* "Cart" and the number are separate nodes so Bangla translates the word. */}
                  <span className="truncate">Cart</span>
                  <span className="tabular">{i + 1}</span>
                  {c.lines.length > 0 && (
                    <span className="text-xs opacity-75 tabular shrink-0 rounded bg-black/10 px-1">
                      {c.lines.length}
                    </span>
                  )}
                </button>
                {carts.length > 1 && (
                  // Shown on the open or hovered tab only, so a stray click on
                  // another tab never lands on its X.
                  <button
                    onClick={() => closeCart(c.id)}
                    aria-label="Close cart"
                    title="Close cart"
                    className={cn(
                      'size-6 mr-1 shrink-0 grid place-items-center rounded hover:bg-black/15 focus-ring',
                      on ? 'opacity-90' : 'opacity-0 group-hover:opacity-80 focus-visible:opacity-100',
                    )}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {/* Held carts are money waiting to come back; the count stays in sight. */}
        {heldCount > 0 && (
          <button
            onClick={onShowHeld}
            className="h-9 shrink-0 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-warning/50 bg-warning/10 text-warning hover:bg-warning/20 text-sm font-semibold transition"
            title={`Held carts (${keyLabel(keys.heldCarts)})`}
          >
            <Pause className="size-4 shrink-0" />
            <span>Held</span>
            <span className="tabular">{heldCount}</span>
          </button>
        )}
        {onShowKeys && (
          <button
            onClick={onShowKeys}
            className="h-9 shrink-0 px-2 inline-flex items-center gap-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary text-sm transition"
            title="Keyboard keys"
          >
            <Keyboard className="size-4 shrink-0" />
            <kbd className="text-xs">{keyLabel(keys.showHelp)}</kbd>
          </button>
        )}
        <button
          onClick={addCart}
          className="h-9 shrink-0 px-2 inline-flex items-center gap-1 rounded-md border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition"
          title={`New cart (${keyLabel(keys.newCart)})`}
          aria-label="New cart"
        >
          <Plus className="size-4" />
          <kbd className="text-xs">{keyLabel(keys.newCart)}</kbd>
        </button>
      </div>

      {/* Customer + price group. The customer name gets the width. */}
      <div className="px-3 py-2 border-b border-border grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-2 bg-card/60">
        <button
          onClick={onPickCustomer}
          className="flex items-center gap-2 min-w-0 px-2.5 h-10 rounded-md border border-border hover:border-primary hover:bg-secondary/40 transition text-left"
          title={`Choose customer (${keyLabel(keys.customer)})`}
        >
          <User className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-sm font-semibold truncate">{customer?.name ?? 'Walk-in customer'}</div>
            {customer?.phone && customer.phone !== '-' && (
              <div className="text-xs text-muted-foreground truncate tabular">{customer.phone}</div>
            )}
          </div>
          {!!customer && customer.due > 0 && (
            <Badge
              variant={overLimit ? 'destructive' : 'warning'}
              className="shrink-0 max-w-[8rem] truncate"
            >
              <span>Due</span> <span className="tabular">{formatBDT(customer.due, { withSymbol: false })}</span>
            </Badge>
          )}
          <kbd className="text-xs text-muted-foreground shrink-0">{keyLabel(keys.customer)}</kbd>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>

        <Segmented
          ariaLabel="Price group"
          value={active.priceGroup}
          onChange={(g) => setCart({ ...active, priceGroup: g })}
          options={GROUPS.map((g) => ({ value: g, label: labelFor('priceGroup', g) }))}
        />
      </div>

      {/* Cart lines. The list is the measuring box for the line layout
          (.cart-line in globals.css); the scrollbar stays visible. */}
      <div className="flex-1 overflow-auto min-h-0 pb-1 [container-type:inline-size]">
        {!empty && (
          // Column labels once, above the list (one-row layout only). Sticky.
          <div
            className="cart-line-head sticky top-0 z-[1] mx-2 px-2.5 py-1.5 border border-transparent bg-background text-xs font-medium text-muted-foreground"
            aria-hidden
          >
            <span className="[grid-area:num]">#</span>
            <span className="[grid-area:name]">Item</span>
            <span className="[grid-area:qty]">Qty</span>
            <span className="[grid-area:price] text-right pr-2">Price</span>
            <span className="[grid-area:total] text-right">Total</span>
          </div>
        )}
        {empty ? (
          <div className="h-full grid place-items-center p-6">
            <EmptyState
              compact
              icon={ScanBarcode}
              title="The cart is empty"
              message="Scan a barcode or click a product to add it."
            />
          </div>
        ) : (
          active.lines.map((l, i) => {
            const prices = costOf?.(l.productId);
            return (
              <CartLineRow
                key={l.productId + i}
                index={i}
                line={l}
                flash={
                  touched?.cartId === active.id && touched.productId === l.productId ? touched.n : 0
                }
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

      {/* Footer: totals & charges. `container-type` lets the action bar drop
          its labels on the PANEL's width, not the window's. */}
      <div className="shadow-soft-top bg-card relative z-10">
        <div className="p-3 space-y-2.5 [container-type:inline-size]">
          {/* Subtotal only when something changes it — otherwise it repeats Total. */}
          {hasAdjustments && (
            <Row label="Subtotal" value={formatBDT(totals.subtotal)} />
          )}
          {totals.totalLineDiscount > 0 && (
            <Row label="Line discounts" value={`− ${formatBDT(totals.totalLineDiscount)}`} tone="success" />
          )}

          <div>
            <button
              onClick={() => setChargesOverride(!chargesOpen)}
              className="w-full h-10 flex items-center gap-2 px-2.5 rounded-md border border-border bg-card hover:bg-secondary hover:border-primary/50 transition text-sm font-medium"
              aria-expanded={chargesOpen}
            >
              <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Discounts &amp; charges</span>
              {hasOrderCharges && (
                <Badge variant="warning" className="shrink-0">
                  Applied
                </Badge>
              )}
              <span className="flex-1" />
              <kbd className="text-xs text-muted-foreground shrink-0">{keyLabel(keys.orderDiscount)}</kbd>
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform',
                  chargesOpen && 'rotate-180',
                )}
              />
            </button>

            {chargesOpen && (
              <div className="grid grid-cols-2 [@container_(min-width:420px)]:grid-cols-3 gap-2 pt-2">
                <ChargeInput
                  ref={discountRef}
                  icon={Percent}
                  label="Discount %"
                  value={active.orderDiscountPct}
                  onChange={(v) => setCart({ ...active, orderDiscountPct: v })}
                  disabled={!canDiscount}
                />
                <ChargeInput
                  icon={Tag}
                  label="Discount ৳"
                  value={active.orderDiscountFlat}
                  onChange={(v) => setCart({ ...active, orderDiscountFlat: v })}
                  disabled={!canDiscount}
                />
                <ChargeInput
                  icon={Receipt}
                  label="VAT %"
                  value={active.orderTaxPct}
                  onChange={(v) => setCart({ ...active, orderTaxPct: v })}
                />
                <ChargeInput
                  icon={Truck}
                  label="Delivery ৳"
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
            <div className="border-t border-border/60 pt-2 space-y-1">
              {totals.orderDiscount > 0 && (
                <Row label="Order discount" value={`− ${formatBDT(totals.orderDiscount)}`} tone="success" />
              )}
              {totals.tax > 0 && <Row label="VAT" value={formatBDT(totals.tax)} />}
              {totals.shipping > 0 && <Row label="Delivery" value={formatBDT(totals.shipping)} />}
              {totals.other > 0 && <Row label="Other" value={formatBDT(totals.other)} />}
            </div>
          )}

          {/* Total stays the loudest number; a 7-figure total truncates. */}
          <div className="rounded-lg border border-border bg-gradient-to-br from-primary/5 to-primary/10 px-3.5 py-2.5 flex items-center justify-between gap-2 edge-top">
            <span className="text-base font-semibold tracking-tight shrink-0">Total</span>
            <span className="tabular text-xl [@container_(min-width:340px)]:text-2xl leading-none font-bold text-primary tracking-tight min-w-0 truncate text-right">
              {formatBDT(totals.total)}
            </span>
          </div>

          {/* Bottom action bar. Pay grows and is taller; compact buttons drop
              their labels below ~400px of panel width. Empty cart → disabled. */}
          <div className="flex items-end gap-2 pt-1">
            <CompactBtn
              icon={Pause}
              label="Hold"
              kbd={keyLabel(keys.hold)}
              title={empty ? 'Add an item first' : `Hold this cart (${keyLabel(keys.hold)})`}
              onClick={onSuspend}
              disabled={busy || empty}
            />
            <CompactBtn
              icon={Split}
              label="Split pay"
              title={empty ? 'Add an item first' : 'Split the payment across methods'}
              onClick={onSplitPay}
              disabled={busy || empty}
            />
            <MoreActions
              keys={keys}
              onSaveAsDraft={onSaveAsDraft}
              onSaveAsQuotation={onSaveAsQuotation}
              onShowHeld={onShowHeld}
              onClearCart={clearCart}
              onReprintLast={onReprintLast}
              onSwapOrientation={swapOrientation}
              orientation={orientation}
              disabled={busy}
              empty={empty}
            />
            <PrimaryCTA
              onClick={() => onPay()}
              disabled={busy || empty}
              kbd={keyLabel(keys.pay)}
              title={empty ? 'Add an item first' : undefined}
            />
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
          'tabular shrink-0',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )}
      >
        {value}
      </span>
    </div>
  );
}

const ChargeInput = forwardRef<
  HTMLInputElement,
  {
    icon: any;
    label: string;
    value: number;
    onChange: (v: number) => void;
    disabled?: boolean;
  }
>(({ icon: Icon, label, value, onChange, disabled = false }, ref) => (
  <label className="flex flex-col gap-1 min-w-0">
    <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1 leading-none min-w-0">
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
    <NumberField
      ref={ref}
      value={value}
      onChangeNumber={onChange}
      disabled={disabled}
      title={disabled ? 'You do not have the right to change this. Ask the owner or a manager.' : undefined}
      placeholder="0.00"
      className="h-10 px-2 text-right text-sm"
    />
  </label>
));
ChargeInput.displayName = 'ChargeInput';

/**
 * Compact action next to Pay: never squeezed under its own text; below ~400px
 * of panel width it becomes a 44px icon square (the tooltip keeps the meaning).
 */
function CompactBtn({
  icon: Icon,
  label,
  kbd,
  onClick,
  title,
  disabled,
}: {
  icon: any;
  label: string;
  kbd?: string;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      className={cn(
        'h-11 shrink-0 min-w-11 px-2 rounded-md border border-border bg-card',
        'hover:bg-secondary hover:border-primary/50 text-sm font-medium whitespace-nowrap',
        'transition edge-top inline-flex items-center justify-center gap-1.5',
        'disabled:opacity-50 disabled:pointer-events-none',
        '[@container_(min-width:400px)]:min-w-[96px]',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="hidden [@container_(min-width:400px)]:inline">{label}</span>
      {kbd && (
        <kbd className="hidden [@container_(min-width:480px)]:inline text-xs text-muted-foreground">{kbd}</kbd>
      )}
    </button>
  );
}

/** ⋯ menu: the low-frequency cart actions. Opens upward (pinned to the bottom). */
function MoreActions({
  keys,
  onSaveAsDraft,
  onSaveAsQuotation,
  onShowHeld,
  onClearCart,
  onSwapOrientation,
  orientation,
  disabled,
  empty,
  onReprintLast,
}: {
  keys: ReturnType<typeof usePosKeys>;
  onSaveAsDraft: () => void;
  onSaveAsQuotation: () => void;
  onShowHeld: () => void;
  onClearCart: () => void;
  onReprintLast?: () => void;
  onSwapOrientation: () => void;
  orientation: Orientation;
  disabled?: boolean;
  empty: boolean;
}) {
  return (
    <div className="shrink-0">
      <Popover
        width="w-72"
        align="right"
        side="top"
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
            aria-label="More actions"
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
              hint={keyLabel(keys.heldCarts)}
              onClick={() => {
                close();
                onShowHeld();
              }}
            />
            {onReprintLast && (
              <MenuRow
                icon={Printer}
                label="Re-print last receipt"
                hint={keyLabel(keys.reprintLast)}
                onClick={() => {
                  close();
                  onReprintLast();
                }}
              />
            )}
            <MenuRow
              icon={PenSquare}
              label="Save as draft"
              hint={keyLabel(keys.saveDraft)}
              disabled={empty}
              onClick={() => {
                close();
                onSaveAsDraft();
              }}
            />
            <MenuRow
              icon={FileText}
              label="Save as quotation"
              hint={keyLabel(keys.saveQuotation)}
              disabled={empty}
              onClick={() => {
                close();
                onSaveAsQuotation();
              }}
            />
            <MenuRow
              icon={ArrowLeftRight}
              label={orientation === 'cart-left' ? 'Move cart to the right' : 'Move cart to the left'}
              onClick={() => {
                close();
                onSwapOrientation();
              }}
            />
            <div className="my-1 border-t border-border" />
            <MenuRow
              icon={Trash2}
              label="Clear cart"
              tone="destructive"
              disabled={empty}
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
  tone,
  disabled,
  onClick,
}: {
  icon: any;
  label: string;
  hint?: string;
  tone?: 'destructive';
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary text-sm text-left transition',
        'disabled:opacity-40 disabled:pointer-events-none',
        tone === 'destructive' && 'text-destructive hover:bg-destructive/10',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
      {hint && <kbd className="ml-auto shrink-0 text-xs text-muted-foreground">{hint}</kbd>}
    </button>
  );
}

/** Pay is the loudest control: it grows to fill the row and is taller (h-14). */
function PrimaryCTA({
  onClick,
  disabled,
  kbd,
  title,
}: {
  onClick?: () => void;
  disabled?: boolean;
  kbd: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative h-14 flex-1 basis-1/2 min-w-0 rounded-lg',
        'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground text-lg font-bold',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_-4px_hsl(var(--primary)/0.55)]',
        'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_6px_20px_-4px_hsl(var(--primary)/0.7)]',
        'transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
        'disabled:opacity-50 disabled:pointer-events-none',
      )}
      title={title ?? `Pay (${kbd})`}
    >
      <span>Pay</span>
      <kbd className="opacity-80 text-xs ml-0.5">{kbd}</kbd>
      <ArrowRight className="size-5 ml-0.5 shrink-0" />
    </button>
  );
}
