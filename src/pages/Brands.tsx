import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import {
  useBrands as useBrandsQuery,
  useCreateBrand,
  useUpdateBrand,
  useDeleteBrand,
} from '@/hooks/useCatalog';
import { useProducts } from '@/hooks/useProducts';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';
import { MasterFormModal, MasterListPage, MasterRow } from '@/components/products/MasterList';

type Brand = { id: string; name: string };

export default function Brands() {
  // ----- Data source: the SQLite backend -----
  const brandsQuery = useBrandsQuery();
  const productsQuery = useProducts();
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const deleteBrand = useDeleteBrand();

  const items: Brand[] = brandsQuery.data ?? [];
  const productList = productsQuery.data ?? [];

  const [q, setQ] = useState('');
  // Same Add/Edit popup as the other lists (the old inline editor behaved differently).
  const [editing, setEditing] = useState<Brand | 'new' | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((b) => b.name.toLowerCase().includes(t)) : items;
  }, [items, q]);

  const productCount = (id: string) => productList.filter((p) => p.brandId === id).length;

  const onDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete this brand?',
      message:
        productCount(id) > 0 ? 'Products with this brand stay, but lose their brand.' : undefined,
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteBrand.mutateAsync(id);
      toast.success('Brand deleted');
    } catch (e) {
      toast.error('Delete failed', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const save = async (name: string) => {
    if (!editing) return;
    try {
      if (editing === 'new') await createBrand.mutateAsync({ name });
      else await updateBrand.mutateAsync({ id: editing.id, patch: { name } });
      toast.success(editing === 'new' ? 'Brand added' : 'Brand renamed');
      setEditing(null);
    } catch (e) {
      toast.error('Save failed', { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <>
      <MasterListPage
        title="Brands"
        addLabel="Add brand"
        onAdd={() => setEditing('new')}
        total={items.length}
        noun="brands"
        q={q}
        onQ={setQ}
        searchPlaceholder="Search brands…"
        emptyTitle="No brands yet"
        emptyMessage="Add one, e.g. RFL or Berger."
        shown={list.length}
      >
        {list.map((b) => (
          <MasterRow
            key={b.id}
            name={b.name}
            aside={
              <>
                {productCount(b.id)} <span>products</span>
              </>
            }
            onEdit={() => setEditing(b)}
            onDelete={() => void onDelete(b.id)}
            deleteLabel="Delete brand"
          />
        ))}
      </MasterListPage>

      {editing && (
        <BrandForm
          initial={editing === 'new' ? undefined : editing}
          busy={createBrand.isPending || updateBrand.isPending}
          onClose={() => setEditing(null)}
          onSave={(name) => void save(name)}
        />
      )}
    </>
  );
}

function BrandForm({
  initial,
  busy,
  onSave,
  onClose,
}: {
  initial?: Brand;
  busy: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  return (
    <MasterFormModal
      open
      onClose={onClose}
      title={initial ? 'Rename brand' : 'Add brand'}
      saveLabel={initial ? 'Save changes' : 'Add brand'}
      canSave={!!name.trim()}
      busy={busy}
      onSubmit={() => onSave(name.trim())}
    >
      <FormField label="Brand name" required>
        {(f) => <Input {...f} autoFocus value={name} onChange={(e) => setName(e.target.value)} />}
      </FormField>
    </MasterFormModal>
  );
}
