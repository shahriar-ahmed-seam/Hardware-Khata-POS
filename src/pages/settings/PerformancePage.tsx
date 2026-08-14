import { useEffect, useState } from 'react';
import { Gauge, MonitorCog, Sparkles, AlertCircle } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { api, hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';
import { applyReduceAnimations } from '@/lib/perf';
import { cn } from '@/lib/utils';

interface PerfFlags {
  disableHardwareAcceleration: boolean;
  reduceAnimations: boolean;
}

/**
 * SETTINGS → PERFORMANCE
 *
 * Two switches for a slow PC. Both default to OFF, so this screen changes
 * nothing until the owner deliberately turns something on — a "make it faster"
 * setting that silently alters rendering for everyone would be worse than the
 * lag it was meant to fix.
 */
export default function PerformancePage() {
  const [flags, setFlags] = useState<PerfFlags>({
    disableHardwareAcceleration: false,
    reduceAnimations: false,
  });
  const [loaded, setLoaded] = useState(false);
  const [needsRestart, setNeedsRestart] = useState(false);

  useEffect(() => {
    if (!hasBackend()) return;
    void api<PerfFlags>('perf.get', {})
      .then((f) => {
        setFlags(f);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const save = async (patch: Partial<PerfFlags>) => {
    try {
      const next = await api<PerfFlags>('perf.set', patch);
      setFlags(next);
      if ('reduceAnimations' in patch) {
        // Renderer-side and immediate — no restart needed.
        applyReduceAnimations(next.reduceAnimations);
        toast.success(next.reduceAnimations ? 'Animations reduced' : 'Animations restored');
      }
      if ('disableHardwareAcceleration' in patch) {
        setNeedsRestart(true);
        toast.info('Close and open the app for this to take effect');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the setting');
    }
  };

  return (
    <div>
      <SettingsHeader
        title="Performance"
        subtitle="Settings for an older or slower computer"
      />

      <div className="p-6 max-w-3xl space-y-6">
        {needsRestart && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 flex items-start gap-2.5">
            <AlertCircle className="size-4 text-warning mt-0.5 shrink-0" />
            <div className="text-sm">
              Close the app and open it again to apply the graphics setting.
            </div>
          </div>
        )}

        <Card className="p-5 space-y-4">
          <Row
            icon={MonitorCog}
            title="Turn off graphics acceleration"
            desc="Draws the screen using the processor instead of the graphics chip. On an older PC with old graphics drivers this is often smoother and more stable. Needs a restart."
            checked={flags.disableHardwareAcceleration}
            disabled={!loaded}
            onChange={(v) => void save({ disableHardwareAcceleration: v })}
          />

          <div className="border-t border-border" />

          <Row
            icon={Sparkles}
            title="Reduce animations"
            desc="Removes the fade and slide effects when menus and popups open. Less work for a slow machine on every click. Takes effect straight away."
            checked={flags.reduceAnimations}
            disabled={!loaded}
            onChange={(v) => void save({ reduceAnimations: v })}
          />
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground shrink-0">
              <Gauge className="size-5" />
            </div>
            <div className="text-xs text-muted-foreground space-y-2">
              <div>
                These two settings are stored per computer, not in your shop data, so the fast PC
                and the slow PC can be set differently.
              </div>
              <div>
                If the slow PC still struggles, the next biggest win is closing other programs —
                a browser with many tabs open will take memory this app needs.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  desc,
  checked,
  disabled,
  onChange,
}: {
  icon: typeof Gauge;
  title: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="size-10 rounded-md bg-secondary grid place-items-center text-muted-foreground shrink-0">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
        </div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-secondary',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]',
            checked ? 'left-[1.375rem]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}
