import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, ArrowRightCircle, Eye, Calendar, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { useSales } from '@/stores/sales';
import { confirm } from '@/stores/confirm';
import { formatBDT } from '@/lib/utils';
import { hasBackend } from '@/lib/api';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { SaleDetail } from '@/components/sales/SaleDetail';

export default function Quotations() {
  const nav = useNavigate();
  const sales = useSales((s) => s.sales);
  const deleteSale = useSales((s) => s.deleteSale);
  const loading = useSales((s) => s.loading);
  const total = useSales((s) => s.total);
  const query = useSales((s) => s.query);
  const loadPage = useSales((s) => s.loadPage);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const backend = hasBackend();

  // This page owns its query: only quotations, one page at a time. The server
  // filters by status, so there is no client-side status pass here. The other
  // sales screens share this store, so their filters are cleared here.
  useEffect(() => {
    void loadPage({
      statuses: ['quotation'],
      page: 1,
      q: undefined,
      customerId: undefined,
      userId: undefined,
      method: undefined,
      // Cleared for the same reason as the others: the Sales screen's
      // Paid/Partial/Due chip is a real SQL filter on this shared store.
      payment: undefined,
      from: undefined,
      to: undefined,
    });
  }, [loadPage]);

  // Search hits the database (reference + customer name) — debounced ~300ms.
  // First run skipped: the mount effect already loaded page 1.
  const searchMounted = useRef(false);
  useEffect(() => {
    if (!searchMounted.current) {
      searchMounted.current = true;
      return;
    }
    const handle = setTimeout(() => {
      void loadPage({ q: q.trim() || undefined });
    }, 300);
    return () => clearTimeout(handle);
  }, [q, loadPage]);

  // Rows come from the server already filtered; `total` is the full match count.
  const list = sales;

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle={`${total} quotations · convert to sale when accepted`}
        actions={
          <Link to="/sales/new?status=quotation">
            <Button>
              <Plus className="size-4" /> New Quotation
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-4">
        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search reference / customer…"
              className="pl-9"
            />
          </div>
        </Card>

        <Card className="overflow-hidden">
          {backend && loading && sales.length === 0 ? (
            <div className="p-4">
              <SkeletonTable count={6} />
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Reference</th>
                <th className="text-left px-2 py-2.5 font-medium">Customer</th>
                <th className="text-right px-2 py-2.5 font-medium">Total</th>
                <th className="text-left px-2 py-2.5 font-medium">Created</th>
                <th className="text-left px-2 py-2.5 font-medium">Valid until</th>
                <th className="px-4 py-2.5 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => {
                const expired = d.validUntil ? new Date(d.validUntil) < new Date() : false;
                return (
                  <tr key={d.id} className="border-t border-border hover:bg-secondary/40 group">
                    <td className="px-4 py-2.5 font-mono text-xs">{d.invoiceNo}</td>
                    <td className="px-2 py-2.5 font-medium">{d.customerName}</td>
                    <td className="px-2 py-2.5 text-right font-mono tabular font-semibold">
                      {formatBDT(d.total)}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground">
                      {new Date(d.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-2 py-2.5">
                      {d.validUntil ? (
                        expired ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="size-3" /> Expired
                          </Badge>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="size-3" />
                            {new Date(d.validUntil).toLocaleDateString('en-GB')}
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                        <button
                          onClick={() => setOpenId(d.id)}
                          className="size-7 grid place-items-center rounded hover:bg-secondary"
                          title="View"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          onClick={() => nav(`/sales/${d.id}/edit?convert=true`)}
                          className="size-7 grid place-items-center rounded hover:bg-secondary"
                          title="Convert to Sale"
                        >
                          <ArrowRightCircle className="size-3.5 text-primary" />
                        </button>
                        <button
                          onClick={async () => {
                            if (
                              await confirm({
                                title: `Delete quotation ${d.invoiceNo}?`,
                                variant: 'destructive',
                              })
                            )
                              deleteSale(d.id);
                          }}
                          className="size-7 grid place-items-center rounded hover:bg-destructive/10 hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No quotations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
          <Pagination
            page={query.page}
            pageSize={query.pageSize}
            total={total}
            onPageChange={(page) => void loadPage({ page })}
            onPageSizeChange={(pageSize) => void loadPage({ pageSize })}
            label="quotations"
            busy={loading}
          />
        </Card>
      </div>

      <SaleDetail open={!!openId} onClose={() => setOpenId(null)} saleId={openId} />
    </div>
  );
}
