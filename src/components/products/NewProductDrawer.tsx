import { useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { ProductForm } from './ProductForm';
import { useCreateProduct } from '@/hooks/useProducts';
import { useAuth } from '@/stores/auth';
import { toast } from '@/stores/toast';
import type { Product } from '@/types/domain';

/**
 * ADD A NEW PRODUCT WITHOUT LEAVING THE DOCUMENT YOU ARE WRITING.
 *
 * Add Purchase and Add Sale both had an "Add new product" button that did
 * nothing at all — no handler, no route, nothing. A buyer standing at the
 * counter with goods that are not in the catalogue had to abandon the purchase,
 * go to Catalogue → Add Product, and start the purchase again.
 *
 * This is the REAL product form (`ProductForm`, all 25 fields) in a drawer, so
 * there is one product editor in the app, not two that drift apart. It saves
 * through the same `products.create` channel as the full page.
 *
 * WHY `lockStock`
 * When opened from a purchase, opening stock is forced to 0 and shown read-only:
 * the quantity is about to be entered on the purchase line, and THAT is what
 * records the goods arriving. Letting the form also write an opening balance
 * would put the same delivery into stock twice. The reorder level stays editable
 * — the low-stock warning belongs to the product, not to this purchase.
 *
 * `onCreated` receives the saved product WITH its real backend id, so the caller
 * can add the line immediately instead of waiting for the catalogue query to
 * refetch.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the created product (real backend id, stock 0 when locked). */
  onCreated: (product: Product) => void;
  /** Force opening stock to 0 — use when opened from a purchase. */
  lockStock?: boolean;
  /** Branch the opening stock (when allowed) is recorded against. */
  branchId?: string;
  title?: string;
  subtitle?: string;
}

export function NewProductDrawer({
  open,
  onClose,
  onCreated,
  lockStock,
  branchId = 'br_mp',
  title = 'Add New Product',
  subtitle,
}: Props) {
  const createProduct = useCreateProduct();
  const userId = useAuth((s) => s.currentUserId);
  const [saving, setSaving] = useState(false);

  const handleSave = async (p: Product) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await createProduct.mutateAsync({
        ...p,
        // 0 in lockStock mode — see the note above.
        openingStock: lockStock ? 0 : p.stock,
        branchId,
        userId: userId ?? undefined,
      });
      const id = (res as { id?: string })?.id;
      if (!id) throw new Error('The product was saved but returned no id');
      toast.success(`"${p.name}" added to your catalogue`);
      onCreated({ ...p, id, stock: lockStock ? 0 : p.stock });
      onClose();
    } catch (e) {
      toast.error('Could not save the product', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-4xl"
      title={title}
      subtitle={
        subtitle ??
        (lockStock
          ? 'Saved to your catalogue and added to this purchase. Stock arrives on the purchase line.'
          : 'Saved to your catalogue and added to this document.')
      }
    >
      <ProductForm
        asDrawer
        lockStock={lockStock}
        saveLabel={saving ? 'Saving…' : 'Save & Add'}
        onSave={(p) => void handleSave(p)}
        onCancel={onClose}
      />
    </Drawer>
  );
}
