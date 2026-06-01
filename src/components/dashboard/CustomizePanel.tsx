import { useState } from 'react';
import { Check, Layers, Settings2, RotateCcw, X } from 'lucide-react';
import { useDashboard, ALL_KPIS, ALL_WIDGETS } from '@/stores/dashboard';
import { KPI_META } from './kpiRegistry';
import { WIDGET_META } from './widgetRegistry';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export function CustomizePanel({ onClose }: { onClose: () => void }) {
  const { kpis, widgets, toggleKpi, toggleWidget, resetLayout, showDeltas, setShowDeltas } = useDashboard();
  const [tab, setTab] = useState<'kpi' | 'widget' | 'options'>('kpi');

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end animate-fade-in">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Settings2 className="size-5 text-primary" />
          <div className="flex-1">
            <div className="font-semibold">Customize Dashboard</div>
            <div className="text-xs text-muted-foreground">Show, hide, and reorder cards</div>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-md hover:bg-secondary">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 mx-5 mt-3 bg-secondary rounded-md text-xs">
          {(['kpi', 'widget', 'options'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 px-3 py-1.5 rounded font-medium capitalize transition',
                tab === t ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'kpi' ? 'KPIs' : t === 'widget' ? 'Widgets' : 'Options'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-2">
          {tab === 'kpi' &&
            ALL_KPIS.map((id) => {
              const m = KPI_META[id];
              const on = kpis.includes(id);
              const Icon = m.icon;
              return (
                <button
                  key={id}
                  onClick={() => toggleKpi(id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border transition text-left',
                    on ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/40',
                  )}
                >
                  <div className="size-9 rounded-md bg-secondary grid place-items-center">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{m.label}</div>
                    <div className="text-[11px] text-muted-foreground">{m.description}</div>
                  </div>
                  <div
                    className={cn(
                      'size-5 rounded grid place-items-center border-2',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    {on && <Check className="size-3" />}
                  </div>
                </button>
              );
            })}

          {tab === 'widget' &&
            ALL_WIDGETS.map((id) => {
              const m = WIDGET_META[id];
              const on = widgets.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleWidget(id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border transition text-left',
                    on ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/40',
                  )}
                >
                  <div className="size-9 rounded-md bg-secondary grid place-items-center">
                    <Layers className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{m.label}</div>
                    <div className="text-[11px] text-muted-foreground">{m.description}</div>
                  </div>
                  <div
                    className={cn(
                      'size-5 rounded grid place-items-center border-2',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    {on && <Check className="size-3" />}
                  </div>
                </button>
              );
            })}

          {tab === 'options' && (
            <div className="space-y-3">
              <ToggleRow
                label="Show comparison deltas (+12% vs yesterday)"
                checked={showDeltas}
                onChange={setShowDeltas}
              />
              <div className="text-[11px] text-muted-foreground">
                Reorder is available in the dashboard itself — when "Customize" mode is on, use the up/down
                buttons on each card.
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={resetLayout}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/40 transition"
    >
      <span className="text-sm">{label}</span>
      <span
        className={cn(
          'relative inline-block w-9 h-5 rounded-full transition',
          checked ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white transition',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}
