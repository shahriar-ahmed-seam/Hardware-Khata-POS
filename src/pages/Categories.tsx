import { useMemo, useState } from 'react';
import { ListTree, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { type CategoryNode } from '@/stores/masterData';
import {
  useCategories as useCategoriesQuery,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/hooks/useCatalog';
import { useProducts } from '@/hooks/useProducts';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import {
  EmojiPicker,
  MasterFormModal,
  MasterListPage,
  MasterRow,
} from '@/components/products/MasterList';

export default function Categories() {
  // ----- Data source: the SQLite backend -----
  const categoriesQuery = useCategoriesQuery();
  const productsQuery = useProducts();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const items: CategoryNode[] = categoriesQuery.data ?? [];
  const productList = productsQuery.data ?? [];

  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<CategoryNode | 'new' | null>(null);

  const tree = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtered = t ? items.filter((c) => c.name.toLowerCase().includes(t)) : items;
    // A matching subcategory still shows when its parent does not match.
    const roots = filtered.filter((c) => !c.parentId || !filtered.some((p) => p.id === c.parentId));
    return roots.map((root) => ({
      ...root,
      children: filtered.filter((c) => c.parentId === root.id),
    }));
  }, [items, q]);
  const shown = tree.reduce((n, r) => n + 1 + r.children.length, 0);

  const productCount = (id: string) => productList.filter((p) => p.categoryId === id).length;

  const onDelete = async (c: CategoryNode) => {
    const used = productCount(c.id) > 0;
    const hasChildren = items.some((i) => i.parentId === c.id);
    // Static sentences so the Bangla layer can translate them.
    const usedNote = 'Products in it will be left without a category.';
    const childNote = 'Its subcategories will become top-level categories.';
    const ok = await confirm({
      title: 'Delete this category?',
      message:
        used && hasChildren
          ? `${usedNote} ${childNote}`
          : used
            ? usedNote
            : hasChildren
              ? childNote
              : undefined,
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteCategory.mutateAsync(c.id);
      toast.success('Category deleted');
    } catch (e) {
      toast.error('Delete failed', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const row = (cat: CategoryNode, indent?: boolean) => (
    <MasterRow
      key={cat.id}
      indent={indent}
      leading={
        <>
          {indent && <ChevronRight className="size-4 text-muted-foreground -ml-6" />}
          <div className="size-9 rounded-md bg-secondary grid place-items-center text-lg shrink-0">
            {cat.emoji ?? <ListTree className="size-4 text-muted-foreground" />}
          </div>
        </>
      }
      name={cat.name}
      aside={
        <>
          {productCount(cat.id)} <span>products</span>
        </>
      }
      onEdit={() => setEditing(cat)}
      onDelete={() => void onDelete(cat)}
      deleteLabel="Delete category"
    />
  );

  return (
    <>
      <MasterListPage
        title="Categories"
        addLabel="Add category"
        onAdd={() => setEditing('new')}
        total={items.length}
        noun="categories"
        q={q}
        onQ={setQ}
        searchPlaceholder="Search categories…"
        emptyTitle="No categories yet"
        emptyMessage="Add one, e.g. Plumbing or Paint."
        shown={shown}
      >
        {tree.map((cat) => (
          <div key={cat.id} className="divide-y divide-border">
            {row(cat)}
            {cat.children.map((child) => row(child, true))}
          </div>
        ))}
      </MasterListPage>

      {editing && (
        <CategoryForm
          initial={editing === 'new' ? undefined : editing}
          allCategories={items}
          busy={createCategory.isPending || updateCategory.isPending}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            try {
              if (editing === 'new') {
                await createCategory.mutateAsync(data);
              } else {
                await updateCategory.mutateAsync({
                  id: editing.id,
                  patch: { ...data, parentId: data.parentId ?? null },
                });
              }
              toast.success(editing === 'new' ? 'Category added' : 'Category updated');
              setEditing(null);
            } catch (e) {
              toast.error('Save failed', { description: e instanceof Error ? e.message : undefined });
            }
          }}
        />
      )}
    </>
  );
}

function CategoryForm({
  initial,
  allCategories,
  busy,
  onSave,
  onClose,
}: {
  initial?: CategoryNode;
  allCategories: CategoryNode[];
  busy: boolean;
  onSave: (data: { name: string; emoji?: string; parentId?: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '');
  const [parentId, setParentId] = useState<string | undefined>(initial?.parentId);

  // Parents are top-level only (no nested subcategories).
  const parentChoices = allCategories.filter((c) => !c.parentId && c.id !== initial?.id);

  return (
    <MasterFormModal
      open
      onClose={onClose}
      title={initial ? 'Edit category' : 'Add category'}
      saveLabel={initial ? 'Save changes' : 'Add category'}
      canSave={!!name.trim()}
      busy={busy}
      onSubmit={() => onSave({ name: name.trim(), emoji: emoji || undefined, parentId })}
    >
      <FormField label="Name" required>
        {(f) => <Input {...f} autoFocus value={name} onChange={(e) => setName(e.target.value)} />}
      </FormField>
      <FormField label="Icon">
        <EmojiPicker value={emoji} onChange={setEmoji} />
      </FormField>
      <FormField label="Inside another category" hint="Leave empty for a main category.">
        {(f) => (
          <Select
            {...f}
            value={parentId ?? ''}
            onChange={(e) => setParentId(e.target.value || undefined)}
          >
            <option value="">— None —</option>
            {parentChoices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji ? c.emoji + ' ' : ''}
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </FormField>
    </MasterFormModal>
  );
}
