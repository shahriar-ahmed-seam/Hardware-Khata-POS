import {
  Plus,
  X,
  Trash2,
  Pause,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  HandCoins,
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
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
import { customers as mockCustomers, type Customer } from '@/mocks/data';
import { usePOS } from '@/stores/pos';
import type { PaymentMethod } from './PaymentModal';

interface Props {
  carts: ParkedCart[];
  activeId: string;
  setActiveId: (id: string) => void;
  setCart: (next: ParkedCart) => void;
  addCart: () => void;
  closeCart: (id: string) => void;
  clearCart: () => void;
  /** Customer source — live backend rows under hasBackend(), else mock seed. */
  customers?: Customer[];
  /** True while a sale/draft/quotation is being persisted — disables actions. */
  busy?: boolean;
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
  customers = mockCustomers,
  busy = false,
  onPickCustomer,
  onPay,
  onSplitPay,
  onSuspend,
  onShowHeld,
  onSaveAsDraft,
  onSaveAsQuotation,
}: Props) {
  const active = carts.find((c) => c.id === activeId)!;
  const customer = customers.find((c) => c.id === active.customerId) ?? customers[0] ?? mockCustomers[0];
  const totals = computeTotals(active);
  const swapOrientation = usePOS((s) => s.swapOrientation);
  const orientation = usePOS((s) => s.orientation);

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
    !!customer.creditLimit && customer.due >= customer.creditLimit;

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-card/40 border-r border-border">
      {/* Cart tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card/60 overflow-x-auto scroll-hide">
        {carts.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveId(c.id)}
            className={cn(
              'group flex items-center gap-2 px-2.5 h-7 rounded-md text-xs font-medium transition shrink-0',
              activeId === c.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
            )}
          >
            {c.label}
            <span className="text-[10px] opacity-70 tabular">{c.lines.length}</span>
            {carts.length > 1 && (
              <X
                className="size-3 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  closeCart(c.id);
                }}
              />
            )}
          </button>
        ))}
        <button
          onClick={addCart}
          className="size-7 grid place-items-center rounded-md hover:bg-secondary text-muted-foreground"
          title="New cart (F10)"
        >
          <Plus className="size-4" />
        </button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onShowHeld} title="Held carts (F5)">
          <ListChecks className="size-3.5" /> Held
        </Button>
        <Button variant="ghost" size="sm" onClick={clearCart} title="Clear cart">
          <Trash2 className="size-3.5" /> Clear
        </Button>
        <Button variant="ghost" size="sm" onClick={onSuspend} title="Hold (F9)">
          <Pause className="size-3.5" /> Hold
        </Button>
        <button
          onClick={swapOrientation}
          title={orientation === 'cart-left' ? 'Move cart to right' : 'Move cart to left'}
          className="size-7 grid place-items-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeftRight className="size-3.5" />
        </button>
      </div>

      {/* Customer + price group + scan strip */}
      <div className="px-3 py-2 border-b border-border grid grid-cols-1 md:grid-cols-3 gap-2 bg-card/60">
        {/* Customer */}
        <button
          onClick={onPickCustomer}
          className="flex items-center gap-2 px-2.5 h-9 rounded-md border border-border hover:border-primary hover:bg-secondary/40 transition text-left"
          title="Pick customer (F3)"
        >
          <User className="size-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate">{customer.name}</div>
            <div className="text-[10px] text-muted-foreground">
              {customer.phone} · {customer.group}
            </div>
          </div>
          {customer.due > 0 && (
            <Badge variant={overLimit ? 'destructive' : 'warning'}>
              Due {formatBDT(customer.due, { withSymbol: false })}
            </Badge>
          )}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>

        {/* Price group selector */}
        <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-[11px] h-9">
          {(['retail', 'wholesale', 'contractor'] as PriceGroup[]).map((g) => (
            <button
              key={g}
              onClick={() => setCart({ ...active, priceGroup: g })}
              className={cn(
                'flex-1 h-full rounded capitalize font-medium transition',
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
        <div className="flex items-center gap-2 px-2.5 h-9 rounded-md border border-dashed border-border text-muted-foreground text-[11px]">
          <ScanBarcode className="size-4" />
          <span>Scanner ready · or press F2 to search</span>
        </div>
      </div>

      {/* Cart lines */}
      <div className="flex-1 overflow-auto scroll-hide min-h-0 py-1">
        {active.lines.length === 0 ? (
          <div className="h-full grid place-items-center text-center p-6 text-muted-foreground">
            <div>
              <ScanBarcode className="size-12 mx-auto opacity-30" />
              <div className="mt-3 text-sm">Scan or pick a product to start</div>
              <div className="text-[11px] mt-1">Press F2 to focus search</div>
            </div>
          </div>
        ) : (
          active.lines.map((l, i) => (
            <CartLineRow
              key={l.productId + i}
              index={i}
              line={l}
              onChange={(n) => updateLine(i, n)}
              onRemove={() => removeLine(i)}
            />
          ))
        )}
      </div>

      {/* Footer: totals & charges */}
      <div className="shadow-soft-top bg-card relative z-10">
        <div className="p-3 space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono tabular">{formatBDT(totals.subtotal)}</span>
          </div>
          {totals.totalLineDiscount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Line Discounts</span>
              <span className="font-mono tabular text-success">
                − {formatBDT(totals.totalLineDiscount)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-5 gap-2 pt-1">
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

          {(totals.orderDiscount > 0 || totals.tax > 0 || totals.shipping > 0 || totals.other > 0) && (
            <div className="border-t border-border/60 pt-2 space-y-1 text-[12px]">
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

          <div className="rounded-lg border border-border bg-gradient-to-br from-primary/5 to-primary/10 px-3.5 py-2.5 flex items-center justify-between edge-top">
            <span className="text-sm font-semibold tracking-tight">Total Payable</span>
            <span className="font-mono tabular text-[26px] leading-none font-bold text-primary tracking-tight">
              <span className="font-bold mr-0.5">৳</span>
              {formatBDT(totals.total, { withSymbol: false })}
            </span>
          </div>

          {/* Payment quick-pick row */}
          <div className="grid grid-cols-6 gap-1.5 pt-1">
            <PayBtn icon={Banknote} label="Cash" onClick={() => onPay('Cash')} disabled={busy} />
            <PayBtn icon={Smartphone} label="bKash" onClick={() => onPay('bKash')} disabled={busy} />
            <PayBtn icon={Smartphone} label="Nagad" onClick={() => onPay('Nagad')} disabled={busy} />
            <PayBtn icon={CreditCard} label="Card" onClick={() => onPay('Card')} disabled={busy} />
            <PayBtn icon={Building2} label="Bank" onClick={() => onPay('Bank')} disabled={busy} />
            <PayBtn icon={HandCoins} label="Credit" onClick={() => onPay('Credit')} disabled={busy} />
          </div>

          {/* Bottom action bar */}
          <div className="grid grid-cols-12 gap-2 pt-1">
            <SecondaryBtn className="col-span-3" onClick={onSuspend}>
              Suspend
            </SecondaryBtn>
            <SecondaryBtn className="col-span-3" onClick={onSplitPay} disabled={busy}>
              Multi-Pay
            </SecondaryBtn>
            <MoreActions
              className="col-span-1"
              onSaveAsDraft={onSaveAsDraft}
              onSaveAsQuotation={onSaveAsQuotation}
              disabled={busy}
            />
            <PrimaryCTA className="col-span-5" onClick={() => onPay('Cash')} disabled={busy} />
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
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-semibold uppercase text-muted-foreground tracking-[0.06em] inline-flex items-center gap-1 leading-none">
        <Icon className="size-3" />
        {label}
      </label>
      <NumberField
        value={value}
        onChangeNumber={onChange}
        placeholder="0.00"
        className="h-9 px-2 text-right text-xs"
      />
    </div>
  );
}

function PayBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: any;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="group inline-flex items-center justify-center gap-1 h-9 rounded-md border border-border bg-card hover:border-primary hover:bg-primary/5 text-[11px] font-medium transition edge-top px-1 disabled:opacity-50 disabled:pointer-events-none"
    >
      <Icon className="size-3.5 text-muted-foreground group-hover:text-primary transition shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function SecondaryBtn({
  children,
  onClick,
  className,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-10 rounded-md border border-border bg-card hover:bg-secondary hover:border-primary/50 text-[13px] font-medium transition edge-top disabled:opacity-50 disabled:pointer-events-none',
        className,
      )}
    >
      {children}
    </button>
  );
}

function MoreActions({
  onSaveAsDraft,
  onSaveAsQuotation,
  className,
  disabled,
}: {
  onSaveAsDraft: () => void;
  onSaveAsQuotation: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Popover
      width="w-56"
      align="right"
      trigger={(_o, set) => (
        <button
          onClick={() => set(true)}
          disabled={disabled}
          className={cn(
            'h-10 rounded-md border border-border bg-card hover:bg-secondary text-[13px] font-medium transition edge-top inline-flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none',
            className,
          )}
          title="More actions"
        >
          <MoreHorizontal className="size-4" />
        </button>
      )}
    >
      {(close) => (
        <div className="py-1">
          <button
            onClick={() => {
              close();
              onSaveAsDraft();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary text-sm"
          >
            <PenSquare className="size-3.5" /> Save as Draft <kbd className="ml-auto font-mono text-[10px] opacity-60">F6</kbd>
          </button>
          <button
            onClick={() => {
              close();
              onSaveAsQuotation();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary text-sm"
          >
            <FileText className="size-3.5" /> Save as Quotation <kbd className="ml-auto font-mono text-[10px] opacity-60">F7</kbd>
          </button>
        </div>
      )}
    </Popover>
  );
}

function PrimaryCTA({ onClick, className, disabled }: { onClick?: () => void; className?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative h-10 rounded-md',
        'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground text-[13px] font-semibold',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_-4px_hsl(var(--primary)/0.55)]',
        'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_6px_20px_-4px_hsl(var(--primary)/0.7)]',
        'transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none',
        className,
      )}
    >
      Pay <span className="opacity-70 text-[10px] font-mono ml-0.5">F8</span>
      <ArrowRight className="size-3.5 ml-0.5" />
    </button>
  );
}
