import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

export default function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} subtitle="This screen is part of the planned design." />
      <div className="p-6">
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
          <Construction className="size-10 mx-auto opacity-40" />
          <div className="mt-3 font-medium text-foreground">{title} — coming next</div>
          <p className="text-xs mt-1">
            Layout will be added in the next iteration. Approve the current screens first and I'll
            build this out.
          </p>
        </div>
      </div>
    </div>
  );
}
