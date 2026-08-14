import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

interface Props {
  page: number; // 1-based
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** Shown in the "x–y of z <label>" summary. */
  label?: string;
  busy?: boolean;
}

const PAGE_SIZES = [25, 50, 100, 200];

/**
 * Pager for server-paginated lists.
 *
 * Buttons are full-height with real labels rather than tiny icon-only targets —
 * the shop owner is elderly, so these need to be easy to hit and read.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  label = 'rows',
  busy,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const first = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, total);

  const go = (p: number) => {
    const next = Math.min(Math.max(1, p), pageCount);
    if (next !== current) onPageChange(next);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-secondary/30">
      <div className="text-sm text-muted-foreground">
        {total === 0 ? (
          <>No {label}</>
        ) : (
          <>
            <span className="font-semibold text-foreground tabular">
              {formatNumber(first)}–{formatNumber(last)}
            </span>{' '}
            of <span className="font-semibold text-foreground tabular">{formatNumber(total)}</span>{' '}
            {label}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Rows
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <PagerBtn onClick={() => go(1)} disabled={current === 1 || busy} title="First page">
            <ChevronsLeft className="size-4" />
          </PagerBtn>
          <PagerBtn onClick={() => go(current - 1)} disabled={current === 1 || busy} title="Previous page">
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Previous</span>
          </PagerBtn>

          <span className="px-2 text-sm whitespace-nowrap">
            Page <span className="font-semibold tabular">{formatNumber(current)}</span> of{' '}
            <span className="font-semibold tabular">{formatNumber(pageCount)}</span>
          </span>

          <PagerBtn
            onClick={() => go(current + 1)}
            disabled={current >= pageCount || busy}
            title="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-4" />
          </PagerBtn>
          <PagerBtn
            onClick={() => go(pageCount)}
            disabled={current >= pageCount || busy}
            title="Last page"
          >
            <ChevronsRight className="size-4" />
          </PagerBtn>
        </div>
      </div>
    </div>
  );
}

function PagerBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-9 px-2.5 inline-flex items-center gap-1 rounded-md border border-border bg-card text-sm font-medium transition',
        'hover:bg-secondary hover:border-primary/50',
        'disabled:opacity-40 disabled:pointer-events-none',
      )}
    >
      {children}
    </button>
  );
}
