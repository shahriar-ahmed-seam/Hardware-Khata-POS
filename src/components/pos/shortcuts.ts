import { useMemo } from 'react';
import { useSettings, type ShortcutMap } from '@/stores/settings';

/**
 * POS key bindings, read from Settings → Keyboard Shortcuts (R81). They used to
 * be hard-coded in POS.tsx, so a key changed in Settings did nothing. The
 * built-in keys are the defaults for anything missing from the saved map.
 */
export const DEFAULT_POS_KEYS: ShortcutMap = {
  search: 'F2',
  customer: 'F3',
  orderDiscount: 'F4',
  heldCarts: 'F5',
  saveDraft: 'F6',
  saveQuotation: 'F7',
  pay: 'F8',
  hold: 'F9',
  newCart: 'F10',
  reprintLast: 'Ctrl+P',
  showHelp: '?',
};

export function usePosKeys(): ShortcutMap {
  const saved = useSettings((s) => s.shortcuts);
  // Empty saved entries fall back to the built-in key.
  return useMemo(() => {
    const out = { ...DEFAULT_POS_KEYS };
    for (const k of Object.keys(out) as (keyof ShortcutMap)[]) {
      const v = saved?.[k];
      if (typeof v === 'string' && v.trim()) out[k] = v.trim();
    }
    return out;
  }, [saved]);
}

/** Same key naming as the Settings recorder ("Ctrl+P", "F8", "Space", "?"). */
function keyName(e: KeyboardEvent): string {
  if (e.key === ' ') return 'Space';
  return e.key.length === 1 ? e.key.toUpperCase() : e.key;
}

/** True when the key event is the saved combo, e.g. "Ctrl+P", "F8", "?". */
export function matchesKey(e: KeyboardEvent, combo: string | undefined): boolean {
  if (!combo) return false;
  const parts = combo.split('+').map((p) => p.trim());
  // "Ctrl++" style: an empty last part means the "+" key itself.
  let key = parts.pop() ?? '';
  if (key === '' && combo.endsWith('+')) key = '+';
  const mods = new Set(parts.map((p) => p.toLowerCase()));
  const want = key.length === 1 ? key.toUpperCase() : key;
  if (keyName(e) !== want) return false;
  const ctrl = mods.has('ctrl') || mods.has('cmd');
  if ((e.ctrlKey || e.metaKey) !== ctrl) return false;
  if (e.altKey !== mods.has('alt')) return false;
  // A symbol like "?" needs Shift on most keyboards; do not demand it be named.
  const symbol = key.length === 1 && !/[a-z0-9]/i.test(key);
  if (!symbol && e.shiftKey !== mods.has('shift')) return false;
  return true;
}

/** "Ctrl+P" → "Ctrl + P" for the on-screen key hints. */
export function keyLabel(combo: string | undefined): string {
  return (combo ?? '').replace(/\+(?!$)/g, ' + ');
}
