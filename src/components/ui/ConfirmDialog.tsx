import { useEffect } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useConfirmStore } from '@/stores/confirm';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/**
 * Global confirmation dialog. Mount once near the app root. Driven by the
 * `confirm()` promise helper from stores/confirm.
 */
export function ConfirmDialog() {
  const { open, options, respond } = useConfirmStore();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') respond(false);
      if (e.key === 'Enter') respond(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, respond]);

  if (!open || !options) return null;

  const destructive = options.variant === 'destructive';
  const Icon = destructive ? AlertTriangle : HelpCircle;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 animate-fade-in">
      <button
        className="absolute inset-0 bg-black/50"
        onClick={() => respond(false)}
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
            <Icon className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{options.title}</h2>
            {options.message && (
              <p className="text-sm text-muted-foreground mt-1">{options.message}</p>
            )}
          </div>
        </div>
        <div className="border-t border-border px-5 py-3 flex items-center justify-end gap-2 bg-secondary/20">
          <Button variant="outline" onClick={() => respond(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={() => respond(true)}
            autoFocus
          >
            {options.confirmLabel ?? (destructive ? 'Delete' : 'Confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
