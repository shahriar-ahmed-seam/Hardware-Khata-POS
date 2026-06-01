import { useState, useEffect, useRef } from 'react';
import { Save, RotateCcw, Keyboard, Check, X } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSettings, type ShortcutMap } from '@/stores/settings';
import { confirm as confirmDialog } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

interface Row {
  id: keyof ShortcutMap;
  label: string;
  desc: string;
}

const ROWS: Row[] = [
  { id: 'search', label: 'Focus product search', desc: 'Jump to the search box on POS' },
  { id: 'customer', label: 'Pick customer', desc: 'Open the Customer Picker' },
  { id: 'orderDiscount', label: 'Order discount', desc: 'Apply cart-level discount' },
  { id: 'heldCarts', label: 'Held carts', desc: 'Open the parked carts list' },
  { id: 'saveDraft', label: 'Save as draft', desc: 'Save current cart as draft' },
  { id: 'saveQuotation', label: 'Save as quotation', desc: 'Save as quotation document' },
  { id: 'pay', label: 'Pay', desc: 'Open the Payment modal' },
  { id: 'hold', label: 'Hold cart', desc: 'Park current cart' },
  { id: 'newCart', label: 'New cart', desc: 'Start a fresh cart tab' },
  { id: 'reprintLast', label: 'Reprint last receipt', desc: 'Print the most recent invoice' },
  { id: 'showHelp', label: 'Show shortcuts overlay', desc: 'Toggle the help overlay' },
];

/** Format a KeyboardEvent into a label like "Ctrl+P" or "F8". */
function formatCombo(e: KeyboardEvent): string | null {
  const key = e.key;
  // Ignore lone modifier presses
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Cmd');
  // Function keys, single chars, special keys
  if (key.startsWith('F') && /^F\d{1,2}$/.test(key)) parts.push(key);
  else if (key === ' ') parts.push('Space');
  else if (key.length === 1) parts.push(key.toUpperCase());
  else parts.push(key);
  return parts.join('+');
}

export default function ShortcutsPage() {
  const sc = useSettings((s) => s.shortcuts);
  const setSC = useSettings((s) => s.setShortcuts);
  const reset = useSettings((s) => s.resetShortcuts);

  const [recording, setRecording] = useState<keyof ShortcutMap | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const recordingRef = useRef(recording);
  recordingRef.current = recording;

  // Keyboard capture
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      if (!recordingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRecording(null);
        setPending(null);
        return;
      }
      const combo = formatCombo(e);
      if (combo) setPending(combo);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [recording]);

  const startRecord = (id: keyof ShortcutMap) => {
    setRecording(id);
    setPending(null);
  };
  const confirm = () => {
    if (recording && pending) {
      // Detect collisions and clear them on the other binding
      const dup = (Object.keys(sc) as (keyof ShortcutMap)[]).find(
        (k) => k !== recording && sc[k] === pending,
      );
      const patch: Partial<ShortcutMap> = { [recording]: pending } as Partial<ShortcutMap>;
      if (dup) (patch as Record<string, string>)[dup] = '';
      setSC(patch);
    }
    setRecording(null);
    setPending(null);
  };
  const cancel = () => {
    setRecording(null);
    setPending(null);
  };

  return (
    <div>
      <SettingsHeader
        title="Keyboard Shortcuts"
        subtitle="Customize the F-keys and combos used on POS"
        actions={
          <>
            <Button
              variant="outline"
              onClick={async () => {
                if (await confirmDialog({ title: 'Reset all shortcuts to defaults?' })) {
                  reset();
                  toast.info('Shortcuts reset to defaults');
                }
              }}
            >
              <RotateCcw className="size-4" /> Reset to defaults
            </Button>
            <Button onClick={() => toast.success('Shortcuts saved')}>
              <Save className="size-4" /> Saved
            </Button>
          </>
        }
      />

      <div className="p-6 max-w-3xl space-y-3">
        <Card className="p-3">
          <div className="text-[12px] text-muted-foreground flex items-start gap-2">
            <Keyboard className="size-4 mt-0.5" />
            <span>
              Click any row to record a new combo. Press the new key (modifiers + key) to capture
              it, then click <span className="font-semibold text-foreground">Save</span> to apply.
              Press Esc to cancel. If your new combo conflicts with another shortcut, the other
              binding will be cleared so you can re-bind it.
            </span>
          </div>
        </Card>

        <Card className="divide-y divide-border">
          {ROWS.map((row) => {
            const isRec = recording === row.id;
            const value = sc[row.id];
            return (
              <div key={row.id} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{row.label}</div>
                  <div className="text-[11px] text-muted-foreground">{row.desc}</div>
                </div>
                {isRec ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-9 min-w-[120px] px-3 inline-flex items-center justify-center rounded-md border-2 text-sm font-mono',
                        pending
                          ? 'border-primary text-primary bg-primary/5'
                          : 'border-dashed border-warning text-warning animate-pulse',
                      )}
                    >
                      {pending ?? 'Press a key…'}
                    </span>
                    <button
                      onClick={confirm}
                      disabled={!pending}
                      className="size-8 grid place-items-center rounded bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      onClick={cancel}
                      className="size-8 grid place-items-center rounded border border-border hover:bg-secondary"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startRecord(row.id)}
                    className={cn(
                      'h-9 min-w-[120px] px-3 inline-flex items-center justify-center rounded-md border text-sm font-mono transition',
                      value
                        ? 'border-border hover:border-primary hover:bg-primary/5'
                        : 'border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary',
                    )}
                  >
                    {value || 'unassigned'}
                  </button>
                )}
              </div>
            );
          })}
        </Card>

        <div className="text-[11px] text-muted-foreground">
          Note: F-keys are recommended for one-press actions. For combos, Ctrl/Alt/Shift +
          letter/number works best. Browser-reserved keys (Ctrl+R, Ctrl+W, Ctrl+T) may not be
          rebindable.
        </div>
      </div>
    </div>
  );
}
