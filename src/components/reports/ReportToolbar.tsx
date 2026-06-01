import { ReactNode, useMemo } from 'react';
import { Calendar, Building2, FileSpreadsheet, FileText, Printer, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useBranches } from '@/stores/branches';
import { cn } from '@/lib/utils';

/**
 * Date range presets shared across all reports.
 *
 * `today`/`yesterday` are exact-day ranges. `thisWeek` starts on Saturday
 * (BD norm). `thisMonth`/`lastMonth` are calendar months. `thisYear` is from
 * Jan 1. `custom` is user-picked. Helpers below resolve a preset into a
 * concrete `{ from, to }` ISO range.
 */
export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom';

export interface DateRange {
  preset: DatePreset;
  from?: string; // ISO when preset === 'custom'
  to?: string;
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  thisYear: 'This year',
  custom: 'Custom',
};

export function resolveRange(r: DateRange): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  switch (r.preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case 'thisWeek': {
      // BD week starts Saturday (day 6). Monday-start is also fine; using Sat for local norm.
      const d = new Date(now);
      const day = d.getDay(); // 0=Sun..6=Sat
      const diff = (day + 1) % 7; // days since Saturday
      const from = new Date(d);
      from.setDate(d.getDate() - diff);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case 'thisMonth':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
        to: endOfDay(now),
      };
    case 'lastMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from, to };
    }
    case 'thisYear':
      return {
        from: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
        to: endOfDay(now),
      };
    case 'custom':
      return {
        from: r.from ? new Date(r.from) : startOfDay(now),
        to: r.to ? new Date(r.to) : endOfDay(now),
      };
  }
}

export function isInRange(iso: string, range: DateRange): boolean {
  const t = new Date(iso).getTime();
  const { from, to } = resolveRange(range);
  return t >= from.getTime() && t <= to.getTime();
}

interface Props {
  /** Page title shown in header */
  title: string;
  subtitle?: string;
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
  branch?: string; // branch name; '' = all
  onBranchChange?: (b: string) => void;
  /** Slot for report-specific filters (renders on the right of the second row). */
  filters?: ReactNode;
  /** Hide the export buttons when not needed. */
  hideExport?: boolean;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  onPrint?: () => void;
  /** Path to return to (defaults to /reports). */
  backTo?: string;
}

export function ReportToolbar({
  title,
  subtitle,
  range,
  onRangeChange,
  branch = '',
  onBranchChange,
  filters,
  hideExport,
  onExportExcel,
  onExportPDF,
  onPrint,
  backTo = '/reports',
}: Props) {
  const branches = useBranches((s) => s.items);
  const resolved = useMemo(() => resolveRange(range), [range]);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const presets: DatePreset[] = ['today', 'yesterday', 'thisWeek', 'thisMonth', 'lastMonth', 'thisYear'];

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-end justify-between gap-4 px-6 py-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1 px-2 h-9 rounded-md hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="size-4" /> Reports
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {!hideExport && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={onExportExcel ?? (() => alert('Excel export — wires up at backend stage.'))}>
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={onExportPDF ?? (() => alert('PDF export — wires up at backend stage.'))}>
              <FileText className="size-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onPrint ?? (() => window.print())}>
              <Printer className="size-4" /> Print
            </Button>
          </div>
        )}
      </div>

      {/* Filters card */}
      <div className="px-6 pt-4">
        <Card className="p-3 flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1 text-muted-foreground text-xs px-1">
            <Calendar className="size-3.5" /> Date
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => onRangeChange({ preset: p })}
                className={cn(
                  'px-2.5 h-7 rounded-md text-xs font-medium border transition',
                  range.preset === p
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-secondary',
                )}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
            <button
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                onRangeChange({ preset: 'custom', from: today, to: today });
              }}
              className={cn(
                'px-2.5 h-7 rounded-md text-xs font-medium border transition',
                range.preset === 'custom'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-secondary',
              )}
            >
              Custom
            </button>
          </div>

          {range.preset === 'custom' && (
            <div className="flex items-center gap-1 ml-1">
              <input
                type="date"
                value={range.from?.slice(0, 10) ?? ''}
                onChange={(e) => onRangeChange({ ...range, from: e.target.value })}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <input
                type="date"
                value={range.to?.slice(0, 10) ?? ''}
                onChange={(e) => onRangeChange({ ...range, to: e.target.value })}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
              />
            </div>
          )}

          {onBranchChange && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <div className="inline-flex items-center gap-1 text-muted-foreground text-xs px-1">
                <Building2 className="size-3.5" /> Branch
              </div>
              <select
                value={branch}
                onChange={(e) => onBranchChange(e.target.value)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </>
          )}

          {filters && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <div className="flex items-center gap-2 flex-wrap">{filters}</div>
            </>
          )}

          <span className="ml-auto text-[11px] text-muted-foreground tabular">
            {fmt(resolved.from)} – {fmt(resolved.to)}
          </span>
        </Card>
      </div>
    </div>
  );
}

/** Convenience defaults so each report can drop in with `useState` cleanly. */
export const DEFAULT_RANGE: DateRange = { preset: 'thisMonth' };
