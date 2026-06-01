import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Save } from 'lucide-react';
import { useExpenses, type ExpenseCategory } from '@/stores/expenses';
import { cn } from '@/lib/utils';

const EMOJIS = ['🏢', '🏠', '💡', '💼', '📦', '⚠️', '🚚', '📣', '🪙', '🛠️', '✏️', '🍵', '⚡', '🧾', '🎁', '🌐'];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  initial?: ExpenseCategory;
}

export function NewExpenseCategoryModal({ open, onClose, onCreated, initial }: Props) {
  const add = useExpenses((s) => s.addCategory);
  const update = useExpenses((s) => s.updateCategory);
  const cats = useExpenses((s) => s.categories);

  const [name, setName] = useState(initial?.name ?? '');
  const [parentId, setParentId] = useState<string | undefined>(initial?.parentId);
  const [emoji, setEmoji] = useState(initial?.emoji ?? '');
  const [budget, setBudget] = useState(initial?.monthlyBudget ?? 0);

  const reset = () => {
    setName('');
    setParentId(undefined);
    setEmoji('');
    setBudget(0);
  };

  const submit = () => {
    if (!name.trim()) return;
    if (initial) {
      update(initial.id, {
        name: name.trim(),
        parentId,
        emoji: emoji || undefined,
        monthlyBudget: budget || undefined,
      });
      onCreated(initial.id);
    } else {
      const c = add({
        name: name.trim(),
        parentId,
        emoji: emoji || undefined,
        monthlyBudget: budget || undefined,
      });
      onCreated(c.id);
    }
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      width="max-w-md"
      title={initial ? 'Edit Expense Category' : 'New Expense Category'}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            <Save className="size-4" /> {initial ? 'Save Changes' : 'Add Category'}
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Name *</label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Internet"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Icon</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {EMOJIS.map((e) => (
              <button
                type="button"
                key={e}
                onClick={() => setEmoji(e)}
                className={cn(
                  'size-9 rounded-md border text-lg transition',
                  emoji === e ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary',
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
            {cats
              .filter((c) => !c.parentId && c.id !== initial?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? c.emoji + ' ' : ''}
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
            Monthly budget (৳, optional)
          </label>
          <NumberField value={budget} onChangeNumber={setBudget} />
        </div>
      </div>
    </Modal>
  );
}
