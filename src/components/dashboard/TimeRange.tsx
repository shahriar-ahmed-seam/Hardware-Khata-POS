import { useEffect, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Popover } from '@/components/ui/Popover';
import { Button } from '@/components/ui/Button';
import { useDashboard, type TimeRange as TR } from '@/stores/dashboard';

const LABELS: Record<TR, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This Week',
  month: 'This Month',
  lastMonth: 'Last Month',
  custom: 'Custom',
};

const OPTIONS: TR[] = ['today', 'yesterday', 'week', 'month', 'lastMonth', 'custom'];

/** Local YYYY-MM-DD, which is what <input type="date"> uses. */
function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function TimeRange() {
  const { range, setRange, customRange, setCustomRange } = useDashboard();

  /**
   * CUSTOM RANGE — held locally until Apply.
   *
   * The two date boxes used to call `setCustomRange` on every keystroke, each with
   * `?? ''` for the other end. `<input type="date">` fires change on every partial
   * edit, so typing a start date wrote { from: '2026-01-0', to: '' } — an empty
   * `to`, which `toRangeInput` turns into an invalid window, so the whole
   * dashboard refetched several times and landed on a range with no end. Then
   * `defaultValue` (not `value`) meant the boxes did not even show what was
   * stored.
   *
   * Now: edit freely, and NOTHING is applied until both ends are filled and Apply
   * is pressed. One refetch, over a range the user actually chose.
   */
  const today = isoDay(new Date());
  const [from, setFrom] = useState(customRange?.from ?? today);
  const [to, setTo] = useState(customRange?.to ?? today);

  // Re-seed the boxes whenever the popover opens on a stored range, so they show
  // what is actually being applied.
  useEffect(() => {
    if (customRange) {
      setFrom(customRange.from);
      setTo(customRange.to);
    }
  }, [customRange]);

  const swapped = !!from && !!to && from > to;
  const canApply = !!from && !!to && !swapped;

  return (
    <Popover
      width="w-72"
      align="right"
      trigger={(_o, set) => (
        <button
          onClick={() => set(true)}
          title={`Range: ${LABELS[range]}`}
          aria-label="Time range"
          className="h-9 px-2.5 inline-flex items-center gap-1 rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition"
        >
          <Calendar className="size-4" />
          <span className="text-[11px] font-medium hidden xl:inline">{LABELS[range]}</span>
          <ChevronDown className="size-3" />
        </button>
      )}
    >
      {(close) => (
        <div className="py-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                if (opt !== 'custom') {
                  setRange(opt);
                  close();
                } else {
                  setRange('custom');
                }
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-secondary ${
                range === opt ? 'text-primary font-medium' : ''
              }`}
            >
              {LABELS[opt]}
            </button>
          ))}
          {range === 'custom' && (
            <div className="border-t border-border mt-2 pt-3 px-3 pb-3 space-y-2">
              <div className="text-[10px] uppercase text-muted-foreground">Custom range</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] text-muted-foreground">From</span>
                  <input
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-muted-foreground">To</span>
                  <input
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                  />
                </label>
              </div>
              {swapped && (
                <div className="text-[10px] text-destructive">
                  The end date is before the start date.
                </div>
              )}
              <Button
                size="sm"
                className="w-full"
                disabled={!canApply}
                onClick={() => {
                  // Applied once, with BOTH ends present — see the note above.
                  setCustomRange(from, to);
                  close();
                }}
              >
                Apply
              </Button>
              {customRange && (
                <div className="text-[10px] text-muted-foreground text-center">
                  Showing {customRange.from} to {customRange.to}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
