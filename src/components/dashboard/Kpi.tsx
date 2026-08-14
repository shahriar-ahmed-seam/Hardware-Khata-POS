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
  delta?: number;
  tone?: KpiTone;
  to?: string;
  onClick?: () => void;
  showDelta?: boolean;
  removable?: boolean;
  onRemove?: () => void;
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
  removable,
  onRemove,
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
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <span className="truncate">{label}</span>
              {(to || onClick) && (
                <ChevronRight className="size-3 shrink-0 opacity-0 group-hover:opacity-100 transition" />
              )}
            </div>
            <div className="text-2xl font-bold mt-1 tracking-tight font-mono text-foreground">
              {value}
            </div>
            {showDelta && typeof delta === 'number' && (
              <div
                className={cn(
                  'mt-2 inline-flex items-center gap-1 text-xs font-medium',
                  positive ? 'text-success' : 'text-destructive',
                )}
              >
                {positive ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                {Math.abs(delta)}% <span className="text-muted-foreground">vs yesterday</span>
              </div>
            )}
          </div>
          <div className={cn('size-10 rounded-lg grid place-items-center shrink-0', iconCls[tone])}>
            <Icon className="size-5" />
          </div>
        </div>
        {removable && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove?.();
            }}
            className="absolute top-1.5 right-1.5 size-6 grid place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Remove from dashboard"
          >
            ×
          </button>
        )}
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
