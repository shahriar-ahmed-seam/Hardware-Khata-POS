import { categories } from '@/mocks/data';
import { cn } from '@/lib/utils';

interface Props {
  url?: string;
  categoryId?: string;
  size?: number; // px
  className?: string;
  rounded?: 'md' | 'lg' | 'xl';
}

const FALLBACK_EMOJI: Record<string, string> = {
  c1: '🔨',
  c2: '🪚',
  c3: '🚰',
  c4: '💡',
  c5: '🎨',
  c6: '🔩',
  c7: '🧱',
  c8: '⛑️',
};

/**
 * Renders product image when present; otherwise a category-based emoji placeholder
 * with a subtle gradient background.
 */
export function ProductImage({ url, categoryId, size = 40, className, rounded = 'md' }: Props) {
  const r = rounded === 'xl' ? 'rounded-xl' : rounded === 'lg' ? 'rounded-lg' : 'rounded-md';
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{ width: size, height: size }}
        className={cn(`${r} object-cover bg-secondary border border-border`, className)}
      />
    );
  }
  const emoji = (categoryId && FALLBACK_EMOJI[categoryId]) ?? categories.find((c) => c.id === categoryId)?.emoji ?? '📦';
  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        `${r} grid place-items-center bg-gradient-to-br from-secondary to-muted border border-border/60 text-base`,
        className,
      )}
    >
      <span style={{ fontSize: size * 0.5 }} className="leading-none">
        {emoji}
      </span>
    </div>
  );
}
