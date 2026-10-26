import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export type KpiTone = 'primary' | 'success' | 'warning' | 'info' | 'destructive';

/**
 * DIMMED TONES.
 *
 * These cards used to be solid saturated blocks (`bg-blue-600`, `bg-emerald-600`
 * …) with white text — a wall of loud colour, and white-on-amber in particular
 * was hard to read. Now the card is a normal surface with a soft tint plus a
 * coloured accent bar and icon tile, so the tone still identifies the metric but
 * the NUMBER is plain high-contrast foreground text.
 */
const surfaceCls: Record<KpiTone, string> = {
  primary: 'bg-primary/[0.07] border-primary/25',
  success: 'bg-success/[0.07] border-success/25',
  warning: 'bg-warning/[0.07] border-warning/25',
  info: 'bg-accent/[0.07] border-accent/25',
  destructive: 'bg-destructive/[0.07] border-destructive/25',
};

const accentCls: Record<KpiTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-accent',
  destructive: 'bg-destructive',
};

const iconCls: Record<KpiTone, string> = {
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-accent/15 text-accent',
  destructive: 'bg-destructive/15 text-destructive',
};

interface KpiProps {
  icon: any;
  label: string;
  value: string;
  /** Percent change; null = no previous figure to compare with (shown as —). */
  delta?: number | null;
  tone?: KpiTone;
  to?: string;
  onClick?: () => void;
  showDelta?: boolean;
  /** The range this figure covers ("Today", "This month"); own text node. */
  period?: string;
  /** "vs yesterday", "vs last month" … */
  compareLabel?: string;
  /**
   * Today only: the previous figure in words ("Yesterday ৳3,72,300") instead of
   * a % that is always red in the morning (a part-day against a full day).
   */
  prevValue?: string;
}

export function Kpi({
  icon: Icon,
  label,
  value,
  delta,
  tone = 'primary',
  to,
  onClick,
  showDelta = true,
  period,
  compareLabel = 'vs yesterday',
  prevValue,
}: KpiProps) {
  const positive = (delta ?? 0) >= 0;

  const inner = (
    <Card
      className={cn(
        'relative overflow-hidden hover:shadow-md transition group h-full border',
        surfaceCls[tone],
      )}
    >
      {/* Thin accent bar carries the tone without flooding the card with colour */}
      <span className={cn('absolute inset-y-0 left-0 w-1', accentCls[tone])} />
      <CardContent className="p-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground min-w-0">
              <span className="truncate">{label}</span>
              {period && (
                <span className="shrink-0 text-xs rounded bg-secondary px-1.5 py-0.5">{period}</span>
              )}
              {(to || onClick) && (
                <ChevronRight className="size-4 shrink-0 opacity-0 group-hover:opacity-100 transition" />
              )}
            </div>
            <div className="text-2xl font-bold mt-1 tracking-tight tabular text-foreground truncate">
              {value}
            </div>
            {showDelta && prevValue !== undefined && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                <span>Yesterday</span> <span className="tabular">{prevValue}</span>
              </div>
            )}
            {showDelta && prevValue === undefined && delta === null && (
              <div className="mt-2 flex items-center gap-1 text-xs font-medium text-muted-foreground whitespace-nowrap">
                — <span>{compareLabel}</span>
              </div>
            )}
            {showDelta && prevValue === undefined && typeof delta === 'number' && (
              <div
                className={cn(
                  'mt-2 flex items-center gap-1 text-xs font-medium whitespace-nowrap',
                  positive ? 'text-success' : 'text-destructive',
                )}
              >
                {positive ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                <span className="tabular">{Math.abs(delta)}%</span>{' '}
                <span className="text-muted-foreground">{compareLabel}</span>
              </div>
            )}
          </div>
          <div className={cn('size-10 rounded-lg grid place-items-center shrink-0', iconCls[tone])}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="block w-full text-left">
        {inner}
      </button>
    );
  }
  if (to) return <Link to={to} className="block">{inner}</Link>;
  return inner;
}
