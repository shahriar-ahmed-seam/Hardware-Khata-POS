import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  width?: string; // e.g. 'max-w-2xl'
  children: ReactNode;
  side?: 'left' | 'right';
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  width = 'max-w-2xl',
  children,
  side = 'right',
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex animate-fade-in',
        side === 'right' ? 'justify-end' : 'justify-start',
      )}
    >
      <button className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} aria-label="Close" />
      <div
        className={cn(
          'relative w-full bg-card border-l border-border shadow-2xl flex flex-col',
          side === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-right',
          width,
        )}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
            <div>
              {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="size-8 grid place-items-center rounded-md hover:bg-secondary"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </div>
    </div>
  );
}
