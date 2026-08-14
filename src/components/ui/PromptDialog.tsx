import { useEffect, useRef, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { usePromptStore } from '@/stores/prompt';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

/**
 * Global text-prompt dialog. Mount once near the app root, next to
 * <ConfirmDialog />. Driven by the `promptText()` promise helper.
 *
 * Replaces the native `window.prompt()`, which left the Electron window without
 * keyboard focus on Windows (see the note in stores/prompt.ts).
 */
export function PromptDialog() {
  const { open, options, respond } = usePromptStore();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Reset to the requested default each time the dialog is opened.
  useEffect(() => {
    if (open) setValue(options?.defaultValue ?? '');
  }, [open, options?.defaultValue]);

  // Focus the field ourselves. The caret must land in the input on open, and
  // this dialog exists precisely because focus handling is the fragile part.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const canSubmit = !options?.required || value.trim().length > 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        respond(null);
      }
      // Enter submits single-line prompts. In a textarea Enter is a newline, so
      // Ctrl/Cmd+Enter is the submit gesture there.
      if (e.key === 'Enter' && (!options?.multiline || e.ctrlKey || e.metaKey)) {
        if (!canSubmit) return;
        e.preventDefault();
        respond(value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, respond, value, canSubmit, options?.multiline]);

  if (!open || !options) return null;

  const destructive = options.variant === 'destructive';

  return (
    <div
      data-overlay="true"
      className="fixed inset-0 z-[110] flex items-center justify-center p-6 animate-fade-in"
    >
      <button
        className="absolute inset-0 bg-black/50"
        onClick={() => respond(null)}
        aria-label="Cancel"
      />
      <div className="relative bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
        <div className="p-5 flex items-start gap-3">
          <div
            className={cn(
              'size-10 rounded-full grid place-items-center shrink-0',
              destructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
            )}
          >
            <MessageSquareText className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{options.title}</h2>
            {options.message && (
              <p className="text-sm text-muted-foreground mt-1">{options.message}</p>
            )}
            <div className="mt-3">
              {options.label && (
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {options.label}
                </label>
              )}
              {options.multiline ? (
                <textarea
                  ref={(el) => (inputRef.current = el)}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={options.placeholder}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              ) : (
                <Input
                  ref={(el) => (inputRef.current = el)}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={options.placeholder}
                />
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-border px-5 py-3 flex items-center justify-end gap-2 bg-secondary/20">
          <Button variant="outline" onClick={() => respond(null)}>
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            disabled={!canSubmit}
            onClick={() => respond(value)}
          >
            {options.confirmLabel ?? 'OK'}
          </Button>
        </div>
      </div>
    </div>
  );
}
