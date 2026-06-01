import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  trigger: (open: boolean, set: (v: boolean) => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  width?: string; // e.g. 'w-72', 'w-96'
}

export function Popover({ trigger, children, align = 'right', className, width = 'w-80' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const alignCls =
    align === 'right' ? 'right-0' : align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2';

  return (
    <div ref={ref} className="relative inline-block">
      {trigger(open, setOpen)}
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-2 bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl animate-fade-in overflow-hidden',
            alignCls,
            width,
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
