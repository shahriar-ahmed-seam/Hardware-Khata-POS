import { CheckCircle2 } from 'lucide-react';

/**
 * The one save model for settings pages that write on every change (writePref):
 * no Save button, just this note in the header. A failed write is toasted by
 * the store. Draft pages (Business Info) use an explicit Save instead.
 */
export function AutoSaveNote() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <CheckCircle2 className="size-4 text-success" aria-hidden />
      <span>Changes save automatically</span>
    </span>
  );
}
