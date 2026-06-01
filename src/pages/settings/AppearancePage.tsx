import { useEffect } from 'react';
import { Save, Palette, Sun, Moon, Monitor, RotateCcw } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/stores/theme';
import { useUI } from '@/stores/ui';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

const PRESET_HUES = [
  { name: 'Indigo', hue: 243 },
  { name: 'Blue', hue: 217 },
  { name: 'Sky', hue: 199 },
  { name: 'Teal', hue: 173 },
  { name: 'Emerald', hue: 152 },
  { name: 'Amber', hue: 38 },
  { name: 'Rose', hue: 350 },
  { name: 'Violet', hue: 270 },
];

/**
 * Applies the accent hue to the global CSS custom property by overriding
 * --primary, --ring, and --sidebar-accent at the :root level. Lightness/
 * saturation are kept constant to match the original indigo palette.
 */
function applyAccentHue(hue: number) {
  const root = document.documentElement;
  root.style.setProperty('--primary', `${hue} 75% 58%`);
  root.style.setProperty('--ring', `${hue} 75% 58%`);
  root.style.setProperty('--sidebar-accent', `${hue} 75% 58%`);
}

function applyFontScale(scale: number) {
  document.documentElement.style.fontSize = `${scale * 16}px`;
}

export default function AppearancePage() {
  const a = useSettings((s) => s.appearance);
  const set = useSettings((s) => s.setAppearance);
  const reset = () =>
    set({ themeMode: 'system', accentHue: 243, density: 'comfortable', fontScale: 1 });

  const themeMode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);
  const setDensity = useUI((s) => s.setDensity);

  // Keep visible side-effects in sync with persisted appearance state
  useEffect(() => {
    applyAccentHue(a.accentHue);
  }, [a.accentHue]);
  useEffect(() => {
    applyFontScale(a.fontScale);
  }, [a.fontScale]);
  useEffect(() => {
    setDensity(a.density);
  }, [a.density, setDensity]);

  return (
    <div>
      <SettingsHeader
        title="Theme & Appearance"
        subtitle="Mode, accent color, density, and font size"
        actions={
          <>
            <Button variant="outline" onClick={() => { reset(); toast.info('Appearance reset to defaults'); }}>
              <RotateCcw className="size-4" /> Reset
            </Button>
            <Button onClick={() => toast.success('Appearance saved')}>
              <Save className="size-4" /> Saved
            </Button>
          </>
        }
      />

      <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
        {/* LEFT — controls */}
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Theme mode</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { v: 'light', label: 'Light', Icon: Sun },
                  { v: 'dark', label: 'Dark', Icon: Moon },
                  { v: 'system', label: 'System', Icon: Monitor },
                ] as const
              ).map(({ v, label, Icon }) => (
                <button
                  key={v}
                  onClick={() => {
                    set({ themeMode: v });
                    setMode(v);
                  }}
                  className={cn(
                    'h-16 rounded-md border flex flex-col items-center justify-center gap-1 transition',
                    themeMode === v
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  <Icon className="size-4" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Accent color</div>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_HUES.map((p) => (
                <button
                  key={p.hue}
                  onClick={() => set({ accentHue: p.hue })}
                  className={cn(
                    'h-12 rounded-md border flex flex-col items-center justify-center gap-1 transition text-[11px] font-medium',
                    a.accentHue === p.hue
                      ? 'border-foreground/40 ring-2 ring-ring/50'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  <span
                    className="size-5 rounded-full"
                    style={{ backgroundColor: `hsl(${p.hue} 75% 58%)` }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                Custom hue ({a.accentHue}°)
              </label>
              <input
                type="range"
                min={0}
                max={360}
                value={a.accentHue}
                onChange={(e) => set({ accentHue: Number(e.target.value) })}
                className="w-full"
                style={{
                  background:
                    'linear-gradient(to right, hsl(0 75% 58%), hsl(60 75% 58%), hsl(120 75% 58%), hsl(180 75% 58%), hsl(240 75% 58%), hsl(300 75% 58%), hsl(360 75% 58%))',
                  borderRadius: 999,
                  height: 8,
                  appearance: 'none',
                }}
              />
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Density</div>
            <div className="grid grid-cols-2 gap-2">
              {(['compact', 'comfortable'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => set({ density: d })}
                  className={cn(
                    'h-12 rounded-md border text-sm font-medium capitalize transition',
                    a.density === d
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Compact reduces row heights and paddings across lists. Useful on smaller screens.
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Font size</div>
            <div className="grid grid-cols-4 gap-2">
              {([0.9, 1, 1.1, 1.2] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => set({ fontScale: s })}
                  className={cn(
                    'h-12 rounded-md border font-medium transition',
                    a.fontScale === s
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-secondary',
                  )}
                  style={{ fontSize: `${s * 14}px` }}
                >
                  {s === 1 ? 'Default' : `${Math.round(s * 100)}%`}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Applies to the whole app. Useful for older shop floors with larger displays.
            </div>
          </Card>
        </div>

        {/* RIGHT — preview */}
        <div>
          <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em] mb-2">
            Preview
          </div>
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary text-primary-foreground grid place-items-center">
                <Palette className="size-5" />
              </div>
              <div>
                <div className="font-semibold text-sm">Hardware POS</div>
                <div className="text-xs text-muted-foreground">Mirpur Branch</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button>Primary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secondary</Button>
            </div>
            <div className="rounded-md border border-border bg-card divide-y divide-border">
              {['Cement OPC 50kg', 'Claw Hammer 16oz', 'PVC Pipe 1in 6m'].map((n, i) => (
                <div
                  key={n}
                  className={cn(
                    'flex items-center justify-between',
                    a.density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3',
                  )}
                >
                  <div>
                    <div className="text-sm font-medium">{n}</div>
                    <div className="text-[11px] text-muted-foreground">In stock</div>
                  </div>
                  <div className="text-sm tabular font-semibold text-primary">
                    ৳ {(540 + i * 10).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
