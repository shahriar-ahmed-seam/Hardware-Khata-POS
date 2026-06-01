import { cn } from '@/lib/utils';

export function Avatar({
  name,
  size = 36,
  className,
  variant = 'gradient',
}: {
  name: string;
  size?: number;
  className?: string;
  variant?: 'gradient' | 'muted';
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={cn(
        'rounded-full grid place-items-center text-white font-bold shrink-0',
        variant === 'gradient'
          ? 'bg-gradient-to-br from-primary to-accent'
          : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {initials || '?'}
    </div>
  );
}
