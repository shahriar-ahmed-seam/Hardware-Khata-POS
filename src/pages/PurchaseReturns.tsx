import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { reasonLabel, refundLabel } from '@/components/purchases/labels';
import { formatDate } from '@/lib/formatDate';
import { Pagination } from '@/components/ui/Pagination';
import { usePurchases } from '@/stores/purchases';
import { formatBDT } from '@/lib/utils';
import { sum2 } from '@/lib/money';
import { hasBackend } from '@/lib/api';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ReturnDetail } from '@/components/returns/ReturnDetail';

export default function PurchaseReturns() {
  const nav = useNavigate();
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

  // Over the full filtered set. A credit adjustment is not cash back — split them.
  const cashBack = sum2(list.filter((r) => r.refundMethod !== 'CreditAdjust').map((r) => r.total));
  const offDues = sum2(list.filter((r) => r.refundMethod === 'CreditAdjust').map((r) => r.total));

  return (
    <div>
      <PageHeader
        title="Purchase Returns"
        actions={
          <>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ref / bill / supplier…"
                className="pl-9"
                aria-label="Search returns"
              />
            </div>
            <Button variant="outline" onClick={() => nav('/purchases')}>
              <ArrowLeft className="size-4" /> Back to purchases
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        {list.length > 0 && (
          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4">
            <span>
              <span className="tabular text-foreground font-medium">{formatBDT(cashBack)}</span> <span>cash back</span>
            </span>
            <span>
              <span className="tabular text-foreground font-medium">{formatBDT(offDues)}</span> <span>taken off dues</span>
            </span>
          </div>
        )}
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
                <th className="text-left px-2 py-2.5 font-medium">From bill</th>
                <th className="text-left px-2 py-2.5 font-medium">Supplier</th>
                <th className="text-left px-2 py-2.5 font-medium">Reason</th>
                <th className="text-left px-2 py-2.5 font-medium">Refund via</th>
                <th className="text-right px-2 py-2.5 font-medium">Refund</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setViewing(r.id)}
                  className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                >
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-2 py-3 font-mono whitespace-nowrap">{r.refNo}</td>
                  <td className="px-2 py-3 font-mono whitespace-nowrap">{r.purchaseRefNo}</td>
                  <td className="px-2 py-3 font-medium">{r.supplierName}</td>
                  <td className="px-2 py-3">{r.reason ? reasonLabel(r.reason) : '—'}</td>
                  <td className="px-2 py-3">
                    <Badge variant="default">{refundLabel(r.refundMethod)}</Badge>
                  </td>
                  <td className="px-2 py-3 text-right tabular whitespace-nowrap font-semibold">
                    {formatBDT(r.total)}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    {returns.length > 0 ? (
                      <div className="px-4 py-12 text-center text-muted-foreground text-sm">No returns match.</div>
                    ) : (
                      <EmptyState
                        compact
                        icon={Undo2}
                        title="No purchase returns yet."
                        message="To send goods back, open the purchase and choose Create return."
                        action={<Button onClick={() => nav('/purchases')}>Go to purchases</Button>}
                      />
                    )}
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
