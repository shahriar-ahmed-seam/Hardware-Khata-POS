import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, ListTree, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useExpenses, type ExpenseCategory, type ExpenseRecord } from '@/stores/expenses';
import { api } from '@/lib/api';
import { toExpense, type BackendExpense } from '@/hooks/expenseAdapter';
import { NewExpenseCategoryModal } from '@/components/expenses/NewExpenseCategoryModal';
import { confirm } from '@/stores/confirm';
import { formatBDT, cn } from '@/lib/utils';

export default function ExpenseCategories() {
  const { categories, removeCategory } = useExpenses();
  const loadCategories = useExpenses((s) => s.loadCategories);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<ExpenseCategory | 'new' | null>(null);

  /**
   * WHOLE-LIST AGGREGATE — the per-category expense count and this month's spend
   * roll up over EVERY expense. `useExpenses().expenses` is ONE PAGE (50), so
   * reading it would report "of the 50 most recent expenses" and the delete
   * confirmation would under-report how many rows use a category. Both now come
   * from the UNPAGED `expenses.list`. The arithmetic below is unchanged.
   *
   * Only the (small, never paged) category list is still read from the store, so
   * `loadCategories()` replaces the old `hydrate()` — no wasted page fetch.
   */
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loadingRollups, setLoadingRollups] = useState(true);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    let alive = true;
    setLoadingRollups(true);
    void api<BackendExpense[]>('expenses.list', {})
      .then((rows) => {
        if (!alive) return;
        setExpenses(rows.map(toExpense));
        setLoadingRollups(false);
      })
      .catch(() => {
        // Channel error or running outside Electron — no rollups rather than
        // page-scoped ones.
        if (alive) setLoadingRollups(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const tree = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtered = t ? categories.filter((c) => c.name.toLowerCase().includes(t)) : categories;
    const roots = filtered.filter((c) => !c.parentId);
    return roots.map((root) => ({
      ...root,
      children: filtered.filter((c) => c.parentId === root.id),
    }));
  }, [categories, q]);

  const expenseCount = (id: string) =>
    expenses.filter((e) => !e.voided && e.categoryId === id).length;
  const monthSpend = (id: string) => {
    const now = new Date();
    return expenses
      .filter(
        (e) =>
          !e.voided &&
          e.categoryId === id &&
          new Date(e.date).getMonth() === now.getMonth() &&
          new Date(e.date).getFullYear() === now.getFullYear(),
      )
      .reduce((s, e) => s + e.amount, 0);
  };

  const onDelete = async (c: ExpenseCategory) => {
    const used = expenseCount(c.id);
    const childCount = categories.filter((x) => x.parentId === c.id).length;
    const notes: string[] = [];
    if (used > 0) notes.push(`${used} expense(s) use this category.`);
    if (childCount > 0)
      notes.push(`${childCount} subcategor${childCount === 1 ? 'y' : 'ies'} will be detached.`);
    const ok = await confirm({
      title: `Delete "${c.name}"?`,
      message: notes.length > 0 ? notes.join(' ') : undefined,
      variant: 'destructive',
    });
    if (!ok) return;
    removeCategory(c.id);
  };

  return (
    <div>
      <PageHeader
        title="Expense Categories"
        subtitle={`${categories.length} categories · subcategories supported${
          loadingRollups ? ' · loading totals…' : ''
        }`}
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
                count={expenseCount(cat.id)}
                spend={monthSpend(cat.id)}
                onEdit={() => setEditing(cat)}
                onDelete={() => onDelete(cat)}
              />
              {cat.children.map((child) => (
                <Row
                  key={child.id}
                  cat={child}
                  indent
                  count={expenseCount(child.id)}
                  spend={monthSpend(child.id)}
                  onEdit={() => setEditing(child)}
                  onDelete={() => onDelete(child)}
                />
              ))}
            </div>
          ))}
          {tree.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No categories.
            </div>
          )}
        </Card>
      </div>

      {editing && (
        <NewExpenseCategoryModal
          open={!!editing}
          onClose={() => setEditing(null)}
          onCreated={() => setEditing(null)}
          initial={editing === 'new' ? undefined : editing}
        />
      )}
    </div>
  );
}

function Row({
  cat,
  count,
  spend,
  indent,
  onEdit,
  onDelete,
}: {
  cat: ExpenseCategory;
  count: number;
  spend: number;
  indent?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overBudget = cat.monthlyBudget && spend > cat.monthlyBudget;
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
        <div className="text-[11px] text-muted-foreground">
          {count} expense{count === 1 ? '' : 's'}{' '}
          {cat.monthlyBudget ? (
            <>
              · this month{' '}
              <span
                className={cn(
                  'font-mono tabular',
                  overBudget && 'text-destructive font-semibold',
                )}
              >
                {formatBDT(spend, { withSymbol: false })}
              </span>{' '}
              / {formatBDT(cat.monthlyBudget, { withSymbol: false })}
            </>
          ) : (
            <>
              · this month <span className="font-mono tabular">{formatBDT(spend, { withSymbol: false })}</span>
            </>
          )}
        </div>
      </div>
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
