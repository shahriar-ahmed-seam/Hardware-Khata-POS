import { useEffect, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Popover } from '@/components/ui/Popover';
import { Button } from '@/components/ui/Button';
import { useDashboard, type TimeRange as TR } from '@/stores/dashboard';
import { todayLocalDateInput } from '@/lib/datetime';
import { formatDayMonth } from '@/lib/formatDate';
import { useLang } from '@/lib/i18n';
import { RANGE_LABEL } from './range';

const LABELS: Record<TR, string> = { ...RANGE_LABEL, custom: 'Custom dates' };

const OPTIONS: TR[] = ['today', 'yesterday', 'week', 'month', 'lastMonth', 'custom'];

export function TimeRange() {
  const { range, setRange, customRange, setCustomRange } = useDashboard();
  const lang = useLang((s) => s.lang);
  // Custom: the trigger shows the dates themselves ("1 Jan – 31 Jan").
  const customText =
    range === 'custom' && customRange
      ? `${formatDayMonth(customRange.from + 'T00:00', { lang })} – ${formatDayMonth(customRange.to + 'T00:00', { lang })}`
      : null;

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
  // Today on the SHOP's clock. `toISOString().slice(0, 10)` would name the UTC
  // day, which in UTC+6 is yesterday for the last six hours of every evening.
  const today = todayLocalDateInput();
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
          aria-label="Time range"
          className="h-10 px-3 inline-flex items-center gap-1.5 rounded-md border border-border hover:bg-secondary text-foreground transition"
        >
          <Calendar className="size-4 text-muted-foreground" />
          {customText ? (
            <span className="text-sm font-medium tabular whitespace-nowrap" data-no-i18n>
              {customText}
            </span>
          ) : (
            <span className="text-sm font-medium whitespace-nowrap">{LABELS[range]}</span>
          )}
          <ChevronDown className="size-4 text-muted-foreground" />
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
              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-secondary ${
                range === opt ? 'text-primary font-medium' : ''
              }`}
            >
              {LABELS[opt]}
            </button>
          ))}
          {range === 'custom' && (
            <div className="border-t border-border mt-2 pt-3 px-3 pb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-muted-foreground">From</span>
                  <input
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground">To</span>
                  <input
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  />
                </label>
              </div>
              {swapped && (
                <div className="text-xs text-destructive">
                  The end date is before the start date.
                </div>
              )}
              <Button
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
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
