import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, User, Phone, Wallet, AlertTriangle, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { customers as mockCustomers, type Customer } from '@/mocks/data';
import { cn, formatBDT } from '@/lib/utils';
import { api, hasBackend } from '@/lib/api';
import { useCustomersQuery, CUSTOMERS_KEY } from '@/hooks/useCustomers';
import { toast } from '@/stores/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
}

export function CustomerPicker({ open, onClose, selectedId, onSelect }: Props) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const backend = hasBackend();
  const qc = useQueryClient();
  const customersQuery = useCustomersQuery();

  // Mock path keeps a local list so inline-added customers appear immediately.
  const [mockList, setMockList] = useState<Customer[]>(mockCustomers);
  const list: Customer[] = backend ? (customersQuery.data ?? []) : mockList;

  useEffect(() => {
    if (!open) {
      setQ('');
      setAdding(false);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(t));
  }, [list, q]);

  const pick = (id: string) => {
    onSelect(id);
    onClose();
  };

  const addCustomerInline = async (data: {
    name: string;
    phone: string;
    group: Customer['group'];
  }) => {
    if (backend) {
      try {
        // Persist, then refetch and select the returned backend id.
        const res = await api<{ id: string }>('customers.create', {
          name: data.name,
          phone: data.phone,
          group: data.group,
        });
        await qc.invalidateQueries({ queryKey: [CUSTOMERS_KEY] });
        pick(res.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to add customer');
      }
      return;
    }
    // ---- mock path (unchanged): local optimistic add ----
    const id = 'cu_' + Date.now();
    const c: Customer = {
      id,
      ...data,
      due: 0,
      totalPurchase: 0,
      joined: new Date().toISOString().slice(0, 10),
    };
    setMockList((cs) => [c, ...cs]);
    pick(id);
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-2xl" title="Select Customer" subtitle="F3 from POS">
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
                  placeholder="Search name or phone…"
                  className="pl-9 h-10"
                />
              </div>
              <Button onClick={() => setAdding(true)}>
                <Plus className="size-4" /> New
              </Button>
            </div>

            <div className="max-h-[55vh] overflow-auto scroll-hide rounded-lg border border-border divide-y divide-border">
              {filtered.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No customers match "{q}". <button onClick={() => setAdding(true)} className="text-primary underline">Add new</button>
                </div>
              )}
              {filtered.map((c) => {
                const overLimit = !!c.creditLimit && c.due >= c.creditLimit;
                return (
                  <button
                    key={c.id}
                    onClick={() => pick(c.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/50 transition',
                      selectedId === c.id && 'bg-primary/5',
                    )}
                  >
                    <div className="size-9 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-white text-[11px] font-bold">
                      {c.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold truncate">{c.name}</div>
                        <Badge
                          variant={c.group === 'Wholesale' ? 'info' : c.group === 'Contractor' ? 'warning' : 'default'}
                        >
                          {c.group}
                        </Badge>
                        {overLimit && (
                          <Badge variant="destructive">
                            <AlertTriangle className="size-3" /> Over limit
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">{c.phone}</div>
                    </div>
                    <div className="text-right">
                      {c.due > 0 ? (
                        <div className="text-xs font-mono tabular text-destructive">
                          Due {formatBDT(c.due, { withSymbol: false })}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No dues</div>
                      )}
                      {c.creditLimit ? (
                        <div className="text-[10px] text-muted-foreground">
                          Limit ৳{c.creditLimit.toLocaleString()}
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

        {adding && <NewCustomerForm onAdd={addCustomerInline} onCancel={() => setAdding(false)} />}
      </div>
    </Modal>
  );
}

function NewCustomerForm({
  onAdd,
  onCancel,
}: {
  onAdd: (d: { name: string; phone: string; group: Customer['group'] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [group, setGroup] = useState<Customer['group']>('Retail');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onAdd({ name: name.trim(), phone: phone.trim() || '-', group });
      }}
      className="space-y-3"
    >
      <div className="text-sm font-semibold flex items-center gap-2">
        <User className="size-4" /> Add new customer
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Name *</label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Phone</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXX-XXXXXX" />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Group</label>
          <div className="flex items-center gap-1 p-0.5 bg-secondary rounded-md text-xs mt-1">
            {(['Retail', 'Wholesale', 'Contractor'] as Customer['group'][]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={cn(
                  'flex-1 h-9 rounded font-medium transition',
                  group === g
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
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
