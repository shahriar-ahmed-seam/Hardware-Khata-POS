import { useNavigate, useParams } from 'react-router-dom';
import { ArchiveRestore } from 'lucide-react';
import { ProductForm } from '@/components/products/ProductForm';
import { Button } from '@/components/ui/Button';
import type { Product } from '@/types/domain';
import {
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useArchiveProduct,
  useUnarchiveProduct,
  useProductUsage,
  type ProductUsage,
} from '@/hooks/useProducts';
import { useCanAll } from '@/hooks/useCan';
import { confirm } from '@/stores/confirm';
import { toast } from '@/stores/toast';

export default function ProductEdit() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  // ----- Data source: the SQLite backend, this ONE product -----
  // Fetched by id, not filtered out of the catalogue list: an ARCHIVED product
  // has to be openable here (that is the point of archiving rather than
  // deleting), and it also saves pulling every product to read one row.
  const productQuery = useProduct(isNew ? undefined : id);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const archiveProduct = useArchiveProduct();
  const unarchiveProduct = useUnarchiveProduct();
  const productUsage = useProductUsage();
  const perms = useCanAll(['products.delete', 'products.edit'] as const);
  const canDelete = perms['products.delete'];
  const canArchive = perms['products.edit'];

  const initial = isNew ? undefined : productQuery.data ?? undefined;
  const isArchived = !!initial?.archivedAt;

  const handleSave = async (p: Product) => {
    try {
      if (isNew) {
        await createProduct.mutateAsync({
          ...p,
          openingStock: p.stock,
          branchId: 'br_mp',
          userId: 'u_admin',
        });
      } else {
        await updateProduct.mutateAsync(p);
      }
      toast.success('Product saved');
      nav('/products');
    } catch (e) {
      toast.error('Save failed', { description: e instanceof Error ? e.message : undefined });
    }
  };

  /**
   * Remove this product from the catalogue.
   *
   * Asks the backend what it is tied to FIRST (`products.usage`), because the
   * answer decides which of two different things should happen — and the old
   * version just tried to delete and surfaced "Cannot delete: product has sales
   * history" with no way forward:
   *
   *   traded before → ARCHIVE. Reversible, keeps every past invoice resolvable,
   *                   and it is what SQLite will allow (the document tables
   *                   reference products(id) with no ON DELETE clause).
   *   never traded  → DELETE, with the leftover stock spelled out first.
   */
  const handleDelete = async () => {
    if (!initial) return;

    let usage: ProductUsage;
    try {
      usage = await productUsage.mutateAsync(initial.id);
    } catch (e) {
      toast.error('Could not check what this product is used for', {
        description: e instanceof Error ? e.message : undefined,
      });
      return;
    }

    if (!usage.deletable) {
      if (!canArchive) {
        toast.error('Only a manager or admin can retire a product');
        return;
      }
      const kinds = [...new Set(usage.documents.map((d) => d.label))].join(', ');
      const ok = await confirm({
        title: `Archive "${initial.name}" instead?`,
        message: `It appears in your ${kinds}, so deleting it would rewrite past records. Archiving hides it from the catalogue and the POS, keeps every past invoice intact, and can be undone.`,
        confirmLabel: 'Archive',
      });
      if (!ok) return;
      try {
        await archiveProduct.mutateAsync({ id: initial.id });
        toast.success('Product archived');
        nav('/products');
      } catch (e) {
        toast.error('Archive failed', { description: e instanceof Error ? e.message : undefined });
      }
      return;
    }

    if (!canDelete) {
      toast.error('Only an admin can delete a product');
      return;
    }
    const stockNote =
      Math.abs(usage.stock) > 0.001
        ? ` It still has ${usage.stock} in stock, which will be discarded.`
        : '';
    const ok = await confirm({
      title: `Delete "${initial.name}" for good?`,
      message: `This cannot be undone.${stockNote}`,
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deleteProduct.mutateAsync({ id: initial.id, force: true });
      toast.success('Product deleted');
      nav('/products');
    } catch (e) {
      toast.error('Delete failed', { description: e instanceof Error ? e.message : undefined });
    }
  };

  /** Put a retired product back into the catalogue and the POS. */
  const handleRestore = async () => {
    if (!initial) return;
    const ok = await confirm({
      title: `Restore "${initial.name}" to the catalogue?`,
      message:
        'It goes back into the product list, the POS and search. Its past invoices are unchanged.',
      confirmLabel: 'Restore',
    });
    if (!ok) return;
    try {
      await unarchiveProduct.mutateAsync({ id: initial.id });
      toast.success('Product restored');
      nav('/products');
    } catch (e) {
      toast.error('Restore failed', { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <>
      {/* An archived product is still fully editable — a retired line may still
          need its name or code corrected for the sake of old invoices — so the
          form is left alone and the state is stated above it instead. */}
      {isArchived && (
        <div className="mx-6 mt-6 rounded-lg border border-border bg-secondary/40 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="text-sm">
            <div className="font-medium">This product is archived</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              It is out of the product list, the POS and search. Past invoices are unchanged.
            </div>
          </div>
          <div className="flex-1" />
          {canArchive && (
            <Button onClick={() => void handleRestore()}>
              <ArchiveRestore className="size-4" /> Restore to catalogue
            </Button>
          )}
        </div>
      )}
      <ProductForm
        initial={initial}
        onSave={(p) => {
          void handleSave(p);
        }}
        onDelete={
          initial && !isArchived && (canDelete || canArchive) ? () => void handleDelete() : undefined
        }
      />
    </>
  );
}
