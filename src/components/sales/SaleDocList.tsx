import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, ArrowRightCircle, AlertTriangle, FileText, PenSquare } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { useSales, type SaleRecord } from '@/stores/sales';
import { confirm } from '@/stores/confirm';
import { formatBDT } from '@/lib/utils';
import { hasBackend } from '@/lib/api';
import { parseRangeBound } from '@/lib/datetime';
import { useDateFormat } from '@/lib/formatDate';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { SaleDetail } from '@/components/sales/SaleDetail';

/**
 * DRAFTS and QUOTATIONS — one list, two kinds (they were two ~95% identical
 * pages). Both are "not sold yet": the main action is a labelled "Make sale",
 * Delete sits apart on the far right, and the whole row opens the document.
 */
type Kind = 'draft' | 'quotation';

const COPY: Record<
  Kind,
  {
    title: string;
    newLabel: string;
    emptyTitle: string;
    emptyHint: string;
    deleteTitle: string;
    pagerLabel: string;
  }
> = {
  draft: {
    title: 'Drafts',
    newLabel: 'New Draft',
    emptyTitle: 'No drafts',
    emptyHint: 'Save a sale as a draft when the customer will come back to finish it.',
    deleteTitle: 'Delete this draft?',
    pagerLabel: 'drafts',
  },
  quotation: {
    title: 'Quotations',
    newLabel: 'New Quotation',
    emptyTitle: 'No quotations',
    emptyHint: 'Make a quotation to give a customer a price in writing.',
    deleteTitle: 'Delete this quotation?',
    pagerLabel: 'quotations',
  },
};

/** Days left on a quote, counted to the END of its last local day (not UTC midnight). */
function daysLeft(validUntil: string): number {
  const end = parseRangeBound(validUntil, 'to').getTime();
  return Math.ceil((end - Date.now()) / 86_400_000) - 1;
}

export function SaleDocList({ kind }: { kind: Kind }) {
  const nav = useNavigate();
  const fmt = useDateFormat();
  const copy = COPY[kind];
  const sales = useSales((s) => s.sales);
  const deleteSale = useSales((s) => s.deleteSale);
  const loading = useSales((s) => s.loading);
  const total = useSales((s) => s.total);
  const query = useSales((s) => s.query);
  const loadPage = useSales((s) => s.loadPage);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const backend = hasBackend();

  // This page owns its query: one status, one page at a time. The store is
  // shared with the other sales screens, so their filters are cleared here
  // (the Sales Paid/Partial/Due chip is a real SQL filter).
  useEffect(() => {
    void loadPage({
      statuses: [kind],
      page: 1,
      q: undefined,
      customerId: undefined,
      userId: undefined,
      method: undefined,
      payment: undefined,
      from: undefined,
      to: undefined,
    });
  }, [loadPage, kind]);

  // Server-side search, debounced; first run skipped (mount already loaded).
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

  const list = sales;
  const firstLoad = backend && loading && sales.length === 0;
  // Nothing at all (not just no search hits): one empty state, no search, no pager.
  const nothing = !firstLoad && !loading && total === 0 && !q.trim();

  const remove = async (d: SaleRecord) => {
    if (await confirm({ title: copy.deleteTitle, message: d.invoiceNo, variant: 'destructive' }))
      deleteSale(d.id);
  };

  const newDoc = (
    <Link to={`/sales/new?status=${kind}`}>
      <Button>
        <Plus className="size-4" /> {copy.newLabel}
      </Button>
    </Link>
  );

  return (
    <div>
      <PageHeader title={copy.title} actions={newDoc} />

      <div className="p-6 space-y-4">
        {nothing ? (
          <Card>
            <EmptyState
              icon={kind === 'draft' ? PenSquare : FileText}
              title={copy.emptyTitle}
              message={copy.emptyHint}
              action={newDoc}
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
                  placeholder="Search reference / customer…"
                  aria-label="Search reference / customer…"
                  className="pl-9"
                />
              </div>
            </Card>

            <Card className="overflow-hidden">
              {firstLoad ? (
                <div className="p-4">
                  <SkeletonTable count={6} />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground bg-secondary/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Reference</th>
                      <th className="text-left px-2 py-2.5 font-medium">Customer</th>
                      <th className="text-left px-2 py-2.5 font-medium">
                        {kind === 'draft' ? 'Saved' : 'Created'}
                      </th>
                      {kind === 'quotation' && (
                        <th className="text-left px-2 py-2.5 font-medium">Valid until</th>
                      )}
                      {kind === 'draft' && (
                        <th className="text-right px-2 py-2.5 font-medium">Items</th>
                      )}
                      <th className="text-right px-2 pr-6 py-2.5 font-medium">Total</th>
                      <th className="px-4 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((d) => (
                      <tr
                        key={d.id}
                        className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                        onClick={() => setOpenId(d.id)}
                      >
                        <td className="px-4 py-2 whitespace-nowrap">{d.invoiceNo}</td>
                        <td className="px-2 py-2 font-medium">{d.customerName}</td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {fmt.date(d.date)}
                          {kind === 'draft' && (
                            <span className="text-muted-foreground"> {fmt.time(d.date)}</span>
                          )}
                        </td>
                        {kind === 'quotation' && (
                          <td className="px-2 py-2 whitespace-nowrap">
                            <ValidUntil value={d.validUntil} fmt={fmt.date} />
                          </td>
                        )}
                        {kind === 'draft' && (
                          <td className="px-2 py-2 text-right tabular">
                            {d.lines.reduce((s, l) => s + l.qty, 0)}
                          </td>
                        )}
                        <td className="px-2 pr-6 py-2 text-right tabular font-semibold">
                          {formatBDT(d.total)}
                        </td>
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end">
                            <Button onClick={() => nav(`/sales/${d.id}/edit?convert=true`)}>
                              <ArrowRightCircle className="size-4" /> Make sale
                            </Button>
                            {/* Kept well apart from the main action. */}
                            <IconButton
                              size="sm"
                              tone="danger"
                              label="Delete"
                              className="ml-4"
                              onClick={() => void remove(d)}
                            >
                              <Trash2 className="size-4" />
                            </IconButton>
                          </div>
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
              )}
              {total > 0 && (
                <Pagination
                  page={query.page}
                  pageSize={query.pageSize}
                  total={total}
                  onPageChange={(page) => void loadPage({ page })}
                  onPageSizeChange={(pageSize) => void loadPage({ pageSize })}
                  label={copy.pagerLabel}
                  busy={loading}
                />
              )}
            </Card>
          </>
        )}
      </div>

      {/* No return/ship handlers: these documents are not sold yet. */}
      <SaleDetail open={!!openId} onClose={() => setOpenId(null)} saleId={openId} />
    </div>
  );
}

/** Date, plus "Expires soon" (≤ 3 days, so the owner can call) or "Expired". */
function ValidUntil({ value, fmt }: { value?: string; fmt: (v: Date) => string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const left = daysLeft(value);
  const day = parseRangeBound(value, 'from');
  if (left < 0)
    return (
      <Badge variant="destructive">
        <AlertTriangle className="size-3.5" /> Expired
      </Badge>
    );
  return (
    <span className="inline-flex items-center gap-2">
      <span>{fmt(day)}</span>
      {left <= 3 && <Badge variant="warning">Expires soon</Badge>}
    </span>
  );
}
