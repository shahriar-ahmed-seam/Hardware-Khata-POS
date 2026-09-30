import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { focusIntoPanel, useOverlayLayer, wrapTab } from './overlayStack';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  width?: string; // tailwind, e.g. 'max-w-3xl'
  footer?: ReactNode;
  /**
   * Force the "something was typed" state (e.g. a form that knows it is dirty).
   * Without it the modal notices typing by itself; see `typed` below.
   */
  dirty?: boolean;
}

/**
 * The shared centred popup.
 *
 * SAFETY RULES (UI audit, docs/09-UI-AUDIT.md F4):
 *  - A click on the dark backdrop closes it ONLY while nothing has been typed.
 *    One stray click used to throw away a half-counted drawer, a payment split
 *    or a whole form. After typing, the X, Cancel or Esc still close it; a
 *    backdrop click just gives the panel a small shake.
 *  - Esc closes only the TOP popup (a confirm over this modal, a popover inside
 *    it), never two at once.
 *  - On open the caret lands inside (an `autoFocus` field wins), and Tab wraps
 *    at the edges instead of walking out into the page behind.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'max-w-3xl',
  footer,
  dirty,
}: Props) {
  const isTop = useOverlayLayer(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const typed = useRef(false);
  const [nudge, setNudge] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTop()) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, isTop]);

  // Fresh state each time it opens; focus into the panel once it is painted.
  useEffect(() => {
    if (!open) return;
    typed.current = false;
    const panel = panelRef.current;
    const raf = requestAnimationFrame(() => panel && focusIntoPanel(panel));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  const onBackdrop = () => {
    if (dirty || typed.current) {
      setNudge(true);
      return;
    }
    onClose();
  };

  return (
    // `data-overlay` marks this as a modal layer. The POS product panel uses it
    // to know it must NOT steal the caret into its search box while a dialog is
    // open (it used to sniff for hard-coded `.fixed.inset-0.z-50` classes, which
    // missed every modal that used a different z-index).
    <div
      data-overlay="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in"
    >
      <button
        className="absolute inset-0 bg-black/50 animate-fade-in cursor-default"
        onClick={onBackdrop}
        aria-label="Close"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onInput={(e) => {
          // Typing in THIS panel only: a popup opened from inside it (a payment
          // modal over a sale drawer) is its own layer. A search/filter box
          // marked `data-no-dirty` is not work to protect.
          const t = e.target as HTMLElement;
          if (t.closest?.('[role="dialog"]') !== panelRef.current) return;
          if (!t.closest?.('[data-no-dirty]')) typed.current = true;
        }}
        onKeyDown={(e) => wrapTab(e, panelRef.current)}
        onAnimationEnd={() => setNudge(false)}
        className={cn(
          'relative bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full overflow-hidden flex flex-col max-h-[90vh] outline-none',
          nudge ? 'animate-[wiggle_0.35s_ease-in-out]' : 'animate-scale-in',
          width,
        )}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              title="Close (Esc)"
              className="size-10 -mr-2 -mt-1 shrink-0 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary focus-ring"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
        {footer && <div className="border-t border-border px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}
