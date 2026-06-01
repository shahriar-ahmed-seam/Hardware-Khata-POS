import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Search, Eye } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCashRegister, shiftDuration, type Shift } from '@/stores/cashRegister';
import { ShiftReport } from '@/components/cash/ShiftReport';
import { formatBDT, cn } from '@/lib/utils';

type Range = 'all' | 'today' | 'week' | 'month';

export default function RegisterReport() {
  const nav = useNavigate();
  const shifts = useCashRegister((s) => s.shifts);
  const hydrate = useCashRegister((s) => s.hydrate);
  const [q, setQ] = useState('');
  const [range, setRange] = useState<Range>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [openShift, setOpenShift] = useState<Shift | null>(null);

  // Mirror Purchases.tsx: hydrate from the backend on mount so the shift history
  // reflects the DB when this page is the entry point.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const list = useMemo(() => {
    const now = Date.now();
    let arr = [...shifts].sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    );
    if (range === 'today') {
      arr = arr.filter(
        (s) => new Date(s.openedAt).toDateString() === new Date(now).toDateString(),
      );
    } else if (range === 'week') {
      arr = arr.filter((s) => now - new Date(s.openedAt).getTime() < 7 * 86_400_000);
    } else if (range === 'month') {
      arr = arr.filter((s) => now - new Date(s.openedAt).getTime() < 30 * 86_400_000);
    }
    if (statusFilter !== 'all') {
      arr = arr.filter((s) => s.status === statusFilter);
    }
    if (q) {
      const t = q.toLowerCase();
      arr = arr.filter((s) =>
        `#${s.shiftNo} ${s.openedBy} ${s.closedBy ?? ''} ${s.branch}`
          .toLowerCase()
          .includes(t),
      );
    }
    return arr;
  }, [shifts, q, range, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Register Report"
        subtitle="History of all shifts"
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => nav('/cash-register')}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button variant="outline" size="sm">
              <Download className="size-4" /> Export
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-4">
        <Card className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search shift #, opener, closer, branch…"
              className="pl-9"
            />
          </div>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
            className="h-9 px-2 text-sm rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select>
          <div className="flex items-center gap-0.5 p-0.5 bg-secondary rounded-md text-xs">
            {(['all', 'open', 'closed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1 rounded font-medium capitalize transition',
                  statusFilter === s
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
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase text-muted-foreground bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Shift</th>
                <th className="text-left px-2 py-2.5 font-medium">Branch</th>
                <th className="text-left px-2 py-2.5 font-medium">Opened</th>
                <th className="text-left px-2 py-2.5 font-medium">Closed</th>
                <th className="text-right px-2 py-2.5 font-medium">Duration</th>
                <th className="text-right px-2 py-2.5 font-medium">Opening</th>
                <th className="text-right px-2 py-2.5 font-medium">In</th>
                <th className="text-right px-2 py-2.5 font-medium">Out</th>
                <th className="text-right px-2 py-2.5 font-medium">Counted</th>
                <th className="text-right px-2 py-2.5 font-medium">Variance</th>
                <th className="text-left px-2 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const cashIn = s.totals?.cashIn ?? 0;
                const cashOut = s.totals?.cashOut ?? 0;
                const variance = s.variance;
                return (
                  <tr
                    key={s.id}
                    className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                    onClick={() => setOpenShift(s)}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">#{s.shiftNo}</td>
                    <td className="px-2 py-2.5 text-xs">{s.branch}</td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground">
                      {new Date(s.openedAt).toLocaleString('en-GB')}
                      <div className="text-[10px]">by {s.openedBy}</div>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground">
                      {s.closedAt ? (
                        <>
                          {new Date(s.closedAt).toLocaleString('en-GB')}
                          <div className="text-[10px]">by {s.closedBy}</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right text-xs text-muted-foreground tabular">
                      {shiftDuration(s)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular">
                      {formatBDT(s.openingCash, { withSymbol: false })}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular text-success">
                      {formatBDT(cashIn, { withSymbol: false })}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular text-warning">
                      {formatBDT(cashOut, { withSymbol: false })}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular font-semibold">
                      {s.countedTotal !== undefined
                        ? formatBDT(s.countedTotal, { withSymbol: false })
                        : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-2 py-2.5 text-right font-mono tabular',
                        variance === undefined
                          ? 'text-muted-foreground'
                          : variance === 0
                            ? 'text-success'
                            : Math.abs(variance) >= 100
                              ? 'text-destructive'
                              : 'text-warning',
                      )}
                    >
                      {variance !== undefined
                        ? `${variance >= 0 ? '+' : ''}${formatBDT(variance, { withSymbol: false })}`
                        : '—'}
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge variant={s.status === 'open' ? 'info' : 'default'}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenShift(s);
                        }}
                        className="size-7 grid place-items-center rounded hover:bg-secondary"
                      >
                        <Eye className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-12 text-center text-muted-foreground text-sm"
                  >
                    No shifts match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {openShift && (
        <ShiftReport
          open={!!openShift}
          onClose={() => setOpenShift(null)}
          shift={openShift}
          variant={openShift.status === 'closed' ? 'Z' : 'X'}
        />
      )}
    </div>
  );
}
