import { useEffect, useState } from 'react';
import { Save, FolderPlus, Tag } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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

  const submit = async () => {
    if (!trimmed || busy) return;
    if (duplicate) {
      toast.info(`"${duplicate.name}" already exists — selected it`);
      onCreated(duplicate.id);
      onClose();
      return;
    }
    setBusy(true);
    try {
      const res = await create.mutateAsync({ name: trimmed, emoji: emoji.trim() || undefined });
      const id = (res as { id?: string })?.id;
      if (!id) throw new Error('The category was saved but returned no id');
      toast.success(`Category "${trimmed}" added`);
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
      title="Add New Category"
      subtitle="Created and selected for this product"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!trimmed || busy}>
            <Save className="size-4" /> {busy ? 'Saving…' : 'Save & Select'}
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-secondary/40">
          <div className="size-10 rounded-full bg-muted text-muted-foreground grid place-items-center">
            <FolderPlus className="size-4" />
          </div>
          <div className="text-xs text-muted-foreground">
            This is the same category list as Catalogue → Categories. Adding it here saves it
            for good.
          </div>
        </div>
        <Labelled label="Category name" required>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
            placeholder="e.g. Plumbing"
          />
        </Labelled>
        <Labelled label="Icon" hint="Optional — one emoji, shown in lists">
          <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🔧" />
        </Labelled>
        {duplicate && (
          <div className="rounded-md bg-warning/10 text-warning px-3 py-2 text-xs">
            A category called "{duplicate.name}" already exists. Saving will select that one
            instead of making a duplicate.
          </div>
        )}
      </div>
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

  const submit = async () => {
    if (!trimmed || busy) return;
    if (duplicate) {
      toast.info(`"${duplicate.name}" already exists — selected it`);
      onCreated(duplicate.id);
      onClose();
      return;
    }
    setBusy(true);
    try {
      const res = await create.mutateAsync({ name: trimmed });
      const id = (res as { id?: string })?.id;
      if (!id) throw new Error('The brand was saved but returned no id');
      toast.success(`Brand "${trimmed}" added`);
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
      title="Add New Brand"
      subtitle="Created and selected for this product"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!trimmed || busy}>
            <Save className="size-4" /> {busy ? 'Saving…' : 'Save & Select'}
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-secondary/40">
          <div className="size-10 rounded-full bg-muted text-muted-foreground grid place-items-center">
            <Tag className="size-4" />
          </div>
          <div className="text-xs text-muted-foreground">
            This is the same brand list as Catalogue → Brands. Adding it here saves it for good.
          </div>
        </div>
        <Labelled label="Brand name" required>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
            placeholder="e.g. RFL"
          />
        </Labelled>
        {duplicate && (
          <div className="rounded-md bg-warning/10 text-warning px-3 py-2 text-xs">
            A brand called "{duplicate.name}" already exists. Saving will select that one instead
            of making a duplicate.
          </div>
        )}
      </div>
    </Modal>
  );
}

function Labelled({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
