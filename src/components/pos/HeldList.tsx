import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Search, Receipt, Trash2 } from 'lucide-react';
import { cn, formatBDT } from '@/lib/utils';
import { computeTotals, type ParkedCart } from './types';
import { customers as mockCustomers, type Customer } from '@/mocks/data';

interface Props {
  open: boolean;
  onClose: () => void;
  carts: ParkedCart[];
  onResume: (id: string) => void;
  onDiscard: (id: string) => void;
  /** Live customer list (backend-hydrated) used to resolve held-cart names.
   *  Defaults to mock data so browser dev / standalone usage still works. */
  customers?: Customer[];
}

export function HeldList({ open, onClose, carts, onResume, onDiscard, customers = mockCustomers }: Props) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return carts;
    return carts.filter((c) => {
      const cust = customers.find((x) => x.id === c.customerId);
      return `${c.label} ${cust?.name ?? ''}`.toLowerCase().includes(t);
    });
  }, [carts, q, customers]);

  return (
    <Modal open={open} onClose={onClose} width="max-w-2xl" title="Held / Parked Carts" subtitle="F5 to open · Enter resumes the highlighted cart">
      <div className="p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by label or customer…"
            className="pl-9 h-10"
          />
        </div>

        <div className="rounded-lg border border-border divide-y divide-border max-h-[55vh] overflow-auto scroll-hide">
          {list.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No held carts.</div>
          )}
          {list.map((c) => {
            const cust = customers.find((x) => x.id === c.customerId);
            const totals = computeTotals(c);
            return (
              <div key={c.id} className={cn('flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40')}>
                <div className="size-9 rounded-md bg-secondary grid place-items-center text-muted-foreground">
                  <Receipt className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{c.label}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {cust?.name ?? 'Walk-in'} · {c.lines.length} items · {c.priceGroup}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono tabular font-semibold">
                    {formatBDT(totals.total)}
                  </div>
                </div>
                <button
                  onClick={() => onResume(c.id)}
                  className="px-3 h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                >
                  Resume
                </button>
                <button
                  onClick={() => onDiscard(c.id)}
                  className="size-8 grid place-items-center rounded-md border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
                  title="Discard"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
