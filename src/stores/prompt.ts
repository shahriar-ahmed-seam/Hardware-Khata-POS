import { create } from 'zustand';

/**
 * In-app replacement for the native `window.prompt()`.
 *
 * WHY THIS EXISTS
 * Native JS dialogs (`alert` / `confirm` / `prompt`) are rendered by Chromium
 * OUTSIDE the page. On Windows, Electron frequently fails to hand keyboard focus
 * back to the `webContents` after one closes: the window still looks active and
 * clicks are received, but no text caret ever appears and typing goes nowhere.
 * That is the "text boxes stop working everywhere" bug — it was global because
 * focus is a per-window property, and intermittent because it only happened
 * after a page called one of those three functions.
 *
 * Nothing in `src/` may call them. Use `confirm()` (stores/confirm),
 * `promptText()` (here), or `toast.*` (stores/toast) instead.
 */
export interface PromptOptions {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  /** Pre-filled value. */
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  /** When true an empty/whitespace-only value cannot be submitted. */
  required?: boolean;
  multiline?: boolean;
}

interface PromptState {
  open: boolean;
  options: PromptOptions | null;
  resolve: ((value: string | null) => void) | null;
  request: (options: PromptOptions) => Promise<string | null>;
  respond: (value: string | null) => void;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  request: (options) =>
    new Promise<string | null>((resolve) => {
      set({ open: true, options, resolve });
    }),
  respond: (value) => {
    const { resolve } = get();
    resolve?.(value);
    set({ open: false, options: null, resolve: null });
  },
}));

/**
 * Promise-based text prompt usable anywhere. Resolves to the entered string, or
 * `null` when cancelled — same contract as the native `prompt()` it replaces,
 * so call sites read the same way.
 *
 *   const reason = await promptText({ title: 'Reason for voiding?' });
 *   if (reason !== null) { ... }
 */
export function promptText(options: PromptOptions): Promise<string | null> {
  return usePromptStore.getState().request(options);
}
