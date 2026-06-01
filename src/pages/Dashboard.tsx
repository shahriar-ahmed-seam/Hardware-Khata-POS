import { useEffect, useState } from 'react';
import { Settings2, Pencil, RefreshCw, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { useDashboard } from '@/stores/dashboard';
import { renderKpi } from '@/components/dashboard/kpiRegistry';
import { renderWidget, WIDGET_META } from '@/components/dashboard/widgetRegistry';
import { CustomizePanel } from '@/components/dashboard/CustomizePanel';
import { Shortcuts } from '@/components/dashboard/Shortcuts';
import { TimeRange } from '@/components/dashboard/TimeRange';
import { ProfitDetail } from '@/components/dashboard/ProfitDetail';
import { DashboardDataProvider, useDashboardData } from '@/hooks/useDashboardData';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  return (
    <DashboardDataProvider>
      <DashboardContent />
    </DashboardDataProvider>
  );
}

function DashboardContent() {
  const { kpis, widgets, showDeltas, toggleKpi, toggleWidget, moveKpi, moveWidget } =
    useDashboard();
  const { refresh, backend, error } = useDashboardData();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profitOpen, setProfitOpen] = useState(false);

  // 30s auto-refresh: full refetch of the backend bundle (no-op on mock).
  useEffect(() => {
    const id = setInterval(() => refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Tuesday, May 26, 2026 · Mirpur Branch"
        actions={
          <>
            <TimeRange />
            <IconAction
              title="Refresh"
              onClick={() => refresh()}
            >
              <RefreshCw className="size-4" />
            </IconAction>
            <IconAction
              title={editing ? 'Done editing' : 'Edit layout'}
              active={editing}
              onClick={() => setEditing((e) => !e)}
            >
              <Pencil className="size-4" />
            </IconAction>
            <IconAction title="Customize dashboard" onClick={() => setCustomizeOpen(true)}>
              <Settings2 className="size-4" />
            </IconAction>
            <Shortcuts onOpenProfit={() => setProfitOpen(true)} />
          </>
        }
      />

      <div className="p-6 space-y-6">
        {backend && error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
            <AlertTriangle className="size-8 mx-auto mb-3 text-destructive" />
            <div className="text-sm font-semibold text-destructive">
              Couldn't load dashboard data
            </div>
            <div className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              The backend request failed, so live figures aren't available. Mock numbers are
              intentionally hidden so they can't be mistaken for real data.
            </div>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refresh()}>
              <RefreshCw className="size-3.5" /> Retry
            </Button>
          </div>
        ) : (
          <>
            {/* KPIs */}
            {kpis.length > 0 ? (
          <div
            className={cn(
              'grid gap-4',
              kpis.length === 1
                ? 'grid-cols-1'
                : kpis.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : kpis.length === 3
                    ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
                    : kpis.length === 4
                      ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
                      : kpis.length === 5
                        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-5'
                        : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6',
            )}
          >
            {kpis.map((id, i) => (
              <KpiSlot
                key={id}
                first={i === 0}
                last={i === kpis.length - 1}
                editing={editing}
                onMoveLeft={() => moveKpi(id, -1)}
                onMoveRight={() => moveKpi(id, 1)}
              >
                {renderKpi(id, {
                  showDelta: showDeltas,
                  removable: editing,
                  onRemove: () => toggleKpi(id),
                  onOpenProfit: () => setProfitOpen(true),
                })}
              </KpiSlot>
            ))}
          </div>
        ) : (
          <EmptyHint kind="KPIs" onClick={() => setCustomizeOpen(true)} />
        )}

        {/* Widgets */}
        {widgets.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 auto-rows-fr gap-4">
            {widgets.map((id, i) => {
              const span = WIDGET_META[id].span;
              return (
                <div
                  key={id}
                  className={cn(
                    'col-span-1 flex',
                    span === 4 && 'xl:col-span-4',
                    span === 6 && 'xl:col-span-6',
                    span === 8 && 'xl:col-span-8',
                    span === 12 && 'xl:col-span-12',
                  )}
                >
                  {renderWidget(id, {
                    removable: editing,
                    onRemove: () => toggleWidget(id),
                    canMoveUp: editing && i > 0,
                    canMoveDown: editing && i < widgets.length - 1,
                    onMoveUp: () => moveWidget(id, -1),
                    onMoveDown: () => moveWidget(id, 1),
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyHint kind="widgets" onClick={() => setCustomizeOpen(true)} />
        )}
          </>
        )}
      </div>

      {customizeOpen && <CustomizePanel onClose={() => setCustomizeOpen(false)} />}
      <ProfitDetail open={profitOpen} onClose={() => setProfitOpen(false)} />
    </div>
  );
}

function IconAction({
  children,
  title,
  onClick,
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'h-9 w-9 grid place-items-center rounded-md border transition',
        active
          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
          : 'border-border hover:bg-secondary text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function KpiSlot({
  children,
  editing,
  first,
  last,
  onMoveLeft,
  onMoveRight,
}: {
  children: React.ReactNode;
  editing: boolean;
  first: boolean;
  last: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}) {
  if (!editing) return <>{children}</>;
  return (
    <div className="relative">
      {children}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center bg-card border border-border rounded-md shadow-sm">
        <button
          onClick={onMoveLeft}
          disabled={first}
          className="size-6 grid place-items-center disabled:opacity-30 hover:bg-secondary rounded-l-md text-xs"
          title="Move left"
        >
          ←
        </button>
        <button
          onClick={onMoveRight}
          disabled={last}
          className="size-6 grid place-items-center disabled:opacity-30 hover:bg-secondary rounded-r-md text-xs"
          title="Move right"
        >
          →
        </button>
      </div>
    </div>
  );
}

function EmptyHint({ kind, onClick }: { kind: string; onClick: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-muted-foreground">
      <div className="text-sm">No {kind} added.</div>
      <Button variant="outline" size="sm" className="mt-3" onClick={onClick}>
        <Settings2 className="size-3.5" /> Customize
      </Button>
    </div>
  );
}
