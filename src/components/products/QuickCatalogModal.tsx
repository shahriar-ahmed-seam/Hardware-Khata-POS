import { FormEvent, useEffect, useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { EmojiPicker } from './MasterList';
import { toast } from '@/stores/toast';
import { useCategories, useBrands, useCreateCategory, useCreateBrand } from '@/hooks/useCatalog';

/**
 * ADD A CATEGORY / BRAND WITHOUT LEAVING THE PRODUCT FORM.
 *
 * Why this exists: the only way to create a category or a brand used to be the
 * Catalogue → Categories / Brands screens. So adding one product with a new
 * brand meant abandoning a half-filled product form, navigating away, coming
 * back and typing everything again. These two modals create the record through
 * the SAME backend channels those screens use (`categories.create` /
 * `brands.create`) and hand the new id straight back to the caller, which
 * selects it — no second data path, nothing invented locally.
 *
 * Duplicates are checked against the live list first: a shop that already has
 * "Cement" does not want a second "cement", and the existing one is selected
 * instead. The check is case-insensitive and trims, because that is how the
 * duplicates actually get typed.
 */

const FORM_ID = 'quick-catalog-form';

interface BaseProps {
  open: boolean;
  onClose: () => void;
  /** Called with the id of the created (or matched existing) record. */
  onCreated: (id: string) => void;
  /** Pre-fill the name box, e.g. from what the user already typed. */
  initialName?: string;
}

export function NewCategoryModal({ open, onClose, onCreated, initialName }: BaseProps) {
  const existing = useCategories().data ?? [];
  const create = useCreateCategory();
  const [name, setName] = useState(initialName ?? '');
  const [emoji, setEmoji] = useState('');
  const [busy, setBusy] = useState(false);

  // Re-seed the box each time it opens; a stale value from a previous open would
  // silently create the wrong category.
  useEffect(() => {
    if (open) {
      setName(initialName ?? '');
      setEmoji('');
    }
  }, [open, initialName]);

  const trimmed = name.trim();
  const duplicate = existing.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!trimmed || busy) return;
    if (duplicate) {
      toast.info('Already in the list. Selected it.', { description: duplicate.name });
      onCreated(duplicate.id);
      onClose();
      return;
    }
    setBusy(true);
    try {
      const res = await create.mutateAsync({ name: trimmed, emoji: emoji || undefined });
      const id = (res as { id?: string })?.id;
      if (!id) throw new Error('The category was saved but returned no id');
      toast.success('Category added', { description: trimmed });
      onCreated(id);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add the category');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-md"
      title="Add new category"
      subtitle="Created and selected for this product"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={!trimmed || busy}>
            <Save className="size-4" /> {busy ? 'Saving…' : 'Save & select'}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="p-5 space-y-4">
        <FormField label="Category name" required>
          {(f) => (
            <Input
              {...f}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Plumbing"
            />
          )}
        </FormField>
        <FormField label="Icon">
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </FormField>
        {duplicate && <DuplicateNote />}
      </form>
    </Modal>
  );
}

export function NewBrandModal({ open, onClose, onCreated, initialName }: BaseProps) {
  const existing = useBrands().data ?? [];
  const create = useCreateBrand();
  const [name, setName] = useState(initialName ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName(initialName ?? '');
  }, [open, initialName]);

  const trimmed = name.trim();
  const duplicate = existing.find((b) => b.name.toLowerCase() === trimmed.toLowerCase());

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!trimmed || busy) return;
    if (duplicate) {
      toast.info('Already in the list. Selected it.', { description: duplicate.name });
      onCreated(duplicate.id);
      onClose();
      return;
    }
    setBusy(true);
    try {
      const res = await create.mutateAsync({ name: trimmed });
      const id = (res as { id?: string })?.id;
      if (!id) throw new Error('The brand was saved but returned no id');
      toast.success('Brand added', { description: trimmed });
      onCreated(id);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add the brand');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-md"
      title="Add new brand"
      subtitle="Created and selected for this product"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={!trimmed || busy}>
            <Save className="size-4" /> {busy ? 'Saving…' : 'Save & select'}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="p-5 space-y-4">
        <FormField label="Brand name" required>
          {(f) => (
            <Input
              {...f}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. RFL"
            />
          )}
        </FormField>
        {duplicate && <DuplicateNote />}
      </form>
    </Modal>
  );
}

/** Static sentence (translatable); plain text colour with an icon for contrast. */
function DuplicateNote() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
      <AlertTriangle className="size-4 mt-0.5 shrink-0 text-warning" />
      <span>This name is already in the list. Saving selects that one instead of making a copy.</span>
    </div>
  );
}
