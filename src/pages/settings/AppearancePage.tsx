import { Sun, Moon, Monitor, RotateCcw, Check } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { AutoSaveNote } from '@/components/settings/AutoSaveNote';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FONT_SCALE_STEPS, snapFontScale, useSettings, type FontScale } from '@/stores/settings';
import { useTheme } from '@/stores/theme';
import { confirm } from '@/stores/confirm';
import { cn } from '@/lib/utils';

/**
 * TEXT SIZE & THEME
 *
 * Text size first: it is the control an older owner comes here for. Every
 * choice saves at once (writePref) and App.tsx applies hue and size live.
 * Density is gone from this page: nothing in the app reads it any more.
 */

// Hues that clash with the success / warning / danger colours are not offered.
const PRESET_HUES = [
  { name: 'Indigo', hue: 243 },
  { name: 'Blue', hue: 217 },
  { name: 'Sky', hue: 199 },
  { name: 'Teal', hue: 173 },
  { name: 'Violet', hue: 270 },
];

const SIZE_LABEL: Record<FontScale, string> = {
  1: 'Normal',
  1.15: 'Large',
  1.3: 'Larger',
  1.45: 'Largest',
};

const THEMES = [
  { v: 'dark', label: 'Dark', Icon: Moon },
  { v: 'light', label: 'Light', Icon: Sun },
  { v: 'system', label: 'System', Icon: Monitor },
] as const;

/** Selected = filled accent + a tick, so the state is not shown by colour alone. */
const choice = (on: boolean) =>
  cn(
    'rounded-md border flex flex-col items-center justify-center gap-1 transition focus-ring',
    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-secondary',
  );

export default function AppearancePage() {
  const a = useSettings((s) => s.appearance);
  const set = useSettings((s) => s.setAppearance);
  const fontScale = snapFontScale(a.fontScale);
  const themeMode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset text size and colours to normal?',
      confirmLabel: 'Reset',
    });
    if (!ok) return;
    // Same defaults as before (owner decision 3: Reset unchanged).
    set({ themeMode: 'system', accentHue: 243, density: 'comfortable', fontScale: 1 });
    setMode('system');
  };

  return (
    <div>
      <SettingsHeader
        title="Text size & theme"
        actions={
          <>
            <AutoSaveNote />
            <Button variant="outline" onClick={() => void reset()}>
              <RotateCcw className="size-4" /> Reset
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4 max-w-4xl">
        <Card className="p-5 space-y-3">
          <div>
            <div className="text-base font-semibold">Text size</div>
            <div className="text-xs text-muted-foreground">
              The app is designed at Normal size. Larger sizes are optional; they also work from the A− / A+
              buttons at the top of the screen.
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2" role="radiogroup" aria-label="Text size">
            {FONT_SCALE_STEPS.map((s) => {
              const on = fontScale === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ fontScale: s })}
                  className={cn(choice(on), 'h-24 px-2')}
                >
                  {/* Sample at its own size, in px so it ignores the current scale. */}
                  <span className="font-semibold leading-tight" style={{ fontSize: `${s * 16}px` }}>
                    আমার দোকান Aa
                  </span>
                  <span className="text-sm font-medium inline-flex items-center gap-1">
                    {on && <Check className="size-4" />}
                    <span>{SIZE_LABEL[s]}</span>
                    <span className="tabular opacity-80">{Math.round(s * 100)}%</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="text-base font-semibold">Theme</div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
            {THEMES.map(({ v, label, Icon }) => {
              const on = themeMode === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    set({ themeMode: v });
                    setMode(v);
                  }}
                  className={cn(choice(on), 'h-16')}
                >
                  <Icon className="size-5" />
                  <span className="text-sm font-medium inline-flex items-center gap-1">
                    {on && <Check className="size-4" />}
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground">System follows the Windows setting.</div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="text-base font-semibold">Accent color</div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2" role="radiogroup" aria-label="Accent color">
            {PRESET_HUES.map((p) => {
              const on = a.accentHue === p.hue;
              return (
                <button
                  key={p.hue}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ accentHue: p.hue })}
                  className={cn(
                    'h-12 rounded-md border flex items-center justify-center gap-2 transition text-sm font-medium focus-ring',
                    on ? 'border-foreground/60 ring-2 ring-ring/60' : 'border-border hover:bg-secondary',
                  )}
                >
                  <span
                    className="size-5 rounded-full grid place-items-center text-white"
                    style={{ backgroundColor: `hsl(${p.hue} 75% 58%)` }}
                  >
                    {on && <Check className="size-3.5" />}
                  </span>
                  {p.name}
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
