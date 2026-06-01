import { useEffect } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, Loader2, X } from 'lucide-react';
import { useToastStore, type Toast, type ToastVariant } from '@/stores/toast';
import { cn } from '@/lib/utils';

const VARIANT_META: Record<
  ToastVariant,
  { icon: any; ring: string; iconColor: string }
> = {
  success: { icon: CheckCircle2, ring: 'border-l-success', iconColor: 'text-success' },
  error: { icon: XCircle, ring: 'border-l-destructive', iconColor: 'text-destructive' },
  info: { icon: Info, ring: 'border-l-primary', iconColor: 'text-primary' },
  warning: { icon: AlertTriangle, ring: 'border-l-warning', iconColor: 'text-warning' },
  loading: { icon: Loader2, ring: 'border-l-muted-foreground', iconColor: 'text-muted-foreground' },
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed top-12 right-4 z-[100] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const meta = VARIANT_META[toast.variant];
  const Icon = meta.icon;

  useEffect(() => {
    if (toast.duration > 0) {
      const timer = setTimeout(() => dismiss(toast.id), toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, dismiss]);

  return (
    <div
      className={cn(
        'pointer-events-auto bg-card border border-border border-l-4 rounded-lg shadow-lg p-3.5 flex items-start gap-3 animate-toast-in',
        meta.ring,
      )}
      role="status"
    >
      <Icon
        className={cn('size-5 shrink-0 mt-0.5', meta.iconColor, toast.variant === 'loading' && 'animate-spin')}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-tight">{toast.message}</div>
        {toast.description && (
          <div className="text-xs text-muted-foreground mt-0.5">{toast.description}</div>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick();
              dismiss(toast.id);
            }}
            className="text-xs font-semibold text-primary hover:underline mt-1.5"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      {toast.variant !== 'loading' && (
        <button
          onClick={() => dismiss(toast.id)}
          className="size-6 grid place-items-center rounded hover:bg-secondary text-muted-foreground shrink-0"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
