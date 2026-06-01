import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Sliders, Eye } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useStock, type AdjustmentType } from '@/stores/stock';
import { hasBackend } from '@/lib/api';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatBDT, cn } from '@/lib/utils';

const TYPE_VARIANT: Record<AdjustmentType, 'default' | 'destructive' | 'warning' | 'info'> = {
  damage: 'destructive',
  theft: 'destructive',
  sample: 'warning',
  recount: 'info',
  other: 'default',
};

export default function StockAdjustments() {
  const nav = useNavigate();
  const adjustments = useStock((s) => s.adjustments);
  const loading = useStock((s) => s.loading);
  const hydrate = useStock((s) => s.hydrate);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | AdjustmentType>('all');
  const backend = hasBackend();

  // Mirror Purchases.tsx: hydrate from the backend on mount so the store is
  // populated when this page is the entry point. No-op without backend.
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
    return arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [adjustments, q, typeFilter]);

  const totals = {
    count: list.length,
    impact: list.reduce(
      (s, a) => s + a.lines.reduce((u, l) => u + l.qty * l.unitCost, 0),
      0,
    ),
  };

  return (
    <div>
      <PageHeader
        title="Stock Adjustments"
        subtitle={`${totals.count} adjustments · net impact ${formatBDT(totals.impact)}`}
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
            />
          </div>
          <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
            {(['all', 'damage', 'theft', 'sample', 'recount', 'other'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setTypeFilter(s)}
                className={cn(
                  'px-3 py-1 rounded font-medium capitalize transition',
                  typeFilter === s
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          {backend && loading && adjustments.length === 0 ? (
            <div className="p-4">
              <SkeletonTable count={6} />
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Ref</th>
                <th className="text-left px-2 py-2.5 font-medium">Date</th>
                <th className="text-left px-2 py-2.5 font-medium">Branch</th>
                <th className="text-left px-2 py-2.5 font-medium">Type</th>
                <th className="text-right px-2 py-2.5 font-medium">Lines</th>
                <th className="text-right px-2 py-2.5 font-medium">Net Qty</th>
                <th className="text-right px-2 py-2.5 font-medium">Net Value</th>
                <th className="text-left px-2 py-2.5 font-medium">By</th>
                <th className="text-left px-2 py-2.5 font-medium">Reason</th>
                <th className="px-4 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const netQty = a.lines.reduce((s, l) => s + l.qty, 0);
                const netValue = a.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
                return (
                  <tr key={a.id} className="border-t border-border hover:bg-secondary/40">
                    <td className="px-4 py-2.5 font-mono text-xs">{a.refNo}</td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground">
                      {new Date(a.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-2 py-2.5">{a.branch}</td>
                    <td className="px-2 py-2.5">
                      <Badge variant={TYPE_VARIANT[a.type]}>{a.type}</Badge>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular">{a.lines.length}</td>
                    <td
                      className={cn(
                        'px-2 py-2.5 text-right font-mono tabular',
                        netQty < 0 ? 'text-destructive' : netQty > 0 ? 'text-success' : '',
                      )}
                    >
                      {netQty >= 0 ? '+' : ''}
                      {netQty}
                    </td>
                    <td
                      className={cn(
                        'px-2 py-2.5 text-right font-mono tabular',
                        netValue < 0 ? 'text-destructive' : netValue > 0 ? 'text-success' : '',
                      )}
                    >
                      {netValue >= 0 ? '+' : ''}
                      {formatBDT(netValue, { withSymbol: false })}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground">{a.createdBy}</td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground truncate max-w-[200px]">
                      {a.reason ?? '—'}
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
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No adjustments.
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

void Sliders;
