import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * WHICH POPUP IS ON TOP.
 *
 * Every Modal, Drawer, Popover and the global confirm/prompt dialogs listen for
 * Escape on `window`. With two open (a confirm over a drawer, a popover inside a
 * modal) one Esc closed BOTH, and whatever was typed in the lower one was lost.
 * Each open layer registers here; a layer only reacts to Esc when it is the top.
 *
 * Both listeners see the same keydown before React re-renders, so the layer that
 * handles the key is still registered while the one below checks — the lower
 * one correctly stands down.
 */
const stack: symbol[] = [];

/** Register a layer while `open`; returns a function telling whether it is on top. */
export function useOverlayLayer(open: boolean): () => boolean {
  const id = useRef<symbol | null>(null);
  useEffect(() => {
    if (!open) return;
    const me = Symbol('overlay');
    id.current = me;
    stack.push(me);
    return () => {
      const i = stack.lastIndexOf(me);
      if (i >= 0) stack.splice(i, 1);
      if (id.current === me) id.current = null;
    };
  }, [open]);
  return useCallback(() => id.current !== null && stack[stack.length - 1] === id.current, []);
}

/** Anything a keyboard user can land on, in DOM order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Put the caret somewhere useful when a popup opens: a field that already took
 * focus itself (`autoFocus`) is left alone; otherwise the first text field, and
 * failing that the panel itself, so Tab starts inside the popup and not behind it.
 */
export function focusIntoPanel(panel: HTMLElement): void {
  if (panel.contains(document.activeElement)) return;
  const field = panel.querySelector<HTMLElement>(
    'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled])',
  );
  (field ?? panel).focus({ preventScroll: true });
}

/**
 * Keep Tab inside the popup at its edges only. A strict trap would also block
 * dropdowns and date pickers that render outside the panel, so focus that is
 * already elsewhere is left alone.
 */
export function wrapTab(e: ReactKeyboardEvent<HTMLElement>, panel: HTMLElement | null): void {
  if (e.key !== 'Tab' || !panel) return;
  const items = focusablesIn(panel);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}
