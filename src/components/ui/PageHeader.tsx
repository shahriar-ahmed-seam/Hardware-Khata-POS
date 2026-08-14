import { ReactNode } from 'react';

/**
 * Page title bar.
 *
 * Responsive: the title block and the action buttons sit on one row when there
 * is room and wrap onto separate rows when there is not, so a narrow window
 * never clips the primary action (previously the buttons overflowed off-screen).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-4 sm:px-6 py-4 sm:py-5 border-b border-border bg-card/50">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
