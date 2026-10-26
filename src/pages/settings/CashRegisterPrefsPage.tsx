import { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Lock, ShieldAlert } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { AutoSaveNote } from '@/components/settings/AutoSaveNote';
import { Card } from '@/components/ui/Card';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { NumberField } from '@/components/ui/NumberField';
import { FormField } from '@/components/ui/FormField';
import { useSettings } from '@/stores/settings';
import { formatBDT } from '@/lib/utils';

export default function CashRegisterPrefsPage() {
  const c = useSettings((s) => s.cashRegister);
  const set = useSettings((s) => s.setCashRegister);
  const badOrder = c.varianceBlock > 0 && c.varianceWarn >= c.varianceBlock;

  return (
    <div>
      <SettingsHeader title="Cash Register" actions={<AutoSaveNote />} />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" />
              <div className="text-sm font-semibold">Variance thresholds</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Variance is the difference between the expected drawer and the counted cash when a shift closes.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Warn when short or over by">
                {(f) => (
                  <NumberField {...f} value={c.varianceWarn} onChangeNumber={(v) => set({ varianceWarn: v })} />
                )}
              </FormField>
              <FormField
                label="Stop closing when short or over by"
                error={badOrder ? 'Must be more than the warning amount' : undefined}
              >
                {(f) => (
                  <NumberField {...f} value={c.varianceBlock} onChangeNumber={(v) => set({ varianceBlock: v })} />
                )}
              </FormField>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" />
              <div className="text-sm font-semibold">Shift defaults</div>
            </div>
            <FormField
              label="Default carried float at open"
              hint="Pre-fill the Open Shift modal with this amount. Cashier can override."
            >
              {(f) => (
                <NumberField
                  {...f}
                  value={c.defaultCarriedFloat}
                  onChangeNumber={(v) => set({ defaultCarriedFloat: v })}
                />
              )}
            </FormField>
          </Card>

          <Card className="p-4 space-y-1">
            <div className="text-sm font-semibold mb-2">Authorization</div>
            <ToggleRow
              label="Owner or manager must close a shift over the block limit"
              desc="A cashier cannot close a shift whose variance is at or over the block limit. The owner or a manager signs in and closes it."
              checked={c.requireManagerPinOnVariance}
              onChange={(v) => set({ requireManagerPinOnVariance: v })}
            />
          </Card>
        </div>

        {/* RIGHT — what the cashier sees at each level; amounts in their own nodes. */}
        <div>
          <div className="text-sm font-medium mb-2">What cashiers will see</div>
          <Card className="p-4 space-y-3">
            <Level
              tone="ok"
              title="Within range"
              range={
                <>
                  <span>Less than</span> <Amt v={c.varianceWarn} />
                </>
              }
              note="Shift closes silently."
            />
            <Level
              tone="warn"
              title="Warning"
              range={
                <>
                  <Amt v={c.varianceWarn} /> <span>to</span> <Amt v={c.varianceBlock} />
                </>
              }
              note="Yellow notice on Z-Report. Cashier can still close."
            />
            <Level
              tone="block"
              title="Blocked"
              range={
                <>
                  <Amt v={c.varianceBlock} /> <span>or more</span>
                </>
              }
              note="The owner or a manager must close it (if enabled)."
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Amt({ v }: { v: number }) {
  return (
    <span className="tabular font-medium text-foreground" data-no-i18n>
      {formatBDT(v)}
    </span>
  );
}

const LEVEL = {
  ok: { box: 'bg-success/10 border-success/20', text: 'text-success', Icon: CheckCircle2 },
  warn: { box: 'bg-warning/10 border-warning/20', text: 'text-warning', Icon: AlertTriangle },
  block: { box: 'bg-destructive/10 border-destructive/20', text: 'text-destructive', Icon: ShieldAlert },
} as const;

function Level({
  tone,
  title,
  range,
  note,
}: {
  tone: keyof typeof LEVEL;
  title: string;
  range: ReactNode;
  note: string;
}) {
  const { box, text, Icon } = LEVEL[tone];
  return (
    <div className={`flex items-start gap-3 p-3 rounded-md border ${box}`}>
      <Icon className={`size-5 mt-0.5 shrink-0 ${text}`} aria-hidden />
      <div>
        <div className={`text-sm font-semibold ${text}`}>{title}</div>
        <div className="text-sm text-muted-foreground">{range}</div>
        <div className="text-sm text-muted-foreground">{note}</div>
      </div>
    </div>
  );
}
