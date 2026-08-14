import { useEffect } from 'react';

/**
 * SAFETY NET for "I click a text box and no caret appears".
 *
 * The root cause of that bug was native `alert`/`confirm`/`prompt` dialogs
 * leaving the Electron window without keyboard focus on Windows (see the note in
 * stores/prompt.ts); those are all gone now. This hook is the belt-and-braces
 * second layer, because a dead text box is invisible to the shopkeeper — they
 * just think the app is broken — and the failure can also come from outside our
 * code (a driver-level focus glitch, a native print dialog, the window manager).
 *
 * HOW IT WORKS
 * On mouse-down over a text-entry element we remember the intended target, then
 * check on the next frame whether the browser actually focused it. If nothing at
 * all ended up focused (activeElement is <body> / <html> / null — i.e. focus was
 * lost, NOT deliberately moved elsewhere) we focus the target ourselves.
 *
 * It is deliberately conservative: if focus legitimately landed on some other
 * element we never fight it, so normal focus management is untouched.
 */

/** Input types that show a text caret. Buttons, checkboxes etc. are excluded. */
const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'tel',
  'url',
  'email',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
]);

function isTextEntry(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type.toLowerCase();
    return TEXT_INPUT_TYPES.has(type);
  }
  return false;
}

/** True when focus is nowhere useful, i.e. it was lost rather than moved. */
function focusIsLost(): boolean {
  const active = document.activeElement;
  return active === null || active === document.body || active === document.documentElement;
}

export function useFocusRescue(): void {
  useEffect(() => {
    let frame = 0;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      // The caret belongs to the nearest text-entry ancestor: clicking the
      // padding of a contenteditable, or an <input> wrapper, still counts.
      const field =
        target?.closest?.('input, textarea, [contenteditable]:not([contenteditable="false"])') ??
        null;
      if (!isTextEntry(field)) return;
      if ((field as HTMLInputElement).disabled || (field as HTMLInputElement).readOnly) return;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Still connected? (a click may have unmounted it)
        if (!field.isConnected) return;
        if (document.activeElement === field) return; // normal path — nothing to do
        if (!focusIsLost()) return; // focus moved on purpose — respect it
        field.focus();
      });
    };

    // `mousedown` in the CAPTURE phase: it runs before any handler that might
    // call preventDefault() (which is itself one way focus never lands).
    document.addEventListener('mousedown', onPointerDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', onPointerDown, true);
    };
  }, []);
}
