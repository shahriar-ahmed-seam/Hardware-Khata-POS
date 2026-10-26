import { FormEvent, ReactNode } from 'react';
import { Edit2, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

/**
 * ONE LAYOUT FOR THE SHORT LISTS PRODUCTS POINT TO (categories, brands, units).
 *
 * Title + one primary "Add …"; one card with the count, a search box once the
 * list is long, readable 56px rows with a labelled Edit and a Delete icon; an
 * empty state that says what to do. Add/Edit opens a small centred Modal.
 */

/** Search box appears only when the list is longer than this. */
const SEARCH_FROM = 8;

interface PageProps {
  title: string;
  addLabel: string;
  onAdd?: () => void;
  /** Total rows (before search), for the count and the search threshold. */
  total: number;
  /** Plural noun after the count, its own text node so Bangla translates it. */
  noun: string;
  q: string;
  onQ: (q: string) => void;
  searchPlaceholder: string;
  /** Shown when there are no rows at all. */
  emptyTitle: string;
  emptyMessage?: string;
  /** Rows after search; 0 with total > 0 shows "nothing matches". */
  shown: number;
  /** Optional plain note above the list. */
  note?: ReactNode;
  children: ReactNode;
}

export function MasterListPage({
  title,
  addLabel,
  onAdd,
  total,
  noun,
  q,
  onQ,
  searchPlaceholder,
  emptyTitle,
  emptyMessage,
  shown,
  note,
  children,
}: PageProps) {
  return (
    <div>
      <PageHeader
        title={title}
        actions={
          onAdd && (
            <Button onClick={onAdd}>
              <Plus className="size-4" /> {addLabel}
            </Button>
          )
        }
      />
      <div className="p-6 max-w-3xl space-y-4">
        {note && (
          <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
            {note}
          </div>
        )}
        <Card className="overflow-hidden">
          {total > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <div className="text-sm text-muted-foreground shrink-0">
                <span className="tabular font-semibold text-foreground">{total}</span> <span>{noun}</span>
              </div>
              {total > SEARCH_FROM && (
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => onQ(e.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="pl-9"
                  />
                </div>
              )}
            </div>
          )}
          {total === 0 ? (
            <EmptyState
              compact
              title={emptyTitle}
              message={emptyMessage}
              action={
                onAdd && (
                  <Button onClick={onAdd}>
                    <Plus className="size-4" /> {addLabel}
                  </Button>
                )
              }
            />
          ) : shown === 0 ? (
            <EmptyState compact icon={Search} title="Nothing matches your search" />
          ) : (
            <div className="divide-y divide-border">{children}</div>
          )}
        </Card>
      </div>
    </div>
  );
}

interface RowProps {
  leading?: ReactNode;
  name: ReactNode;
  sub?: ReactNode;
  /** Right-aligned figure, e.g. "3 products". */
  aside?: ReactNode;
  indent?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Tooltip / accessible name for the delete icon. */
  deleteLabel?: string;
}

export function MasterRow({ leading, name, sub, aside, indent, onEdit, onDelete, deleteLabel = 'Delete' }: RowProps) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-2 min-h-14', indent && 'pl-12 bg-muted/20')}>
      {leading}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      {aside && <div className="text-sm text-muted-foreground tabular shrink-0">{aside}</div>}
      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <Button variant="ghost" onClick={onEdit}>
            <Edit2 className="size-4" /> Edit
          </Button>
        )}
        {onDelete && (
          <IconButton size="sm" tone="danger" label={deleteLabel} onClick={onDelete} className="ml-1">
            <Trash2 className="size-4" />
          </IconButton>
        )}
      </div>
    </div>
  );
}

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  saveLabel: string;
  canSave: boolean;
  busy?: boolean;
  onSubmit: () => void;
  children: ReactNode;
}

/** Small centred Add/Edit popup: Enter saves, Cancel · Save bottom-right. */
export function MasterFormModal({ open, onClose, title, saveLabel, canSave, busy, onSubmit, children }: FormModalProps) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canSave && !busy) onSubmit();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-md"
      title={title}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="master-form" disabled={!canSave || busy}>
            {busy ? 'Saving…' : saveLabel}
          </Button>
        </div>
      }
    >
      <form id="master-form" onSubmit={submit} className="p-5 space-y-4">
        {children}
      </form>
    </Modal>
  );
}

export const CATEGORY_EMOJIS = ['🔨', '🪚', '🚰', '💡', '🎨', '🔩', '🧱', '⛑️', '🛠️', '⚙️', '🪛', '📦', '🔥', '🪜', '🚪', '🛁'];

/** Pick-one emoji grid (no typing emoji on Windows 7). */
export function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icon">
      {CATEGORY_EMOJIS.map((e) => (
        <button
          type="button"
          key={e}
          role="radio"
          aria-checked={value === e}
          onClick={() => onChange(e)}
          className={cn(
            'size-10 rounded-md border text-lg transition focus-ring',
            value === e ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary',
          )}
        >
          {e}
        </button>
      ))}
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        onClick={() => onChange('')}
        className={cn(
          'h-10 px-3 rounded-md border text-sm transition focus-ring',
          !value ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary',
        )}
      >
        No icon
      </button>
    </div>
  );
}
