import { useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowRight } from 'lucide-react';
import {
  ReportToolbar,
  DEFAULT_RANGE,
  isInRange,
  type DateRange,
} from '@/components/reports/ReportToolbar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useStock, type TransferStatus } from '@/stores/stock';
import { useBranches } from '@/stores/branches';
import { useReport, useBranchId } from '@/hooks/useReport';
import { hasBackend } from '@/lib/api';
import { formatBDT, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<TransferStatus, 'default' | 'warning' | 'info' | 'success' | 'destructive'> = {
  pending: 'warning',
  'in-transit': 'info',
  received: 'success',
  cancelled: 'destructive',
};

const TRANSFER_STATUSES: TransferStatus[] = ['pending', 'in-transit', 'received', 'cancelled'];
function normalizeStatus(s: string): TransferStatus {
  return (TRANSFER_STATUSES as string[]).includes(s) ? (s as TransferStatus) : 'pending';
}

/** Transfer row mapped for the page. */
interface TransferRow {
  id: string;
  refNo: string;
  date: string;
  fromBranch: string;
  toBranch: string;
  status: TransferStatus;
  lines: { qty: number; unitCost: number }[];
}

/** A `transfers.list` row (snake_case with nested lines). */
interface BackendTransfer {
  id: string;
  ref_no: string;
  date: string;
  from_branch: string;
  to_branch: string;
  status: string;
  created_by?: string | null;
  received_by?: string | null;
  lines: { qty: number; unit_cost: number }[];
}

export default function StockTransfersReportPage() {
  const transfers = useStock((s) => s.transfers);
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [branch, setBranch] = useState('');
  const [status, setStatus] = useState<TransferStatus | ''>('');

  // Backend wiring: `transfers.list {}` returns all rows; status + date-range +
  // branch filters stay client-side, matching the mock path.
  const branchId = useBranchId(branch);
  const branches = useBranches((s) => s.items);
  const branchNameById = useMemo(
    () => new Map(branches.map((b) => [b.id, b.name])),
    [branches],
  );
  const { data: beTransfers, loading, backend, error } = useReport<BackendTransfer[]>(
    'transfers.list',
    hasBackend() ? {} : null,
    [],
  );

  const source: TransferRow[] = useMemo(() => {
    // On a real backend error, do NOT fall back to the mock store — show empty.
    if (backend && error) return [];
    if (backend && beTransfers) {
      return beTransfers.map((t) => ({
        id: t.id,
        refNo: t.ref_no,
        date: t.date,
        fromBranch: branchNameById.get(t.from_branch) ?? t.from_branch,
        toBranch: branchNameById.get(t.to_branch) ?? t.to_branch,
        status: normalizeStatus(t.status),
        lines: t.lines.map((l) => ({ qty: l.qty, unitCost: l.unit_cost })),
      }));
    }
    return transfers.map((t) => ({
      id: t.id,
      refNo: t.refNo,
      date: t.date,
      fromBranch: t.fromBranch,
      toBranch: t.toBranch,
      status: t.status,
      lines: t.lines.map((l) => ({ qty: l.qty, unitCost: l.unitCost })),
    }));
  }, [backend, beTransfers, transfers, branchNameById, error]);

  const filtered = useMemo(() => {
    return source
      .filter((t) => isInRange(t.date, range))
      .filter(
        (t) =>
          !branch ||
          t.fromBranch === branch ||
          t.toBranch === branch ||
          t.fromBranch === branchId ||
          t.toBranch === branchId,
      )
      .filter((t) => !status || t.status === status)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [source, range, branch, branchId, status]);

  const summary = useMemo(() => {
    const map = new Map<TransferStatus, number>();
    let totalLines = 0;
    let totalValue = 0;
    for (const t of filtered) {
      map.set(t.status, (map.get(t.status) ?? 0) + 1);
      totalLines += t.lines.length;
      totalValue += t.lines.reduce((acc, l) => acc + l.qty * l.unitCost, 0);
    }
    return { byStatus: Array.from(map.entries()), totalLines, totalValue };
  }, [filtered]);

  return (
    <div>
      <ReportToolbar
        title="Stock Transfers Report"
        subtitle={`${formatNumber(filtered.length)} transfers · ${formatBDT(summary.totalValue)} value`}
        range={range}
        onRangeChange={setRange}
        branch={branch}
        onBranchChange={setBranch}
        filters={
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TransferStatus | '')}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in-transit">In transit</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        }
      />

      <div className="p-6 space-y-4 max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Transfers" value={formatNumber(filtered.length)} />
          <Kpi label="Total lines" value={formatNumber(summary.totalLines)} />
          <Kpi label="Total value" value={formatBDT(summary.totalValue)} tone="primary" />
          <Kpi
            label="Received"
            value={formatNumber(summary.byStatus.find(([k]) => k === 'received')?.[1] ?? 0)}
            tone="success"
          />
        </div>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_1.2fr_2fr_0.6fr_1fr_0.9fr] gap-2 px-4 py-2.5 border-b border-border bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
            <div>Date</div>
            <div>Ref</div>
            <div>From → To</div>
            <div className="text-right">Lines</div>
            <div className="text-right">Value</div>
            <div className="text-right">Status</div>
          </div>
          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              <ArrowLeftRight className="size-6 mx-auto mb-2 opacity-50" />
              {backend && loading ? 'Loading…' : backend && error ? 'Couldn’t load — backend error. Check connection and retry.' : 'No transfers in this range.'}
            </div>
          )}
          {filtered.map((t) => {
            const value = t.lines.reduce((a, l) => a + l.qty * l.unitCost, 0);
            return (
              <div
                key={t.id}
                className="grid grid-cols-[1fr_1.2fr_2fr_0.6fr_1fr_0.9fr] gap-2 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 text-sm cursor-pointer"
              >
                <div className="text-muted-foreground tabular">
                  {new Date(t.date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </div>
                <div className="font-mono text-xs">{t.refNo}</div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-medium truncate">{t.fromBranch}</span>
                  <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{t.toBranch}</span>
                </div>
                <div className="tabular text-right">{t.lines.length}</div>
                <div className="tabular text-right font-medium">{formatBDT(value)}</div>
                <div className="text-right">
                  <Badge variant={STATUS_TONE[t.status]}>{t.status}</Badge>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'success';
}) {
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-[0.06em]">
        {label}
      </div>
      <div
        className={cn(
          'tabular font-bold text-lg mt-1',
          tone === 'primary' && 'text-primary',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </div>
    </Card>
  );
}
