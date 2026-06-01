import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export type KpiTone = 'primary' | 'success' | 'warning' | 'info' | 'destructive';

const toneCls: Record<KpiTone, string> = {
  primary: 'from-primary/20 to-primary/5 text-primary',
  success: 'from-success/20 to-success/5 text-success',
  warning: 'from-warning/20 to-warning/5 text-warning',
  info: 'from-accent/20 to-accent/5 text-accent',
  destructive: 'from-destructive/20 to-destructive/5 text-destructive',
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
    <Card className="relative overflow-hidden hover:shadow-md transition group h-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{label}</span>
              {(to || onClick) && (
                <ChevronRight className="size-3 opacity-0 group-hover:opacity-100 transition" />
              )}
            </div>
            <div className="text-2xl font-bold mt-1 tracking-tight font-mono">{value}</div>
            {showDelta && typeof delta === 'number' && (
              <div
                className={cn(
                  'mt-2 inline-flex items-center gap-1 text-[11px] font-medium',
                  positive ? 'text-success' : 'text-destructive',
                )}
              >
                {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {Math.abs(delta)}% vs yesterday
              </div>
            )}
          </div>
          <div
            className={cn(
              'size-10 rounded-lg bg-gradient-to-br grid place-items-center shrink-0',
              toneCls[tone],
            )}
          >
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
            className="absolute top-1.5 right-1.5 size-5 grid place-items-center rounded text-muted-foreground hover:bg-destructive hover:text-destructive-foreground text-xs"
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
