import { useEffect, useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatBDT } from '@/lib/utils';
import { toSellReturnRecord, type BackendSellReturn } from '@/hooks/saleAdapter';
import { toPurchaseReturnRecord, type BackendPurchaseReturn } from '@/hooks/purchaseAdapter';

/**
 * WHAT CAME BACK ON ONE RETURN.
 *
 * Both return lists had an Eye button with no handler, and there was no way
 * anywhere in the app to see which items a return contained. The lists are
 * header-only, so the lines are read here, on demand, with `sellReturns.get` /
 * `purchaseReturns.get`.
 */

interface ViewModel {
  refNo: string;
  date: string;
  original: string;
  partyLabel: string;
  party: string;
  reason?: string;
  refundMethod: string;
  user: string;
  notes?: string;
  total: number;
  lines: { name: string; sku: string; qty: number; unit: string; refundAmount: number }[];
}

interface Props {
  kind: 'sell' | 'purchase';
  id: string | null;
  open: boolean;
  onClose: () => void;
}

export function ReturnDetail({ kind, id, open, onClose }: Props) {
  const [view, setView] = useState<ViewModel | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    if (!open || !id) return;
    let alive = true;
    setState('loading');
    setView(null);
    const load =
      kind === 'sell'
        ? api<BackendSellReturn | null>('sellReturns.get', { id }).then((row): ViewModel | null => {
            if (!row) return null;
            const r = toSellReturnRecord(row);
            return {
              refNo: r.refNo,
              date: r.date,
              original: r.saleInvoiceNo || '—',
              partyLabel: 'Customer',
              party: r.customerName,
              reason: r.reason,
              refundMethod: r.refundMethod,
              user: r.user,
              notes: r.notes,
              total: r.total,
              lines: r.lines,
            };
          })
        : api<BackendPurchaseReturn | null>('purchaseReturns.get', { id }).then((row): ViewModel | null => {
            if (!row) return null;
            const r = toPurchaseReturnRecord(row);
            return {
              refNo: r.refNo,
              date: r.date,
              original: r.purchaseRefNo || '—',
              partyLabel: 'Supplier',
              party: r.supplierName,
              reason: r.reason,
              refundMethod: r.refundMethod,
              user: r.user,
              notes: r.notes,
              total: r.total,
              lines: r.lines,
            };
          });
    load
      .then((v) => {
        if (!alive) return;
        setView(v);
        setState(v ? 'ready' : 'missing');
      })
      .catch(() => {
        if (alive) setState('missing');
      });
    return () => {
      alive = false;
    };
  }, [open, id, kind]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={view ? `Return ${view.refNo}` : 'Return'}
      width="max-w-2xl"
    >
      {!view ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          {state === 'missing' ? 'That return could not be found.' : 'Loading return…'}
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Date" value={new Date(view.date).toLocaleString('en-GB')} />
            <Field label="Against" value={view.original} mono />
            <Field label={view.partyLabel} value={view.party} />
            <Field label="Recorded by" value={view.user || '—'} />
            <Field label="Reason" value={view.reason ?? '—'} />
            <div>
              <div className="text-xs text-muted-foreground">Refund via</div>
              <Badge variant="default">{view.refundMethod}</Badge>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-secondary/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Item</th>
                  <th className="text-right px-2 py-2 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 font-medium">Refund</th>
                </tr>
              </thead>
              <tbody>
                {view.lines.map((l, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{l.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{l.sku}</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular">
                      {l.qty} {l.unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular">{formatBDT(l.refundAmount)}</td>
                  </tr>
                ))}
                {view.lines.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      No items are recorded on this return.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-secondary/30">
                  <td className="px-3 py-2 font-semibold" colSpan={2}>
                    Total refund
                  </td>
                  <td className="px-3 py-2 text-right tabular font-bold">{formatBDT(view.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {view.notes && (
            <div className="text-sm">
              <div className="text-xs text-muted-foreground">Notes</div>
              <div className="whitespace-pre-wrap">{view.notes}</div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? 'font-mono text-sm' : 'font-medium'}>{value}</div>
    </div>
  );
}
