import { Check, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Props<T extends string> {
  title?: string;
  subtitle?: string;
  all: readonly T[];
  visible: T[];
  meta: Record<T, { label: string }>;
  onToggle: (c: T) => void;
  onMove: (c: T, dir: -1 | 1) => void;
  onReset: () => void;
  onClose: () => void;
}

export function ColumnsPanel<T extends string>({
  title = 'Customize Columns',
  subtitle = 'Show, hide, and reorder columns',
  all,
  visible,
  meta,
  onToggle,
  onMove,
  onReset,
  onClose,
}: Props<T>) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end animate-fade-in">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex-1">
            <div className="font-semibold">{title}</div>
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-md hover:bg-secondary">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-1">
          {[...visible, ...all.filter((c) => !visible.includes(c))].map((id) => {
            const on = visible.includes(id);
            const idx = visible.indexOf(id);
            return (
              <div
                key={id}
                className={cn(
                  'flex items-center gap-2 p-2.5 rounded-lg border transition',
                  on ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
                )}
              >
                <button
                  onClick={() => onToggle(id)}
                  className={cn(
                    'size-5 rounded grid place-items-center border-2 shrink-0',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                  )}
                >
                  {on && <Check className="size-3" />}
                </button>
                <div className="flex-1 text-sm font-medium">{meta[id]?.label ?? id}</div>
                {on && (
                  <div className="flex items-center bg-secondary rounded-md text-xs">
                    <button
                      onClick={() => onMove(id, -1)}
                      disabled={idx === 0}
                      className="size-7 grid place-items-center disabled:opacity-30 hover:bg-background rounded-l-md"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => onMove(id, 1)}
                      disabled={idx === visible.length - 1}
                      className="size-7 grid place-items-center disabled:opacity-30 hover:bg-background rounded-r-md"
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
          <Button variant="outline" size="sm" onClick={onReset}>
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
