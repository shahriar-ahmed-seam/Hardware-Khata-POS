import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  show: boolean;
  message?: string;
  /** When true, covers only the parent (parent must be `relative`); otherwise full screen. */
  contained?: boolean;
}

export function LoadingOverlay({ show, message, contained }: Props) {
  if (!show) return null;
  return (
    <div
      className={cn(
        'z-50 grid place-items-center bg-background/70 backdrop-blur-sm animate-fade-in',
        contained ? 'absolute inset-0' : 'fixed inset-0',
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-7 text-primary animate-spin" />
        {message && <div className="text-sm text-muted-foreground">{message}</div>}
      </div>
    </div>
  );
}
