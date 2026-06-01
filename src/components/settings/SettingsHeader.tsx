import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

export function SettingsHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
      actions={
        <>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1 px-2 h-9 rounded-md hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="size-4" /> Settings
          </Link>
          {actions}
        </>
      }
    />
  );
}
