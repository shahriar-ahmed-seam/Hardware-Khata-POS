import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { useSales, type SellReturn } from '@/stores/sales';
import { formatBDT } from '@/lib/utils';
import { sum2 } from '@/lib/money';
import { hasBackend } from '@/lib/api';
import { labelFor } from '@/lib/labels';
import { useDateFormat } from '@/lib/formatDate';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ReturnDetail } from '@/components/returns/ReturnDetail';
import { CreateReturnModal } from '@/components/sales/CreateReturnModal';
import { FindSaleForReturnModal } from '@/components/sales/FindSaleForReturnModal';

/** How the money went back, in the owner's words ("CreditAdjust" meant nothing). */
const REFUND_LABEL: Partial<Record<SellReturn['refundMethod'], string>> = {
  Cash: 'Cash back',
  CreditAdjust: 'Taken off khata',
  StoreCredit: 'Kept as credit',
};
const refundLabel = (m: SellReturn['refundMethod']) =>
  REFUND_LABEL[m] ?? labelFor('paymentMethod', m);

export default function SellReturns() {
  const nav = useNavigate();
  const fmt = useDateFormat();
  const returns = useSales((s) => s.returns);
  const loading = useSales((s) => s.loading);
  const hydrate = useSales((s) => s.hydrate);
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState<string | null>(null);
  // New Return: ask for the invoice, then open the return form for it.
  const [finding, setFinding] = useState(false);
  const [returnFor, setReturnFor] = useState<string | null>(null);
  const backend = hasBackend();

  // Client-side paging: `sellReturns.list` is header-only and grows slowly.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Hydrate on mount so the store is filled when this page is the entry point.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const list = useMemo(() => {
    if (!q) return returns;
    const t = q.toLowerCase();
    return returns.filter((r) =>
      `${r.refNo} ${r.saleInvoiceNo} ${r.customerName}`.toLowerCase().includes(t),
    );
  }, [returns, q]);

  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => list.slice((current - 1) * pageSize, current * pageSize),
    [list, current, pageSize],
  );

  // Over the FULL filtered set (all rows are in memory). Split by where the
  // money went: a credit note is not cash out of the drawer.
  const split = useMemo(() => {
    const off = list.filter((r) => r.refundMethod === 'CreditAdjust');
    const kept = list.filter((r) => r.refundMethod === 'StoreCredit');
    const back = list.filter((r) => r.refundMethod !== 'CreditAdjust' && r.refundMethod !== 'StoreCredit');
    return {
      back: sum2(back.map((r) => r.total)),
      off: sum2(off.map((r) => r.total)),
      kept: sum2(kept.map((r) => r.total)),
    };
  }, [list]);

  const firstLoad = backend && loading && returns.length === 0;
  const nothing = !firstLoad && returns.length === 0;

  return (
    <div>
      <PageHeader
        title="Sell Returns"
        actions={
          <Button onClick={() => setFinding(true)}>
            <Plus className="size-4" /> New Return
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {nothing ? (
          <Card>
            <EmptyState
              icon={Undo2}
              title="No returns yet"
              message="Returns are made from a sale: open the sale and choose Return."
              action={
                <Button variant="outline" onClick={() => nav('/sales')}>
                  Go to sales
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <Card className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search return ref / invoice / customer…"
                  aria-label="Search return ref / invoice / customer…"
                  className="pl-9"
                />
              </div>
            </Card>

            {list.length > 0 && (
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground px-1">
                <span>
                  <span>Returns</span>{' '}
                  <span className="font-semibold text-foreground tabular">{list.length}</span>
                </span>
                <span>
                  <span>Money back</span>{' '}
                  <span className="font-semibold text-foreground tabular">{formatBDT(split.back)}</span>
                </span>
                {split.off > 0 && (
                  <span>
                    <span>Taken off khata</span>{' '}
                    <span className="font-semibold text-foreground tabular">{formatBDT(split.off)}</span>
                  </span>
                )}
                {split.kept > 0 && (
                  <span>
                    <span>Kept as credit</span>{' '}
                    <span className="font-semibold text-foreground tabular">{formatBDT(split.kept)}</span>
                  </span>
                )}
              </div>
            )}

            <Card className="overflow-hidden">
              {firstLoad ? (
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
                        <th className="text-left px-2 py-2.5 font-medium">Customer</th>
                        <th className="text-left px-2 py-2.5 font-medium">Reason</th>
                        <th className="text-left px-2 py-2.5 font-medium">Refund via</th>
                        <th className="text-right px-4 py-2.5 font-medium">Refund</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r) => (
                        // The row opens the return (was a 28px eye).
                        <tr
                          key={r.id}
                          className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                          onClick={() => setViewing(r.id)}
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap">{fmt.date(r.date)}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <div>{r.refNo}</div>
                            {/* The original invoice, under the return number. */}
                            <div className="text-xs text-muted-foreground">{r.saleInvoiceNo}</div>
                          </td>
                          <td className="px-2 py-2.5 font-medium">{r.customerName}</td>
                          <td className="px-2 py-2.5">{r.reason ? labelFor('returnReason', r.reason) : '—'}</td>
                          <td className="px-2 py-2.5 whitespace-nowrap">{refundLabel(r.refundMethod)}</td>
                          <td className="px-4 py-2.5 text-right tabular font-semibold">
                            {formatBDT(r.total)}
                          </td>
                        </tr>
                      ))}
                      {list.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                            No matches.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {list.length > 0 && (
                    <Pagination
                      page={current}
                      pageSize={pageSize}
                      total={list.length}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                      label="returns"
                    />
                  )}
                </>
              )}
            </Card>
          </>
        )}
      </div>

      <ReturnDetail kind="sell" id={viewing} open={!!viewing} onClose={() => setViewing(null)} />
      <FindSaleForReturnModal
        open={finding}
        onClose={() => setFinding(false)}
        onFound={(id) => {
          setFinding(false);
          setReturnFor(id);
        }}
      />
      <CreateReturnModal
        open={!!returnFor}
        onClose={() => setReturnFor(null)}
        saleId={returnFor}
      />
    </div>
  );
}
