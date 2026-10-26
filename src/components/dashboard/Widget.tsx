import { ReactNode, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  to?: string;
  toLabel?: string;
  className?: string;
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * A dashboard card. Show / hide / reorder live in the Customize panel only —
 * the in-card ↑ ↓ × buttons (24px) of the old edit mode are gone.
 */
export function Widget({ title, description, to, toLabel = 'View all', className, badge, children }: Props) {
  return (
    <Card className={cn('overflow-hidden flex flex-col h-full w-full', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle>{title}</CardTitle>
              {badge}
            </div>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {to && (
            <Link
              to={to}
              className="shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-md hover:bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground focus-ring"
            >
              {toLabel}
              <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
      </CardHeader>
      {/* The widget BODIES are code-split (see lazyWidgets.ts), so every widget
          needs a Suspense boundary. It lives here rather than around the whole
          grid on purpose: one boundary per card means each widget appears as soon
          as it can, and the dashboard frame — titles, links, layout — is on screen
          immediately instead of being replaced wholesale by a spinner. */}
      <CardContent className="pt-2 flex-1 min-h-0 flex flex-col">
        <Suspense fallback={<WidgetSkeleton />}>{children}</Suspense>
      </CardContent>
    </Card>
  );
}

/**
 * Placeholder while a widget body loads. It only needs to hold the card's height
 * steady so the grid does not jump when the chart arrives.
 */
function WidgetSkeleton() {
  return (
    <div className="flex-1 min-h-[6rem] rounded-md bg-secondary/40 animate-pulse" aria-hidden />
  );
}
