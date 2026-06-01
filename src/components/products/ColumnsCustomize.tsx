import { Check, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  ALL_PRODUCT_COLUMNS,
  COLUMN_META,
  type ProductColumn,
  useProductsUI,
} from '@/stores/products';

export function ColumnsCustomize({ onClose }: { onClose: () => void }) {
  const { columns, toggleColumn, moveColumn, resetColumns } = useProductsUI();

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end animate-fade-in">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex-1">
            <div className="font-semibold">Customize Columns</div>
            <div className="text-xs text-muted-foreground">Show, hide, and reorder columns</div>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-md hover:bg-secondary">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-1">
          {/* Active columns first (in order), then inactive */}
          {[...columns, ...ALL_PRODUCT_COLUMNS.filter((c) => !columns.includes(c))].map((id) => {
            const on = columns.includes(id);
            const meta = COLUMN_META[id as ProductColumn];
            const idx = columns.indexOf(id);
            return (
              <div
                key={id}
                className={cn(
                  'flex items-center gap-2 p-2.5 rounded-lg border transition',
                  on ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
                )}
              >
                <button
                  onClick={() => toggleColumn(id as ProductColumn)}
                  className={cn(
                    'size-5 rounded grid place-items-center border-2 shrink-0',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                  )}
                >
                  {on && <Check className="size-3" />}
                </button>
                <div className="flex-1 text-sm font-medium">{meta.label}</div>
                {on && (
                  <div className="flex items-center bg-secondary rounded-md text-xs">
                    <button
                      onClick={() => moveColumn(id as ProductColumn, -1)}
                      disabled={idx === 0}
                      className="size-7 grid place-items-center disabled:opacity-30 hover:bg-background rounded-l-md"
                      title="Move left"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveColumn(id as ProductColumn, 1)}
                      disabled={idx === columns.length - 1}
                      className="size-7 grid place-items-center disabled:opacity-30 hover:bg-background rounded-r-md"
                      title="Move right"
                    >
                      ↓
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={resetColumns}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
