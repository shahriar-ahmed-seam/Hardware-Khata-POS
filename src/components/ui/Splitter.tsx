import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  /** Fraction (0..1) of width occupied by the LEFT pane. */
  ratio: number;
  onChange: (r: number) => void;
  left: React.ReactNode;
  right: React.ReactNode;
  /** Min/max ratios */
  min?: number;
  max?: number;
  className?: string;
}

/**
 * Draggable two-pane splitter.
 *
 * DRAG USES POINTER CAPTURE, NOT WINDOW MOUSE LISTENERS.
 * The previous version set `document.body.style.cursor` / `userSelect` on
 * mousedown and cleared them in a window `mouseup` handler. In a frameless
 * Electron window, releasing the button outside the window means that `mouseup`
 * never arrives: the drag flag stayed true, the panel kept following the cursor,
 * and `user-select: none` stayed on <body>. `setPointerCapture` fixes both — the
 * browser guarantees `pointerup`/`pointercancel` on the capturing element, and
 * `lostpointercapture` is the single place that undoes the body styles.
 */
export function Splitter({ ratio, onChange, left, right, min = 0.25, max = 0.85, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const stopDrag = () => {
    draggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  // Whatever happens (unmount mid-drag, route change, hot reload) the body must
  // not be left un-selectable with a resize cursor.
  useEffect(() => stopDrag, []);

  return (
    <div ref={containerRef} className={cn('flex w-full h-full min-h-0', className)}>
      <div style={{ width: `${ratio * 100}%` }} className="min-w-0 flex">
        {left}
      </div>
      <div
        onPointerDown={(e) => {
          // Ignore right/middle button and any non-primary pointer.
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          draggingRef.current = true;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current || !containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const r = Math.min(max, Math.max(min, (e.clientX - rect.left) / rect.width));
          onChange(r);
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
        onLostPointerCapture={stopDrag}
        onDoubleClick={() => onChange(0.65)}
        className="group relative w-1 shrink-0 bg-border hover:bg-primary/40 active:bg-primary cursor-col-resize transition-colors touch-none"
        title="Drag to resize · double-click to reset"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-12 rounded-full bg-muted-foreground/30 group-hover:bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div style={{ width: `${(1 - ratio) * 100}%` }} className="min-w-0 flex">
        {right}
      </div>
    </div>
  );
}
