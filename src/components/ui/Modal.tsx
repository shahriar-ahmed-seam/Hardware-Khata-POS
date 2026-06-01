import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  width?: string; // tailwind, e.g. 'max-w-3xl'
  footer?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'max-w-3xl',
  footer,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in">
      <button className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-label="Close" />
      <div
        className={cn(
          'relative bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-scale-in',
          width,
        )}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border">
            <div>
              {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
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
        <div className="flex-1 overflow-auto">{children}</div>
        {footer && <div className="border-t border-border px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}
