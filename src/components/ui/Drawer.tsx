import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { focusIntoPanel, useOverlayLayer, wrapTab } from './overlayStack';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  width?: string; // e.g. 'max-w-2xl'
  children: ReactNode;
  side?: 'left' | 'right';
  /** Force the "something was typed" state; otherwise typing is noticed by itself. */
  dirty?: boolean;
}

/**
 * The shared side panel. Same safety rules as `Modal` (see there): a backdrop
 * click closes it only while nothing has been typed, Esc closes only the top
 * popup, and the caret lands inside on open.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  width = 'max-w-2xl',
  children,
  side = 'right',
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
    <div
      data-overlay="true"
      className={cn(
        'fixed inset-0 z-50 flex animate-fade-in',
        side === 'right' ? 'justify-end' : 'justify-start',
      )}
    >
      <button
        className="absolute inset-0 bg-black/40 animate-fade-in cursor-default"
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
          'relative w-full bg-card border-l border-border shadow-2xl flex flex-col outline-none',
          nudge ? 'animate-[wiggle_0.35s_ease-in-out]' : 'animate-slide-in-right',
          width,
        )}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
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
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </div>
    </div>
  );
}
