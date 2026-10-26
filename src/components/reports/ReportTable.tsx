import { ReactNode, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, Inbox } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatBDT, formatNumber, cn } from '@/lib/utils';
import type { ReportDocSection } from './reportExport';

/**
 * THE REPORT TABLE — a real <table>: sticky 14px header in normal case, 16px
 * cells at ≥ 44px rows, money right-aligned with tabular digits, a bold total
 * row. Columns are defined once and drive the screen, the print sheet and the
 * CSV (`tableSection`).
 */
export interface ReportColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  /** Plain text: print sheet and default screen cell. */
  text: (row: T) => string;
  /** Raw CSV value (numbers stay numbers). Defaults to `text`. */
  csv?: (row: T) => string | number;
  /** Screen cell when it needs more than text (sub-line, badge). */
  cell?: (row: T) => ReactNode;
  /** Value to sort by; makes the header a sort button. */
  sort?: (row: T) => number | string;
  /** Total-row cell (screen and print). */
  total?: string;
  csvTotal?: string | number;
  /** The cell is a UI word (status, type) — translated in a Bangla CSV. */
  word?: boolean;
  className?: string;
  /** Leave out of print/CSV (e.g. an action column). */
  screenOnly?: boolean;
}

export type SortState = { key: string; dir: 'asc' | 'desc' };

/** Sort state + sorted rows, so the screen and the export share one order. */
export function useSortedRows<T>(rows: T[], columns: ReportColumn<T>[], initial: SortState | null) {
  const [sort, setSort] = useState<SortState | null>(initial);
  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    const m = sort!.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      return typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb) * m : ((va as number) - (vb as number)) * m;
    });
  }, [rows, columns, sort]);
  const onSort = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  return { rows: sorted, sort, onSort };
}

// ---------------------------------------------------------------- column helpers

/** Money column: right-aligned, red only when negative. */
export function moneyCol<T>(
  key: string,
  header: string,
  get: (r: T) => number,
  opts: Partial<ReportColumn<T>> & { totalValue?: number; strong?: boolean } = {},
): ReportColumn<T> {
  const { totalValue, strong, ...rest } = opts;
  return {
    key,
    header,
    align: 'right',
    text: (r) => formatBDT(get(r)),
    csv: get,
    sort: get,
    cell: (r) => (
      <span className={cn(get(r) < 0 && 'text-destructive', strong && 'font-medium')}>{formatBDT(get(r))}</span>
    ),
    ...(totalValue !== undefined ? { total: formatBDT(totalValue), csvTotal: totalValue } : {}),
    ...rest,
  };
}

/** Count / quantity column. */
export function numCol<T>(
  key: string,
  header: string,
  get: (r: T) => number,
  opts: Partial<ReportColumn<T>> & { totalValue?: number } = {},
): ReportColumn<T> {
  const { totalValue, ...rest } = opts;
  return {
    key,
    header,
    align: 'right',
    text: (r) => formatNumber(get(r)),
    csv: get,
    sort: get,
    ...(totalValue !== undefined ? { total: formatNumber(totalValue), csvTotal: totalValue } : {}),
    ...rest,
  };
}

/** Columns + rows → a print/CSV section. */
export function tableSection<T>(
  columns: ReportColumn<T>[],
  rows: T[],
  opts: { heading?: string; totalLabel?: string | false } = {},
): ReportDocSection {
  const cols = columns.filter((c) => !c.screenOnly);
  const hasTotal = opts.totalLabel !== false && cols.some((c) => c.total !== undefined);
  const label = opts.totalLabel || 'Total';
  return {
    heading: opts.heading,
    columns: cols.map((c) => ({ header: c.header, align: c.align })),
    rows: rows.map((r) => cols.map((c) => c.text(r))),
    csvRows: rows.map((r) => cols.map((c) => (c.csv ?? c.text)(r))),
    footer: hasTotal ? cols.map((c, i) => c.total ?? (i === 0 ? label : '')) : undefined,
    csvFooter: hasTotal ? cols.map((c, i) => c.csvTotal ?? c.total ?? (i === 0 ? label : '')) : undefined,
    wordColumns: cols.flatMap((c, i) => (c.word ? [i] : [])),
  };
}

// ---------------------------------------------------------------- states

/** Inline failure with a way out. */
export function ReportError({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  return (
    <EmptyState
      compact
      icon={AlertCircle}
      title="This report could not be loaded."
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )
      }
      className={className}
    />
  );
}

// ---------------------------------------------------------------- table

interface Props<T> {
  columns: ReportColumn<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  onRowClick?: (row: T) => void;
  sort?: SortState | null;
  onSort?: (key: string) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  empty?: { title: string; message?: string; icon?: any; action?: ReactNode };
  /** Label in the first cell of the total row. `false` hides the row. */
  totalLabel?: string | false;
  /** Above the header, e.g. a "showing 500 of 1,240" notice. */
  notice?: ReactNode;
  heading?: ReactNode;
  className?: string;
}

export function ReportTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  sort,
  onSort,
  loading,
  error,
  onRetry,
  empty,
  totalLabel = 'Total',
  notice,
  heading,
  className,
}: Props<T>) {
  const showTotal = totalLabel !== false && rows.length > 0 && columns.some((c) => c.total !== undefined);
  const align = (c: ReportColumn<T>) => (c.align === 'right' ? 'text-right' : 'text-left');

  let body: ReactNode = null;
  if (rows.length === 0) {
    body = (
      <tr>
        <td colSpan={columns.length}>
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : error ? (
            <ReportError onRetry={onRetry} />
          ) : (
            <EmptyState
              compact
              icon={empty?.icon ?? Inbox}
              title={empty?.title ?? 'Nothing in this period.'}
              message={empty?.message ?? 'Try another date range.'}
              action={empty?.action}
            />
          )}
        </td>
      </tr>
    );
  }

  return (
    // overflow-clip (not hidden) keeps the sticky header working.
    <Card className={cn('overflow-clip', className)}>
      {heading && <div className="px-4 py-3 border-b border-border text-sm font-semibold">{heading}</div>}
      {notice && <div className="px-4 py-2 border-b border-border text-sm text-warning">{notice}</div>}
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-[1] bg-card">
          <tr className="border-b border-border">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const label =
                c.sort && onSort ? (
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded hover:text-foreground focus-ring',
                      active && 'text-foreground',
                    )}
                  >
                    {c.header}
                    {active && (sort!.dir === 'asc' ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />)}
                  </button>
                ) : (
                  c.header
                );
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    'px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap bg-secondary/40',
                    align(c),
                  )}
                >
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {body}
          {rows.map((r, i) => (
            <tr
              key={rowKey(r, i)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter') onRowClick(r);
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              className={cn(
                'border-b border-border last:border-b-0',
                onRowClick && 'cursor-pointer hover:bg-secondary/40 focus-visible:bg-secondary/40 outline-none',
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-3 align-middle', align(c), c.align === 'right' && 'tabular whitespace-nowrap', c.className)}>
                  {c.cell ? c.cell(r) : c.text(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {showTotal && (
          <tfoot>
            <tr className="border-t-2 border-border bg-secondary/40 font-semibold">
              {columns.map((c, i) => (
                <td key={c.key} className={cn('px-4 py-3', align(c), c.align === 'right' && 'tabular whitespace-nowrap')}>
                  {c.total ?? (i === 0 ? totalLabel : '')}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </Card>
  );
}

/** Product name with a small code line under it. */
export function NameCell({ name, sub }: { name: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="font-medium truncate max-w-[22rem]">{name}</div>
      {sub && <div className="text-xs text-muted-foreground truncate max-w-[22rem]">{sub}</div>}
    </div>
  );
}
