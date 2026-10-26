import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Sliders } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/EmptyState';
import { StockDocDrawer } from '@/components/stock/StockDocDrawer';
import { useIsMultiBranch, useUserNameOf } from '@/components/stock/hooks';
import { useStock, type AdjustmentType, type StockAdjustment } from '@/stores/stock';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { labelFor } from '@/lib/labels';
import { useDateFormat } from '@/lib/formatDate';
import { formatBDT, formatNumber, cn } from '@/lib/utils';

const TYPE_VARIANT: Record<AdjustmentType, 'default' | 'destructive' | 'warning'> = {
  damage: 'destructive',
  theft: 'destructive',
  sample: 'warning',
  recount: 'default',
  other: 'default',
};

const FILTERS: { value: 'all' | AdjustmentType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'damage', label: 'Damage' },
  { value: 'theft', label: 'Theft' },
  { value: 'sample', label: 'Sample' },
  { value: 'recount', label: 'Recount' },
  { value: 'other', label: 'Other' },
];

const valueOf = (a: StockAdjustment) => a.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

export default function StockAdjustments() {
  const nav = useNavigate();
  const fmt = useDateFormat();
  const userName = useUserNameOf();
  const multiBranch = useIsMultiBranch();
  const adjustments = useStock((s) => s.adjustments);
  const loading = useStock((s) => s.loading);
  const hydrate = useStock((s) => s.hydrate);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | AdjustmentType>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  // Client-side paging: every row is already in memory — slice the filtered set.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const list = useMemo(() => {
    let arr = adjustments;
    if (typeFilter !== 'all') arr = arr.filter((a) => a.type === typeFilter);
    if (q) {
      const t = q.toLowerCase();
      arr = arr.filter((a) =>
        `${a.refNo} ${a.reason ?? ''} ${a.lines.map((l) => l.name).join(' ')}`
          .toLowerCase()
          .includes(t),
      );
    }
    return [...arr].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [adjustments, q, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [q, typeFilter, pageSize]);

  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => list.slice((current - 1) * pageSize, current * pageSize),
    [list, current, pageSize],
  );

  // Over the whole filtered set (all rows are in memory).
  const netImpact = list.reduce((s, a) => s + valueOf(a), 0);
  const opened = openId ? adjustments.find((a) => a.id === openId) : undefined;
  const cols = multiBranch ? 7 : 6;

  return (
    <div>
      <PageHeader
        title="Stock Adjustments"
        actions={
          <Button onClick={() => nav('/stock/adjustments/new')}>
            <Plus className="size-4" /> New Adjustment
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ref / reason / item…"
              className="pl-9"
              aria-label="Search adjustments"
            />
          </div>
          <Segmented ariaLabel="Adjustment type" value={typeFilter} onChange={setTypeFilter} options={FILTERS} />
          {list.length > 0 && (
            <div className="text-sm ml-auto px-2 whitespace-nowrap">
              <span className="text-muted-foreground">{netImpact < 0 ? 'Net loss' : 'Net gain'}</span>{' '}
              <span className={cn('tabular font-semibold', netImpact < 0 ? 'text-destructive' : netImpact > 0 ? 'text-success' : '')}>
                ৳ {formatNumber(Math.abs(Math.round(netImpact)))}
              </span>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          {loading && adjustments.length === 0 ? (
            <div className="p-4">
              <SkeletonTable count={6} />
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-secondary/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Date</th>
                    <th className="text-left px-2 py-2.5 font-medium">Type</th>
                    <th className="text-left px-2 py-2.5 font-medium">Items</th>
                    {multiBranch && <th className="text-left px-2 py-2.5 font-medium">Branch</th>}
                    <th className="text-right px-2 py-2.5 font-medium">Net value</th>
                    <th className="text-left px-2 py-2.5 font-medium">By</th>
                    <th className="text-left px-2 py-2.5 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((a) => {
                    const v = valueOf(a);
                    const first = a.lines[0]?.name ?? '—';
                    const more = a.lines.length - 1;
                    return (
                      <tr
                        key={a.id}
                        onClick={() => setOpenId(a.id)}
                        className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>{fmt.date(a.date)}</div>
                          <div className="text-xs text-muted-foreground font-mono">{a.refNo}</div>
                        </td>
                        <td className="px-2 py-3">
                          <Badge variant={TYPE_VARIANT[a.type]}>{labelFor('adjustmentType', a.type)}</Badge>
                        </td>
                        <td className="px-2 py-3">
                          <span className="font-medium">{first}</span>
                          {more > 0 && (
                            <span className="text-muted-foreground whitespace-nowrap">
                              {' '}
                              + <span className="tabular">{formatNumber(more)}</span> <span>more</span>
                            </span>
                          )}
                        </td>
                        {multiBranch && <td className="px-2 py-3 whitespace-nowrap">{a.branch}</td>}
                        <td
                          className={cn(
                            'px-2 py-3 text-right tabular whitespace-nowrap',
                            v < 0 ? 'text-destructive' : v > 0 ? 'text-success' : '',
                          )}
                        >
                          {v > 0 ? '+' : v < 0 ? '−' : ''}
                          {formatBDT(Math.abs(v), { withSymbol: false })}
                        </td>
                        <td className="px-2 py-3 text-muted-foreground whitespace-nowrap">{userName(a.createdBy)}</td>
                        <td className="px-2 py-3 text-muted-foreground truncate max-w-[220px]" title={a.reason}>
                          {a.reason ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={cols}>
                        <EmptyState
                          compact
                          icon={Sliders}
                          title={adjustments.length === 0 ? 'No adjustments yet.' : 'No adjustments match.'}
                          message={
                            adjustments.length === 0
                              ? 'Record broken, lost or recounted stock with New Adjustment.'
                              : undefined
                          }
                        />
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
                label="adjustments"
              />
            </>
          )}
        </Card>
      </div>

      {opened && (
        <StockDocDrawer
          open
          onClose={() => setOpenId(null)}
          title={labelFor('adjustmentType', opened.type)}
          subtitle={opened.refNo}
          signed
          facts={[
            { label: 'Date', value: fmt.dateTime(opened.date) },
            { label: 'Branch', value: multiBranch ? opened.branch : '' },
            { label: 'By', value: userName(opened.createdBy) },
            { label: 'Reason', value: opened.reason },
          ]}
          lines={opened.lines}
        />
      )}
    </div>
  );
}
