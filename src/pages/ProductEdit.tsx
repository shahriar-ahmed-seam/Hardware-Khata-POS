import { useNavigate, useParams } from 'react-router-dom';
import { ProductForm } from '@/components/products/ProductForm';
import { products as seed, type Product } from '@/mocks/data';
import { hasBackend } from '@/lib/api';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '@/hooks/useProducts';
import { toast } from '@/stores/toast';

export default function ProductEdit() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const backend = hasBackend();

  // ----- Data source: backend when available, else mock seed -----
  const productsQuery = useProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const initial = isNew
    ? undefined
    : backend
      ? productsQuery.data?.find((p) => p.id === id)
      : seed.find((p) => p.id === id);

  const handleSave = async (p: Product) => {
    if (backend) {
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
    } else {
      // For frontend-only mock, push into seed (mutation is fine here).
      if (isNew) seed.unshift(p);
      else {
        const idx = seed.findIndex((x) => x.id === p.id);
        if (idx >= 0) seed[idx] = p;
      }
      nav('/products');
    }
  };

  const handleDelete = async () => {
    if (!initial) return;
    if (!confirm(`Delete "${initial.name}"?`)) return;
    if (backend) {
      try {
        await deleteProduct.mutateAsync(initial.id);
        toast.success('Product deleted');
        nav('/products');
      } catch (e) {
        toast.error('Delete failed', { description: e instanceof Error ? e.message : undefined });
      }
    } else {
      const idx = seed.findIndex((x) => x.id === initial.id);
      if (idx >= 0) seed.splice(idx, 1);
      nav('/products');
    }
  };

  return (
    <ProductForm
      initial={initial}
      onSave={(p) => {
        void handleSave(p);
      }}
      onDelete={initial ? () => void handleDelete() : undefined}
    />
  );
}
