import { Save, AlertTriangle, Lock, ShieldAlert } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { NumberField } from '@/components/ui/NumberField';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/toast';

export default function CashRegisterPrefsPage() {
  const c = useSettings((s) => s.cashRegister);
  const set = useSettings((s) => s.setCashRegister);

  return (
    <div>
      <SettingsHeader
        title="Cash Register"
        subtitle="Variance handling and shift defaults"
        actions={
          <Button onClick={() => toast.success('Cash register settings saved')}>
            <Save className="size-4" /> Saved
          </Button>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" />
              <div className="text-sm font-semibold">Variance thresholds (BDT)</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Warn at (≥)
                </label>
                <NumberField
                  value={c.varianceWarn}
                  onChangeNumber={(v) => set({ varianceWarn: v })}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Block at (≥)
                </label>
                <NumberField
                  value={c.varianceBlock}
                  onChangeNumber={(v) => set({ varianceBlock: v })}
                />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Variance is the difference between expected drawer and counted cash on shift close.
              Below warn → silent. Between warn and block → yellow warning, can still close. Above
              block → red, requires manager PIN if enabled.
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" />
              <div className="text-sm font-semibold">Shift defaults</div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                Default carried float at open
              </label>
              <NumberField
                value={c.defaultCarriedFloat}
                onChangeNumber={(v) => set({ defaultCarriedFloat: v })}
              />
              <div className="text-[11px] text-muted-foreground mt-1">
                Pre-fill the Open Shift modal with this amount. Cashier can override.
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-1">
            <div className="text-sm font-semibold mb-2">Authorization</div>
            <ToggleRow
              label="Require manager PIN on variance over block"
              desc="Cashier cannot close a shift with variance ≥ block threshold without a manager PIN."
              checked={c.requireManagerPinOnVariance}
              onChange={(v) => set({ requireManagerPinOnVariance: v })}
            />
          </Card>
        </div>

        {/* RIGHT — preview */}
        <div>
          <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-2">
            What cashiers will see
          </div>
          <Card className="p-4 space-y-3">
            <Threshold
              icon="ok"
              title="Below ৳ 0 – ৳ {warn}"
              warn={c.varianceWarn}
              block={c.varianceBlock}
              kind="ok"
            />
            <Threshold
              icon="warn"
              title="৳ {warn} – ৳ {block}"
              warn={c.varianceWarn}
              block={c.varianceBlock}
              kind="warn"
            />
            <Threshold
              icon="block"
              title="≥ ৳ {block}"
              warn={c.varianceWarn}
              block={c.varianceBlock}
              kind="block"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Threshold({
  title,
  warn,
  block,
  kind,
}: {
  icon: string;
  title: string;
  warn: number;
  block: number;
  kind: 'ok' | 'warn' | 'block';
}) {
  const filled = title.replace('{warn}', warn.toLocaleString()).replace('{block}', block.toLocaleString());
  if (kind === 'ok') {
    return (
      <div className="flex items-start gap-3 p-3 rounded-md bg-success/10 border border-success/20">
        <div className="size-7 rounded-full bg-success/20 grid place-items-center text-success text-xs font-bold">✓</div>
        <div>
          <div className="text-sm font-semibold text-success">Within range</div>
          <div className="text-[12px] text-muted-foreground">{filled}</div>
          <div className="text-[12px] text-muted-foreground">Shift closes silently.</div>
        </div>
      </div>
    );
  }
  if (kind === 'warn') {
    return (
      <div className="flex items-start gap-3 p-3 rounded-md bg-warning/10 border border-warning/20">
        <div className="size-7 rounded-full bg-warning/20 grid place-items-center text-warning">
          <AlertTriangle className="size-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-warning">Warning</div>
          <div className="text-[12px] text-muted-foreground">{filled}</div>
          <div className="text-[12px] text-muted-foreground">
            Yellow notice on Z-Report. Cashier can still close.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20">
      <div className="size-7 rounded-full bg-destructive/20 grid place-items-center text-destructive">
        <ShieldAlert className="size-4" />
      </div>
      <div>
        <div className="text-sm font-semibold text-destructive">Blocked</div>
        <div className="text-[12px] text-muted-foreground">{filled}</div>
        <div className="text-[12px] text-muted-foreground">
          Manager PIN required (if enabled). Locked otherwise.
        </div>
      </div>
    </div>
  );
}
