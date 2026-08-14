import { useCategories } from '@/hooks/useCatalog';
import { cn } from '@/lib/utils';

interface Props {
  url?: string;
  categoryId?: string;
  /**
   * Optional emoji placeholder. When omitted the emoji is resolved from the real
   * category record; a neutral box icon is used when there is none.
   */
  emoji?: string;
  size?: number; // px
  className?: string;
  rounded?: 'md' | 'lg' | 'xl';
}

/**
 * Renders product image when present; otherwise a category-based emoji placeholder
 * with a subtle gradient background.
 */
export function ProductImage({
  url,
  categoryId,
  emoji,
  size = 40,
  className,
  rounded = 'md',
}: Props) {
  const categoriesQuery = useCategories();
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
  const categoryEmoji = categoryId
    ? categoriesQuery.data?.find((c) => c.id === categoryId)?.emoji
    : undefined;
  const placeholder = emoji ?? categoryEmoji ?? '📦';
  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        `${r} grid place-items-center bg-gradient-to-br from-secondary to-muted border border-border/60 text-base`,
        className,
      )}
    >
      <span style={{ fontSize: size * 0.5 }} className="leading-none">
        {placeholder}
      </span>
    </div>
  );
}
