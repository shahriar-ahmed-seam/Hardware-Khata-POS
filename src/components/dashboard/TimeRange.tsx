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

export function TimeRange() {
  const { range, setRange, customRange, setCustomRange } = useDashboard();

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
                <input
                  type="date"
                  defaultValue={customRange?.from}
                  onChange={(e) => setCustomRange(e.target.value, customRange?.to ?? '')}
                  className="h-8 rounded border border-input bg-background px-2 text-xs"
                />
                <input
                  type="date"
                  defaultValue={customRange?.to}
                  onChange={(e) => setCustomRange(customRange?.from ?? '', e.target.value)}
                  className="h-8 rounded border border-input bg-background px-2 text-xs"
                />
              </div>
              <Button size="sm" className="w-full" onClick={close}>
                Apply
              </Button>
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
