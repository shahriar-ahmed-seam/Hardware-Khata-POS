import { ComponentProps, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Printer, ArrowLeft, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { FormField } from '@/components/ui/FormField';
import { PrintSheet } from '@/components/ui/PrintSheet';
import { useIsMultiBranch } from '@/components/stock/hooks';
import { useBranches } from '@/stores/branches';
import { useSettings } from '@/stores/settings';
import { useDateFormat } from '@/lib/formatDate';
import { printSheet } from '@/lib/printing';
import {
  endOfLocalDay,
  parseRangeBound,
  startOfBusinessWeek,
  startOfLocalDay,
  toLocalDateInput,
  todayLocalDateInput,
} from '@/lib/datetime';
import { downloadCsv, ReportPrintDoc, type ReportDoc, type ReportMeta } from './reportExport';

/**
 * Date range presets shared across all reports.
 *
 * `today`/`yesterday` are exact-day ranges. `thisWeek` starts on Saturday
 * (BD norm). `thisMonth`/`lastMonth` are calendar months. `thisYear` is from
 * Jan 1. `custom` is user-picked.
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
const PRESETS = Object.keys(PRESET_LABELS) as DatePreset[];
export const isDatePreset = (v: unknown): v is DatePreset => typeof v === 'string' && v in PRESET_LABELS;

/**
 * Resolve a preset into concrete local bounds. Mirrors `resolveRange()` in
 * `backend/core/dates.ts`, which the report queries are computed against.
 */
export function resolveRange(r: DateRange): { from: Date; to: Date } {
  const now = new Date();
  switch (r.preset) {
    case 'today':
      return { from: startOfLocalDay(now), to: endOfLocalDay(now) };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfLocalDay(y), to: endOfLocalDay(y) };
    }
    case 'thisWeek':
      return { from: startOfBusinessWeek(now), to: endOfLocalDay(now) };
    case 'thisMonth':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), to: endOfLocalDay(now) };
    case 'lastMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from, to };
    }
    case 'thisYear':
      return { from: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0), to: endOfLocalDay(now) };
    case 'custom': {
      let from = r.from ? parseRangeBound(r.from, 'from') : startOfLocalDay(now);
      let to = r.to ? parseRangeBound(r.to, 'to') : endOfLocalDay(now);
      // Entered the wrong way round: swap (same rule as the backend).
      if (from > to) [from, to] = [to, from];
      return { from, to };
    }
  }
}

export function isInRange(iso: string, range: DateRange): boolean {
  const t = new Date(iso).getTime();
  const { from, to } = resolveRange(range);
  return t >= from.getTime() && t <= to.getTime();
}

interface Props {
  title: string;
  /** Kept for old call sites; the period line is the subtitle now. */
  subtitle?: string;
  /** Omit both for reports that ignore dates (stock, balances): presets hide. */
  range?: DateRange;
  onRangeChange?: (r: DateRange) => void;
  /** Shown instead of the period when there is no range, e.g. "Stock as of now". */
  asOf?: string;
  branch?: string; // branch name; '' = all
  /** The picker shows only when the shop has two or more branches. */
  onBranchChange?: (b: string) => void;
  /** Report-specific filters, on the same row as the presets. */
  filters?: ReactNode;
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  /** Builds what Print and "Save for Excel" output. Both hide without it. */
  exportDoc?: () => ReportDoc;
  /** Extra header actions (left of Print). */
  actions?: ReactNode;
  hideExport?: boolean;
  /** Old escape hatch; `exportDoc` is preferred. */
  onPrint?: () => void;
  backTo?: string;
}

export function ReportToolbar({
  title,
  range,
  onRangeChange,
  asOf,
  branch = '',
  onBranchChange,
  filters,
  search,
  exportDoc,
  actions,
  hideExport,
  onPrint,
  backTo = '/reports',
}: Props) {
  const branches = useBranches((s) => s.items);
  const multiBranch = useIsMultiBranch();
  const shop = useSettings((s) => s.business.name);
  const df = useDateFormat();
  const resolved = useMemo(() => (range ? resolveRange(range) : null), [range]);

  const sameDay = resolved && df.date(resolved.from) === df.date(resolved.to);
  const periodText = resolved
    ? sameDay
      ? df.date(resolved.from)
      : `${df.date(resolved.from)} – ${df.date(resolved.to)}`
    : df.dateTime(new Date());

  // ---- print: mount the A4 sheet, print it, unmount.
  const [printDoc, setPrintDoc] = useState<ReportDoc | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const meta: ReportMeta = { shop, title, period: asOf && !resolved ? `${asOf} ${periodText}` : periodText };
  useEffect(() => {
    if (!printDoc) return;
    let alive = true;
    // One frame so the Bangla layer has translated the sheet.
    const t = setTimeout(() => {
      void printSheet(sheetRef.current, { kind: 'document' }).finally(() => {
        if (alive) setPrintDoc(null);
      });
    }, 50);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [printDoc]);

  const canExport = !hideExport && !!exportDoc;
  const showPrint = !hideExport && (!!exportDoc || !!onPrint);

  return (
    <div className="print:hidden">
      <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1 px-3 h-10 rounded-md border border-border hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition focus-ring shrink-0"
          >
            <ArrowLeft className="size-4" /> Reports
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight truncate">{title}</h1>
            <p className="text-sm text-foreground/80 tabular truncate">
              {asOf && !resolved && <span>{asOf}</span>} <span>{periodText}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {canExport && (
            <Button variant="outline" onClick={() => downloadCsv(meta, exportDoc!())} title="CSV file — opens in Excel">
              <FileSpreadsheet className="size-4" /> Save for Excel
            </Button>
          )}
          {showPrint && (
            <Button
              variant="outline"
              disabled={!!printDoc}
              onClick={() => (exportDoc ? setPrintDoc(exportDoc()) : onPrint?.())}
            >
              <Printer className="size-4" /> Print
            </Button>
          )}
        </div>
      </div>

      {(range || filters || search || (multiBranch && onBranchChange)) && (
        <div className="px-6 pb-1 flex items-end gap-3 flex-wrap">
          {range && onRangeChange && (
            <Segmented
              ariaLabel="Date range"
              value={range.preset}
              onChange={(p) =>
                p === 'custom'
                  ? onRangeChange({
                      preset: 'custom',
                      from: range.from ?? todayLocalDateInput(),
                      to: range.to ?? todayLocalDateInput(),
                    })
                  : onRangeChange({ preset: p })
              }
              options={PRESETS.map((p) => ({ value: p, label: PRESET_LABELS[p] }))}
            />
          )}
          {range?.preset === 'custom' && onRangeChange && (
            // toLocalDateInput, not slice(0,10): the stored bound may be a UTC instant.
            <div className="flex items-end gap-2">
              <FormField label="From">
                {(f) => (
                  <Input
                    {...f}
                    type="date"
                    className="w-40 tabular"
                    value={range.from ? toLocalDateInput(range.from) : ''}
                    onChange={(e) => onRangeChange({ ...range, from: e.target.value })}
                  />
                )}
              </FormField>
              <FormField label="To">
                {(f) => (
                  <Input
                    {...f}
                    type="date"
                    className="w-40 tabular"
                    value={range.to ? toLocalDateInput(range.to) : ''}
                    onChange={(e) => onRangeChange({ ...range, to: e.target.value })}
                  />
                )}
              </FormField>
            </div>
          )}
          {multiBranch && onBranchChange && (
            <Select
              aria-label="Branch"
              value={branch}
              onChange={(e) => onBranchChange(e.target.value)}
              className="w-auto min-w-40"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
          {filters}
          {search && (
            <div className="relative w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="search"
                aria-label={search.placeholder}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder}
                className="pl-9"
              />
            </div>
          )}
        </div>
      )}

      {printDoc && (
        <PrintSheet paper="A4">
          <ReportPrintDoc ref={sheetRef} meta={meta} doc={printDoc} />
        </PrintSheet>
      )}
    </div>
  );
}

/** A filter dropdown for the toolbar row (40px, sized to its content). */
export function ReportSelect(props: ComponentProps<typeof Select>) {
  return <Select {...props} className={['w-auto min-w-40', props.className].filter(Boolean).join(' ')} />;
}

/** Convenience default so each report can drop in with `useState` cleanly. */
export const DEFAULT_RANGE: DateRange = { preset: 'thisMonth' };
