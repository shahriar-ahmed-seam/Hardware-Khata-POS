import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Search, Pause } from 'lucide-react';
import { cn, formatBDT } from '@/lib/utils';
import { labelFor } from '@/lib/labels';
import { computeTotals, type ParkedCart } from './types';
import type { Customer } from '@/types/domain';

interface Props {
  open: boolean;
  onClose: () => void;
  carts: ParkedCart[];
  onResume: (id: string) => void;
  onDiscard: (id: string) => void;
  /** Live customer list used to name each held cart (unknown id → Walk-in). */
  customers?: Customer[];
}

/** Search only pays off once the list is longer than a glance. */
const SEARCH_FROM = 6;

export function HeldList({ open, onClose, carts, onResume, onDiscard, customers = [] }: Props) {
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const nameOf = (c: ParkedCart) => customers.find((x) => x.id === c.customerId)?.name;

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return carts;
    return carts.filter((c) => {
      const items = c.lines.map((l) => l.name).join(' ');
      return `${nameOf(c) ?? ''} ${items}`.toLowerCase().includes(t);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carts, q, customers]);

  useEffect(() => {
    if (open) {
      setQ('');
      setHi(0);
    }
  }, [open]);
  useEffect(() => {
    setHi((h) => Math.min(h, Math.max(0, list.length - 1)));
  }, [list.length]);
  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-row="${hi}"]`);
    row?.scrollIntoView({ block: 'nearest' });
    // Without a search box the caret sits on a Resume button: keep it on the
    // highlighted row so Enter resumes what is highlighted.
    if (document.activeElement?.tagName === 'BUTTON' && listRef.current?.contains(document.activeElement)) {
      row?.querySelector<HTMLElement>('button')?.focus();
    }
  }, [hi]);

  // ↑ / ↓ move the highlight, Enter resumes it.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (list.length === 0) return;
    if (e.key === 'ArrowDown') setHi((h) => Math.min(list.length - 1, h + 1));
    else if (e.key === 'ArrowUp') setHi((h) => Math.max(0, h - 1));
    else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') onResume(list[hi].id);
    else return;
    e.preventDefault();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-xl"
      title="Held carts"
      subtitle={carts.length > 0 ? '↑ ↓ to choose, Enter to resume' : undefined}
    >
      <div className="p-4" onKeyDown={onKeyDown} tabIndex={-1}>
        {carts.length >= SEARCH_FROM && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by customer or item…"
              aria-label="Search held carts"
              className="pl-9"
            />
          </div>
        )}
        {carts.length === 0 ? (
          <EmptyState
            compact
            icon={Pause}
            title="No held carts"
            message="Press Hold when a customer steps away. Their cart waits here."
          />
        ) : (
          <div
            ref={listRef}
            className="rounded-lg border border-border divide-y divide-border max-h-[55vh] overflow-auto"
          >
            {list.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">No held cart matches.</div>
            )}
            {list.map((c, i) => {
              const totals = computeTotals(c);
              const items = c.lines.slice(0, 2).map((l) => l.name).join(', ');
              const more = c.lines.length - 2;
              return (
                <div
                  key={c.id}
                  data-row={i}
                  onMouseEnter={() => setHi(i)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3',
                    i === hi ? 'bg-primary/10' : 'hover:bg-secondary/40',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{nameOf(c) ?? 'Walk-in customer'}</div>
                    <div className="text-xs text-muted-foreground truncate" data-no-i18n>
                      {items}
                      {more > 0 && ` +${more}`}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="tabular">{c.lines.length}</span>
                      <span>{c.lines.length === 1 ? 'item' : 'items'}</span>
                      <span aria-hidden>·</span>
                      <span>{labelFor('priceGroup', c.priceGroup)}</span>
                    </div>
                  </div>
                  <div className="text-base tabular font-semibold shrink-0">{formatBDT(totals.total)}</div>
                  <Button size="md" onClick={() => onResume(c.id)}>
                    Resume
                  </Button>
                  <Button
                    size="md"
                    variant="ghost"
                    className="ml-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onDiscard(c.id)}
                  >
                    Discard
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
