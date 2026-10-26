import { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

/**
 * One headline number on a report. Neutral by default; colour only for
 * money-state: `good` (profit), `bad` (loss, dues, out of stock), `warn`.
 * No trend arrows — there is no prior period to compare with.
 */
export type KpiTone = 'default' | 'good' | 'bad' | 'warn';

const TONE: Record<KpiTone, string> = {
  default: 'text-foreground',
  good: 'text-success',
  bad: 'text-destructive',
  warn: 'text-warning',
};

interface Props {
  label: string;
  value: ReactNode;
  /** One short line under the value. */
  sub?: ReactNode;
  tone?: KpiTone;
  /** The answer to the report's question: larger value. */
  hero?: boolean;
  /** Shows a placeholder instead of a value (never a fake ৳0). */
  loading?: boolean;
  /** Makes the card a toggle (e.g. Low / Out filters). */
  onClick?: () => void;
  active?: boolean;
}

export function ReportKpi({ label, value, sub, tone = 'default', hero, loading, onClick, active }: Props) {
  const body = (
    <>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {loading ? (
        <Skeleton className={cn('mt-1.5 w-28', hero ? 'h-8' : 'h-7')} />
      ) : (
        <div className={cn('tabular font-semibold mt-0.5', hero ? 'text-2xl' : 'text-xl', TONE[tone])}>{value}</div>
      )}
      {sub && !loading && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={!!active}
        className={cn(
          'rounded-xl border bg-card text-left px-4 py-3 shadow-sm transition focus-ring hover:border-primary/60',
          active ? 'border-primary ring-2 ring-primary/40' : 'border-border',
        )}
      >
        {body}
      </button>
    );
  }
  return <Card className="px-4 py-3">{body}</Card>;
}

/** Row of KPIs; at most four, the first is the answer. */
export function ReportKpis({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3', className)}>{children}</div>;
}
