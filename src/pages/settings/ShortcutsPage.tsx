import { useState, useEffect, useRef } from 'react';
import { RotateCcw, Keyboard, AlertTriangle } from 'lucide-react';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { AutoSaveNote } from '@/components/settings/AutoSaveNote';
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
  // The shortcut whose key was just taken by another one (shown on its row).
  const [cleared, setCleared] = useState<keyof ShortcutMap | null>(null);
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
      setCleared(dup ?? null);
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
        actions={
          <>
            <AutoSaveNote />
            <Button
              variant="outline"
              onClick={async () => {
                if (await confirmDialog({ title: 'Reset all shortcuts to defaults?' })) {
                  reset();
                  setCleared(null);
                  toast.info('Shortcuts reset to defaults');
                }
              }}
            >
              <RotateCcw className="size-4" /> Reset to defaults
            </Button>
          </>
        }
      />

      <div className="p-6 max-w-3xl space-y-3">
        <Card className="p-3">
          <div className="text-sm text-muted-foreground flex items-start gap-2">
            <Keyboard className="size-4 mt-0.5" />
            <span>Click a key, press the new key, then click Use this key. Esc cancels.</span>
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
                  <div className="text-xs text-muted-foreground">{row.desc}</div>
                  {cleared === row.id && !value && (
                    <div className="text-xs text-warning flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="size-3.5" aria-hidden />
                      <span>Its key is now used by another shortcut. Pick a new one.</span>
                    </div>
                  )}
                </div>
                {isRec ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-10 min-w-[120px] px-3 inline-flex items-center justify-center rounded-md border-2 text-sm font-mono',
                        pending
                          ? 'border-primary text-primary bg-primary/5'
                          : 'border-dashed border-warning text-warning animate-pulse',
                      )}
                    >
                      {pending ?? 'Press a key…'}
                    </span>
                    <Button onClick={confirm} disabled={!pending}>
                      Use this key
                    </Button>
                    <Button variant="outline" onClick={cancel}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    title="Change key"
                    onClick={() => startRecord(row.id)}
                    className={cn(
                      'h-10 min-w-[120px] focus-ring px-3 inline-flex items-center justify-center rounded-md border text-sm font-mono transition',
                      value
                        ? 'border-border hover:border-primary hover:bg-primary/5'
                        : 'border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary',
                    )}
                  >
                    {value || 'Not set'}
                  </button>
                )}
              </div>
            );
          })}
        </Card>

        <div className="text-xs text-muted-foreground">
          F-keys work best for one-press actions. Ctrl+R, Ctrl+W and Ctrl+T may not work.
        </div>
      </div>
    </div>
  );
}
