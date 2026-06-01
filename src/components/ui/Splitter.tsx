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

export function Splitter({ ratio, onChange, left, right, min = 0.25, max = 0.85, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const r = Math.min(max, Math.max(min, x / rect.width));
      onChange(r);
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onChange, min, max]);

  return (
    <div ref={containerRef} className={cn('flex w-full h-full min-h-0', className)}>
      <div style={{ width: `${ratio * 100}%` }} className="min-w-0 flex">
        {left}
      </div>
      <div
        onMouseDown={() => {
          draggingRef.current = true;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        onDoubleClick={() => onChange(0.65)}
        className="group relative w-1 shrink-0 bg-border hover:bg-primary/40 active:bg-primary cursor-col-resize transition-colors"
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
