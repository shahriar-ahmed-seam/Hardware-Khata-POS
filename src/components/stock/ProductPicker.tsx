import { forwardRef, KeyboardEvent, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { ProductImage } from '@/components/products/ProductImage';
import type { Product } from '@/types/domain';
import { formatNumber, cn } from '@/lib/utils';

/**
 * Product search for stock documents (transfer, adjustment).
 * Type or scan; ↑/↓ move, Enter adds the highlighted (or exact barcode/SKU) match.
 */
interface Props {
  products: Product[];
  onPick: (p: Product) => void;
  autoFocus?: boolean;
}
export const ProductPicker = forwardRef<HTMLInputElement, Props>(
  ({ products, onPick, autoFocus }, ref) => {
    const [q, setQ] = useState('');
    const [hi, setHi] = useState(0);

    const matches = useMemo(() => {
      const t = q.trim().toLowerCase();
      if (!t) return [];
      return products
        .filter((p) => `${p.name} ${p.sku} ${p.barcode ?? ''}`.toLowerCase().includes(t))
        .slice(0, 8);
    }, [q, products]);

    const pick = (p: Product) => {
      onPick(p);
      setQ('');
      setHi(0);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown' && matches.length) {
        e.preventDefault();
        setHi((h) => (h + 1) % matches.length);
      } else if (e.key === 'ArrowUp' && matches.length) {
        e.preventDefault();
        setHi((h) => (h - 1 + matches.length) % matches.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const t = q.trim().toLowerCase();
        // A scanner types the code then Enter: an exact code wins over the highlight.
        const exact = products.find(
          (p) => p.barcode?.toLowerCase() === t || p.sku.toLowerCase() === t,
        );
        const p = exact ?? matches[hi];
        if (p) pick(p);
      } else if (e.key === 'Escape' && q) {
        e.stopPropagation();
        setQ('');
      }
    };

    return (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          ref={ref}
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setHi(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search or scan a product…"
          aria-label="Search product"
          className="pl-9"
        />
        {q.trim() !== '' && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-xl overflow-hidden z-20">
            {matches.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(p)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-left',
                  i === hi ? 'bg-secondary' : 'hover:bg-secondary',
                )}
              >
                <ProductImage url={p.image} categoryId={p.categoryId} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">{p.sku}</span> · <span>In stock</span>{' '}
                    <span className="tabular">{formatNumber(p.stock)}</span> {p.unit}
                  </div>
                </div>
                <Plus className="size-4 text-primary" />
              </button>
            ))}
            {matches.length === 0 && (
              <div className="px-3 py-3 text-sm text-muted-foreground">No product found.</div>
            )}
          </div>
        )}
      </div>
    );
  },
);
ProductPicker.displayName = 'ProductPicker';
