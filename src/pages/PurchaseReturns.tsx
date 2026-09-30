import { useEffect, useMemo, useState } from 'react';
import { Search, Eye } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { usePurchases } from '@/stores/purchases';
import { formatBDT } from '@/lib/utils';
import { sum2 } from '@/lib/money';
import { hasBackend } from '@/lib/api';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ReturnDetail } from '@/components/returns/ReturnDetail';

export default function PurchaseReturns() {
  const returns = usePurchases((s) => s.returns);
  const loading = usePurchases((s) => s.loading);
  const hydrate = usePurchases((s) => s.hydrate);
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState<string | null>(null);
  const backend = hasBackend();

  // Client-side paging: `purchaseReturns.list` is header-only and this list
  // grows slowly, so every row is already in memory — we slice the filtered set.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Mirror Purchases.tsx: hydrate from the backend on mount. The store's
  // hydrate() loads `purchaseReturns.list` into `returns` (it used to load
  // purchases only, so this screen was always empty).
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

  // Search change resets to page 1 — staying on page 5 of a narrower result set
  // would show an empty table.
  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  // Clamp so a shrinking list can never leave the user past the last page.
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => list.slice((current - 1) * pageSize, current * pageSize),
    [list, current, pageSize],
  );

  // Summed over the FULL filtered set, not just this page — all rows are in
  // memory, so there is no reason to scope this to the visible slice.
  const total = sum2(list.map((r) => r.total));

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
          <>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-secondary/50">
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
              {pageRows.map((r) => (
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
                  <td className="px-2 py-2.5 text-right tabular font-semibold text-warning">
                    {formatBDT(r.total)}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      className="size-7 grid place-items-center rounded hover:bg-secondary"
                      title="View"
                      onClick={() => setViewing(r.id)}
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
          <Pagination
            page={current}
            pageSize={pageSize}
            total={list.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            label="returns"
          />
          </>
          )}
        </Card>
      </div>

      <ReturnDetail kind="purchase" id={viewing} open={!!viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
