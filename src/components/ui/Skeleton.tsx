import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/** Base shimmer block. Compose freely or use the variant helpers below. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-md bg-secondary/70 relative overflow-hidden',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer',
        "before:bg-[linear-gradient(90deg,transparent,hsl(var(--muted-foreground)/0.08),transparent)] before:bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

interface ListProps {
  count?: number;
  className?: string;
}

/** A skeleton placeholder for a table — header + N rows. */
export function SkeletonTable({ count = 6, className }: ListProps) {
  return (
    <div className={cn('rounded-xl border border-border overflow-hidden', className)}>
      <div className="px-4 py-2.5 border-b border-border bg-secondary/40 flex gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: count }).map((_, r) => (
        <div key={r} className="px-4 py-3 border-b border-border last:border-b-0 flex gap-3 items-center">
          {Array.from({ length: 5 }).map((_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'flex-[2]' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A skeleton placeholder for a grid of cards. */
export function SkeletonCards({ count = 6, className }: ListProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      ))}
    </div>
  );
}

/** KPI strip skeleton. */
export function SkeletonKpis({ count = 4, className }: ListProps) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-4 space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      ))}
    </div>
  );
}
