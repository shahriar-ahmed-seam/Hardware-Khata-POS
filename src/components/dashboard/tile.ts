import { cn } from '@/lib/utils';

/** Shared look for a dashboard quick-action tile: calm surface; POS is filled. */
export function tileClass(primary?: boolean) {
  return cn(
    'h-full min-h-[3.5rem] w-full rounded-lg px-3 py-2 flex items-center gap-2.5 text-left transition border',
    primary
      ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-sm'
      : 'bg-card text-foreground border-border hover:border-primary',
  );
}
