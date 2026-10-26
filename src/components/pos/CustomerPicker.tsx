import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search, Plus, User, AlertTriangle, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FormField } from '@/components/ui/FormField';
import { Segmented } from '@/components/ui/Segmented';
import { labelFor } from '@/lib/labels';
import type { Customer } from '@/types/domain';
import { cn, formatBDT } from '@/lib/utils';
import { api } from '@/lib/api';
import { useCustomersQuery, CUSTOMERS_KEY } from '@/hooks/useCustomers';
import { toast } from '@/stores/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
  /**
   * Open straight on the "add customer" form instead of the search list.
   *
   * Used by the "+" next to the Customer dropdown on the sale forms: the user has
   * already decided the customer is not in the list, so showing them the list
   * first is one click of friction for nothing.
   */
  startInAdd?: boolean;
  /** POS: pin "Walk-in customer" (id 'cu1') as the first row, to undo a pick. */
  showWalkIn?: boolean;
}

const WALK_IN = 'cu1';

export function CustomerPicker({ open, onClose, selectedId, onSelect, startInAdd, showWalkIn }: Props) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(!!startInAdd);
  const [hi, setHi] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const customersQuery = useCustomersQuery();

  // Single source of truth: the backend customers query (seed fallback removed).
  const list: Customer[] = customersQuery.data ?? [];
  const loading = customersQuery.isLoading;

  useEffect(() => {
    // Reset on every open/close so a previous visit's search text or half-typed
    // new customer never carries over.
    setQ('');
    setHi(0);
    setAdding(open ? !!startInAdd : false);
  }, [open, startInAdd]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(t));
  }, [list, q]);

  const pick = (id: string) => {
    onSelect(id);
    onClose();
  };

  // Rows in keyboard order: Walk-in first (POS, no search), then matches.
  const walkInRow = showWalkIn && !q.trim();
  const ids = useMemo(
    () => [...(walkInRow ? [WALK_IN] : []), ...filtered.map((c) => c.id)],
    [walkInRow, filtered],
  );
  useEffect(() => setHi(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${hi}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [hi]);

  /** ↑ / ↓ move, Enter picks; with no match Enter opens "New" with the text. */
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') setHi((h) => Math.min(ids.length - 1, h + 1));
    else if (e.key === 'ArrowUp') setHi((h) => Math.max(0, h - 1));
    else if (e.key === 'Enter') {
      if (ids[hi]) pick(ids[hi]);
      else if (!loading) setAdding(true);
    } else return;
    e.preventDefault();
  };
  // Typed text prefills the new-customer form: digits → phone, else name.
  const typed = q.trim();
  const typedIsPhone = /^[\d\s+-]+$/.test(typed);

  const addCustomerInline = async (data: {
    name: string;
    phone: string;
    group: Customer['group'];
  }) => {
    try {
      // Persist, then refetch and select the returned backend id.
      const res = await api<{ id: string }>('customers.create', {
        name: data.name,
        phone: data.phone || undefined,
        group: data.group,
      });
      await qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY] });
      pick(res.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add customer');
    }
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-xl" title="Choose customer">
      <div className="p-4">
        {!adding && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder="Search name or phone…"
                  aria-label="Search customers"
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setAdding(true)}>
                <Plus className="size-4" /> New
              </Button>
            </div>

            <div
              ref={listRef}
              className="max-h-[55vh] overflow-auto rounded-lg border border-border divide-y divide-border"
            >
              {walkInRow && (
                <button
                  data-row={0}
                  onClick={() => pick(WALK_IN)}
                  onMouseEnter={() => setHi(0)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 text-left transition',
                    hi === 0 ? 'bg-primary/10' : 'hover:bg-secondary/50',
                  )}
                >
                  <User className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">Walk-in customer</div>
                    <div className="text-xs text-muted-foreground">No name, pays now</div>
                  </div>
                  {selectedId === WALK_IN && <Check className="size-4 text-primary" />}
                </button>
              )}
              {loading && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Loading customers…
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground space-y-3">
                  <div>No customer matches this search.</div>
                  <Button variant="outline" size="md" onClick={() => setAdding(true)}>
                    <Plus className="size-4" /> Add new customer
                  </Button>
                </div>
              )}
              {filtered.map((c, i) => {
                const overLimit = !!c.creditLimit && c.due >= c.creditLimit;
                const row = i + (walkInRow ? 1 : 0);
                return (
                  <button
                    key={c.id}
                    data-row={row}
                    onClick={() => pick(c.id)}
                    onMouseEnter={() => setHi(row)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 text-left transition',
                      hi === row ? 'bg-primary/10' : 'hover:bg-secondary/50',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold truncate">{c.name}</div>
                        <Badge
                          variant={c.group === 'Wholesale' ? 'info' : c.group === 'Contractor' ? 'warning' : 'default'}
                        >
                          {labelFor('priceGroup', c.group)}
                        </Badge>
                        {overLimit && (
                          <Badge variant="destructive">
                            <AlertTriangle className="size-3" /> Over limit
                          </Badge>
                        )}
                      </div>
                      {c.phone && c.phone !== '-' && (
                        <div className="text-sm text-muted-foreground tabular">{c.phone}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {c.due > 0 ? (
                        <div className="text-sm font-semibold tabular text-destructive">
                          <span>Due</span> <span>{formatBDT(c.due, { withSymbol: false })}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No dues</div>
                      )}
                      {c.creditLimit ? (
                        <div className="text-xs text-muted-foreground">
                          <span>Limit</span> <span className="tabular">{formatBDT(c.creditLimit)}</span>
                        </div>
                      ) : null}
                    </div>
                    {selectedId === c.id && <Check className="size-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {adding && (
          <NewCustomerForm
            initialName={typed && !typedIsPhone ? typed : ''}
            initialPhone={typed && typedIsPhone ? typed : ''}
            onAdd={addCustomerInline}
            onCancel={() => setAdding(false)}
          />
        )}
      </div>
    </Modal>
  );
}

function NewCustomerForm({
  initialName = '',
  initialPhone = '',
  onAdd,
  onCancel,
}: {
  initialName?: string;
  initialPhone?: string;
  onAdd: (d: { name: string; phone: string; group: Customer['group'] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [group, setGroup] = useState<Customer['group']>('Retail');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // An empty phone stays empty (it used to be saved as "-").
        if (name.trim()) onAdd({ name: name.trim(), phone: phone.trim(), group });
      }}
      className="space-y-3"
    >
      <div className="text-base font-semibold flex items-center gap-2">
        <User className="size-4" /> Add new customer
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Name" required>
          {(f) => <Input {...f} autoFocus={!initialPhone} value={name} onChange={(e) => setName(e.target.value)} />}
        </FormField>
        <FormField label="Phone">
          {(f) => (
            <Input
              {...f}
              autoFocus={!!initialPhone}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXX-XXXXXX"
              inputMode="tel"
            />
          )}
        </FormField>
        <FormField label="Price group" className="sm:col-span-2">
          {() => (
            <Segmented
              ariaLabel="Price group"
              fullWidth
              value={group}
              onChange={setGroup}
              options={(['Retail', 'Wholesale', 'Contractor'] as Customer['group'][]).map((g) => ({
                value: g,
                label: labelFor('priceGroup', g),
              }))}
            />
          )}
        </FormField>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          Save & Select
        </Button>
      </div>
    </form>
  );
}
