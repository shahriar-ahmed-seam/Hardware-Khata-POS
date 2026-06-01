import { useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Award, Save, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useBrands as useBrandsStore } from '@/stores/masterData';
import {
  useBrands as useBrandsQuery,
  useCreateBrand,
  useUpdateBrand,
  useDeleteBrand,
} from '@/hooks/useCatalog';
import { useProducts } from '@/hooks/useProducts';
import { products as seedProducts } from '@/mocks/data';
import { hasBackend } from '@/lib/api';
import { toast } from '@/stores/toast';

export default function Brands() {
  const backend = hasBackend();

  // ----- Data source: backend when available, else mock store -----
  const store = useBrandsStore();
  const brandsQuery = useBrandsQuery();
  const productsQuery = useProducts();
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const deleteBrand = useDeleteBrand();

  const items = backend ? (brandsQuery.data ?? []) : store.items;
  const productList = backend ? (productsQuery.data ?? []) : seedProducts;

  const [q, setQ] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((b) => b.name.toLowerCase().includes(t));
  }, [items, q]);

  const productCount = (id: string) => productList.filter((p) => p.brandId === id).length;

  const addBrand = async (name: string) => {
    if (backend) {
      try {
        await createBrand.mutateAsync({ name });
        toast.success('Brand added');
      } catch (e) {
        toast.error('Add failed', { description: e instanceof Error ? e.message : undefined });
      }
    } else {
      store.add(name);
    }
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setDraft(name);
  };
  const saveEdit = async () => {
    if (editingId && draft.trim()) {
      const id = editingId;
      const name = draft.trim();
      setEditingId(null);
      if (backend) {
        try {
          await updateBrand.mutateAsync({ id, patch: { name } });
          toast.success('Brand renamed');
        } catch (e) {
          toast.error('Rename failed', { description: e instanceof Error ? e.message : undefined });
        }
      } else {
        store.update(id, name);
      }
    } else {
      setEditingId(null);
    }
  };

  const onDelete = async (id: string) => {
    const used = productCount(id);
    if (used > 0) {
      if (!confirm(`This brand is used by ${used} product(s). Delete anyway?`)) return;
    } else {
      if (!confirm('Delete this brand?')) return;
    }
    if (backend) {
      try {
        await deleteBrand.mutateAsync(id);
        toast.success('Brand deleted');
      } catch (e) {
        toast.error('Delete failed', { description: e instanceof Error ? e.message : undefined });
      }
    } else {
      store.remove(id);
    }
  };

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle={`${items.length} brands`}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add Brand
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
              placeholder="Search brands…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          {adding && (
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary/5">
              <Award className="size-4 text-primary" />
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Brand name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    void addBrand(newName.trim());
                    setNewName('');
                    setAdding(false);
                  } else if (e.key === 'Escape') {
                    setAdding(false);
                    setNewName('');
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (newName.trim()) {
                    void addBrand(newName.trim());
                    setNewName('');
                    setAdding(false);
                  }
                }}
              >
                <Save className="size-3.5" /> Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setNewName('');
                }}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          )}

          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Brand</th>
                <th className="text-right font-medium px-4 py-2.5">Products</th>
                <th className="px-4 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} className="border-t border-border group hover:bg-secondary/30">
                  <td className="px-4 py-2.5">
                    {editingId === b.id ? (
                      <Input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          else if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="h-8"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-md bg-secondary grid place-items-center text-muted-foreground">
                          <Award className="size-3.5" />
                        </div>
                        <span className="font-medium">{b.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground tabular">
                    {productCount(b.id)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                      {editingId === b.id ? (
                        <>
                          <button
                            onClick={saveEdit}
                            className="size-7 grid place-items-center rounded hover:bg-success/10 text-success"
                            title="Save"
                          >
                            <Save className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground"
                            title="Cancel"
                          >
                            <X className="size-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(b.id, b.name)}
                            className="size-7 grid place-items-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                            title="Rename"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(b.id)}
                            className="size-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No brands match. <button className="text-primary underline" onClick={() => setAdding(true)}>Add new</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
