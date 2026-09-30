import {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useOverlayLayer } from './overlayStack';

interface Props {
  trigger: (open: boolean, set: (v: boolean) => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Preferred side; it flips by itself when there is more room on the other. */
  side?: 'bottom' | 'top';
  className?: string;
  width?: string; // e.g. 'w-72', 'w-96'
}

const MARGIN = 8; // keep this far from the window edges
const GAP = 8; // between the trigger and the panel

/**
 * A small panel that opens from a button (row "⋯" menus, filters, ranges).
 *
 * RENDERED INTO <body>, at fixed window coordinates measured from the trigger.
 * It used to be an absolutely positioned child of the trigger, so inside a
 * table or a card with `overflow` (Products' row "⋯" menu) it opened INSIDE the
 * table and was cut off by it. Now nothing on the page can clip it: it opens
 * below the trigger, or above when there is more room there, stays inside the
 * window, and follows the trigger when the page scrolls.
 */
export function Popover({
  trigger,
  children,
  align = 'right',
  side = 'bottom',
  className,
  width = 'w-80',
}: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties | null>(null);
  // Esc closes only the top layer: a popover inside a modal closes itself, not the modal.
  const isTop = useOverlayLayer(open);

  const place = useCallback(() => {
    const a = anchorRef.current;
    const p = panelRef.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = p.offsetWidth;
    const ph = p.scrollHeight;
    const below = vh - r.bottom - GAP - MARGIN;
    const above = r.top - GAP - MARGIN;
    const up = side === 'top' ? !(above < ph && below > above) : below < ph && above > below;
    let left = align === 'right' ? r.right - pw : align === 'left' ? r.left : r.left + r.width / 2 - pw / 2;
    left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, vw - pw - MARGIN));
    setPos(
      up
        ? { bottom: vh - r.top + GAP, left, maxHeight: Math.max(120, above) }
        : { top: r.bottom + GAP, left, maxHeight: Math.max(120, below) },
    );
  }, [align, side]);

  // Measure before paint, so the panel never flashes at the window corner.
  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTop()) setOpen(false);
    };
    // Capture: a scroll inside any list (not only the window) moves the trigger.
    const onMove = () => place();
    const ro = new ResizeObserver(onMove);
    if (panelRef.current) ro.observe(panelRef.current);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      ro.disconnect();
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, isTop, place]);

  return (
    <div ref={anchorRef} className="relative inline-block">
      {trigger(open, setOpen)}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', ...(pos ?? { top: 0, left: 0, visibility: 'hidden' }) }}
            className={cn(
              'titlebar-no-drag print:hidden z-[80] bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl animate-fade-in overflow-y-auto overflow-x-hidden',
              width,
              className,
            )}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </div>
  );
}
