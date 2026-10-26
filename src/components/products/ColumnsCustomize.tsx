import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';
import {
  ALL_PRODUCT_COLUMNS,
  COLUMN_META,
  type ProductColumn,
  useProductsUI,
} from '@/stores/products';

/** Columns that are always on: a table without product names is useless. */
const LOCKED: ProductColumn[] = ['name'];

/** Choose which Products columns show, and their order. Shared Drawer = Esc + overlay rules. */
export function ColumnsCustomize({ onClose }: { onClose: () => void }) {
  const { columns, toggleColumn, moveColumn, resetColumns } = useProductsUI();
  // Active columns first (in order), then the rest.
  const order = [...columns, ...ALL_PRODUCT_COLUMNS.filter((c) => !columns.includes(c))];

  return (
    <Drawer open onClose={onClose} width="max-w-sm" title="Columns" subtitle="Show, hide and reorder">
      <div className="flex-1 overflow-auto p-3 space-y-1">
        {order.map((id) => {
          const on = columns.includes(id);
          const locked = LOCKED.includes(id);
          const idx = columns.indexOf(id);
          return (
            <div
              key={id}
              className={cn(
                'flex items-center gap-2 pr-1 rounded-lg border transition',
                on ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
              )}
            >
              {/* The whole row toggles, not just the box. */}
              <label
                className={cn(
                  'flex-1 min-h-11 flex items-center gap-3 px-3 text-sm font-medium',
                  locked ? 'cursor-default' : 'cursor-pointer',
                )}
              >
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={on}
                  disabled={locked}
                  onChange={() => toggleColumn(id)}
                />
                <span>{COLUMN_META[id].label}</span>
              </label>
              {on && (
                <>
                  <IconButton
                    size="sm"
                    label="Move up"
                    onClick={() => moveColumn(id, -1)}
                    disabled={idx === 0}
                  >
                    <ChevronUp className="size-4" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    label="Move down"
                    onClick={() => moveColumn(id, 1)}
                    disabled={idx === columns.length - 1}
                  >
                    <ChevronDown className="size-4" />
                  </IconButton>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-border flex items-center justify-between">
        <Button variant="outline" onClick={resetColumns}>
          <RotateCcw className="size-4" /> Reset
        </Button>
        <Button onClick={onClose}>Done</Button>
      </div>
    </Drawer>
  );
}
