import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** One row of a customer's or supplier's khata, as the screens render it. */
export interface KhataRow {
  id: string;
  date: string;
  type: 'opening' | 'sale' | 'purchase' | 'payment' | 'return';
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  /** The sale (customer side) or purchase (supplier side) the row belongs to. */
  docId?: string;
}

interface BackendLedgerRow {
  date: string;
  type: KhataRow['type'];
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  docId?: string;
}

/**
 * The khata, AS THE BACKEND KEEPS IT (`customerLedger` / `supplierLedger` in
 * backend/services/ledger.ts), so its last balance is exactly the due the page
 * states. Both detail pages used to rebuild it from the rows they happened to
 * have loaded, which left out held credits and money paid on account — the tab's
 * closing balance and "Outstanding" could disagree.
 *
 * `refresh` is any value that changes after a write (the page's reload key, the
 * derived due), so the khata re-reads when the books move.
 */
export function useKhata(kind: 'customer' | 'supplier', id: string | undefined, refresh: unknown): {
  rows: KhataRow[];
  loading: boolean;
} {
  const [rows, setRows] = useState<KhataRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setRows([]);
      return;
    }
    let alive = true;
    setLoading(true);
    void api<{ ledger?: BackendLedgerRow[] } | null>(kind === 'customer' ? 'customers.get' : 'suppliers.get', { id })
      .then((res) => {
        if (!alive) return;
        setRows(
          (res?.ledger ?? []).map((e, i) => ({
            id: `${i}-${e.type}-${e.docId ?? ''}`,
            date: e.date,
            type: e.type,
            reference: e.reference,
            debit: e.debit,
            credit: e.credit,
            balance: e.balance,
            docId: e.docId,
          })),
        );
      })
      .catch(() => {
        if (alive) setRows([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [kind, id, refresh]);

  return { rows, loading };
}
