import { useEffect, useMemo, useState } from 'react';
import { Search, Eye } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { usePurchases } from '@/stores/purchases';
import { formatBDT } from '@/lib/utils';
import { hasBackend } from '@/lib/api';
import { SkeletonTable } from '@/components/ui/Skeleton';

export default function PurchaseReturns() {
  const returns = usePurchases((s) => s.returns);
  const loading = usePurchases((s) => s.loading);
  const hydrate = usePurchases((s) => s.hydrate);
  const [q, setQ] = useState('');
  const backend = hasBackend();

  // Mirror Purchases.tsx: hydrate from the backend on mount so the store is
  // populated when this page is the entry point.
  // NOTE (deferred): the store's hydrate() currently loads purchases only — it
  // does not yet map backend purchase_returns into `returns` (no return adapter
  // + detail fetch exists yet). Wired with the Contacts/Returns slice.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const list = useMemo(() => {
    if (!q) return returns;
    const t = q.toLowerCase();
    return returns.filter((r) =>
      `${r.refNo} ${r.purchaseRefNo} ${r.supplierName}`.toLowerCase().includes(t),
    );
  }, [returns, q]);

  const total = list.reduce((s, r) => s + r.total, 0);

  return (
    <div>
      <PageHeader
        title="Purchase Returns"
        subtitle={`${list.length} returns · ${formatBDT(total)} refunded`}
      />

      <div className="p-6 space-y-4">
        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ref / original / supplier…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          {backend && loading && returns.length === 0 ? (
            <div className="p-4">
              <SkeletonTable count={6} />
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-2 py-2.5 font-medium">Return #</th>
                <th className="text-left px-2 py-2.5 font-medium">Original</th>
                <th className="text-left px-2 py-2.5 font-medium">Supplier</th>
                <th className="text-left px-2 py-2.5 font-medium">Reason</th>
                <th className="text-left px-2 py-2.5 font-medium">Refund via</th>
                <th className="text-right px-2 py-2.5 font-medium">Refund</th>
                <th className="px-4 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-secondary/40">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(r.date).toLocaleString('en-GB')}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs">{r.refNo}</td>
                  <td className="px-2 py-2.5 font-mono text-xs">{r.purchaseRefNo}</td>
                  <td className="px-2 py-2.5 font-medium">{r.supplierName}</td>
                  <td className="px-2 py-2.5 capitalize text-xs">{r.reason ?? '—'}</td>
                  <td className="px-2 py-2.5 text-xs">
                    <Badge variant="default">{r.refundMethod}</Badge>
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono tabular font-semibold text-warning">
                    {formatBDT(r.total)}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      className="size-7 grid place-items-center rounded hover:bg-secondary"
                      title="View"
                    >
                      <Eye className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No purchase returns recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </Card>
      </div>
    </div>
  );
}
