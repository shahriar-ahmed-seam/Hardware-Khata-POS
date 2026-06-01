import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  icon?: any;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon = Inbox, title, message, action, className, compact }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8' : 'py-16',
        className,
      )}
    >
      <div
        className={cn(
          'rounded-full bg-secondary grid place-items-center text-muted-foreground mb-3',
          compact ? 'size-10' : 'size-14',
        )}
      >
        <Icon className={compact ? 'size-5' : 'size-7'} />
      </div>
      <div className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>{title}</div>
      {message && (
        <div className="text-sm text-muted-foreground mt-1 max-w-sm">{message}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
