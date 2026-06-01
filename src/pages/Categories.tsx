import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Search, ListTree, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { useCategories as useCategoriesStore, type CategoryNode } from '@/stores/masterData';
import {
  useCategories as useCategoriesQuery,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/hooks/useCatalog';
import { useProducts } from '@/hooks/useProducts';
import { products as seedProducts } from '@/mocks/data';
import { hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/utils';

const EMOJIS = ['🔨', '🪚', '🚰', '💡', '🎨', '🔩', '🧱', '⛑️', '🛠️', '⚙️', '🪛', '📦', '🔥', '🪜', '🚪', '🛁'];

export default function Categories() {
  const backend = hasBackend();

  // ----- Data source: backend when available, else mock store -----
  const store = useCategoriesStore();
  const categoriesQuery = useCategoriesQuery();
  const productsQuery = useProducts();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const items: CategoryNode[] = backend ? (categoriesQuery.data ?? []) : store.items;
  const productList = backend ? (productsQuery.data ?? []) : seedProducts;

  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<CategoryNode | 'new' | null>(null);

  const tree = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtered = t ? items.filter((c) => c.name.toLowerCase().includes(t)) : items;
    const roots = filtered.filter((c) => !c.parentId);
    return roots.map((root) => ({
      ...root,
      children: filtered.filter((c) => c.parentId === root.id),
    }));
  }, [items, q]);

  const productCount = (id: string) => productList.filter((p) => p.categoryId === id).length;

  const save = async (data: Omit<CategoryNode, 'id'>, current: CategoryNode | 'new') => {
    if (backend) {
      try {
        if (current === 'new') {
          await createCategory.mutateAsync({
            name: data.name,
            emoji: data.emoji,
            parentId: data.parentId,
          });
        } else {
          await updateCategory.mutateAsync({
            id: current.id,
            patch: { name: data.name, emoji: data.emoji, parentId: data.parentId ?? null },
          });
        }
        toast.success(current === 'new' ? 'Category added' : 'Category updated');
        setEditing(null);
      } catch (e) {
        toast.error('Save failed', { description: e instanceof Error ? e.message : undefined });
      }
    } else {
      if (current === 'new') store.add(data);
      else store.update(current.id, data);
      setEditing(null);
    }
  };

  const onDelete = async (c: CategoryNode) => {
    const used = productCount(c.id);
    const childCount = items.filter((i) => i.parentId === c.id).length;
    let msg = `Delete "${c.name}"?`;
    if (used > 0) msg += ` ${used} product(s) use this category.`;
    if (childCount > 0)
      msg += ` ${childCount} subcategor${childCount === 1 ? 'y' : 'ies'} will be detached.`;
    if (!confirm(msg)) return;
    if (backend) {
      try {
        await deleteCategory.mutateAsync(c.id);
        toast.success('Category deleted');
      } catch (e) {
        toast.error('Delete failed', { description: e instanceof Error ? e.message : undefined });
      }
    } else {
      store.remove(c.id);
    }
  };

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle={`${items.length} categories · subcategories optional`}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add Category
          </Button>
        }
      />

      <div className="p-6 max-w-3xl">
        <Card className="p-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search categories…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden divide-y divide-border">
          {tree.map((cat) => (
            <div key={cat.id}>
              <Row
                cat={cat}
                count={productCount(cat.id)}
                onEdit={() => setEditing(cat)}
                onDelete={() => onDelete(cat)}
              />
              {cat.children.map((child) => (
                <Row
                  key={child.id}
                  cat={child}
                  indent
                  count={productCount(child.id)}
                  onEdit={() => setEditing(child)}
                  onDelete={() => onDelete(child)}
                />
              ))}
            </div>
          ))}
          {tree.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No categories.{' '}
              <button className="text-primary underline" onClick={() => setEditing('new')}>
                Add new
              </button>
            </div>
          )}
        </Card>
      </div>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        width="max-w-md"
        title={editing === 'new' ? 'Add Category' : 'Edit Category'}
        subtitle="Optional parent for subcategories"
      >
        {editing && (
          <Form
            initial={editing === 'new' ? undefined : editing}
            allCategories={items}
            onSave={(data) => {
              void save(data, editing);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

function Row({
  cat,
  count,
  indent,
  onEdit,
  onDelete,
}: {
  cat: CategoryNode;
  count: number;
  indent?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30',
        indent && 'pl-12 bg-muted/20',
      )}
    >
      {indent && <ChevronRight className="size-3.5 text-muted-foreground -ml-6" />}
      <div className="size-8 rounded-md bg-secondary grid place-items-center text-base">
        {cat.emoji ?? <ListTree className="size-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{cat.name}</div>
        {indent && <div className="text-[10px] text-muted-foreground">subcategory</div>}
      </div>
      <div className="text-xs text-muted-foreground tabular">{count} products</div>
      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
        <button
          onClick={onEdit}
          className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
          title="Edit"
        >
          <Edit2 className="size-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="size-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function Form({
  initial,
  allCategories,
  onSave,
  onCancel,
}: {
  initial?: CategoryNode;
  allCategories: CategoryNode[];
  onSave: (data: Omit<CategoryNode, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '');
  const [parentId, setParentId] = useState<string | undefined>(initial?.parentId);

  // Parents are top-level only (no nested subcategories)
  const parentChoices = allCategories.filter((c) => !c.parentId && c.id !== initial?.id);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), emoji: emoji || undefined, parentId });
      }}
      className="flex flex-col flex-1 min-h-0"
    >
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Name *</label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Icon (emoji)</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {EMOJIS.map((e) => (
              <button
                type="button"
                key={e}
                onClick={() => setEmoji(e)}
                className={cn(
                  'size-9 rounded-md border text-lg transition',
                  emoji === e
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-secondary',
                )}
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setEmoji('')}
              className={cn(
                'size-9 rounded-md border text-xs transition',
                !emoji ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary',
              )}
              title="No icon"
            >
              ✕
            </button>
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
            Parent category
          </label>
          <select
            value={parentId ?? ''}
            onChange={(e) => setParentId(e.target.value || undefined)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="">— Top level —</option>
            {parentChoices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji ? c.emoji + ' ' : ''}
                {c.name}
              </option>
            ))}
          </select>
          <div className="text-[10px] text-muted-foreground mt-1">
            Optional. Leave empty for a top-level category.
          </div>
        </div>
      </div>
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {initial ? 'Save Changes' : 'Add Category'}
        </Button>
      </div>
    </form>
  );
}
