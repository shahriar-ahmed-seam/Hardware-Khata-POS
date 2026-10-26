import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Layers, RotateCcw } from 'lucide-react';
import { useDashboard, ALL_KPIS, ALL_WIDGETS } from '@/stores/dashboard';
import { KPI_META } from './kpiRegistry';
import { WIDGET_META } from './widgetRegistry';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { IconButton } from '@/components/ui/IconButton';
import { Segmented } from '@/components/ui/Segmented';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { confirm } from '@/stores/confirm';
import { cn } from '@/lib/utils';

/**
 * The one place to show, hide and reorder dashboard cards (the in-page pencil
 * "edit mode" with 24px arrows is gone). Shown items come first, in order,
 * each with ↑ / ↓; hidden ones below with a tick box.
 */
export function CustomizePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    kpis,
    widgets,
    toggleKpi,
    toggleWidget,
    moveKpi,
    moveWidget,
    resetLayout,
    showDeltas,
    setShowDeltas,
  } = useDashboard();
  const [tab, setTab] = useState<'kpi' | 'widget'>('kpi');

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset to the default layout?',
      message: 'The cards you chose and their order go back to how they started.',
      confirmLabel: 'Reset',
      cancelLabel: 'Keep mine',
    });
    if (ok) resetLayout();
  };

  const kpiItems = (id: (typeof ALL_KPIS)[number]) => ({
    id,
    label: KPI_META[id].label,
    desc: KPI_META[id].description,
    icon: KPI_META[id].icon,
  });
  const widgetItems = (id: (typeof ALL_WIDGETS)[number]) => ({
    id,
    label: WIDGET_META[id].label,
    desc: WIDGET_META[id].description,
    icon: Layers,
  });

  return (
    <Drawer open={open} onClose={onClose} width="max-w-md" title="Customize dashboard" subtitle="Show, hide and reorder cards">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-5 pt-4">
          <Segmented
            ariaLabel="What to customize"
            fullWidth
            value={tab}
            onChange={setTab}
            options={[
              { value: 'kpi', label: 'Numbers' },
              { value: 'widget', label: 'Charts & lists' },
            ]}
          />
        </div>
        <div className="flex-1 overflow-auto p-5 space-y-2">
          {tab === 'kpi' ? (
            <>
              <ToggleRow
                label="Show comparison with the previous period"
                checked={showDeltas}
                onChange={setShowDeltas}
              />
              <Section
                shown={kpis.map(kpiItems)}
                hidden={ALL_KPIS.filter((id) => !kpis.includes(id)).map(kpiItems)}
                onToggle={(id) => toggleKpi(id as (typeof ALL_KPIS)[number])}
                onMove={(id, d) => moveKpi(id as (typeof ALL_KPIS)[number], d)}
              />
            </>
          ) : (
            <Section
              shown={widgets.map(widgetItems)}
              hidden={ALL_WIDGETS.filter((id) => !widgets.includes(id)).map(widgetItems)}
              onToggle={(id) => toggleWidget(id as (typeof ALL_WIDGETS)[number])}
              onMove={(id, d) => moveWidget(id as (typeof ALL_WIDGETS)[number], d)}
            />
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => void reset()}>
            <RotateCcw className="size-4" /> Reset
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Drawer>
  );
}

type Item = { id: string; label: string; desc: string; icon: any };

function Section({
  shown,
  hidden,
  onToggle,
  onMove,
}: {
  shown: Item[];
  hidden: Item[];
  onToggle: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  return (
    <>
      <div className="pt-2 text-sm font-semibold">On the dashboard</div>
      {shown.length === 0 && <div className="text-sm text-muted-foreground">Nothing shown.</div>}
      {shown.map((m, i) => (
        <Row key={m.id} item={m} on onToggle={() => onToggle(m.id)}>
          <IconButton label="Move up" size="sm" disabled={i === 0} onClick={() => onMove(m.id, -1)}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton
            label="Move down"
            size="sm"
            disabled={i === shown.length - 1}
            onClick={() => onMove(m.id, 1)}
          >
            <ArrowDown className="size-4" />
          </IconButton>
        </Row>
      ))}
      {hidden.length > 0 && <div className="pt-3 text-sm font-semibold">Not shown</div>}
      {hidden.map((m) => (
        <Row key={m.id} item={m} on={false} onToggle={() => onToggle(m.id)} />
      ))}
    </>
  );
}

function Row({
  item,
  on,
  onToggle,
  children,
}: {
  item: Item;
  on: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  const Icon = item.icon;
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg border transition',
        on ? 'border-primary/40 bg-primary/5' : 'border-border',
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        onClick={onToggle}
        className="flex-1 min-w-0 flex items-center gap-3 p-1 rounded-md text-left focus-ring"
      >
        <span
          className={cn(
            'size-5 rounded grid place-items-center border-2 shrink-0',
            on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50',
          )}
        >
          {on && <Check className="size-3.5" />}
        </span>
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block text-sm font-medium">{item.label}</span>
          <span className="block text-xs text-muted-foreground">{item.desc}</span>
        </span>
      </button>
      {children}
    </div>
  );
}
