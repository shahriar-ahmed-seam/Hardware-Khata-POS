import { useEffect, useState } from 'react';
import { Settings2, RefreshCw, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDashboard } from '@/stores/dashboard';
import { renderKpi } from '@/components/dashboard/kpiRegistry';
import { renderWidget, WIDGET_META } from '@/components/dashboard/widgetRegistry';
import { CustomizePanel } from '@/components/dashboard/CustomizePanel';
import { TimeRange } from '@/components/dashboard/TimeRange';
import { ProfitDetail } from '@/components/dashboard/ProfitDetail';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { DuesPanel } from '@/components/dashboard/DuesPanel';
import { DashboardDataProvider, useDashboardData } from '@/hooks/useDashboardData';
import { formatDate } from '@/lib/formatDate';
import { useLang } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  return (
    <DashboardDataProvider>
      <DashboardContent />
    </DashboardDataProvider>
  );
}

const WEEKDAYS = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  bn: ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'],
} as const;

function DashboardContent() {
  const { kpis, widgets, showDeltas } = useDashboard();
  const { refresh, backend, error } = useDashboardData();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [profitOpen, setProfitOpen] = useState(false);

  // Today's date in the shop's format and the UI language. The branch is not
  // repeated here: the titlebar already names it.
  const lang = useLang((s) => s.lang);
  const now = new Date();
  const subtitle = `${WEEKDAYS[lang === 'bn' ? 'bn' : 'en'][now.getDay()]}, ${formatDate(now, { lang, pattern: 'DD MMM YYYY' })}`;

  /**
   * 30s auto-refresh, skipped while the window is hidden; `visibilitychange`
   * catches up as soon as the owner comes back. (So no Refresh button.)
   */
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const id = setInterval(tick, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={subtitle}
        actions={
          <>
            <TimeRange />
            <Button variant="outline" onClick={() => setCustomizeOpen(true)}>
              <Settings2 className="size-4" /> Customize
            </Button>
          </>
        }
      />
      <div className="p-6 space-y-5">
        {backend && error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
            <AlertTriangle className="size-8 mx-auto mb-3 text-destructive" />
            <div className="text-base font-semibold text-destructive">Could not load the figures</div>
            <div className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Press Retry. If it keeps failing, restart the app.
            </div>
            <Button variant="outline" className="mt-4" onClick={() => refresh()}>
              <RefreshCw className="size-4" /> Retry
            </Button>
          </div>
        ) : (
          <>
            {/* The numbers first. */}
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
                {kpis.map((id) => (
                  <div key={id}>
                    {renderKpi(id, { showDelta: showDeltas, onOpenProfit: () => setProfitOpen(true) })}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyHint
                title="No numbers on the dashboard"
                onClick={() => setCustomizeOpen(true)}
              />
            )}

            {/* Who owes us / who we owe — what the owner asked to see, so it
                sits right under the numbers, above the fold. */}
            <DuesPanel />

            {/* The daily jobs, one row. */}
            <QuickActions />

            {widgets.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-12 auto-rows-fr gap-4">
                {widgets.map((id) => {
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
                      {renderWidget(id)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyHint title="No charts or lists on the dashboard" onClick={() => setCustomizeOpen(true)} />
            )}
          </>
        )}
      </div>
      <CustomizePanel open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
      <ProfitDetail open={profitOpen} onClose={() => setProfitOpen(false)} />
    </div>
  );
}

function EmptyHint({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40">
      <EmptyState
        compact
        icon={Settings2}
        title={title}
        message="Press Customize to choose what to show."
        action={
          <Button variant="outline" onClick={onClick}>
            <Settings2 className="size-4" /> Customize
          </Button>
        }
      />
    </div>
  );
}
