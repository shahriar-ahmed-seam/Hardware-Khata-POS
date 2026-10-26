import { FormEvent, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { api } from '@/lib/api';

/**
 * "Return goods from which invoice?" — Sell Returns' New Return. It used to
 * toast and jump to the 50-row Sales list; now the invoice number is typed (or
 * scanned) here and the return opens straight away.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the sale id found for the typed number. */
  onFound: (saleId: string) => void;
}

interface Row {
  id: string;
  invoiceNo: string;
}

export function FindSaleForReturnModal({ open, onClose, onFound }: Props) {
  const [no, setNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNo('');
      setError(null);
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const want = no.trim();
    if (!want || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Same server search the Sales list uses; only finished sales can be returned.
      const res = await api<{ rows: Row[] }>('sales.listPage', {
        page: 1,
        pageSize: 10,
        statuses: ['final'],
        q: want,
      });
      const lower = want.toLowerCase();
      const hit =
        res.rows.find((r) => r.invoiceNo.toLowerCase() === lower) ??
        // "3177" for "INV-2026-3177": accept a unique ending.
        (() => {
          const ends = res.rows.filter((r) => r.invoiceNo.toLowerCase().endsWith(lower));
          return ends.length === 1 ? ends[0] : undefined;
        })();
      if (hit) onFound(hit.id);
      else setError('No finished sale has that invoice number.');
    } catch {
      setError('Could not search the sales. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Return goods from which invoice?" width="max-w-md">
      <form onSubmit={(e) => void submit(e)} className="px-6 py-5 space-y-4">
        <FormField
          label="Invoice number"
          error={error}
          hint="Type or scan the number on the customer's receipt."
        >
          {(f) => (
            <Input
              {...f}
              autoFocus
              autoComplete="off"
              value={no}
              onChange={(e) => {
                setNo(e.target.value);
                setError(null);
              }}
              placeholder="INV-2026-0001"
            />
          )}
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !no.trim()}>
            <Search className="size-4" /> Find sale
          </Button>
        </div>
      </form>
    </Modal>
  );
}
