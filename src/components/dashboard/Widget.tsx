import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, X, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  to?: string;
  toLabel?: string;
  className?: string;
  removable?: boolean;
  onRemove?: () => void;
  // Reorder controls (in customize mode)
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  badge?: ReactNode;
  children: ReactNode;
}

export function Widget({
  title,
  description,
  to,
  toLabel = 'View all',
  className,
  removable,
  onRemove,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  badge,
  children,
}: Props) {
  return (
    <Card className={cn('overflow-hidden flex flex-col h-full w-full', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle>{title}</CardTitle>
              {badge}
            </div>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {(canMoveUp || canMoveDown) && (
              <div className="flex items-center bg-secondary rounded-md">
                <button
                  onClick={onMoveUp}
                  disabled={!canMoveUp}
                  className="size-6 grid place-items-center text-xs disabled:opacity-30 hover:bg-background rounded-l-md"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={onMoveDown}
                  disabled={!canMoveDown}
                  className="size-6 grid place-items-center text-xs disabled:opacity-30 hover:bg-background rounded-r-md"
                  title="Move down"
                >
                  ↓
                </button>
              </div>
            )}
            {to && (
              <Link
                to={to}
                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md hover:bg-secondary text-[11px] text-muted-foreground hover:text-foreground"
              >
                {toLabel}
                <ChevronRight className="size-3" />
              </Link>
            )}
            {removable && (
              <button
                onClick={onRemove}
                className="size-6 grid place-items-center rounded text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                title="Remove from dashboard"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex-1 min-h-0 flex flex-col">{children}</CardContent>
    </Card>
  );
}
