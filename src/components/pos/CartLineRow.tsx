import { Minus, Plus, Trash2, Package } from 'lucide-react';
import { cn, formatBDT } from '@/lib/utils';
import { type CartLine, lineSubtotal, unitPrice } from './types';
import { units as allUnits } from '@/mocks/data';
import { NumberField } from '@/components/ui/NumberField';

interface Props {
  line: CartLine;
  index: number;
  onChange: (next: CartLine) => void;
  onRemove: () => void;
}

const FIELD_H = 'h-9'; // Uniform height for every input/select/button in the row

export function CartLineRow({ line, index, onChange, onRemove }: Props) {
  const unitName = allUnits.find((u) => u.short === line.unit)?.short ?? line.unit;
  const lineTotal = lineSubtotal(line);
  const up = unitPrice(line);
  const grossBeforeDisc = up * line.qty;
  const savings = grossBeforeDisc - lineTotal;

  return (
    <div className="mx-2 my-1.5 rounded-lg border border-border/60 bg-card edge-top hover:border-border transition px-3 py-2.5">
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <div className="relative shrink-0">
          <div className="size-12 rounded-lg bg-gradient-to-br from-secondary to-muted grid place-items-center text-muted-foreground/60 ring-1 ring-border/60">
            <Package className="size-5" />
          </div>
          <span className="absolute -top-1.5 -left-1.5 size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold grid place-items-center ring-2 ring-card">
            {index + 1}
          </span>
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold leading-tight tracking-tight truncate">
            {line.name}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
            <span>{line.sku}</span>
            <span className="opacity-50">·</span>
            <span className="tabular">SPR ৳ {line.basePrice.toFixed(2)}</span>
          </div>
        </div>

        {/* Line total + remove */}
        <div className="text-right shrink-0">
          <div className="font-mono font-medium text-[13px] tabular text-foreground/90">
            {formatBDT(lineTotal, { withSymbol: false })}
          </div>
          {savings > 0 && (
            <div className="text-[10px] text-success font-mono tabular -mt-0.5">
              −{formatBDT(savings, { withSymbol: false })}
            </div>
          )}
          <button
            onClick={onRemove}
            className="mt-1 size-5 grid place-items-center rounded text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition ml-auto"
            title="Remove"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {/* Inputs row — 5 labelled fields */}
      <div className="mt-2.5 grid grid-cols-12 gap-1.5">
        {/* Quantity */}
        <FieldBox label="Quantity" className="col-span-4">
          <div className={cn('flex items-center bg-secondary rounded-md', FIELD_H)}>
            <button
              onClick={() => onChange({ ...line, qty: Math.max(0, line.qty - 1) })}
              className={cn(FIELD_H, 'aspect-square grid place-items-center hover:bg-background rounded-l-md')}
              title="Decrease"
            >
              <Minus className="size-3" />
            </button>
            <input
              value={line.qty}
              onChange={(e) => onChange({ ...line, qty: Number(e.target.value) || 0 })}
              className="w-full bg-transparent text-center text-sm font-mono font-semibold tabular outline-none"
            />
            <button
              onClick={() => onChange({ ...line, qty: line.qty + 1 })}
              className={cn(FIELD_H, 'aspect-square grid place-items-center hover:bg-background rounded-r-md')}
              title="Increase"
            >
              <Plus className="size-3" />
            </button>
          </div>
        </FieldBox>

        {/* Unit */}
        <FieldBox label="Unit" className="col-span-2">
          <select
            value={line.unit}
            onChange={(e) => onChange({ ...line, unit: e.target.value })}
            className={cn(
              'w-full rounded-md border border-input bg-background text-xs px-1.5 outline-none focus:ring-2 focus:ring-ring/50',
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

        {/* Price markup */}
        <FieldBox label="Markup %" className="col-span-2" hint="Adds % to SPR for unit price">
          <NumInput
            value={line.markupPct}
            onChange={(v) => onChange({ ...line, markupPct: v })}
            placeholder="0"
          />
        </FieldBox>

        {/* Discount % */}
        <FieldBox label="Disc %" className="col-span-2" hint="Line discount as percent">
          <NumInput
            value={line.discountPct}
            onChange={(v) => onChange({ ...line, discountPct: v })}
            placeholder="0"
          />
        </FieldBox>

        {/* Discount flat */}
        <FieldBox label="Disc ৳" className="col-span-2" hint="Line discount as flat amount">
          <NumInput
            value={line.discountFlat}
            onChange={(v) => onChange({ ...line, discountFlat: v })}
            placeholder="0"
          />
        </FieldBox>
      </div>

      {/* Computed strip */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground font-mono tabular">
        <span>
          ৳ {up.toFixed(2)} × {line.qty} {unitName}
        </span>
        {(line.discountPct > 0 || line.discountFlat > 0) && (
          <span className="text-success">
            saved {formatBDT(savings, { withSymbol: false })}
          </span>
        )}
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
    <div className={cn('flex flex-col gap-1', className)} title={hint}>
      <label className="text-[9px] font-semibold uppercase text-muted-foreground tracking-[0.06em] leading-none">
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
      className={cn('text-right text-xs', FIELD_H)}
    />
  );
}
